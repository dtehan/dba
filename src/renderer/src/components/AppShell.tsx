import { useAppStore } from '@/store/app-store';
import { Sidebar } from '@/components/Sidebar';
import { StatusBar } from '@/components/StatusBar';
import { WelcomeState } from '@/components/WelcomeState';
import { SettingsScreen } from '@/features/settings/SettingsScreen';

export function AppShell(): JSX.Element {
  const currentPage = useAppStore((s) => s.currentPage);

  return (
    <div style={{ display: 'grid', gridTemplateRows: '1fr 48px', gridTemplateColumns: '220px 1fr', height: '100vh' }}>
      <Sidebar />
      <main style={{ overflow: 'auto', backgroundColor: '#1A1A1A' }}>
        {currentPage === 'welcome' && <WelcomeState />}
        {currentPage === 'settings' && <SettingsScreen />}
      </main>
      <StatusBar />
    </div>
  );
}
