import { Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/app-store';

export function WelcomeState(): JSX.Element {
  const setCurrentPage = useAppStore((s) => s.setCurrentPage);

  return (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-md text-center">
        <Database size={48} className="text-td-orange" />
        <h1 className="text-2xl font-semibold text-text-primary">
          Welcome to Teradata DBA Agent
        </h1>
        <p className="text-sm text-text-muted">
          Configure your credentials in Settings to get started.
        </p>
        <Button
          className="bg-td-orange text-white hover:bg-td-orange-hover"
          onClick={() => setCurrentPage('settings')}
        >
          Go to Settings
        </Button>
      </div>
    </div>
  );
}
