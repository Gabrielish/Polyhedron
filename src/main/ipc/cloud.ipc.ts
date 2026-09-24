import { ipcMain } from 'electron'
import { downloadWorkspaceFromDrive, getPwaSyncModifiedTime, uploadWorkspaceToDrive, type CloudTermGlossaryEntry } from '../services/cloud-drive.service'

export function registerCloudHandlers(): void {
  ipcMain.handle('cloud:upload', (_event, params: { sessionKey?: string; termGlossary?: { key: string; entries: CloudTermGlossaryEntry[] } } = {}) => uploadWorkspaceToDrive(params.sessionKey, params.termGlossary))
  ipcMain.handle('cloud:download', (_event, params: { sessionKey?: string; termGlossaryKey?: string } = {}) => downloadWorkspaceFromDrive(params.sessionKey, params.termGlossaryKey))
  ipcMain.handle('cloud:syncStamp', () => getPwaSyncModifiedTime())
}
