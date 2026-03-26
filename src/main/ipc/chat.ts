import { ipcMain, BrowserWindow } from 'electron';
import { getBedrockClient, getMcpToolsForClaude, executeTool, clearToolsCache } from '../services/bedrock-client';
import { IpcChannels } from '@shared/types';

const MAX_TOOL_ROUNDS = 10;

let activeAbort: AbortController | null = null;

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
