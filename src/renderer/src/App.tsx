import { useEffect } from 'react';
import { useAppStore } from '@/store/app-store';
import { AppShell } from '@/components/AppShell';

function App(): JSX.Element {
  const setConnectionStatus = useAppStore((s) => s.setConnectionStatus);

  useEffect(() => {
    // Subscribe to connection status updates from main process
    try {
      const api = (window as { electronAPI?: { onConnectionStatus?: (cb: typeof setConnectionStatus) => void; removeConnectionStatusListener?: () => void } }).electronAPI;
      if (api?.onConnectionStatus) {
        api.onConnectionStatus(setConnectionStatus);
      }
    } catch {
      // Not running in Electron (e.g., during tests)
    }

    return () => {
      try {
        const api = (window as { electronAPI?: { removeConnectionStatusListener?: () => void } }).electronAPI;
        api?.removeConnectionStatusListener?.();
      } catch {
        // ignore
      }
    };
  }, [setConnectionStatus]);

  return <AppShell />;
}

export default App;
