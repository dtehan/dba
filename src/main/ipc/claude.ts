import { ipcMain, safeStorage } from 'electron';
import AnthropicBedrock from '@anthropic-ai/bedrock-sdk';
import store from '../store';
import { IpcChannels } from '@shared/types';

export function registerClaudeHandlers(): void {
  // Save Claude bearer key encrypted via safeStorage
  ipcMain.handle(IpcChannels.SAVE_CLAUDE_KEY, async (_event, key: unknown) => {
    if (typeof key !== 'string' || !key) {
      throw new Error('Invalid bearer key');
    }
    const encryptedApiKey = safeStorage.encryptString(key).toString('base64');
    store.set('claude.encryptedApiKey', encryptedApiKey);
  });

  // Save Bedrock region (plaintext — not a secret)
  ipcMain.handle('claude:save-region', async (_event, region: unknown) => {
    if (typeof region !== 'string' || !region) {
      throw new Error('Invalid region');
    }
    store.set('claude.region' as any, region);
  });

  // Load Bedrock region
  ipcMain.handle('claude:load-region', async () => {
    return (store as any).get('claude.region') || 'us-west-2';
  });

  // Check if Claude bearer key is configured
  ipcMain.handle(IpcChannels.HAS_CLAUDE_KEY, async () => {
    const encryptedApiKey = store.get('claude.encryptedApiKey');
    return typeof encryptedApiKey === 'string' && encryptedApiKey.length > 0;
  });

  // Test Claude API connectivity via Bedrock with a minimal request and 10s timeout
  ipcMain.handle(IpcChannels.TEST_CLAUDE_CONNECTION, async () => {
    try {
      const bearerKey = getDecryptedClaudeKey();
      const region = (store as any).get('claude.region') || 'us-west-2';

      const client = new AnthropicBedrock({
        awsRegion: region,
        awsAccessKey: bearerKey,
        awsSecretKey: bearerKey,
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);

      try {
        await client.messages.create(
          {
            model: 'anthropic.claude-sonnet-4-20250514-v1:0',
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
 * Get decrypted Claude bearer key.
 * Internal use only — NOT exposed via IPC.
 */
export function getDecryptedClaudeKey(): string {
  const encryptedApiKey = store.get('claude.encryptedApiKey');
  if (!encryptedApiKey) {
    throw new Error('Claude bearer key not configured');
  }
  return safeStorage.decryptString(Buffer.from(encryptedApiKey, 'base64'));
}
