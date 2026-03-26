import { useEffect, useRef } from 'react';
import { MessageSquare } from 'lucide-react';
import type { ChatMessage } from '@shared/types';
import type { SubagentResultEntry } from '@/store/chat-store';
import { useChatStore } from '@/store/chat-store';
import { MessageBubble } from './MessageBubble';
import { SubagentResultCard } from './SubagentResultCard';

type TimelineEntry =
  | { type: 'message'; data: ChatMessage }
  | { type: 'subagent'; data: SubagentResultEntry };

interface MessageListProps {
  messages: ChatMessage[];
  error: string | null;
}

export function MessageList({ messages, error }: MessageListProps): JSX.Element {
  const bottomRef = useRef<HTMLDivElement>(null);
  const subagentResults = useChatStore((s) => s.subagentResults);
  const lastMessage = messages[messages.length - 1];

  // Build a unified timeline sorted by timestamp
  const timeline: TimelineEntry[] = [
    ...messages.map((m): TimelineEntry => ({ type: 'message', data: m })),
    ...subagentResults.map((r): TimelineEntry => ({ type: 'subagent', data: r })),
  ].sort((a, b) => {
    const tsA = a.type === 'message' ? a.data.timestamp : a.data.timestamp;
    const tsB = b.type === 'message' ? b.data.timestamp : b.data.timestamp;
    return tsA - tsB;
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, subagentResults.length, lastMessage?.content.length]);

  if (timeline.length === 0 && !error) {
    return (
      <div
        style={{
          overflowY: 'auto',
          flex: 1,
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
        }}
      >
        <MessageSquare size={32} style={{ color: '#A3A3A3' }} />
        <p style={{ fontSize: '14px', color: '#A3A3A3', margin: 0 }}>
          Ask anything about your Teradata environment
        </p>
      </div>
    );
  }

  return (
    <div style={{ overflowY: 'auto', flex: 1, padding: '16px' }}>
      {timeline.map((entry) => {
        if (entry.type === 'message') {
          return <MessageBubble key={entry.data.id} message={entry.data} />;
        }
        return (
          <SubagentResultCard
            key={entry.data.id}
            agentName={entry.data.agentName}
            content={entry.data.content}
            timestamp={entry.data.timestamp}
          />
        );
      })}
      {error && (
        <div
          style={{
            border: '1px solid #EF4444',
            borderRadius: '8px',
            padding: '12px 16px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            color: '#EF4444',
            fontSize: '14px',
            marginTop: '8px',
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
