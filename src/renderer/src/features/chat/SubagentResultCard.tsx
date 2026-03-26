import { Streamdown } from 'streamdown';
import { format } from 'date-fns';
import { Bot } from 'lucide-react';

interface SubagentResultCardProps {
  agentName: string;
  content: string;
  timestamp: number;
}

export function SubagentResultCard({ agentName, content, timestamp }: SubagentResultCardProps): JSX.Element {
  const timeStr = format(timestamp, 'HH:mm');

  return (
    <div
      style={{
        border: '2px solid #F37440',
        borderRadius: '12px',
        overflow: 'hidden',
        margin: '16px 0',
      }}
    >
      {/* Header bar */}
      <div
        style={{
          backgroundColor: '#F37440',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <Bot size={16} style={{ color: 'white', flexShrink: 0 }} />
        <span
          style={{
            color: 'white',
            fontSize: '14px',
            fontWeight: 600,
            flex: 1,
          }}
        >
          {agentName}
        </span>
        <span
          style={{
            color: 'rgba(255, 255, 255, 0.8)',
            fontSize: '12px',
          }}
        >
          {timeStr}
        </span>
      </div>

      {/* Content area */}
      <div
        style={{
          padding: '16px',
          backgroundColor: '#262626',
        }}
      >
        <Streamdown mode="static" isAnimating={false}>
          {content}
        </Streamdown>
      </div>
    </div>
  );
}
