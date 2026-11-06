import type { BrowserWindow } from 'electron'
import { ipcMain } from 'electron'
import {
  checkForUpdates,
  downloadUpdate,
  forceDownloadUpdate,
  installForcedUpdate,
  installUpdate
} from '../services/update.service'

export function registerUpdateHandlers(_getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('update:check', () => checkForUpdates())
  ipcMain.handle('update:download', () => downloadUpdate())
  ipcMain.handle('update:force-download', () => forceDownloadUpdate())
  ipcMain.handle('update:force-install', () => installForcedUpdate())
  ipcMain.handle('update:install', () => installUpdate())
}
