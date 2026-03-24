import type { ConnectionState } from '@shared/types';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/store/app-store';

interface StatusIndicatorProps {
  label: string;
  state: ConnectionState;
}

function getStatusLabel(state: ConnectionState): string {
  switch (state) {
    case 'connected':
      return 'Connected';
    case 'disconnected':
      return 'Disconnected';
    case 'checking':
      return 'Checking...';
    case 'not-configured':
      return 'Not configured';
  }
}

function getDotClass(state: ConnectionState): string {
  switch (state) {
    case 'connected':
      return 'bg-status-connected';
    case 'disconnected':
      return 'bg-status-disconnected';
    case 'checking':
      return 'bg-status-checking animate-pulse';
    case 'not-configured':
      return 'bg-text-muted';
  }
}

function StatusIndicator({ label, state }: StatusIndicatorProps): JSX.Element {
  return (
    <div className="flex items-center gap-xs">
      <span className="text-xs text-text-muted">{label}</span>
      <Badge
        variant="outline"
        className="flex items-center gap-xs text-xs"
        role="status"
        aria-live="polite"
        aria-label={`${label} ${getStatusLabel(state)}`}
      >
        <div className={`w-2 h-2 rounded-full shrink-0 ${getDotClass(state)}`} />
        <span>{getStatusLabel(state)}</span>
      </Badge>
    </div>
  );
}

export function StatusBar(): JSX.Element {
  const connectionStatus = useAppStore((s) => s.connectionStatus);

  return (
    <div
      className="h-[48px] flex items-center gap-lg px-xl bg-surface-card border-t border-surface-border"
      aria-label="Connection status"
    >
      <StatusIndicator label="Teradata:" state={connectionStatus.teradata} />
      <StatusIndicator label="Claude API:" state={connectionStatus.claude} />
    </div>
  );
}
