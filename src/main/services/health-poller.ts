import { BrowserWindow } from 'electron';
import { IpcChannels } from '../../shared/types';
import type { ConnectionStatus, ConnectionState } from '../../shared/types';
import { isMcpRunning } from './mcp-manager';
import store from '../store';

const POLL_INTERVAL_MS = 30_000;
let pollTimer: ReturnType<typeof setInterval> | null = null;

async function checkTeradataStatus(): Promise<ConnectionState> {
  const encryptedUsername = store.get('teradata.encryptedUsername');
  const hasCredentials = typeof encryptedUsername === 'string' && encryptedUsername.length > 0;
  if (!hasCredentials) return 'not-configured';
  return isMcpRunning() ? 'connected' : 'disconnected';
}

async function checkClaudeStatus(): Promise<ConnectionState> {
  const encryptedApiKey = store.get('claude.encryptedApiKey');
  const hasKey = typeof encryptedApiKey === 'string' && encryptedApiKey.length > 0;
  if (!hasKey) return 'not-configured';
  // For polling, we just check if key exists (actual API validation happens on explicit test)
  return 'connected';
}

async function checkBothConnections(): Promise<ConnectionStatus> {
  const [teradata, claude] = await Promise.all([
    checkTeradataStatus(),
    checkClaudeStatus(),
  ]);
  return { teradata, claude };
}

export function startHealthPolling(win: BrowserWindow): void {
  const poll = async (): Promise<void> => {
    const status = await checkBothConnections();
    if (!win.isDestroyed()) {
      win.webContents.send(IpcChannels.CONNECTION_STATUS_UPDATE, status);
    }
  };

  poll(); // immediate first check on startup
  pollTimer = setInterval(poll, POLL_INTERVAL_MS);

  // Pause polling when window loses focus to save resources and reduce Teradata load
  win.on('blur', () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  });

  // Resume polling when window regains focus
  win.on('focus', () => {
    if (!pollTimer) {
      poll(); // immediate check on focus resume
      pollTimer = setInterval(poll, POLL_INTERVAL_MS);
    }
  });
}

export function stopHealthPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
