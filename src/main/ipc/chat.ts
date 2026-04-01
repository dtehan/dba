import { ipcMain, BrowserWindow } from 'electron';
import { getBedrockClient, getMcpToolsForClaude, executeTool, clearToolsCache } from '../services/bedrock-client';
import { getGeminiClient, executeToolGemini, convertToolsToGemini, clearGeminiToolsCache } from '../services/gemini-client';
import { getSubagentConfig } from '../subagents/registry';
import { IpcChannels } from '@shared/types';
import { addRunEntry } from './subagent-history';
import { getSyntaxToolDefinition, executeSyntaxTool } from '../services/syntax-tool';
import { getSyntaxGuidelines, getSyntaxIndex } from '../services/syntax-loader';
import store, { type LlmProvider } from '../store';
import type { Content, Part } from '@google/genai';

const MAX_TOOL_ROUNDS = 10;

let activeAbort: AbortController | null = null;

function getProvider(): LlmProvider {
  return ((store as any).get('llm.provider') as LlmProvider) || 'bedrock';
}

// ---------------------------------------------------------------------------
// Bedrock agent loop types
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
// Core Bedrock agent loop (existing)
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

        let result: string;
        if (toolBlock.name === 'td_syntax') {
          onToken('\n\n*Looking up syntax reference...*\n\n');
          result = executeSyntaxTool(toolBlock.input as { topics: string[] });
        } else {
          onToken(`\n\n*Querying Teradata: ${toolBlock.name}...*\n\n`);
          result = await executeTool(toolBlock.name, toolBlock.input as any);
        }
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
// Gemini agent loop
// ---------------------------------------------------------------------------

interface GeminiAgentLoopParams {
  systemPrompt: string;
  initialMessages: Array<{
    role: 'user' | 'assistant';
    content: string | Array<Record<string, unknown>>;
  }>;
  tools: Array<{ name: string; description: string; input_schema: Record<string, unknown> }>;
  maxToolRounds: number;
  maxTokens: number;
  controller: AbortController;
  onToken: (delta: string) => void;
}

function convertMessagesToGeminiContents(
  messages: Array<{ role: string; content: string | Array<Record<string, unknown>> }>
): Content[] {
  const contents: Content[] = [];

  for (const msg of messages) {
    const role = msg.role === 'assistant' ? 'model' : 'user';

    if (typeof msg.content === 'string') {
      contents.push({ role, parts: [{ text: msg.content }] });
    } else if (Array.isArray(msg.content)) {
      const parts: Part[] = [];
      for (const block of msg.content) {
        if (block.type === 'text') {
          parts.push({ text: block.text as string });
        } else if (block.type === 'tool_use') {
          parts.push({
            functionCall: {
              name: block.name as string,
              args: block.input as Record<string, unknown>,
            },
          });
        } else if (block.type === 'tool_result') {
          parts.push({
            functionResponse: {
              name: (block as any).tool_name || 'unknown',
              response: { result: block.content as string },
            },
          });
        }
      }
      if (parts.length > 0) contents.push({ role, parts });
    }
  }

  return contents;
}

async function runGeminiAgentLoop(params: GeminiAgentLoopParams): Promise<AgentLoopResult> {
  const {
    systemPrompt,
    initialMessages,
    tools,
    maxToolRounds,
    maxTokens,
    controller,
    onToken,
  } = params;

  const { ai, modelId } = getGeminiClient();

  const geminiTools = convertToolsToGemini(tools);
  const conversationContents = convertMessagesToGeminiContents(initialMessages);
  let accumulatedText = '';
  let lastStopReason = 'end_turn';

  let round = 0;
  while (round < maxToolRounds) {
    if (controller.signal.aborted) break;
    round++;

    try {
      const streamResponse = await ai.models.generateContentStream({
        model: modelId,
        contents: conversationContents,
        config: {
          systemInstruction: systemPrompt,
          ...(geminiTools.length > 0 ? { tools: geminiTools } : {}),
          maxOutputTokens: maxTokens,
          abortSignal: controller.signal,
        },
      });

      let hasToolCalls = false;
      const functionCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
      const assistantParts: Part[] = [];

      for await (const chunk of streamResponse) {
        if (controller.signal.aborted) break;

        for (const candidate of chunk.candidates || []) {
          for (const part of candidate.content?.parts || []) {
            if (part.text) {
              accumulatedText += part.text;
              onToken(part.text);
              assistantParts.push({ text: part.text });
            }
            if (part.functionCall) {
              hasToolCalls = true;
              functionCalls.push({
                name: part.functionCall.name!,
                args: (part.functionCall.args || {}) as Record<string, unknown>,
              });
              assistantParts.push({ functionCall: part.functionCall });
            }
          }

          if (candidate.finishReason) {
            lastStopReason = candidate.finishReason === 'STOP' ? 'end_turn' : candidate.finishReason;
          }
        }
      }

      if (!hasToolCalls || functionCalls.length === 0) {
        return { success: true, finalText: accumulatedText, stopReason: lastStopReason };
      }

      // Add assistant message with function calls to conversation history
      conversationContents.push({ role: 'model', parts: assistantParts });

      // Execute tool calls and send results back
      const functionResponseParts: Part[] = [];
      for (const fc of functionCalls) {
        if (controller.signal.aborted) break;

        let result: string;
        if (fc.name === 'td_syntax') {
          onToken('\n\n*Looking up syntax reference...*\n\n');
          result = executeSyntaxTool(fc.args as { topics: string[] });
        } else {
          onToken(`\n\n*Querying Teradata: ${fc.name}...*\n\n`);
          result = await executeToolGemini(fc.name, fc.args);
        }
        functionResponseParts.push({
          functionResponse: {
            name: fc.name,
            response: { result },
          },
        });
      }

      if (controller.signal.aborted) break;

      // Add tool results to conversation history
      conversationContents.push({ role: 'user', parts: functionResponseParts });
      lastStopReason = 'tool_use';
      continue;
    } catch (err: any) {
      if (err?.name === 'AbortError') break;
      throw err;
    }
  }

  return { success: true, finalText: accumulatedText, stopReason: lastStopReason };
}

