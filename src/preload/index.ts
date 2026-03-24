import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('electronAPI', {
      // Credentials
      saveTeradataCredentials: (creds: {
        host: string
        username: string
        password: string
      }) => ipcRenderer.invoke('credentials:save-teradata', creds),
      loadTeradataHost: () => ipcRenderer.invoke('credentials:load-teradata-host'),
      saveClaudeApiKey: (key: string) => ipcRenderer.invoke('credentials:save-claude-key', key),

      // MCP / health
      testTeradataConnection: () => ipcRenderer.invoke('mcp:test-connection'),
      testClaudeConnection: () => ipcRenderer.invoke('claude:test-connection'),

      // Status updates pushed from main → renderer
      onConnectionStatus: (
        callback: (status: { teradata: string; claude: string }) => void
      ) => {
        ipcRenderer.on('connection:status-update', (_event, status) => callback(status))
      },
      removeConnectionStatusListener: () =>
        ipcRenderer.removeAllListeners('connection:status-update')
    })
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in global d.ts file if you want type support)
  window.electron = electronAPI
}
