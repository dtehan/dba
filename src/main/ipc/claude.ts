import { ipcMain, safeStorage } from 'electron';
import AnthropicBedrock from '@anthropic-ai/bedrock-sdk';
import store from '../store';
import { IpcChannels } from '@shared/types';

export function registerClaudeHandlers(): void {
  // Save AWS credentials encrypted via safeStorage
  // Expects JSON string: { accessKeyId, secretKey }
  ipcMain.handle(IpcChannels.SAVE_CLAUDE_KEY, async (_event, key: unknown) => {
    if (typeof key !== 'string' || !key) {
      throw new Error('Invalid credentials');
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

  // Check if AWS credentials are configured
  ipcMain.handle(IpcChannels.HAS_CLAUDE_KEY, async () => {
    const encryptedApiKey = store.get('claude.encryptedApiKey');
    return typeof encryptedApiKey === 'string' && encryptedApiKey.length > 0;
  });

  // Test Claude API connectivity via Bedrock
  ipcMain.handle(IpcChannels.TEST_CLAUDE_CONNECTION, async () => {
    try {
      const { accessKeyId, secretKey } = getDecryptedAwsCredentials();
      const region = (store as any).get('claude.region') || 'us-west-2';

      const client = new AnthropicBedrock({
        awsRegion: region,
        awsAccessKey: accessKeyId,
        awsSecretKey: secretKey,
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
 * Get decrypted AWS credentials for Bedrock.
 * Internal use only — NOT exposed via IPC.
 */
export function getDecryptedAwsCredentials(): { accessKeyId: string; secretKey: string } {
  const encryptedApiKey = store.get('claude.encryptedApiKey');
  if (!encryptedApiKey) {
    throw new Error('AWS credentials not configured');
  }
  const decrypted = safeStorage.decryptString(Buffer.from(encryptedApiKey, 'base64'));

  try {
    const parsed = JSON.parse(decrypted);
    if (!parsed.accessKeyId || !parsed.secretKey) {
      throw new Error('Invalid credential format');
    }
    return { accessKeyId: parsed.accessKeyId, secretKey: parsed.secretKey };
  } catch {
    // Legacy format — treat entire string as a single key
    throw new Error('AWS credentials need to be re-saved. Please enter your Access Key ID and Secret Access Key.');
  }
}
