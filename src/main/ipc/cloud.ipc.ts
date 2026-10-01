import { ipcMain } from 'electron'
import { connectCloudAccount, disconnectCloudAccount, downloadWorkspaceFromDrive, getCloudAccount, getCloudWorkspaceStatus, getPwaSyncModifiedTime, uploadWorkspaceToDrive, type CloudTermGlossaryEntry } from '../services/cloud-drive.service'

export function registerCloudHandlers(): void {
  ipcMain.handle('cloud:upload', (_event, params: { sessionKey?: string; termGlossary?: { key: string; entries: CloudTermGlossaryEntry[] } } = {}) => uploadWorkspaceToDrive(params.sessionKey, params.termGlossary))
  ipcMain.handle('cloud:download', (_event, params: { sessionKey?: string; termGlossaryKey?: string } = {}) => downloadWorkspaceFromDrive(params.sessionKey, params.termGlossaryKey))
  ipcMain.handle('cloud:syncStamp', () => getPwaSyncModifiedTime())
  ipcMain.handle('cloud:status', () => getCloudWorkspaceStatus())
  ipcMain.handle('cloud:account', () => getCloudAccount())
  ipcMain.handle('cloud:connect', () => connectCloudAccount())
  ipcMain.handle('cloud:disconnect', () => disconnectCloudAccount())
}
