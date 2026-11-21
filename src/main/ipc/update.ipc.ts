import type { BrowserWindow } from 'electron'
import { ipcMain } from 'electron'
import { getCloudAccount } from '../services/cloud-drive.service'
import {
  checkForUpdates,
  downloadUpdate,
  forceDownloadUpdate,
  installForcedUpdate,
  installUpdate
} from '../services/update.service'

export function registerUpdateHandlers(_getWindow: () => BrowserWindow | null): void {
  const requireAdministrator = async () => {
    const account = await getCloudAccount()
    if (account.emailAddress?.trim().toLowerCase() !== 'gabrielbundea1@gmail.com') {
      throw new Error('Administrator account required for force updates.')
    }
  }

  ipcMain.handle('update:check', () => checkForUpdates())
  ipcMain.handle('update:download', () => downloadUpdate())
  ipcMain.handle('update:force-download', async () => {
    await requireAdministrator()
    return forceDownloadUpdate()
  })
  ipcMain.handle('update:force-install', async () => {
    await requireAdministrator()
    return installForcedUpdate()
  })
  ipcMain.handle('update:install', () => installUpdate())
}
