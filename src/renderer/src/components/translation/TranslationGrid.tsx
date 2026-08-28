import { useVirtualizer } from '@tanstack/react-virtual'
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronUp,
  Copy,
  Flag,
  GitBranch,
  RefreshCw,
  Search,
  Sparkles,
  X
} from 'lucide-react'
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition
} from 'react'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { HighlightedTextarea } from '@/components/shared/HighlightedTextarea'
import { AITranslateModal } from '@/components/translation/AITranslateModal'
import {
  type FilterSpec,
  type GenderVariant,
  entryMatchesSearch,
  materializeSelectedEntries,
  type TranslationSessionEntry,
  useTranslationSession
} from '@/context/TranslationSession'
import { getProviderMeta } from '@/features/settings/aiProviders'
import { useAISettings } from '@/hooks/useAISettings'
import { useConfig } from '@/hooks/useConfig'
import { getLocalizedErrorMessage } from '@/i18n/errors'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import {
  getReferenceDisplayText,
  getReferenceLinks,
  getReferenceTags,
  type ReferenceLink,
  type ReferenceTag
} from '@/data/gameReference'
import {
  getDialogueFilterTags,
  getDialogueGroups,
  getDialogueNodes,
  matchesDialogueFilters,
  matchesDialogueScope,
  type DialogueFilter,
  type DialogueScope
} from '@/data/dialogReference'
import { cn } from '@/lib/utils'
import { getItemTags } from '@/data/armorReference'
import { renderSource } from '@/utils/renderSource'

type TranslationCategory = 'dictionary' | 'tool' | 'manual' | 'none'
type FilterMode = 'all' | 'untranslated' | 'translated' | 'dictionary' | 'tags' | 'needs-review'
type OnlineNodeMeta = {
  kind: 'Question' | 'Answer' | 'Cinematic' | 'Technical'
  speaker: string | null
}

interface TranslationGridProps {
  entries: TranslationSessionEntry[]
  onEntryChange: (rowId: string, target: string) => void
  onEntryManualEdit: (rowId: string) => void
  viewMode: 'stacked' | 'side'
}

function getCategory(entry: TranslationSessionEntry): TranslationCategory {
  if (entry.matchType === 'mod-text' || entry.matchType === 'text') return 'dictionary'
  if (entry.matchType === 'manual') return 'manual'
  if (entry.target.trim()) return 'tool'
  return 'none'
}

function hasXmlTags(entry: TranslationSessionEntry): boolean {
  return /(<[^>]+>|\{[^}]+\})/.test(entry.source)
}

function getDialogueSpeaker(source: string, node: { details: string[]; next: string[] }): string | null {
  if (source.trim().startsWith('*') && source.trim().endsWith('*')) return 'Narrator'
  if (/\[GEN_PlayerName_[^\]]+\]/i.test(source)) return 'Tav'
  const metadata = node.details.join(' ')
  const tagMatch = metadata.match(/Tag:\s*([^|<\n-]+?)(?:\s+-\s*\||\s*\|)/i)
  if (tagMatch?.[1]?.trim()) return tagMatch[1].trim()
  const speakerMatch = metadata.match(/speaker:\s*([^<\n]+)/i)
  return speakerMatch?.[1]?.trim() || null
}

function getSpeakerBorderClass(speaker: string | null): string {
  if (!speaker) return 'border-[#1f2329]'
  let hash = 0
  for (const char of speaker.toLowerCase()) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return [
    'border-cyan-400/55',
    'border-orange-400/55',
    'border-pink-400/55',
    'border-lime-400/55',
    'border-violet-400/55',
    'border-yellow-400/55',
    'border-sky-400/55'
  ][hash % 7]
}

function getDialogueKind(source: string, node: { details: string[]; next: string[] }): 'Question' | 'Answer' | 'Cinematic' | 'Technical' {
  const metadata = node.details.join(' ').toLowerCase()
  if (/\[GEN_PlayerName_[^\]]+\]/i.test(source)) return 'Question'
  if (!source.trim()) return /cinematic/.test(metadata) ? 'Cinematic' : 'Technical'
  return source.trim().endsWith('?') ? 'Question' : 'Answer'
}

function KbdHint({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-4.5 min-w-4.5 items-center justify-center rounded border border-[#2a2f37] border-b-2 bg-[#181b1f] px-1 font-mono text-[10px] text-neutral-400">
      {children}
    </span>
  )
}

function LangTag({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded px-2 font-mono text-[10px] font-bold tracking-[0.06em]',
        accent
          ? 'bg-amber-500/14 text-amber-400'
          : 'border border-[#1f2329] bg-[#131518] text-neutral-400'
      )}
    >
      {children}
    </span>
  )
}

function ItemTags({ tags }: { tags: ReturnType<typeof getItemTags> }) {
  if (tags.length === 0) return null

  return (
    <>
      {tags.map((tag) => (
        <span
          key={tag}
          className={cn(
            'inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold',
            tag.startsWith('Armour')
              ? 'bg-emerald-500/12 text-emerald-400'
              : tag.startsWith('Weapon')
                ? 'bg-blue-500/14 text-blue-300'
                : tag.startsWith('Object')
                  ? 'bg-sky-500/14 text-sky-300'
                  : tag.startsWith('Spell')
                    ? 'bg-amber-500/14 text-amber-300'
                    : tag.startsWith('Status')
                      ? 'bg-red-500/14 text-red-300'
                      : tag.startsWith('Passive')
                        ? 'bg-violet-500/14 text-violet-300'
                        : 'bg-orange-500/14 text-orange-300'
          )}
        >
          {tag}
        </span>
      ))}
    </>
  )
}

