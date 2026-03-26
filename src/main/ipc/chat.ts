import { ipcMain, BrowserWindow } from 'electron';
import AnthropicBedrock from '@anthropic-ai/bedrock-sdk';
import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts';
import { getDecryptedAwsCredentials } from './claude';
import { callMcpTool, discoverMcpTools } from '../services/mcp-schema';
import store from '../store';
import { IpcChannels } from '@shared/types';

const DEFAULT_MODEL = 'us.anthropic.claude-sonnet-4-20250514-v1:0';
const MAX_TOOL_ROUNDS = 10;

let activeAbort: AbortController | null = null;

/** Cached MCP tools in Anthropic tool format */
let cachedTools: Array<{ name: string; description: string; input_schema: Record<string, unknown> }> | null = null;

async function getBedrockClient(): Promise<{ client: AnthropicBedrock; modelId: string }> {
  const { accessKeyId, secretKey } = getDecryptedAwsCredentials();
  const region: string = (store as any).get('claude.region') || 'us-west-2';
  const roleArn: string = (store as any).get('claude.roleArn') || '';
  const modelId: string = (store as any).get('claude.modelId') || DEFAULT_MODEL;

  let finalAccessKey = accessKeyId;
  let finalSecretKey = secretKey;
  let sessionToken: string | undefined;

  if (roleArn) {
    const sts = new STSClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey: secretKey,
      },
    });

    const assumed = await sts.send(
      new AssumeRoleCommand({
        RoleArn: roleArn,
        RoleSessionName: 'teradata-dba-agent-chat',
        DurationSeconds: 3600,
      })
    );

    if (!assumed.Credentials) {
      throw new Error('AssumeRole succeeded but returned no credentials');
    }

    finalAccessKey = assumed.Credentials.AccessKeyId!;
    finalSecretKey = assumed.Credentials.SecretAccessKey!;
    sessionToken = assumed.Credentials.SessionToken;
  }

  const client = new AnthropicBedrock({
    awsRegion: region,
    awsAccessKey: finalAccessKey,
    awsSecretKey: finalSecretKey,
    ...(sessionToken ? { awsSessionToken: sessionToken } : {}),
  });

  return { client, modelId };
}

/** Fetch MCP tools and convert to Anthropic tool format. Caches after first call. */
async function getMcpToolsForClaude(): Promise<
  Array<{ name: string; description: string; input_schema: Record<string, unknown> }>
> {
  if (cachedTools) return cachedTools;

  try {
    const mcpTools = await discoverMcpTools();
    cachedTools = mcpTools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    }));
    return cachedTools;
  } catch {
    // MCP not available — return empty, chat works without tools
    return [];
  }
}

/** Execute an MCP tool call by forwarding to the MCP server */
async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  try {
    // Convert all input values to strings for callMcpTool
    const stringArgs: Record<string, string> = {};
    for (const [key, value] of Object.entries(input)) {
      if (value !== null && value !== undefined) {
        stringArgs[key] = typeof value === 'string' ? value : JSON.stringify(value);
      }
    }
    return await callMcpTool(name, stringArgs);
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

export function registerChatHandlers(): void {
  // Allow renderer to force-refresh the MCP tools cache
  ipcMain.handle('chat:refresh-tools', async () => {
    cachedTools = null;
    const tools = await getMcpToolsForClaude();
    return { count: tools.length };
  });

  ipcMain.handle(
    IpcChannels.CHAT_SEND,
    async (
      event,
      messages: Array<{ role: string; content: string }>,
      systemPrompt: string
    ) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win) {
        return { success: false, error: 'No browser window found' };
      }

      // Abort any existing request
      if (activeAbort) {
        activeAbort.abort();
        activeAbort = null;
      }

      const controller = new AbortController();
      activeAbort = controller;

      try {
        const { client, modelId } = await getBedrockClient();
        const tools = await getMcpToolsForClaude();

        // Build the conversation — we'll extend it as tool calls happen
        const conversationMessages: Array<{
          role: 'user' | 'assistant';
          content: string | Array<Record<string, unknown>>;
        }> = messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

        let round = 0;
        while (round < MAX_TOOL_ROUNDS) {
          if (controller.signal.aborted) break;
          round++;

          // Build request — include tools only if MCP has them
          const requestParams: Record<string, unknown> = {
            model: modelId,
            max_tokens: 4096,
            system: systemPrompt,
            messages: conversationMessages,
          };
          if (tools.length > 0) {
            requestParams.tools = tools;
          }

          const stream = client.messages.stream(requestParams as any, {
            signal: controller.signal,
          });

          // Collect text deltas for streaming display
          stream.on('text', (delta) => {
            if (!controller.signal.aborted) {
              win.webContents.send(IpcChannels.CHAT_TOKEN, delta);
            }
          });

          let finalMessage: any;
          try {
            finalMessage = await stream.finalMessage();
          } catch (err: any) {
            if (err?.name === 'AbortError') break;
            throw err;
          }

          // Check if Claude wants to use tools
          if (finalMessage.stop_reason === 'tool_use') {
            const toolUseBlocks = finalMessage.content.filter(
              (block: any) => block.type === 'tool_use'
            );
            if (toolUseBlocks.length === 0) break;

            // Add assistant message with tool_use to conversation
            conversationMessages.push({
              role: 'assistant',
              content: finalMessage.content,
            });

            // Execute each tool and build tool_result blocks
            const toolResults: Array<Record<string, unknown>> = [];
            for (const toolBlock of toolUseBlocks) {
              if (controller.signal.aborted) break;

              // Show status to user
              win.webContents.send(
                IpcChannels.CHAT_TOKEN,
                `\n\n*Querying Teradata: ${toolBlock.name}...*\n\n`
              );

              const result = await executeTool(toolBlock.name, toolBlock.input as any);
              toolResults.push({
                type: 'tool_result',
                tool_use_id: toolBlock.id,
                content: result,
              });
            }

            if (controller.signal.aborted) break;

            // Add tool results as user message and loop back
            conversationMessages.push({
              role: 'user',
              content: toolResults,
            });
            continue;
          }

          // No tool use — done
          win.webContents.send(IpcChannels.CHAT_DONE, {
            stopReason: finalMessage.stop_reason,
          });
          activeAbort = null;
          return { success: true };
        }

        // Exited loop (max rounds or abort)
        if (!controller.signal.aborted) {
          win.webContents.send(IpcChannels.CHAT_DONE, { stopReason: 'end_turn' });
        }
        activeAbort = null;
        return { success: true };
      } catch (err) {
        activeAbort = null;
        const message = err instanceof Error ? err.message : String(err);
        if (!controller.signal.aborted) {
          win.webContents.send(IpcChannels.CHAT_ERROR, message);
        }
        return { success: false, error: message };
      }
    }
  );

  ipcMain.handle(IpcChannels.CHAT_ABORT, async () => {
    if (activeAbort) {
      activeAbort.abort();
      activeAbort = null;
    }
  });
}
