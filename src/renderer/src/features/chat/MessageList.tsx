import { useEffect, useRef, useCallback } from 'react';
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
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const userScrolledUp = useRef(false);
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

  // Detect if user has scrolled up from the bottom
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    userScrolledUp.current = distanceFromBottom > 100;
  }, []);

  // Auto-scroll only when user is near the bottom
  useEffect(() => {
    if (!userScrolledUp.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, subagentResults.length, lastMessage?.content.length]);

  // Always scroll to bottom when a new user message is added
  useEffect(() => {
    userScrolledUp.current = false;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.filter((m) => m.role === 'user').length]);

  if (timeline.length === 0 && !error) {
    return (
      <div className="overflow-y-auto flex-1 px-4 flex flex-col items-center justify-center gap-3">
        <MessageSquare size={32} className="text-text-muted" />
        <p className="text-sm text-text-muted m-0">
          Ask anything about your Teradata environment
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} onScroll={handleScroll} className="overflow-y-auto flex-1 px-4">
      <div className="max-w-3xl mx-auto w-full py-6 space-y-6">
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
          <div className="border border-red-500 rounded-lg px-4 py-3 bg-[rgba(239,68,68,0.1)] text-red-500 text-sm">
            <strong>Error:</strong> {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
