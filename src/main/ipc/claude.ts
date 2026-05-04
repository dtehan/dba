import { ipcMain, safeStorage } from 'electron';
import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts';
import AnthropicBedrock from '@anthropic-ai/bedrock-sdk';
import { GoogleGenAI } from '@google/genai';
import { OAuth2Client } from 'google-auth-library';
import { AzureOpenAI } from 'openai';
import store from '../store';
import { IpcChannels } from '@shared/types';
import { forcePoll } from '../services/health-poller';
import { getDecryptedGcloudToken } from '../services/gemini-client';

const DEFAULT_MODEL = 'us.anthropic.claude-sonnet-4-20250514-v1:0';
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const DEFAULT_AZURE_ENDPOINT = 'https://danie-m3uu72y9-francecentral.openai.azure.com/';
const DEFAULT_AZURE_API_VERSION = '2024-12-01-preview';
const DEFAULT_AZURE_DEPLOYMENT = 'gpt-5.4';

export function registerClaudeHandlers(): void {
  // -------------------------------------------------------------------------
  // LLM Provider selection
  // -------------------------------------------------------------------------

  ipcMain.handle(IpcChannels.LLM_SAVE_PROVIDER, async (_event, provider: unknown) => {
    if (provider !== 'bedrock' && provider !== 'gemini' && provider !== 'azure') throw new Error('Invalid provider');
    (store as any).set('llm.provider', provider);
    forcePoll();
  });

  ipcMain.handle(IpcChannels.LLM_LOAD_PROVIDER, async () => {
    return (store as any).get('llm.provider') || 'bedrock';
  });

  // -------------------------------------------------------------------------
  // Bedrock (AWS) credentials
  // -------------------------------------------------------------------------

  // Save AWS credentials encrypted via safeStorage
  ipcMain.handle(IpcChannels.SAVE_CLAUDE_KEY, async (_event, key: unknown) => {
    if (typeof key !== 'string' || !key) throw new Error('Invalid credentials');
    const encrypted = safeStorage.encryptString(key).toString('base64');
    store.set('claude.encryptedApiKey', encrypted);
    forcePoll();
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

  // Return masked key hints so the form can show keys are saved
  ipcMain.handle(IpcChannels.LOAD_CLAUDE_KEY_HINTS, async () => {
    try {
      const { accessKeyId, secretKey } = getDecryptedAwsCredentials();
      const maskKey = (key: string): string => {
        if (key.length <= 8) return '••••••••';
        return key.slice(0, 4) + '••••' + key.slice(-4);
      };
      return { accessKeyId: maskKey(accessKeyId), secretKey: maskKey(secretKey) };
    } catch {
      return null;
    }
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

  // -------------------------------------------------------------------------
  // Gemini credentials
  // -------------------------------------------------------------------------

  ipcMain.handle(IpcChannels.SAVE_GEMINI_KEY, async (_event, key: unknown) => {
    if (typeof key !== 'string' || !key) throw new Error('Invalid Gemini API key');
    const encrypted = safeStorage.encryptString(key).toString('base64');
    (store as any).set('llm.geminiEncryptedApiKey', encrypted);
    forcePoll();
  });

  ipcMain.handle(IpcChannels.HAS_GEMINI_KEY, async () => {
    const encrypted = (store as any).get('llm.geminiEncryptedApiKey');
    return typeof encrypted === 'string' && encrypted.length > 0;
  });

  ipcMain.handle(IpcChannels.LOAD_GEMINI_KEY_HINT, async () => {
    try {
      const encrypted = (store as any).get('llm.geminiEncryptedApiKey');
      if (!encrypted) return null;
      const decrypted = safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
      if (decrypted.length <= 8) return '••••••••';
      return decrypted.slice(0, 6) + '••••' + decrypted.slice(-4);
    } catch {
      return null;
    }
  });

  ipcMain.handle(IpcChannels.GEMINI_SAVE_MODEL, async (_event, model: unknown) => {
    (store as any).set('llm.geminiModel', typeof model === 'string' ? model : '');
  });

  ipcMain.handle(IpcChannels.GEMINI_LOAD_MODEL, async () => {
    return (store as any).get('llm.geminiModel') || DEFAULT_GEMINI_MODEL;
  });

  ipcMain.handle(IpcChannels.TEST_GEMINI_CONNECTION, async () => {
    try {
      const encrypted = (store as any).get('llm.geminiEncryptedApiKey');
      if (!encrypted) return { success: false, error: 'Gemini API key not configured' };
      const apiKey = safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
      const modelId = (store as any).get('llm.geminiModel') || DEFAULT_GEMINI_MODEL;

      const ai = new GoogleGenAI({ apiKey });
      await ai.models.generateContent({ model: modelId, contents: 'ping' });
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  // -------------------------------------------------------------------------
  // Gemini auth method + gcloud config
  // -------------------------------------------------------------------------

  ipcMain.handle(IpcChannels.GEMINI_SAVE_AUTH_METHOD, async (_event, method: unknown) => {
    if (method !== 'api-key' && method !== 'gcloud') throw new Error('Invalid auth method');
    (store as any).set('llm.geminiAuthMethod', method);
    forcePoll();
  });

  ipcMain.handle(IpcChannels.GEMINI_LOAD_AUTH_METHOD, async () => {
    return (store as any).get('llm.geminiAuthMethod') || 'api-key';
  });

  ipcMain.handle(IpcChannels.GEMINI_SAVE_GCLOUD_CONFIG, async (_event, config: unknown) => {
    const cfg = config as { project?: string; location?: string };
    (store as any).set('llm.geminiProject', cfg?.project || '');
    (store as any).set('llm.geminiLocation', cfg?.location || 'us-central1');
  });

  ipcMain.handle(IpcChannels.GEMINI_LOAD_GCLOUD_CONFIG, async () => {
    return {
      project: (store as any).get('llm.geminiProject') || '',
      location: (store as any).get('llm.geminiLocation') || 'us-central1',
    };
  });

  ipcMain.handle(IpcChannels.GEMINI_TEST_GCLOUD, async () => {
    try {
      const token = getDecryptedGcloudToken();
      const project: string = (store as any).get('llm.geminiProject') || '';
      const location: string = (store as any).get('llm.geminiLocation') || 'us-central1';
      const modelId: string = (store as any).get('llm.geminiModel') || DEFAULT_GEMINI_MODEL;

      if (!project) {
        return { success: false, error: 'Google Cloud project ID is required' };
      }

      const oauth2Client = new OAuth2Client();
      oauth2Client.setCredentials({ access_token: token });

      const ai = new GoogleGenAI({
        vertexai: true,
        project,
        location,
        googleAuthOptions: { authClient: oauth2Client },
      });

      await ai.models.generateContent({ model: modelId, contents: 'ping' });
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  // Save gcloud access token (encrypted)
  ipcMain.handle('gemini:save-gcloud-token', async (_event, token: unknown) => {
    if (typeof token !== 'string' || !token) throw new Error('Invalid access token');
    const encrypted = safeStorage.encryptString(token).toString('base64');
    (store as any).set('llm.geminiEncryptedGcloudToken', encrypted);
    forcePoll();
  });

  // Check if gcloud token is stored
  ipcMain.handle('gemini:has-gcloud-token', async () => {
    const encrypted = (store as any).get('llm.geminiEncryptedGcloudToken');
    return typeof encrypted === 'string' && encrypted.length > 0;
  });

  // Return masked hint for the stored gcloud token
  ipcMain.handle('gemini:load-gcloud-token-hint', async () => {
    try {
      const encrypted = (store as any).get('llm.geminiEncryptedGcloudToken');
      if (!encrypted) return null;
      const decrypted = safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
      if (decrypted.length <= 8) return '••••••••';
      return decrypted.slice(0, 6) + '••••' + decrypted.slice(-4);
    } catch {
      return null;
    }
  });

  // -------------------------------------------------------------------------
  // Azure OpenAI credentials + config
  // -------------------------------------------------------------------------

  ipcMain.handle(IpcChannels.SAVE_AZURE_KEY, async (_event, key: unknown) => {
    if (typeof key !== 'string' || !key) throw new Error('Invalid Azure OpenAI API key');
    const encrypted = safeStorage.encryptString(key).toString('base64');
    (store as any).set('llm.azureEncryptedApiKey', encrypted);
    forcePoll();
  });

  ipcMain.handle(IpcChannels.HAS_AZURE_KEY, async () => {
    const encrypted = (store as any).get('llm.azureEncryptedApiKey');
    return typeof encrypted === 'string' && encrypted.length > 0;
  });

  ipcMain.handle(IpcChannels.LOAD_AZURE_KEY_HINT, async () => {
    try {
      const encrypted = (store as any).get('llm.azureEncryptedApiKey');
      if (!encrypted) return null;
      const decrypted = safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
      if (decrypted.length <= 8) return '••••••••';
      return decrypted.slice(0, 6) + '••••' + decrypted.slice(-4);
    } catch {
      return null;
    }
  });

  ipcMain.handle(IpcChannels.AZURE_SAVE_CONFIG, async (_event, config: unknown) => {
    const cfg = config as { endpoint?: string; apiVersion?: string; deployment?: string };
    (store as any).set('llm.azureEndpoint', cfg?.endpoint && cfg.endpoint.length > 0 ? cfg.endpoint : DEFAULT_AZURE_ENDPOINT);
    (store as any).set('llm.azureApiVersion', cfg?.apiVersion && cfg.apiVersion.length > 0 ? cfg.apiVersion : DEFAULT_AZURE_API_VERSION);
    (store as any).set('llm.azureDeployment', cfg?.deployment && cfg.deployment.length > 0 ? cfg.deployment : DEFAULT_AZURE_DEPLOYMENT);
  });

  ipcMain.handle(IpcChannels.AZURE_LOAD_CONFIG, async () => {
    return {
      endpoint: (store as any).get('llm.azureEndpoint') || DEFAULT_AZURE_ENDPOINT,
      apiVersion: (store as any).get('llm.azureApiVersion') || DEFAULT_AZURE_API_VERSION,
      deployment: (store as any).get('llm.azureDeployment') || DEFAULT_AZURE_DEPLOYMENT,
    };
  });

  ipcMain.handle(IpcChannels.TEST_AZURE_CONNECTION, async () => {
    try {
      const encrypted = (store as any).get('llm.azureEncryptedApiKey');
      if (!encrypted) return { success: false, error: 'Azure OpenAI API key not configured' };
      const apiKey = safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
      const endpoint: string = (store as any).get('llm.azureEndpoint') || DEFAULT_AZURE_ENDPOINT;
      const apiVersion: string = (store as any).get('llm.azureApiVersion') || DEFAULT_AZURE_API_VERSION;
      const deployment: string = (store as any).get('llm.azureDeployment') || DEFAULT_AZURE_DEPLOYMENT;

      const client = new AzureOpenAI({ apiKey, endpoint, apiVersion, deployment });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15_000);

      try {
        await client.chat.completions.create(
          {
            model: deployment,
            max_completion_tokens: 16,
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
