import {
  ArrowRight,
  ChevronDown,
  CornerDownRight,
  CheckCircle2,
  Circle,
  ExternalLink,
  Flag,
  LayoutGrid,
  List,
  Pencil,
  Search,
  Sparkles,
  Sword,
  XCircle,
  WandSparkles,
  Zap
} from 'lucide-react'
import { Fragment, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import spellsData from '@/data/spells.json'
import { useTranslationSession, type ReviewStatus } from '@/context/TranslationSession'
import { getReferenceCatalog } from '@/data/gameReference'
import { HighlightedTextarea } from '@/components/shared/HighlightedTextarea'
import { renderSource } from '@/utils/renderSource'

type GameEntry = ReturnType<typeof getReferenceCatalog>[number]
type DisplayEntry = GameEntry & { displayKind?: EntryKind; wikiUrl?: string }
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

const spellLevelLabel = (entry: GameEntry): string => {
  if (entry.level === '0') return 'Cantrips'
  if (entry.level) return `Level ${entry.level} spells`
  return 'Other spells'
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

const classifyEntry = (entry: DisplayEntry): EntryKind => {
  if (entry.displayKind) return entry.displayKind
  const id = entry.id ?? ''
  const flags = entry.flags ?? ''
  const icon = entry.icon ?? ''
  if (/IsEnemySpell|Monster|_LOW_/i.test(`${flags} ${id} ${icon}`)) return 'monster'
  if (/ritual/i.test(`${entry.name} ${id} ${flags}`)) return 'ritual'
  if (/BonusActionPoint/i.test(entry.useCosts ?? '') && !/^Spell_/i.test(icon)) return 'bonus'
  if (/^Action_|SpellActionType/i.test(`${icon} ${entry.actionType ?? ''}`)) return 'action'
  return 'spell'
}

const levelRank = (entry: GameEntry): number => {
  if (classifyEntry(entry) !== 'spell')
    return 100 + Object.keys(kindLabel).indexOf(classifyEntry(entry))
  if (entry.level === '0') return 0
  if (!(entry.level ?? '').trim()) return 50
  const level = Number(entry.level)
  return Number.isFinite(level) ? level : 50
}

const normalize = (value: string): string =>
  value
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,!?])/g, '$1')
    .trim()
    .toLocaleLowerCase()

