import { ipcMain, safeStorage } from 'electron';
import store from '../store';
import { teradataCredentialsSchema } from '@shared/schemas';
import { IpcChannels } from '@shared/types';
import type { TeradataCredentials } from '@shared/types';

export function registerCredentialHandlers(): void {
  // Save Teradata credentials: host as plaintext, username/password encrypted via safeStorage
  ipcMain.handle(IpcChannels.SAVE_TERADATA_CREDENTIALS, async (_event, creds: unknown) => {
    const result = teradataCredentialsSchema.safeParse(creds);
    if (!result.success) {
      throw new Error(`Invalid Teradata credentials: ${result.error.message}`);
    }

    const { host, username, password } = result.data;

    // Store host as plaintext (non-secret)
    store.set('teradata.host', host);

    // Encrypt and store username and password as base64
    const encryptedUsername = safeStorage.encryptString(username).toString('base64');
    const encryptedPassword = safeStorage.encryptString(password).toString('base64');

    store.set('teradata.encryptedUsername', encryptedUsername);
    store.set('teradata.encryptedPassword', encryptedPassword);
  });

  // Load Teradata host (non-secret, plaintext)
  ipcMain.handle(IpcChannels.LOAD_TERADATA_HOST, async () => {
    const host = store.get('teradata.host');
    return host && host.length > 0 ? host : null;
  });

  // Check if Teradata credentials are configured
  ipcMain.handle(IpcChannels.HAS_TERADATA_CREDENTIALS, async () => {
    const encryptedUsername = store.get('teradata.encryptedUsername');
    return typeof encryptedUsername === 'string' && encryptedUsername.length > 0;
  });

  // Clear all credentials and settings
  ipcMain.handle(IpcChannels.CLEAR_ALL_CREDENTIALS, async () => {
    store.clear();
  });
}

/**
 * Get decrypted Teradata credentials.
 * Internal use only — NOT exposed via IPC. Called by MCP manager.
 * Throws if credentials are not configured.
 */
export function getDecryptedTeradataCredentials(): TeradataCredentials {
  const host = store.get('teradata.host');
  const encryptedUsername = store.get('teradata.encryptedUsername');
  const encryptedPassword = store.get('teradata.encryptedPassword');

  if (!host || !encryptedUsername || !encryptedPassword) {
    throw new Error('Teradata credentials not configured');
  }

  const username = safeStorage.decryptString(Buffer.from(encryptedUsername, 'base64'));
  const password = safeStorage.decryptString(Buffer.from(encryptedPassword, 'base64'));

  return { host, username, password };
}
