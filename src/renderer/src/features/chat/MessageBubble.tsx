import { useState, useCallback } from 'react';
import { Streamdown } from 'streamdown';
import { format } from 'date-fns';
import { Bot, User, Copy, Check } from 'lucide-react';
import type { ChatMessage } from '@shared/types';
import { sharedStreamdownProps } from './streamdown-config';

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps): JSX.Element {
  const timeStr = format(message.timestamp, 'HH:mm');
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [message.content]);

  if (message.role === 'assistant') {
    return (
      <div className="group flex gap-3 items-start">
        <div className="shrink-0 w-8 h-8 rounded-full bg-[rgba(243,116,64,0.15)] flex items-center justify-center mt-1">
          <Bot size={16} className="text-td-orange" />
        </div>
        <div className="flex-1 min-w-0 flex flex-col relative">
          <button
            onClick={handleCopy}
            className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1.5 rounded-md bg-surface-card border border-surface-border hover:bg-surface-border text-text-muted hover:text-text-primary z-10"
            title="Copy message"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
          <Streamdown
            {...sharedStreamdownProps}
            mode={message.isStreaming ? 'streaming' : 'static'}
            isAnimating={message.isStreaming}
            animated={{ animation: 'fadeIn', duration: 200, sep: 'word' }}
          >
            {message.content}
          </Streamdown>
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
        <div className="bg-td-orange/10 border border-td-orange/20 rounded-2xl rounded-tr-sm px-4 py-3 max-w-[80%]">
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
