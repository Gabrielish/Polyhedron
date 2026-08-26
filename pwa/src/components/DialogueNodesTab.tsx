import { useEffect, useMemo, useState } from 'react'
import type { WorkspaceSyncDocument } from '../sync/workspaceSync'
import { TranslationActions } from './TranslationActions'

type DialogueItem = { act: string; name: string; file: string; nodes: Array<{ id: string; uid: string; source: string; target: string }> }
const ACTS = ['Act 1', 'Act 2', 'Act 3', 'Global']
function groupLabel(file: string): string {
  const rules: Array<[RegExp, string]> = [[/Chapel/i, 'Chapel'], [/Crash/i, 'Crash Site'], [/DEN/i, 'Druid Grove'], [/Forest/i, 'Forest'], [/GOB|Goblin/i, 'Goblin Camp'], [/Underdark/i, 'Underdark'], [/HAG|HagLair/i, 'Hag Lair'], [/Swamp/i, 'Swamp'], [/Plains/i, 'Plains'], [/AstralPlane/i, 'Astral Plane'], [/Monastery/i, 'Monastery'], [/UpperCreche/i, 'Upper Creche'], [/LowerCreche/i, 'Lower Creche'], [/Colony/i, 'Colony'], [/Intermezzo/i, 'Intermezzo'], [/LastLight|Haven/i, 'Last Light Inn'], [/Shadowland/i, 'Shadowland'], [/Shar/i, 'Shar Temple'], [/Town/i, 'Town'], [/LowerCity/i, 'Lower City'], [/Moonrise/i, 'Moonrise Towers'], [/Group_Discussions/i, 'Group Discussions'], [/World_Relationship_Dialogues/i, 'World Relationship Dialogues'], [/Origin_Moments/i, 'Origin Moments'], [/Disturbances/i, 'Disturbances'], [/Reflection_Dialogs/i, 'Reflection Dialogues'], [/Party_Banter/i, 'Party Banter'], [/Camp_Relationship_Dialogs/i, 'Camp Relationship Dialogues'], [/Campfire_Moments/i, 'Campfire Moments'], [/SoloDreams/i, 'Solo Dreams'], [/Camp_NPCs/i, 'NPCs'], [/Sleep_Cutscenes/i, 'Sleep Cutscenes'], [/CombatCinematics/i, 'Combat Cinematics'], [/Generics.*NO_RECORD/i, 'No Record'], [/Global.*NO_RECORD/i, 'No Record'], [/PointAndClick/i, 'Point And Click'], [/KorrillaTheSpy/i, 'Korrilla the Spy'], [/Shovel/i, 'Shovel'], [/^Generics/i, 'Generics'], [/^Other/i, 'Other'], [/^Test/i, 'Test'], [/^Global/i, 'Global'], [/^Tutorial/i, 'Tutorial'], [/Camp_/i, 'Camp'], [/Companions_/i, 'Companions']]
  return rules.find(([pattern]) => pattern.test(file))?.[1] ?? 'Other'
}


function DialogueNodeEditor({ node, onChange }: { node: { source: string; target: string }; onChange: (value: string) => void }): React.JSX.Element {
  const [previous, setPrevious] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  async function copy(): Promise<void> { try { await navigator.clipboard.writeText(node.source); setMessage('Copied') } catch { setMessage('Copy unavailable') } }
  async function paste(): Promise<void> { try { setPrevious(node.target); onChange(await navigator.clipboard.readText()); setMessage('Pasted') } catch { setMessage('Paste unavailable') } }
  function undo(): void { if (previous === null) return; onChange(previous); setPrevious(null); setMessage('Undone') }
  return <div className="node-fields"><div><label>Source · EN</label><p>{node.source}</p></div><div><div className="node-translation-label"><label>Translation · RO</label><TranslationActions onCopy={() => void copy()} onPaste={() => void paste()} onUndo={undo} canUndo={previous !== null} message={message} /></div><textarea value={node.target} onChange={(event) => { setPrevious(node.target); onChange(event.target.value) }} rows={3} /></div></div>
}

