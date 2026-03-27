import { useEffect, useRef } from 'react';
import { useChatStore } from '@/store/chat-store';
import { useSubagentStore } from '@/store/subagent-store';
import { getElectronAPI } from '@/lib/ipc';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { SubagentLauncher } from '@/components/SubagentLauncher';

const BASE_SYSTEM_PROMPT = `You are an expert Teradata DBA assistant. You help database administrators analyze their Teradata environment, write optimized SQL queries, and understand performance characteristics.

You have access to tools that connect directly to the user's Teradata system via MCP. Use these tools to answer questions — list databases, describe tables, run queries, check space usage, analyze security, etc.

Rules:
- Never execute DDL or DML automatically. Only use tools for read-only queries and metadata inspection.
- Present any SQL modifications (ALTER, CREATE, DROP, INSERT, UPDATE, DELETE) as copy-paste recommendations only.
- All SQL must be valid Teradata SQL syntax (not ANSI or Oracle syntax).
- Use your tools to look up actual table and column names — don't guess or hallucinate them.
- When a tool returns an error, tell the user what happened and suggest how to fix it.`;

function buildSystemPrompt(
  agents: Array<{ name: string; description: string; category: string }>,
  syntaxContext?: { guidelines: string; index: string } | null
): string {
  let prompt = BASE_SYSTEM_PROMPT;

  if (syntaxContext?.guidelines || syntaxContext?.index) {
    prompt += `\n\n## Teradata SQL Syntax Reference\n\n${syntaxContext.guidelines}\n\nYou have a \`td_syntax\` tool available to look up detailed syntax for specific topics. Available topics:\n\n${syntaxContext.index}`;
  }

  if (agents.length === 0) return prompt;

  const agentLines = agents
    .map((a) => `- **${a.name}** (${a.category}): ${a.description}`)
    .join('\n');

  return `${prompt}

## Specialized Subagents
The user has access to specialized subagents above the chat that perform deep, multi-step analysis. You cannot run these yourself — they are launched by the user from the agent bar above. When a user's question would benefit from one of these agents, suggest they run it. For example: "For a thorough analysis of this, I'd suggest running the **Security Audit** agent from the bar above."

Available subagents:
${agentLines}`;
}

export function ChatScreen(): JSX.Element {
  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const error = useChatStore((s) => s.error);
  const agents = useSubagentStore((s) => s.agents);
  const syntaxRef = useRef<{ guidelines: string; index: string } | null>(null);

  useEffect(() => {
    const api = getElectronAPI();
    api.getSyntaxContext().then((ctx) => {
      syntaxRef.current = ctx;
    }).catch(() => {});
  }, []);

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
      const result = await api.sendChat(messagesForApi, buildSystemPrompt(agents, syntaxRef.current));
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
    <div className="flex flex-col h-full">
      <SubagentLauncher />
      <MessageList messages={messages} error={error} />
      <ChatInput isStreaming={isStreaming} onSubmit={sendMessage} />
    </div>
  );
}
