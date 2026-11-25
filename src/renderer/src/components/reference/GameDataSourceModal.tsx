import { useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowLeftToLine, ArrowRightToLine, CaseSensitive, Check, Equal, Hash, Link2, Search, SlidersHorizontal, WholeWord, X } from 'lucide-react'
import { ModalShell } from '@/components/shared/ModalShell'
import type { TranslationSessionEntry } from '@/context/TranslationSession'

export function GameDataSourceModal({ open, title, description, sourceEntries, initialUid, onClose, onSubmit }: {
  open: boolean
  title: string
  description: string
  sourceEntries: TranslationSessionEntry[]
  initialUid?: string
  onClose: () => void
  onSubmit: (uid: string) => void
}): React.JSX.Element | null {
  const [query, setQuery] = useState('')
  const [selectedUid, setSelectedUid] = useState('')
  const [matchCase, setMatchCase] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [exactMatch, setExactMatch] = useState(false)
  const [startsWith, setStartsWith] = useState(false)
  const [endsWith, setEndsWith] = useState(false)
  const [showContentId, setShowContentId] = useState(false)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [workerReady, setWorkerReady] = useState(false)
  const [resultRowIds, setResultRowIds] = useState<string[]>([])
  const workerRef = useRef<Worker | null>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const optionsMenuRef = useRef<HTMLDivElement>(null)
  const optionsTriggerRef = useRef<HTMLButtonElement>(null)
  const rowsById = useMemo(() => new Map(sourceEntries.map((entry) => [entry.rowId, entry] as const)), [sourceEntries])
  useEffect(() => {
    if (!open) return
    const initialEntry = sourceEntries.find((entry) => entry.uid === initialUid)
    setQuery(initialEntry?.source ?? '')
    setSelectedUid(initialEntry?.uid ?? '')
    setMatchCase(false)
    setWholeWord(false)
    setExactMatch(false)
    setStartsWith(false)
    setEndsWith(false)
    setShowContentId(false)
    setOptionsOpen(false)
  }, [initialUid, open, sourceEntries])
  useEffect(() => {
    if (!open || workerRef.current) return
    const worker = new Worker(new URL('./gameDataSourceSearch.worker.ts', import.meta.url), { type: 'module' })
    workerRef.current = worker
    worker.onmessage = (event: MessageEvent<{ type: 'ready' } | { type: 'results'; rowIds: string[] }>) => {
      if (event.data.type === 'ready') setWorkerReady(true)
      else setResultRowIds(event.data.rowIds)
    }
    worker.postMessage({
      type: 'index',
      rows: sourceEntries.map(({ rowId, uid, source }) => ({ rowId, uid, source }))
    })
  }, [open, sourceEntries])
  useEffect(() => () => workerRef.current?.terminate(), [])
  useEffect(() => {
    if (!open || !workerReady) return
    const timeout = window.setTimeout(() => {
      workerRef.current?.postMessage({ type: 'search', query, matchCase, wholeWord, exactMatch, startsWith, endsWith, selectedUid })
    }, 100)
    return () => window.clearTimeout(timeout)
  }, [endsWith, exactMatch, matchCase, open, query, selectedUid, startsWith, wholeWord, workerReady])
  useEffect(() => {
    if (!optionsOpen) return
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (optionsMenuRef.current?.contains(target) || optionsTriggerRef.current?.contains(target)) return
      setOptionsOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer)
  }, [optionsOpen])
  const filtered = useMemo(() => {
    return resultRowIds.flatMap((rowId) => {
      const row = rowsById.get(rowId)
      return row ? [row] : []
    })
  }, [resultRowIds, rowsById])
  const initialEntry = useMemo(
    () => sourceEntries.find((entry) => entry.uid === initialUid),
    [initialUid, sourceEntries]
  )
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => resultsRef.current,
    estimateSize: () => 76,
    getItemKey: (index) => filtered[index]!.rowId,
    overscan: 8
  })
  if (!open) return null
  return <ModalShell open title={title} description={description} sizeClassName="max-w-3xl" panelClassName="game-data-source-modal flex max-h-[min(720px,90vh)] flex-col" headerClassName="items-center" iconClassName="mt-0" descriptionClassName="mt-0" icon={<Link2 size={21} />} onClose={onClose}>
    <div className="flex min-h-0 flex-col gap-3">
      {initialEntry && <div className="shrink-0 rounded-lg border border-[var(--poly-accent)]/25 bg-[var(--poly-accent)]/5 px-3 py-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--poly-accent)]">Currently associated</div>
        <div className="mt-1 break-words text-sm text-neutral-100">{initialEntry.source || '(empty source)'}</div>
        <div className="mt-1 break-all font-mono text-[10px] text-neutral-500">{initialEntry.uid}</div>
      </div>}
      <div className="relative shrink-0">
        <div className="game-data-source-search quick-search-search-shell relative flex h-10 w-full items-center rounded-lg border border-[#34343e] bg-[#101010] px-3 transition">
          <Search className="mr-2 shrink-0 text-neutral-500" size={16} />
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search source text or ID..." aria-label="Search source text or ID" className="quick-search-input min-w-0 flex-1 bg-transparent text-sm text-neutral-100 placeholder:text-neutral-600" />
          <span aria-label={`${filtered.length.toLocaleString()} matching entries`} className="mr-1 shrink-0 rounded-full bg-[#181b1f] px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-neutral-500">{filtered.length.toLocaleString()}</span>
          {query && <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => setQuery('')} aria-label="Clear search" className="quick-search-clear mr-3 shrink-0 cursor-pointer text-neutral-500"><X size={14}/></button>}
          <div className="flex shrink-0 items-center gap-2 border-l border-[#2a2c34] pl-2">
            <button type="button" aria-label="Match case" aria-pressed={matchCase} onClick={() => setMatchCase((value) => !value)} className={`quick-search-field-toggle cursor-pointer ${matchCase ? 'text-[var(--poly-accent)]' : 'text-neutral-500'}`}><CaseSensitive size={15}/></button>
            <button type="button" aria-label="Whole word" aria-pressed={wholeWord} onClick={() => setWholeWord((value) => !value)} className={`quick-search-field-toggle cursor-pointer ${wholeWord ? 'text-[var(--poly-accent)]' : 'text-neutral-500'}`}><WholeWord size={14}/></button>
            <span className="mx-0.5 h-5 border-l border-[#2a2c34]" />
            <button ref={optionsTriggerRef} type="button" aria-label="Search options" aria-expanded={optionsOpen} onClick={() => setOptionsOpen((value) => !value)} className={`quick-search-options-trigger cursor-pointer ${optionsOpen ? 'text-[var(--poly-accent)]' : 'text-neutral-500'}`}><SlidersHorizontal size={15}/></button>
          </div>
          {optionsOpen && <div ref={optionsMenuRef} className="quick-search-options-menu absolute right-0 top-[calc(100%+8px)] z-50 flex w-fit items-center gap-1 overflow-hidden rounded-lg border border-neutral-600 bg-[#131518] p-1 shadow-2xl">
            <SearchOption label="Exact match" active={exactMatch} onClick={() => { setExactMatch((value) => !value); setStartsWith(false); setEndsWith(false) }}><Equal size={15}/></SearchOption>
            <SearchOption label="Starts with" active={startsWith} onClick={() => { setStartsWith((value) => !value); setExactMatch(false); setEndsWith(false) }}><ArrowRightToLine size={14}/></SearchOption>
            <SearchOption label="Ends with" active={endsWith} onClick={() => { setEndsWith((value) => !value); setExactMatch(false); setStartsWith(false) }}><ArrowLeftToLine size={14}/></SearchOption>
            <SearchOption label="Show content ID" active={showContentId} onClick={() => setShowContentId((value) => !value)}><Hash size={14}/></SearchOption>
          </div>}
        </div>
      </div>
      <div ref={resultsRef} className="game-data-source-results polyhedron-scroll max-h-[min(52vh,500px)] overflow-y-auto rounded-xl">
        {!query.trim() ? (
          <p className="px-3 py-3 text-center text-sm text-neutral-500">Type to search the loaded Source entries.</p>
        ) : !workerReady ? (
          <p className="px-3 py-3 text-center text-sm text-neutral-500">Preparing Source search…</p>
        ) : !filtered.length ? (
          <p className="px-3 py-3 text-center text-sm text-neutral-500">No matching Source entries.</p>
        ) : (
          <div className="game-data-source-result-list relative w-full" style={{ height: virtualizer.getTotalSize() + Math.max(0, filtered.length - 1) * 8 }}>
            {virtualizer.getVirtualItems().map((item) => {
              const entry = filtered[item.index]!
              const selected = selectedUid === entry.uid
              return <div key={item.key} ref={virtualizer.measureElement} data-index={item.index} role="radio" aria-checked={selected} tabIndex={0} onClick={() => setSelectedUid(entry.uid)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedUid(entry.uid) } }} className={`game-data-source-result flex w-full cursor-pointer items-center gap-3 rounded-xl border border-[#2c2e37] bg-[#1b1c21] px-3 py-2.5 text-left outline-none focus:outline-none ${selected ? 'is-selected' : ''}`} style={{ position: 'absolute', top: 0, left: 0, transform: `translateY(${item.start + item.index * 8}px)` }}><span className={`h-3 w-3 shrink-0 rounded-full border ${selected ? 'border-[var(--poly-accent)] bg-[var(--poly-accent)]' : 'border-neutral-600'}`} /><span className="min-w-0 flex-1 text-sm"><span className="font-medium text-neutral-100">{entry.source || '(empty source)'}</span>{showContentId && <span className="mt-1 block break-all font-mono text-[11px] text-neutral-500">{entry.uid}</span>}</span></div>
            })}
          </div>
        )}
      </div>
      <div className="flex shrink-0 justify-end">
        <button type="button" disabled={!selectedUid} onClick={() => onSubmit(selectedUid)} className="accent-solid-control inline-flex h-10 items-center gap-1.5 rounded-lg border border-[var(--poly-accent)] bg-[var(--poly-accent)] px-4 text-sm font-semibold disabled:opacity-40"><Check size={15}/>Select</button>
      </div>
    </div>
  </ModalShell>
}

function SearchOption({ label, active, onClick, children }: { label: string; active: boolean; onClick: () => void; children: React.ReactNode }): React.JSX.Element {
  return <button type="button" aria-label={label} aria-pressed={active} onClick={onClick} className={`quick-search-option inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors ${active ? 'bg-amber-400/10 text-amber-400' : 'text-neutral-500'}`}>
    {children}
  </button>
}
