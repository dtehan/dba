import { useEffect, useRef, useState } from 'react';
import { getElectronAPI } from '@/lib/ipc';
import { TeradataForm } from './TeradataForm';
import { ClaudeApiForm } from './ClaudeApiForm';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

export function SettingsScreen(): JSX.Element {
  const [confirmClear, setConfirmClear] = useState(false);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (confirmTimerRef.current) {
        clearTimeout(confirmTimerRef.current);
      }
    };
  }, []);

  const handleClearCredentials = async (): Promise<void> => {
    if (!confirmClear) {
      // First click: enter confirmation mode, revert after 5 seconds
      setConfirmClear(true);
      confirmTimerRef.current = setTimeout(() => {
        setConfirmClear(false);
      }, 5000);
      return;
    }

    // Second click: confirmed — clear all credentials
    if (confirmTimerRef.current) {
      clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = null;
    }
    setConfirmClear(false);

    try {
      await getElectronAPI().clearAllCredentials();
    } catch {
      // Ignore errors — credentials cleared best-effort
    }
  };

  return (
    <div className="p-xl overflow-auto h-full">
      <h1 className="text-2xl font-semibold text-text-primary mb-6">Settings</h1>

      <div className="max-w-2xl space-y-6">
        <TeradataForm />

        <Separator className="bg-border" />

        <ClaudeApiForm />

        <Separator className="bg-border" />

        {/* Clear all credentials — right-aligned, destructive */}
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={handleClearCredentials}
            className="border-destructive text-destructive hover:bg-destructive/10 focus-visible:outline-2 focus-visible:outline-destructive focus-visible:outline-offset-2"
          >
            {confirmClear ? 'Confirm — this cannot be undone' : 'Clear All Credentials'}
          </Button>
        </div>
      </div>
    </div>
  );
}
