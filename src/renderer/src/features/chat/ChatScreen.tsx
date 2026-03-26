import { useChatStore } from '@/store/chat-store';
import { getElectronAPI } from '@/lib/ipc';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';

const SYSTEM_PROMPT = `You are an expert Teradata DBA assistant. You help database administrators analyze their Teradata environment, write optimized SQL queries, and understand performance characteristics.

You have access to tools that connect directly to the user's Teradata system via MCP. Use these tools to answer questions — list databases, describe tables, run queries, check space usage, analyze security, etc.

Rules:
- Never execute DDL or DML automatically. Only use tools for read-only queries and metadata inspection.
- Present any SQL modifications (ALTER, CREATE, DROP, INSERT, UPDATE, DELETE) as copy-paste recommendations only.
- All SQL must be valid Teradata SQL syntax (not ANSI or Oracle syntax).
- Use your tools to look up actual table and column names — don't guess or hallucinate them.
- When a tool returns an error, tell the user what happened and suggest how to fix it.`;

export function ChatScreen(): JSX.Element {
  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const error = useChatStore((s) => s.error);

  const sendMessage = async (content: string) => {
    const store = useChatStore.getState();

    // Add user message
    store.addUserMessage(content);

    // Add placeholder for assistant response
    const assistantId = store.addAssistantMessagePlaceholder();

    // Prepare messages for the API (use current messages excluding the empty placeholder)
    const currentMessages = useChatStore.getState().messages;
    const messagesForApi = currentMessages
      .filter((m) => !(m.id === assistantId && m.content === ''))
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const api = getElectronAPI();
      const result = await api.sendChat(messagesForApi, SYSTEM_PROMPT);
      if (!result.success && result.error) {
        store.setError(result.error);
        store.finalizeMessage(assistantId);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send message';
      store.setError(message);
      store.finalizeMessage(assistantId);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <MessageList messages={messages} error={error} />
      <ChatInput isStreaming={isStreaming} onSubmit={sendMessage} />
    </div>
  );
}
