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
  onConnectionStatus: (callback: (status: ConnectionStatus) => void) => {
    ipcRenderer.on(IpcChannels.CONNECTION_STATUS_UPDATE, (_event, status) => callback(status));
  },
  removeConnectionStatusListener: () => {
    ipcRenderer.removeAllListeners(IpcChannels.CONNECTION_STATUS_UPDATE);
  },
});
