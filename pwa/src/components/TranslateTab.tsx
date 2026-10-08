import { useEffect, useMemo, useRef, useState } from 'react'
import type { SyncEntry, WorkspaceSyncDocument } from '../sync/workspaceSync'
import { parseWorkspaceFile } from '../utils/parseWorkspace'
import { TranslationActions } from './TranslationActions'
import { Check, ArrowDownUp, ArrowDownWideNarrow, SquareDashed, Hash, Highlighter, Sparkles, Replace, Undo2, Redo2 } from 'lucide-react'
import { CompanionSearch, ToolButton } from './CompanionSearch'
import { defaultSearch, indexWorkspace, sourceKey, updateProject, type SearchOptions } from '../utils/workspace'
import { useTranslateSearch } from '../utils/useTranslateSearch'
import type { SortMode } from '../utils/translateSearch'
import { replacementChanges } from '../utils/replace'
import { matchRanges } from '../utils/highlight'

export function TranslateTab({ document, onDocumentChange, importSignal = 0, sessionId, onImportMessage }: { document: WorkspaceSyncDocument; onDocumentChange: (document: WorkspaceSyncDocument) => void; importSignal?: number; sessionId?: string; onImportMessage?: (message: string, failed?: boolean) => void }): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState<SearchOptions>(defaultSearch)
  const [debouncedSearch, setDebouncedSearch] = useState(search)
  const [sort, setSort] = useState<SortMode>('default')
  const [highlight, setHighlight] = useState<'underline' | 'select' | 'off'>('underline')
  const [suggestions, setSuggestions] = useState(false)
  const [replaceOpen, setReplaceOpen] = useState(false)
  const [find, setFind] = useState('')
  const [replacement, setReplacement] = useState('')
  const [history, setHistory] = useState<{ before: Map<string, Partial<SyncEntry>>; after: Map<string, Partial<SyncEntry>>; sessionId: string; undone: boolean } | null>(null)
  const [showIds, setShowIds] = useState(false)
  const [filter, setFilter] = useState<'all' | 'untranslated' | 'translated' | 'tags' | 'needs-review'>('all')
  const [page, setPage] = useState(1)
  const pageSize = 25
  const [message, setMessage] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 150)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    if (importSignal > 0) inputRef.current?.click()
  }, [importSignal])

  const session = document.sessions.find(item => item.id === sessionId) ?? document.sessions[0]
  const suggestionIndex = useMemo(() => suggestions ? indexWorkspace(session) : null, [suggestions, session])
  const allEntries = useMemo(() => session?.entries ?? [], [session?.entries])
  const options = useMemo(() => ({ ...debouncedSearch, filter, sort }), [debouncedSearch, filter, sort])
  const { result, searching } = useTranslateSearch(allEntries, options)
  const pageCount = Math.max(1, Math.ceil(result.indices.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const visibleEntries = result.indices.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(index => allEntries[index]).filter(Boolean)
  const translatedCount = result.translated
  const totalCount = result.total
  const translatedPercent = totalCount > 0 ? ((translatedCount / totalCount) * 100).toFixed(2).replace('.', ',') : '0,00'

  useEffect(() => {
    setPage(1)
  }, [search, filter, sort, session?.id])
  useEffect(() => { setHistory(null) }, [session?.id])

  function cycleSort(prefix: 'repeated' | 'length' | 'spaces'): void {
    const first: SortMode = prefix === 'repeated' ? 'repeated-desc' : `${prefix}-asc`
    const second: SortMode = prefix === 'repeated' ? 'repeated-asc' : `${prefix}-desc`
    setSort(sort === first ? second : sort === second ? 'default' : first)
  }
  const pendingSearch = searching || search !== debouncedSearch
  function replaceTargets(firstOnly: boolean): void {
    if (!session || pendingSearch) return
    const after = replacementChanges(allEntries, result.indices, find, replacement, search.matchCase, search.wholeWord, firstOnly)
    const before = new Map<string, Partial<SyncEntry>>()
    for (const entry of allEntries) if (after.has(entry.uid)) before.set(entry.uid, { target: entry.target, matchType: entry.matchType })
    if (after.size) { onDocumentChange(updateProject(document, session.id, after)); setHistory({ before, after, sessionId: session.id, undone: false }) }
    setMessage(`Replaced in ${after.size.toLocaleString()} ${after.size === 1 ? 'string' : 'strings'} in this project.`)
  }
  function restoreReplacement(): void {
    if (!history || !session || session.id !== history.sessionId) return
    const expected = history.undone ? history.before : history.after
    const desired = history.undone ? history.after : history.before
    const safe = new Map<string, Partial<SyncEntry>>()
    for (const entry of allEntries) if (expected.has(entry.uid) && entry.target === expected.get(entry.uid)?.target) safe.set(entry.uid, desired.get(entry.uid)!)
    onDocumentChange(updateProject(document, session.id, safe))
    setHistory({ ...history, undone: !history.undone }); setMessage(`${history.undone ? 'Redone' : 'Undone'} for ${safe.size.toLocaleString()} strings. Later edits are kept.`)
  }

  async function importDocument(file: File): Promise<void> {
    try {
      onImportMessage?.('Importing workspace…')
      const parsed = await parseWorkspaceFile(file)
      onDocumentChange(parsed)
      setPage(1)
      setMessage(`Loaded ${parsed.sessions.length} session${parsed.sessions.length === 1 ? '' : 's'} from ${file.name}.`)
      onImportMessage?.(`Imported ${parsed.sessions.length} ${parsed.sessions.length === 1 ? 'project' : 'projects'} from ${file.name}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to read this sync file.')
      onImportMessage?.(error instanceof Error ? error.message : 'Unable to read this sync file.', true)
    }
  }

  function updateEntry(uid: string, target: string, variant: 'default' | 'female' | 'neutral' = 'default'): void {
    if (!session) return
    const entry = session.entries.find(item => item.uid === uid)
    onDocumentChange(updateProject(document, session.id, new Map([[uid, { ...(variant === 'default' ? { target } : { genderTargets: { ...entry?.genderTargets, [variant]: target } }), matchType: 'manual' }]])))
  }

  function toggleReview(uid: string): void {
    if (session) onDocumentChange(updateProject(document, session.id, new Map([[uid, { needsReview: !session.entries.find(entry => entry.uid === uid)?.needsReview }]])))
  }

  return (
    <section className="translate-panel">
      <input ref={inputRef} type="file" accept=".pws,application/json,.json" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void importDocument(file); event.currentTarget.value = '' }} />

      {document.sessions.length > 0 && (
        <div className="translate-controls">
          <CompanionSearch value={search} onChange={setSearch} toolbar={<><ToolButton label={`Repeated strings · ${sort.startsWith('repeated') ? sort.endsWith('desc') ? 'most first' : 'least first' : 'off'}`} active={sort.startsWith('repeated')} onClick={() => cycleSort('repeated')}><ArrowDownUp size={15} /></ToolButton><ToolButton label={`String length · ${sort.startsWith('length') ? sort.endsWith('asc') ? 'shortest first' : 'longest first' : 'off'}`} active={sort.startsWith('length')} onClick={() => cycleSort('length')}><ArrowDownWideNarrow size={15} /></ToolButton><ToolButton label={`Edge spaces · ${sort.startsWith('spaces') ? sort.endsWith('asc') ? 'least first' : 'most first' : 'off'}`} active={sort.startsWith('spaces')} onClick={() => cycleSort('spaces')}><SquareDashed size={15} /></ToolButton><ToolButton label="Show IDs" active={showIds} onClick={() => setShowIds(!showIds)}><Hash size={15} /></ToolButton><ToolButton label={highlight === 'underline' ? 'Underline matches' : highlight === 'select' ? 'Highlight matches' : 'Highlighting off'} active={highlight !== 'off'} onClick={() => setHighlight(highlight === 'underline' ? 'select' : highlight === 'select' ? 'off' : 'underline')}><Highlighter size={15} /></ToolButton><ToolButton label="Show translation suggestions" active={suggestions} onClick={() => setSuggestions(!suggestions)}><Sparkles size={15} /></ToolButton><ToolButton label="Find and replace" active={replaceOpen} onClick={() => setReplaceOpen(!replaceOpen)}><Replace size={15} /></ToolButton></>} />
          {replaceOpen && <div className="companion-replace"><input aria-label="Find in translations" placeholder="Find in translations…" value={find} onChange={event => setFind(event.target.value)} /><span aria-hidden="true">→</span><input aria-label="Replacement text" placeholder="Replace with…" value={replacement} onChange={event => setReplacement(event.target.value)} /><button className="secondary-button" disabled={!find || pendingSearch} onClick={() => replaceTargets(true)}>Replace</button><button className="secondary-button" disabled={!find || pendingSearch} onClick={() => replaceTargets(false)}>Replace all</button><ToolButton label={history?.undone ? 'Redo replacement' : 'Undo replacement'} disabled={!history} onClick={restoreReplacement}>{history?.undone ? <Redo2 size={15} /> : <Undo2 size={15} />}</ToolButton><small>Current filter · default translations only · case/word options above</small></div>}
          <div className="translation-filters" role="group" aria-label="Translation filters">{([['all', 'All'], ['untranslated', 'Untranslated'], ['translated', 'Translated'], ['tags', 'With XML tags'], ['needs-review', 'Needs review']] as const).map(([value, label]) => <button key={value} type="button" className={filter === value ? 'translation-filter active' : 'translation-filter'} onClick={() => setFilter(value)}>{label}</button>)}</div>
          <span className="counter" role="status">{searching ? 'Searching… · ' : ''}{translatedCount.toLocaleString()} / {totalCount.toLocaleString()} translated ({translatedPercent}%)</span>
        </div>
      )}

      {message && <p className="companion-inline-status" role="status">{message}</p>}
      <div className="translate-list">
        {result.indices.length === 0 ? <div className="empty-state">{searching ? 'Searching…' : 'No strings match the current search and filter.'}</div> : visibleEntries.map((entry, index) => <TranslationCard key={`${session?.id}:${entry.uid}`} entry={entry} stringNumber={(currentPage - 1) * pageSize + index + 1} showId={showIds} highlight={highlight} search={search} suggestions={suggestionIndex ? [...new Set((suggestionIndex.bySource.get(sourceKey(entry.source)) ?? []).flatMap(uid => { const value = suggestionIndex.byUid.get(uid)?.target; return uid !== entry.uid && value?.trim() && value !== entry.target ? [value] : [] }))].slice(0, 3) : undefined} sourceLang={session?.sourceLang} targetLang={session?.targetLang} onChange={(target, variant) => updateEntry(entry.uid, target, variant)} onReview={() => toggleReview(entry.uid)} />)}
      </div>
      {result.indices.length > 0 && <div className="pagination-bar">
        <button type="button" className="secondary-button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Previous</button>
        <span>Page {currentPage} of {pageCount} · {result.indices.length.toLocaleString()} strings</span>
        <button type="button" className="secondary-button" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>Next</button>
      </div>}
    </section>
  )
}

function TranslationCard({ entry, stringNumber, showId, sourceLang, targetLang, highlight, search, suggestions, onChange, onReview }: { entry: SyncEntry; stringNumber: number; showId: boolean; sourceLang?: string; targetLang?: string; highlight: 'underline' | 'select' | 'off'; search: SearchOptions; suggestions?: string[]; onChange: (value: string, variant?: 'default' | 'female' | 'neutral') => void; onReview: () => void }): React.JSX.Element {
  const [previousValue, setPreviousValue] = useState<{ value: string; variant: 'default' | 'female' | 'neutral' } | null>(null)
  const [actionMessage, setActionMessage] = useState('')
  const [variant, setVariant] = useState<'default' | 'female' | 'neutral'>('default')
  const sourceText = decodeHtmlEntities(entry.source)
  async function copySource(): Promise<void> {
    try { await navigator.clipboard.writeText(sourceText); setActionMessage('Copied') } catch { setActionMessage('Copy unavailable') }
  }
  async function pasteSource(): Promise<void> {
    try { const text = await navigator.clipboard.readText(); changeTarget(text); setActionMessage('Pasted') } catch { setActionMessage('Paste unavailable') }
  }
  function changeTarget(value: string): void {
    setPreviousValue({ value: variant === 'default' ? entry.target : entry.genderTargets?.[variant] ?? '', variant })
    onChange(value, variant)
  }
  function undo(): void {
    if (previousValue === null) return
    onChange(previousValue.value, previousValue.variant)
    setPreviousValue(null)
    setActionMessage('Undone')
  }
  return <article className="translation-card"><div className="translation-meta"><span>{showId ? `#${stringNumber} | ${entry.uid}` : `#${stringNumber}`}</span><TranslationActions onCopy={() => void copySource()} onPaste={() => void pasteSource()} onUndo={undo} canUndo={previousValue !== null} message={actionMessage} onReview={onReview} needsReview={entry.needsReview} /></div><div className="translation-fields"><div><label className="translation-language">Source{sourceLang ? ` · ${sourceLang.toUpperCase()}` : ''}</label><div className="translation-source"><LarianText value={entry.source} search={search.scope !== 'target' ? search : undefined} highlight={highlight} /></div></div><div><label className="translation-language">Translation{targetLang ? ` · ${targetLang.toUpperCase()}` : ''}</label><HighlightedEditor search={search.scope !== 'source' ? search : undefined} highlight={highlight} value={variant === 'default' ? entry.target : (entry.genderTargets?.[variant] ?? '')} onChange={changeTarget} /><div className="gender-controls">{(['default','female','neutral'] as const).map((item) => { const value = item === 'default' ? entry.target : (entry.genderTargets?.[item] ?? ''); return <button key={item} type="button" className={variant === item ? 'active' : ''} onClick={() => setVariant(item)}>{value.trim() && <Check size={11} />} {item}</button> })}</div>{suggestions && <div className="translation-suggestions"><span>Suggestions from this project</span>{suggestions.length ? suggestions.map(value => <button className="secondary-button" key={value} onClick={() => changeTarget(value)}>{value}</button>) : <small>No matching translated strings.</small>}</div>}</div></div></article>
}
function HighlightedEditor({ value, onChange, search, highlight }: { value: string; search?: SearchOptions; highlight: 'underline' | 'select' | 'off'; onChange: (value: string) => void }): React.JSX.Element {
  const highlightRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    editor.style.height = 'auto'
    editor.style.height = `${editor.scrollHeight}px`
  }, [draft])
  function commit(): void { if (draft !== value) onChange(draft) }
  function syncScroll(event: React.UIEvent<HTMLTextAreaElement>): void {
    if (highlightRef.current) {
      highlightRef.current.scrollTop = event.currentTarget.scrollTop
      highlightRef.current.scrollLeft = event.currentTarget.scrollLeft
    }
  }
  return <div className="translation-editor"><div ref={highlightRef} className="editor-highlight" aria-hidden="true"><LarianText value={draft || ' '} search={search} highlight={highlight} /></div><textarea ref={editorRef} className="editor-input" value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); commit() } }} onScroll={syncScroll} placeholder="Translation..." rows={2} /></div>
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

function LarianText({ value, search, highlight = 'off' }: { value: string; search?: SearchOptions; highlight?: 'underline' | 'select' | 'off' }): React.JSX.Element {
  const decoded = decodeHtmlEntities(value)
  const parts = decoded.split(/(<\/?(?:LSTag|LSTagValue)\b[^>]*>)/gi)
  return <>{parts.map((part, index) => /<\/?(?:LSTag|LSTagValue)\b[^>]*>/i.test(part) ? <span className="larian-tag" key={`${part}-${index}`}>{part}</span> : <span key={`${part}-${index}`}>{search && highlight !== 'off' ? <SearchText text={part} search={search} mode={highlight} /> : part}</span>)}</>
}

function SearchText({ text, search, mode }: { text: string; search: SearchOptions; mode: 'underline' | 'select' }): React.JSX.Element {
  const ranges = matchRanges(text, search)
  const parts: React.ReactNode[] = []
  let offset = 0
  for (const [start, end] of ranges) { parts.push(text.slice(offset, start)); parts.push(<mark className={mode === 'underline' ? 'search-match underline' : 'search-match'} key={start}>{text.slice(start, end)}</mark>); offset = end }
  parts.push(text.slice(offset))
  return <>{parts}</>
}
