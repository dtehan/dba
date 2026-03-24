import { app, shell, BrowserWindow, safeStorage } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerCredentialHandlers } from './ipc/credentials'
import { registerClaudeHandlers } from './ipc/claude'
import { registerMcpHandlers } from './ipc/mcp'
import { startHealthPolling, stopHealthPolling } from './services/health-poller'
// MCP server runs externally — no process to manage

function createWindow(): BrowserWindow {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Load the renderer
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.teradata.dba-agent')

  // Warn if OS keychain encryption is unavailable (credentials cannot be encrypted at rest)
  if (!safeStorage.isEncryptionAvailable()) {
    console.warn(
      '[safeStorage] Encryption is NOT available on this platform. ' +
        'Credentials cannot be securely stored. Check OS keychain configuration.'
    )
  }

  // Register IPC handlers before creating the window
  registerCredentialHandlers()
  registerClaudeHandlers()
  registerMcpHandlers()

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const mainWindow = createWindow()

  // Start health polling — pauses on blur, resumes on focus
  startHealthPolling(mainWindow)

  app.on('activate', function () {
    // On macOS re-create a window when the dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Clean up polling on app quit
app.on('before-quit', () => {
  stopHealthPolling()
})
