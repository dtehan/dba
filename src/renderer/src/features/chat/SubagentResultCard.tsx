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
    <div className="border-2 border-td-orange rounded-xl overflow-hidden">
      {/* Header bar */}
      <div className="bg-td-orange px-4 py-2 flex items-center gap-2">
        <Bot size={16} className="text-white shrink-0" />
        <span className="text-white text-sm font-semibold flex-1">
          {agentName}
        </span>
        <span className="text-white/80 text-xs">
          {timeStr}
        </span>
      </div>

      {/* Content area */}
      <div className="p-4 bg-[#262626]">
        <Streamdown mode="static" isAnimating={false}>
          {content}
        </Streamdown>
      </div>
    </div>
  );
}
