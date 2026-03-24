import { ipcMain, safeStorage } from 'electron';
import Anthropic from '@anthropic-ai/sdk';
import store from '../store';
import { claudeApiKeySchema } from '@shared/schemas';
import { IpcChannels } from '@shared/types';

export function registerClaudeHandlers(): void {
  // Save Claude API key encrypted via safeStorage
  ipcMain.handle(IpcChannels.SAVE_CLAUDE_KEY, async (_event, key: unknown) => {
    const result = claudeApiKeySchema.safeParse(key);
    if (!result.success) {
      throw new Error(`Invalid Claude API key: ${result.error.message}`);
    }

    const encryptedApiKey = safeStorage.encryptString(result.data).toString('base64');
    store.set('claude.encryptedApiKey', encryptedApiKey);
  });

  // Check if Claude API key is configured
  ipcMain.handle(IpcChannels.HAS_CLAUDE_KEY, async () => {
    const encryptedApiKey = store.get('claude.encryptedApiKey');
    return typeof encryptedApiKey === 'string' && encryptedApiKey.length > 0;
  });
}

/**
 * Get decrypted Claude API key.
 * Internal use only — NOT exposed via IPC. Called by Claude SDK and subagent runner.
 * Throws if key is not configured.
 */
export function getDecryptedClaudeKey(): string {
  const encryptedApiKey = store.get('claude.encryptedApiKey');

  if (!encryptedApiKey) {
    throw new Error('Claude API key not configured');
  }

  return safeStorage.decryptString(Buffer.from(encryptedApiKey, 'base64'));
}
