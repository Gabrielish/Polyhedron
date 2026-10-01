import type { BrowserWindow } from 'electron'
import { ipcMain } from 'electron'
import { checkForUpdates, downloadUpdate, installUpdate } from '../services/update.service'

export function registerUpdateHandlers(_getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('update:check', () => checkForUpdates())
  ipcMain.handle('update:download', () => downloadUpdate())
  ipcMain.handle('update:install', () => installUpdate())
}
