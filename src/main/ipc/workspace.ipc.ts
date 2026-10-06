import { ipcMain } from 'electron'
import { exportWorkspace, importWorkspace } from '../services/workspace.service'

export function registerWorkspaceHandlers(): void {
  ipcMain.handle('workspace:export', (_event, params: { outputPath: string }) => exportWorkspace(params.outputPath))
  ipcMain.handle('workspace:import', async (event, params: { inputPath: string }) => {
    const result = await importWorkspace(params.inputPath)
    event.sender.send('translation-suggestions:changed')
    return result
  })
}
