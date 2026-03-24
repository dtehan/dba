import { Database, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/app-store';

export function Sidebar(): JSX.Element {
  const currentPage = useAppStore((s) => s.currentPage);
  const setCurrentPage = useAppStore((s) => s.setCurrentPage);

  return (
    <aside style={{ width: '220px', minWidth: '220px', backgroundColor: '#1A1A1A', borderRight: '1px solid #333333', display: 'flex', flexDirection: 'column' }}>
      {/* Logo / header area */}
      <div className="flex items-center gap-2 p-4">
        <Database size={24} className="text-[#F37440] shrink-0" />
        <span className="text-sm font-semibold text-[#F5F5F5]">DBA Agent</span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col flex-1">
        <button
          type="button"
          onClick={() => setCurrentPage('settings')}
          className={cn(
            'flex items-center gap-2 h-[48px] w-full px-4 text-sm transition-colors',
            'hover:bg-[#262626]',
            currentPage === 'settings'
              ? 'bg-[#262626] border-l-4 border-[#F37440] text-[#F5F5F5]'
              : 'text-[#A3A3A3] border-l-4 border-transparent'
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
