import { useEffect, useMemo, useState } from 'react'
import type { SyncEntry, WorkspaceSyncDocument } from '../sync/workspaceSync'

type Category = 'Weapon' | 'Armour' | 'Object' | 'Spell' | 'Passive' | 'Status' | 'Interrupt'
type CatalogEntry = { name: string; description: string; category: Category }
const CATEGORIES: Array<{ label: string; value: Category }> = [
  { label: 'Weapons', value: 'Weapon' }, { label: 'Armour', value: 'Armour' }, { label: 'Objects', value: 'Object' },
  { label: 'Spells', value: 'Spell' }, { label: 'Passives', value: 'Passive' }, { label: 'Statuses', value: 'Status' }, { label: 'Interrupts', value: 'Interrupt' }
]
const normalize = (value: string) => decodeHtml(value).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().toLocaleLowerCase()
const decodeHtml = (value: string) => { const textarea = window.document.createElement('textarea'); textarea.innerHTML = value; return textarea.value }

function wikiUrl(entry: CatalogEntry): string { return `https://bg3.wiki/wiki/${encodeURIComponent(entry.name.trim().replace(/\s+/g, '_'))}` }
function categoryIcon(category: Category): string { return category === 'Weapon' ? '⚔' : category === 'Armour' ? '◈' : category === 'Spell' ? '✦' : category === 'Object' ? '⚗' : category === 'Passive' ? '◉' : category === 'Status' ? '✧' : '⌁' }

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
  const current = selected?.category === category ? selected : null
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
    <header className="game-data-header"><div><p className="eyebrow">Game Data</p><h2>Reference translations</h2><p className="toolbar-note">Search and translate names and descriptions.</p></div><a className="game-data-open" href={current ? wikiUrl(current) : 'https://bg3.wiki/wiki/Weapons'} target="_blank" rel="noreferrer" title="Open selected entry on Baldur's Gate wiki" aria-label="Open selected entry on Baldur's Gate wiki">↗</a></header>
    <div className="game-data-controls"><label className="search-field"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title or description..." /></label><div className="game-data-categories">{CATEGORIES.map((item) => <button key={item.value} type="button" className={category === item.value ? 'game-data-category active' : 'game-data-category'} onClick={() => { setCategory(item.value); setSelected(null) }}>{categoryIcon(item.value)} <span>{item.label}</span></button>)}</div></div>
    <div className="game-data-layout"><aside className="game-data-list"><p className="tree-label">{CATEGORIES.find((item) => item.value === category)?.label} · {filtered.length.toLocaleString()} entries</p>{filtered.length ? filtered.map((entry) => <button type="button" key={`${entry.category}-${entry.name}`} className={current?.name === entry.name ? 'game-data-item selected' : 'game-data-item'} onClick={() => setSelected(entry)}><span>{entry.name}</span></button>) : <p className="dialogue-empty">{catalog.length ? 'No matching entries.' : 'Loading game data…'}</p>}</aside><main className="game-data-editor">{current && session ? <><div className="game-data-title"><span className="game-data-entry-icon">{categoryIcon(current.category)}</span><h3>{current.name}</h3></div><GameDataField label="Title · EN" source={current.name} value={linked.title[0]?.target ?? ''} onChange={(value) => updateEntries(linked.title, value)} /><GameDataField label="Description · EN" source={current.description} value={linked.description[0]?.target ?? ''} onChange={(value) => updateEntries(linked.description, value)} /></> : <div className="dialogue-empty">Select an entry from the list.</div>}</main></div>
  </section>
}

function GameDataField({ label, source, value, onChange }: { label: string; source: string; value: string; onChange: (value: string) => void }): React.JSX.Element {
  return <section className="game-data-field"><label>{label}</label><div className="game-data-source">{decodeHtml(source)}</div><textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder="Translation..." rows={Math.max(2, Math.min(8, value.split('\n').length + 1))} /></section>
}
