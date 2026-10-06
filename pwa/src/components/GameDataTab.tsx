import { useEffect, useMemo, useState, useDeferredValue } from 'react'
import type { SyncEntry, WorkspaceSyncDocument } from '../sync/workspaceSync'
import { ExternalLink } from 'lucide-react'
import { CompanionSearch } from './CompanionSearch'
import { defaultSearch, indexWorkspace, loadCatalog, matcher, sourceKey, updateProject } from '../utils/workspace'

type Category = 'Weapon' | 'Armour' | 'Object' | 'Spell' | 'Passive' | 'Status' | 'Interrupt'
type CatalogEntry = { name: string; description: string; category: Category }
const CATEGORIES: Array<{ label: string; value: Category }> = [
  { label: 'Weapons', value: 'Weapon' }, { label: 'Armour', value: 'Armour' }, { label: 'Objects', value: 'Object' },
  { label: 'Spells', value: 'Spell' }, { label: 'Passives', value: 'Passive' }, { label: 'Statuses', value: 'Status' }, { label: 'Interrupts', value: 'Interrupt' }
]
const decodeHtml = (value: string) => { const textarea = window.document.createElement('textarea'); textarea.innerHTML = value; return textarea.value }

function wikiUrl(entry: CatalogEntry): string { return `https://bg3.wiki/wiki/${encodeURIComponent(entry.name.trim().replace(/\s+/g, '_'))}` }
function CategoryIcon({ category }: { category: Category }): React.JSX.Element {
  const common = { viewBox: '0 0 18 18', 'aria-hidden': true }
  if (category === 'Weapon') return <svg {...common}><path d="m3 15 10-10M8 3l7 7M5 5l2-2M12 13l3 2" /></svg>
  if (category === 'Armour') return <svg {...common}><path d="M9 2 15 4v4c0 4-2.5 6.5-6 8-3.5-1.5-6-4-6-8V4l6-2Z" /><path d="M9 5v7M6.5 8h5" /></svg>
  if (category === 'Object') return <svg {...common}><path d="M7 2h4M8 2v3l-3 8a2 2 0 0 0 2 3h4a2 2 0 0 0 2-3l-3-8V2M6 11h6" /></svg>
  if (category === 'Spell') return <svg {...common}><path d="m9 1 1.2 5.8L16 8l-5.8 1.2L9 15l-1.2-5.8L2 8l5.8-1.2L9 1ZM15 13v4M13 15h4" /></svg>
  if (category === 'Passive') return <svg {...common}><path d="M4 3.5A2.5 2.5 0 0 1 6.5 1H15v14H6.5A2.5 2.5 0 0 0 4 17V3.5ZM4 3.5V17M7 5h5M7 8h5" /></svg>
  if (category === 'Status') return <svg {...common}><path d="M2 9h3l1.5-3 2.5 6 1.5-3H16" /><path d="M9 2a7 7 0 1 0 6.1 3.5" /></svg>
  return <svg {...common}><path d="M7 3 3 7l4 4M3 7h8a4 4 0 0 1 4 4v4M11 13l4-4-4-4" /></svg>
}

