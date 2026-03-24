import { useAppStore } from '@/store/app-store';
import { Sidebar } from '@/components/Sidebar';
import { StatusBar } from '@/components/StatusBar';
import { WelcomeState } from '@/components/WelcomeState';

export function AppShell(): JSX.Element {
  const currentPage = useAppStore((s) => s.currentPage);

  return (
    <div className="flex flex-col h-screen bg-surface-base">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-surface-base">
          {currentPage === 'welcome' && <WelcomeState />}
          {currentPage === 'settings' && (
            <div className="p-xl text-text-muted">Settings (Plan 05)</div>
          )}
        </main>
      </div>
      <StatusBar />
    </div>
  );
}
