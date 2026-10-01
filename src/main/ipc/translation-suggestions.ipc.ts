import { app, ipcMain } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { decodeEntities } from '../services/xml-entities.service'
import { parseLocalizationXml } from '../services/xml-parser.service'

export interface TranslationSuggestionPair {
  one: string
  two: string
}

type SuggestionMap = Record<string, TranslationSuggestionPair>

let cachedSuggestions: SuggestionMap | null = null

function findImportedTranslationFile(name: string): string | null {
  const candidates = [
    path.join(app.getAppPath(), 'reference', 'imported-translations', name),
    path.join(process.cwd(), 'reference', 'imported-translations', name)
  ]
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null
}

function readSuggestionFile(filePath: string): Map<string, string> {
  const result = new Map<string, string>()
  for (const entry of parseLocalizationXml(filePath)) {
    const text = decodeEntities(entry.text).trim()
    if (text) result.set(entry.contentuid, text)
  }
  return result
}

function loadSuggestions(): SuggestionMap {
  if (cachedSuggestions) return cachedSuggestions

  const firstPath = findImportedTranslationFile('traducere1.xml')
  const secondPath = findImportedTranslationFile('traducere2.xml')
  if (!firstPath && !secondPath) return {}

  const first = firstPath ? readSuggestionFile(firstPath) : new Map<string, string>()
  const second = secondPath ? readSuggestionFile(secondPath) : new Map<string, string>()
  const allUids = new Set([...first.keys(), ...second.keys()])
  const suggestions: SuggestionMap = {}

  for (const uid of allUids) {
    const one = first.get(uid) ?? ''
    const two = second.get(uid) ?? ''
    if (one || two) suggestions[uid] = { one, two }
  }

  cachedSuggestions = suggestions
  return suggestions
}

export function registerTranslationSuggestionHandlers(): void {
  ipcMain.handle('translation-suggestions:load', () => loadSuggestions())
}
