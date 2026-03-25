import { ipcMain, BrowserWindow } from 'electron';
import AnthropicBedrock from '@anthropic-ai/bedrock-sdk';
import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts';
import { getDecryptedAwsCredentials } from './claude';
import store from '../store';
import { IpcChannels } from '@shared/types';

const DEFAULT_MODEL = 'anthropic.claude-sonnet-4-20250514-v1:0';

let activeStream: { controller: AbortController } | null = null;

async function getBedrockClient(): Promise<{ client: AnthropicBedrock; modelId: string }> {
  const { accessKeyId, secretKey } = getDecryptedAwsCredentials();
  const region: string = (store as any).get('claude.region') || 'us-west-2';
  const roleArn: string = (store as any).get('claude.roleArn') || '';
  const modelId: string = (store as any).get('claude.modelId') || DEFAULT_MODEL;

  let finalAccessKey = accessKeyId;
  let finalSecretKey = secretKey;
  let sessionToken: string | undefined;

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
        RoleSessionName: 'teradata-dba-agent-chat',
        DurationSeconds: 3600,
      })
    );

    if (!assumed.Credentials) {
      throw new Error('AssumeRole succeeded but returned no credentials');
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

  return { client, modelId };
}

export function registerChatHandlers(): void {
  ipcMain.handle(IpcChannels.CHAT_SEND, async (event, messages: Array<{ role: string; content: string }>, systemPrompt: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) {
      return { success: false, error: 'No browser window found' };
    }

    // Abort any existing stream before starting a new one (prevents interleave)
    if (activeStream) {
      activeStream.controller.abort();
      activeStream = null;
    }

    try {
      const { client, modelId } = await getBedrockClient();

      const controller = new AbortController();
      activeStream = { controller };

      const stream = client.messages.stream(
        {
          model: modelId,
          max_tokens: 4096,
          system: systemPrompt,
          messages: messages as Array<{ role: 'user' | 'assistant'; content: string }>,
        },
        { signal: controller.signal }
      );

      stream.on('text', (delta) => {
        win.webContents.send(IpcChannels.CHAT_TOKEN, delta);
      });

      stream.on('message', (msg) => {
        win.webContents.send(IpcChannels.CHAT_DONE, { stopReason: msg.stop_reason });
        activeStream = null;
      });

      stream.on('error', (err) => {
        // Ignore abort errors — they are intentional
        if (err.name !== 'AbortError') {
          win.webContents.send(IpcChannels.CHAT_ERROR, err.message);
        }
        activeStream = null;
      });

      return { success: true };
    } catch (err) {
      activeStream = null;
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  ipcMain.handle(IpcChannels.CHAT_ABORT, async () => {
    if (activeStream) {
      activeStream.controller.abort();
      activeStream = null;
    }
  });
}
