import { app, shell } from 'electron'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { SuggestionMap, SuggestionSource } from '../../shared/translation-suggestions'
import { decodeEntities } from './xml-entities.service'
import { parseLocalizationXml } from './xml-parser.service'

type StoredSource = Omit<SuggestionSource, 'available'>
const BUILTINS = ['traducere1.xml', 'traducere2.xml'] as const
let cache: { signature: string; suggestions: SuggestionMap } | null = null
export function suggestionSourcesDirectory(): string {
  return path.join(app.getPath('userData'), 'translation-suggestion-sources')
}
function manifestPath(): string { return path.join(suggestionSourcesDirectory(), 'sources.json') }
function readSources(): StoredSource[] {
  if (!fs.existsSync(manifestPath())) {
    const initial = BUILTINS.map((name, index) => ({ id: `builtin-${index + 1}`, name, builtin: name, enabled: true }))
    saveSources(initial)
    return initial
  }
  const sources: unknown = JSON.parse(fs.readFileSync(manifestPath(), 'utf8'))
  if (!Array.isArray(sources) || sources.some(source => !source || typeof source.id !== 'string' ||
    !/^[a-zA-Z0-9-]+$/.test(source.id) || typeof source.name !== 'string' ||
    typeof source.enabled !== 'boolean' || (source.builtin && !BUILTINS.includes(source.builtin))) ||
    new Set(sources.map(source => source.id)).size !== sources.length) {
    throw new Error('Invalid translation suggestion sources configuration.')
  }
  return sources as StoredSource[]
}
function saveSources(sources: StoredSource[]): void {
  fs.mkdirSync(suggestionSourcesDirectory(), { recursive: true })
  const temporary = `${manifestPath()}.tmp`
  fs.writeFileSync(temporary, JSON.stringify(sources, null, 2))
  fs.renameSync(temporary, manifestPath())
  cache = null
}
function sourcePath(source: StoredSource): string | null {
  if (!source.builtin) return path.join(suggestionSourcesDirectory(), `${source.id}.xml`)
  return [app.getAppPath(), process.cwd()].map(root => path.join(root, 'reference', 'imported-translations', source.builtin!))
    .find(file => fs.existsSync(file)) ?? null
}
export function listSuggestionSources(): SuggestionSource[] {
  return readSources().map(source => {
    const file = sourcePath(source)
    return { ...source, available: Boolean(file && fs.existsSync(file)) }
  })
}
export function addSuggestionSources(files: string[]): void {
  const sources = readSources()
  for (const file of files) {
    if (path.extname(file).toLowerCase() !== '.xml' || !parseLocalizationXml(file).length) {
      throw new Error(`${path.basename(file)} does not contain localization entries.`)
    }
  }
  const added: StoredSource[] = []
  try {
    for (const file of files) {
      const source = { id: crypto.randomUUID(), name: path.basename(file), enabled: true }
      fs.copyFileSync(file, path.join(suggestionSourcesDirectory(), `${source.id}.xml`))
      added.push(source)
    }
    saveSources([...sources, ...added])
  } catch (error) {
    for (const source of added) fs.rmSync(path.join(suggestionSourcesDirectory(), `${source.id}.xml`), { force: true })
    throw error
  }
}
export function setSuggestionSourceEnabled(id: string, enabled: boolean): void {
  if (typeof enabled !== 'boolean') throw new Error('Invalid enabled state.')
  const sources = readSources()
  const source = sources.find(item => item.id === id)
  if (!source) throw new Error('Suggestion source not found.')
  source.enabled = enabled
  saveSources(sources)
}
export async function removeSuggestionSource(id: string): Promise<void> {
  const sources = readSources()
  const source = sources.find(item => item.id === id)
  if (!source) throw new Error('Suggestion source not found.')
  saveSources(sources.filter(item => item.id !== id))
  // Removed built-ins stay excluded on restart; originals are not modified.
  if (!source.builtin) {
    const file = sourcePath(source)!
    if (fs.existsSync(file)) {
      try { await shell.trashItem(file) } catch (error) { saveSources(sources); throw error }
    }
  }
}
export function loadSuggestions(): SuggestionMap {
  const sources = listSuggestionSources().filter(source => source.enabled && source.available)
  const signature = JSON.stringify(sources.map(source => {
    const stat = fs.statSync(sourcePath(source)!)
    return [source.id, source.name, stat.mtimeMs, stat.size]
  }))
  if (cache?.signature === signature) return cache.suggestions
  const suggestions: SuggestionMap = Object.create(null)
  for (const source of sources) {
    const entries = new Map<string, string>()
    for (const entry of parseLocalizationXml(sourcePath(source)!)) {
      const text = decodeEntities(entry.text).trim()
      if (text) entries.set(entry.contentuid, text)
    }
    for (const [uid, text] of entries) {
      const pair = suggestions[uid] ??= { one: '', two: '', items: [] }
      pair.items.push({ sourceId: source.id, sourceName: source.name, text })
      pair.one = pair.items[0]?.text ?? ''
      pair.two = pair.items[1]?.text ?? ''
    }
  }
  cache = { signature, suggestions }
  return suggestions
}
