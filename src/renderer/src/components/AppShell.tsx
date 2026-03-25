import { useAppStore } from '@/store/app-store';
import { Sidebar } from '@/components/Sidebar';
import { StatusBar } from '@/components/StatusBar';
import { ChatScreen } from '@/features/chat/ChatScreen';
import { SettingsScreen } from '@/features/settings/SettingsScreen';

export function AppShell(): JSX.Element {
  const currentPage = useAppStore((s) => s.currentPage);

  return (
    <div style={{ display: 'grid', gridTemplateRows: '1fr 48px', gridTemplateColumns: '220px 1fr', height: '100vh' }}>
      <Sidebar />
      <main style={{ overflow: 'hidden', backgroundColor: '#1A1A1A', display: 'flex', flexDirection: 'column' }}>
        {currentPage === 'chat' && <ChatScreen />}
        {currentPage === 'settings' && <SettingsScreen />}
      </main>
      <StatusBar />
    </div>
  );
}
