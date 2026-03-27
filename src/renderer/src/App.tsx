import { useEffect } from 'react';
import { useAppStore } from '@/store/app-store';
import { useChatStore } from '@/store/chat-store';
import { AppShell } from '@/components/AppShell';

function App(): JSX.Element {
  const setConnectionStatus = useAppStore((s) => s.setConnectionStatus);

  useEffect(() => {
    // Subscribe to connection status updates from main process
    try {
      const api = (window as { electronAPI?: { onConnectionStatus?: (cb: typeof setConnectionStatus) => void; removeConnectionStatusListener?: () => void; recheckConnections?: () => Promise<void> } }).electronAPI;
      if (api?.onConnectionStatus) {
        api.onConnectionStatus(setConnectionStatus);
      }
      // Request immediate status check now that the listener is registered
      api?.recheckConnections?.();
    } catch {
      // Not running in Electron (e.g., during tests)
    }

    // Register chat IPC listeners once at app mount to prevent listener accumulation
    try {
      const api = (window as { electronAPI?: {
        onChatToken?: (cb: (delta: string) => void) => void;
        onChatDone?: (cb: (result: { stopReason: string }) => void) => void;
        onChatError?: (cb: (error: string) => void) => void;
        removeChatListeners?: () => void;
      } }).electronAPI;

      if (api?.onChatToken) {
        api.onChatToken((delta) => {
          const msgId = useChatStore.getState().streamingMessageId;
          if (msgId) useChatStore.getState().appendToken(msgId, delta);
        });
      }

      if (api?.onChatDone) {
        api.onChatDone((_result) => {
          const msgId = useChatStore.getState().streamingMessageId;
          if (msgId) useChatStore.getState().finalizeMessage(msgId);
        });
      }

      if (api?.onChatError) {
        api.onChatError((error) => {
          useChatStore.getState().setError(error);
        });
      }
    } catch {
      // Not running in Electron (e.g., during tests)
    }

    return () => {
      try {
        const api = (window as { electronAPI?: {
          removeConnectionStatusListener?: () => void;
          removeChatListeners?: () => void;
        } }).electronAPI;
        api?.removeConnectionStatusListener?.();
        api?.removeChatListeners?.();
      } catch {
        // ignore
      }
    };
  }, [setConnectionStatus]);

  return <AppShell />;
}

export default App;
