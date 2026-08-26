import { ipcMain } from 'electron'
import { downloadWorkspaceFromDrive, getPwaSyncModifiedTime, uploadWorkspaceToDrive } from '../services/cloud-drive.service'

export function registerCloudHandlers(): void {
  ipcMain.handle('cloud:upload', (_event, params: { sessionKey?: string } = {}) => uploadWorkspaceToDrive(params.sessionKey))
  ipcMain.handle('cloud:download', (_event, params: { sessionKey?: string } = {}) => downloadWorkspaceFromDrive(params.sessionKey))
  ipcMain.handle('cloud:syncStamp', () => getPwaSyncModifiedTime())
}
