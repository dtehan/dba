import { Streamdown } from 'streamdown';
import { format } from 'date-fns';
import type { ChatMessage } from '@shared/types';

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps): JSX.Element {
  const timeStr = format(message.timestamp, 'HH:mm');

  if (message.role === 'assistant') {
    return (
      <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        <div style={{ width: '100%' }}>
          <Streamdown
            mode={message.isStreaming ? 'streaming' : 'static'}
            isAnimating={message.isStreaming}
          >
            {message.content}
          </Streamdown>
        </div>
        <span style={{ fontSize: '12px', color: '#A3A3A3', marginTop: '4px' }}>{timeStr}</span>
      </div>
    );
  }

  // User message
  return (
    <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
      <div
        style={{
          backgroundColor: '#262626',
          borderRadius: '12px',
          padding: '12px 16px',
          maxWidth: '80%',
          marginLeft: 'auto',
        }}
      >
        <p style={{ color: '#F5F5F5', fontSize: '14px', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {message.content}
        </p>
      </div>
      <span style={{ fontSize: '12px', color: '#A3A3A3', marginTop: '4px' }}>{timeStr}</span>
    </div>
  );
}
