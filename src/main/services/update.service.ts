import { autoUpdater } from 'electron-updater'
import type { BrowserWindow } from 'electron'

export type UpdateState =
  | { status: 'checking' }
  | { status: 'available'; version: string }
  | { status: 'not-available'; version: string }
  | { status: 'downloading'; percent: number }
  | { status: 'downloaded'; version: string }
  | { status: 'error'; message: string }

let currentWindow: (() => BrowserWindow | null) | null = null

function emit(state: UpdateState): void {
  currentWindow?.()?.webContents.send('update:state', state)
}

export function registerUpdateService(getWindow: () => BrowserWindow | null): void {
  currentWindow = getWindow
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => emit({ status: 'checking' }))
  autoUpdater.on('update-available', (info) => emit({ status: 'available', version: info.version }))
  autoUpdater.on('update-not-available', (info) => emit({ status: 'not-available', version: info.version }))
  autoUpdater.on('download-progress', (progress) => emit({ status: 'downloading', percent: progress.percent }))
  autoUpdater.on('update-downloaded', (info) => emit({ status: 'downloaded', version: info.version }))
  autoUpdater.on('error', (error) => emit({ status: 'error', message: error.message }))
}

export async function checkForUpdates(): Promise<void> {
  if (!currentWindow) return
  try {
    await autoUpdater.checkForUpdates()
  } catch (error) {
    emit({ status: 'error', message: error instanceof Error ? error.message : String(error) })
  }
}

export async function downloadUpdate(): Promise<void> {
  try {
    await autoUpdater.downloadUpdate()
  } catch (error) {
    emit({ status: 'error', message: error instanceof Error ? error.message : String(error) })
  }
}

export function installUpdate(): void {
  autoUpdater.quitAndInstall()
}
