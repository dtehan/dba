import { BrowserWindow } from 'electron';
import { IpcChannels } from '../../shared/types';
import type { ConnectionStatus, ConnectionState } from '../../shared/types';
import { getMcpUrl } from './mcp-manager';
import store from '../store';

const POLL_INTERVAL_MS = 30_000;
let pollTimer: ReturnType<typeof setInterval> | null = null;

async function checkTeradataStatus(): Promise<ConnectionState> {
  const mcpUrl = getMcpUrl();
  if (!mcpUrl || mcpUrl === 'http://127.0.0.1:8001/mcp') {
    // Check if user has saved a custom URL
    const savedHost = store.get('teradata.host');
    if (!savedHost) return 'not-configured';
  }

  // Quick reachability check
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5_000);
    const response = await fetch(getMcpUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'teradata-dba-agent', version: '1.0.0' } } }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response.ok ? 'connected' : 'disconnected';
  } catch {
    return 'disconnected';
  }
}

async function checkClaudeStatus(): Promise<ConnectionState> {
  const encryptedApiKey = store.get('claude.encryptedApiKey');
  const hasKey = typeof encryptedApiKey === 'string' && encryptedApiKey.length > 0;
  if (!hasKey) return 'not-configured';
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

  poll();
  pollTimer = setInterval(poll, POLL_INTERVAL_MS);

  win.on('blur', () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  });

  win.on('focus', () => {
    if (!pollTimer) {
      poll();
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
