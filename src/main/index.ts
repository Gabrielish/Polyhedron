import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import iconWin from '../../resources/icon.ico?asset'
import icon from '../../resources/icon.png?asset'
import { closeDb, getDb } from './database/connection'
import { createRepositoryRegistry } from './database/repositories/registry'
import { registerConfigHandlers } from './ipc/config.ipc'
import { registerDictionaryHandlers } from './ipc/dictionary.ipc'
import { registerDialogueHandlers } from './ipc/dialogue.ipc'
import { registerFsHandlers } from './ipc/fs.ipc'
import { registerLanguageHandlers } from './ipc/language.ipc'
import { registerLogHandlers } from './ipc/log.ipc'
import { registerMergeHandlers } from './ipc/merge.ipc'
import { registerMetricsHandlers } from './ipc/metrics.ipc'
import { registerModHandlers } from './ipc/mod.ipc'
import { registerPromptSlotHandlers } from './ipc/prompt-slot.ipc'
import { registerTranslationHandlers } from './ipc/translation.ipc'
import { registerSessionHandlers } from './ipc/session.ipc'
import { registerCloudHandlers } from './ipc/cloud.ipc'
import { registerWindowHandlers, setupWindowEvents } from './ipc/window.ipc'
import { registerWorkspaceHandlers } from './ipc/workspace.ipc'
import { registerXmlHandlers } from './ipc/xml.ipc'
import { registerUpdateHandlers } from './ipc/update.ipc'
import { logError } from './services/log.service'
import { createUsageService } from './services/usage.service'
import { checkForUpdates, registerUpdateService } from './services/update.service'

let mainWindow: BrowserWindow | null = null

// Dev-only: load .env so keys like GEMINI_API_KEY are available for testing without first
// pasting them into Settings. Packaged builds read keys from the config store only.
if (is.dev && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile()
  } catch {
    // no .env present - fine
  }
}

function getWindow(): BrowserWindow | null {
  return mainWindow
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    autoHideMenuBar: true,
    icon: process.platform === 'win32' ? iconWin : icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webviewTag: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  setupWindowEvents(mainWindow)

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.icosa.bg3-mod-translator')
  const repos = createRepositoryRegistry(getDb())

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const usageService = createUsageService(repos)

  registerWindowHandlers(getWindow)
  registerTranslationHandlers(getWindow, repos, usageService)
  registerSessionHandlers()
  registerCloudHandlers()
  registerDictionaryHandlers(repos)
  registerDialogueHandlers(getWindow)
  registerLanguageHandlers(repos)
  registerLogHandlers()
  registerModHandlers(repos)
  registerMergeHandlers(repos)
  registerMetricsHandlers(repos, usageService)
  registerConfigHandlers()
  registerPromptSlotHandlers(repos)
  registerFsHandlers()
  registerXmlHandlers(repos)
  registerWorkspaceHandlers()
  registerUpdateService(getWindow)
  registerUpdateHandlers(getWindow)

  createWindow()

  if (!is.dev) {
    setTimeout(() => void checkForUpdates(), 8000)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

process.on('uncaughtException', (err) => {
  logError('main.uncaughtException', err)
})

process.on('unhandledRejection', (reason) => {
  logError('main.unhandledRejection', reason)
})

app.on('window-all-closed', () => {
  closeDb()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
