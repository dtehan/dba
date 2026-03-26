import { Streamdown } from 'streamdown';
import { format } from 'date-fns';
import { Bot, User } from 'lucide-react';
import type { ChatMessage } from '@shared/types';

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps): JSX.Element {
  const timeStr = format(message.timestamp, 'HH:mm');

  if (message.role === 'assistant') {
    return (
      <div className="group flex gap-3 items-start">
        <div className="shrink-0 w-8 h-8 rounded-full bg-[rgba(243,116,64,0.15)] flex items-center justify-center mt-1">
          <Bot size={16} className="text-td-orange" />
        </div>
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="bg-[rgba(38,38,38,0.5)] rounded-2xl rounded-tl-sm px-4 py-3">
            <Streamdown
              mode={message.isStreaming ? 'streaming' : 'static'}
              isAnimating={message.isStreaming}
            >
              {message.content}
            </Streamdown>
          </div>
          <span className="text-xs text-text-muted mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {timeStr}
          </span>
        </div>
      </div>
    );
  }

  // User message
  return (
    <div className="group flex gap-3 items-start justify-end">
      <div className="flex-1 min-w-0 flex flex-col items-end">
        <div className="bg-[#262626] border border-surface-border rounded-2xl rounded-tr-sm px-4 py-3 max-w-[80%]">
          <p className="text-text-primary text-sm m-0 whitespace-pre-wrap break-words">
            {message.content}
          </p>
        </div>
        <span className="text-xs text-text-muted mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {timeStr}
        </span>
      </div>
      <div className="shrink-0 w-8 h-8 rounded-full bg-[#333] flex items-center justify-center mt-1">
        <User size={16} className="text-text-muted" />
      </div>
    </div>
  );
}
