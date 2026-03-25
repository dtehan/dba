import { useChatStore } from '@/store/chat-store';
import { getElectronAPI } from '@/lib/ipc';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';

function buildSystemPrompt(schemaContext: string | null, activeDatabaseName: string | null): string {
  const base = `You are an expert Teradata DBA assistant. You help database administrators analyze their Teradata environment, write optimized SQL queries, and understand performance characteristics.

Rules:
- Never execute SQL automatically. Always present SQL as copy-paste recommendations.
- All SQL must be valid Teradata SQL syntax (not ANSI or Oracle syntax).
- Reference actual table and column names from the schema context when available.
- When you cannot determine something from the schema, say so — don't hallucinate column names.`;

  if (schemaContext) {
    return `${base}

## Active Database: ${activeDatabaseName ?? 'Unknown'}
## Schema Context
${schemaContext}
Use the above schema when answering questions about tables and columns.`;
  }

  return `${base}

No schema context is currently loaded. Ask the user to select a database if they need schema-aware responses.`;
}

export function ChatScreen(): JSX.Element {
  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const schemaContext = useChatStore((s) => s.schemaContext);
  const activeDatabaseName = useChatStore((s) => s.activeDatabaseName);
  const error = useChatStore((s) => s.error);

  const sendMessage = async (content: string) => {
    const store = useChatStore.getState();

    // Add user message
    store.addUserMessage(content);

    // Add placeholder for assistant response
    const assistantId = store.addAssistantMessagePlaceholder();

    // Build system prompt
    const systemPrompt = buildSystemPrompt(schemaContext, activeDatabaseName);

    // Prepare messages for the API (use current messages excluding the empty placeholder)
    const currentMessages = useChatStore.getState().messages;
    const messagesForApi = currentMessages
      .filter((m) => !(m.id === assistantId && m.content === ''))
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const api = getElectronAPI();
      const result = await api.sendChat(messagesForApi, systemPrompt);
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