// ---------------------------------------------------------------------------
// Unified dispatch — chooses Bedrock or Gemini based on provider setting
// ---------------------------------------------------------------------------

async function dispatchChat(
  messages: Array<{ role: string; content: string | Array<Record<string, unknown>> }>,
  systemPrompt: string,
  toolFilter: string[],
  maxToolRounds: number,
  maxTokens: number,
  controller: AbortController,
  onToken: (delta: string) => void
): Promise<AgentLoopResult> {
  const provider = getProvider();

  if (provider === 'gemini') {
    const allMcpTools: Array<{ name: string; description: string; input_schema: Record<string, unknown> }> = await (async () => {
      try {
        const mcpTools = await (await import('../services/mcp-schema')).discoverMcpTools();
        return mcpTools.map((t: any) => ({
          name: t.name as string,
          description: t.description as string,
          input_schema: t.inputSchema as Record<string, unknown>,
        }));
      } catch {
        return [];
      }
    })();
    const filteredTools = toolFilter.length > 0
      ? allMcpTools.filter((t) => toolFilter.includes(t.name))
      : allMcpTools;

    // Add syntax tool
    const syntaxDef = getSyntaxToolDefinition();
    const allTools = [...filteredTools, {
      name: syntaxDef.name as string,
      description: syntaxDef.description as string,
      input_schema: syntaxDef.input_schema as Record<string, unknown>,
    }];

    return runGeminiAgentLoop({
      systemPrompt,
      initialMessages: messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content as string | Array<Record<string, unknown>>,
      })),
      tools: allTools,
      maxToolRounds,
      maxTokens,
      controller,
      onToken,
    });
  }

  // Default: Bedrock
  const { client, modelId } = await getBedrockClient();
  const allMcpTools = toolFilter.length > 0
    ? (await getMcpToolsForClaude()).filter((t: any) => toolFilter.includes(t.name))
    : await getMcpToolsForClaude();
  const allTools = [...allMcpTools, getSyntaxToolDefinition()];

  return runAgentLoop({
    client,
    modelId,
    systemPrompt,
    initialMessages: messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content as string | Array<Record<string, unknown>>,
    })),
    tools: allTools,
    maxToolRounds,
    maxTokens,
    controller,
    onToken,
  });
}

// ---------------------------------------------------------------------------
// IPC handlers
// ---------------------------------------------------------------------------

export function registerChatHandlers(): void {
  // Allow renderer to force-refresh the MCP tools cache
  ipcMain.handle('chat:refresh-tools', async () => {
    clearToolsCache();
    clearGeminiToolsCache();
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
        const result = await dispatchChat(
          messages,
          systemPrompt,
          [], // no tool filter for freeform chat
          MAX_TOOL_ROUNDS,
          4096,
          controller,
          (delta) => {
            if (!controller.signal.aborted && !win.isDestroyed()) {
              win.webContents.send(IpcChannels.CHAT_TOKEN, delta);
            }
          },
        );

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
        const result = await dispatchChat(
          [{ role: 'user', content: config.initialMessage }],
          config.systemPrompt,
          config.toolFilter,
          config.maxToolRounds,
          config.maxTokens,
          controller,
          (delta) => {
            if (!controller.signal.aborted && !win.isDestroyed()) {
              win.webContents.send(IpcChannels.CHAT_TOKEN, delta);
            }
          },
        );

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

  ipcMain.handle(IpcChannels.SYNTAX_CONTEXT, async () => {
    return { guidelines: getSyntaxGuidelines(), index: getSyntaxIndex() };
  });

  ipcMain.handle(IpcChannels.CHAT_ABORT, async () => {
    if (activeAbort) {
      activeAbort.abort();
      activeAbort = null;
    }
  });
}
