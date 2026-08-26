import { useEffect, useMemo, useState } from 'react'
import type { SyncEntry, WorkspaceSyncDocument } from '../sync/workspaceSync'
import { Search } from 'lucide-react'

type Category = 'Weapon' | 'Armour' | 'Object' | 'Spell' | 'Passive' | 'Status' | 'Interrupt'
type CatalogEntry = { name: string; description: string; category: Category }
const CATEGORIES: Array<{ label: string; value: Category }> = [
  { label: 'Weapons', value: 'Weapon' }, { label: 'Armour', value: 'Armour' }, { label: 'Objects', value: 'Object' },
  { label: 'Spells', value: 'Spell' }, { label: 'Passives', value: 'Passive' }, { label: 'Statuses', value: 'Status' }, { label: 'Interrupts', value: 'Interrupt' }
]
const normalize = (value: string) => decodeHtml(value).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().toLocaleLowerCase()
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

export function GameDataTab({ document, onDocumentChange }: { document: WorkspaceSyncDocument; onDocumentChange: (document: WorkspaceSyncDocument) => void }): React.JSX.Element {
  const [catalog, setCatalog] = useState<CatalogEntry[]>([])
  const [category, setCategory] = useState<Category>('Weapon')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<CatalogEntry | null>(null)
  useEffect(() => { void fetch('./data/game-reference.json').then((response) => response.json()).then((value: unknown) => setCatalog(Array.isArray(value) ? value as CatalogEntry[] : [])).catch(() => setCatalog([])) }, [])
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase()
    return catalog.filter((entry) => entry.category === category && (!q || `${entry.name} ${entry.description}`.toLocaleLowerCase().includes(q)))
  }, [catalog, category, query])
  // Keep the editor in sync with the visible list. When a category or search
  // changes, fall back to the first matching entry instead of leaving stale
  // content (or an empty editor) from the previous category.
  const current = selected && selected.category === category && filtered.some((entry) => entry.name === selected.name && entry.description === selected.description)
    ? selected
    : filtered[0] ?? null
  const session = document.sessions[0]
  const linked = useMemo(() => {
    if (!current || !session) return { title: [] as SyncEntry[], description: [] as SyncEntry[] }
    const title = normalize(current.name); const description = normalize(current.description)
    return { title: session.entries.filter((entry) => normalize(entry.source) === title), description: session.entries.filter((entry) => normalize(entry.source) === description) }
  }, [current, session])
  const updateEntries = (entries: SyncEntry[], value: string) => {
    const ids = new Set(entries.map((entry) => entry.uid))
    onDocumentChange({ ...document, generatedAt: new Date().toISOString(), sessions: document.sessions.map((item) => ({ ...item, entries: item.entries.map((entry) => ids.has(entry.uid) ? { ...entry, target: value, matchType: 'manual' as const } : entry) })) })
  }
  return <section className="game-data-panel">
    <div className="game-data-controls"><div className="game-data-search-row"><label className="search-field"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search..." /><Search aria-hidden="true" size={17} /></label><a className="game-data-open" href={current ? wikiUrl(current) : 'https://bg3.wiki/wiki/Weapons'} target="_blank" rel="noreferrer" title="Open selected entry on Baldur's Gate wiki" aria-label="Open selected entry on Baldur's Gate wiki">↗</a></div><div className="game-data-categories">{CATEGORIES.map((item) => <button key={item.value} type="button" className={category === item.value ? 'game-data-category active' : 'game-data-category'} onClick={() => { setCategory(item.value); setSelected(null) }}><CategoryIcon category={item.value} /> <span>{item.label}</span></button>)}</div></div>
    <div className="game-data-layout"><aside className="game-data-list"><p className="tree-label">{CATEGORIES.find((item) => item.value === category)?.label} · {filtered.length.toLocaleString()} entries</p>{filtered.length ? filtered.map((entry) => <button type="button" key={`${entry.category}-${entry.name}`} className={current?.name === entry.name ? 'game-data-item selected' : 'game-data-item'} onClick={() => setSelected(entry)}><span>{entry.name}</span></button>) : <p className="dialogue-empty">{catalog.length ? 'No matching entries.' : 'Loading game data…'}</p>}</aside><main className="game-data-editor">{current && session ? <><div className="game-data-title"><span className="game-data-entry-icon"><CategoryIcon category={current.category} /></span><h3>{current.name}</h3></div><GameDataField label="Title · EN" source={current.name} value={linked.title[0]?.target ?? ''} onChange={(value) => updateEntries(linked.title, value)} /><GameDataField label="Description · EN" source={current.description} value={linked.description[0]?.target ?? ''} onChange={(value) => updateEntries(linked.description, value)} /></> : <div className="dialogue-empty">Select an entry from the list.</div>}</main></div>
  </section>
}

function GameDataField({ label, source, value, onChange }: { label: string; source: string; value: string; onChange: (value: string) => void }): React.JSX.Element {
  return <section className="game-data-field"><label>{label}</label><div className="game-data-source">{decodeHtml(source)}</div><textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder="Translation..." rows={Math.max(2, Math.min(8, value.split('\n').length + 1))} /></section>
}
