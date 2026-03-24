import { useEffect, useRef, useState } from 'react';
import { TeradataForm } from './TeradataForm';
import { ClaudeApiForm } from './ClaudeApiForm';

export function SettingsScreen(): JSX.Element {
  const [confirmClear, setConfirmClear] = useState(false);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    };
  }, []);

  const handleClearCredentials = async (): Promise<void> => {
    if (!confirmClear) {
      setConfirmClear(true);
      confirmTimerRef.current = setTimeout(() => setConfirmClear(false), 5000);
      return;
    }
    if (confirmTimerRef.current) {
      clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = null;
    }
    setConfirmClear(false);
    try {
      const api = (window as any).electronAPI;
      await api?.clearAllCredentials?.();
    } catch {
      // best-effort
    }
  };

  return (
    <div style={{ padding: '32px', overflow: 'auto', height: '100%' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 600, color: '#F5F5F5', marginBottom: '24px' }}>Settings</h1>

      <div style={{ maxWidth: '672px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <TeradataForm />
        <ClaudeApiForm />

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={handleClearCredentials}
            style={{
              height: '36px',
              padding: '0 16px',
              border: '1px solid #EF4444',
              borderRadius: '6px',
              backgroundColor: 'transparent',
              color: '#EF4444',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            {confirmClear ? 'Confirm — this cannot be undone' : 'Clear All Credentials'}
          </button>
        </div>
      </div>
    </div>
  );
}
