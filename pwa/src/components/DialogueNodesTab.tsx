import { useMemo, useState } from 'react'

type DialogueItem = { act: string; name: string; file: string; nodes: Array<{ id: string; source: string; target: string }> }
const ACTS = ['Act 1', 'Act 2', 'Act 3', 'Global']

export function DialogueNodesTab(): React.JSX.Element {
  const [act, setAct] = useState('Act 1')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<DialogueItem | null>(null)
  const items = useMemo<DialogueItem[]>(() => [], [])
  const filtered = items.filter((item) => item.act === act && item.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
  return <section className="dialogue-panel">
    <div className="dialogue-header"><div><p className="eyebrow">Dialogue Nodes</p><h2>Translate EN → RO</h2></div><button type="button" className="secondary-button" disabled={!selected} onClick={() => selected && window.open(`https://bg3.game-script.com/files/${encodeURIComponent(selected.name)}`, '_blank', 'noopener,noreferrer')}>↗ Open Online</button></div>
    <div className="dialogue-acts">{ACTS.map((item) => <button key={item} type="button" className={act === item ? 'dialogue-act active' : 'dialogue-act'} onClick={() => { setAct(item); setSelected(null) }}>{item}</button>)}<label className="dialogue-search">⌕<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search dialogue node name..." /></label></div>
    <div className="dialogue-layout"><aside className="dialogue-tree"><p className="tree-label">Dialogue Tree · {filtered.length}</p>{filtered.length ? filtered.map((item) => <button key={item.name} type="button" className={selected?.name === item.name ? 'tree-item selected' : 'tree-item'} onClick={() => setSelected(item)}>{item.name}<span>{item.nodes.length}</span></button>) : <p className="dialogue-empty">Dialogue index will be available after the next workspace download.</p>}</aside><main className="dialogue-nodes">{selected ? selected.nodes.map((node, index) => <article className="dialogue-node" key={node.id}><div className="node-title">Node {index + 1}<span>{node.id}</span></div><div className="node-fields"><div><label>Source · EN</label><p>{node.source}</p></div><div><label>Translation · RO</label><textarea value={node.target} onChange={() => undefined} rows={3} /></div></div></article>) : <div className="dialogue-empty">Select a dialogue from the tree.</div>}</main><aside className="dialogue-webview"><div className="dialogue-empty">BG3 Dialogue<br/><small>Select a dialogue to view its graph.</small></div></aside></div>
  </section>
}
