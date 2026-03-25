import { useEffect, useRef } from 'react';
import { MessageSquare } from 'lucide-react';
import type { ChatMessage } from '@shared/types';
import { MessageBubble } from './MessageBubble';

interface MessageListProps {
  messages: ChatMessage[];
  error: string | null;
}

export function MessageList({ messages, error }: MessageListProps): JSX.Element {
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastMessage = messages[messages.length - 1];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, lastMessage?.content.length]);

  if (messages.length === 0 && !error) {
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
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
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
