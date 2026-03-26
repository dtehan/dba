import { ipcMain, BrowserWindow } from 'electron';
import { getBedrockClient, getMcpToolsForClaude, executeTool, clearToolsCache } from '../services/bedrock-client';
import { getSubagentConfig } from '../subagents/registry';
import { IpcChannels } from '@shared/types';
import { addRunEntry } from './subagent-history';

const MAX_TOOL_ROUNDS = 10;

let activeAbort: AbortController | null = null;

// ---------------------------------------------------------------------------
// Agent loop types
// ---------------------------------------------------------------------------

interface AgentLoopParams {
  client: any;
  modelId: string;
  systemPrompt: string;
  initialMessages: Array<{
    role: 'user' | 'assistant';
    content: string | Array<Record<string, unknown>>;
  }>;
  tools: Array<Record<string, unknown>>;
  maxToolRounds: number;
  maxTokens: number;
  controller: AbortController;
  onToken: (delta: string) => void;
}

interface AgentLoopResult {
  success: boolean;
  finalText: string;
  stopReason: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Core agent loop (shared by freeform chat and subagent launcher)
// ---------------------------------------------------------------------------

async function runAgentLoop(params: AgentLoopParams): Promise<AgentLoopResult> {
  const {
    client,
    modelId,
    systemPrompt,
    initialMessages,
    tools,
    maxToolRounds,
    maxTokens,
    controller,
    onToken,
  } = params;

  const conversationMessages = [...initialMessages];
  let accumulatedText = '';
  let lastStopReason = 'end_turn';

  let round = 0;
  while (round < maxToolRounds) {
    if (controller.signal.aborted) break;
    round++;

    const requestParams: Record<string, unknown> = {
      model: modelId,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: conversationMessages,
    };
    if (tools.length > 0) {
      requestParams.tools = tools;
    }

    const stream = client.messages.stream(requestParams as any, {
      signal: controller.signal,
    });

    stream.on('text', (delta: string) => {
      if (!controller.signal.aborted) {
        accumulatedText += delta;
        onToken(delta);
      }
    });

    let finalMessage: any;
    try {
      finalMessage = await stream.finalMessage();
    } catch (err: any) {
      if (err?.name === 'AbortError') break;
      throw err;
    }

    lastStopReason = finalMessage.stop_reason;

    if (finalMessage.stop_reason === 'tool_use') {
      const toolUseBlocks = finalMessage.content.filter(
        (block: any) => block.type === 'tool_use'
      );
      if (toolUseBlocks.length === 0) break;

      conversationMessages.push({
        role: 'assistant',
        content: finalMessage.content,
      });

      const toolResults: Array<Record<string, unknown>> = [];
      for (const toolBlock of toolUseBlocks) {
        if (controller.signal.aborted) break;

        onToken(`\n\n*Querying Teradata: ${toolBlock.name}...*\n\n`);
        const result = await executeTool(toolBlock.name, toolBlock.input as any);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolBlock.id,
          content: result,
        });
      }

      if (controller.signal.aborted) break;

      conversationMessages.push({
        role: 'user',
        content: toolResults,
      });
      continue;
    }

    // No tool use — done
    return { success: true, finalText: accumulatedText, stopReason: lastStopReason };
  }

  // Exited loop (max rounds or abort)
  return { success: true, finalText: accumulatedText, stopReason: lastStopReason };
}

// ---------------------------------------------------------------------------
// IPC handlers
// ---------------------------------------------------------------------------

export function registerChatHandlers(): void {
  // Allow renderer to force-refresh the MCP tools cache
  ipcMain.handle('chat:refresh-tools', async () => {
    clearToolsCache();
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

      if (activeAbort) {
        activeAbort.abort();
        activeAbort = null;
      }

      const controller = new AbortController();
      activeAbort = controller;

      try {
        const { client, modelId } = await getBedrockClient();
        const allTools = await getMcpToolsForClaude();

        const initialMessages = messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content as string | Array<Record<string, unknown>>,
        }));

        const result = await runAgentLoop({
          client,
          modelId,
          systemPrompt,
          initialMessages,
          tools: allTools,
          maxToolRounds: MAX_TOOL_ROUNDS,
          maxTokens: 4096,
          controller,
          onToken: (delta) => {
            if (!controller.signal.aborted && !win.isDestroyed()) {
              win.webContents.send(IpcChannels.CHAT_TOKEN, delta);
            }
          },
        });

        if (!controller.signal.aborted && !win.isDestroyed()) {
          win.webContents.send(IpcChannels.CHAT_DONE, { stopReason: result.stopReason });
        }
        activeAbort = null;
        return { success: true };
      } catch (err) {
        activeAbort = null;
        const message = err instanceof Error ? err.message : String(err);
        if (!controller.signal.aborted && !win.isDestroyed()) {
          win.webContents.send(IpcChannels.CHAT_ERROR, message);
        }
        return { success: false, error: message };
      }
    }
  );

  // Run a subagent through the chat streaming pipeline (launched from sidebar)
  ipcMain.handle(
    IpcChannels.CHAT_SEND_SUBAGENT,
    async (event, agentId: string, params: Record<string, string>, sessionId?: string) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win) return { success: false, error: 'No browser window found' };

      const ctx = { activeDatabaseName: params['databaseName'] ?? null, schemaContext: null, params };
      const config = getSubagentConfig(agentId, ctx);
      if (!config) return { success: false, error: `Subagent "${agentId}" has no chat config` };

      if (activeAbort) { activeAbort.abort(); activeAbort = null; }
      const controller = new AbortController();
      activeAbort = controller;

      const startTime = Date.now();

      try {
        const { client, modelId } = await getBedrockClient();
        const allTools = await getMcpToolsForClaude();
        const tools = config.toolFilter.length > 0
          ? allTools.filter((t: any) => config.toolFilter.includes(t.name))
          : allTools;

        const result = await runAgentLoop({
          client,
          modelId,
          systemPrompt: config.systemPrompt,
          initialMessages: [{ role: 'user', content: config.initialMessage }],
          tools,
          maxToolRounds: config.maxToolRounds,
          maxTokens: config.maxTokens,
          controller,
          onToken: (delta) => {
            if (!controller.signal.aborted && !win.isDestroyed()) {
              win.webContents.send(IpcChannels.CHAT_TOKEN, delta);
            }
          },
        });

        // Record successful run
        addRunEntry({
          agentId,
          timestamp: startTime,
          params,
          sessionId: sessionId || '',
          durationMs: Date.now() - startTime,
          status: 'completed',
        });

        if (!controller.signal.aborted && !win.isDestroyed()) {
          win.webContents.send(IpcChannels.CHAT_DONE, { stopReason: result.stopReason });
        }
        activeAbort = null;
        return { success: true };
      } catch (err) {
        // Record failed run
        addRunEntry({
          agentId,
          timestamp: startTime,
          params,
          sessionId: sessionId || '',
          durationMs: Date.now() - startTime,
          status: 'failed',
        });

        activeAbort = null;
        const message = err instanceof Error ? err.message : String(err);
        if (!controller.signal.aborted && !win.isDestroyed()) {
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
