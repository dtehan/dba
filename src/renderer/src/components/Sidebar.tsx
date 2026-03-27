import { useEffect } from 'react';
import { Database, Settings, LayoutDashboard, ScrollText, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/app-store';
import { useChatStore } from '@/store/chat-store';

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function Sidebar(): JSX.Element {
  const currentPage = useAppStore((s) => s.currentPage);
  const setCurrentPage = useAppStore((s) => s.setCurrentPage);
  const sessions = useChatStore((s) => s.sessions);
  const sessionId = useChatStore((s) => s.sessionId);
  const newChat = useChatStore((s) => s.newChat);
  const loadSession = useChatStore((s) => s.loadSession);
  const deleteSession = useChatStore((s) => s.deleteSession);
  const refreshSessions = useChatStore((s) => s.refreshSessions);

  useEffect(() => {
    refreshSessions();
  }, []);

  const handleNewChat = () => {
    newChat();
    setCurrentPage('chat');
  };

  const handleLoadSession = (id: string) => {
    loadSession(id);
    setCurrentPage('chat');
  };

  return (
    <aside style={{ width: '220px', minWidth: '220px', backgroundColor: '#1A1A1A', borderRight: '1px solid #333333', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Logo / header area */}
      <div className="flex items-center gap-2 p-4">
        <Database size={24} className="text-[#F37440] shrink-0" />
        <span className="text-sm font-semibold text-[#F5F5F5]">DBA Agent</span>
      </div>

      {/* New Chat button */}
      <div style={{ padding: '0 8px 8px' }}>
        <button
          type="button"
          onClick={handleNewChat}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            width: '100%',
            height: '36px',
            borderRadius: '8px',
            border: '1px solid #F37440',
            backgroundColor: 'transparent',
            color: '#F37440',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <Plus size={16} />
          <span>New Chat</span>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col">
        <button
          type="button"
          onClick={() => setCurrentPage('overview')}
          className={cn(
            'flex items-center gap-2 h-[40px] w-full px-4 text-sm transition-colors',
            'hover:bg-[#262626]',
            currentPage === 'overview'
              ? 'bg-[#262626] border-l-4 border-[#F37440] text-[#F5F5F5]'
              : 'text-[#A3A3A3] border-l-4 border-transparent'
          )}
          aria-current={currentPage === 'overview' ? 'page' : undefined}
        >
          <LayoutDashboard size={16} />
          <span>Overview</span>
        </button>
        <button
          type="button"
          onClick={() => setCurrentPage('query-activity')}
          className={cn(
            'flex items-center gap-2 h-[40px] w-full px-4 text-sm transition-colors',
            'hover:bg-[#262626]',
            currentPage === 'query-activity'
              ? 'bg-[#262626] border-l-4 border-[#F37440] text-[#F5F5F5]'
              : 'text-[#A3A3A3] border-l-4 border-transparent'
          )}
          aria-current={currentPage === 'query-activity' ? 'page' : undefined}
        >
          <ScrollText size={16} />
          <span>Query Activity</span>
        </button>
        <button
          type="button"
          onClick={() => setCurrentPage('settings')}
          className={cn(
            'flex items-center gap-2 h-[40px] w-full px-4 text-sm transition-colors',
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

      {/* Chat history */}
      <div style={{ borderTop: '1px solid #333333', marginTop: '8px', flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <div style={{ padding: '8px 16px 4px', fontSize: '11px', fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Recent Chats
        </div>
        {sessions.length === 0 && (
          <p style={{ padding: '8px 16px', fontSize: '12px', color: '#525252', margin: 0 }}>
            No chat history yet
          </p>
        )}
        {sessions.map((s) => (
          <div
            key={s.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '0 4px 0 0',
            }}
          >
            <button
              type="button"
              onClick={() => handleLoadSession(s.id)}
              style={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                padding: '8px 12px',
                background: s.id === sessionId ? '#262626' : 'none',
                border: 'none',
                borderLeft: s.id === sessionId ? '3px solid #F37440' : '3px solid transparent',
                cursor: 'pointer',
                textAlign: 'left',
              }}
              className="hover:bg-[#262626]"
            >
              <span style={{
                fontSize: '12px',
                color: s.id === sessionId ? '#F5F5F5' : '#D4D4D4',
                fontWeight: s.id === sessionId ? 500 : 400,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'block',
              }}>
                {s.title}
              </span>
              <span style={{ fontSize: '10px', color: '#737373' }}>
                {formatRelativeTime(s.updatedAt)} · {s.messageCount} msgs
              </span>
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
              style={{
                flexShrink: 0,
                background: 'none',
                border: 'none',
                color: '#525252',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
              }}
              className="hover:text-[#EF4444]"
              title="Delete chat"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
