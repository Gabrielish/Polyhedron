import { useEffect, useMemo, useState } from 'react'
import { Check, CircleCheck, CircleDashed, ExternalLink, Pencil, Search, WandSparkles, X } from 'lucide-react'
import wikiSpells from '../../../src/renderer/src/data/spells.json'
import type { SyncEntry, WorkspaceSyncDocument } from '../sync/workspaceSync'
import { indexWorkspace, loadCatalog, sourceKey } from '../utils/workspace'

type Spell = { id?: string; name: string; description: string; category: string; icon?: string; flags?: string; useCosts?: string; actionType?: string; level?: string; conditions?: string[] }
type Kind = 'spell' | 'action' | 'bonus' | 'ritual' | 'monster'
type LinkedSpell = { spell: Spell; titles: SyncEntry[]; descriptions: SyncEntry[]; complete: boolean; linked: boolean }
const kinds: Array<{ value: Kind | 'all'; label: string }> = [{ value: 'spell', label: 'Spells' }, { value: 'action', label: 'Actions' }, { value: 'bonus', label: 'Bonus actions' }, { value: 'ritual', label: 'Rituals' }, { value: 'monster', label: 'Monster abilities' }, { value: 'all', label: 'All abilities' }]
function plain(text: string): string {
  return text.replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/<[^>]*>/g, '').replace(/&quot;/gi, '"').replace(/&#39;|&#x27;/gi, "'").replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
}
const normalize = (text: string) => plain(text).replace(/\s+/g, ' ').trim().toLocaleLowerCase()
const iconByName = new Map(wikiSpells.map(spell => [normalize(spell.name), spell]))
const remoteIcons = new Map<string, Promise<string | null>>()
function resolveWikiIcon(name: string): Promise<string | null> {
  const key = normalize(name)
  const cached = remoteIcons.get(key)
  if (cached) return cached
  const base = name.trim().replace(/[\\/:*?"<>|]+/g, '')
  const params = new URLSearchParams({ action: 'query', titles: [`File:${base}.webp`, `File:${base} Icon.webp`, `File:${base} Unfaded Icon.webp`].join('|'), prop: 'imageinfo', iiprop: 'url', iiurlwidth: '96', format: 'json', origin: '*' })
  const request = fetch(`https://bg3.wiki/api.php?${params}`, { signal: AbortSignal.timeout(6000) }).then(response => response.ok ? response.json() : null).then((payload: { query?: { pages?: Record<string, { imageinfo?: Array<{ thumburl?: string; url?: string }> }> } } | null) => {
    for (const page of Object.values(payload?.query?.pages ?? {})) {
      const candidate = page.imageinfo?.[0]?.thumburl ?? page.imageinfo?.[0]?.url
      if (!candidate) continue
      const url = new URL(candidate, 'https://bg3.wiki/')
      if (url.protocol === 'https:' && url.hostname === 'bg3.wiki' && url.pathname.startsWith('/w/images/')) return url.href
    }
    return null
  }).catch(() => null)
  remoteIcons.set(key, request)
  return request
}
function classify(spell: Spell): Kind {
  if (/^Chromatic Orb:/i.test(spell.name) || /IsSpell|SpellSlotsGroup/i.test(`${spell.flags ?? ''} ${spell.useCosts ?? ''}`)) return 'spell'
  if (/IsEnemySpell|Monster|_LOW_/i.test(`${spell.flags ?? ''} ${spell.id ?? ''} ${spell.icon ?? ''}`)) return 'monster'
  if (/ritual/i.test(`${spell.name} ${spell.id ?? ''} ${spell.flags ?? ''}`)) return 'ritual'
  if (/BonusActionPoint/i.test(spell.useCosts ?? '') && !/^Spell_/i.test(spell.icon ?? '')) return 'bonus'
  if (/^Action_|SpellActionType/i.test(`${spell.icon ?? ''} ${spell.actionType ?? ''}`)) return 'action'
  return 'spell'
}
function levelLabel(spell: Spell): string {
  const level = spell.level?.trim() || String(iconByName.get(normalize(spell.name))?.level ?? '')
  return level === '0' ? 'Cantrip' : level ? `Level ${level}` : kinds.find(kind => kind.value === classify(spell))?.label ?? 'Ability'
}
function SpellIcon({ name }: { name: string }): React.JSX.Element {
  const [failed, setFailed] = useState(false)
  const [retried, setRetried] = useState(false)
  const known = iconByName.get(normalize(name))?.icon
  const [src, setSrc] = useState(known || `https://bg3.wiki/wiki/Special:FilePath/${encodeURIComponent(name.trim().replace(/\s+/g, '_') + '.webp')}`)
  function recover(): void {
    if (retried) { setFailed(true); return }
    setRetried(true)
    void resolveWikiIcon(name).then(url => { if (url && url !== src) setSrc(url); else setFailed(true) })
  }
  return <span className="spell-icon">{failed ? <WandSparkles size={23} /> : <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={recover} />}</span>
}

export function SpellsTab({ document, onDocumentChange, sessionId }: { document: WorkspaceSyncDocument; onDocumentChange: (document: WorkspaceSyncDocument) => void; sessionId?: string }): React.JSX.Element {
  const [catalog, setCatalog] = useState<Spell[]>([])
  const [loading, setLoading] = useState(true)
  const [failure, setFailure] = useState('')
  const [reload, setReload] = useState(0)
  const [kind, setKind] = useState<Kind | 'all'>('spell')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState('level')
  const [page, setPage] = useState(1)
  const [project, setProject] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const session = document.sessions.find(item => item.id === (sessionId ?? project)) ?? document.sessions[0]
  const workspace = useMemo(() => indexWorkspace(session), [session])
  const pageSize = 24
  useEffect(() => {
    let active = true
    setLoading(true); setFailure('')
    void loadCatalog().then(value => {
      if (!Array.isArray(value)) throw new Error('The spell catalog is invalid.')
      const unique = new Map<string, Spell>()
      for (const entry of value) {
        if (entry?.category !== 'Spell' || typeof entry.name !== 'string' || typeof entry.description !== 'string' || !entry.name.trim() || /^%%%|^unknown$/i.test(entry.name)) continue
        const key = `${entry.name}\0${entry.description}`
        if (!unique.has(key)) unique.set(key, entry)
      }
      if (active) setCatalog([...unique.values()])
    }).catch(error => { if (active) setFailure(error instanceof Error ? error.message : 'The spell catalog could not be loaded.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [reload])
  const linked = useMemo(() => {
    const findRows = (text: string) => (workspace.bySource.get(sourceKey(text)) ?? []).flatMap(uid => { const row = workspace.byUid.get(uid); return row ? [row] : [] })
    return catalog.map(spell => {
      const titles = findRows(spell.name)
      const descriptions = spell.description.trim() ? findRows(spell.description) : []
      const rows = [...titles, ...descriptions]
      return { spell, titles, descriptions, linked: rows.length > 0, complete: titles.length > 0 && titles.every(entry => entry.target.trim()) && (!spell.description.trim() || descriptions.length > 0 && descriptions.every(entry => entry.target.trim())) }
    })
  }, [catalog, workspace])
  const filtered = useMemo(() => {
    const text = normalize(query)
    return linked.filter(item => (kind === 'all' || classify(item.spell) === kind) && (status === 'all' || (status === 'translated' ? item.complete : status === 'untranslated' ? item.linked && !item.complete : !item.linked)) && (!text || normalize(`${item.spell.name} ${item.spell.description} ${item.titles.map(entry => entry.target).join(' ')} ${item.descriptions.map(entry => entry.target).join(' ')}`).includes(text))).sort((a, b) => {
      if (sort === 'level') {
        const rank = (spell: Spell) => { const level = spell.level?.trim() || iconByName.get(normalize(spell.name))?.level; return level !== undefined && level !== '' ? Number(level) : 50 }
        const difference = rank(a.spell) - rank(b.spell)
        if (difference) return difference
      }
      return a.spell.name.localeCompare(b.spell.name)
    })
  }, [linked, kind, query, status, sort])
  useEffect(() => { setPage(1); setEditing(null) }, [kind, query, status, sort, session?.id])
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  function save(item: LinkedSpell, title: string, description: string): void {
    const titleIds = new Set(item.titles.map(entry => entry.uid))
    const descriptionIds = new Set(item.descriptions.map(entry => entry.uid))
    onDocumentChange({ ...document, generatedAt: new Date().toISOString(), sessions: document.sessions.map(row => row.id !== session?.id ? row : { ...row, entries: row.entries.map(entry => titleIds.has(entry.uid) || descriptionIds.has(entry.uid) ? { ...entry, target: titleIds.has(entry.uid) ? title : description, matchType: 'manual' } : entry) }) })
    setEditing(null)
  }
  return <section className="spells-panel" aria-label="Spells catalog">
    <div className="spells-heading"><div><h2><WandSparkles size={20} />Spells</h2><p>Baldur’s Gate 3 abilities · linked workspace translations</p></div><span>{filtered.length.toLocaleString()} entries</span></div>
    <div className="spells-controls"><label className="search-field"><input aria-label="Search spells" placeholder="Search spells, actions, abilities…" value={query} onChange={event => setQuery(event.target.value)} /><Search size={17} /></label><select aria-label="Ability type" value={kind} onChange={event => setKind(event.target.value as Kind | 'all')}>{kinds.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select><select aria-label="Spell translation status" value={status} onChange={event => setStatus(event.target.value)}><option value="all">All statuses</option><option value="translated">Translated</option><option value="untranslated">Incomplete</option><option value="unlinked">Not linked</option></select><select aria-label="Sort spells" value={sort} onChange={event => setSort(event.target.value)}><option value="alpha">Name A–Z</option><option value="level">Spell level</option></select>{!sessionId && document.sessions.length > 1 && <select aria-label="Spell workspace project" value={session?.id ?? ''} onChange={event => setProject(event.target.value)}>{document.sessions.map(item => <option key={item.id} value={item.id}>{item.modName}</option>)}</select>}</div>
    {loading ? <p className="empty-state" role="status">Loading spells…</p> : failure ? <div className="companion-empty" role="alert"><p>{failure}</p><button className="secondary-button" onClick={() => setReload(value => value + 1)}>Try again</button></div> : filtered.length === 0 ? <p className="empty-state">No matching spells.</p> : <div className="spell-grid">{filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(item => {
      const key = `${item.spell.name}\0${item.spell.description}`
      return <article className={`spell-card${item.complete ? ' is-translated' : ''}`} key={key}><div className="spell-card-heading"><SpellIcon name={item.spell.name} /><div><h3>{item.spell.name}</h3>{item.titles[0]?.target.trim() && <p className="spell-target">↳ {plain(item.titles[0].target)}</p>}</div></div><p className="spell-description">{plain(item.spell.description) || 'No description available.'}</p>{item.descriptions[0]?.target.trim() && <p className="spell-description spell-target">↳ {plain(item.descriptions[0].target)}</p>}{item.spell.conditions?.length ? <details className="spell-conditions"><summary>Conditions ({item.spell.conditions.length})</summary><p>{item.spell.conditions.join(' · ')}</p></details> : null}<div className="spell-card-footer"><span className="spell-status">{item.complete ? <CircleCheck size={15} /> : <CircleDashed size={15} />}{item.complete ? 'Translated' : item.linked ? 'Incomplete' : 'Not linked'}</span><span className="spell-level">{levelLabel(item.spell)}</span><a href={`https://bg3.wiki/wiki/${encodeURIComponent(item.spell.name.replace(/\s+/g, '_'))}`} target="_blank" rel="noopener noreferrer" aria-label={`Open ${item.spell.name} on BG3 Wiki`}><ExternalLink size={14} /></a><button disabled={!item.linked} aria-label={`Edit ${item.spell.name} translation`} aria-expanded={editing === key} onClick={() => setEditing(editing === key ? null : key)}>{editing === key ? <X size={14} /> : <Pencil size={14} />}</button></div>{editing === key && <SpellEditor key={`${key}:${session?.id}`} item={item} language={session?.targetLang ?? ''} onSave={(title, description) => save(item, title, description)} />}</article>
    })}</div>}
    {!loading && !failure && filtered.length > 0 && <div className="pagination-bar"><button className="secondary-button" disabled={currentPage <= 1} onClick={() => { setPage(currentPage - 1); setEditing(null) }}>Previous</button><span>Page {currentPage} of {pageCount} · {filtered.length.toLocaleString()} entries</span><button className="secondary-button" disabled={currentPage >= pageCount} onClick={() => { setPage(currentPage + 1); setEditing(null) }}>Next</button></div>}
    <p className="spells-credit">Icons and reference content: <a href="https://bg3.wiki/" target="_blank" rel="noopener noreferrer">BG3 Wiki</a>. Editing is available for strings linked to your selected workspace project.</p>
  </section>
}

function SpellEditor({ item, language, onSave }: { item: LinkedSpell; language: string; onSave: (title: string, description: string) => void }): React.JSX.Element {
  const [title, setTitle] = useState(item.titles[0]?.target ?? '')
  const [description, setDescription] = useState(item.descriptions[0]?.target ?? '')
  return <div className="spell-editor">{item.titles.length > 0 && <label>Title · {language.toUpperCase()}<textarea aria-label={`${item.spell.name} translated title`} value={title} onChange={event => setTitle(event.target.value)} rows={2} /></label>}{item.descriptions.length > 0 && <label>Description · {language.toUpperCase()}<textarea aria-label={`${item.spell.name} translated description`} value={description} onChange={event => setDescription(event.target.value)} rows={4} /></label>}<p>Applies to {item.titles.length + item.descriptions.length} linked strings in this project. Changes stay local until you choose Save to Drive.</p><button className="primary-button" onClick={() => onSave(title, description)}><Check size={14} />Apply translation</button></div>
}
