import { useEffect, useMemo, useState } from 'react'
import type { WorkspaceSyncDocument } from '../sync/workspaceSync'

type DialogueItem = { act: string; name: string; file: string; nodes: Array<{ id: string; uid: string; source: string; target: string }> }
const ACTS = ['Act 1', 'Act 2', 'Act 3', 'Global']
function groupLabel(file: string): string {
  const rules: Array<[RegExp, string]> = [[/Chapel/i, 'Chapel'], [/Crash/i, 'Crash Site'], [/DEN/i, 'Druid Grove'], [/Forest/i, 'Forest'], [/GOB|Goblin/i, 'Goblin Camp'], [/Underdark/i, 'Underdark'], [/LowerCity/i, 'Lower City'], [/Moonrise/i, 'Moonrise Towers'], [/Camp_/i, 'Camp'], [/Companions_/i, 'Companions']]
  return rules.find(([pattern]) => pattern.test(file))?.[1] ?? 'Other'
}


export function DialogueNodesTab({ document, onDocumentChange }: { document: WorkspaceSyncDocument; onDocumentChange: (document: WorkspaceSyncDocument) => void }): React.JSX.Element {
  const [act, setAct] = useState('Act 1')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<DialogueItem | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [index, setIndex] = useState<any>(null)
  useEffect(() => { void fetch('./data/dialogue-index.json').then((response) => response.json()).then(setIndex).catch(() => setIndex(null)) }, [])
  const items = useMemo<DialogueItem[]>(() => {
    if (!index) return []
    const hashText = (value: string) => { let hash = 14695981039346656037n; for (const byte of new TextEncoder().encode(value)) { hash ^= BigInt(byte); hash = BigInt.asUintN(64, hash * 1099511628211n) } return hash.toString(16).padStart(16, '0') }
    const normalize = (value: string) => value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().toLocaleLowerCase()
    const categoryNames = index.categories as string[]
    const files = index.files as string[]
    const dialogues = index.dialogues as string[]
    const byDialogue = new Map<string, DialogueItem>()
    for (const session of document.sessions) for (const entry of session.entries) {
      const groups = index.entries[hashText(normalize(entry.source))] ?? []
      for (const [categoryId, fileId, dialogueId, nodeId] of groups) {
        const category = categoryNames[categoryId] ?? 'Global'; const dialogue = dialogues[dialogueId] ?? ''
        const act = category === 'Act 1' || category === 'Act 2' || category === 'Act 3' ? category : 'Global'
        const item = byDialogue.get(dialogue) ?? { act, name: dialogue, file: files[fileId] ?? '', nodes: [] }
        if (!item.nodes.some((node) => node.id === nodeId && node.uid === entry.uid)) item.nodes.push({ id: nodeId, uid: entry.uid, source: entry.source, target: entry.target })
        byDialogue.set(dialogue, item)
      }
    }
    return [...byDialogue.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [document, index])
  const filtered = items.filter((item) => item.act === act && item.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
  return <section className="dialogue-panel">
    <div className="dialogue-header"><div><p className="eyebrow">Dialogue Nodes</p><h2>Translate EN → RO</h2></div></div>
    <div className="dialogue-acts">{ACTS.map((item) => <button key={item} type="button" className={act === item ? 'dialogue-act active' : 'dialogue-act'} onClick={() => { setAct(item); setSelected(null) }}>{item}</button>)}<label className="dialogue-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search dialogue node name..." /></label><button type="button" className="dialogue-open-button" title="Open online" aria-label="Open online" disabled={!selected} onClick={() => selected && window.open(`https://bg3.game-script.com/files/${encodeURIComponent(selected.name)}`, '_blank', 'noopener,noreferrer')}>↗</button></div>
    <div className="dialogue-layout"><aside className="dialogue-tree"><p className="tree-label">Dialogue Tree · {filtered.length}</p>{filtered.length ? [...new Map(filtered.map((item) => [groupLabel(item.file), filtered.filter((candidate) => groupLabel(candidate.file) === groupLabel(item.file))])).entries()].map(([group, groupItems]) => <div className="tree-group" key={group}><button type="button" className="tree-group-title" onClick={() => setExpandedGroups((current) => { const next = new Set(current); if (next.has(group)) next.delete(group); else next.add(group); return next })}><span>{expandedGroups.has(group) ? '⌄' : '›'} {group}</span><span>{groupItems.length}</span></button>{expandedGroups.has(group) && groupItems.map((item) => <button key={item.name} type="button" className={selected?.name === item.name ? 'tree-item selected' : 'tree-item'} onClick={() => setSelected(item)}>{item.name}<span>{item.nodes.length}</span></button>)}</div>) : <p className="dialogue-empty">{index ? 'No dialogue nodes found for this act.' : 'Loading dialogue index…'}</p>}</aside><main className="dialogue-nodes">{selected ? selected.nodes.map((node, index) => <article className="dialogue-node" key={node.id}><div className="node-title">Node {index + 1}<span>{node.id}</span></div><div className="node-fields"><div><label>Source · EN</label><p>{node.source}</p></div><div><label>Translation · RO</label><textarea value={node.target} onChange={(event) => onDocumentChange({ ...document, generatedAt: new Date().toISOString(), sessions: document.sessions.map((session) => ({ ...session, entries: session.entries.map((entry) => entry.uid === node.uid ? { ...entry, target: event.target.value, matchType: 'manual' as const } : entry) })) })} rows={3} /></div></div></article>) : <div className="dialogue-empty">Select a dialogue from the tree.</div>}</main><aside className="dialogue-webview"><div className="dialogue-empty">BG3 Dialogue<br/><small>Select a dialogue to view its graph.</small></div></aside></div>
  </section>
}
