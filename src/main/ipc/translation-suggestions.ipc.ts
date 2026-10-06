import { dialog, ipcMain } from 'electron'
import { addSuggestionSources, listSuggestionSources, loadSuggestions, removeSuggestionSource, setSuggestionSourceEnabled } from '../services/translation-suggestions.service'

export function registerTranslationSuggestionHandlers(): void {
  ipcMain.handle('translation-suggestions:load', () => loadSuggestions())
  ipcMain.handle('translation-suggestions:list', () => listSuggestionSources())
  ipcMain.handle('translation-suggestions:add', async (event) => {
    const selected = await dialog.showOpenDialog({ title: 'Add translation suggestion files', properties: ['openFile', 'multiSelections'], filters: [{ name: 'Localization XML', extensions: ['xml'] }] })
    if (!selected.canceled && selected.filePaths.length) {
      addSuggestionSources(selected.filePaths)
      event.sender.send('translation-suggestions:changed')
    }
    return listSuggestionSources()
  })
  ipcMain.handle('translation-suggestions:set-enabled', (event, { id, enabled }) => {
    setSuggestionSourceEnabled(id, enabled)
    event.sender.send('translation-suggestions:changed')
    return listSuggestionSources()
  })
  ipcMain.handle('translation-suggestions:remove', async (event, { id }) => {
    await removeSuggestionSource(id)
    event.sender.send('translation-suggestions:changed')
    return listSuggestionSources()
  })
}
