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
  BookText,
  Hash,
  Code2,
  X
} from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { normalizeSearchText, stripSearchDiacritics } from '@/utils/search'
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
import { StyledWebview } from '@/components/shared/StyledWebview'
import { TextSearchInput } from '@/components/shared/TextSearchInput'
import { extractLarianTags, wrapSelectionWithTag, type TextSelection } from '@/utils/larianTags'
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
  return normalizeSearchText(
    value
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  )
}
function LocalTranslationInput({
  value,
  onCommit,
  inputRef,
  onSelectionChange
}: {
  value: string
  onCommit: (value: string) => void
  inputRef?: React.Ref<HTMLTextAreaElement>
  onSelectionChange?: (selection: TextSelection) => void
}): React.JSX.Element {
  return (
    <HighlightedTextarea
      value={value}
      ref={inputRef}
      rows={1}
      autoGrow
      placeholder="Translate here..."
      onBlur={(event) => {
        if (event.currentTarget.value !== value) onCommit(event.currentTarget.value)
      }}
      onSelect={(event) =>
        onSelectionChange?.({
          start: event.currentTarget.selectionStart,
          end: event.currentTarget.selectionEnd
        })
      }
      containerClassName="game-data-translation-input rounded border-[#2a2f37]"
      className="resize-none text-[13px] leading-[1.55]"
    />
  )
}
function gameDataSearchMatches(value: string, query: string, matchCase: boolean, wholeWord: boolean): boolean {
  const needle = query.trim()
  if (!needle) return true
  const haystack = matchCase ? stripSearchDiacritics(value) : normalizeSearchText(value)
  const normalizedNeedle = matchCase ? stripSearchDiacritics(needle) : normalizeSearchText(needle)
  if (!wholeWord) return haystack.includes(normalizedNeedle)
  const escaped = normalizedNeedle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:^|\\b)${escaped}(?=$|\\b)`).test(haystack)
}

function GameDataSearch({
  query,
  onSearch,
  category,
  onCategoryChange,
  matchCase,
  onMatchCaseChange,
  wholeWord,
  onWholeWordChange
}: {
  query: string
  onSearch: (value: string) => void
  category: ReferenceCategory | undefined
  onCategoryChange: (value: ReferenceCategory | undefined) => void
  matchCase: boolean
  onMatchCaseChange: (value: boolean) => void
  wholeWord: boolean
  onWholeWordChange: (value: boolean) => void
}): React.JSX.Element {
  return (
    <TextSearchInput
      value={query}
      onChange={onSearch}
      placeholder="Search game data..."
      matchCase={matchCase}
      onMatchCaseChange={onMatchCaseChange}
      matchWholeWord={wholeWord}
      onMatchWholeWordChange={onWholeWordChange}
      scopeValue={category ?? 'all'}
      onScopeChange={(value) => onCategoryChange(value === 'all' ? undefined : (value as ReferenceCategory))}
      scopeOptions={CATEGORIES.map((item) => ({ value: item.value ?? 'all', label: item.label }))}
      className="mb-2 w-full"
    />
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

function GameDataTooltipButton({
  tooltip,
  onClick,
  className,
  children
}: {
  tooltip: string
  onClick: () => void
  className: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={tooltip}
      className={cn(
        'group/game-data-tooltip relative z-20 focus:outline-none hover:z-50 focus:z-50',
        className
      )}
    >
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-[100] w-max max-w-56 -translate-x-1/2 translate-y-[2px] whitespace-nowrap rounded-md border border-[#3a3f47] bg-[#171a1f] px-2 py-1.5 text-[10px] font-medium leading-tight text-neutral-200 opacity-0 shadow-2xl transition-all duration-150 group-hover/game-data-tooltip:translate-y-0 group-hover/game-data-tooltip:opacity-100 group-focus-visible/game-data-tooltip:translate-y-0 group-focus-visible/game-data-tooltip:opacity-100"
      >
        {tooltip}
      </span>
    </button>
  )
}

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
  onTag,
  inputRefFor,
  onSelectionChange,
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
  onTag: (entry: TranslationSessionEntry) => void
  inputRefFor: (rowId: string, element: HTMLTextAreaElement | null) => void
  onSelectionChange: (rowId: string, selection: TextSelection) => void
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
      <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
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
        {renderSource(source, { termGlossary, whitespaceHighlight: true })}
      </div>
      {entries.length === 0 ? (
        <div className="text-[11px] italic text-neutral-600">
          This text is not present in the loaded XML.
        </div>
      ) : (
        entries.map((entry, index) => (
          <div key={entry.rowId} className="mb-2 last:mb-0">
            <div className="mb-1 flex flex-wrap items-center gap-1 text-[9px] text-neutral-600">
              <span className="mr-1 text-amber-300">
                Occurrence {index + 1}
                {entries.length > 1 ? ` of ${entries.length}` : ''}
                {showContentUid ? ` · ${entry.uid}` : ''}
              </span>
              <span className="mx-1 h-4 border-l border-[#2a2f37]" aria-hidden="true" />
              <GameDataTooltipButton
                tooltip="Paste translation"
                onClick={() => paste(entry.rowId)}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#1f2329] bg-[#131518] text-amber-300 transition-colors hover:border-amber-400/60 hover:text-amber-200"
              >
                <ClipboardPaste size={11} />
              </GameDataTooltipButton>
              <GameDataTooltipButton
                tooltip="Reveal in Translate"
                onClick={() => reveal(entry.uid)}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#1f2329] bg-[#131518] text-amber-300 transition-colors hover:border-amber-400/60 hover:text-amber-200"
              >
                <Eye size={11} />
              </GameDataTooltipButton>
              <span className="mx-1 h-4 border-l border-[#2a2f37]" aria-hidden="true" />
              <GameDataTooltipButton
                tooltip="Translate with Gemini"
                onClick={() => onGemini(entry)}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#1f2329] bg-[#131518] text-neutral-200 transition-colors hover:border-[#2a2f37] hover:text-white"
              >
                <Sparkles size={13} />
              </GameDataTooltipButton>
              <GameDataTooltipButton
                tooltip="Show similarity examples"
                onClick={() => onSimilarity(entry)}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#1f2329] bg-[#131518] text-neutral-500 transition-colors hover:border-[#2a2f37] hover:text-neutral-200"
              >
                <BookOpen size={13} />
              </GameDataTooltipButton>
              <GameDataTooltipButton
                tooltip="History of changes"
                onClick={() => onHistory(entry)}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#1f2329] bg-[#131518] text-neutral-500 transition-colors hover:border-[#2a2f37] hover:text-neutral-200"
              >
                <History size={11} />
              </GameDataTooltipButton>
              {extractLarianTags(entry.source).length > 0 && (
                <GameDataTooltipButton
                  tooltip="Apply next source tag"
                  onClick={() => onTag(entry)}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#1f2329] bg-[#131518] text-neutral-500 transition-colors hover:border-amber-400/60 hover:text-amber-400"
                >
                  <Code2 size={13} />
                </GameDataTooltipButton>
              )}
              <GameDataTooltipButton
                tooltip="Needs review"
                onClick={() => toggleNeedsReview(entry.rowId)}
                className={cn(
                  'inline-flex h-6 w-6 items-center justify-center rounded-full border transition-colors',
                  entry.needsReview
                    ? 'border-rose-400/40 bg-rose-500/15 text-rose-300'
                    : 'border-[#1f2329] bg-[#131518] text-neutral-500 hover:border-rose-400/40 hover:text-rose-300'
                )}
              >
                <Flag size={12} />
              </GameDataTooltipButton>
              <span className="mx-1 h-4 border-l border-[#2a2f37]" aria-hidden="true" />
              {reviewStatusOptions.map((option) => {
                const Icon = option.icon
                return (
                  <GameDataTooltipButton
                    key={option.value}
                    tooltip={option.title}
                    onClick={() => setReviewStatus(entry.rowId, option.value)}
                    className={cn(
                      'inline-flex h-6 w-6 items-center justify-center rounded border transition-colors',
                      entryReviewStatus(entry) === option.value ? option.active : option.idle
                    )}
                  >
                    <Icon size={13} />
                  </GameDataTooltipButton>
                )
              })}
            </div>
            <LocalTranslationInput
              value={entry.target}
              inputRef={(element) => inputRefFor(entry.rowId, element)}
              onSelectionChange={(selection) => onSelectionChange(entry.rowId, selection)}
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
  useEffect(() => {
    const scrollElement = parentRef.current
    if (scrollElement) scrollElement.scrollTop = 0
  }, [entries])
  return (
    <div ref={parentRef} className="polyhedron-scroll min-h-0 flex-1 overflow-y-auto">
      <div className="w-full">
        {entries.map((entry) => {
          const ItemIcon = iconFor(entry.category)
          const key = `${entry.category}:${entry.name}`
          const translated = translatedKeys.has(key)
          const verified = verifiedKeys.has(key)
          return (
            <div
              key={key}
              className="w-full pb-1"
            >
              <button
                type="button"
                onClick={() => onSelect(entry)}
                className={cn(
                  'game-data-list-row translation-special-filter-option flex min-h-[52px] w-full cursor-pointer items-start gap-2 rounded-md px-2.5 py-2 text-left transition-colors focus:outline-none focus-visible:outline-none',
                  current?.name === entry.name && current?.category === entry.category
                    ? 'is-selected text-[var(--poly-accent)]'
                    : 'text-neutral-300'
                )}
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
            </div>
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
  const [matchCase, setMatchCase] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [selected, setSelected] = useState<ReferenceCatalogEntry | null>(null)
  const [showContentUid, setShowContentUid] = useState(false)
  const [aiEntry, setAiEntry] = useState<TranslationSessionEntry | null>(null)
  const [similarityEntry, setSimilarityEntry] = useState<TranslationSessionEntry | null>(null)
  const [historyEntry, setHistoryEntry] = useState<TranslationSessionEntry | null>(null)
  const translationInputRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map())
  const tagSelections = useRef<Map<string, TextSelection>>(new Map())
  const tagProgress = useRef<Map<string, number>>(new Map())
  const [termGlossaryOpen, setTermGlossaryOpen] = useState(false)
  const termGlossaryProjectKey =
    session.storedPath ?? session.inputPath ?? session.modName ?? 'current'
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
      getReferenceCatalog()
        .filter((entry) => !category || entry.category === category)
        .filter(
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
  const searchableEntries = useMemo(
    () =>
      allEntries.map((entry) => ({
        entry,
        searchText: `${entry.name} ${entry.description} ${showContentUid ? `${uidBySource.get(normalize(entry.name)) ?? ''} ${uidBySource.get(normalize(entry.description)) ?? ''}` : ''}`
      })),
    [allEntries, showContentUid, uidBySource]
  )
  const filtered = useMemo(() => {
    return query.trim()
      ? searchableEntries
          .filter((item) => gameDataSearchMatches(item.searchText, query, matchCase, wholeWord))
          .map((item) => item.entry)
      : allEntries
  }, [allEntries, matchCase, query, searchableEntries, wholeWord])
  const rowsBySource = useMemo(() => {
    const map = new Map<string, TranslationSessionEntry[]>()
    for (const row of session.entries) {
      const key = normalize(row.source)
      const rows = map.get(key)
      if (rows) rows.push(row)
      else map.set(key, [row])
    }
    return map
  }, [session.entries])
  const requestedSpell = searchParams.get('spell')?.trim()
  const requestedEntry = requestedSpell
    ? (getReferenceCatalog('Spell').find(
        (entry) => normalize(entry.name) === normalize(requestedSpell)
      ) ?? null)
    : null
  const current =
    requestedEntry ??
    (selected && (!category || selected.category === category) ? selected : (filtered[0] ?? null))
  const linkedTitle = current ? (rowsBySource.get(normalize(current.name)) ?? []) : []
  const linkedDescription = current ? (rowsBySource.get(normalize(current.description)) ?? []) : []
  const Icon = iconFor(current?.category ?? category ?? 'Weapon')
  const wikiUrl = current
    ? `https://bg3.wiki${wikiPath(current.category, current.name)}`
    : 'https://bg3.wiki/wiki/Weapons'
  const update = (rowId: string, value: string) => {
    session.updateEntry(rowId, value)
    session.setReviewStatus(rowId, value.trim() ? 'needs-review' : 'untranslated')
  }
  const applyNextSourceTag = (entry: TranslationSessionEntry) => {
    const textarea = translationInputRefs.current.get(entry.rowId)
    const selection = tagSelections.current.get(entry.rowId)
    if (!textarea || !selection) return
    const tags = extractLarianTags(entry.source)
    let tagIndex = tagProgress.current.get(entry.rowId) ?? 0
    if (tagIndex > 0 && extractLarianTags(entry.target).length === 0) {
      tagIndex = 0
      tagProgress.current.delete(entry.rowId)
    }
    const tag = tags[tagIndex]
    if (!tag) return
    const wrapped = wrapSelectionWithTag(entry.target, selection, tag)
    if (!wrapped) return
    session.updateEntry(entry.rowId, wrapped.value)
    session.markManual(entry.rowId)
    session.setReviewStatus(entry.rowId, 'needs-review')
    tagProgress.current.set(entry.rowId, tagIndex + 1)
    window.requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(wrapped.cursor, wrapped.cursor)
    })
  }
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
        sourceLang={session.sourceLang}
        targetLang={session.targetLang}
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
              onClick={() => setShowContentUid((visible) => !visible)}
              aria-pressed={showContentUid}
              title={showContentUid ? 'Hide contentuid' : 'Show contentuid'}
              className={cn(
                btnGhostIcon,
                showContentUid ? 'text-[color:var(--poly-accent)]' : 'text-neutral-400'
              )}
            >
              <Hash size={20} />
            </button>
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
            <GameDataSearch
              query={query}
              onSearch={setQuery}
              category={category}
              onCategoryChange={(value) => {
                setCategory(value)
                setSelected(null)
              }}
              matchCase={matchCase}
              onMatchCaseChange={setMatchCase}
              wholeWord={wholeWord}
              onWholeWordChange={setWholeWord}
            />
            <GameDataList
              key={category ?? 'all'}
              entries={filtered}
              current={current}
              onSelect={setSelected}
            />
          </aside>
          <main className="grid min-h-[680px] min-w-0 grid-rows-[minmax(260px,auto)_minmax(320px,1fr)] p-3 sm:min-h-[720px] sm:p-4 md:min-h-0 md:grid-rows-[minmax(300px,0.5fr)_minmax(0,0.5fr)]">
            <section className="mb-3 overflow-y-auto rounded-lg border border-[#1f2329] bg-[#131518] p-4">
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
                    onTag={applyNextSourceTag}
                    inputRefFor={(rowId, element) => {
                      if (element) translationInputRefs.current.set(rowId, element)
                      else translationInputRefs.current.delete(rowId)
                    }}
                    onSelectionChange={(rowId, selection) =>
                      tagSelections.current.set(rowId, selection)
                    }
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
                    onTag={applyNextSourceTag}
                    inputRefFor={(rowId, element) => {
                      if (element) translationInputRefs.current.set(rowId, element)
                      else translationInputRefs.current.delete(rowId)
                    }}
                    onSelectionChange={(rowId, selection) =>
                      tagSelections.current.set(rowId, selection)
                    }
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
              <StyledWebview
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
