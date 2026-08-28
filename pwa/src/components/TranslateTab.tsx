import { useEffect, useMemo, useRef, useState } from 'react'
import type { SyncEntry, WorkspaceSyncDocument } from '../sync/workspaceSync'
import { isWorkspaceSyncDocument } from '../sync/workspaceSync'
import { TranslationActions } from './TranslationActions'
import { Check, Search } from 'lucide-react'

function isDeveloperNote(source: string): boolean {
  const value = source.trim()
  return value.startsWith('%%%') || (value.startsWith('|') && value.indexOf('|', 1) > 0)
}

function downloadDocument(document: WorkspaceSyncDocument): void {
  const blob = new Blob([JSON.stringify(document, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = window.document.createElement('a')
  anchor.href = url
  anchor.download = 'workspace-sync.json'
  anchor.click()
  URL.revokeObjectURL(url)
}

export function TranslateTab({ document, onDocumentChange, importSignal = 0 }: { document: WorkspaceSyncDocument; onDocumentChange: (document: WorkspaceSyncDocument) => void; importSignal?: number }): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [exactMatch, setExactMatch] = useState(false)
  const [showIds, setShowIds] = useState(false)
  const [filter, setFilter] = useState<'all' | 'untranslated' | 'translated' | 'tags' | 'needs-review'>('all')
  const [page, setPage] = useState(1)
  const pageSize = 25
  const [message, setMessage] = useState('Import a workspace-sync.json exported from Polyhedron Desktop.')

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 250)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    if (importSignal > 0) inputRef.current?.click()
  }, [importSignal])

  const session = document.sessions[0]
  const allEntries = useMemo(() => document.sessions.flatMap((item) => item.entries).filter((entry) => !isDeveloperNote(entry.source)), [document.sessions])
  const entries = useMemo(() => {
    const normalized = debouncedQuery.trim().toLocaleLowerCase()
    const matchesFilter = (entry: SyncEntry) => filter === 'all' || (filter === 'untranslated' ? !entry.target.trim() : filter === 'translated' ? Boolean(entry.target.trim()) : filter === 'needs-review' ? entry.needsReview : /<[^>]+>|&lt;\/?[A-Za-z]/i.test(entry.source))
    if (!normalized) return allEntries.filter(matchesFilter)
    return allEntries.filter((entry) => {
      const fields = [entry.source, entry.target, entry.uid].map((value) => value.toLocaleLowerCase())
      return matchesFilter(entry) && (exactMatch ? fields.some((value) => value === normalized) : fields.some((value) => value.includes(normalized)))
    })
  }, [allEntries, debouncedQuery, exactMatch, filter])

  const pageCount = Math.max(1, Math.ceil(entries.length / pageSize))
  const visibleEntries = entries.slice((page - 1) * pageSize, page * pageSize)
  const translatedCount = allEntries.filter((entry) => entry.target.trim()).length
  const totalCount = allEntries.length
  const translatedPercent = totalCount > 0 ? ((translatedCount / totalCount) * 100).toFixed(2).replace('.', ',') : '0,00'

  useEffect(() => {
    setPage(1)
  }, [query, exactMatch, filter, session?.id])

  async function importDocument(file: File): Promise<void> {
    try {
      const parsed: unknown = JSON.parse(await file.text())
      if (!isWorkspaceSyncDocument(parsed)) throw new Error('This file is not a supported workspace sync document.')
      onDocumentChange(parsed)
      setPage(1)
      setMessage(`Loaded ${parsed.sessions.length} session${parsed.sessions.length === 1 ? '' : 's'} from ${file.name}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to read this sync file.')
    }
  }

  function updateEntry(uid: string, target: string, variant: 'default' | 'female' | 'neutral' = 'default'): void {
    onDocumentChange({
      ...document,
      generatedAt: new Date().toISOString(),
      sessions: document.sessions.map((item) => ({
        ...item,
        entries: item.entries.map((entry) => entry.uid === uid ? { ...entry, ...(variant === 'default' ? { target } : { genderTargets: { ...(entry.genderTargets ?? {}), [variant]: target } }), matchType: 'manual' as SyncEntry['matchType'] } : entry)
      }))
    })
  }

  function toggleReview(uid: string): void {
    onDocumentChange({
      ...document,
      generatedAt: new Date().toISOString(),
      sessions: document.sessions.map((item) => ({
        ...item,
        entries: item.entries.map((entry) => entry.uid === uid ? { ...entry, needsReview: !entry.needsReview } : entry)
      }))
    })
  }

  return (
    <section className="translate-panel">
      <input ref={inputRef} type="file" accept="application/json,.json" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void importDocument(file); event.currentTarget.value = '' }} />

      {document.sessions.length > 0 && (
        <div className="translate-controls">
          <label className="search-field"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search..." /><Search aria-hidden="true" size={17} /></label>
          <label className="exact-match" title="Exact match"><input type="checkbox" checked={exactMatch} onChange={(event) => setExactMatch(event.target.checked)} /><span className="control-icon" aria-hidden="true">⌕</span><span className="control-text">Exact</span></label>
          <label className="exact-match" title="Show IDs"><input type="checkbox" checked={showIds} onChange={(event) => setShowIds(event.target.checked)} /><span className="control-icon" aria-hidden="true">#</span><span className="control-text">IDs</span></label>
          <div className="translation-filters" role="group" aria-label="Translation filters">{([['all', 'All'], ['untranslated', 'Untranslated'], ['translated', 'Translated'], ['tags', 'With XML tags'], ['needs-review', 'Needs review']] as const).map(([value, label]) => <button key={value} type="button" className={filter === value ? 'translation-filter active' : 'translation-filter'} onClick={() => setFilter(value)}>{label}</button>)}</div>
          <span className="counter">{translatedCount.toLocaleString()} / {totalCount.toLocaleString()} translated ({translatedPercent}%)</span>
        </div>
      )}

      <div className="translate-list">
        {entries.length === 0 ? <div className="empty-state">Load a sync file from the desktop workspace to see your strings here.</div> : visibleEntries.map((entry, index) => <TranslationCard key={entry.uid} entry={entry} stringNumber={(page - 1) * pageSize + index + 1} showId={showIds} onChange={(target, variant) => updateEntry(entry.uid, target, variant)} onReview={() => toggleReview(entry.uid)} />)}
      </div>
      {entries.length > 0 && <div className="pagination-bar">
        <button type="button" className="secondary-button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
        <span>Page {page} of {pageCount} · {((page - 1) * pageSize + 1).toLocaleString()}–{Math.min(page * pageSize, entries.length).toLocaleString()} of {entries.length.toLocaleString()}</span>
        <button type="button" className="secondary-button" disabled={page >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>Next</button>
      </div>}
    </section>
  )
}

function TranslationCard({ entry, stringNumber, showId, onChange, onReview }: { entry: SyncEntry; stringNumber: number; showId: boolean; onChange: (value: string, variant?: 'default' | 'female' | 'neutral') => void; onReview: () => void }): React.JSX.Element {
  const [previousValue, setPreviousValue] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState('')
  const [variant, setVariant] = useState<'default' | 'female' | 'neutral'>('default')
  const sourceText = decodeHtmlEntities(entry.source)
  async function copySource(): Promise<void> {
    try { await navigator.clipboard.writeText(sourceText); setActionMessage('Copied') } catch { setActionMessage('Copy unavailable') }
  }
  async function pasteSource(): Promise<void> {
    try { setPreviousValue(entry.target); onChange(await navigator.clipboard.readText()); setActionMessage('Pasted') } catch { setActionMessage('Paste unavailable') }
  }
  function changeTarget(value: string): void {
    setPreviousValue(entry.target)
    onChange(value, variant)
  }
  function undo(): void {
    if (previousValue === null) return
    onChange(previousValue, variant)
    setPreviousValue(null)
    setActionMessage('Undone')
  }
  return <article className="translation-card"><div className="translation-meta"><span>{showId ? `#${stringNumber} | ${entry.uid}` : `#${stringNumber}`}</span><TranslationActions onCopy={() => void copySource()} onPaste={() => void pasteSource()} onUndo={undo} canUndo={previousValue !== null} message={actionMessage} onReview={onReview} needsReview={entry.needsReview} /></div><div className="translation-source"><LarianText value={entry.source} /></div><HighlightedEditor value={variant === 'default' ? entry.target : (entry.genderTargets?.[variant] ?? '')} onChange={changeTarget} /><div className="gender-controls">{(['default','female','neutral'] as const).map((item) => { const value = item === 'default' ? entry.target : (entry.genderTargets?.[item] ?? ''); return <button key={item} type="button" className={variant === item ? 'active' : ''} onClick={() => setVariant(item)}>{value.trim() && <Check size={11} />} {item}</button> })}</div></article>
}
function HighlightedEditor({ value, onChange }: { value: string; onChange: (value: string) => void }): React.JSX.Element {
  const highlightRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    editor.style.height = 'auto'
    editor.style.height = `${editor.scrollHeight}px`
  }, [value])
  function syncScroll(event: React.UIEvent<HTMLTextAreaElement>): void {
    if (highlightRef.current) {
      highlightRef.current.scrollTop = event.currentTarget.scrollTop
      highlightRef.current.scrollLeft = event.currentTarget.scrollLeft
    }
  }
  return <div className="translation-editor"><div ref={highlightRef} className="editor-highlight" aria-hidden="true"><LarianText value={value || ' '} /></div><textarea ref={editorRef} className="editor-input" value={value} onChange={(event) => onChange(event.target.value)} onScroll={syncScroll} placeholder="Translation..." rows={2} /></div>
}

function decodeHtmlEntities(value: string): string {
  const textarea = window.document.createElement('textarea')
  let decoded = value
  for (let pass = 0; pass < 3; pass += 1) {
    textarea.innerHTML = decoded
    const next = textarea.value
    if (next === decoded) break
    decoded = next
  }
  return decoded
}

function LarianText({ value }: { value: string }): React.JSX.Element {
  const decoded = decodeHtmlEntities(value)
  const parts = decoded.split(/(<\/?(?:LSTag|LSTagValue)\b[^>]*>)/gi)
  return <>{parts.map((part, index) => /<\/?(?:LSTag|LSTagValue)\b[^>]*>/i.test(part) ? <span className="larian-tag" key={`${part}-${index}`}>{part}</span> : <span key={`${part}-${index}`}>{part}</span>)}</>
}
