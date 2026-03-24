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

  // Test Claude API connectivity with a minimal request and 10s timeout
  ipcMain.handle(IpcChannels.TEST_CLAUDE_CONNECTION, async () => {
    try {
      const apiKey = getDecryptedClaudeKey();
      const client = new Anthropic({ apiKey });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);

      try {
        await client.messages.create(
          {
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'ping' }],
          },
          { signal: controller.signal }
        );
        clearTimeout(timeoutId);
        return { success: true };
      } catch (err) {
        clearTimeout(timeoutId);
        if (err instanceof Error && err.name === 'AbortError') {
          return { success: false, error: 'Connection timed out after 10 seconds' };
        }
        throw err;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
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
