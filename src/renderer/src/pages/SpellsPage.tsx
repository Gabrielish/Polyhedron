import {
  ArrowRight,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  CornerDownRight,
  Circle,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleX,
  BookText,
  Flag,
  Hash,
  LayoutGrid,
  List,
  Lightbulb,
  Pencil,
  Search,
  Sparkles,
  Sword,
  WandSparkles,
  X,
  Zap
} from 'lucide-react'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import spellsData from '@/data/spells.json'
import { useTranslationSession, type ReviewStatus } from '@/context/TranslationSession'
import { getReferenceCatalog } from '@/data/gameReference'
import { HighlightedTextarea } from '@/components/shared/HighlightedTextarea'
import { renderSource as renderSourceBase } from '@/utils/renderSource'
import { SessionSaveButton } from '@/features/translate/components/SessionSaveButton'
import { TermGlossaryModal } from '@/features/translate/components/TermGlossaryModal'
import {
  getTermGlossaryStorageKey,
  loadTermGlossary,
  type TermGlossaryEntry
} from '@/utils/termGlossary'
import { btnGhostIcon } from '@/features/translate/components/styles'

type GameEntry = ReturnType<typeof getReferenceCatalog>[number]
type DisplayEntry = GameEntry & { displayKind?: EntryKind; wikiUrl?: string }
type WikiVariant = { name: string; description: string }
type EntryKind = 'spell' | 'action' | 'bonus' | 'ritual' | 'monster' | 'condition'
type SpellsViewMemory = {
  query?: string
  kind?: 'all' | EntryKind
  sort?: 'alpha' | 'level' | 'complete' | 'incomplete'
  view?: 'cards' | 'list'
  status?: 'all' | ReviewStatus
}
const SPELLS_VIEW_MEMORY_KEY = 'polyhedron.spells-view'

const kindLabel: Record<EntryKind, string> = {
  spell: 'Spells',
  action: 'Actions',
  bonus: 'Bonus actions',
  ritual: 'Rituals',
  monster: 'Monster abilities',
  condition: 'Conditions'
}

const kindTabs: Array<{
  value: 'all' | EntryKind
  label: string
  icon: typeof WandSparkles
}> = [
  { value: 'spell', label: 'Spells', icon: WandSparkles },
  { value: 'action', label: 'Actions', icon: Sword },
  { value: 'condition', label: 'Conditions', icon: Circle },
  { value: 'monster', label: 'Monster abilities', icon: Flag },
  { value: 'bonus', label: 'Bonus Actions', icon: Zap },
  { value: 'ritual', label: 'Rituals', icon: Sparkles },
  { value: 'all', label: 'All', icon: LayoutGrid }
]

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

const entryLabel = (entry: GameEntry): string => {
  const kind = classifyEntry(entry)
  if (kind === 'action') return 'Action'
  if (kind === 'bonus') return 'Bonus Action'
  if (kind === 'ritual') return 'Ritual'
  if (kind === 'monster') return 'Monster Ability'
  if (entry.level === '0') return 'Cantrip'
  if (entry.level) return `Level ${entry.level} Spell`
  return 'Spell'
}

const EntryIcon = ({ entry }: { entry: DisplayEntry }): React.JSX.Element => {
  const kind = classifyEntry(entry)
  if (kind === 'action') return <Sword size={11} />
  if (kind === 'bonus') return <Zap size={11} />
  if (kind === 'ritual') return <Sparkles size={11} />
  if (kind === 'monster') return <Flag size={11} />
  if (kind === 'condition') return <Circle size={11} />
  return <WandSparkles size={11} />
}

const spellLevelLabel = (entry: GameEntry): string => {
  if (entry.level === '0') return 'Cantrips'
  if (entry.level) return `Level ${entry.level} spells`
  return 'Other spells'
}

const spellLevelRank = (entry: GameEntry): number => {
  if (entry.level === '0') return 0
  if (!(entry.level ?? '').trim()) return 50
  const level = Number(entry.level)
  return Number.isFinite(level) ? level : 50
}

const classifyEntry = (entry: DisplayEntry): EntryKind => {
  if (entry.displayKind) return entry.displayKind
  const id = entry.id ?? ''
  const flags = entry.flags ?? ''
  const icon = entry.icon ?? ''
  const useCosts = entry.useCosts ?? ''
  if (/^Chromatic Orb:/i.test(entry.name)) return 'spell'
  if (entry.category === 'Spell' && /(?:IsSpell|SpellSlotsGroup)/i.test(`${flags} ${useCosts}`)) {
    return 'spell'
  }
  if (/IsEnemySpell|Monster|_LOW_/i.test(`${flags} ${id} ${icon}`)) return 'monster'
  if (/ritual/i.test(`${entry.name} ${id} ${flags}`)) return 'ritual'
  if (/BonusActionPoint/i.test(useCosts) && !/^Spell_/i.test(icon)) return 'bonus'
  if (/^Action_|SpellActionType/i.test(`${icon} ${entry.actionType ?? ''}`)) return 'action'
  return 'spell'
}

const normalize = (value: string): string =>
  value
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,!?])/g, '$1')
    .trim()
    .toLocaleLowerCase()

const isMarkupOnlyDescription = (value: string): boolean => {
  const compact = value.replace(/\s+/g, '').toLocaleLowerCase()
  return !compact || /^(?:<br\s*\/?>(?:<br\s*\/?>)*)$/.test(compact)
}

function SpellSearchInput({
  initialValue,
  onSearch,
  inputRef
}: {
  initialValue: string
  onSearch: (value: string) => void
  inputRef?: React.RefObject<HTMLInputElement | null>
}): React.JSX.Element {
  const [value, setValue] = useState(initialValue)
  const [pending, setPending] = useState(false)
  const shortcutLabel =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform)
      ? '⌘ F'
      : 'Ctrl F'

  useEffect(() => {
    const timer = window.setTimeout(() => {
      onSearch(value)
      setPending(false)
    }, 180)
    return () => window.clearTimeout(timer)
  }, [onSearch, value])

  return (
    <label className="relative w-full min-w-56 sm:flex-1 sm:max-w-none xl:w-auto xl:flex-[2]">
      <Search
        size={14}
        className={`z-10 absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${pending ? 'animate-pulse text-amber-300' : 'text-neutral-400'}`}
      />
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => {
          setValue(event.target.value)
          setPending(true)
        }}
        placeholder="Search spells, actions, abilities..."
        className="h-8 w-full rounded-md border border-[#2a2f37] bg-[#131518] pl-9 pr-16 text-xs text-neutral-200 outline-none focus:border-amber-500/60"
      />
      {pending && (
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-amber-300/80">
          Searching…
        </span>
      )}
      {!pending && (
        <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-[#2a2f37] px-1.5 py-0.5 font-mono text-[10px] text-neutral-500">
          {shortcutLabel}
        </kbd>
      )}
    </label>
  )
}

const wikiIconCache = new Map<string, string | null>()
const wikiIconRequests = new Map<string, Promise<string | null>>()

