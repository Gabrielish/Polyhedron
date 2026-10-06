import type { SyncEntry, SyncSession, WorkspaceSyncDocument } from '../sync/workspaceSync'
import { normalizeSearchText, stripSearchDiacritics } from '../../../src/renderer/src/utils/search'
export type SearchOptions = { query: string; scope: 'all' | 'source' | 'target'; matchCase: boolean; wholeWord: boolean; exact: boolean; startsWith: boolean }
export const defaultSearch: SearchOptions = { query: '', scope: 'all', matchCase: false, wholeWord: false, exact: false, startsWith: false }
export function plainText(value: string): string {
  return value.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;|&#x27;/gi, "'")
}
export const sourceKey = (text: string) => plainText(text).replace(/\s+/g, ' ').trim().toLocaleLowerCase()
export function matcher(options: SearchOptions): (text: string) => boolean {
  const fold = options.matchCase ? stripSearchDiacritics : normalizeSearchText
  const query = fold(options.query.trim())
  if (!query) return () => true
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const word = options.wholeWord ? new RegExp(`${options.startsWith ? '^' : '(?:^|[^\\p{L}\\p{N}_])'}${escaped}(?=$|[^\\p{L}\\p{N}_])`, 'u') : null
  return text => {
    const value = fold(text)
    return options.exact ? value === query : word ? word.test(value) : options.startsWith ? value.startsWith(query) : value.includes(query)
  }
}
export type SourceRow = { uid: string; source: string }
export type WorkspaceIndex = { byUid: Map<string, SyncEntry>; bySource: Map<string, string[]>; rows: SourceRow[] }
const indices = new Map<string, { entries: SyncEntry[]; index: WorkspaceIndex }>()
export function indexWorkspace(session: SyncSession | undefined): WorkspaceIndex {
  if (!session) return { byUid: new Map(), bySource: new Map(), rows: [] }
  const previous = indices.get(session.id)
  if (previous?.entries === session.entries) return previous.index
  const stable = previous && previous.entries.length === session.entries.length && session.entries.every((entry, i) => entry.uid === previous.entries[i].uid && entry.source === previous.entries[i].source)
  const byUid = new Map(session.entries.map(entry => [entry.uid, entry]))
  const bySource = stable ? previous.index.bySource : new Map<string, string[]>()
  const rows = stable ? previous.index.rows : session.entries.map(({ uid, source }) => ({ uid, source }))
  if (!stable) for (const entry of session.entries) {
    if (entry.sourceMissing || !entry.source.trim()) continue
    const key = sourceKey(entry.source)
    const group = bySource.get(key)
    if (group) group.push(entry.uid); else bySource.set(key, [entry.uid])
  }
  const index = { byUid, bySource, rows }
  // Keep only current-project snapshots, not every edit/version of a workspace.
  if (indices.size >= 8 && !indices.has(session.id)) indices.delete(indices.keys().next().value!)
  indices.set(session.id, { entries: session.entries, index })
  return index
}
export function updateProject(document: WorkspaceSyncDocument, sessionId: string, changes: Map<string, Partial<SyncEntry>>): WorkspaceSyncDocument {
  return { ...document, generatedAt: new Date().toISOString(), sessions: document.sessions.map(session => session.id !== sessionId ? session : { ...session, entries: session.entries.map(entry => changes.has(entry.uid) ? { ...entry, ...changes.get(entry.uid) } : entry) }) }
}
export type CatalogEntry = { name: string; description: string; category: string; id?: string; icon?: string; level?: string; flags?: string; useCosts?: string; actionType?: string; conditions?: string[] }
let catalogPromise: Promise<CatalogEntry[]> | null = null
export function loadCatalog(): Promise<CatalogEntry[]> {
  if (!catalogPromise) catalogPromise = fetch(`${import.meta.env.BASE_URL}data/game-reference.json`).then(response => {
    if (!response.ok) throw new Error('Game reference could not be loaded.')
    return response.json() as Promise<unknown>
  }).then(value => {
    if (!Array.isArray(value)) throw new Error('Invalid game reference catalog.')
    return value.filter((entry): entry is CatalogEntry => entry && typeof entry.name === 'string' && typeof entry.description === 'string' && typeof entry.category === 'string')
  }).catch(error => { catalogPromise = null; throw error })
  return catalogPromise
}
