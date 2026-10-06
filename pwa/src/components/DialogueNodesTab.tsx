import { useEffect, useMemo, useState, useDeferredValue } from 'react'
import { Check, ExternalLink, LoaderCircle } from 'lucide-react'
import type { SyncEntry, WorkspaceSyncDocument } from '../sync/workspaceSync'
import { TranslationActions } from './TranslationActions'
import { CompanionSearch } from './CompanionSearch'
import { defaultSearch, indexWorkspace, matcher, updateProject } from '../utils/workspace'
import { loadDialogues, type DialogueItem } from '../utils/dialogue'
type Variant = 'default' | 'female' | 'neutral'
const ACTS = ['Act 1', 'Act 2', 'Act 3', 'Global']
function groupLabel(file: string): string {
  const rules: Array<[RegExp, string]> = [[/Chapel/i, 'Chapel'], [/Crash/i, 'Crash Site'], [/DEN/i, 'Druid Grove'], [/Forest/i, 'Forest'], [/GOB|Goblin/i, 'Goblin Camp'], [/Underdark/i, 'Underdark'], [/HAG|HagLair/i, 'Hag Lair'], [/Swamp/i, 'Swamp'], [/Plains/i, 'Plains'], [/AstralPlane/i, 'Astral Plane'], [/Monastery/i, 'Monastery'], [/UpperCreche/i, 'Upper Creche'], [/LowerCreche/i, 'Lower Creche'], [/Colony/i, 'Colony'], [/Intermezzo/i, 'Intermezzo'], [/LastLight|Haven/i, 'Last Light Inn'], [/Shadowland/i, 'Shadowland'], [/Shar/i, 'Shar Temple'], [/Town/i, 'Town'], [/LowerCity/i, 'Lower City'], [/Moonrise/i, 'Moonrise Towers'], [/Group_Discussions/i, 'Group Discussions'], [/World_Relationship_Dialogues/i, 'World Relationship Dialogues'], [/Origin_Moments/i, 'Origin Moments'], [/Disturbances/i, 'Disturbances'], [/Reflection_Dialogs/i, 'Reflection Dialogues'], [/Party_Banter/i, 'Party Banter'], [/Camp_Relationship_Dialogs/i, 'Camp Relationship Dialogues'], [/Campfire_Moments/i, 'Campfire Moments'], [/SoloDreams/i, 'Solo Dreams'], [/Camp_NPCs/i, 'NPCs'], [/Sleep_Cutscenes/i, 'Sleep Cutscenes'], [/CombatCinematics/i, 'Combat Cinematics'], [/Generics.*NO_RECORD/i, 'No Record'], [/Global.*NO_RECORD/i, 'No Record'], [/PointAndClick/i, 'Point And Click'], [/KorrillaTheSpy/i, 'Korrilla the Spy'], [/Shovel/i, 'Shovel'], [/^Generics/i, 'Generics'], [/^Other/i, 'Other'], [/^Test/i, 'Test'], [/^Global/i, 'Global'], [/^Tutorial/i, 'Tutorial'], [/Camp_/i, 'Camp'], [/Companions_/i, 'Companions']]
  return rules.find(([pattern]) => pattern.test(file))?.[1] ?? 'Other'
}
export function DialogueNodesTab({ document, onDocumentChange, sessionId }: { document: WorkspaceSyncDocument; onDocumentChange: (document: WorkspaceSyncDocument) => void; sessionId?: string }): React.JSX.Element {
  const session = document.sessions.find(item => item.id === sessionId) ?? document.sessions[0]
  const workspace = useMemo(() => indexWorkspace(session), [session])
  const [act, setAct] = useState('Act 1')
  const [subAct, setSubAct] = useState('Act 1')
  const [search, setSearch] = useState(defaultSearch)
  const [nodeSearch, setNodeSearch] = useState(defaultSearch)
  const deferredSearch = useDeferredValue(search)
  const deferredNodes = useDeferredValue(nodeSearch)
  const [status, setStatus] = useState('all')
  const [selectedName, setSelectedName] = useState('')
  const [expanded, setExpanded] = useState(new Set<string>())
  const [items, setItems] = useState<DialogueItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [nodePage, setNodePage] = useState(1)
  const [treeLimit, setTreeLimit] = useState(100)
  useEffect(() => {
    let active = true
    setLoading(true); setError(''); setItems([]); setSelectedName('')
    void loadDialogues(workspace.rows).then(next => { if (active) setItems(next) }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Dialogue reference failed to load.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [workspace.rows, retry])
  const filtered = useMemo(() => { const test = matcher(deferredSearch); return items.filter(item => item.act === (act === 'Global' ? act : subAct) && test(item.name)) }, [items, act, subAct, deferredSearch])
  const groups = useMemo(() => { const result = new Map<string, DialogueItem[]>(); for (const item of filtered) { const label = groupLabel(item.file); const group = result.get(label); if (group) group.push(item); else result.set(label, [item]) }; return result }, [filtered])
  const selected = filtered.find(item => item.name === selectedName)
  const nodes = useMemo(() => {
    const test = matcher(deferredNodes)
    return (selected?.nodes ?? []).flatMap(node => { const entry = workspace.byUid.get(node.uid); if (!entry) return []; if (status === 'translated' && !entry.target.trim() || status === 'untranslated' && entry.target.trim() || status === 'review' && !entry.needsReview) return []; const fields = deferredNodes.scope === 'source' ? [entry.source] : deferredNodes.scope === 'target' ? [entry.target] : [entry.source, entry.target, entry.uid]; return fields.some(test) ? [{ ...node, entry }] : [] })
  }, [selected, workspace.byUid, deferredNodes, status])
  useEffect(() => { setNodePage(1) }, [selectedName, nodeSearch, status, session?.id])
  useEffect(() => { setTreeLimit(100) }, [act, subAct, search])
  const pages = Math.max(1, Math.ceil(nodes.length / 25))
  const page = Math.min(nodePage, pages)
  function update(entry: SyncEntry, value: string, variant: Variant): void { if (session) onDocumentChange(updateProject(document, session.id, new Map([[entry.uid, { ...(variant === 'default' ? { target: value } : { genderTargets: { ...entry.genderTargets, [variant]: value } }), matchType: 'manual' }]]))) }
  return <section className="dialogue-panel">
    <div className="dialogue-acts">{ACTS.map(item => <button key={item} className={act === item ? 'dialogue-act active' : 'dialogue-act'} onClick={() => { setAct(item); setSubAct(item); setSelectedName('') }}>{item}</button>)}</div>
    {act !== 'Global' && <div className="dialogue-subacts">{[act, act + 'B'].map(item => <button key={item} className={subAct === item ? 'dialogue-subact active' : 'dialogue-subact'} onClick={() => { setSubAct(item); setSelectedName('') }}>{item}</button>)}</div>}
    <CompanionSearch value={search} onChange={setSearch} scope={false} label="Search dialogues" placeholder="Search dialogue names…" />
    {loading && <p className="companion-inline-status" role="status"><LoaderCircle size={15} className="companion-spin" />Loading dialogue context… You can keep using the other tabs.</p>}
    {error && <p className="companion-inline-status" role="alert">{error}<button className="secondary-button" onClick={() => setRetry(value => value + 1)}>Retry</button></p>}
    <div className="dialogue-layout"><aside className="dialogue-tree"><p className="tree-label">Dialogue Tree · {filtered.length.toLocaleString()} dialogues</p>{[...groups].map(([group, groupItems]) => <div className="tree-group" key={group}><button className="tree-group-title" onClick={() => setExpanded(current => { const next = new Set(current); next.has(group) ? next.delete(group) : next.add(group); return next })}><span>{expanded.has(group) ? '⌄' : '›'} {group}</span><span>{groupItems.length}</span></button>{expanded.has(group) && <>{groupItems.slice(0, treeLimit).map(item => { let count = 0; for (const node of item.nodes) if (workspace.byUid.get(node.uid)?.target.trim()) count++; return <button key={item.name} className={selectedName === item.name ? 'tree-item selected' : 'tree-item'} onClick={() => setSelectedName(item.name)}>{item.name}<span className="tree-item-progress"><span>{item.nodes.length} | {item.nodes.length ? Math.round(count / item.nodes.length * 100) : 0}%</span>{count === item.nodes.length && count > 0 && <b>Translated</b>}</span></button> })}{groupItems.length > treeLimit && <button className="secondary-button" onClick={() => setTreeLimit(value => value + 100)}>Show more</button>}</>}</div>)}{!loading && !error && !filtered.length && <p className="dialogue-empty">No dialogue nodes found for this act. Dialogue context requires matching BG3 source text.</p>}</aside>
    <main className="dialogue-nodes">{selected ? <><div className="companion-section-heading"><h3>{selected.name}</h3><a className="secondary-button" href={'https://bg3.game-script.com/files/' + encodeURIComponent(selected.name)} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} />Open graph</a></div><CompanionSearch value={nodeSearch} onChange={setNodeSearch} label="Search dialogue nodes" placeholder="Search this dialogue…" /><select className="companion-status-filter" aria-label="Dialogue node status" value={status} onChange={event => setStatus(event.target.value)}><option value="all">All nodes</option><option value="translated">Translated</option><option value="untranslated">Untranslated</option><option value="review">Needs review</option></select>{nodes.slice((page - 1) * 25, page * 25).map((node, position) => <article className="dialogue-node" key={session?.id + ':' + node.id + ':' + node.uid}><div className="node-title">Node {(page - 1) * 25 + position + 1}</div><DialogueNodeEditor entry={node.entry} sourceLang={session?.sourceLang} targetLang={session?.targetLang} onChange={(value, variant) => update(node.entry, value, variant)} /></article>)}{!nodes.length && <p className="dialogue-empty">No nodes match the current filters.</p>}{pages > 1 && <div className="pagination-bar"><button className="secondary-button" disabled={page === 1} onClick={() => setNodePage(page - 1)}>Previous</button><span>{page} / {pages} · {nodes.length} nodes</span><button className="secondary-button" disabled={page === pages} onClick={() => setNodePage(page + 1)}>Next</button></div>}</> : <div className="dialogue-empty">Select a dialogue from the tree.</div>}</main></div>
  </section>
}
function DialogueNodeEditor({ entry, sourceLang, targetLang, onChange }: { entry: SyncEntry; sourceLang?: string; targetLang?: string; onChange: (value: string, variant: Variant) => void }): React.JSX.Element {
  const [variant, setVariant] = useState<Variant>('default')
  const value = variant === 'default' ? entry.target : entry.genderTargets?.[variant] ?? ''
  const [draft, setDraft] = useState(value)
  const [previous, setPrevious] = useState<{ value: string; variant: Variant } | null>(null)
  const [message, setMessage] = useState('')
  useEffect(() => setDraft(value), [value, variant])
  function commit(): void { if (draft !== value) { setPrevious({ value, variant }); onChange(draft, variant) } }
  async function copy(): Promise<void> { try { await navigator.clipboard.writeText(entry.source); setMessage('Copied') } catch { setMessage('Copy unavailable') } }
  async function paste(): Promise<void> { try { const text = await navigator.clipboard.readText(); setPrevious({ value, variant }); setDraft(text); onChange(text, variant); setMessage('Pasted') } catch { setMessage('Paste unavailable') } }
  function undo(): void { if (previous) { onChange(previous.value, previous.variant); if (previous.variant === variant) setDraft(previous.value); setPrevious(null); setMessage('Undone') } }
  return <div className="node-fields"><div><label>Source{sourceLang ? ' · ' + sourceLang.toUpperCase() : ''}</label><p>{entry.source}</p></div><div><div className="node-translation-label"><label>Translation{targetLang ? ' · ' + targetLang.toUpperCase() : ''}</label><TranslationActions onCopy={() => void copy()} onPaste={() => void paste()} onUndo={undo} canUndo={!!previous} message={message} /></div><textarea aria-label="Node translation" value={draft} onChange={event => setDraft(event.target.value)} onBlur={commit} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); commit() } }} rows={3} /><div className="gender-controls">{(['default', 'female', 'neutral'] as const).map(item => <button key={item} className={variant === item ? 'active' : ''} onClick={() => { commit(); setVariant(item) }}>{(item === 'default' ? entry.target : entry.genderTargets?.[item])?.trim() && <Check size={11} />}{item}</button>)}</div></div></div>
}
