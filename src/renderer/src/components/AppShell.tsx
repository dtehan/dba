import { useAppStore } from '@/store/app-store';
import { Sidebar } from '@/components/Sidebar';
import { StatusBar } from '@/components/StatusBar';
import { WelcomeState } from '@/components/WelcomeState';
import { SettingsScreen } from '@/features/settings/SettingsScreen';

export function AppShell(): JSX.Element {
  const currentPage = useAppStore((s) => s.currentPage);

  return (
    <div className="flex flex-col h-screen bg-surface-base">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-surface-base">
          {currentPage === 'welcome' && <WelcomeState />}
          {currentPage === 'settings' && <SettingsScreen />}
        </main>
      </div>
      <StatusBar />
    </div>
  );
}
