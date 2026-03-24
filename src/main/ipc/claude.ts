import { ipcMain, safeStorage } from 'electron';
import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts';
import AnthropicBedrock from '@anthropic-ai/bedrock-sdk';
import store from '../store';
import { IpcChannels } from '@shared/types';

const DEFAULT_MODEL = 'anthropic.claude-sonnet-4-20250514-v1:0';

export function registerClaudeHandlers(): void {
  // Save AWS credentials encrypted via safeStorage
  ipcMain.handle(IpcChannels.SAVE_CLAUDE_KEY, async (_event, key: unknown) => {
    if (typeof key !== 'string' || !key) throw new Error('Invalid credentials');
    const encrypted = safeStorage.encryptString(key).toString('base64');
    store.set('claude.encryptedApiKey', encrypted);
  });

  // Save Bedrock region
  ipcMain.handle('claude:save-region', async (_event, region: unknown) => {
    if (typeof region !== 'string' || !region) throw new Error('Invalid region');
    store.set('claude.region' as any, region);
  });

  // Load Bedrock region
  ipcMain.handle('claude:load-region', async () => {
    return (store as any).get('claude.region') || 'us-west-2';
  });

  // Save Bedrock config (roleArn, modelId)
  ipcMain.handle('claude:save-config', async (_event, config: unknown) => {
    const cfg = config as { roleArn?: string; modelId?: string };
    (store as any).set('claude.roleArn', cfg?.roleArn || '');
    (store as any).set('claude.modelId', cfg?.modelId || '');
  });

  // Load Bedrock config
  ipcMain.handle('claude:load-config', async () => {
    return {
      roleArn: (store as any).get('claude.roleArn') || '',
      modelId: (store as any).get('claude.modelId') || '',
    };
  });

  // Check if AWS credentials are configured
  ipcMain.handle(IpcChannels.HAS_CLAUDE_KEY, async () => {
    const encrypted = store.get('claude.encryptedApiKey');
    return typeof encrypted === 'string' && encrypted.length > 0;
  });

  // Test Claude API connectivity via Bedrock
  ipcMain.handle(IpcChannels.TEST_CLAUDE_CONNECTION, async () => {
    try {
      const { accessKeyId, secretKey } = getDecryptedAwsCredentials();
      const region = (store as any).get('claude.region') || 'us-west-2';
      const roleArn: string = (store as any).get('claude.roleArn') || '';
      const modelId: string = (store as any).get('claude.modelId') || DEFAULT_MODEL;

      let finalAccessKey = accessKeyId;
      let finalSecretKey = secretKey;
      let sessionToken: string | undefined;

      // If role ARN is configured, assume the role first
      if (roleArn) {
        const sts = new STSClient({
          region,
          credentials: {
            accessKeyId,
            secretAccessKey: secretKey,
          },
        });

        const assumed = await sts.send(
          new AssumeRoleCommand({
            RoleArn: roleArn,
            RoleSessionName: 'teradata-dba-agent',
            DurationSeconds: 3600,
          })
        );

        if (!assumed.Credentials) {
          return { success: false, error: 'AssumeRole succeeded but returned no credentials' };
        }

        finalAccessKey = assumed.Credentials.AccessKeyId!;
        finalSecretKey = assumed.Credentials.SecretAccessKey!;
        sessionToken = assumed.Credentials.SessionToken;
      }

      const client = new AnthropicBedrock({
        awsRegion: region,
        awsAccessKey: finalAccessKey,
        awsSecretKey: finalSecretKey,
        ...(sessionToken ? { awsSessionToken: sessionToken } : {}),
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15_000);

      try {
        await client.messages.create(
          {
            model: modelId,
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
          return { success: false, error: 'Connection timed out after 15 seconds' };
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
 */
export function getDecryptedAwsCredentials(): { accessKeyId: string; secretKey: string } {
  const encrypted = store.get('claude.encryptedApiKey');
  if (!encrypted) throw new Error('AWS credentials not configured');
  const decrypted = safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
  try {
    const parsed = JSON.parse(decrypted);
    if (!parsed.accessKeyId || !parsed.secretKey) throw new Error('Invalid credential format');
    return { accessKeyId: parsed.accessKeyId, secretKey: parsed.secretKey };
  } catch {
    throw new Error('AWS credentials need to be re-saved. Please enter your Access Key ID and Secret Access Key.');
  }
}