export function GameDataTab({ document, onDocumentChange, sessionId }: { document: WorkspaceSyncDocument; onDocumentChange: (document: WorkspaceSyncDocument) => void; sessionId?: string }): React.JSX.Element {
  const [catalog, setCatalog] = useState<CatalogEntry[]>([])
  const [category, setCategory] = useState<Category>('Weapon')
  const [search, setSearch] = useState(defaultSearch)
  const deferred = useDeferredValue(search)
  const [selected, setSelected] = useState<CatalogEntry | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('all')
  const session = document.sessions.find(item => item.id === sessionId) ?? document.sessions[0]
  const workspace = useMemo(() => indexWorkspace(session), [session])
  useEffect(() => { let active = true; setLoading(true); setError(''); void loadCatalog().then(value => { if (active) setCatalog(value.filter(entry => CATEGORIES.some(category => category.value === entry.category)) as CatalogEntry[]) }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Game reference failed to load.') }).finally(() => { if (active) setLoading(false) }); return () => { active = false } }, [retry])
  const linkedFor = (entry: CatalogEntry) => {
    const rows = (text: string) => (workspace.bySource.get(sourceKey(text)) ?? []).flatMap(uid => { const row = workspace.byUid.get(uid); return row ? [row] : [] })
    return { title: rows(entry.name), description: rows(entry.description) }
  }
  const filtered = useMemo(() => {
    const test = matcher(deferred)
    return catalog.filter(entry => {
      if (entry.category !== category) return false
      const linked = linkedFor(entry)
      const rows = [...linked.title, ...linked.description]
      const complete = linked.title.length > 0 && linked.title.every(row => row.target.trim()) && (!entry.description.trim() || linked.description.length > 0 && linked.description.every(row => row.target.trim()))
      if (status === 'linked' && !rows.length || status === 'translated' && !complete || status === 'untranslated' && (complete || !rows.length) || status === 'unlinked' && rows.length) return false
      const fields = deferred.scope === 'source' ? [entry.name, entry.description] : deferred.scope === 'target' ? rows.map(row => row.target) : [entry.name, entry.description, ...rows.map(row => row.target)]
      return fields.some(test)
    })
  }, [catalog, category, deferred, workspace, status])
  useEffect(() => { setPage(1); setSelected(null) }, [category, search, status, session?.id])
  const current = selected && filtered.includes(selected) ? selected : filtered[0] ?? null
  const linked = useMemo(() => current ? linkedFor(current) : { title: [] as SyncEntry[], description: [] as SyncEntry[] }, [current, workspace])
  const pages = Math.max(1, Math.ceil(filtered.length / 100))
  const currentPage = Math.min(page, pages)
  function updateEntries(rows: SyncEntry[], value: string): void { if (session && rows.length) onDocumentChange(updateProject(document, session.id, new Map(rows.map(row => [row.uid, { target: value, matchType: 'manual' as const }])))) }
  return <section className="game-data-panel">
    <div className="game-data-controls"><CompanionSearch value={search} onChange={setSearch} label="Search game data" placeholder="Search names, descriptions, translations…" /><div className="game-data-categories">{CATEGORIES.map(item => <button key={item.value} className={category === item.value ? 'game-data-category active' : 'game-data-category'} onClick={() => setCategory(item.value)}><CategoryIcon category={item.value} /><span>{item.label}</span></button>)}</div><select className="companion-status-filter" aria-label="Game data status" value={status} onChange={event => setStatus(event.target.value)}><option value="all">All entries</option><option value="linked">Linked to project</option><option value="translated">Translated</option><option value="untranslated">Incomplete</option><option value="unlinked">Not linked</option></select></div>
    {error && <p className="companion-inline-status" role="alert">{error}<button className="secondary-button" onClick={() => setRetry(value => value + 1)}>Retry</button></p>}
    <div className="game-data-layout"><aside className="game-data-list"><p className="tree-label">{CATEGORIES.find(item => item.value === category)?.label} · {filtered.length.toLocaleString()} entries</p>{filtered.slice((currentPage - 1) * 100, currentPage * 100).map((entry, index) => <button key={category + ':' + index + ':' + entry.name} className={current === entry ? 'game-data-item selected' : 'game-data-item'} onClick={() => setSelected(entry)}><span>{entry.name}</span></button>)}{!filtered.length && <p className="dialogue-empty">{loading ? 'Loading game reference…' : 'No matching entries.'}</p>}{pages > 1 && <div className="pagination-bar"><button className="secondary-button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Previous</button><span>{currentPage} / {pages}</span><button className="secondary-button" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>Next</button></div>}</aside><main className="game-data-editor" key={session?.id + ':' + category + ':' + current?.name + ':' + current?.description}>{current ? <><div className="companion-section-heading"><div className="game-data-title"><span className="game-data-entry-icon"><CategoryIcon category={current.category} /></span><h3>{current.name}</h3></div><a className="secondary-button" href={wikiUrl(current)} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} />Wiki</a></div><GameDataField label="Title · EN" source={current.name} value={linked.title[0]?.target ?? ''} disabled={!linked.title.length} targetLang={session?.targetLang} onChange={value => updateEntries(linked.title, value)} /><GameDataField label="Description · EN" source={current.description} value={linked.description[0]?.target ?? ''} disabled={!linked.description.length} targetLang={session?.targetLang} onChange={value => updateEntries(linked.description, value)} /></> : <div className="dialogue-empty">Select an entry from the list.</div>}</main></div>
  </section>
}
function GameDataField({ label, source, value, disabled, targetLang, onChange }: { label: string; source: string; value: string; disabled: boolean; targetLang?: string; onChange: (value: string) => void }): React.JSX.Element {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  function commit(): void { if (!disabled && draft !== value) onChange(draft) }
  return <section className="game-data-field"><label>{label}</label><div className="game-data-source">{decodeHtml(source)}</div><label>Translation{targetLang ? ' · ' + targetLang.toUpperCase() : ''}{disabled ? ' · Not linked to this project' : ''}</label><textarea aria-label={label.startsWith('Title') ? 'Game title translation' : 'Game description translation'} disabled={disabled} value={draft} onChange={event => setDraft(event.target.value)} onBlur={commit} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); commit() } }} placeholder={disabled ? 'No matching source in this project.' : 'Translation…'} rows={Math.max(2, draft.split('\n').length + 1)} /></section>
}