async function fetchWikiIcon(name: string): Promise<string | null> {
  const key = normalize(name)
  const cached = wikiIconCache.get(key)
  if (cached !== undefined) return cached
  const existing = wikiIconRequests.get(key)
  if (existing) return existing

  const request = (async () => {
    try {
      const baseName = name
        .trim()
        .replace(/[\\/:*?"<>|]+/g, '')
        .replace(/\s+/g, ' ')
      const titles = [
        `File:${baseName}.webp`,
        `File:${baseName} Icon.webp`,
        `File:${baseName} Unfaded Icon.webp`
      ].join('|')
      const params = new URLSearchParams({
        action: 'query',
        titles,
        prop: 'imageinfo',
        iiprop: 'url',
        iiurlwidth: '96',
        format: 'json',
        origin: '*'
      })
      const response = await fetch(`https://bg3.wiki/api.php?${params.toString()}`)
      let image: string | undefined
      if (response.ok) {
        const payload = (await response.json()) as {
          query?: {
            pages?: Record<string, { imageinfo?: Array<{ thumburl?: string; url?: string }> }>
          }
        }
        const pages = Object.values(payload.query?.pages ?? {})
        image = pages
          .map((page) => page.imageinfo?.[0]?.thumburl ?? page.imageinfo?.[0]?.url)
          .find((url): url is string => Boolean(url))
      }
      if (!image) {
        const pageUrl = `https://bg3.wiki/wiki/${encodeURIComponent(baseName.replace(/\s+/g, '_'))}`
        const pageResponse = await fetch(pageUrl)
        if (pageResponse.ok) {
          const document = new DOMParser().parseFromString(await pageResponse.text(), 'text/html')
          const pageImages = [...document.querySelectorAll<HTMLImageElement>('img')]
            .map((element) => element.getAttribute('data-src') || element.getAttribute('src') || '')
            .filter(
              (url) => url.includes('/w/images/') && !/Action_Icon|Prerequisite_Icon/i.test(url)
            )
          const pageImage =
            pageImages[0] ||
            document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content ||
            ''
          image = pageImage ? new URL(pageImage, pageUrl).toString() : undefined
        }
      }
      wikiIconCache.set(key, image ?? null)
      return image ?? null
    } catch {
      wikiIconCache.set(key, null)
      return null
    } finally {
      wikiIconRequests.delete(key)
    }
  })()
  wikiIconRequests.set(key, request)
  return request
}

function WikiIcon({
  name,
  localIcon,
  className
}: {
  name: string
  localIcon?: string
  className?: string
}): React.JSX.Element {
  const key = normalize(name)
  const [source, setSource] = useState(() => localIcon || wikiIconCache.get(key) || '')
  const [directCandidateFailed, setDirectCandidateFailed] = useState(false)

  useEffect(() => {
    if (source || !directCandidateFailed) return
    let cancelled = false
    void fetchWikiIcon(name).then((url) => {
      if (!cancelled && url) setSource(url)
    })
    return () => {
      cancelled = true
    }
  }, [directCandidateFailed, key, localIcon, name, source])

  if (source) return <img src={source} alt="" loading="lazy" className={className} />
  if (!directCandidateFailed) {
    const directCandidate = `https://bg3.wiki/wiki/Special:FilePath/${encodeURIComponent(name.trim().replace(/\s+/g, '_') + '.webp')}`
    return (
      <img
        src={directCandidate}
        alt=""
        loading="lazy"
        className={className}
        onError={() => {
          setSource('')
          setDirectCandidateFailed(true)
        }}
      />
    )
  }
  return (
    <span className="flex h-full w-full items-center justify-center">
      <Sparkles className="text-neutral-500" size={20} strokeWidth={1.75} />
    </span>
  )
}

export function SpellsPage(): React.JSX.Element {
  const session = useTranslationSession()
  if (session.phase !== 'loaded') {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div className="rounded-xl border border-[#1f2329] bg-[#131518] p-8">
          <WandSparkles className="mx-auto mb-3" style={{ color: 'var(--poly-accent)' }} size={28} />
          <h1 className="mb-2 text-lg font-semibold text-neutral-100">Spells</h1>
          <p className="text-sm text-neutral-500">Load a localization XML in Translate first.</p>
        </div>
      </div>
    )
  }
  return <LoadedSpellsPage session={session} />
}

function LoadedSpellsPage({
  session
}: {
  session: ReturnType<typeof useTranslationSession>
}): React.JSX.Element {
  const navigate = useNavigate()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [viewMemory] = useState<SpellsViewMemory>(() => {
    try {
      return JSON.parse(localStorage.getItem(SPELLS_VIEW_MEMORY_KEY) ?? '{}') as SpellsViewMemory
    } catch {
      return {}
    }
  })
  const [query, setQuery] = useState(viewMemory.query ?? '')
  const [kind, setKind] = useState<'all' | EntryKind>(
    viewMemory.kind && viewMemory.kind !== 'all' ? viewMemory.kind : 'spell'
  )
  const [sort, setSort] = useState<'alpha' | 'complete' | 'incomplete'>(
    viewMemory.sort === 'complete' || viewMemory.sort === 'incomplete' ? viewMemory.sort : 'alpha'
  )
  const [view, setView] = useState<'cards' | 'list'>(viewMemory.view ?? 'cards')
  const [statusFilter, setStatusFilter] = useState<'all' | ReviewStatus>(viewMemory.status ?? 'all')
  const [editingSpell] = useState<string | null>(null)
  const [editDialogSpell, setEditDialogSpell] = useState<string | null>(null)
  const [expandedVariants, setExpandedVariants] = useState<Set<string>>(new Set())
  const [expandedConditions, setExpandedConditions] = useState<Set<string>>(new Set())
  const [collapsedGroups, setCollapsedGroups] = useState<Set<EntryKind>>(new Set())
  const [collapsedLevels, setCollapsedLevels] = useState<Set<string>>(new Set())
  const [wikiConditions, setWikiConditions] = useState<Record<string, string[]>>({})
  const [loadingWikiConditions, setLoadingWikiConditions] = useState<Set<string>>(new Set())
  const [wikiSpellVariants, setWikiSpellVariants] = useState<Record<string, WikiVariant[]>>({})
  const [wikiSpellDescriptions, setWikiSpellDescriptions] = useState<Record<string, string>>({})
  const [loadingWikiVariants, setLoadingWikiVariants] = useState<Set<string>>(new Set())
  const [wikiConditionEntries, setWikiConditionEntries] = useState<DisplayEntry[]>([])
  const [wikiCatalogRequested, setWikiCatalogRequested] = useState(false)
  const [showSpellUid, setShowSpellUid] = useState(false)
  const [showSpellSuggestions, setShowSpellSuggestions] = useState(false)
  const [spellSuggestions, setSpellSuggestions] = useState<
    Record<string, { one: string; two: string }>
  >({})
  const [spellSuggestionsLoading, setSpellSuggestionsLoading] = useState(false)
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
  const renderSource = useCallback(
    (value: string) => renderSourceBase(value, { termGlossary }),
    [termGlossary]
  )

  useEffect(() => {
    try {
      window.localStorage.setItem(termGlossaryKey, JSON.stringify(termGlossary))
    } catch {
      // The glossary remains available for the current session if storage is unavailable.
    }
  }, [termGlossary, termGlossaryKey])

  useEffect(() => {
    const handleFindShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'f') return
      event.preventDefault()
      searchInputRef.current?.focus()
      searchInputRef.current?.select()
    }
    window.addEventListener('keydown', handleFindShortcut)
    return () => window.removeEventListener('keydown', handleFindShortcut)
  }, [])

  const loadSpellSuggestions = () => {
    if (Object.keys(spellSuggestions).length > 0 || spellSuggestionsLoading) return
    setSpellSuggestionsLoading(true)
    void window.api.translationSuggestions
      .load()
      .then(setSpellSuggestions)
      .finally(() => setSpellSuggestionsLoading(false))
  }

  useEffect(() => {
    if (!editDialogSpell) return
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setEditDialogSpell(null)
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [editDialogSpell])

  useEffect(() => {
    if (!wikiCatalogRequested) return
    let cancelled = false
    const loadConditionCatalog = async () => {
      const pages = ['1-500', '501-1000', '1001-1500']
      try {
        const documents = await Promise.all(
          pages.map(async (page) => {
            const response = await fetch(`https://bg3.wiki/wiki/Conditions/List_%28${page}%29`)
            if (!response.ok) throw new Error(`Conditions request failed: ${response.status}`)
            return new DOMParser().parseFromString(await response.text(), 'text/html')
          })
        )
        const parsed = documents.flatMap((document) =>
          [...document.querySelectorAll('tr[id]')].flatMap((row) => {
            const link = row.querySelector<HTMLAnchorElement>('th a[href*="_(Condition)"]')
            const name = link?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
            if (!name) return []
            const description =
              row.querySelector('td')?.textContent?.replace(/\s+/g, ' ').trim() ||
              'No condition description available.'
            const icon = row.querySelector<HTMLImageElement>('th img')?.src ?? ''
            const href = link?.getAttribute('href') ?? ''
            return [
              {
                name,
                description,
                category: 'Status' as const,
                id: `WIKI_CONDITION_${encodeURIComponent(name)}`,
                icon,
                displayKind: 'condition' as const,
                wikiUrl: href ? new URL(href, 'https://bg3.wiki').toString() : undefined
              }
            ]
          })
        )
        const unique = [...new Map(parsed.map((entry) => [normalize(entry.name), entry])).values()]
        if (!cancelled) setWikiConditionEntries(unique)
      } catch {
        if (!cancelled) setWikiConditionEntries([])
      }
    }
    void loadConditionCatalog()
    return () => {
      cancelled = true
    }
  }, [wikiCatalogRequested])

  const loadWikiConditions = async (name: string) => {
    if (wikiConditions[name] || loadingWikiConditions.has(name)) return
    setLoadingWikiConditions((current) => new Set(current).add(name))
    try {
      const response = await fetch(
        `https://bg3.wiki/wiki/${encodeURIComponent(name.replace(/\s+/g, '_'))}?action=raw`
      )
      const raw = await response.text()
      const conditions = [...raw.matchAll(/^\|\s*condition\d*\s*=\s*(.*?)\s*$/gim)]
        .map((match) => match[1].replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '$1').trim())
        .filter(Boolean)
      setWikiConditions((current) => ({ ...current, [name]: [...new Set(conditions)] }))
    } catch {
      setWikiConditions((current) => ({ ...current, [name]: [] }))
    } finally {
      setLoadingWikiConditions((current) => {
        const next = new Set(current)
        next.delete(name)
        return next
      })
    }
  }

  const loadWikiVariants = async (name: string) => {
    if (wikiSpellVariants[name] || loadingWikiVariants.has(name)) return
    setLoadingWikiVariants((current) => new Set(current).add(name))
    try {
      const raw = await (
        await fetch(
          `https://bg3.wiki/wiki/${encodeURIComponent(name.replace(/\s+/g, '_'))}?action=raw`
        )
      ).text()
      const variantsLine = raw.match(/^\|\s*variants\s*=\s*(.*?)\s*$/im)?.[1] ?? ''
      const wikiDescription = (
        raw.match(/^\|\s*description\s*=\s*(.*?)\s*$/im)?.[1] ??
        raw.match(/^\|\s*summary\s*=\s*(.*?)\s*$/im)?.[1] ??
        ''
      )
        .replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '$1')
        .replace(/''+/g, '')
        .replace(/<[^>]*>/g, '')
        .trim()
      if (wikiDescription) {
        setWikiSpellDescriptions((current) => ({ ...current, [name]: wikiDescription }))
      }
      const names = variantsLine
        .split(/[,;]/)
        .map((value) => value.replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '$1').trim())
        .filter(Boolean)
      const variants = await Promise.all(
        names.map(async (variantName) => {
          try {
            const variantRaw = await (
              await fetch(
                `https://bg3.wiki/wiki/${encodeURIComponent(variantName.replace(/\s+/g, '_'))}?action=raw`
              )
            ).text()
            const description = (
              variantRaw.match(/^\|\s*description\s*=\s*(.*?)\s*$/im)?.[1] ??
              variantRaw.match(/^\|\s*summary\s*=\s*(.*?)\s*$/im)?.[1] ??
              ''
            )
              .replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '$1')
              .replace(/''+/g, '')
              .replace(/<[^>]*>/g, '')
              .trim()
            return { name: variantName, description }
          } catch {
            return { name: variantName, description: '' }
          }
        })
      )
      setWikiSpellVariants((current) => ({ ...current, [name]: variants }))
    } catch {
      setWikiSpellVariants((current) => ({ ...current, [name]: [] }))
    } finally {
      setLoadingWikiVariants((current) => {
        const next = new Set(current)
        next.delete(name)
        return next
      })
    }
  }

  useEffect(() => {
    localStorage.setItem(
      SPELLS_VIEW_MEMORY_KEY,
      JSON.stringify({ query, kind, sort, view, status: statusFilter } satisfies SpellsViewMemory)
    )
  }, [kind, query, sort, statusFilter, view])

  const matchingEntries = useMemo(() => {
    const bySource = new Map<string, typeof session.entries>()
    for (const entry of session.entries) {
      const key = normalize(entry.source)
      if (!key) continue
      const current = bySource.get(key) ?? []
      current.push(entry)
      bySource.set(key, current)
    }
    return bySource
  }, [session.entries])

  const statusCatalog = useMemo(() => getReferenceCatalog('Status'), [])
  const spellCatalog = useMemo(() => getReferenceCatalog('Spell'), [])
  const referenceCatalog = useMemo(() => {
    const localConditions = statusCatalog
      .filter((entry) => entry.id && entry.description.trim())
      .map((entry) => ({ ...entry, displayKind: 'condition' as const }))
    const localByName = new Map(localConditions.map((entry) => [normalize(entry.name), entry]))
    const wikiConditions = wikiConditionEntries.map((entry) => {
      const local = localByName.get(normalize(entry.name))
      return {
        ...local,
        ...entry,
        description:
          entry.description || local?.description || 'No condition description available.',
        icon: entry.icon || local?.icon,
        displayKind: 'condition' as const
      }
    })
    const conditions = wikiConditions.length > 0 ? wikiConditions : localConditions
    return [...spellCatalog, ...conditions.values()]
  }, [spellCatalog, statusCatalog, wikiConditionEntries])

  const variantsBySpellName = useMemo(() => {
    const byName = new Map<string, GameEntry[]>()
    const spellEntries = spellCatalog.filter(
      (entry) => entry.id && entry.description.trim() && !/%%%/.test(entry.name + entry.description)
    )
    for (const entry of spellEntries) {
      if (!entry.id || !entry.description.trim() || /%%%/.test(entry.name + entry.description)) {
        continue
      }
      const normalizedName = normalize(entry.name)
      const separator = normalizedName.indexOf(':')
      if (separator < 0) continue
      const baseName = normalizedName.slice(0, separator)
      const current = byName.get(baseName) ?? []
      if (!current.some((item) => normalize(item.name) === normalizedName)) {
        current.push(entry)
        byName.set(baseName, current)
      }
    }
    for (const entry of spellEntries) {
      const baseName = normalize(entry.name)
      const directVariants = spellEntries.filter((variant) =>
        normalize(variant.name).startsWith(`${baseName}:`)
      )
      if (directVariants.length > 0) byName.set(baseName, directVariants)
    }
    return byName
  }, [spellCatalog])

  const completionByEntryKey = useMemo(() => {
    const result = new Map<string, boolean>()
    for (const entry of referenceCatalog) {
      const nameMatches = matchingEntries.get(normalize(entry.name)) ?? []
      const descriptionMatches = matchingEntries.get(normalize(entry.description)) ?? []
      result.set(
        entry.id ?? entry.name,
        nameMatches.some((item) => item.target.trim()) &&
          descriptionMatches.some((item) => item.target.trim())
      )
    }
    return result
  }, [matchingEntries, referenceCatalog])

  const isEntryComplete = useCallback(
    (entry: GameEntry): boolean => completionByEntryKey.get(entry.id ?? entry.name) ?? false,
    [completionByEntryKey]
  )
  const statusIndex = useMemo(() => {
    const byName = new Map<string, GameEntry>()
    for (const entry of statusCatalog) byName.set(normalize(entry.name), entry)
    const byToken = new Map<string, GameEntry>()
    const tokens = new Set(referenceCatalog.flatMap((entry) => entry.conditions ?? []))
    for (const token of tokens) {
      const normalizedToken = normalize(token)
      if (!normalizedToken) continue
      const match = statusCatalog.find((entry) =>
        normalize(entry.id ?? '').includes(normalizedToken)
      )
      if (match) byToken.set(normalizedToken, match)
    }
    return { byName, byToken }
  }, [referenceCatalog, statusCatalog])
  const iconByName = useMemo(() => {
    const map = new Map<string, string>()
    for (const spell of spellsData) map.set(normalize(spell.name), spell.icon)
    return map
  }, [])
  const searchableCatalog = useMemo(
    () =>
      referenceCatalog.map((entry) => {
        const name = normalize(entry.name)
        const description = normalize(entry.description)
        return {
          entry,
          name,
          description,
          searchText: `${name} ${description}`,
          duplicateKey: `${name}\u0000${description}`,
          kind: classifyEntry(entry),
          valid:
            Boolean(entry.id) &&
            Boolean(entry.description.trim()) &&
            !/%%%/.test(entry.name) &&
            !/%%%/.test(entry.description)
        }
      }),
    [referenceCatalog]
  )
  const sourceMatchInfo = useMemo(() => {
    const result = new Map<string, { translated: boolean; reviewStatus?: ReviewStatus }>()
    for (const [key, entries] of matchingEntries) {
      result.set(key, {
        translated: entries.some((item) => item.target.trim()),
        reviewStatus: entries.find((item) => item.reviewStatus)?.reviewStatus
      })
    }
    return result
  }, [matchingEntries])
  const filtered = useMemo(() => {
    const needle = normalize(query)
    const seen = new Set<string>()
    return searchableCatalog.flatMap((item) => {
      if (!item.valid) return []
      if (kind !== 'all' && item.kind !== kind) return []
      if (needle && !item.searchText.includes(needle)) return []
      const nameInfo = sourceMatchInfo.get(item.name)
      const descriptionInfo = sourceMatchInfo.get(item.description)
      const isComplete = Boolean(nameInfo?.translated && descriptionInfo?.translated)
      const status =
        nameInfo?.reviewStatus ??
        descriptionInfo?.reviewStatus ??
        (isComplete ? 'verified' : 'untranslated')
      if (statusFilter !== 'all' && status !== statusFilter) return []
      if (seen.has(item.duplicateKey)) return []
      seen.add(item.duplicateKey)
      return [item.entry]
    })
  }, [kind, query, searchableCatalog, sourceMatchInfo, statusFilter])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sort === 'complete' || sort === 'incomplete') {
        const aComplete = isEntryComplete(a)
        const bComplete = isEntryComplete(b)
        if (aComplete !== bComplete) {
          return sort === 'complete' ? (aComplete ? -1 : 1) : aComplete ? 1 : -1
        }
      }
      return a.name.localeCompare(b.name)
    })
  }, [filtered, isEntryComplete, sort])

  useEffect(() => {
    const candidates = filtered
      .filter((entry) => {
        const source =
          matchingEntries.get(normalize(entry.description))?.[0]?.source ?? entry.description
        return isMarkupOnlyDescription(source) && !wikiSpellDescriptions[entry.name]
      })
      .slice(0, 24)
    for (const entry of candidates) void loadWikiVariants(entry.name)
  }, [filtered, matchingEntries, wikiSpellDescriptions])

  const grouped = useMemo(() => {
    const groups = new Map<EntryKind, GameEntry[]>()
    for (const spell of sorted) {
      const key = classifyEntry(spell)
      const list = groups.get(key) ?? []
      list.push(spell)
      groups.set(key, list)
    }
    const spells = groups.get('spell')
    if (spells) {
      spells.sort((a, b) => {
        const levelDifference = spellLevelRank(a) - spellLevelRank(b)
        if (levelDifference !== 0) return levelDifference
        if (sort === 'complete' || sort === 'incomplete') {
          const aComplete = isEntryComplete(a)
          const bComplete = isEntryComplete(b)
          if (aComplete !== bComplete) {
            return sort === 'complete' ? (aComplete ? -1 : 1) : aComplete ? 1 : -1
          }
        }
        return a.name.localeCompare(b.name)
      })
    }
    return [...groups.entries()]
  }, [isEntryComplete, sort, sorted])
  const levelStats = useMemo(() => {
    const stats = new Map<string, { total: number; completed: number }>()
    for (const entry of sorted) {
      if (classifyEntry(entry) !== 'spell') continue
      const key = `spell:${entry.level || 'other'}`
      const current = stats.get(key) ?? { total: 0, completed: 0 }
      current.total += 1
      if (isEntryComplete(entry)) current.completed += 1
      stats.set(key, current)
    }
    return stats
  }, [isEntryComplete, sorted])

  return (
    <>
      <TermGlossaryModal
        open={termGlossaryOpen}
        entries={termGlossary}
        onChange={setTermGlossary}
        onClose={() => setTermGlossaryOpen(false)}
      />
      <div className="spells-page flex h-full min-h-0 flex-col bg-[#0c0d0f] text-neutral-200">
      <header className="app-page-header flex shrink-0 flex-wrap items-center gap-3 border-b border-[#1f2329] bg-[#0f1114] px-6 py-5">
        <WandSparkles size={20} style={{ color: 'var(--poly-accent)' }} />
        <div>
          <h1 className="text-base font-semibold text-neutral-100">Spells</h1>
          <p className="text-xs text-neutral-500">
            Game Data abilities + BG3 Wiki conditions · {referenceCatalog.length} entries
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1">
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
          <SessionSaveButton session={session} className="accent-solid-button" />
        </div>
      </header>
      <div className="flex shrink-0 flex-wrap items-center gap-2.5 border-b border-[#1f2329] bg-[#0c0d0f] px-5 py-3">
        <SpellSearchInput inputRef={searchInputRef} initialValue={query} onSearch={setQuery} />
        <div className="order-3 flex w-full min-w-0 max-w-full items-center gap-1 overflow-x-auto xl:order-none xl:w-auto xl:flex-none">
          {kindTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setKind(tab.value)}
              aria-pressed={kind === tab.value}
              aria-label={tab.label}
              title={tab.label}
              className={`inline-flex h-8 shrink-0 items-center justify-center gap-1.5 !rounded-md border text-[11px] transition-[width,padding,colors] ${kind === tab.value ? 'border-amber-500/35 bg-amber-500/15 px-3 text-amber-200' : 'border-[#2a2f37] bg-[#131518] px-2.5 text-neutral-500 hover:border-amber-500/30 hover:bg-amber-500/5 hover:text-neutral-200'}`}
            >
              <tab.icon size={12} className="shrink-0" />
              {kind === tab.value && <span>{tab.label}</span>}
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as 'alpha' | 'complete' | 'incomplete')}
            aria-label="Sort entries"
            className="h-8 rounded-md border border-[#2a2f37] bg-[#131518] px-2.5 text-xs text-neutral-300 outline-none focus:border-amber-500/60"
          >
            <option value="alpha">Default (A–Z)</option>
            <option value="complete">Completed first</option>
            <option value="incomplete">Incomplete first</option>
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'all' | ReviewStatus)}
            aria-label="Filter by status"
            className="h-8 rounded-md border border-[#2a2f37] bg-[#131518] px-2.5 text-xs text-neutral-300 outline-none focus:border-amber-500/60"
          >
            <option value="all">All statuses</option>
            <option value="verified">Verified</option>
            <option value="not-verified">Not verified</option>
            <option value="needs-review">Needs review</option>
            <option value="untranslated">Untranslated</option>
          </select>
          <div className="inline-flex h-8 items-center rounded-md border border-[#2a2f37] bg-[#131518] p-0.5">
            <button
              type="button"
              onClick={() => setView('cards')}
              aria-label="Cards view"
              aria-pressed={view === 'cards'}
              className={`inline-flex h-7 items-center gap-1 !rounded-md px-2 text-[11px] transition-colors ${view === 'cards' ? 'bg-amber-500/15 text-amber-200' : 'text-neutral-500 hover:text-neutral-300'}`}
            >
              <LayoutGrid size={13} /> Cards
            </button>
            <button
              type="button"
              onClick={() => setView('list')}
              aria-label="List view"
              aria-pressed={view === 'list'}
              className={`inline-flex h-7 items-center gap-1 !rounded-md px-2 text-[11px] transition-colors ${view === 'list' ? 'bg-amber-500/15 text-amber-200' : 'text-neutral-500 hover:text-neutral-300'}`}
            >
              <List size={13} /> List
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              const collapse = collapsedGroups.size === 0 && collapsedLevels.size === 0
              setCollapsedGroups(collapse ? new Set(grouped.map(([group]) => group)) : new Set())
              setCollapsedLevels(
                collapse
                  ? new Set(
                      grouped
                        .filter(([group]) => group === 'spell')
                        .flatMap(([, entries]) =>
                          entries.map((entry) => `spell:${entry.level || 'other'}`)
                        )
                    )
                  : new Set()
              )
            }}
            className="inline-flex h-8 items-center gap-1.5 !rounded-md border border-[#2a2f37] bg-[#131518] px-3 text-[11px] text-neutral-400 transition-colors hover:border-amber-500/40 hover:bg-amber-500/5 hover:text-amber-200"
          >
            {collapsedGroups.size || collapsedLevels.size ? (
              <>
                <ChevronsUpDown size={13} /> Expand all
              </>
            ) : (
              <>
                <ChevronsDownUp size={13} /> Collapse all
              </>
            )}
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="w-full space-y-7">
          {grouped.map(([group, spells]) => (
            <section key={group}>
              {(() => {
                const completed = spells.filter(isEntryComplete).length
                return (
                  <div className="mb-3 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setCollapsedGroups((current) => {
                          const next = new Set(current)
                          if (next.has(group)) next.delete(group)
                          else next.add(group)
                          return next
                        })
                      }
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-200 hover:text-amber-100"
                      aria-expanded={!collapsedGroups.has(group)}
                    >
                      <ChevronDown
                        size={14}
                        className={`transition-transform ${collapsedGroups.has(group) ? '-rotate-90' : ''}`}
                      />
                      {kindLabel[group]}
                    </button>
                    <span className="rounded-full border border-amber-500/20 bg-amber-500/8 px-2 py-0.5 font-mono text-[10px] text-amber-300">
                      {spells.length}
                    </span>
                    <span className="text-[10px] text-neutral-600">
                      {completed}/{spells.length} complete
                    </span>
                    <div className="h-px flex-1 bg-[#1f2329]" />
                  </div>
                )
              })()}
              {!collapsedGroups.has(group) && (
                <div
                  className={
                    view === 'cards'
                      ? 'grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'
                      : 'grid grid-cols-1 gap-3'
                  }
                >
                  {spells.map((spell, index) => {
                    const description = spell.description
                    const previous = spells[index - 1]
                    const levelKey = `${group}:${spell.level || 'other'}`
                    const showLevelHeader =
                      group === 'spell' && (index === 0 || previous?.level !== spell.level)
                    const wikiVariants = wikiSpellVariants[spell.name]
                    const normalizedSpellName = normalize(spell.name)
                    const fallbackVariants = variantsBySpellName.get(normalizedSpellName) ?? []
                    const variantSources = (
                      fallbackVariants.length > 0 ? fallbackVariants : (wikiVariants ?? [])
                    ) as Array<GameEntry | WikiVariant>
                    const variants = variantSources.map((entry) => ({
                      ...entry,
                      cleanName: entry.name.replace(/\*+$/, ''),
                      translated:
                        matchingEntries
                          .get(normalize(entry.name))
                          ?.find((item) => item.target.trim())?.target ?? '',
                      translatedDescription:
                        matchingEntries
                          .get(normalize(entry.description))
                          ?.find((item) => item.target.trim())?.target ?? ''
                    }))
                    const conditionTokens = [
                      ...[
                        ...description.matchAll(
                          /<lstag\b[^>]*tooltip=["']([^"']+)["'][^>]*>([\s\S]*?)<\/lstag>/gi
                        )
                      ].map((match) => ({
                        token: match[1],
                        label: match[2].replace(/<[^>]*>/g, '').trim()
                      })),
                      ...(spell.conditions ?? [])
                        .filter((token) => statusIndex.byToken.has(normalize(token)))
                        .map((token) => ({ token, label: token })),
                      ...(wikiConditions[spell.name] ?? []).map((token) => ({
                        token,
                        label: token
                      }))
                    ].filter(
                      ({ token, label }) =>
                        label !== token ||
                        statusIndex.byName.has(normalize(label)) ||
                        statusIndex.byToken.has(normalize(token))
                    )
                    const wikiConditionsLoaded = Object.prototype.hasOwnProperty.call(
                      wikiConditions,
                      spell.name
                    )
                    const conditions = conditionTokens
                      .map(({ token, label }) => {
                        const status =
                          statusIndex.byName.get(normalize(label)) ??
                          statusIndex.byName.get(normalize(token)) ??
                          statusIndex.byToken.get(normalize(token))
                        if (status && /%%%/.test(status.name + status.description)) return null
                        const resolvedStatus =
                          status ??
                          ({
                            name: label || token,
                            description: '',
                            category: 'Status' as const,
                            id: token,
                            conditions: [],
                            hasUnresolvedFields: true
                          } satisfies GameEntry)
                        const statusNameMatches =
                          matchingEntries.get(normalize(resolvedStatus.name)) ?? []
                        const statusDescriptionMatches =
                          matchingEntries.get(normalize(resolvedStatus.description)) ?? []
                        return {
                          ...resolvedStatus,
                          translatedName:
                            statusNameMatches.find((entry) => entry.target.trim())?.target ?? '',
                          translatedDescription:
                            statusDescriptionMatches.find((entry) => entry.target.trim())?.target ??
                            ''
                        }
                      })
                      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
                      .filter(
                        (entry, index, all) =>
                          all.findIndex(
                            (item) => normalize(item.name) === normalize(entry.name)
                          ) === index
                      )
                    const hasResolvableGameCondition = (spell.conditions ?? []).some((token) =>
                      statusIndex.byToken.has(normalize(token))
                    )
                    const hasPotentialConditions =
                      conditions.length > 0 || (!wikiConditionsLoaded && hasResolvableGameCondition)
                    const nameMatches = matchingEntries.get(normalize(spell.name)) ?? []
                    const descriptionMatches = matchingEntries.get(normalize(description)) ?? []
                    const resolveEntry = (source: string, matches: typeof session.entries) =>
                      matches[0] ??
                      session.entries.find((entry) => {
                        const candidate = normalize(entry.source)
                        const target = normalize(source)
                        return (
                          candidate === target ||
                          candidate.includes(target) ||
                          target.includes(candidate)
                        )
                      })
                    const nameEntry = resolveEntry(spell.name, nameMatches)
                    const descriptionEntry = resolveEntry(description, descriptionMatches)
                    const rawDescriptionSource = descriptionEntry?.source ?? description
                    const wikiDescription = wikiSpellDescriptions[spell.name]
                    const displayDescription = isMarkupOnlyDescription(rawDescriptionSource)
                      ? wikiDescription || description
                      : rawDescriptionSource
                    const descriptionSourceLabel =
                      isMarkupOnlyDescription(rawDescriptionSource) && wikiDescription
                        ? 'Description · Wiki · EN'
                        : 'Description · Source · EN'
                    const translatedName =
                      nameMatches.find((entry) => entry.target.trim())?.target ??
                      nameEntry?.target ??
                      ''
                    const translatedDescription =
                      descriptionMatches.find((entry) => entry.target.trim())?.target ??
                      descriptionEntry?.target ??
                      ''
                    const isTranslated =
                      translatedName.trim() !== '' && translatedDescription.trim() !== ''
                    const currentStatus =
                      nameEntry?.reviewStatus ??
                      descriptionEntry?.reviewStatus ??
                      (isTranslated ? 'verified' : 'untranslated')
                    const setStatus = (status: ReviewStatus) => {
                      if (nameEntry) session.setReviewStatus(nameEntry.rowId, status)
                      if (descriptionEntry && descriptionEntry.rowId !== nameEntry?.rowId) {
                        session.setReviewStatus(descriptionEntry.rowId, status)
                      }
                    }
                    const matches = nameMatches.length
                    const variantsOpen = expandedVariants.has(spell.id ?? spell.name)
                    const conditionsOpen = expandedConditions.has(spell.id ?? spell.name)
                    const icon = iconByName.get(normalize(spell.name))
                    const spellKey = spell.id ?? spell.name
                    return (
                      <Fragment key={`${spell.id}-${spell.name}`}>
                        {showLevelHeader && (
                          <div className="col-span-full flex items-center gap-3 pt-2 first:pt-0">
                            <button
                              type="button"
                              onClick={() =>
                                setCollapsedLevels((current) => {
                                  const next = new Set(current)
                                  if (next.has(levelKey)) next.delete(levelKey)
                                  else next.add(levelKey)
                                  return next
                                })
                              }
                              className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-amber-300 hover:text-amber-100"
                              aria-expanded={!collapsedLevels.has(levelKey)}
                            >
                              <ChevronDown
                                size={13}
                                className={`transition-transform ${collapsedLevels.has(levelKey) ? '-rotate-90' : ''}`}
                              />
                              {spellLevelLabel(spell)}
                            </button>
                            <span className="rounded-full border border-amber-500/20 px-1.5 py-0.5 font-mono text-[10px] text-amber-300/80">
                              {levelStats.get(levelKey)?.total ?? 0}
                            </span>
                            <span className="text-[10px] text-neutral-600">
                              {levelStats.get(levelKey)?.completed ?? 0}/
                              {levelStats.get(levelKey)?.total ?? 0} complete
                            </span>
                            <div className="h-px flex-1 bg-amber-500/15" />
                          </div>
                        )}
                        {!collapsedLevels.has(levelKey) && (
                          <article
                            className={`spell-card group relative flex h-full min-w-0 flex-col overflow-hidden rounded-xl border p-3 transition-colors ${isTranslated ? 'spell-card-complete' : 'border-[#252a31] bg-[#131518] hover:border-amber-500/35'}`}
                          >
                            <div className="flex min-w-0 gap-3">
                              <div className="shrink-0">
                                <div className="relative h-14 w-14 overflow-hidden rounded-lg border border-amber-500/25 bg-[#0c0d0f]">
                                  <WikiIcon
                                    name={spell.name}
                                    localIcon={icon}
                                    className="h-full w-full object-contain"
                                  />
                                  {isTranslated && (
                                    <CircleCheck
                                      size={16}
                                      strokeWidth={2.5}
                                      className="absolute left-1 top-1 z-10 rounded-full bg-[#10151a] text-emerald-400 drop-shadow-[0_0_4px_rgba(52,211,153,0.65)]"
                                      aria-label="Complete"
                                    />
                                  )}
                                </div>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <h3 className="break-words text-sm font-semibold text-neutral-100 [overflow-wrap:anywhere]">
                                      {renderSource(nameEntry?.source ?? spell.name)}
                                    </h3>
                                    {editingSpell === spellKey && nameEntry ? (
                                      <input
                                        defaultValue={translatedName}
                                        placeholder="Romanian name..."
                                        onBlur={(event) =>
                                          session.updateEntry(nameEntry.rowId, event.target.value)
                                        }
                                        className="mt-1 block w-full rounded border border-amber-500/25 bg-[#0c0d0f] px-2 py-1 text-xs font-normal text-amber-200 outline-none focus:border-amber-500/60"
                                      />
                                    ) : translatedName ? (
                                      <div className="mt-0.5 flex items-center gap-1 text-xs font-normal text-neutral-300">
                                        <CornerDownRight
                                          size={12}
                                          className="shrink-0 opacity-70"
                                        />
                                        <span className="break-words [overflow-wrap:anywhere]">
                                          {translatedName}
                                        </span>
                                      </div>
                                    ) : null}
                                  </div>
                                  <div className="flex max-w-full shrink-0 items-start gap-1">
                                    <button
                                      type="button"
                                      title={matches ? `${matches} matches` : 'Not linked'}
                                      aria-label={matches ? `${matches} matches` : 'Not linked'}
                                      className="inline-flex h-6 w-6 items-center justify-center rounded border border-[#2a2f37] text-neutral-500 hover:border-red-400/45 hover:text-neutral-200"
                                    >
                                      <span className="font-mono text-[10px] font-semibold">
                                        {matches}
                                      </span>
                                    </button>
                                    <button
                                      type="button"
                                      title="Open in Game Data"
                                      aria-label="Open in Game Data"
                                      onClick={() =>
                                        navigate(
                                          `/game-data?spell=${encodeURIComponent(spell.name)}`
                                        )
                                      }
                                      className="inline-flex h-6 w-6 items-center justify-center rounded border border-[#2a2f37] text-neutral-400 hover:border-red-400/45 hover:text-neutral-200"
                                    >
                                      <ArrowRight size={12} className="shrink-0" />
                                    </button>
                                    <button
                                      type="button"
                                      title="Edit spell"
                                      aria-label="Edit spell"
                                      onClick={() => {
                                        void loadWikiVariants(spell.name)
                                        setEditDialogSpell(spellKey)
                                      }}
                                      className="inline-flex h-6 w-6 items-center justify-center rounded border border-[#2a2f37] text-neutral-400 transition-colors hover:border-red-400/45 hover:text-neutral-200"
                                    >
                                      <Pencil size={12} />
                                    </button>
                                  </div>
                                </div>
                                <p className="mt-1 break-words text-xs leading-4 text-neutral-400 [overflow-wrap:anywhere]">
                                  {renderSource(
                                    displayDescription || 'No English description available.'
                                  )}
                                </p>
                                {editingSpell === spellKey && descriptionEntry ? (
                                  <HighlightedTextarea
                                    value={translatedDescription}
                                    placeholder="Romanian description..."
                                    onBlur={(event) =>
                                      session.updateEntry(
                                        descriptionEntry.rowId,
                                        event.target.value
                                      )
                                    }
                                    rows={3}
                                    autoGrow
                                    containerClassName="mt-1 border-amber-500/25 bg-[#0c0d0f]"
                                    className="text-xs leading-4 !text-amber-200"
                                  />
                                ) : translatedDescription ? (
                                  <div className="mt-1 flex items-start gap-1 text-xs leading-4 text-neutral-300/90">
                                    <CornerDownRight
                                      size={12}
                                      className="mt-0.5 shrink-0 opacity-70"
                                    />
                                    <span className="break-words [overflow-wrap:anywhere]">
                                      {renderSource(translatedDescription)}
                                    </span>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                            {variants.length > 0 && (
                              <div className="mt-3 border-t border-[#1f2329] pt-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    void loadWikiVariants(spell.name)
                                    setExpandedVariants((current) => {
                                      const next = new Set(current)
                                      const key = spell.id ?? spell.name
                                      if (next.has(key)) next.delete(key)
                                      else next.add(key)
                                      return next
                                    })
                                  }}
                                  className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-600 hover:text-amber-200"
                                  aria-expanded={variantsOpen}
                                >
                                  <ChevronDown
                                    size={13}
                                    className={`transition-transform ${variantsOpen ? 'rotate-180' : ''}`}
                                  />
                                  Variations ({variants.length})
                                </button>
                                {variantsOpen && (
                                  <div className="min-w-0 space-y-1.5">
                                    {variants.map((variant) => {
                                      const variantNameEntry = resolveEntry(
                                        variant.name,
                                        matchingEntries.get(normalize(variant.name)) ?? []
                                      )
                                      const variantDescriptionEntry = resolveEntry(
                                        variant.description,
                                        matchingEntries.get(normalize(variant.description)) ?? []
                                      )
                                      return (
                                        <div
                                          key={variant.name}
                                          className="flex min-w-0 items-start gap-2 overflow-hidden rounded border border-[#2a2f37] bg-[#0f1114] px-2 py-1.5 text-[10px] text-neutral-400"
                                        >
                                          <div className="h-7 w-7 shrink-0 overflow-hidden rounded border border-amber-500/20 bg-[#0c0d0f]">
                                            <WikiIcon
                                              name={variant.cleanName}
                                              localIcon={icon}
                                              className="h-full w-full object-contain"
                                            />
                                          </div>
                                          <div className="min-w-0 flex-1">
                                            <div className="break-words font-medium text-neutral-200 [overflow-wrap:anywhere]">
                                              {variant.cleanName}
                                              {editingSpell === spellKey && variantNameEntry ? (
                                                <input
                                                  defaultValue={variant.translated}
                                                  placeholder="Romanian name..."
                                                  onBlur={(event) =>
                                                    session.updateEntry(
                                                      variantNameEntry.rowId,
                                                      event.target.value
                                                    )
                                                  }
                                                  className="mt-1 block w-full rounded border border-amber-500/25 bg-[#0c0d0f] px-1.5 py-1 text-[10px] font-normal text-amber-200 outline-none focus:border-amber-500/60"
                                                />
                                              ) : (
                                                variant.translated && (
                                                  <span className="ml-1 font-normal text-neutral-300">
                                                    — {variant.translated}
                                                  </span>
                                                )
                                              )}
                                            </div>
                                            <div className="mt-0.5 break-words text-neutral-500 [overflow-wrap:anywhere]">
                                              {renderSource(
                                                variant.description ||
                                                  'No English description available.'
                                              )}
                                            </div>
                                            {editingSpell === spellKey &&
                                            variantDescriptionEntry ? (
                                              <HighlightedTextarea
                                                value={variant.translatedDescription}
                                                placeholder="Romanian description..."
                                                onBlur={(event) =>
                                                  session.updateEntry(
                                                    variantDescriptionEntry.rowId,
                                                    event.target.value
                                                  )
                                                }
                                                rows={2}
                                                autoGrow
                                                containerClassName="mt-1 border-amber-500/25 bg-[#0c0d0f]"
                                                className="px-1.5 text-[10px] leading-4 !text-amber-200"
                                              />
                                            ) : (
                                              variant.translatedDescription && (
                                                <div className="mt-0.5 text-neutral-300/85">
                                                  {renderSource(variant.translatedDescription)}
                                                </div>
                                              )
                                            )}
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            )}
                            {hasPotentialConditions && (
                              <div className="mt-3 border-t border-[#1f2329] pt-2">
                                <button
                                  type="button"
                                  onClick={() => (
                                    setWikiCatalogRequested(true),
                                    loadWikiConditions(spell.name),
                                    setExpandedConditions((current) => {
                                      const next = new Set(current)
                                      const key = spell.id ?? spell.name
                                      if (next.has(key)) next.delete(key)
                                      else next.add(key)
                                      return next
                                    })
                                  )}
                                  className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-600 hover:text-amber-200"
                                  aria-expanded={conditionsOpen}
                                >
                                  <ChevronDown
                                    size={13}
                                    className={`transition-transform ${conditionsOpen ? 'rotate-180' : ''}`}
                                  />
                                  Conditions (
                                  {loadingWikiConditions.has(spell.name) ||
                                  (!wikiConditionsLoaded &&
                                    conditions.length === 0 &&
                                    (spell.conditions?.length ?? 0) > 0)
                                    ? '…'
                                    : conditions.length}
                                  )
                                </button>
                                {conditionsOpen && (
                                  <div className="space-y-1.5">
                                    {conditions.map((condition) => {
                                      const conditionNameEntry = resolveEntry(
                                        condition.name,
                                        matchingEntries.get(normalize(condition.name)) ?? []
                                      )
                                      const conditionDescriptionEntry = resolveEntry(
                                        condition.description,
                                        matchingEntries.get(normalize(condition.description)) ?? []
                                      )
                                      return (
                                        <div
                                          key={condition.name}
                                          className="min-w-0 overflow-hidden rounded border border-[#2a2f37] bg-[#0f1114] px-2 py-1.5 text-[10px]"
                                        >
                                          <div className="break-words font-medium text-amber-200 [overflow-wrap:anywhere]">
                                            {condition.name}
                                            {editingSpell === spellKey && conditionNameEntry ? (
                                              <input
                                                defaultValue={condition.translatedName}
                                                onBlur={(event) =>
                                                  session.updateEntry(
                                                    conditionNameEntry.rowId,
                                                    event.target.value
                                                  )
                                                }
                                                className="mt-1 block w-full rounded border border-amber-500/25 bg-[#0c0d0f] px-1.5 py-1 text-[10px] font-normal text-amber-200 outline-none focus:border-amber-500/60"
                                              />
                                            ) : condition.translatedName ? (
                                              <span className="ml-1 font-normal text-neutral-300/85">
                                                — {condition.translatedName}
                                              </span>
                                            ) : null}
                                          </div>
                                          <div className="mt-0.5 break-words text-neutral-500 [overflow-wrap:anywhere]">
                                            {renderSource(condition.description)}
                                          </div>
                                          {editingSpell === spellKey &&
                                          conditionDescriptionEntry ? (
                                            <HighlightedTextarea
                                              value={condition.translatedDescription}
                                              placeholder="Romanian condition description..."
                                              onBlur={(event) =>
                                                session.updateEntry(
                                                  conditionDescriptionEntry.rowId,
                                                  event.target.value
                                                )
                                              }
                                              rows={2}
                                              autoGrow
                                              containerClassName="mt-1 border-amber-500/25 bg-[#0c0d0f]"
                                              className="px-1.5 text-[10px] leading-4 !text-amber-200"
                                            />
                                          ) : condition.translatedDescription ? (
                                            <div className="mt-0.5 text-neutral-300/85">
                                              {renderSource(condition.translatedDescription)}
                                            </div>
                                          ) : null}
                                        </div>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            )}
                            <div className="mt-auto flex flex-wrap items-center gap-1 border-t border-[#1f2329] pt-3">
                              {[...reviewStatusOptions].map((option) => {
                                const Icon = option.icon
                                return (
                                  <button
                                    key={option.value}
                                    type="button"
                                    title={option.title}
                                    aria-label={`${option.title} translation`}
                                    onClick={() => setStatus(option.value)}
                                    className={`inline-flex h-6 w-6 items-center justify-center rounded border transition-colors ${currentStatus === option.value ? option.active : option.idle}`}
                                  >
                                    <Icon size={13} />
                                  </button>
                                )
                              })}
                              <span
                                title={entryLabel(spell)}
                                className="ml-auto inline-flex max-w-full items-center gap-1 rounded border border-amber-500/25 bg-amber-500/8 px-1.5 py-0.5 text-[10px] font-medium text-amber-300"
                              >
                                <EntryIcon entry={spell} />
                                <span className="whitespace-nowrap">{entryLabel(spell)}</span>
                              </span>
                            </div>
                            {editDialogSpell === spellKey &&
                              createPortal(
                                <div
                                  className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
                                  onMouseDown={(event) => {
                                    if (event.target === event.currentTarget)
                                      setEditDialogSpell(null)
                                  }}
                                >
                                  <div
                                    role="dialog"
                                    aria-modal="true"
                                    aria-label={`${spell.name} translation editor`}
                                    className="spells-edit-dialog relative flex min-h-[60vh] max-h-[90vh] w-[80vw] max-w-[80vw] flex-col overflow-hidden rounded-2xl border border-[#34343e] bg-[#15161b] shadow-[0_25px_80px_rgba(0,0,0,0.55)]"
                                  >
                                    <div className="flex items-center gap-3 border-b border-[#2a2f37] px-4 py-3">
                                      <div className="flex min-w-0 items-center gap-2.5">
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/25">
                                          <WikiIcon
                                            name={spell.name}
                                            localIcon={icon}
                                            className="h-full w-full object-contain"
                                          />
                                        </div>
                                        <h2 className="truncate text-base font-semibold text-neutral-100">
                                          {spell.name}
                                        </h2>
                                      </div>
                                      <div className="ml-auto flex shrink-0 items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => setShowSpellUid((current) => !current)}
                                          className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs transition-colors ${showSpellUid ? 'border-red-400/50 bg-red-500/10 text-red-200' : 'border-[#2a2f37] text-neutral-400 hover:text-neutral-100'}`}
                                        >
                                          <Hash size={13} /> UID
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setShowSpellSuggestions((current) => !current)
                                            loadSpellSuggestions()
                                          }}
                                          className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs transition-colors ${showSpellSuggestions ? 'border-red-400/50 bg-red-500/10 text-red-200' : 'border-[#2a2f37] text-neutral-400 hover:text-neutral-100'}`}
                                        >
                                          <Lightbulb size={13} />
                                          {spellSuggestionsLoading ? 'Loading…' : 'Suggestions'}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setEditDialogSpell(null)}
                                          className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-200 hover:bg-red-500/20"
                                        >
                                          Done
                                        </button>
                                        <button
                                          type="button"
                                          title="Close (Esc)"
                                          aria-label="Close edit dialog"
                                          onClick={() => setEditDialogSpell(null)}
                                          className="cursor-pointer rounded-lg border border-[#34343e] p-2 text-neutral-400 transition hover:text-white"
                                        >
                                          <X size={18} />
                                        </button>
                                      </div>
                                    </div>
                                    <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,55fr)_minmax(0,35fr)]">
                                      <div className="min-h-[240px] border-b border-[#2a2f37] bg-black/20 lg:min-h-0 lg:border-b-0 lg:border-r">
                                        <webview
                                          title={`${spell.name} on BG3 Wiki`}
                                          src={`https://bg3.wiki/wiki/${encodeURIComponent(spell.name.replace(/\s+/g, '_'))}`}
                                          allowpopups
                                          className="h-full min-h-[240px] w-full border-0 lg:min-h-0"
                                          style={{ height: '100%', width: '100%', display: 'flex' }}
                                        />
                                      </div>
                                      <div className="min-h-0 space-y-3 overflow-y-auto p-5">
                                        <section className="space-y-2">
                                          <div className="space-y-1.5">
                                            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                                              Title · Source · EN
                                            </span>
                                            <div className="spells-edit-source translation-source-text text-sm leading-5 text-neutral-200">
                                              {nameEntry?.source ?? spell.name}
                                              {showSpellUid && nameEntry?.uid && (
                                                <span className="ml-2 text-[10px] text-neutral-500">
                                                  {nameEntry.uid}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                          <label className="block space-y-2">
                                            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                                              Title · Translation · RO
                                            </span>
                                            <input
                                              defaultValue={translatedName}
                                              placeholder="Romanian name..."
                                              disabled={!nameEntry}
                                              onBlur={(event) =>
                                                nameEntry &&
                                                session.updateEntry(
                                                  nameEntry.rowId,
                                                  event.target.value
                                                )
                                              }
                                              className="block w-full rounded-lg border border-[#2a2f37] bg-[#0c0d0f] px-3 py-2 text-sm text-neutral-200 outline-none focus:border-red-400/60 disabled:cursor-not-allowed disabled:opacity-50"
                                            />
                                            {showSpellSuggestions &&
                                              nameEntry?.uid &&
                                              spellSuggestions[nameEntry.uid] && (
                                                <div className="space-y-0.5 text-xs leading-5 text-neutral-500">
                                                  {[
                                                    spellSuggestions[nameEntry.uid].one,
                                                    spellSuggestions[nameEntry.uid].two
                                                  ]
                                                    .filter(Boolean)
                                                    .map((suggestion, index) => (
                                                      <div
                                                        key={`${nameEntry.uid}-title-suggestion-${index}`}
                                                      >
                                                        {renderSource(suggestion)}
                                                      </div>
                                                    ))}
                                                </div>
                                              )}
                                          </label>
                                        </section>
                                        <section className="space-y-2 border-t border-[#2a2f37] pt-3">
                                          <div className="space-y-1.5">
                                            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                                              {descriptionSourceLabel}
                                            </span>
                                            <div className="spells-edit-source translation-source-text text-sm leading-5 text-neutral-300">
                                              {renderSource(
                                                displayDescription ||
                                                  'No English description available.'
                                              )}
                                              {showSpellUid && descriptionEntry?.uid && (
                                                <span className="ml-2 text-[10px] text-neutral-500">
                                                  {descriptionEntry.uid}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                          <label className="block space-y-2">
                                            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                                              Description · Translation · RO
                                            </span>
                                            <HighlightedTextarea
                                              value={translatedDescription}
                                              placeholder="Romanian description..."
                                              onBlur={(event) =>
                                                descriptionEntry &&
                                                session.updateEntry(
                                                  descriptionEntry.rowId,
                                                  event.target.value
                                                )
                                              }
                                              rows={1}
                                              autoGrow
                                              containerClassName="spells-edit-translation border-[#2a2f37] bg-[#0c0d0f]"
                                              className="text-sm leading-5 !text-neutral-200"
                                            />
                                            {showSpellSuggestions &&
                                              descriptionEntry?.uid &&
                                              spellSuggestions[descriptionEntry.uid] && (
                                                <div className="space-y-0.5 text-xs leading-5 text-neutral-500">
                                                  {[
                                                    spellSuggestions[descriptionEntry.uid].one,
                                                    spellSuggestions[descriptionEntry.uid].two
                                                  ]
                                                    .filter(Boolean)
                                                    .map((suggestion, index) => (
                                                      <div
                                                        key={`${descriptionEntry.uid}-description-suggestion-${index}`}
                                                      >
                                                        {renderSource(suggestion)}
                                                      </div>
                                                    ))}
                                                </div>
                                              )}
                                          </label>
                                        </section>
                                        {variants.length > 0 && (
                                          <div className="space-y-2 border-t border-[#2a2f37] pt-3">
                                            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                                              Variations
                                            </h3>
                                            {variants.map((variant) => {
                                              const variantNameEntry = resolveEntry(
                                                variant.name,
                                                matchingEntries.get(normalize(variant.name)) ?? []
                                              )
                                              const variantDescriptionEntry = resolveEntry(
                                                variant.description,
                                                matchingEntries.get(
                                                  normalize(variant.description)
                                                ) ?? []
                                              )
                                              return (
                                                <div
                                                  key={variant.name}
                                                  className="space-y-2 rounded-lg border border-[#2a2f37] bg-[#0c0d0f] p-2.5"
                                                >
                                                  <div className="space-y-1">
                                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                                                      Title · Source · EN
                                                    </span>
                                                    <div className="spells-edit-source translation-source-text text-xs font-medium text-neutral-200">
                                                      {renderSource(
                                                        variantNameEntry?.source ??
                                                          variant.cleanName
                                                      )}
                                                      {showSpellUid && variantNameEntry?.uid && (
                                                        <span className="ml-2 text-[10px] font-normal text-neutral-500">
                                                          {variantNameEntry.uid}
                                                        </span>
                                                      )}
                                                    </div>
                                                  </div>
                                                  <label className="block space-y-2">
                                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                                                      Title · Translation · RO
                                                    </span>
                                                    <input
                                                      defaultValue={variant.translated}
                                                      placeholder="Romanian name..."
                                                      disabled={!variantNameEntry}
                                                      onBlur={(event) =>
                                                        variantNameEntry &&
                                                        session.updateEntry(
                                                          variantNameEntry.rowId,
                                                          event.target.value
                                                        )
                                                      }
                                                      className="block w-full rounded border border-[#2a2f37] bg-[#11151b] px-2 py-1.5 text-xs text-neutral-200 outline-none focus:border-red-400/60 disabled:cursor-not-allowed disabled:opacity-50"
                                                    />
                                                    {showSpellSuggestions &&
                                                      variantNameEntry?.uid &&
                                                      spellSuggestions[variantNameEntry.uid] && (
                                                        <div className="space-y-0.5 text-xs leading-5 text-neutral-500">
                                                          {[
                                                            spellSuggestions[variantNameEntry.uid]
                                                              .one,
                                                            spellSuggestions[variantNameEntry.uid]
                                                              .two
                                                          ]
                                                            .filter(Boolean)
                                                            .map((suggestion, index) => (
                                                              <div
                                                                key={`${variantNameEntry.uid}-title-suggestion-${index}`}
                                                              >
                                                                {renderSource(suggestion)}
                                                              </div>
                                                            ))}
                                                        </div>
                                                      )}
                                                  </label>
                                                  <div className="space-y-1">
                                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                                                      Description · Source · EN
                                                    </span>
                                                    <div className="spells-edit-source translation-source-text text-xs font-medium leading-5 text-neutral-200">
                                                      {renderSource(
                                                        variantDescriptionEntry?.source ??
                                                          (variant.description ||
                                                            'No English description available.')
                                                      )}
                                                      {showSpellUid &&
                                                        variantDescriptionEntry?.uid && (
                                                          <span className="ml-2 text-[10px] font-normal text-neutral-500">
                                                            {variantDescriptionEntry.uid}
                                                          </span>
                                                        )}
                                                    </div>
                                                  </div>
                                                  <label className="block space-y-2">
                                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                                                      Description · Translation · RO
                                                    </span>
                                                    <HighlightedTextarea
                                                      value={variant.translatedDescription}
                                                      placeholder="Romanian description..."
                                                      onBlur={(event) =>
                                                        variantDescriptionEntry &&
                                                        session.updateEntry(
                                                          variantDescriptionEntry.rowId,
                                                          event.target.value
                                                        )
                                                      }
                                                      rows={1}
                                                      autoGrow
                                                      containerClassName="spells-edit-translation border-[#2a2f37] bg-[#11151b]"
                                                      className="text-xs leading-4 !text-neutral-200"
                                                    />
                                                    {showSpellSuggestions &&
                                                      variantDescriptionEntry?.uid &&
                                                      spellSuggestions[
                                                        variantDescriptionEntry.uid
                                                      ] && (
                                                        <div className="space-y-0.5 text-xs leading-5 text-neutral-500">
                                                          {[
                                                            spellSuggestions[
                                                              variantDescriptionEntry.uid
                                                            ].one,
                                                            spellSuggestions[
                                                              variantDescriptionEntry.uid
                                                            ].two
                                                          ]
                                                            .filter(Boolean)
                                                            .map((suggestion, index) => (
                                                              <div
                                                                key={`${variantDescriptionEntry.uid}-description-suggestion-${index}`}
                                                              >
                                                                {renderSource(suggestion)}
                                                              </div>
                                                            ))}
                                                        </div>
                                                      )}
                                                  </label>
                                                </div>
                                              )
                                            })}
                                          </div>
                                        )}
                                        {conditions.length > 0 && (
                                          <div className="space-y-2 border-t border-[#2a2f37] pt-3">
                                            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                                              Conditions
                                            </h3>
                                            {conditions.map((condition) => {
                                              const conditionNameEntry = resolveEntry(
                                                condition.name,
                                                matchingEntries.get(normalize(condition.name)) ?? []
                                              )
                                              const conditionDescriptionEntry = resolveEntry(
                                                condition.description,
                                                matchingEntries.get(
                                                  normalize(condition.description)
                                                ) ?? []
                                              )
                                              return (
                                                <div
                                                  key={condition.name}
                                                  className="space-y-2 rounded-lg border border-[#2a2f37] bg-[#0c0d0f] p-2.5"
                                                >
                                                  <div className="space-y-1">
                                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                                                      Title · Source · EN
                                                    </span>
                                                    <div className="spells-edit-source translation-source-text text-xs font-medium text-neutral-200">
                                                      {renderSource(
                                                        conditionNameEntry?.source ?? condition.name
                                                      )}
                                                      {showSpellUid && conditionNameEntry?.uid && (
                                                        <span className="ml-2 text-[10px] font-normal text-neutral-500">
                                                          {conditionNameEntry.uid}
                                                        </span>
                                                      )}
                                                    </div>
                                                  </div>
                                                  <label className="block space-y-2">
                                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                                                      Title · Translation · RO
                                                    </span>
                                                    <input
                                                      defaultValue={condition.translatedName}
                                                      placeholder="Romanian name..."
                                                      disabled={!conditionNameEntry}
                                                      onBlur={(event) =>
                                                        conditionNameEntry &&
                                                        session.updateEntry(
                                                          conditionNameEntry.rowId,
                                                          event.target.value
                                                        )
                                                      }
                                                      className="block w-full rounded border border-[#2a2f37] bg-[#11151b] px-2 py-1.5 text-xs text-neutral-200 outline-none focus:border-red-400/60 disabled:cursor-not-allowed disabled:opacity-50"
                                                    />
                                                    {showSpellSuggestions &&
                                                      conditionNameEntry?.uid &&
                                                      spellSuggestions[conditionNameEntry.uid] && (
                                                        <div className="space-y-0.5 text-xs leading-5 text-neutral-500">
                                                          {[
                                                            spellSuggestions[conditionNameEntry.uid]
                                                              .one,
                                                            spellSuggestions[conditionNameEntry.uid]
                                                              .two
                                                          ]
                                                            .filter(Boolean)
                                                            .map((suggestion, index) => (
                                                              <div
                                                                key={`${conditionNameEntry.uid}-title-suggestion-${index}`}
                                                              >
                                                                {renderSource(suggestion)}
                                                              </div>
                                                            ))}
                                                        </div>
                                                      )}
                                                  </label>
                                                  <div className="space-y-1">
                                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                                                      Description · Source · EN
                                                    </span>
                                                    <div className="spells-edit-source translation-source-text text-xs font-medium leading-5 text-neutral-200">
                                                      {renderSource(
                                                        conditionDescriptionEntry?.source ??
                                                          (condition.description ||
                                                            'No English description available.')
                                                      )}
                                                      {showSpellUid &&
                                                        conditionDescriptionEntry?.uid && (
                                                          <span className="ml-2 text-[10px] font-normal text-neutral-500">
                                                            {conditionDescriptionEntry.uid}
                                                          </span>
                                                        )}
                                                    </div>
                                                  </div>
                                                  <label className="block space-y-2">
                                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                                                      Description · Translation · RO
                                                    </span>
                                                    <HighlightedTextarea
                                                      value={condition.translatedDescription}
                                                      placeholder="Romanian description..."
                                                      onBlur={(event) =>
                                                        conditionDescriptionEntry &&
                                                        session.updateEntry(
                                                          conditionDescriptionEntry.rowId,
                                                          event.target.value
                                                        )
                                                      }
                                                      rows={1}
                                                      autoGrow
                                                      containerClassName="spells-edit-translation border-[#2a2f37] bg-[#11151b]"
                                                      className="text-xs leading-4 !text-neutral-200"
                                                    />
                                                    {showSpellSuggestions &&
                                                      conditionDescriptionEntry?.uid &&
                                                      spellSuggestions[
                                                        conditionDescriptionEntry.uid
                                                      ] && (
                                                        <div className="space-y-0.5 text-xs leading-5 text-neutral-500">
                                                          {[
                                                            spellSuggestions[
                                                              conditionDescriptionEntry.uid
                                                            ].one,
                                                            spellSuggestions[
                                                              conditionDescriptionEntry.uid
                                                            ].two
                                                          ]
                                                            .filter(Boolean)
                                                            .map((suggestion, index) => (
                                                              <div
                                                                key={`${conditionDescriptionEntry.uid}-description-suggestion-${index}`}
                                                              >
                                                                {renderSource(suggestion)}
                                                              </div>
                                                            ))}
                                                        </div>
                                                      )}
                                                  </label>
                                                </div>
                                              )
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>,
                                document.body
                              )}
                          </article>
                        )}
                      </Fragment>
                    )
                  })}
                </div>
              )}
            </section>
          ))}
          {filtered.length === 0 && (
            <div className="py-20 text-center text-sm text-neutral-500">
              No spells match this search.
            </div>
          )}
        </div>
      </div>
      </div>
    </>
  )
}
