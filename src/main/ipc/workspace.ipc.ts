import { ipcMain } from 'electron'
import { exportWorkspace, importWorkspace } from '../services/workspace.service'

export function registerWorkspaceHandlers(): void {
  ipcMain.handle('workspace:export', (_event, params: { outputPath: string }) => exportWorkspace(params.outputPath))
  ipcMain.handle('workspace:import', (_event, params: { inputPath: string }) => importWorkspace(params.inputPath))
}