export function DialogueNodesTab({ document, onDocumentChange }: { document: WorkspaceSyncDocument; onDocumentChange: (document: WorkspaceSyncDocument) => void }): React.JSX.Element {
  const [act, setAct] = useState('Act 1')
  const [subAct, setSubAct] = useState('Act 1')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<DialogueItem | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [index, setIndex] = useState<any>(null)
  useEffect(() => { void fetch('./data/dialogue-index.json').then((response) => response.json()).then(setIndex).catch(() => setIndex(null)) }, [])
  const items = useMemo<DialogueItem[]>(() => {
    if (!index) return []
    const hashText = (value: string) => { let hash = 14695981039346656037n; for (const byte of new TextEncoder().encode(value)) { hash ^= BigInt(byte); hash = BigInt.asUintN(64, hash * 1099511628211n) } return hash.toString(16).padStart(16, '0') }
    const normalize = (value: string) => value.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;|&#x27;/gi, "'").replace(/\s+/g, ' ').trim().toLocaleLowerCase()
    const categoryNames = index.categories as string[]
    const files = index.files as string[]
    const dialogues = index.dialogues as string[]
    const byDialogue = new Map<string, DialogueItem>()
    for (const session of document.sessions) for (const entry of session.entries) {
      const groups = index.entries[hashText(normalize(entry.source))] ?? []
      for (const [categoryId, fileId, dialogueId, nodeId] of groups) {
        const category = categoryNames[categoryId] ?? 'Global'; const dialogue = dialogues[dialogueId] ?? ''
        const act = category === 'Act 1' ? (/AstralPlane|Monastery|UpperCreche|LowerCreche/i.test(files[fileId] ?? '') ? 'Act 1B' : 'Act 1') : category === 'Act 2' ? (/Intermezzo/i.test(files[fileId] ?? '') ? 'Act 2B' : 'Act 2') : category === 'Act 3' ? (/Act3i|Act3b/i.test(files[fileId] ?? '') ? 'Act 3B' : 'Act 3') : 'Global'
        const item = byDialogue.get(dialogue) ?? { act, name: dialogue, file: files[fileId] ?? '', nodes: [] }
        if (!item.nodes.some((node) => node.id === nodeId && node.uid === entry.uid)) item.nodes.push({ id: nodeId, uid: entry.uid, source: entry.source, target: entry.target })
        byDialogue.set(dialogue, item)
      }
    }
    return [...byDialogue.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [document, index])
  const filtered = items.filter((item) => ((act === 'Act 1' || act === 'Act 2' || act === 'Act 3') ? (item.act === subAct) : item.act === act) && item.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
  const nodeCount = filtered.reduce((total, item) => total + item.nodes.length, 0)
  return <section className="dialogue-panel">
    <div className="dialogue-header"><div><p className="eyebrow">Dialogue Nodes</p><h2>Translate EN → RO</h2></div></div>
    <div className="dialogue-acts">{ACTS.map((item) => <button key={item} type="button" className={act === item ? 'dialogue-act active' : 'dialogue-act'} onClick={() => { setAct(item); setSubAct(item === 'Act 1' || item === 'Act 2' || item === 'Act 3' ? item : item); setSelected(null) }}>{item}</button>)}</div>{(act === 'Act 1' || act === 'Act 2' || act === 'Act 3') && <div className="dialogue-subacts">{(act === 'Act 1' ? ['Act 1', 'Act 1B'] : act === 'Act 2' ? ['Act 2', 'Act 2B'] : ['Act 3', 'Act 3B']).map((item) => <button key={item} type="button" className={subAct === item ? 'dialogue-subact active' : 'dialogue-subact'} onClick={() => { setSubAct(item); setSelected(null) }}>{item}</button>)}</div>}<div className="dialogue-controls"><label className="dialogue-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search dialogue node name..." /></label><button type="button" className="dialogue-open-button" title="Open online" aria-label="Open online" disabled={!selected} onClick={() => selected && window.open(`https://bg3.game-script.com/files/${encodeURIComponent(selected.name)}`, '_blank', 'noopener,noreferrer')}>↗</button></div>
    <div className="dialogue-layout"><aside className="dialogue-tree"><p className="tree-label">Dialogue Tree · {nodeCount.toLocaleString()} nodes</p>{filtered.length ? [...new Map(filtered.map((item) => [groupLabel(item.file), filtered.filter((candidate) => groupLabel(candidate.file) === groupLabel(item.file))])).entries()].map(([group, groupItems]) => <div className="tree-group" key={group}><button type="button" className="tree-group-title" onClick={() => setExpandedGroups((current) => { const next = new Set(current); if (next.has(group)) next.delete(group); else next.add(group); return next })}><span>{expandedGroups.has(group) ? '⌄' : '›'} {group}</span><span>{groupItems.length}</span></button>{expandedGroups.has(group) && groupItems.map((item) => <button key={item.name} type="button" className={selected?.name === item.name ? 'tree-item selected' : 'tree-item'} onClick={() => setSelected(item)}>{item.name}<span className="tree-item-progress"><span>{item.nodes.length} | {item.nodes.length ? Math.round(item.nodes.filter((node) => node.target.trim()).length / item.nodes.length * 100) : 0}%</span>{item.nodes.length > 0 && item.nodes.every((node) => node.target.trim()) && <b>Translated</b>}</span></button>)}</div>) : <p className="dialogue-empty">{index ? 'No dialogue nodes found for this act.' : 'Loading dialogue index…'}</p>}</aside><main className="dialogue-nodes">{selected ? selected.nodes.map((node, index) => <article className="dialogue-node" key={node.id}><div className="node-title">Node {index + 1}</div><DialogueNodeEditor node={node} onChange={(value) => onDocumentChange({ ...document, generatedAt: new Date().toISOString(), sessions: document.sessions.map((session) => ({ ...session, entries: session.entries.map((entry) => entry.uid === node.uid ? { ...entry, target: value, matchType: 'manual' as const } : entry) })) })} /></article>) : <div className="dialogue-empty">Select a dialogue from the tree.</div>}</main><aside className="dialogue-webview"><div className="dialogue-empty">BG3 Dialogue<br/><small>Select a dialogue to view its graph.</small></div></aside></div>
  </section>
}
