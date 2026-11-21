import { useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowLeftToLine, ArrowRightToLine, CaseSensitive, Equal, Hash, ScanSearch, Search, SlidersHorizontal, WholeWord, X } from 'lucide-react'
import type { TranslationSessionEntry } from '@/context/TranslationSession'
import { ModalShell } from './ModalShell'

export function QuickSearchModal({
  open,
  initialQuery,
  entries,
  onClose
}: {
  open: boolean
  initialQuery: string
  entries: TranslationSessionEntry[]
  onClose: () => void
}): React.JSX.Element | null {
  const [query, setQuery] = useState('')
  const [matchCase, setMatchCase] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [exactMatch, setExactMatch] = useState(false)
  const [startsWith, setStartsWith] = useState(false)
  const [endsWith, setEndsWith] = useState(false)
  const [showContentId, setShowContentId] = useState(false)
  const [toolbarOpen, setToolbarOpen] = useState(false)
  const [ready, setReady] = useState(false)
  const [resultIds, setResultIds] = useState<string[]>([])
  const workerRef = useRef<Worker | null>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const optionsMenuRef = useRef<HTMLDivElement>(null)
  const optionsTriggerRef = useRef<HTMLButtonElement>(null)
  const entriesById = useMemo(() => new Map(entries.map((entry) => [entry.rowId, entry] as const)), [entries])

  useEffect(() => {
    if (!open) return
    setQuery(initialQuery)
    setMatchCase(false)
    setWholeWord(false)
    setExactMatch(false)
    setStartsWith(false)
    setEndsWith(false)
    setShowContentId(false)
    setToolbarOpen(false)
  }, [initialQuery, open])

  useEffect(() => {
    if (!open) return
    const worker = new Worker(new URL('./quickSearch.worker.ts', import.meta.url), { type: 'module' })
    workerRef.current = worker
    worker.onmessage = (event: MessageEvent<{ type: 'ready' } | { type: 'results'; rowIds: string[] }>) => {
      if (event.data.type === 'ready') setReady(true)
      else setResultIds(event.data.rowIds)
    }
    worker.postMessage({
      type: 'index',
      rows: entries.map(({ rowId, uid, source, target }) => ({ rowId, uid, source, target }))
    })
    return () => {
      worker.terminate()
      if (workerRef.current === worker) workerRef.current = null
      setReady(false)
      setResultIds([])
    }
  }, [entries, open])

  useEffect(() => {
    if (!open || !ready) return
    const timeout = window.setTimeout(() => {
      workerRef.current?.postMessage({ type: 'search', query, matchCase, wholeWord, exactMatch, startsWith, endsWith })
    }, 70)
    return () => window.clearTimeout(timeout)
  }, [endsWith, exactMatch, matchCase, open, query, ready, startsWith, wholeWord])

  useEffect(() => {
    if (!toolbarOpen) return
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (optionsMenuRef.current?.contains(target) || optionsTriggerRef.current?.contains(target)) return
      setToolbarOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer)
  }, [toolbarOpen])

  const results = useMemo(
    () => resultIds.flatMap((id) => {
      const entry = entriesById.get(id)
      return entry ? [entry] : []
    }),
    [entriesById, resultIds]
  )
  const virtualizer = useVirtualizer({
    count: results.length,
    getScrollElement: () => resultsRef.current,
    estimateSize: () => 76,
    getItemKey: (index) => results[index]!.rowId,
    overscan: 7
  })

  if (!open) return null
  return (
    <ModalShell
      open
      title="Quick search"
      description="Search matching EN–RO entries from the loaded source."
      sizeClassName="max-w-3xl"
      panelClassName="game-data-source-modal flex max-h-[min(720px,90vh)] flex-col"
      headerClassName="items-center"
      iconClassName="mt-0"
      descriptionClassName="mt-0"
      contentClassName="px-5 pb-4 pt-4"
      icon={<ScanSearch size={21} />}
      onClose={onClose}
    >
      <div className="flex min-h-0 flex-col gap-3">
        <div className="relative shrink-0">
          <div className="game-data-source-search quick-search-search-shell relative flex h-10 w-full items-center rounded-lg border border-[#34343e] bg-[#101010] px-3 transition">
            <Search className="mr-2 shrink-0 text-neutral-500" size={16} />
            <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search source, translation or ID..." aria-label="Search source, translation or ID" className="quick-search-input min-w-0 flex-1 bg-transparent text-sm text-neutral-100 placeholder:text-neutral-600" />
            <span aria-label={`${results.length.toLocaleString()} matching entries`} className="mr-1 shrink-0 rounded-full bg-[#181b1f] px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-neutral-500">{results.length.toLocaleString()}</span>
            {query && <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => setQuery('')} aria-label="Clear search" className="quick-search-clear mr-3 shrink-0 cursor-pointer text-neutral-500"><X size={14} /></button>}
            <div className="flex shrink-0 items-center gap-2 border-l border-[#2a2c34] pl-2">
              <button type="button" aria-label="Match case" aria-pressed={matchCase} onClick={() => setMatchCase((value) => !value)} className={`quick-search-field-toggle cursor-pointer ${matchCase ? 'text-[var(--poly-accent)]' : 'text-neutral-500'}`}><CaseSensitive size={15} /></button>
              <button type="button" aria-label="Whole word" aria-pressed={wholeWord} onClick={() => setWholeWord((value) => !value)} className={`quick-search-field-toggle cursor-pointer ${wholeWord ? 'text-[var(--poly-accent)]' : 'text-neutral-500'}`}><WholeWord size={14} /></button>
              <span className="mx-0.5 h-5 border-l border-[#2a2c34]" />
              <button ref={optionsTriggerRef} type="button" aria-label="Search options" aria-expanded={toolbarOpen} onClick={() => setToolbarOpen((value) => !value)} className={`quick-search-options-trigger cursor-pointer ${toolbarOpen ? 'text-[var(--poly-accent)]' : 'text-neutral-500'}`}><SlidersHorizontal size={15} /></button>
            </div>
            {toolbarOpen && (
              <div ref={optionsMenuRef} className="quick-search-options-menu absolute right-0 top-[calc(100%+8px)] z-50 flex w-fit items-center gap-1 overflow-hidden rounded-lg border border-neutral-600 bg-[#131518] p-1 shadow-2xl">
                <SearchOption label="Exact match" active={exactMatch} onClick={() => { setExactMatch((value) => !value); setStartsWith(false); setEndsWith(false) }}><Equal size={15} /></SearchOption>
                <SearchOption label="Starts with" active={startsWith} onClick={() => { setStartsWith((value) => !value); setExactMatch(false); setEndsWith(false) }}><ArrowRightToLine size={14} /></SearchOption>
                <SearchOption label="Ends with" active={endsWith} onClick={() => { setEndsWith((value) => !value); setExactMatch(false); setStartsWith(false) }}><ArrowLeftToLine size={14} /></SearchOption>
                <SearchOption label="Show content ID" active={showContentId} onClick={() => setShowContentId((value) => !value)}><Hash size={14} /></SearchOption>
              </div>
            )}
          </div>
        </div>

        <div ref={resultsRef} className="game-data-source-results polyhedron-scroll max-h-[min(52vh,500px)] overflow-y-auto rounded-xl">
          {!query.trim() ? (
            <p className="px-3 py-3 text-center text-sm text-neutral-500">Select text and right-click to search.</p>
          ) : !ready ? (
            <p className="px-3 py-3 text-center text-sm text-neutral-500">Preparing search…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-3 text-center text-sm text-neutral-500">No matching entries.</p>
          ) : (
            <div className="game-data-source-result-list relative w-full" style={{ height: virtualizer.getTotalSize() + Math.max(0, results.length - 1) * 8 }}>
              {virtualizer.getVirtualItems().map((item) => {
                const entry = results[item.index]!
                return (
                  <div
                    key={item.key}
                    ref={virtualizer.measureElement}
                    data-index={item.index}
                    className="game-data-source-result quick-search-result flex w-full select-text flex-col items-start gap-1 rounded-xl border border-[#2c2e37] bg-[#1b1c21] px-3 py-2.5 text-left"
                    style={{ position: 'absolute', top: 0, left: 0, transform: `translateY(${item.start + item.index * 8}px)` }}
                  >
                    <span className="w-full break-words text-sm font-medium text-neutral-100">{entry.source || '(empty source)'}</span>
                    <span className="w-full break-words text-sm text-[var(--poly-accent)]">{entry.target || '(untranslated)'}</span>
                    {showContentId && <span className="break-all font-mono text-[11px] text-neutral-500">{entry.uid}</span>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  )
}

function SearchOption({ label, active, onClick, children }: { label: string; active: boolean; onClick: () => void; children: React.ReactNode }): React.JSX.Element {
  return <button type="button" aria-label={label} aria-pressed={active} onClick={onClick} className={`quick-search-option inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors ${active ? 'bg-amber-400/10 text-amber-400' : 'text-neutral-500 hover:bg-transparent hover:text-amber-400'}`}>
    {children}
  </button>
}
