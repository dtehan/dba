import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from '../shared/types';
import type { TeradataCredentials, ConnectionStatus } from '../shared/types';

contextBridge.exposeInMainWorld('electronAPI', {
  saveTeradataCredentials: (creds: TeradataCredentials) =>
    ipcRenderer.invoke(IpcChannels.SAVE_TERADATA_CREDENTIALS, creds),
  loadTeradataHost: () => ipcRenderer.invoke(IpcChannels.LOAD_TERADATA_HOST),
  saveClaudeApiKey: (key: string) => ipcRenderer.invoke(IpcChannels.SAVE_CLAUDE_KEY, key),
  clearAllCredentials: () => ipcRenderer.invoke(IpcChannels.CLEAR_ALL_CREDENTIALS),
  hasTeradataCredentials: () => ipcRenderer.invoke(IpcChannels.HAS_TERADATA_CREDENTIALS),
  hasClaudeKey: () => ipcRenderer.invoke(IpcChannels.HAS_CLAUDE_KEY),
  testTeradataConnection: () => ipcRenderer.invoke(IpcChannels.TEST_TERADATA_CONNECTION),
  testClaudeConnection: () => ipcRenderer.invoke(IpcChannels.TEST_CLAUDE_CONNECTION),
  saveBedrockRegion: (region: string) => ipcRenderer.invoke('claude:save-region', region),
  loadBedrockRegion: () => ipcRenderer.invoke('claude:load-region'),
  saveBedrockConfig: (config: { roleArn?: string; modelId?: string }) => ipcRenderer.invoke('claude:save-config', config),
  loadBedrockConfig: () => ipcRenderer.invoke('claude:load-config'),
  onConnectionStatus: (callback: (status: ConnectionStatus) => void) => {
    ipcRenderer.on(IpcChannels.CONNECTION_STATUS_UPDATE, (_event, status) => callback(status));
  },
  removeConnectionStatusListener: () => {
    ipcRenderer.removeAllListeners(IpcChannels.CONNECTION_STATUS_UPDATE);
  },
  sendChat: (messages: Array<{ role: string; content: string }>, systemPrompt: string) =>
    ipcRenderer.invoke(IpcChannels.CHAT_SEND, messages, systemPrompt),
  abortChat: () => ipcRenderer.invoke(IpcChannels.CHAT_ABORT),
  onChatToken: (cb: (delta: string) => void) =>
    ipcRenderer.on(IpcChannels.CHAT_TOKEN, (_e, delta) => cb(delta)),
  onChatDone: (cb: (result: { stopReason: string }) => void) =>
    ipcRenderer.on(IpcChannels.CHAT_DONE, (_e, result) => cb(result)),
  onChatError: (cb: (error: string) => void) =>
    ipcRenderer.on(IpcChannels.CHAT_ERROR, (_e, err) => cb(err)),
  removeChatListeners: () => {
    ipcRenderer.removeAllListeners(IpcChannels.CHAT_TOKEN);
    ipcRenderer.removeAllListeners(IpcChannels.CHAT_DONE);
    ipcRenderer.removeAllListeners(IpcChannels.CHAT_ERROR);
  },
  fetchSchemaContext: (databaseName: string) =>
    ipcRenderer.invoke(IpcChannels.SCHEMA_FETCH, databaseName),
  listDatabases: () =>
    ipcRenderer.invoke(IpcChannels.SCHEMA_LIST_DATABASES),
});