export function SpellsPage(): React.JSX.Element {
  const navigate = useNavigate()
  const session = useTranslationSession()
  const [viewMemory] = useState<SpellsViewMemory>(() => {
    try {
      return JSON.parse(localStorage.getItem(SPELLS_VIEW_MEMORY_KEY) ?? '{}') as SpellsViewMemory
    } catch {
      return {}
    }
  })
  const [query, setQuery] = useState(viewMemory.query ?? '')
  const [kind, setKind] = useState<'all' | EntryKind>(viewMemory.kind ?? 'all')
  const [sort, setSort] = useState<'alpha' | 'level' | 'complete' | 'incomplete'>(
    viewMemory.sort ?? 'alpha'
  )
  const [view, setView] = useState<'cards' | 'list'>(viewMemory.view ?? 'cards')
  const [statusFilter, setStatusFilter] = useState<'all' | ReviewStatus>(viewMemory.status ?? 'all')
  const deferredQuery = useDeferredValue(query)
  const [editingSpell, setEditingSpell] = useState<string | null>(null)
  const [expandedVariants, setExpandedVariants] = useState<Set<string>>(new Set())
  const [expandedConditions, setExpandedConditions] = useState<Set<string>>(new Set())
  const [collapsedGroups, setCollapsedGroups] = useState<Set<EntryKind>>(new Set())
  const [collapsedLevels, setCollapsedLevels] = useState<Set<string>>(new Set())
  const [wikiConditions, setWikiConditions] = useState<Record<string, string[]>>({})
  const [loadingWikiConditions, setLoadingWikiConditions] = useState<Set<string>>(new Set())
  const [wikiConditionEntries, setWikiConditionEntries] = useState<DisplayEntry[]>([])

  useEffect(() => {
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
  }, [])

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
    return [...getReferenceCatalog('Spell'), ...conditions.values()]
  }, [statusCatalog, wikiConditionEntries])
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
      referenceCatalog.map((entry) => ({
        entry,
        name: normalize(entry.name),
        description: normalize(entry.description)
      })),
    [referenceCatalog]
  )
  const filtered = useMemo(() => {
    const needle = normalize(deferredQuery)
    const seen = new Set<string>()
    return searchableCatalog.flatMap(({ entry, name, description }) => {
      if (
        !entry.id ||
        !entry.description.trim() ||
        /%%%/.test(entry.name) ||
        /%%%/.test(entry.description)
      )
        return []
      if (kind !== 'all' && classifyEntry(entry) !== kind) return []
      const nameMatches = matchingEntries.get(normalize(entry.name)) ?? []
      const descriptionMatches = matchingEntries.get(normalize(entry.description)) ?? []
      const linked = [...nameMatches, ...descriptionMatches]
      const isComplete =
        nameMatches.some((item) => item.target.trim()) &&
        descriptionMatches.some((item) => item.target.trim())
      const status =
        linked.find((item) => item.reviewStatus)?.reviewStatus ??
        (isComplete ? 'verified' : 'untranslated')
      if (statusFilter !== 'all' && status !== statusFilter) return []
      const matchesQuery = !needle || name.includes(needle) || description.includes(needle)
      if (!matchesQuery) return []
      const key = `${name}\u0000${description}`
      if (seen.has(key)) return []
      seen.add(key)
      return [entry]
    })
  }, [deferredQuery, kind, matchingEntries, searchableCatalog, statusFilter])

  const sorted = useMemo(() => {
    const isComplete = (entry: GameEntry): boolean => {
      const name = matchingEntries.get(normalize(entry.name)) ?? []
      const description = matchingEntries.get(normalize(entry.description)) ?? []
      return (
        name.some((item) => item.target.trim()) && description.some((item) => item.target.trim())
      )
    }
    return [...filtered].sort((a, b) => {
      if (sort === 'level') {
        const levelDifference = levelRank(a) - levelRank(b)
        if (levelDifference !== 0) return levelDifference
      }
      if (sort === 'complete' || sort === 'incomplete') {
        const aComplete = isComplete(a)
        const bComplete = isComplete(b)
        if (aComplete !== bComplete) {
          return sort === 'complete' ? (aComplete ? -1 : 1) : aComplete ? 1 : -1
        }
      }
      return a.name.localeCompare(b.name)
    })
  }, [filtered, matchingEntries, sort])

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
      spells.sort((a, b) => levelRank(a) - levelRank(b) || a.name.localeCompare(b.name))
    }
    return [...groups.entries()]
  }, [sorted])

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0c0d0f] text-neutral-200">
      <header className="app-page-header flex shrink-0 flex-wrap items-center gap-3 border-b border-[#1f2329] bg-[#0f1114] px-6 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300">
          <WandSparkles size={19} />
        </div>
        <div>
          <h1 className="text-base font-semibold text-neutral-100">Spells</h1>
          <p className="text-xs text-neutral-500">
            Game Data abilities + BG3 Wiki conditions · {referenceCatalog.length} entries
          </p>
        </div>
        <a
          href="https://bg3.wiki/wiki/List_of_all_spells"
          target="_blank"
          rel="noreferrer"
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-[#2a2f37] px-2.5 py-1.5 text-xs text-neutral-400 hover:border-amber-500/40 hover:text-amber-200"
        >
          <ExternalLink size={13} /> BG3 Wiki
        </a>
      </header>
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[#1f2329] bg-[#0c0d0f] px-5 py-3">
        <label className="relative min-w-56 flex-1 sm:max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search spells, actions, abilities..."
            className="h-8 w-full rounded-md border border-[#2a2f37] bg-[#131518] pl-8 pr-3 text-xs text-neutral-200 outline-none focus:border-amber-500/60"
          />
        </label>
        <select
          value={kind}
          onChange={(event) => setKind(event.target.value as 'all' | EntryKind)}
          className="h-8 rounded-md border border-[#2a2f37] bg-[#131518] px-2.5 text-xs text-neutral-300 outline-none focus:border-amber-500/60"
        >
          <option value="all">Everything</option>
          {(Object.keys(kindLabel) as EntryKind[]).map((value) => (
            <option key={value} value={value}>
              {kindLabel[value]}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(event) =>
            setSort(event.target.value as 'alpha' | 'level' | 'complete' | 'incomplete')
          }
          aria-label="Sort entries"
          className="h-8 rounded-md border border-[#2a2f37] bg-[#131518] px-2.5 text-xs text-neutral-300 outline-none focus:border-amber-500/60"
        >
          <option value="alpha">A–Z</option>
          <option value="level">By level</option>
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
            className={`inline-flex h-7 items-center gap-1 rounded px-2 text-[11px] transition-colors ${view === 'cards' ? 'bg-amber-500/15 text-amber-200' : 'text-neutral-500 hover:text-neutral-300'}`}
          >
            <LayoutGrid size={13} /> Cards
          </button>
          <button
            type="button"
            onClick={() => setView('list')}
            aria-label="List view"
            aria-pressed={view === 'list'}
            className={`inline-flex h-7 items-center gap-1 rounded px-2 text-[11px] transition-colors ${view === 'list' ? 'bg-amber-500/15 text-amber-200' : 'text-neutral-500 hover:text-neutral-300'}`}
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
          className="h-8 rounded-md border border-[#2a2f37] px-2.5 text-[11px] text-neutral-400 hover:border-amber-500/40 hover:text-amber-200"
        >
          {collapsedGroups.size || collapsedLevels.size ? 'Expand all' : 'Collapse all'}
        </button>
        <span className="text-[11px] text-neutral-600">{filtered.length} shown</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="w-full space-y-7">
          {grouped.map(([group, spells]) => (
            <section key={group}>
              {(() => {
                const completed = spells.filter((entry) => {
                  const name = matchingEntries.get(normalize(entry.name)) ?? []
                  const description = matchingEntries.get(normalize(entry.description)) ?? []
                  return (
                    name.some((item) => item.target.trim()) &&
                    description.some((item) => item.target.trim())
                  )
                }).length
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
                    const variants = referenceCatalog
                      .filter((entry) =>
                        normalize(entry.name).startsWith(`${normalize(spell.name)}:`)
                      )
                      .filter(
                        (entry) =>
                          entry.description.trim() &&
                          entry.id &&
                          !/%%%/.test(entry.name) &&
                          !/%%%/.test(entry.description)
                      )
                      .filter((entry) => entry.id)
                      .filter(
                        (entry, index, all) =>
                          all.findIndex(
                            (item) => normalize(item.name) === normalize(entry.name)
                          ) === index
                      )
                      .map((entry) => ({
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
                      ...(spell.conditions ?? []).map((token) => ({ token, label: token })),
                      ...(wikiConditions[spell.name] ?? []).map((token) => ({
                        token,
                        label: token
                      }))
                    ]
                    const conditions = conditionTokens
                      .map(({ token, label }) => {
                        const status =
                          statusIndex.byName.get(normalize(label)) ??
                          statusIndex.byName.get(normalize(token)) ??
                          statusIndex.byToken.get(normalize(token))
                        if (
                          !status ||
                          !status.description.trim() ||
                          /%%%/.test(status.name + status.description)
                        )
                          return null
                        const statusNameMatches = matchingEntries.get(normalize(status.name)) ?? []
                        const statusDescriptionMatches =
                          matchingEntries.get(normalize(status.description)) ?? []
                        return {
                          ...status,
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
                    const hasPotentialConditions =
                      classifyEntry(spell) !== 'condition' &&
                      (conditions.length > 0 ||
                        classifyEntry(spell) !== 'spell' ||
                        (spell.icon ?? '').startsWith('Action_'))
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
                              {spells.filter((item) => item.level === spell.level).length}
                            </span>
                            <div className="h-px flex-1 bg-amber-500/15" />
                          </div>
                        )}
                        {!collapsedLevels.has(levelKey) && (
                          <article
                            className={`group relative min-w-0 overflow-hidden rounded-xl border p-3 transition-colors ${isTranslated ? 'border-amber-500/55 bg-amber-500/5 hover:border-amber-400/70' : 'border-[#252a31] bg-[#131518] hover:border-amber-500/35'}`}
                          >
                            <div className="flex min-w-0 gap-3">
                              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-amber-500/25 bg-[#0c0d0f]">
                                {icon ? (
                                  <img
                                    src={icon}
                                    alt=""
                                    loading="lazy"
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <Sparkles className="m-4 text-amber-300" size={24} />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <h3 className="break-words text-sm font-semibold text-neutral-100 [overflow-wrap:anywhere]">
                                      {spell.name}
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
                                      <div className="mt-0.5 flex items-center gap-1 text-xs font-normal text-amber-300">
                                        <CornerDownRight
                                          size={12}
                                          className="shrink-0 opacity-70"
                                        />
                                        <span className="break-words [overflow-wrap:anywhere]">
                                          {translatedName}
                                        </span>
                                      </div>
                                    ) : null}
                                    <span className="mt-1 inline-flex items-center gap-1 rounded border border-amber-500/25 bg-amber-500/8 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                                      <EntryIcon entry={spell} />
                                      {entryLabel(spell)}
                                    </span>
                                  </div>
                                  <div className="flex max-w-full shrink-0 flex-col items-end gap-1">
                                    <span className="rounded border border-[#2a2f37] px-1.5 py-0.5 text-[10px] text-neutral-500">
                                      {matches
                                        ? `${matches} match${matches === 1 ? '' : 'es'}`
                                        : 'not linked'}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        navigate(
                                          `/game-data?spell=${encodeURIComponent(spell.name)}`
                                        )
                                      }
                                      className="inline-flex max-w-full items-center gap-1 rounded-md border border-[#2a2f37] px-1.5 py-0.5 text-[10px] text-neutral-400 hover:border-amber-500/45 hover:text-amber-200"
                                    >
                                      <span className="truncate">Open in Game Data</span>{' '}
                                      <ArrowRight size={10} className="shrink-0" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingSpell((current) =>
                                          current === spellKey ? null : spellKey
                                        )
                                        if (editingSpell !== spellKey && variants.length > 0) {
                                          setExpandedVariants((current) =>
                                            new Set(current).add(spellKey)
                                          )
                                        }
                                      }}
                                      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] transition-colors ${editingSpell === spellKey ? 'border-amber-500/50 bg-amber-500/10 text-amber-200' : 'border-[#2a2f37] text-neutral-400 hover:border-amber-500/45 hover:text-amber-200'}`}
                                    >
                                      <Pencil size={10} />{' '}
                                      {editingSpell === spellKey ? 'Done' : 'Edit'}
                                    </button>
                                  </div>
                                </div>
                                <p className="mt-1 break-words text-xs leading-4 text-neutral-400 [overflow-wrap:anywhere]">
                                  {renderSource(description || 'No English description available.')}
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
                                  <p className="mt-1 text-xs leading-4 text-amber-200/85">
                                    {renderSource(translatedDescription)}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                            {variants.length > 0 && (
                              <div className="mt-3 border-t border-[#1f2329] pt-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedVariants((current) => {
                                      const next = new Set(current)
                                      const key = spell.id ?? spell.name
                                      if (next.has(key)) next.delete(key)
                                      else next.add(key)
                                      return next
                                    })
                                  }
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
                                            {icon ? (
                                              <img
                                                src={icon}
                                                alt=""
                                                loading="lazy"
                                                className="h-full w-full object-cover"
                                              />
                                            ) : (
                                              <Sparkles
                                                className="m-1.5 text-amber-300"
                                                size={16}
                                              />
                                            )}
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
                                                  <span className="ml-1 font-normal text-amber-300">
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
                                                <div className="mt-0.5 text-amber-200/80">
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
                                  {loadingWikiConditions.has(spell.name) ? '…' : conditions.length})
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
                                              <span className="ml-1 font-normal text-amber-300/80">
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
                                            <div className="mt-0.5 text-amber-200/80">
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
                            <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-[#1f2329] pt-2">
                              {(
                                [
                                  ['verified', 'Verified', CheckCircle2],
                                  ['not-verified', 'Not verified', XCircle],
                                  ['needs-review', 'Needs review', Flag],
                                  ['untranslated', 'Untranslated', Circle]
                                ] as const
                              ).map(([status, label, Icon]) => (
                                <button
                                  key={status}
                                  type="button"
                                  title={label}
                                  onClick={() => setStatus(status)}
                                  className={`inline-flex items-center gap-1 rounded border px-1.5 py-1 text-[10px] transition-colors ${currentStatus === status ? 'border-amber-500/50 bg-amber-500/10 text-amber-200' : 'border-[#2a2f37] text-neutral-600 hover:border-amber-500/35 hover:text-neutral-300'}`}
                                >
                                  <Icon size={12} />
                                  <span className="hidden 2xl:inline">{label}</span>
                                </button>
                              ))}
                            </div>
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
          <p className="pb-4 text-center text-[10px] text-neutral-600">
            Spell list and icon artwork sourced from{' '}
            <a
              className="text-amber-400 hover:underline"
              href="https://bg3.wiki/wiki/List_of_all_spells"
              target="_blank"
              rel="noreferrer"
            >
              bg3.wiki
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  )
}
