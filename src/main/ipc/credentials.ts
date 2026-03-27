import { ipcMain } from 'electron';
import store from '../store';
import { IpcChannels } from '@shared/types';
import { forcePoll } from '../services/health-poller';

export function registerCredentialHandlers(): void {
  // Save MCP server URL (plaintext — it's just a URL, not a secret)
  ipcMain.handle(IpcChannels.SAVE_TERADATA_CREDENTIALS, async (_event, creds: unknown) => {
    const data = creds as { host?: string };
    if (!data?.host || typeof data.host !== 'string') {
      throw new Error('MCP server URL is required');
    }
    store.set('teradata.host', data.host);
    forcePoll();
  });

  // Re-check connections on demand (e.g., after settings change)
  ipcMain.handle(IpcChannels.CONNECTION_RECHECK, async () => {
    forcePoll();
  });

  // Load MCP server URL
  ipcMain.handle(IpcChannels.LOAD_TERADATA_HOST, async () => {
    const host = store.get('teradata.host');
    return host && host.length > 0 ? host : null;
  });

  // Check if MCP URL is configured
  ipcMain.handle(IpcChannels.HAS_TERADATA_CREDENTIALS, async () => {
    const host = store.get('teradata.host');
    return typeof host === 'string' && host.length > 0;
  });

  // Clear all credentials and settings
  ipcMain.handle(IpcChannels.CLEAR_ALL_CREDENTIALS, async () => {
    store.clear();
  });
}
