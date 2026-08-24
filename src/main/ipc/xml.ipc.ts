import { ipcMain } from 'electron'
import type { RepositoryRegistry } from '../database/repositories/registry'
import { encodeEntities } from '../services/xml-entities.service'
import { loadXmlViaWorker, type XmlEntry } from '../services/xml-load.service'
import { writeLocalizationXml } from '../services/xml-parser.service'

interface LoadPayload {
  inputPath: string
  sourceLang: string
  targetLang: string
  modName?: string
}

interface ExportPayload {
  outputPath: string
  entries: XmlEntry[]
}

function exportXml(payload: ExportPayload): void {
  const { outputPath, entries } = payload
  const localizationEntries = entries.map((entry) => ({
    contentuid: entry.uid,
    version: entry.version,
    text: encodeEntities(entry.target || entry.source)
  }))
  writeLocalizationXml(localizationEntries, outputPath)
}

export function registerXmlHandlers(repos: RepositoryRegistry): void {
  ipcMain.handle('xml:load', async (event, payload: LoadPayload) => {
    const result = await loadXmlViaWorker({
      ...payload,
      repos,
      onProgress: (p) => event.sender.send('xml:load:progress', p)
    })
    return result.entries
  })

  ipcMain.handle('xml:export', (_event, payload: ExportPayload) => exportXml(payload))
}
