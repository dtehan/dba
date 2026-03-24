import { Database, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/app-store';

export function Sidebar(): JSX.Element {
  const currentPage = useAppStore((s) => s.currentPage);
  const setCurrentPage = useAppStore((s) => s.setCurrentPage);

  return (
    <aside className="w-[220px] min-w-[220px] h-full bg-surface-base border-r border-surface-border flex flex-col">
      {/* Logo / header area */}
      <div className="flex items-center gap-sm p-md">
        <Database size={24} className="text-td-orange shrink-0" />
        <span className="text-sm font-semibold text-text-primary">DBA Agent</span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col flex-1">
        <button
          type="button"
          onClick={() => setCurrentPage('settings')}
          className={cn(
            'flex items-center gap-sm h-[48px] w-full px-md text-sm transition-colors',
            'hover:bg-surface-card',
            'focus-visible:outline-2 focus-visible:outline-td-orange focus-visible:outline-offset-2',
            currentPage === 'settings'
              ? 'bg-surface-card border-l-4 border-td-orange text-text-primary'
              : 'text-text-muted border-l-4 border-transparent'
          )}
          aria-current={currentPage === 'settings' ? 'page' : undefined}
        >
          <Settings size={16} />
          <span>Settings</span>
        </button>
      </nav>
    </aside>
  );
}
