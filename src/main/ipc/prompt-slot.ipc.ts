import { ipcMain } from 'electron'
import type { RepositoryRegistry } from '../database/repositories/registry'
import { logError } from '../services/log.service'

export function registerPromptSlotHandlers(repos: RepositoryRegistry): void {
  ipcMain.handle('promptSlot:list', () => repos.promptSlot.list())

  ipcMain.handle('promptSlot:create', (_event, params: { name: string; prompt: string }) => {
    try {
      return repos.promptSlot.create(params)
    } catch (err) {
      logError('promptSlot.create', err, { name: params.name })
      throw err
    }
  })

  ipcMain.handle(
    'promptSlot:update',
    (_event, params: { id: number; name?: string; prompt?: string }) => {
      try {
        return repos.promptSlot.update(params)
      } catch (err) {
        logError('promptSlot.update', err, { id: params.id })
        throw err
      }
    }
  )

  ipcMain.handle('promptSlot:delete', (_event, params: { id: number }) => {
    try {
      repos.promptSlot.delete(params.id)
      return { success: true }
    } catch (err) {
      logError('promptSlot.delete', err, { id: params.id })
      throw err
    }
  })
}
