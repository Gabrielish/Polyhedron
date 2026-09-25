import {
  Search,
  ExternalLink,
  Swords,
  Shield,
  FlaskConical,
  Sparkles,
  BookOpen,
  Copy,
  ClipboardPaste,
  Eye,
  History,
  Flag,
  CircleDashed,
  CircleX,
  CircleAlert,
  CircleCheck,
  BookText
} from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  getReferenceCatalog,
  type ReferenceCatalogEntry,
  type ReferenceCategory
} from '@/data/gameReference'
import {
  type ReviewStatus,
  type TranslationSessionEntry,
  useTranslationSession
} from '@/context/TranslationSession'
import { SessionSaveButton } from '@/features/translate/components/SessionSaveButton'
import { TermGlossaryModal } from '@/features/translate/components/TermGlossaryModal'
import {
  getTermGlossaryStorageKey,
  loadTermGlossary,
  type TermGlossaryEntry
} from '@/utils/termGlossary'
import { btnGhostIcon } from '@/features/translate/components/styles'
import { AITranslateModal } from '@/components/translation/AITranslateModal'
import { SimilarityExamplesModal } from '@/components/translation/SimilarityExamplesModal'
import { TranslationHistoryDialog } from '@/components/translation/TranslationHistoryDialog'
import { cn } from '@/lib/utils'
import { renderSource } from '@/utils/renderSource'
import { HighlightedTextarea } from '@/components/shared/HighlightedTextarea'
const CATEGORIES: Array<{ label: string; value?: ReferenceCategory }> = [
  { label: 'All' },
  { label: 'Weapons', value: 'Weapon' },
  { label: 'Armour', value: 'Armour' },
  { label: 'Objects', value: 'Object' },
  { label: 'Spells', value: 'Spell' },
  { label: 'Passives', value: 'Passive' },
  { label: 'Statuses', value: 'Status' },
  { label: 'Interrupts', value: 'Interrupt' }
]
function iconFor(category: string): typeof Swords {
  if (category === 'Armour') return Shield
  if (category === 'Spell' || category === 'Status') return Sparkles
  if (category === 'Object') return FlaskConical
  if (category === 'Passive') return BookOpen
  return Swords
}
function wikiPath(category: ReferenceCategory, name?: string): string {
  const names: Record<ReferenceCategory, string> = {
    Weapon: 'Weapons',
    Armour: 'Armour',
    Object: 'Objects',
    Passive: 'Passives',
    Spell: 'Spells',
    Status: 'Statuses',
    Interrupt: 'Interrupts'
  }
  return name
    ? `/wiki/${encodeURIComponent(name.trim().replace(/\s+/g, '_'))}`
    : `/wiki/${names[category]}`
}
function normalize(value: string): string {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase()
}
function LocalTranslationInput({
  value,
  onCommit
}: {
  value: string
  onCommit: (value: string) => void
}): React.JSX.Element {
  if (!/<\/?LSTag\b/i.test(value))
    return (
      <textarea
        defaultValue={value}
        onBlur={(event) => {
          if (event.currentTarget.value !== value) onCommit(event.currentTarget.value)
        }}
        rows={2}
        placeholder="Translate here..."
        className="min-h-16 w-full resize-y rounded border border-[#2a2f37] bg-[#131518] px-3 py-2 text-xs leading-5 text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-amber-500/60"
      />
    )
  return (
    <HighlightedTextarea
      value={value}
      rows={2}
      placeholder="Translate here..."
      onBlur={(event) => {
        if (event.currentTarget.value !== value) onCommit(event.currentTarget.value)
      }}
      containerClassName="min-h-16 rounded border-[#2a2f37]"
      className="min-h-16 resize-y text-xs leading-5"
    />
  )
}
function GameDataSearch({ onSearch }: { onSearch: (value: string) => void }): React.JSX.Element {
  const [draft, setDraft] = useState('')
  const submit = () => onSearch(draft)
  return (
    <div className="mb-2 flex items-center gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-2 rounded border border-[#2a2f37] bg-[#131518] px-2 py-1.5">
        <Search size={14} className="text-neutral-600" />
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit()
          }}
          placeholder="Type then press Enter..."
          className="w-full bg-transparent text-xs outline-none placeholder:text-neutral-600"
        />
        <button
          type="button"
          onClick={submit}
          className="shrink-0 rounded bg-amber-500/10 px-2 py-1 text-[10px] text-amber-300 hover:bg-amber-500/20"
        >
          Search
        </button>
      </div>
    </div>
  )
}
function entryReviewStatus(entry: TranslationSessionEntry): ReviewStatus {
  return !entry.target.trim() ? 'untranslated' : (entry.reviewStatus ?? 'needs-review')
}
const reviewStatusOptions: Array<{
  value: ReviewStatus
  title: string
  icon: typeof CircleX
  active: string
  idle: string
}> = [
  {
    value: 'untranslated',
    title: 'Untranslated',
    icon: CircleDashed,
    active: 'border-neutral-400/60 bg-neutral-500/15 text-neutral-200',
    idle: 'border-neutral-500/30 text-neutral-400/70 hover:bg-neutral-500/10'
  },
  {
    value: 'not-verified',
    title: 'Not verified',
    icon: CircleX,
    active: 'border-red-400/60 bg-red-500/15 text-red-300',
    idle: 'border-red-500/25 text-red-400/70 hover:bg-red-500/10'
  },
  {
    value: 'needs-review',
    title: 'Needs review',
    icon: CircleAlert,
    active: 'border-yellow-400/60 bg-yellow-500/15 text-yellow-300',
    idle: 'border-yellow-500/25 text-yellow-400/70 hover:bg-yellow-500/10'
  },
  {
    value: 'verified',
    title: 'Verified',
    icon: CircleCheck,
    active: 'border-emerald-400/60 bg-emerald-500/15 text-emerald-300',
    idle: 'border-emerald-500/25 text-emerald-400/70 hover:bg-emerald-500/10'
  }
]
function TranslationField({
  label,
  source: sourceText,
  entries,
  targetLang,
  update,
  copy,
  paste,
  showContentUid,
  onGemini,
  onSimilarity,
  onHistory,
  toggleNeedsReview,
  setReviewStatus,
  termGlossary
}: {
  label: string
  source: string
  entries: TranslationSessionEntry[]
  showContentUid: boolean
  targetLang: string
  update: (rowId: string, value: string) => void
  copy: () => void
  paste: (rowId: string) => void
  onGemini: (entry: TranslationSessionEntry) => void
  onSimilarity: (entry: TranslationSessionEntry) => void
  onHistory: (entry: TranslationSessionEntry) => void
  toggleNeedsReview: (rowId: string) => void
  setReviewStatus: (rowId: string, status: ReviewStatus) => void
  termGlossary: TermGlossaryEntry[]
}): React.JSX.Element {
  const source = entries[0]?.source ?? sourceText
  const reveal = (uid: string) => {
    window.sessionStorage.setItem('polyhedron:reveal-uid', uid)
    window.location.hash = '#/translate'
  }
  return (
    <div className="mt-3 rounded border border-[#1f2329] bg-[#0c0d0f] p-2">
      <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-500/70">
        {label} · {targetLang}
        <button
          type="button"
          onClick={copy}
          title="Copy source"
          className="ml-1 rounded px-1 text-neutral-400 hover:bg-[#1c1f24]"
        >
          <Copy size={11} />
        </button>
      </div>
      <div className="translation-source-text mb-2 whitespace-pre-wrap text-xs leading-5 text-neutral-200">
        {renderSource(source, { termGlossary })}
      </div>
      {entries.length === 0 ? (
        <div className="text-[11px] italic text-neutral-600">
          This text is not present in the loaded XML.
        </div>
      ) : (
        entries.map((entry, index) => (
          <div key={entry.rowId} className="mb-2 last:mb-0">
            <div className="mb-1 flex flex-wrap items-center gap-1 text-[9px] text-neutral-600">
              <span className="mr-1 text-amber-500/80">
                Occurrence {index + 1}
                {entries.length > 1 ? ` of ${entries.length}` : ''}
                {showContentUid ? ` · ${entry.uid}` : ''}
              </span>
              <span className="mx-1 h-4 border-l border-[#2a2f37]" aria-hidden="true" />
              <button
                type="button"
                onClick={() => paste(entry.rowId)}
                title="Paste translation"
                className="rounded px-1 text-amber-300 hover:bg-amber-500/10"
              >
                <ClipboardPaste size={11} />
              </button>
              <button
                type="button"
                onClick={() => reveal(entry.uid)}
                title="Reveal in Translate"
                className="rounded px-1 text-amber-300 hover:bg-amber-500/10"
              >
                <Eye size={11} />
              </button>
              <span className="mx-1 h-4 border-l border-[#2a2f37]" aria-hidden="true" />
              <button
                type="button"
                onClick={() => onGemini(entry)}
                title="Translate with Gemini"
                aria-label="Translate with Gemini"
                className="inline-flex h-6 w-6 items-center justify-center rounded border border-[#1f2329] bg-[#131518] text-neutral-300 hover:border-amber-500/60 hover:text-amber-400"
              >
                <Sparkles size={13} />
              </button>
              <button
                type="button"
                onClick={() => onSimilarity(entry)}
                title="Show similarity examples"
                aria-label="Show similarity examples"
                className="inline-flex h-6 w-6 items-center justify-center rounded border border-[#1f2329] bg-[#131518] text-neutral-300 hover:border-amber-500/60 hover:text-amber-300"
              >
                <BookOpen size={13} />
              </button>
              <button
                type="button"
                onClick={() => onHistory(entry)}
                title="History of changes"
                aria-label="History of changes"
                className="rounded px-1 text-amber-300 hover:bg-amber-500/10"
              >
                <History size={11} />
              </button>
              <button
                type="button"
                onClick={() => toggleNeedsReview(entry.rowId)}
                title="Needs review"
                aria-label="Needs review"
                className={cn(
                  'inline-flex h-6 w-6 items-center justify-center rounded border transition-colors',
                  entry.needsReview
                    ? 'border-rose-400/40 bg-rose-500/15 text-rose-300'
                    : 'border-[#1f2329] bg-[#131518] text-neutral-500 hover:border-rose-400/40 hover:text-rose-300'
                )}
              >
                <Flag size={12} />
              </button>
              <span className="mx-1 h-4 border-l border-[#2a2f37]" aria-hidden="true" />
              {reviewStatusOptions.map((option) => {
                const Icon = option.icon
                return (
                  <button
                    key={option.value}
                    type="button"
                    title={option.title}
                    aria-label={`${option.title} translation`}
                    onClick={() => setReviewStatus(entry.rowId, option.value)}
                    className={cn(
                      'inline-flex h-6 w-6 items-center justify-center rounded border transition-colors',
                      entryReviewStatus(entry) === option.value ? option.active : option.idle
                    )}
                  >
                    <Icon size={13} />
                  </button>
                )
              })}
            </div>
            <LocalTranslationInput
              value={entry.target}
              onCommit={(value) => update(entry.rowId, value)}
            />
          </div>
        ))
      )}
    </div>
  )
}
function GameDataList({
  entries,
  current,
  onSelect
}: {
  entries: ReferenceCatalogEntry[]
  current: ReferenceCatalogEntry | null
  onSelect: (entry: ReferenceCatalogEntry) => void
}): React.JSX.Element {
  const parentRef = useRef<HTMLDivElement>(null)
  const session = useTranslationSession()
  const rowsBySource = useMemo(() => {
    const result = new Map<string, TranslationSessionEntry[]>()
    for (const row of session.entries) {
      const key = normalize(row.source)
      const rows = result.get(key)
      if (rows) rows.push(row)
      else result.set(key, [row])
    }
    return result
  }, [session.entries])
  const translatedKeys = useMemo(() => {
    const result = new Set<string>()
    for (const item of getReferenceCatalog()) {
      const titleRows = rowsBySource.get(normalize(item.name)) ?? []
      const descriptionRows = rowsBySource.get(normalize(item.description)) ?? []
      if (
        titleRows.some((row) => row.target.trim()) &&
        descriptionRows.some((row) => row.target.trim())
      )
        result.add(`${item.category}:${item.name}`)
    }
    return result
  }, [rowsBySource])
  const verifiedKeys = useMemo(() => {
    const result = new Set<string>()
    for (const item of getReferenceCatalog()) {
      const titleRows = rowsBySource.get(normalize(item.name)) ?? []
      const descriptionRows = rowsBySource.get(normalize(item.description)) ?? []
      const rows = [...titleRows, ...descriptionRows]
      if (
        rows.length > 0 &&
        rows.every((row) => row.target.trim() && row.reviewStatus === 'verified')
      ) {
        result.add(`${item.category}:${item.name}`)
      }
    }
    return result
  }, [rowsBySource])
  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 42,
    overscan: 12
  })
  return (
    <div ref={parentRef} className="polyhedron-scroll min-h-0 flex-1 overflow-y-auto">
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => {
          const entry = entries[item.index]
          const ItemIcon = iconFor(entry.category)
          const key = `${entry.category}:${entry.name}`
          const translated = translatedKeys.has(key)
          const verified = verifiedKeys.has(key)
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(entry)}
              className={cn(
                'absolute left-0 flex w-full items-start gap-2 rounded px-2 py-2 text-left',
                current?.name === entry.name && current?.category === entry.category
                  ? 'bg-amber-500/10 text-amber-200'
                  : 'text-neutral-400 hover:bg-[#131518]'
              )}
              style={{ transform: `translateY(${item.start}px)` }}
            >
              <ItemIcon size={14} className="mt-0.5 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 truncate text-xs">
                  {entry.name}
                  {translated && (
                    <span className="shrink-0 rounded border border-orange-400/30 bg-orange-500/10 px-1 py-0.5 text-[9px] text-orange-300">
                      Translated
                    </span>
                  )}
                  {verified && (
                    <span className="shrink-0 rounded border border-emerald-500/30 bg-emerald-500/10 px-1 py-0.5 text-[9px] text-emerald-300">
                      Verified
                    </span>
                  )}
                </span>
                <span className="block truncate text-[10px] text-neutral-600">
                  {entry.category}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
export function ReferencePage(): React.JSX.Element {
  const session = useTranslationSession()
  const [searchParams] = useSearchParams()
  const [category, setCategory] = useState<ReferenceCategory | undefined>()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<ReferenceCatalogEntry | null>(null)
  const [showContentUid, setShowContentUid] = useState(false)
  const [aiEntry, setAiEntry] = useState<TranslationSessionEntry | null>(null)
  const [similarityEntry, setSimilarityEntry] = useState<TranslationSessionEntry | null>(null)
  const [historyEntry, setHistoryEntry] = useState<TranslationSessionEntry | null>(null)
  const [termGlossaryOpen, setTermGlossaryOpen] = useState(false)
  const termGlossaryProjectKey = session.storedPath ?? session.inputPath ?? session.modName ?? 'current'
  const termGlossaryKey = getTermGlossaryStorageKey(
    termGlossaryProjectKey,
    session.sourceLang,
    session.targetLang
  )
  const [termGlossary, setTermGlossary] = useState<TermGlossaryEntry[]>(() =>
    loadTermGlossary(termGlossaryKey)
  )
  useEffect(() => {
    try {
      window.localStorage.setItem(termGlossaryKey, JSON.stringify(termGlossary))
    } catch {
      // The glossary remains available for the current session if storage is unavailable.
    }
  }, [termGlossary, termGlossaryKey])
  useEffect(() => {
    if (session.phase !== 'loaded') return
    const spellName = searchParams.get('spell')?.trim()
    if (!spellName) return
    const spellCatalog = getReferenceCatalog('Spell')
    const normalizedSpellName = normalize(spellName)
    const spell =
      spellCatalog.find((entry) => normalize(entry.name) === normalizedSpellName) ??
      spellCatalog.find((entry) => normalize(entry.name).includes(normalizedSpellName))
    if (spell) {
      setCategory('Spell')
      setSelected(spell)
      setQuery('')
    }
  }, [searchParams, session.phase])
  if (session.phase !== 'loaded')
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div className="rounded-xl border border-[#1f2329] bg-[#131518] p-8">
          <Swords className="mx-auto mb-3" style={{ color: 'var(--poly-accent)' }} size={28} />
          <h1 className="mb-2 text-lg font-semibold text-neutral-100">Game Data</h1>
          <p className="text-sm text-neutral-500">Load a localization XML in Translate first.</p>
        </div>
      </div>
    )
  const allEntries = useMemo(
    () =>
      getReferenceCatalog(category).filter(
        (entry) =>
          !entry.name.trim().startsWith('%%%') &&
          !entry.description.trim().startsWith('%%%') &&
          !/\|[^|\n]{1,120}\|/.test(entry.name) &&
          !/\|[^|\n]{1,120}\|/.test(entry.description)
      ),
    [category]
  )
  const uidBySource = useMemo(() => {
    const map = new Map<string, string>()
    for (const row of session.entries) {
      const key = normalize(row.source)
      map.set(key, `${map.get(key) ?? ''} ${row.uid}`)
    }
    return map
  }, [session.entries])
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase()
    return q
      ? allEntries.filter((entry) =>
          `${entry.name} ${entry.description} ${uidBySource.get(normalize(entry.name)) ?? ''} ${uidBySource.get(normalize(entry.description)) ?? ''}`
            .toLocaleLowerCase()
            .includes(q)
        )
      : allEntries
  }, [allEntries, query, uidBySource])
  const requestedSpell = searchParams.get('spell')?.trim()
  const requestedEntry = requestedSpell
    ? getReferenceCatalog('Spell').find(
        (entry) => normalize(entry.name) === normalize(requestedSpell)
      ) ?? null
    : null
  const current =
    requestedEntry ??
    (selected && (!category || selected.category === category) ? selected : (filtered[0] ?? null))
  const linkedTitle = current
    ? session.entries.filter((entry) => normalize(entry.source) === normalize(current.name))
    : []
  const linkedDescription = current
    ? session.entries.filter((entry) => normalize(entry.source) === normalize(current.description))
    : []
  const Icon = iconFor(current?.category ?? category ?? 'Weapon')
  const wikiUrl = current
    ? `https://bg3.wiki${wikiPath(current.category, current.name)}`
    : 'https://bg3.wiki/wiki/Weapons'
  const update = (rowId: string, value: string) => session.updateEntry(rowId, value)
  const copy = (text: string) => () => void navigator.clipboard.writeText(text)
  const paste = async (rowId: string) => {
    const text = await navigator.clipboard.readText()
    if (text) session.updateEntry(rowId, text)
  }
  return (
    <>
      {aiEntry && (
        <AITranslateModal
          open
          source={aiEntry.source}
          sourceLang={session.sourceLang}
          targetLang={session.targetLang}
          onApply={(result) => {
            session.updateEntry(aiEntry.rowId, result)
            session.markManual(aiEntry.rowId)
            session.setReviewStatus(aiEntry.rowId, 'not-verified')
            setAiEntry(null)
          }}
          onClose={() => setAiEntry(null)}
        />
      )}
      {similarityEntry && (
        <SimilarityExamplesModal
          open
          source={similarityEntry.source}
          sourceLang={session.sourceLang}
          targetLang={session.targetLang}
          onClose={() => setSimilarityEntry(null)}
        />
      )}
      {historyEntry && (
        <TranslationHistoryDialog
          source={historyEntry.source}
          history={historyEntry.history ?? []}
          onClose={() => setHistoryEntry(null)}
        />
      )}
      <TermGlossaryModal
        open={termGlossaryOpen}
        entries={termGlossary}
        onChange={setTermGlossary}
        onClose={() => setTermGlossaryOpen(false)}
      />
      <div className="flex h-full min-h-0 flex-col bg-[#0c0d0f] text-neutral-200">
        <div className="app-page-header flex shrink-0 flex-wrap items-center gap-3 border-b border-[#1f2329] px-6 py-5">
          <Icon size={20} className="text-amber-400" />
          <div>
            <h1 className="text-base font-semibold">Game Data</h1>
            <p className="text-xs text-neutral-500">
              {filtered.length.toLocaleString()} entries · {filtered.length.toLocaleString()}{' '}
              entries · names and descriptions
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <a
              href={wikiUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded border border-[#2a2f37] px-2 py-1 text-xs text-neutral-400 hover:text-neutral-100"
            >
              Open online <ExternalLink size={12} />
            </a>
            <button
              type="button"
              onClick={() => setTermGlossaryOpen(true)}
              title="Term Glossary"
              aria-label="Term Glossary"
              className={btnGhostIcon}
            >
              <BookText />
            </button>
            <div className="mx-1 h-4.5 w-px shrink-0 bg-[#1f2329]" />
            <SessionSaveButton session={session} />
          </div>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto md:grid-cols-[minmax(280px,0.42fr)_minmax(0,0.58fr)] md:overflow-hidden">
          <aside className="flex min-h-[250px] max-h-[46vh] min-w-0 flex-col border-b border-[#1f2329] p-3 md:min-h-0 md:max-h-none md:border-b-0 md:border-r">
            <GameDataSearch onSearch={setQuery} />
            <div className="mb-3 flex flex-wrap gap-1">
              {CATEGORIES.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    setCategory(item.value)
                    setSelected(null)
                  }}
                  className={cn(
                    'rounded px-2 py-1 text-[10px]',
                    category === item.value
                      ? 'bg-amber-500/15 text-amber-300'
                      : 'text-neutral-500 hover:bg-[#1c1f24]'
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <GameDataList entries={filtered} current={current} onSelect={setSelected} />
          </aside>
          <main className="grid min-h-[680px] min-w-0 grid-rows-[minmax(260px,auto)_minmax(320px,1fr)] p-3 sm:min-h-[720px] sm:p-4 md:min-h-0 md:grid-rows-[minmax(300px,0.5fr)_minmax(0,0.5fr)]">
            <section className="mb-3 overflow-y-auto rounded-lg border border-[#1f2329] bg-[#131518] p-4">
              <label className="mb-3 flex items-center justify-end gap-2 text-[10px] text-neutral-500">
                <input
                  type="checkbox"
                  checked={showContentUid}
                  onChange={(event) => setShowContentUid(event.target.checked)}
                  className="accent-amber-500"
                />{' '}
                Show contentuid
              </label>
              {current ? (
                <>
                  <div className="mb-2 flex items-center gap-2">
                    <Icon size={18} className="text-amber-400" />
                    <h2 className="text-lg font-semibold">{current.name}</h2>
                    <span className="rounded border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300">
                      {current.category}
                    </span>
                  </div>
                  <TranslationField
                    label="Title EN"
                    source={current.name}
                    entries={linkedTitle}
                    targetLang={session.targetLang.toUpperCase()}
                    update={update}
                    copy={copy(current.name)}
                    paste={paste}
                    showContentUid={showContentUid}
                    onGemini={setAiEntry}
                    onSimilarity={setSimilarityEntry}
                    onHistory={setHistoryEntry}
                    toggleNeedsReview={session.toggleNeedsReview}
                    setReviewStatus={session.setReviewStatus}
                    termGlossary={termGlossary}
                  />
                  <TranslationField
                    label="Description EN"
                    source={current.description}
                    entries={linkedDescription}
                    targetLang={session.targetLang.toUpperCase()}
                    update={update}
                    copy={copy(current.description)}
                    paste={paste}
                    showContentUid={showContentUid}
                    onGemini={setAiEntry}
                    onSimilarity={setSimilarityEntry}
                    onHistory={setHistoryEntry}
                    toggleNeedsReview={session.toggleNeedsReview}
                    setReviewStatus={session.setReviewStatus}
                    termGlossary={termGlossary}
                  />
                </>
              ) : (
                <p className="text-sm text-neutral-500">Select an entry from the list.</p>
              )}
            </section>
            <div className="min-h-0 overflow-hidden rounded-lg border border-[#1f2329] bg-[#0c0d0f]">
              <webview
                title="BG3 wiki reference"
                src={wikiUrl}
                allowpopups
                className="block h-full w-full border-0"
                style={{ height: '100%', width: '100%', display: 'flex' }}
              />
            </div>
          </main>
        </div>
      </div>
    </>
  )
}