function DialogueTags({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null
  return (
    <>
      {tags.map((tag) => (
        <span
          key={tag}
          className={cn(
            'inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold',
            tag === 'Narrator'
              ? 'bg-fuchsia-500/12 text-fuchsia-300'
              : tag.startsWith('Act ')
                ? 'bg-cyan-500/12 text-cyan-300'
                : 'bg-teal-500/12 text-teal-300'
          )}
        >
          {tag}
        </span>
      ))}
    </>
  )
}

function ReferenceLinks({ links }: { links: ReferenceLink[] }) {
  const [expanded, setExpanded] = useState(false)
  if (links.length === 0) return null
  const visibleLinks = expanded ? links : links.slice(0, 1)

  return (
    <div className="basis-full font-mono text-[10px] text-neutral-500">
      {visibleLinks.map((link) => (
        <div key={`${link.kind}:${link.text}`}>
          {link.kind === 'Description' ? 'Name' : 'Description'} for{' '}
          {getReferenceDisplayText(link.text)}
        </div>
      ))}
      {links.length > 1 && (
        <button
          type="button"
          className="mt-0.5 inline-flex cursor-pointer items-center gap-1 text-sky-400 hover:text-sky-300"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          {expanded ? 'Show less' : `Show ${links.length - 1} more`}
        </button>
      )}
    </div>
  )
}

export function TranslationGrid({
  entries,
  onEntryChange,
  onEntryManualEdit,
  viewMode
}: TranslationGridProps): React.JSX.Element {
  const { t } = useAppTranslation(['translate', 'common', 'toasts', 'ai'])
  const session = useTranslationSession()
  const navigate = useNavigate()
  const { config } = useConfig()
  const showTranslationCounters = config['show_translation_counters'] === 'true'
  const {
    selection,
    isSelected,
    selectAllMatching,
    toggleEntry,
    clearSelection,
    sourceLang,
    targetLang,
    toggleNeedsReview
  } = session
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [exactMatch, setExactMatch] = useState(false)
  const [linkNameDescription] = useState(false)
  const [showId, setShowId] = useState(false)
  const [referenceTag] = useState<ReferenceTag | 'all'>('all')
  const [dialogueFilters] = useState<DialogueFilter[]>([])
  const [dialogueScope, setDialogueScope] = useState<DialogueScope | null>(null)
  const [filter, setFilter] = useState<FilterMode>('all')
  const [statusTabsTarget, setStatusTabsTarget] = useState<HTMLElement | null>(null)
  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedSearch(search), 140)
    return () => window.clearTimeout(handle)
  }, [search])
  useEffect(() => {
    setStatusTabsTarget(document.getElementById('translation-status-tabs'))
  }, [])
  const effectiveSearch = useDeferredValue(debouncedSearch)
  const deferredExactMatch = useDeferredValue(exactMatch)
  const deferredLinkNameDescription = useDeferredValue(linkNameDescription)
  const deferredReferenceTag = useDeferredValue(referenceTag)
  const deferredDialogueFilters = useDeferredValue(dialogueFilters)
  const deferredFilter = useDeferredValue(filter)
  const [isPending, startFilterTransition] = useTransition()
  const [pageSize, setPageSize] = useState<100 | 250 | 500 | 1000>(250)
  useEffect(() => {
    const configured = Number(config['translation_page_size'])
    if (configured === 100 || configured === 250 || configured === 500 || configured === 1000) {
      setPageSize(configured)
    }
  }, [config])
  const [mobilePageMenuOpen, setMobilePageMenuOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [stickyRowIds, setStickyRowIds] = useState<Set<string>>(() => new Set())
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [genderVariants, setGenderVariants] = useState<Record<string, GenderVariant>>({})
  // Row the per-line "Translate with AI" modal is open for (null = closed).
  const [aiEntry, setAiEntry] = useState<TranslationSessionEntry | null>(null)
  const [dialogueKey, setDialogueKey] = useState<{ file: string; dialogue: string } | null>(null)
  const [dialogueChoices] = useState<Array<{ file: string; dialogue: string }>>([])
  const [showLiveGraph, setShowLiveGraph] = useState(true)
  const [onlineNodeMeta, setOnlineNodeMeta] = useState<Record<string, OnlineNodeMeta>>({})
  const { provider: aiProvider } = useAISettings()
  const aiMeta = getProviderMeta(aiProvider)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const textareaRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map())
  const savedByEnterRef = useRef<Set<string>>(new Set())
  const sideParentRef = useRef<HTMLDivElement>(null)
  const stackedParentRef = useRef<HTMLDivElement>(null)
  const liveGraphWebviewRef = useRef<HTMLElement | null>(null)

  const counts = useMemo(() => {
    let translated = 0
    let untranslated = 0
    let dictionary = 0
    let tags = 0

    for (const entry of entries) {
      if (entry.target.trim()) translated += 1
      else untranslated += 1
      if (getCategory(entry) === 'dictionary') dictionary += 1
      if (hasXmlTags(entry)) tags += 1
    }

    return { translated, untranslated, dictionary, tags }
  }, [entries])

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      // Keep the row being edited mounted until blur/Enter commits the value.
      // Otherwise Exact Match can remove its textarea on the first keystroke.
      if (editingRowId === entry.rowId) return true
      if (stickyRowIds.has(entry.rowId)) return true
      if (effectiveSearch) {
        const directMatch = entryMatchesSearch(entry, effectiveSearch, deferredExactMatch)
        if (!directMatch && !deferredLinkNameDescription) return false
        if (!directMatch && deferredLinkNameDescription) {
          const query = effectiveSearch.toLowerCase()
          const linkMatch = getReferenceLinks(entry.source).some((link) =>
            deferredExactMatch
              ? link.text.toLowerCase() === query
              : link.text.toLowerCase().includes(query)
          )
          if (!linkMatch) return false
        }
      }
      if (deferredFilter === 'untranslated' && entry.target.trim()) return false
      if (deferredFilter === 'translated' && !entry.target.trim()) return false
      if (deferredFilter === 'dictionary' && getCategory(entry) !== 'dictionary') return false
      if (deferredFilter === 'tags' && !hasXmlTags(entry)) return false
      if (deferredFilter === 'needs-review' && !entry.needsReview) return false
      if (deferredReferenceTag !== 'all' && !getReferenceTags(entry.source).includes(deferredReferenceTag)) {
        return false
      }
      if (!matchesDialogueFilters(entry.source, deferredDialogueFilters)) return false
      if (!matchesDialogueScope(entry.source, dialogueScope)) return false
      return true
    })
  }, [
    deferredExactMatch,
    deferredFilter,
    deferredLinkNameDescription,
    deferredReferenceTag,
    deferredDialogueFilters,
    dialogueScope,
    effectiveSearch,
    entries,
    stickyRowIds,
    editingRowId
  ])

  useEffect(() => {
    setCurrentPage(1)
  }, [deferredExactMatch, deferredFilter, deferredLinkNameDescription, deferredReferenceTag, deferredDialogueFilters, dialogueScope, effectiveSearch])

  // clear selection and sticky rows when filter or search changes
  useEffect(() => {
    clearSelection()
    setStickyRowIds(new Set())
  }, [
    deferredExactMatch,
    deferredFilter,
    deferredLinkNameDescription,
    deferredReferenceTag,
    deferredDialogueFilters,
    dialogueScope,
    effectiveSearch,
    clearSelection
  ])

  // single source of truth for which entries "select-all" covers
  const currentFilter: FilterSpec = {
    mode: deferredFilter,
    search: effectiveSearch,
    exactMatch: deferredExactMatch,
    linkNameDescription: deferredLinkNameDescription,
    referenceTag: deferredReferenceTag,
    dialogueFilters: deferredDialogueFilters,
    dialogueScope
  }

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / pageSize))

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  const pageEntries = filteredEntries.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const sideVirtualizer = useVirtualizer({
    count: pageEntries.length,
    getScrollElement: () => sideParentRef.current,
    estimateSize: () => 72,
    overscan: 10
  })

  const stackedVirtualizer = useVirtualizer({
    count: pageEntries.length,
    getScrollElement: () => stackedParentRef.current,
    estimateSize: () => 220,
    overscan: 10
  })

  const selectedStats = useMemo(() => {
    const materialized = materializeSelectedEntries(session)
    return {
      selectedStrings: materialized.length,
      selectedCharacters: materialized.reduce((sum, e) => sum + e.source.length, 0)
    }
  }, [session.selection, session.entries])

  const allFiltered =
    selection.kind === 'all-matching' &&
    selection.excluded.size === 0 &&
    selection.filter.mode === deferredFilter &&
    selection.filter.search === effectiveSearch &&
    selection.filter.exactMatch === deferredExactMatch &&
    selection.filter.linkNameDescription === deferredLinkNameDescription &&
    selection.filter.referenceTag === deferredReferenceTag &&
    JSON.stringify(selection.filter.dialogueFilters) === JSON.stringify(deferredDialogueFilters) &&
    JSON.stringify(selection.filter.dialogueScope) === JSON.stringify(dialogueScope)

  useEffect(() => {
    const handleFindShortcut = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.shiftKey || event.altKey || event.metaKey) return
      if (event.key.toLowerCase() !== 'f') return
      event.preventDefault()
      searchInputRef.current?.focus()
      searchInputRef.current?.select()
    }

    window.addEventListener('keydown', handleFindShortcut)
    return () => window.removeEventListener('keydown', handleFindShortcut)
  }, [])

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      selectAllMatching(currentFilter)
    } else {
      clearSelection()
    }
  }

  const focusEntry = (rowId: string) => {
    textareaRefs.current.get(rowId)?.focus()
  }

  const handleCopySource = async (event: React.MouseEvent, source: string) => {
    event.stopPropagation()
    try {
      await navigator.clipboard.writeText(source)
      toast.success(t('translate.sourceCopied', { ns: 'toasts' }))
    } catch (err) {
      toast.error(getLocalizedErrorMessage(err, t))
    }
  }

  const updateEntryTarget = (entry: TranslationSessionEntry, value: string) => {
    if (value !== entry.target) {
      onEntryChange(entry.rowId, value)
      // A user edit in Translate must always override a dictionary suggestion.
      // Previously dictionary-backed rows kept their matchType, so a later reload
      // could apply the old dictionary value over the user's translation.
      onEntryManualEdit(entry.rowId)
    }
  }

  const markSticky = (rowId: string) => {
    setStickyRowIds((prev) => {
      if (prev.has(rowId)) return prev
      const next = new Set(prev)
      next.add(rowId)
      return next
    })
  }

  const handleEntryBlur = (entry: TranslationSessionEntry, value: string) => {
    if (savedByEnterRef.current.has(entry.rowId)) {
      savedByEnterRef.current.delete(entry.rowId)
      return
    }
    updateEntryTarget(entry, value)
    markSticky(entry.rowId)
    setEditingRowId(null)
  }

  const selectedGenderVariant = (entry: TranslationSessionEntry): GenderVariant => genderVariants[entry.rowId] ?? entry.genderVariant ?? "default"

  const genderValue = (entry: TranslationSessionEntry): string => {
    const variant = selectedGenderVariant(entry)
    return variant === "default" ? entry.target : (entry.genderTargets?.[variant] ?? "")
  }

  const updateGenderValue = (entry: TranslationSessionEntry, value: string) => {
    const variant = selectedGenderVariant(entry)
    if (variant === "default") updateEntryTarget(entry, value)
    else if (value !== (entry.genderTargets?.[variant] ?? "")) { session.updateGenderVariant(entry.rowId, variant, value); onEntryManualEdit(entry.rowId) }
  }

  const renderGenderControls = (entry: TranslationSessionEntry) => {
    const variant = selectedGenderVariant(entry)
    return <div className="contents">{(["default", "female", "neutral"] as GenderVariant[]).map((item) => <button key={item} type="button" onClick={() => setGenderVariants((previous) => ({ ...previous, [entry.rowId]: item }))} className={cn("rounded border px-1.5 py-0.5 text-[9px] uppercase", variant === item ? "border-amber-500/40 bg-amber-500/10 text-amber-300" : "border-[#1f2329] text-neutral-600 hover:text-neutral-400")}>{item}</button>)}</div>
  }

  // Per-row "Translate with AI" chip - opens the modal with similarity examples and the
  // per-line prompt for that entry. Uses whichever provider is active in Settings.
  const renderAiButton = (entry: TranslationSessionEntry) => (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        setAiEntry(entry)
      }}
      className="inline-flex h-6 shrink-0 cursor-pointer items-center gap-1.5 rounded border border-[#1f2329] bg-[#131518] px-2 text-[11px] font-medium text-neutral-300 transition-colors hover:border-amber-500/60 hover:text-amber-400"
    >
      <Sparkles size={13} /> Gemini
    </button>
  )

  const renderReviewButton = (entry: TranslationSessionEntry) => (
    <button
      type="button"
      title={t('grid.needsReviewToggle', { ns: 'translate' })}
      aria-label={t('grid.needsReviewToggle', { ns: 'translate' })}
      onClick={(event) => {
        event.stopPropagation()
        toggleNeedsReview(entry.rowId)
      }}
      className={cn(
        'inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded border transition-colors',
        entry.needsReview
          ? 'border-rose-400/40 bg-rose-500/15 text-rose-300'
          : 'border-[#1f2329] bg-[#131518] text-neutral-500 hover:border-rose-400/40 hover:text-rose-300'
      )}
    >
      <Flag size={12} />
    </button>
  )

  const aiModal = aiEntry && (
    <AITranslateModal
      open
      source={aiEntry.source}
      sourceLang={sourceLang}
      targetLang={targetLang}
      onApply={(result) => {
        updateEntryTarget(aiEntry, result)
        markSticky(aiEntry.rowId)
      }}
      onClose={() => setAiEntry(null)}
    />
  )

  const dialogueEntries = useMemo(() => {
    if (!dialogueKey) return []
    return entries.filter((entry) =>
      getDialogueGroups(entry.source).some(
        (group) => group.file === dialogueKey.file && group.dialogue === dialogueKey.dialogue
      )
    )
  }, [dialogueKey, entries])

  const dialogueNodes = useMemo(
    () => (dialogueKey ? getDialogueNodes(dialogueKey.dialogue) : []),
    [dialogueKey]
  )

  const openDialogueForEntry = (entry: TranslationSessionEntry) => {
    const group = getDialogueGroups(entry.source)[0]
    if (!group) return
    navigate('/dialogues', {
      state: {
        category: group.category,
        file: group.file,
        dialogue: group.dialogue,
        node: group.node,
        source: entry.source,
        uid: entry.uid
      }
    })
  }

  const updateDialogueTarget = (entry: TranslationSessionEntry, value: string) => {
    for (const sibling of dialogueEntries) {
      if (sibling.source === entry.source) updateEntryTarget(sibling, value)
    }
  }

  const selectOnlineGraphTab = () => {
    const webview = liveGraphWebviewRef.current as unknown as {
      executeJavaScript?: (code: string) => Promise<unknown>
      setZoomFactor?: (factor: number) => Promise<void>
    } | null
    try {
      const resetZoom = webview?.setZoomFactor?.(1)
      void resetZoom?.catch(() => undefined)
    } catch {
      // The embedded page can still be used if native page zoom is unavailable.
    }
    void webview?.executeJavaScript?.(`
      (() => {
        const candidates = [...document.querySelectorAll('button, a, [role="tab"]')]
        const graph = candidates.find((element) => element.textContent?.trim().toLowerCase() === 'graph')
        if (graph instanceof HTMLElement) graph.click()
      })()
    `)
  }

  const collectOnlineNodeMeta = async () => {
    const webview = liveGraphWebviewRef.current as unknown as {
      executeJavaScript?: (code: string) => Promise<unknown>
    } | null
    const result = await webview?.executeJavaScript?.(`
      (() => {
        const kinds = new Set(['Question', 'Answer', 'Cinematic', 'Technical'])
        const output = []
        const getId = (element) => {
          const ownId = element.getAttribute('data-node-id') || element.getAttribute('data-uuid') || element.getAttribute('data-id') || element.id
          if (ownId && /^[0-9a-f-]{36}$/i.test(ownId)) return ownId
          const link = element.closest('a[href*="#"]')
          const fragment = link?.getAttribute('href')?.split('#').pop()
          return fragment && /^[0-9a-f-]{36}$/i.test(fragment) ? fragment : null
        }
        for (const element of document.querySelectorAll('body *')) {
          const labels = [...element.querySelectorAll('*')]
            .map((child) => child.textContent?.trim() ?? '')
            .filter((text) => text.length < 80)
          const kind = labels.find((text) => kinds.has(text))
          if (!kind) continue
          const owner = element.closest('[data-node-id], [data-uuid], [data-id], [id], .node, [class*="node"]') || element
          const nodeId = getId(owner) || getId(element)
          if (!nodeId) continue
          const speakerText = labels.find((text) => /^Speaker\s*:/i.test(text))
          output.push({ nodeId, kind, speaker: speakerText ? speakerText.replace(/^Speaker\s*:\s*/i, '').trim() : null })
        }
        return output
      })()
    `)
    if (!Array.isArray(result)) return
    const next: Record<string, OnlineNodeMeta> = {}
    for (const item of result as Array<{ nodeId?: unknown; kind?: unknown; speaker?: unknown }>) {
      if (!item.nodeId || !['Question', 'Answer', 'Cinematic', 'Technical'].includes(String(item.kind))) continue
      next[String(item.nodeId)] = {
        kind: String(item.kind) as OnlineNodeMeta['kind'],
        speaker: typeof item.speaker === 'string' && item.speaker ? item.speaker : null
      }
    }
    setOnlineNodeMeta(next)
  }

  const focusOnlineNode = (nodeId: string, source: string) => {
    setShowLiveGraph(true)
    if (!liveGraphWebviewRef.current) {
      window.setTimeout(() => focusOnlineNode(nodeId, source), 250)
      return
    }
    const webview = liveGraphWebviewRef.current as unknown as {
      executeJavaScript?: (code: string) => Promise<unknown>
    } | null
    const serializedNode = JSON.stringify(nodeId)
    const serializedSource = JSON.stringify(source.replace(/<[^>]*>/g, '').trim())
    const execution = webview?.executeJavaScript?.(`
      (() => {
        const nodeId = ${serializedNode}
        const source = ${serializedSource}
        const wanted = source.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
        const findTarget = () => {
          let target = document.getElementById(nodeId)
          if (!target) target = document.querySelector('[data-node-id="' + nodeId + '"], [data-uuid="' + nodeId + '"], [data-id="' + nodeId + '"]')
          if (!target) target = document.querySelector('a[href$="#' + nodeId + '"], a[href*="#' + nodeId + '"]')
          if (!target && wanted) {
            const candidates = [...document.querySelectorAll('.react-flow__node, [data-node-id], [data-uuid], [data-id], a, button, [role="button"], [role="treeitem"], li, tr, td, text, p, div')]
            target = candidates
              .map((element) => ({ element, text: (element.textContent ?? '').replace(/\s+/g, ' ').trim().toLowerCase() }))
              .filter(({ text }) => text.includes(wanted))
              .sort((a, b) => a.text.length - b.text.length)[0]?.element ?? null
          }
          return target
        }
        let cameraReset = false
        const resetCamera = () => {
          const fitView = document.querySelector('.react-flow__controls-fitview, [aria-label*="fit" i], [title*="fit" i]')
          if (fitView instanceof HTMLElement) {
            fitView.click()
            return
          }
          const pane = document.querySelector('.react-flow__pane, .react-flow__renderer, .react-flow__viewport')
          if (pane instanceof HTMLElement || pane instanceof SVGElement) {
            for (let index = 0; index < 5; index += 1) {
              pane.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 500, clientX: window.innerWidth / 2, clientY: window.innerHeight / 2 }))
            }
          }
        }
        const tryFind = (attempts) => {
          const target = findTarget()
          if (!target) {
            if (attempts > 0) window.setTimeout(() => tryFind(attempts - 1), 350)
            return false
          }
          if (!cameraReset) {
            cameraReset = true
            resetCamera()
            window.setTimeout(() => tryFind(8), 250)
            return true
          }
          const highlight = target.closest('[data-node], .node, [role="treeitem"], li, tr, section, article') ?? target
          highlight.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
          const targetRect = target.getBoundingClientRect()
          const centerX = targetRect.left + targetRect.width / 2
          const centerY = targetRect.top + targetRect.height / 2
          const graphSurface = document.querySelector('.react-flow__pane, .react-flow__renderer, .react-flow__viewport') ?? target.closest('svg, canvas') ?? target
          if (graphSurface instanceof HTMLElement || graphSurface instanceof SVGElement) {
            for (let index = 0; index < 6; index += 1) {
              graphSurface.dispatchEvent(new WheelEvent('wheel', {
                bubbles: true,
                cancelable: true,
                deltaY: -420,
                clientX: centerX,
                clientY: centerY
              }))
            }
          }
          highlight.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
          const oldOutline = highlight.style.outline
          const oldBackground = highlight.style.backgroundColor
          highlight.style.outline = '3px solid #22d3ee'
          highlight.style.backgroundColor = 'rgba(34, 211, 238, 0.18)'
          window.setTimeout(() => {
            highlight.style.outline = oldOutline
            highlight.style.backgroundColor = oldBackground
          }, 2200)
          return true
        }
        return tryFind(8)
      })()
    `)
    void execution?.catch(() => undefined)
  }

  useEffect(() => {
    const webview = liveGraphWebviewRef.current
    if (!webview || !showLiveGraph || !dialogueKey) return
    const handleLoaded = () => {
      void collectOnlineNodeMeta().finally(() => selectOnlineGraphTab())
    }
    webview.addEventListener('did-finish-load', handleLoaded)
    const retry = window.setTimeout(handleLoaded, 900)
    return () => {
      window.clearTimeout(retry)
      webview.removeEventListener('did-finish-load', handleLoaded)
    }
  }, [dialogueKey, showLiveGraph])

  const dialogueModal = dialogueKey && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" role="dialog" aria-modal="true">
      <div className="flex h-[88vh] max-h-[920px] w-full max-w-[1500px] flex-col overflow-hidden rounded-xl border border-[#2a2f37] bg-[#0f1114] shadow-2xl">
        <div className="flex shrink-0 items-center gap-3 border-b border-[#1f2329] px-5 py-3">
          <GitBranch size={16} className="text-cyan-300" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-neutral-100">{dialogueKey.dialogue}</div>
            <div className="truncate font-mono text-[10px] text-neutral-500">{dialogueKey.file}</div>
          </div>
          <span className="rounded bg-cyan-500/12 px-2 py-1 font-mono text-[10px] text-cyan-300">
            {dialogueEntries.length} strings
          </span>
          <button
            type="button"
            className="inline-flex h-7 cursor-pointer items-center rounded border border-cyan-500/30 bg-cyan-500/10 px-2 text-xs font-medium text-cyan-300 transition-colors hover:bg-cyan-500/20"
            onClick={() => setShowLiveGraph((visible) => !visible)}
          >
            {showLiveGraph ? 'Local graph' : 'Live graph'}
          </button>
          <a
            href={`https://bg3.game-script.com/files/${encodeURIComponent(dialogueKey.dialogue)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-7 items-center rounded border border-[#1f2329] bg-[#131518] px-2 text-xs font-medium text-neutral-400 transition-colors hover:border-[#2a2f37] hover:text-neutral-200"
          >
            Open online
          </a>
          <button
            type="button"
            className="inline-flex h-7 cursor-pointer items-center rounded border border-cyan-500/30 bg-cyan-500/10 px-2 text-xs font-medium text-cyan-300 transition-colors hover:bg-cyan-500/20"
            onClick={() => {
              setDialogueScope(dialogueKey)
              setDialogueKey(null)
            }}
          >
            Show in strings
          </button>
          <button type="button" className="inline-flex h-7 cursor-pointer items-center rounded border border-[#1f2329] bg-[#131518] px-2 text-xs font-medium text-neutral-400 transition-colors hover:border-[#2a2f37] hover:text-neutral-200" onClick={() => setDialogueKey(null)}>
            <X size={13} />
          </button>
        </div>
        <div className={cn('grid min-h-0 flex-1', showLiveGraph ? 'grid-cols-1 gap-3 p-3 xl:grid-cols-2' : 'grid-cols-1')}>
          {showLiveGraph && (
            <div className="min-h-0 overflow-hidden rounded-lg border border-[#1f2329] bg-[#0c0d0f]">
              <webview
                ref={liveGraphWebviewRef}
                title="BG3 dialogue graph"
                src={`https://bg3.game-script.com/files/${encodeURIComponent(dialogueKey.dialogue)}`}
                allowpopups
                className="h-full min-h-0 w-full border-0 bg-white"
              />
            </div>
          )}
        <div className="icosa-scroll min-h-0 overflow-y-auto p-3">
          {dialogueChoices.length > 1 && (
            <div className="mb-3 flex flex-wrap items-center gap-1.5 rounded-lg border border-[#1f2329] bg-[#131518] p-2">
              <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-600">Related dialogues</span>
              {dialogueChoices.map((choice) => (
                <button
                  key={`${choice.file}:${choice.dialogue}`}
                  type="button"
                  onClick={() => setDialogueKey(choice)}
                  className={cn(
                    'cursor-pointer rounded px-2 py-1 font-mono text-[10px] transition-colors',
                    choice.dialogue === dialogueKey.dialogue
                      ? 'bg-cyan-500/15 text-cyan-300'
                      : 'bg-[#0c0d0f] text-neutral-500 hover:text-neutral-200'
                  )}
                >
                  {choice.dialogue}
                </button>
              ))}
            </div>
          )}
          <div className="space-y-3">
            {dialogueNodes.map((node, index) => {
              const nodeEntries = dialogueEntries.filter((entry) =>
                getDialogueGroups(entry.source).some(
                  (group) =>
                    group.file === dialogueKey.file &&
                    group.dialogue === dialogueKey.dialogue &&
                    group.node === node.node
                )
              )
              const uniqueNodeEntries = [...new Map(nodeEntries.map((entry) => [entry.source, entry])).values()]
              const representativeSource = uniqueNodeEntries[0]?.source ?? ''
              const nodeKind = uniqueNodeEntries.some((entry) => getDialogueKind(entry.source, node) === 'Question')
                ? 'Question'
                : uniqueNodeEntries.some((entry) => getDialogueKind(entry.source, node) === 'Cinematic')
                  ? 'Cinematic'
                  : uniqueNodeEntries.some((entry) => getDialogueKind(entry.source, node) === 'Answer')
                    ? 'Answer'
                    : getDialogueKind(representativeSource, node)
              const nodeSpeaker = uniqueNodeEntries
                .map((entry) => getDialogueSpeaker(entry.source, node))
                .find(Boolean) ?? null
              const onlineMeta = onlineNodeMeta[node.node]
              const representativeHasText = Boolean(representativeSource.trim())
              const trustedOnlineMeta = onlineMeta && (!representativeHasText || (onlineMeta.kind !== 'Cinematic' && onlineMeta.kind !== 'Technical'))
                ? onlineMeta
                : undefined
              const resolvedNodeKind = trustedOnlineMeta?.kind ?? nodeKind
              const resolvedNodeSpeaker = trustedOnlineMeta?.speaker ?? nodeSpeaker
              return (
                <div id={`dialogue-node-${node.node}`} key={node.node} className={cn(
                  'rounded-lg border bg-[#131518] p-3',
                  getSpeakerBorderClass(resolvedNodeSpeaker),
                  resolvedNodeKind === 'Question'
                    ? 'shadow-[inset_3px_0_0_rgba(96,165,250,0.7)]'
                    : resolvedNodeKind === 'Answer'
                      ? 'shadow-[inset_3px_0_0_rgba(74,222,128,0.7)]'
                      : resolvedNodeKind === 'Cinematic'
                        ? 'shadow-[inset_3px_0_0_rgba(192,132,252,0.7)]'
                        : 'shadow-[inset_3px_0_0_rgba(75,85,99,0.9)]'
                )}>
                  <div className="mb-2 flex flex-wrap items-center gap-2 font-mono text-[10px] text-neutral-500">
                    <span className="text-cyan-300">Node {index + 1}</span>
                    <span>{node.node}</span>
                    {node.next.length > 0 && (
                      <span className="flex flex-wrap items-center gap-1 text-neutral-600">
                        →
                        {node.next.map((id) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => document.getElementById(`dialogue-node-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                            className="cursor-pointer rounded bg-cyan-500/10 px-1.5 py-0.5 text-cyan-300 hover:bg-cyan-500/20"
                          >
                            {id.slice(0, 8)}
                          </button>
                        ))}
                      </span>
                    )}
                  </div>
                  {node.details.length > 0 && (
                    <div className="mb-2 space-y-1 rounded border border-[#1f2329] bg-[#0c0d0f] px-2 py-1.5 font-mono text-[10px] leading-4 text-neutral-500">
                      {node.details.map((detail, detailIndex) => (
                        <div key={`${node.node}:detail:${detailIndex}`}>{detail}</div>
                      ))}
                    </div>
                  )}
                  {nodeEntries.length === 0 ? (
                    <div className="text-xs italic text-neutral-600">No matching localization string</div>
                  ) : (
                    <div className="space-y-2">
                      {uniqueNodeEntries.map((entry) => (
                        <div key={entry.rowId} className="grid grid-cols-1 gap-3 p-2 md:grid-cols-2">
                          <div>
                            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                              <span className={cn(
                                'inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold',
                                (trustedOnlineMeta?.kind ?? getDialogueKind(entry.source, node)) === 'Question'
                                  ? 'border-blue-400/30 bg-blue-500/15 text-blue-300'
                                  : (trustedOnlineMeta?.kind ?? getDialogueKind(entry.source, node)) === 'Cinematic'
                                    ? 'border-purple-400/30 bg-purple-500/15 text-purple-300'
                                    : (trustedOnlineMeta?.kind ?? getDialogueKind(entry.source, node)) === 'Technical'
                                      ? 'border-neutral-700 bg-neutral-800 text-neutral-400'
                                      : 'border-emerald-400/30 bg-emerald-500/15 text-emerald-300'
                              )}>
                                {trustedOnlineMeta?.kind ?? getDialogueKind(entry.source, node)}
                              </span>
                              {(trustedOnlineMeta?.speaker ?? getDialogueSpeaker(entry.source, node)) && (
                                <span className="inline-flex rounded border border-cyan-400/25 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-medium text-cyan-300">
                                  Speaker: {trustedOnlineMeta?.speaker ?? getDialogueSpeaker(entry.source, node)}
                                </span>
                              )}
                            </div>
                            <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-600">
                              Source
                              <button
                                type="button"
                                aria-label="Copy source"
                                title="Copy source"
                                onClick={(event) => handleCopySource(event, entry.source)}
                                className="inline-flex h-5 cursor-pointer items-center rounded px-1.5 text-neutral-400 transition-colors hover:bg-[#1c1f24] hover:text-neutral-200"
                              >
                                <Copy size={11} />
                              </button>
                            </div>
                            <div className="text-xs leading-5 text-neutral-200">{entry.source}</div>
                            <button
                              type="button"
                              onClick={() => focusOnlineNode(node.node, entry.source)}
                              className="mt-1.5 inline-flex h-6 cursor-pointer items-center rounded border border-cyan-500/20 bg-cyan-500/8 px-2 text-[10px] font-medium text-cyan-300 transition-colors hover:bg-cyan-500/15"
                            >
                              Show in graph
                            </button>
                          </div>
                          <div>
                            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-500/70">Translation</div>
                            <textarea
                              defaultValue={entry.target}
                              onBlur={(event) => updateDialogueTarget(entry, event.currentTarget.value)}
                              placeholder="Translate here..."
                              rows={2}
                              className="min-h-14 w-full resize-y rounded border border-[#2a2f37] bg-[#0c0d0f] px-2 py-1.5 text-xs leading-5 text-amber-200 outline-none transition-colors focus:border-amber-500/60"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
        </div>
      </div>
    </div>
  )

  void dialogueModal

  const handleEnterKey = (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
    entry: TranslationSessionEntry
  ) => {
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()

    const value = event.currentTarget.value
    updateEntryTarget(entry, value)
    markSticky(entry.rowId)
    setEditingRowId(null)
    savedByEnterRef.current.add(entry.rowId)

    const nextIndex = pageEntries.findIndex((item) => item.rowId === entry.rowId) + 1
    const nextEntry = pageEntries[nextIndex]
    if (!nextEntry) return

    const nextTextarea = textareaRefs.current.get(nextEntry.rowId)
    if (!nextTextarea) return
    nextTextarea.focus()
    nextTextarea.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }

  const btnBase =
    'inline-flex h-7 cursor-pointer items-center rounded border border-[#1f2329] bg-[#131518] px-2 text-xs font-medium text-neutral-400 transition-colors hover:border-[#2a2f37] hover:text-neutral-200 disabled:cursor-not-allowed disabled:opacity-40'

  const PaginationFooter = (
    <div className="translation-pagination-footer flex shrink-0 items-center justify-between gap-4 border-t border-[#1f2329] bg-[#0c0d0f] px-5 py-2">
      <div className="translation-pagination-controls flex items-center gap-2">
        <span className="translation-page-indicator font-mono text-[11px] tabular-nums text-neutral-500">
          {currentPage} of {totalPages}
        </span>
        <button
          type="button"
          className="translation-page-menu-trigger font-mono text-[11px] tabular-nums text-neutral-500"
          onClick={() => setMobilePageMenuOpen((open) => !open)}
          aria-expanded={mobilePageMenuOpen}
        >
          {currentPage} of {totalPages}
          <ChevronDown size={12} />
        </button>
        {mobilePageMenuOpen && (
          <div className="translation-page-menu-popover" role="menu" aria-label="Rows per page">
            {([100, 250, 500, 1000] as const).map((size) => (
              <button
                key={size}
                type="button"
                role="menuitem"
                className={cn(size === pageSize && "is-selected")}
                onClick={() => {
                  setPageSize(size)
                  setCurrentPage(1)
                  setMobilePageMenuOpen(false)
                }}
              >
                {size}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={btnBase}
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(1)}
          >
            <ChevronsLeft size={16} aria-hidden="true" />{t('grid.pagination.first', { ns: 'translate' })}
          </button>
          <button
            type="button"
            className={btnBase}
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
          >
            <ChevronLeft size={18} aria-hidden="true" />{t('grid.pagination.prev', { ns: 'translate' })}
          </button>
          <button
            type="button"
            className={btnBase}
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
          >
            {t('grid.pagination.next', { ns: 'translate' })}<ChevronRight size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={btnBase}
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(totalPages)}
          >
            {t('grid.pagination.last', { ns: 'translate' })}<ChevronsRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )

  // Keep enough scroll room for the floating pagination dock so the final
  // translation row can always be brought fully above it.
  const paginationBottomSpacer = 96

  const filterItems: Array<{
    mode: FilterMode
    label: string
    count: number
    dot?: string
  }> = [
    {
      mode: 'untranslated',
      label: t('grid.untranslated', { ns: 'translate' }),
      count: counts.untranslated,
      dot: 'bg-emerald-400'
    },
    {
      mode: 'translated',
      label: t('grid.translated', { ns: 'translate' }),
      count: counts.translated,
      dot: 'bg-blue-400'
    },
    {
      mode: 'tags',
      label: t('grid.tags', { ns: 'translate' }),
      count: counts.tags,
      dot: 'bg-purple-400'
    },
    {
      mode: 'needs-review',
      label: t('grid.needsReview', { ns: 'translate' }),
      count: entries.filter((entry) => entry.needsReview).length,
      dot: 'bg-orange-400'
    }
  ]

  const statusTabs = (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      {dialogueScope && (
        <button
          type="button"
          title="Clear dialogue scope"
          onClick={() => setDialogueScope(null)}
          className="inline-flex h-7 max-w-60 shrink-0 cursor-pointer items-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 text-[11px] font-semibold text-cyan-300 hover:bg-cyan-500/20"
        >
          <GitBranch size={11} />
          <span className="truncate">{dialogueScope.dialogue}</span>
          <X size={11} />
        </button>
      )}
      <button
        type="button"
        onClick={() => startFilterTransition(() => setFilter('all'))}
        className={cn(
          'inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-semibold transition-colors',
          filter === 'all'
            ? 'border-neutral-400/50 bg-neutral-400/10 text-neutral-200'
            : 'border-transparent text-neutral-400 hover:border-[#2a2f37] hover:bg-[#181b1f] hover:text-neutral-200'
        )}
      >
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-neutral-400" />
        All
        <span className={cn(
          'rounded-full px-1.5 py-0.5 font-mono text-[10px] tabular-nums',
          filter === 'all' ? 'bg-neutral-400/20 text-neutral-200' : 'bg-[#181b1f] text-neutral-500'
        )}>
          {entries.length}
        </span>
      </button>
      {filterItems.map((item) => {
        const active = filter === item.mode
        return (
          <button
            key={item.mode}
            type="button"
            onClick={() => startFilterTransition(() => setFilter(item.mode))}
            className={cn(
              'inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-semibold transition-colors',
                active
                ? item.mode === 'untranslated'
                  ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-200'
                  : item.mode === 'translated'
                    ? 'border-blue-400/50 bg-blue-400/10 text-blue-200'
                    : item.mode === 'tags'
                      ? 'border-purple-400/50 bg-purple-400/10 text-purple-200'
                      : 'border-orange-400/50 bg-orange-400/10 text-orange-200'
                : 'border-transparent text-neutral-400 hover:border-[#2a2f37] hover:bg-[#181b1f] hover:text-neutral-200'
            )}
          >
            <span className={cn('inline-block h-1.5 w-1.5 rounded-full', item.dot)} />
            {item.label}
            <span className={cn(
              'rounded-full px-1.5 py-0.5 font-mono text-[10px] tabular-nums',
              active && item.mode === 'untranslated'
                ? 'bg-emerald-400/20 text-emerald-200'
                : active && item.mode === 'translated'
                  ? 'bg-blue-400/20 text-blue-200'
                  : active && item.mode === 'tags'
                    ? 'bg-purple-400/20 text-purple-200'
                    : active
                      ? 'bg-orange-400/20 text-orange-200'
                      : 'bg-[#181b1f] text-neutral-500'
            )}>
              {item.count}
            </span>
          </button>
        )
      })}
      <button
        type="button"
        aria-label={t('grid.refreshView', { ns: 'translate' })}
        title={t('grid.refreshView', { ns: 'translate' })}
        disabled={stickyRowIds.size === 0}
        onClick={() => setStickyRowIds(new Set())}
        className={cn(btnBase, 'h-7 gap-1.5 disabled:cursor-not-allowed disabled:opacity-40')}
      >
        <RefreshCw size={12} />
        {stickyRowIds.size > 0 && (
          <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-amber-400">
            {t('grid.refreshViewHidden', { ns: 'translate', count: stickyRowIds.size })}
          </span>
        )}
      </button>
      {isPending && (
        <span className="rounded-full border border-[#2a2f37] bg-[#181b1f] px-2 py-0.5 text-[10px] font-mono text-amber-400">
          {t('status.updating', { ns: 'common' })}
        </span>
      )}
    </div>
  )

  const searchBar = (
    <div className="translation-search-bar flex min-w-0 shrink-0 flex-col gap-1 overflow-visible border-b border-[#1f2329] bg-[#0c0d0f] px-5 py-1">
      <div className="translation-search-controls flex min-w-0 flex-wrap items-center gap-3 overflow-visible">
      <div className="flex h-8 w-[clamp(220px,24vw,300px)] min-w-45 max-w-full flex-none items-center gap-2 rounded-md border border-[#1f2329] bg-[#131518] px-3 transition-colors focus-within:border-neutral-600">
        <Search size={13} className="shrink-0 text-neutral-500" />
        <input
          ref={searchInputRef}
          value={search}
          onChange={(event) => {
            const value = event.target.value
            // Keep the controlled input synchronous; only the expensive filtering is delayed below.
            setSearch(value)
          }}
          placeholder={t('grid.searchPlaceholder', { ns: 'translate' })}
          className="min-w-0 flex-1 bg-transparent text-xs font-medium text-neutral-300 placeholder:text-neutral-600 focus:outline-none"
        />
        {search && (
          <button type="button" onClick={() => setSearch('')} className="shrink-0 cursor-pointer">
            <X size={13} className="text-neutral-500 transition-colors hover:text-neutral-300" />
          </button>
        )}
        <span className="shortcut-hint inline-flex h-5 min-w-6 items-center justify-center rounded border border-[#2a2f37] bg-[#0f1114] px-1 font-mono text-[10px] text-neutral-500">
          Ctrl F
        </span>
      </div>

      <label className="inline-flex h-8 shrink-0 cursor-pointer select-none items-center gap-2 rounded-md border border-[#1f2329] bg-[#131518] px-3 text-xs font-semibold text-neutral-400 transition-colors hover:border-[#2a2f37] hover:text-neutral-200">
        <input
          type="checkbox"
          checked={exactMatch}
          onChange={(event) => {
            const checked = event.target.checked
            startFilterTransition(() => setExactMatch(checked))
          }}
          className="cursor-pointer accent-amber-500"
        />
        <span title={t('grid.exactMatch', { ns: 'translate' })}>Exact</span>
      </label>

      <label
        title="Show content ID"
        className="inline-flex h-8 shrink-0 cursor-pointer select-none items-center gap-2 rounded-md border border-[#1f2329] bg-[#131518] px-3 text-xs font-semibold text-neutral-400 transition-colors hover:border-[#2a2f37] hover:text-neutral-200"
      >
        <input
          type="checkbox"
          checked={showId}
          onChange={(event) => setShowId(event.target.checked)}
          className="cursor-pointer accent-sky-500"
        />
        ID
      </label>

      </div>

      <div className="hidden">
        {dialogueScope && (
          <button
            type="button"
            title="Clear dialogue scope"
            onClick={() => setDialogueScope(null)}
            className="inline-flex h-8 max-w-72 shrink-0 cursor-pointer items-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20"
          >
            <GitBranch size={12} />
            <span className="truncate">{dialogueScope.dialogue}</span>
            <X size={12} />
          </button>
        )}
        <button
          type="button"
          onClick={() => startFilterTransition(() => setFilter('all'))}
          className={cn(
            'flex h-8 cursor-pointer items-center gap-2 rounded-md border px-3 text-xs font-semibold transition-colors focus:outline-none focus-visible:border-[#2a2f37] focus-visible:bg-[#181b1f] focus-visible:text-neutral-100',
            filter === 'all'
              ? 'border-[#2a2f37] bg-[#181b1f] text-neutral-100'
              : 'border-transparent text-neutral-400 hover:border-[#2a2f37] hover:bg-[#181b1f] hover:text-neutral-200'
          )}
        >
          {t('grid.all', { ns: 'translate' })}
          <span className="rounded-full bg-[#181b1f] px-1.5 py-0.5 text-[11px] tabular-nums text-neutral-500">
            {entries.length}
          </span>
        </button>

        {filterItems.map((item) => {
          const active = filter === item.mode
          return (
            <button
              key={item.mode}
              type="button"
              onClick={() => startFilterTransition(() => setFilter(item.mode))}
              className={cn(
                'flex h-8 cursor-pointer items-center gap-2 rounded-md border px-2 text-xs font-semibold transition-colors focus:outline-none focus-visible:border-[#2a2f37] focus-visible:bg-[#181b1f] focus-visible:text-neutral-100',
                active
                  ? 'border-[#2a2f37] bg-[#181b1f] text-neutral-100'
                  : 'border-transparent text-neutral-400 hover:border-[#2a2f37] hover:bg-[#181b1f] hover:text-neutral-200'
              )}
            >
              <span className={cn('inline-block h-1.5 w-1.5 shrink-0 rounded-full', item.dot)} />
              {item.label}
              <span className="rounded-full bg-[#181b1f] px-1.5 py-0.5 text-[11px] tabular-nums text-neutral-600">
                {item.count}
              </span>
            </button>
          )
        })}

        <button
          type="button"
          aria-label={t('grid.refreshView', { ns: 'translate' })}
          title={t('grid.refreshView', { ns: 'translate' })}
          disabled={stickyRowIds.size === 0}
          onClick={() => setStickyRowIds(new Set())}
          className={cn(btnBase, 'gap-1.5 disabled:cursor-not-allowed disabled:opacity-40')}
        >
          <RefreshCw size={12} />
          {stickyRowIds.size > 0 && (
            <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-amber-400">
              {t('grid.refreshViewHidden', { ns: 'translate', count: stickyRowIds.size })}
            </span>
          )}
        </button>
      </div>

      <div className="hidden">
        {isPending && (
          <span className="rounded-full border border-[#2a2f37] bg-[#181b1f] px-2 py-0.5 text-[10px] font-mono text-amber-400">
            {t('status.updating', { ns: 'common' })}
          </span>
        )}
        {showTranslationCounters && (
          <span className="font-mono tabular-nums text-neutral-500">
            {t('grid.selectedStats', {
              ns: 'translate',
              strings: selectedStats.selectedStrings,
              characters: selectedStats.selectedCharacters
            })}
          </span>
        )}
      </div>
    </div>
  )

  const statusTabsPortal = statusTabsTarget ? createPortal(statusTabs, statusTabsTarget) : null

  if (viewMode === 'side') {
    return (
      <div className="flex h-full min-h-0 flex-col">
        {searchBar}
        {statusTabsPortal}

        <div
          className="translate-grid-header grid shrink-0 select-none border-b border-[#1f2329] bg-[#0f1114] pr-3"
          style={{ gridTemplateColumns: '56px 1fr 1fr' }}
        >
          <div className="flex items-center justify-center border-r border-[#1f2329] px-3 py-2">
            <input
              type="checkbox"
              checked={allFiltered}
              onChange={(event) => handleSelectAll(event.target.checked)}
              className="cursor-pointer accent-amber-500"
            />
          </div>
          <div className="px-4 py-2 text-[10px] font-semibold tracking-[0.08em] text-neutral-500 uppercase">
            {t('grid.sourceHeader', {
              ns: 'translate',
              language: sourceLang.toUpperCase()
            })}
          </div>
          <div className="border-l border-[#1f2329] px-4 py-2 text-[10px] font-semibold tracking-[0.08em] text-neutral-500 uppercase">
            {t('grid.translationHeader', {
              ns: 'translate',
              language: targetLang.toUpperCase()
            })}
          </div>
        </div>

        <div
          ref={sideParentRef}
          className="translate-grid-scroll icosa-scroll min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]"
        >
          <div style={{ height: sideVirtualizer.getTotalSize() + paginationBottomSpacer, position: 'relative' }}>
            {sideVirtualizer.getVirtualItems().map((virtualItem) => {
              const entry = pageEntries[virtualItem.index]
              const category = getCategory(entry)
              const isDone = entry.target.trim() !== ''
              const isRowSelected = isSelected(entry.rowId)
              const isDictionary = category === 'dictionary'
              const occurrenceCount = session.sourceFrequencies.get(entry.source) ?? 0
              const targetOccurrenceCount = session.targetFrequencies.get(entry.target) ?? 0
              const itemTags = getItemTags(entry.source)
              const dialogueGroups = getDialogueGroups(entry.source)
              const linkedReferences = deferredLinkNameDescription
                ? getReferenceLinks(entry.source)
                : []
              const globalIndex = (currentPage - 1) * pageSize + virtualItem.index

              return (
                <div
                  key={entry.rowId}
                  data-index={virtualItem.index}
                  ref={sideVirtualizer.measureElement}
                  className={cn(
                    'translate-entry-row group grid border-b border-[#1f2329] hover:bg-[#131518]/60 focus-within:bg-[#131518] focus-within:shadow-[inset_3px_0_0_#f59e0b]',
                    isRowSelected && 'bg-blue-950/10'
                  )}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualItem.start}px)`,
                    gridTemplateColumns: '56px 1fr 1fr'
                  }}
                >
                  <div
                    className="translate-index-cell flex cursor-pointer flex-col items-center gap-2 border-r border-[#1f2329] bg-[#0f1114] px-3 py-3"
                    onClick={() => focusEntry(entry.rowId)}
                  >
                    <input
                      type="checkbox"
                      checked={isRowSelected}
                      onChange={() => toggleEntry(entry.rowId)}
                      onClick={(event) => event.stopPropagation()}
                      className="cursor-pointer accent-amber-500"
                    />
                    <span className="font-mono text-[11px] tabular-nums text-neutral-600">
                      {String(globalIndex + 1).padStart(3, '0')}
                    </span>
                    <span
                      className={cn(
                        'mt-auto h-1.5 w-1.5 rounded-full transition-colors',
                        isDone ? 'bg-amber-500' : 'bg-neutral-700'
                      )}
                    />
                  </div>

                  <div className="translate-source-cell flex min-w-0 cursor-text flex-col gap-2 px-4 py-3">
                    <div className="wrap-break-word font-mono text-[13px] leading-[1.6] text-neutral-200 whitespace-pre-wrap">
                      {entry.source ? (
                        renderSource(entry.source)
                      ) : (
                        <span className="italic text-neutral-600">
                          {t('grid.emptySource', { ns: 'translate' })}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {isDictionary && (
                        <span className="inline-flex items-center gap-1 rounded bg-blue-500/12 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-blue-400">
                          <BookOpen size={10} /> D <span className="text-blue-500/70">1</span>
                        </span>
                      )}
                      <ItemTags tags={itemTags} />
                      <DialogueTags tags={getDialogueFilterTags(entry.source)} />
                      <ReferenceLinks links={linkedReferences} />
                      {showTranslationCounters && (
                        <span className="font-mono text-[10px] text-neutral-500">
                          {t('grid.charCount', { ns: 'translate', count: entry.source.length })}
                        </span>
                      )}
                      {showId && (
                        <div className="basis-full font-mono text-[10px] text-neutral-500">
                          {entry.uid}
                        </div>
                      )}
                      {occurrenceCount > 1 && (
                        <span className="inline-flex items-center rounded bg-amber-500/12 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-amber-400">
                          {t('grid.appearsCount', {
                            ns: 'translate',
                            count: occurrenceCount
                          })}
                        </span>
                      )}
                      <span className="ml-auto">
                        {dialogueGroups.length > 0 && (
                          <button
                            type="button"
                            title="Show dialogue nodes"
                            onClick={(event) => {
                              event.stopPropagation()
                              openDialogueForEntry(entry)
                            }}
                            className="inline-flex h-6 cursor-pointer items-center gap-1 rounded bg-transparent px-2 text-[11px] text-cyan-300 transition-colors hover:bg-[#1c1f24]"
                          >
                            <GitBranch size={11} />
                          </button>
                        )}
                        <button
                          type="button"
                          aria-label={t('grid.copySource', { ns: 'translate' })}
                          title={t('grid.copySource', { ns: 'translate' })}
                          className="inline-flex h-6 cursor-pointer items-center gap-1 rounded bg-transparent px-2 text-[11px] text-neutral-400 transition-colors hover:bg-[#1c1f24] hover:text-neutral-200"
                          onClick={(event) => handleCopySource(event, entry.source)}
                        >
                          <Copy size={11} />
                        </button>
                      </span>
                    </div>
                  </div>

                  <div
                    className="translate-target-cell flex min-w-0 flex-col gap-2 border-l border-[#1f2329] px-4 py-3"
                    onClick={(event) => event.stopPropagation()}
                  >                    <HighlightedTextarea
                      ref={(element) => {
                        if (element) textareaRefs.current.set(entry.rowId, element)
                        else textareaRefs.current.delete(entry.rowId)
                      }}
                      value={genderValue(entry)}
                      onFocus={() => setEditingRowId(entry.rowId)}
                      onBlur={(event) => { updateGenderValue(entry, event.target.value); markSticky(entry.rowId); setEditingRowId(null) }}
                      onKeyDown={(event) => handleEnterKey(event, entry)}
                      rows={1}
                      placeholder={t('grid.translationPlaceholder', { ns: 'translate' })}
                      containerClassName="rounded-md"
                      className="field-sizing-content"
                    />
                    <div className="flex items-center gap-1.5">
                      {entry.target && targetOccurrenceCount > 1 && (
                        <span className="inline-flex items-center rounded bg-amber-500/12 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-amber-400">
                          {t('grid.appearsCount', {
                            ns: 'translate',
                            count: targetOccurrenceCount
                          })}
                        </span>
                      )}
                      {renderGenderControls(entry)}
                      {renderAiButton(entry)}
                      {renderReviewButton(entry)}
                      <div className="pointer-events-none flex flex-1 items-center gap-1.5 opacity-0 transition-opacity duration-150 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
                        <span className="ml-auto flex items-center gap-1 text-[11px] text-neutral-500">
                          <KbdHint>Enter</KbdHint> {t('grid.next', { ns: 'translate' })}
                          <span className="mx-1 text-neutral-700">-</span>
                          <KbdHint>Shift Enter</KbdHint> {t('grid.newLine', { ns: 'translate' })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {PaginationFooter}
        {aiModal}
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {searchBar}
      {statusTabsPortal}

      <div className="flex shrink-0 select-none items-center gap-2 border-b border-[#1f2329] bg-[#0f1114] px-7 py-2">
        <input
          type="checkbox"
          checked={allFiltered}
          onChange={(event) => handleSelectAll(event.target.checked)}
          className="cursor-pointer accent-amber-500"
        />
        <span className="text-[11px] font-medium tabular-nums text-neutral-500">
          {t('grid.entries', { ns: 'translate', count: filteredEntries.length })}
        </span>
      </div>

      <div ref={stackedParentRef} className="translate-grid-scroll icosa-scroll min-h-0 flex-1 overflow-y-auto">
        <div style={{ height: stackedVirtualizer.getTotalSize() + paginationBottomSpacer, position: 'relative' }}>
          {stackedVirtualizer.getVirtualItems().map((virtualItem) => {
            const entry = pageEntries[virtualItem.index]
            const category = getCategory(entry)
            const isDone = entry.target.trim() !== ''
            const isRowSelected = isSelected(entry.rowId)
            const isDictionary = category === 'dictionary'
            const hasTags = hasXmlTags(entry)
            const charCount = entry.source.length
            const occurrenceCount = session.sourceFrequencies.get(entry.source) ?? 0
            const targetOccurrenceCount = session.targetFrequencies.get(entry.target) ?? 0
            const itemTags = getItemTags(entry.source)
            const dialogueGroups = getDialogueGroups(entry.source)
            const linkedReferences = deferredLinkNameDescription
              ? getReferenceLinks(entry.source)
              : []
            const rows = Math.max(2, Math.ceil(charCount / 70))
            const globalIndex = (currentPage - 1) * pageSize + virtualItem.index

            return (
              <div
                key={entry.rowId}
                data-index={virtualItem.index}
                ref={stackedVirtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  // 20px offset = pt-5 top padding
                  transform: `translateY(${virtualItem.start + 20}px)`,
                  paddingLeft: '28px',
                  paddingRight: '28px',
                  paddingBottom: '14px'
                }}
              >
                <div className="mx-auto max-w-275">
                  <div
                    className={cn(
                      'translate-entry-card group grid cursor-default overflow-hidden rounded-xl border transition-[background-color,box-shadow,transform] duration-120',
                      'border-[#1f2329] bg-[#0f1114]',
                      'hover:-translate-y-px hover:border-[#2a2f37] hover:shadow-[0_4px_16px_rgba(0,0,0,0.18)]',
                      'focus-within:border-amber-500 focus-within:shadow-[0_0_0_3px_rgba(245,158,11,0.25),0_8px_24px_rgba(0,0,0,0.24)]',
                      isRowSelected && 'border-blue-700/40 bg-blue-950/10'
                    )}
                    style={{ gridTemplateColumns: '56px 1fr' }}
                    onClick={() => focusEntry(entry.rowId)}
                  >
                    <div className="flex flex-col items-center gap-3 border-r border-[#1f2329] bg-[#0c0d0f] py-4.5">
                      <input
                        type="checkbox"
                        checked={isRowSelected}
                        onChange={() => toggleEntry(entry.rowId)}
                        onClick={(event) => event.stopPropagation()}
                        className="cursor-pointer accent-amber-500"
                      />


                      <span
                        className="mt-auto font-mono text-[11px] tracking-widest text-neutral-600"
                        style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                      >
                        #{String(globalIndex + 1).padStart(3, '0')}
                      </span>

                      <div
                        className={cn(
                          'flex h-5.5 w-5.5 items-center justify-center rounded-full border transition-colors',
                          isDone
                            ? 'border-amber-500 bg-amber-500 text-white'
                            : 'border-[#1f2329] bg-[#131518]'
                        )}
                      >
                        {isDone ? (
                          <Check size={11} strokeWidth={2.5} />
                        ) : (
                          <span className="h-1.5 w-1.5 rounded-full bg-neutral-600" />
                        )}
                      </div>
                    </div>

                    <div
                      className="flex flex-col gap-3 px-5.5 py-4.5"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="flex flex-wrap items-center gap-2.5">
                        <LangTag>{sourceLang.toUpperCase()}</LangTag>
                        {occurrenceCount > 1 && (
                          <span className="inline-flex items-center rounded bg-amber-500/12 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-400">
                            {t('grid.appearsCount', {
                              ns: 'translate',
                              count: occurrenceCount
                            })}
                          </span>
                        )}
                        <ItemTags tags={itemTags} />
                        <DialogueTags tags={getDialogueFilterTags(entry.source)} />
                        <ReferenceLinks links={linkedReferences} />
                        {showTranslationCounters && (
                          <span className="font-mono text-[10px] text-neutral-500">
                            {t('grid.charCount', { ns: 'translate', count: entry.source.length })}
                          </span>
                        )}
                        {showId && (
                          <div className="basis-full font-mono text-[10px] text-neutral-500">
                            {entry.uid}
                          </div>
                        )}
                        <span className="flex-1" />
                        {isDictionary && (
                          <span className="inline-flex items-center gap-1 rounded bg-blue-500/12 px-2 py-0.5 text-[11px] font-medium text-blue-400">
                            <BookOpen size={11} />
                            {entry.matchType === 'mod-text'
                              ? t('grid.dictionaryTagMod', { ns: 'translate' })
                              : t('grid.dictionaryTag', { ns: 'translate' })}
                          </span>
                        )}
                        {hasTags && (
                          <span className="inline-flex items-center gap-1 rounded bg-purple-500/14 px-2 py-0.5 text-[11px] font-medium text-purple-300">
                            <AlertTriangle size={11} />{' '}
                            {t('grid.containsTags', { ns: 'translate' })}
                          </span>
                        )}
                        {dialogueGroups.length > 0 && (
                          <button
                            type="button"
                            title="Show dialogue nodes"
                            onClick={(event) => {
                              event.stopPropagation()
                              openDialogueForEntry(entry)
                            }}
                            className="inline-flex h-6 cursor-pointer items-center gap-1 rounded bg-transparent px-2 text-[11px] text-cyan-300 transition-colors hover:bg-[#1c1f24]"
                          >
                            <GitBranch size={11} />
                          </button>
                        )}
                        <button
                          type="button"
                          aria-label={t('grid.copySource', { ns: 'translate' })}
                          title={t('grid.copySource', { ns: 'translate' })}
                          className="inline-flex h-6 cursor-pointer items-center gap-1 rounded bg-transparent px-2 text-[11px] text-neutral-400 transition-colors hover:bg-[#1c1f24] hover:text-neutral-200"
                          onClick={(event) => handleCopySource(event, entry.source)}
                        >
                          <Copy size={11} />
                        </button>
                      </div>

                      <div className="wrap-break-word font-mono text-[14px] leading-[1.65] text-neutral-200 whitespace-pre-wrap">
                        {entry.source ? (
                          renderSource(entry.source)
                        ) : (
                          <span className="italic text-neutral-600">
                            {t('grid.emptySource', { ns: 'translate' })}
                          </span>
                        )}
                      </div>

                      {isDictionary && (
                        <div className="hidden flex-wrap items-center gap-2 rounded-lg border border-dashed border-[#2a2f37] bg-[#0c0d0f] px-3 py-2 group-focus-within:flex">
                          <span className="text-[11px] font-semibold tracking-[0.08em] text-neutral-500 uppercase">
                            {t('grid.dictionarySuggestion', { ns: 'translate' })}
                          </span>
                          <button
                            type="button"
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[#1f2329] bg-[#0f1114] px-2.5 py-0.5 text-[12px] transition-colors hover:border-amber-500 hover:bg-amber-500/10"
                            onClick={() => {
                              onEntryChange(entry.rowId, entry.target)
                            }}
                          >
                            <span className="font-mono text-neutral-400">
                              {entry.source.slice(0, 24)}
                              {entry.source.length > 24 ? '...' : ''}
                            </span>
                            <span className="text-neutral-600">-&gt;</span>
                            <span className="font-medium text-neutral-200">
                              {entry.target || '-'}
                            </span>
                          </button>
                        </div>
                      )}

                      <div className="order-3 mt-1 flex items-center gap-2.5 border-t border-dashed border-[#1f2329] pt-1">
                        <LangTag accent>{targetLang.toUpperCase()}</LangTag>
                        {entry.target && targetOccurrenceCount > 1 && (
                          <span className="inline-flex items-center rounded bg-amber-500/12 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-400">
                            {t('grid.appearsCount', {
                              ns: 'translate',
                              count: targetOccurrenceCount
                            })}
                          </span>
                        )}
                      {renderGenderControls(entry)}
                        {renderAiButton(entry)}
                        {renderReviewButton(entry)}
                        <div className="pointer-events-none flex flex-1 items-center gap-1.5 opacity-0 transition-opacity duration-150 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
                          <button
                            type="button"
                            className="inline-flex h-6 cursor-pointer items-center gap-1 rounded bg-transparent px-2 text-[11px] text-neutral-400 transition-colors hover:bg-[#1c1f24] hover:text-neutral-200"
                          >
                            <Check size={11} /> {t('grid.markTranslated', { ns: 'translate' })}
                          </button>
                          <span className="flex-1" />
                          <span className="flex items-center gap-1 text-[11px] text-neutral-500">
                            <KbdHint>Enter</KbdHint> {t('grid.next', { ns: 'translate' })}
                            <span className="mx-0.5 text-neutral-700">-</span>
                            <KbdHint>Shift Enter</KbdHint> {t('grid.newLine', { ns: 'translate' })}
                          </span>
                        </div>
                      </div>                    <HighlightedTextarea
                        ref={(element) => {
                          if (element) textareaRefs.current.set(entry.rowId, element)
                          else textareaRefs.current.delete(entry.rowId)
                        }}
                      value={genderValue(entry)}
                      onFocus={() => setEditingRowId(entry.rowId)}
                      onBlur={(event) => { updateGenderValue(entry, event.target.value); markSticky(entry.rowId); setEditingRowId(null) }}
                        onKeyDown={(event) => handleEnterKey(event, entry)}
                        rows={rows}
                        placeholder={isDone ? '' : t('grid.startTyping', { ns: 'translate' })}
                        containerClassName="min-h-11 rounded-lg border-[#1f2329] bg-[#0c0d0f] focus-within:border-amber-500 focus-within:shadow-[0_0_0_3px_rgba(245,158,11,0.25)]"
                        overlayClassName="px-3.5 py-3 text-[13px] leading-[1.6]"
                        className="min-h-11 px-3.5 py-3 text-[13px] leading-[1.6]"
                      />
                      </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {PaginationFooter}
      {aiModal}
    </div>
  )
}
