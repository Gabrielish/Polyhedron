import { ipcMain } from 'electron'
import { downloadWorkspaceFromDrive, uploadWorkspaceToDrive } from '../services/cloud-drive.service'

export function registerCloudHandlers(): void {
  ipcMain.handle('cloud:upload', () => uploadWorkspaceToDrive())
  ipcMain.handle('cloud:download', () => downloadWorkspaceFromDrive())
}
