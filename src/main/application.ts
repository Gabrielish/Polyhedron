import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { app, BrowserWindow, ipcMain, nativeTheme, shell } from 'electron'
import { join } from 'path'
import { eq } from 'drizzle-orm'
import iconWin from '../../resources/installer/icon.ico?asset'
import icon from '../../resources/installer/icon.png?asset'
import { closeDb, getDb } from './database/connection'
import { config } from './database/schema'
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
import { registerTranslationSuggestionHandlers } from './ipc/translation-suggestions.ipc'
import { flushSessionSaves, registerSessionHandlers } from './ipc/session.ipc'
import { flushDictionarySaves } from './services/dictionary-save.service'
import { registerCloudHandlers } from './ipc/cloud.ipc'
import { registerWindowHandlers, setupWindowEvents } from './ipc/window.ipc'
import { registerWorkspaceHandlers } from './ipc/workspace.ipc'
import { registerXmlHandlers } from './ipc/xml.ipc'
import { registerUpdateHandlers } from './ipc/update.ipc'
import { logError } from './services/log.service'
import { createUsageService } from './services/usage.service'
import { checkForUpdates, registerUpdateService } from './services/update.service'
import { migrateLegacyUserData } from './services/user-data-migration.service'
import { applyWindowsAppIcon, savedWindowsAppIcon, updateAppIcon } from './services/app-icon.service'
import { ejectMacInstallationImages } from './services/mac-install-image.service'
import { installIpcSecurity, isAllowedExternalUrl, isAllowedReferenceUrl } from './utils/ipc-security'

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

async function refreshAppIcon(forceRefresh = false): Promise<void> {
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isLoadingMainFrame()) {
    if (forceRefresh) throw new Error('The application is still loading. Please try again.')
    return
  }
  const db = getDb()
  const accent = db.select().from(config).where(eq(config.key, 'theme_accent')).get()?.value
  const style = db.select().from(config).where(eq(config.key, 'theme_app_icon_style')).get()?.value
  const foreground = db.select().from(config).where(eq(config.key, 'theme_accent_foreground')).get()?.value
  await updateAppIcon(mainWindow, accent ?? '#8C52FF', style ?? 'accent-background', foreground === 'black' ? 'black' : 'white', forceRefresh)
}

function createWindow(): void {
  const savedWindowsIcon = savedWindowsAppIcon()
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    show: false,
    // Native fallback remains dark even before the renderer can paint.
    backgroundColor: '#101010',
    // Keep the custom frameless title bar on Windows, but use native traffic-light
    // controls on macOS so the Windows-style buttons are not shown there.
    frame: process.platform !== 'darwin',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    autoHideMenuBar: true,
    icon: savedWindowsIcon ?? (process.platform === 'win32' ? iconWin : icon),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true
    }
  })

  if (savedWindowsIcon) applyWindowsAppIcon(mainWindow, savedWindowsIcon)

  // did-finish-load can precede isLoadingMainFrame() becoming false, which
  // made refreshAppIcon skip restoring the user's appearance on startup.
  mainWindow.webContents.on('did-stop-loading', refreshAppIcon)

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })
  mainWindow.once('ready-to-show', () => {
    // Let startup finish before inspecting the installation image. The service
    // only runs for the packaged macOS copy installed in Applications.
    setTimeout(() => void ejectMacInstallationImages(), 2000)
  })

  setupWindowEvents(mainWindow)

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (isAllowedExternalUrl(details.url)) void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', event => event.preventDefault())
  mainWindow.webContents.on('will-attach-webview', (event, preferences, params) => {
    if (!isAllowedReferenceUrl(params.src)) { event.preventDefault(); return }
    delete preferences.preload
    preferences.nodeIntegration = false
    preferences.contextIsolation = true
    preferences.sandbox = true
  })
  mainWindow.webContents.on('did-attach-webview', (_event, contents) => {
    contents.on('will-navigate', (event, url) => {
      if (!isAllowedReferenceUrl(url)) event.preventDefault()
    })
    contents.setWindowOpenHandler(({ url }) => {
      if (isAllowedExternalUrl(url)) void shell.openExternal(url)
      return { action: 'deny' }
    })
  })

  // macOS reserves Command+F for Chromium's native find bar. Translate has its
  // own Find & Replace panel, so intercept the accelerator and notify the
  // renderer instead of opening the browser search UI.
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || input.key.toLowerCase() !== 'f') return
    if (!input.meta || input.shift || input.alt || input.control) return
    event.preventDefault()
    void mainWindow?.webContents.executeJavaScript(
      "window.dispatchEvent(new CustomEvent('polyhedron:toggle-find-replace'))"
    )
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  app.setName('Polyhedron')
  migrateLegacyUserData()
  installIpcSecurity(getWindow)
  ipcMain.handle('app:version', () => app.getVersion())
  electronApp.setAppUserModelId('com.polyhedron.bg3-mod-translator')
  const repos = createRepositoryRegistry(getDb())

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const usageService = createUsageService(repos)

  registerWindowHandlers(getWindow, () => refreshAppIcon(true))
  registerTranslationHandlers(getWindow, repos, usageService)
  registerTranslationSuggestionHandlers()
  registerSessionHandlers()
  registerCloudHandlers()
  registerDictionaryHandlers(repos)
  registerDialogueHandlers(getWindow, repos)
  registerLanguageHandlers(repos)
  registerLogHandlers()
  registerModHandlers(repos)
  registerMergeHandlers(repos)
  registerMetricsHandlers(repos, usageService)
  registerConfigHandlers(refreshAppIcon)
  nativeTheme.on('updated', refreshAppIcon)
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

// Flush and release the SQLite handle for every quit path (including Cmd+Q on
// macOS, where `window-all-closed` is not emitted until much later).
app.on('before-quit', () => {
  closeDb()
})

let savesFlushed = false
app.on('will-quit', (event) => {
  if (savesFlushed) return
  event.preventDefault()
  void Promise.all([flushSessionSaves(), flushDictionarySaves()]).finally(() => {
    savesFlushed = true
    app.quit()
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
