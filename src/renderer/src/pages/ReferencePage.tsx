import { useVirtualizer } from '@tanstack/react-virtual'
import {
  BookOpen,
  BookText,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleX,
  ClipboardPaste,
  Code2,
  Copy,
  ExternalLink,
  Eye,
  Flag,
  FlaskConical,
  Hash,
  History,
  Languages,
  MapPin,
  Package,
  ScrollText,
  Shield,
  Sparkles,
  Swords,
  UsersRound,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { HighlightedTextarea } from '@/components/shared/HighlightedTextarea'
import { AppTooltip } from '@/components/shared/AppTooltip'
import { StyledWebview } from '@/components/shared/StyledWebview'
import { TextSearchInput } from '@/components/shared/TextSearchInput'
import { AITranslateModal } from '@/components/translation/AITranslateModal'
import { SimilarityExamplesModal } from '@/components/translation/SimilarityExamplesModal'
import { TranslationHistoryDialog } from '@/components/translation/TranslationHistoryDialog'
import {
  type ReviewStatus,
  type TranslationSessionEntry,
  useTranslationSession
} from '@/context/TranslationSession'
import {
  getReferenceCatalog,
  type ReferenceCatalogEntry,
  type ReferenceCategory
} from '@/data/gameReference'
import { SessionSaveButton } from '@/features/translate/components/SessionSaveButton'
import { btnGhostIcon } from '@/features/translate/components/styles'
import { TermGlossaryModal } from '@/features/translate/components/TermGlossaryModal'
import { useRetainedMemo } from '@/hooks/useRetainedMemo'
import { useSessionStructure } from '@/hooks/useSessionStructure'
import { cn } from '@/lib/utils'
import { extractLarianTags, type TextSelection, wrapSelectionWithTag } from '@/utils/larianTags'
import { renderSource } from '@/utils/renderSource'
import { normalizeSearchText, stripSearchDiacritics } from '@/utils/search'
import {
  getTermGlossaryStorageKey,
  loadTermGlossary,
  type TermGlossaryEntry
} from '@/utils/termGlossary'

const CATEGORIES: Array<{ label: string; value?: ReferenceCategory }> = [
  { label: 'Quests', value: 'Quest' },
  { label: 'Locations', value: 'Location' },
  { label: 'Books', value: 'Book' },
  { label: 'Items', value: 'Item' },
  { label: 'NPCs', value: 'NPC' },
  { label: 'Char. Creation', value: 'Character Creation' }
]
const TITLE_TRANSLATION_PREFERENCE = 'polyhedron:game-data:show-translated-item-titles'
const GAME_DATA_STATE_KEY = 'polyhedron:game-data:ui-state'

interface GameDataUiState {
  category?: ReferenceCategory
  query?: string
  matchCase?: boolean
  wholeWord?: boolean
  showContentUid?: boolean
  selectedByCategory?: Partial<Record<ReferenceCategory, string>>
}

function readGameDataUiState(): GameDataUiState {
  try {
    return JSON.parse(window.sessionStorage.getItem(GAME_DATA_STATE_KEY) ?? '{}') as GameDataUiState
  } catch {
    return {}
  }
}

function findGameDataEntry(category: ReferenceCategory, name?: string): ReferenceCatalogEntry | null {
  if (!name) return null
  return getReferenceCatalog()
    .find((entry) => entry.name === name && (category === 'Item'
      ? (entry.itemGroups?.length ?? 0) > 0
      : entry.category === category)) ?? null
}

function usePersistedSet(key: string, initial: Set<string>): [Set<string>, React.Dispatch<React.SetStateAction<Set<string>>>] {
  const [value, setValue] = useState<Set<string>>(() => {
    try {
      const saved = window.sessionStorage.getItem(key)
      return saved ? new Set(JSON.parse(saved) as string[]) : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      window.sessionStorage.setItem(key, JSON.stringify([...value]))
    } catch {
      // Preserve the state for this mounted route when session storage is unavailable.
    }
  }, [key, value])
  return [value, setValue]
}

function useScrollSelectedEntry(
  listRef: React.RefObject<HTMLElement | null>,
  selectedName: string | undefined,
  layoutKey = ''
): void {
  const hasRevealedSelection = useRef(false)
  useEffect(() => {
    if (!selectedName || hasRevealedSelection.current) return
    let frame = 0
    let attempts = 0
    const scrollSelectedIntoView = () => {
      const list = listRef.current
      const selected = list?.querySelector<HTMLElement>('[data-game-data-selected="true"]')
      if (list && selected) {
        const listBounds = list.getBoundingClientRect()
        const selectedBounds = selected.getBoundingClientRect()
        const listCenter = listBounds.top + list.clientHeight / 2
        const selectedCenter = selectedBounds.top + selectedBounds.height / 2
        const maxScroll = Math.max(0, list.scrollHeight - list.clientHeight)
        list.scrollTop = Math.min(maxScroll, Math.max(0, list.scrollTop + selectedCenter - listCenter))
        hasRevealedSelection.current = true
        return
      }
      if (attempts++ < 12) frame = window.requestAnimationFrame(scrollSelectedIntoView)
      else hasRevealedSelection.current = true
    }
    frame = window.requestAnimationFrame(scrollSelectedIntoView)
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [layoutKey, listRef, selectedName])
}

function iconFor(category: string): typeof Swords {
  if (category === 'Quest') return ScrollText
  if (category === 'Book') return BookOpen
  if (category === 'Item') return Package
  if (category === 'NPC') return UsersRound
  if (category === 'Location') return MapPin
  if (category === 'Character Creation') return UsersRound
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
    Interrupt: 'Interrupts',
    Quest: 'Quests',
    Book: 'Books',
    Item: 'Items',
    NPC: 'List_of_characters',
    Location: 'Locations',
    'Character Creation': 'Character_creation'
  }
  if (!name) return `/wiki/${names[category]}`
  const [title, section] = name.split('#', 2)
  const pagePath = `/wiki/${encodeURIComponent(title.trim().replace(/\s+/g, '_'))}`
  return section ? `${pagePath}#${encodeURIComponent(section.replace(/\s+/g, '_'))}` : pagePath
}
function QuestTreeList({
  stateKey,
  entries,
  allEntries,
  current,
  onSelect,
  statusByEntry,
  rowsBySource,
  showTranslatedTitles,
  collapseSectionsByDefault = false
}: {
  stateKey: string
  entries: ReferenceCatalogEntry[]
  allEntries: ReferenceCatalogEntry[]
  current: ReferenceCatalogEntry | null
  onSelect: (entry: ReferenceCatalogEntry) => void
  statusByEntry: Map<string, ReferenceStatusCounts>
  rowsBySource: Map<string, TranslationSessionEntry[]>
  showTranslatedTitles: boolean
  collapseSectionsByDefault?: boolean
}): React.JSX.Element {
  const listRef = useRef<HTMLDivElement>(null)
  const hasAutoExpanded = useRef(false)
  const [expanded, setExpanded] = usePersistedSet(`polyhedron:game-data:${stateKey}:expanded`, new Set())
  const [expandedSections, setExpandedSections] = usePersistedSet(`polyhedron:game-data:${stateKey}:expanded-sections`, new Set())
  const [collapsedSections, setCollapsedSections] = usePersistedSet(`polyhedron:game-data:${stateKey}:collapsed-sections`, new Set())
  const byName = useMemo(() => new Map(allEntries.map((entry) => [entry.name, entry])), [allEntries])
  const referenced = useMemo(
    () => new Set(entries.flatMap((entry) => entry.category === 'Location' ? entry.subLocations ?? [] : entry.subquests ?? [])),
    [entries]
  )
  const roots = entries.filter((entry) => !referenced.has(entry.name))
  useEffect(() => {
    if (!current || hasAutoExpanded.current) return
    hasAutoExpanded.current = true
    const allReferenced = new Set(allEntries.flatMap((entry) => entry.category === 'Location' ? entry.subLocations ?? [] : entry.subquests ?? []))
    const allRoots = allEntries.filter((entry) => !allReferenced.has(entry.name))
    const findPath = (entry: ReferenceCatalogEntry, ancestors: Set<string>): string[] | null => {
      if (entry.name === current.name) return [entry.name]
      if (ancestors.has(entry.name)) return null
      const nextAncestors = new Set(ancestors).add(entry.name)
      const childNames = entry.category === 'Location' ? entry.subLocations ?? [] : entry.subquests ?? []
      for (const childName of childNames) {
        const child = byName.get(childName)
        const childPath = child ? findPath(child, nextAncestors) : null
        if (childPath) return [entry.name, ...childPath]
      }
      return null
    }
    const path = allRoots.map((entry) => findPath(entry, new Set())).find((candidate) => candidate !== null)
    if (!path) return
    setExpanded((previous) => new Set([...previous, ...path.slice(0, -1)]))
    const section = byName.get(path[0]!)?.section || 'Other quests'
    if (collapseSectionsByDefault) {
      setExpandedSections((previous) => new Set(previous).add(section))
    } else {
      setCollapsedSections((previous) => {
        if (!previous.has(section)) return previous
        const next = new Set(previous)
        next.delete(section)
        return next
      })
    }
  }, [allEntries, byName, collapseSectionsByDefault, current?.name, setCollapsedSections, setExpanded, setExpandedSections])
  useScrollSelectedEntry(listRef, current?.name, `${[...expanded].join('|')}:${[...expandedSections].join('|')}:${[...collapsedSections].join('|')}`)
  const sections = useMemo(() => {
    const groups = new Map<string, ReferenceCatalogEntry[]>()
    for (const entry of roots) {
      const section = entry.section || 'Other quests'
      const group = groups.get(section)
      if (group) group.push(entry)
      else groups.set(section, [entry])
    }
    return [...groups]
  }, [roots])
  const toggle = (name: string) =>
    setExpanded((previous) => {
      const next = new Set(previous)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  const toggleSection = (section: string) => {
    const setSections = collapseSectionsByDefault ? setExpandedSections : setCollapsedSections
    setSections((previous) => {
      const next = new Set(previous)
      if (next.has(section)) next.delete(section)
      else next.add(section)
      return next
    })
  }

  const renderQuest = (entry: ReferenceCatalogEntry, depth = 0, ancestors = new Set<string>()): React.JSX.Element => {
    const childNames = entry.category === 'Location' ? entry.subLocations ?? [] : entry.subquests ?? []
    const childEntries = childNames
      .map((name) => byName.get(name))
      .filter((child): child is ReferenceCatalogEntry => child !== undefined && !ancestors.has(child.name))
    const hasChildren = childEntries.length > 0
    const open = expanded.has(entry.name)
    const selected = current?.name === entry.name
    const titleRows = referenceTitleRows(entry, rowsBySource)
    const translatedTitle = showTranslatedTitles
      ? (titleRows.find((row) => row.target.trim() && row.reviewStatus === 'verified') ?? titleRows.find((row) => row.target.trim()))?.target.trim()
      : undefined
    const nextAncestors = new Set(ancestors).add(entry.name)
    return (
      <div key={`${entry.name}:${depth}`}>
        <div className="flex min-w-0 items-center gap-1" style={{ paddingLeft: depth * 12 }}>
          {hasChildren ? (
            <button
              type="button"
              aria-label={`${open ? 'Collapse' : 'Expand'} ${entry.name}`}
              aria-expanded={open}
              onClick={() => toggle(entry.name)}
              className="flex h-7 w-6 shrink-0 items-center justify-center rounded text-neutral-500 hover:bg-[#1c1f24] hover:text-neutral-200"
            >
              {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
          ) : (
            <span className="w-6 shrink-0" aria-hidden="true" />
          )}
          <button
            type="button"
            onClick={() => onSelect(entry)}
            data-game-data-selected={selected ? 'true' : undefined}
            className={cn(
              'min-w-0 flex-1 truncate rounded-md border-0 px-2 py-1.5 text-left text-[11px] transition-colors',
              selected
                ? 'bg-amber-500/10 text-amber-300'
                : 'text-neutral-300 hover:bg-[#1c1f24] hover:text-neutral-100'
            )}
            title={translatedTitle ? `${entry.name} · ${translatedTitle}` : entry.name}
          >
            <span className="min-w-0 flex-1 truncate">{entry.name}{translatedTitle && <><span className="text-neutral-500"> · </span><span className="text-[var(--poly-accent)]">{translatedTitle}</span></>}</span>
          </button>
          <ReferenceStatusRings stats={statusByEntry.get(referenceEntryKey(entry)) ?? emptyReferenceStatusCounts()} />
        </div>
        {open && hasChildren && (
          <div className="mt-0.5 border-l border-[#24282f]" style={{ marginLeft: depth * 12 + 13 }}>
            {childEntries.map((child) => renderQuest(child, depth + 1, nextAncestors))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div ref={listRef} className="polyhedron-scroll min-h-0 flex-1 overflow-y-auto">
      {sections.map(([section, group]) => {
        const open = collapseSectionsByDefault
          ? expandedSections.has(section)
          : !collapsedSections.has(section)
        return (
        <section key={section} className="mb-3">
          {collapseSectionsByDefault ? (
            <button
              type="button"
              aria-expanded={open}
              onClick={() => toggleSection(section)}
              className="sticky top-0 z-10 flex w-full items-center gap-1.5 bg-[#0c0d0f] px-2 py-1.5 text-left text-[9px] font-semibold uppercase tracking-[0.1em] text-neutral-500 hover:text-neutral-300"
            >
              {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              <span>{section.replaceAll(' / ', ' · ')}</span>
              <span className="ml-auto text-neutral-700">{group.length}</span>
            </button>
          ) : (
            <h3 className="sticky top-0 z-10 bg-[#0c0d0f] px-2 py-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-neutral-600">
              {section.replaceAll(' / ', ' · ')}
            </h3>
          )}
          {open && <div className="space-y-0.5">{group.map((entry) => renderQuest(entry))}</div>}
        </section>
      )})}
      {roots.length === 0 && <p className="px-2 py-4 text-xs text-neutral-600">{entries[0]?.category === 'Location' ? 'No locations found.' : entries[0]?.category === 'Book' ? 'No books found.' : 'No quests found.'}</p>}
    </div>
  )
}

interface NpcGroupNode {
  entries: ReferenceCatalogEntry[]
  children: Map<string, NpcGroupNode>
}

const NPC_GROUP_ORDER: Record<string, string[]> = {
  '': ['Party and camp', 'Prologue', 'Act One', 'Act Two', 'Act Three', 'Other Planes', 'Other NPCs'],
  'Party and camp': [
    'Origin Characters',
    'Companions',
    'Temporary Companions',
    'Hirelings',
    'Attached Followers',
    'Camp Followers',
    'Other'
  ],
  'Act One': ['Wilderness', 'Underdark', 'Rosymorn Monastery', 'Other Locations'],
  'Act Two': ['Shadow-Cursed Lands', 'Other Locations'],
  'Act Three': ['Rivington', "Wyrm's Crossing", "Baldur's Gate", 'Other Locations']
}

function sortNpcGroups(parentPath: string, labels: string[]): string[] {
  const preferredOrder = NPC_GROUP_ORDER[parentPath]
  if (!preferredOrder) return labels.sort((a, b) => a.localeCompare(b))
  const rank = new Map(preferredOrder.map((label, index) => [label, index]))
  return labels.sort((a, b) => {
    const rankA = rank.get(a)
    const rankB = rank.get(b)
    if (rankA !== undefined || rankB !== undefined) {
      return (rankA ?? Number.MAX_SAFE_INTEGER) - (rankB ?? Number.MAX_SAFE_INTEGER)
    }
    return a.localeCompare(b)
  })
}

function NpcTreeList({
  stateKey,
  entries,
  current,
  onSelect,
  statusByEntry,
  searching,
  rowsBySource,
  showTranslatedTitles
}: {
  stateKey: string
  entries: ReferenceCatalogEntry[]
  current: ReferenceCatalogEntry | null
  onSelect: (entry: ReferenceCatalogEntry) => void
  statusByEntry: Map<string, ReferenceStatusCounts>
  searching: boolean
  rowsBySource: Map<string, TranslationSessionEntry[]>
  showTranslatedTitles: boolean
}): React.JSX.Element {
  const listRef = useRef<HTMLDivElement>(null)
  const hasAutoExpanded = useRef(false)
  const [collapsed, setCollapsed] = usePersistedSet(`polyhedron:game-data:${stateKey}:collapsed`, new Set())
  const [expanded, setExpanded] = usePersistedSet(`polyhedron:game-data:${stateKey}:expanded`, new Set())
  const groups = useMemo(() => {
    const roots = new Map<string, NpcGroupNode>()
    for (const entry of entries) {
      for (const groupPath of entry.npcGroups?.length ? entry.npcGroups : ['Other NPCs']) {
        const path = groupPath.split(' / ').filter(Boolean)
        if (!path.length) continue
        let siblings = roots
        let node: NpcGroupNode | undefined
        for (const part of path) {
          node = siblings.get(part)
          if (!node) {
            node = { entries: [], children: new Map() }
            siblings.set(part, node)
          }
          siblings = node.children
        }
        if (node && !node.entries.some((item) => item.name === entry.name)) node.entries.push(entry)
      }
    }
    return roots
  }, [entries])
  useEffect(() => {
    if (hasAutoExpanded.current) return
    const groupPaths = current?.npcGroups ?? []
    if (!groupPaths.length) return
    hasAutoExpanded.current = true
    setCollapsed((previous) => {
      const next = new Set(previous)
      for (const groupPath of groupPaths) {
        const root = groupPath.split(' / ').filter(Boolean)[0]
        if (root) next.delete(root)
      }
      return next
    })
    setExpanded((previous) => {
      const next = new Set(previous)
      for (const groupPath of groupPaths) {
        const parts = groupPath.split(' / ').filter(Boolean)
        for (let index = 1; index < parts.length; index += 1) {
          next.add(parts.slice(0, index + 1).join('/'))
        }
      }
      return next
    })
  }, [current?.name, current?.npcGroups, setCollapsed, setExpanded])
  useScrollSelectedEntry(listRef, current?.name, `${[...collapsed].join('|')}:${[...expanded].join('|')}`)

  const toggle = (path: string, depth: number): void => {
    const setState = depth === 0 ? setCollapsed : setExpanded
    setState((previous) => {
      const next = new Set(previous)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }
  const countEntries = (node: NpcGroupNode): number =>
    node.entries.length + [...node.children.values()].reduce((total, child) => total + countEntries(child), 0)
  const renderEntry = (entry: ReferenceCatalogEntry, key: string, depth: number): React.JSX.Element => {
    const titleRows = referenceTitleRows(entry, rowsBySource)
    const translatedTitle = showTranslatedTitles
      ? (titleRows.find((row) => row.target.trim() && row.reviewStatus === 'verified') ?? titleRows.find((row) => row.target.trim()))?.target.trim()
      : undefined
    return <button
      key={key}
      type="button"
      onClick={() => onSelect(entry)}
      title={translatedTitle ? `${entry.name} · ${translatedTitle}` : entry.name}
      data-game-data-selected={current?.name === entry.name ? 'true' : undefined}
      className={cn(
        'flex min-h-8 w-full items-center rounded-md text-left text-[11px] transition-colors',
        depth === 0 ? 'px-2' : 'px-2',
        current?.name === entry.name ? 'bg-amber-500/10 text-amber-300' : 'text-neutral-300 hover:bg-[#1c1f24]'
      )}
      style={{ paddingLeft: `${12 + depth * 12}px`, paddingRight: 8 }}
    >
      <span className="min-w-0 flex-1 truncate">{entry.name}{translatedTitle && <><span className="text-neutral-500"> · </span><span className="text-[var(--poly-accent)]">{translatedTitle}</span></>}</span>
      <ReferenceStatusRings stats={statusByEntry.get(referenceEntryKey(entry)) ?? emptyReferenceStatusCounts()} />
    </button>
  }
  const renderGroup = (label: string, node: NpcGroupNode, path: string, depth: number): React.JSX.Element => {
    const open = searching || (depth === 0 ? !collapsed.has(path) : expanded.has(path))
    const headerClass = depth === 0
      ? 'sticky top-0 z-10 bg-[#0c0d0f] px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500'
      : 'px-3 py-1.5 text-[11px] text-neutral-400'
    return (
      <div key={path}>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => toggle(path, depth)}
          className={cn('flex w-full items-center gap-1.5 rounded text-left hover:bg-[#14181d] hover:text-neutral-200', headerClass)}
        >
          {open ? <ChevronDown size={depth === 0 ? 12 : 11} /> : <ChevronRight size={depth === 0 ? 12 : 11} />}
          <span className="flex-1">{label}</span>
          <span className="text-[9px] font-normal normal-case tracking-normal text-neutral-600">{countEntries(node)}</span>
        </button>
        {open && (
          <div className={depth === 0 ? '' : 'ml-2 border-l border-[#24282f]'}>
            {sortNpcGroups(path, [...node.children.keys()]).map((childLabel) => {
              const child = node.children.get(childLabel)!
              return (
              renderGroup(childLabel, child, `${path}/${childLabel}`, depth + 1)
              )
            })}
            {node.entries
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((entry) => renderEntry(entry, `${path}/${entry.name}`, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div ref={listRef} className="polyhedron-scroll min-h-0 flex-1 overflow-y-auto">
      {sortNpcGroups('', [...groups.keys()]).map((label) => {
        const node = groups.get(label)!
        return renderGroup(label, node, label, 0)
      })}
      {entries.length === 0 && <p className="px-2 py-4 text-xs text-neutral-600">No NPCs found.</p>}
    </div>
  )
}

function ItemTreeList({
  stateKey,
  entries,
  current,
  onSelect,
  searching,
  statusByEntry,
  rowsBySource,
  showTranslatedTitles
}: {
  stateKey: string
  entries: ReferenceCatalogEntry[]
  current: ReferenceCatalogEntry | null
  onSelect: (entry: ReferenceCatalogEntry) => void
  searching: boolean
  statusByEntry: Map<string, ReferenceStatusCounts>
  rowsBySource: Map<string, TranslationSessionEntry[]>
  showTranslatedTitles: boolean
}): React.JSX.Element {
  const listRef = useRef<HTMLDivElement>(null)
  const hasAutoExpanded = useRef(false)
  const [expandedSections, setExpandedSections] = usePersistedSet(
    `polyhedron:game-data:${stateKey}:expanded-sections`,
    new Set(['Equipment types', 'Magic equipment', 'Consumables', 'Miscellaneous'])
  )
  const [expandedTypes, setExpandedTypes] = usePersistedSet(`polyhedron:game-data:${stateKey}:expanded-types`, new Set())
  const groups = useMemo(() => {
    const result = new Map<
      string,
      Map<string, { items: ReferenceCatalogEntry[]; subtypes: Map<string, ReferenceCatalogEntry[]> }>
    >()
    for (const [section, types] of [
      ['Equipment types', [
        'Amulets', 'Armour', 'Camp Clothing', 'Cloaks', 'Clothing', 'Footwear', 'Headwear',
        'Handwear', 'Instruments', 'Rings', 'Shields', 'Underwear', 'Melee weapons', 'Ranged weapons'
      ]],
      ['Magic equipment', ['Magic items in Act One', 'Magic items in Act Two', 'Magic items in Act Three']],
      ['Consumables', ['Ammunition', 'Camp Supplies', 'Coatings', 'Dyes', 'Elixirs', 'Grenades', 'Potions', 'Scrolls']],
      ['Miscellaneous', ['Books', 'Containers', 'Notes', 'Other', 'Story Items', 'Valuables']]
    ] as Array<[string, string[]]>) {
      result.set(section, new Map(types.map((type) => [type, { items: [], subtypes: new Map() }])))
    }
    for (const entry of entries) {
      for (const group of entry.itemGroups ?? []) {
        let types = result.get(group.section)
        if (!types) result.set(group.section, (types = new Map()))
        let typeGroup = types.get(group.type)
        if (!typeGroup) types.set(group.type, (typeGroup = { items: [], subtypes: new Map() }))
        const items = group.subtype
          ? typeGroup.subtypes.get(group.subtype) ?? []
          : typeGroup.items
        if (group.subtype && !typeGroup.subtypes.has(group.subtype)) {
          typeGroup.subtypes.set(group.subtype, items)
        }
        if (!items.some((item) => item.name === entry.name)) items.push(entry)
      }
    }
    return result
  }, [entries])
  useEffect(() => {
    if (hasAutoExpanded.current || !current?.itemGroups?.length) return
    hasAutoExpanded.current = true
    setExpandedSections((previous) => {
      const next = new Set(previous)
      for (const group of current.itemGroups ?? []) next.add(group.section)
      return next
    })
    setExpandedTypes((previous) => {
      const next = new Set(previous)
      for (const group of current.itemGroups ?? []) {
        next.add(`${group.section}/${group.type}`)
        if (group.subtype) next.add(`${group.section}/${group.type}/${group.subtype}`)
      }
      return next
    })
  }, [current?.name, current?.itemGroups, setExpandedSections, setExpandedTypes])
  useScrollSelectedEntry(listRef, current?.name, `${[...expandedSections].join('|')}:${[...expandedTypes].join('|')}`)
  const toggleSection = (section: string) =>
    setExpandedSections((previous) => {
      const next = new Set(previous)
      if (next.has(section)) next.delete(section)
      else next.add(section)
      return next
    })
  const toggleType = (key: string) =>
    setExpandedTypes((previous) => {
      const next = new Set(previous)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  const rarityColor = (rarity?: string): string => {
    switch (rarity?.toLowerCase()) {
      case 'uncommon': return 'text-green-400'
      case 'rare': return 'text-blue-400'
      case 'very rare': return 'text-purple-400'
      case 'legendary': return 'text-orange-400'
      case 'story item': return 'text-orange-400'
      default: return 'text-neutral-300'
    }
  }
  return (
    <div ref={listRef} className="polyhedron-scroll min-h-0 flex-1 overflow-y-auto">
      {[...groups].map(([section, types]) => {
        const sectionOpen = searching || expandedSections.has(section)
        const count = [...types.values()].reduce(
          (total, group) => total + group.items.length + [...group.subtypes.values()].reduce((sum, items) => sum + items.length, 0),
          0
        )
        return (
          <section key={section} className="mb-1">
            <button
              type="button"
              aria-expanded={sectionOpen}
              onClick={() => toggleSection(section)}
              className="sticky top-0 z-10 flex w-full items-center gap-1.5 bg-[#0c0d0f] px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500 hover:text-neutral-300"
            >
              {sectionOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <span className="flex-1">{section}</span>
              <span className="text-[9px] font-normal normal-case tracking-normal text-neutral-600">{count}</span>
            </button>
            {sectionOpen && [...types].map(([type, typeGroup]) => {
              const key = `${section}/${type}`
              const typeOpen = searching || expandedTypes.has(key)
              const typeCount = typeGroup.items.length + [...typeGroup.subtypes.values()].reduce((sum, items) => sum + items.length, 0)
              const renderEntry = (entry: ReferenceCatalogEntry, entryKey: string) => {
                const titleRows = referenceTitleRows(entry, rowsBySource)
                const titleTranslation = showTranslatedTitles
                  ? (titleRows.find((row) => row.target.trim() && row.reviewStatus === 'verified') ??
                    titleRows.find((row) => row.target.trim()))?.target.trim()
                  : undefined
                return (
                  <button
                    key={entryKey}
                    type="button"
                    onClick={() => onSelect(entry)}
                    title={entry.name}
                    data-game-data-selected={current?.name === entry.name ? 'true' : undefined}
                    className={cn(
                      'ml-5 flex min-h-8 w-[calc(100%-1.25rem)] items-center rounded px-2 text-left text-[11px] transition-colors',
                      current?.name === entry.name ? 'bg-amber-500/10' : 'hover:bg-[#1c1f24]'
                    )}
                  >
                    <span
                      className={cn('min-w-0 flex-1 truncate', rarityColor(entry.rarity))}
                      style={entry.rarity?.toLowerCase() === 'story item' ? { color: '#fb923c' } : undefined}
                    >
                      {entry.name}
                      {titleTranslation && <><span className="text-neutral-500"> · </span><span className="text-[var(--poly-accent)]">{titleTranslation}</span></>}
                    </span>
                    <ReferenceStatusRings stats={statusByEntry.get(referenceEntryKey(entry)) ?? emptyReferenceStatusCounts()} />
                  </button>
                )
              }
              return (
                <div key={key}>
                  <button
                    type="button"
                    aria-expanded={typeOpen}
                    onClick={() => toggleType(key)}
                    className="flex w-full items-center gap-1.5 rounded px-3 py-1.5 text-left text-[11px] text-neutral-400 hover:bg-[#14181d] hover:text-neutral-200"
                  >
                    {typeOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                    <span className="flex-1">{type}</span>
                    <span className="text-[9px] text-neutral-600">{typeCount}</span>
                  </button>
                  {typeOpen && typeGroup.subtypes.size === 0 && typeGroup.items.map((entry) => renderEntry(entry, `${key}/${entry.name}`))}
                  {typeOpen && [...typeGroup.subtypes].map(([subtype, items]) => {
                    const subtypeKey = `${key}/${subtype}`
                    const subtypeOpen = searching || expandedTypes.has(subtypeKey)
                    return (
                      <div key={subtypeKey}>
                        <button
                          type="button"
                          aria-expanded={subtypeOpen}
                          onClick={() => toggleType(subtypeKey)}
                          className="ml-3 flex w-[calc(100%-0.75rem)] items-center gap-1.5 rounded px-3 py-1.5 text-left text-[11px] text-neutral-400 hover:bg-[#14181d] hover:text-neutral-200"
                        >
                          {subtypeOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                          <span className="flex-1">{subtype}</span>
                          <span className="text-[9px] text-neutral-600">{items.length}</span>
                        </button>
                        {subtypeOpen && items.map((entry) => renderEntry(entry, `${subtypeKey}/${entry.name}`))}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </section>
        )
      })}
      {entries.length === 0 && <p className="px-2 py-4 text-xs text-neutral-600">No items found.</p>}
    </div>
  )
}
function normalize(value: string): string {
  const cached = normalizedSources.get(value)
  if (cached !== undefined) return cached
  const normalized = normalizeSearchText(
    value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
  )
  if (normalizedSources.size >= 50000) normalizedSources.clear()
  normalizedSources.set(value, normalized)
  return normalized
}
const normalizedSources = new Map<string, string>()
const SOURCE_PREFIX_LENGTH = 32
function rowsForReferenceText(
  text: string,
  rowsBySource: Map<string, TranslationSessionEntry[]>,
  sourceKeysByPrefix: Map<string, string[]>
): TranslationSessionEntry[] {
  const key = normalize(text)
  const exact = rowsBySource.get(key)
  if (exact?.length || key.length < 32) return exact ?? []
  const candidates = sourceKeysByPrefix.get(key.slice(0, SOURCE_PREFIX_LENGTH)) ?? []
  // Wiki descriptions can be shorter than the matching localization string; keep its full text untouched.
  return candidates
    .filter((source) => source.startsWith(`${key} `))
    .flatMap((source) => rowsBySource.get(source) ?? [])
}
const catalogRowKeys = new WeakMap(getReferenceCatalog().map((entry, index) => [entry, `${entry.category}:${entry.name}:${index}`] as const))
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
      containerClassName="game-data-translation-input min-h-[44px] rounded border-[#2a2f37]"
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
  onWholeWordChange,
  showTranslatedTitles,
  onShowTranslatedTitlesChange
}: {
  query: string
  onSearch: (value: string) => void
  category: ReferenceCategory
  onCategoryChange: (value: ReferenceCategory) => void
  matchCase: boolean
  onMatchCaseChange: (value: boolean) => void
  wholeWord: boolean
  onWholeWordChange: (value: boolean) => void
  showTranslatedTitles: boolean
  onShowTranslatedTitlesChange: (value: boolean) => void
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
      leadingToggle={{
        label: 'Translation',
        active: showTranslatedTitles,
        onClick: () => onShowTranslatedTitlesChange(!showTranslatedTitles),
        icon: <Languages size={14} />
      }}
      scopeValue={category}
      onScopeChange={(value) => onCategoryChange(value as ReferenceCategory)}
      scopeOptions={CATEGORIES.map((item) => ({ value: item.value ?? 'all', label: item.label }))}
      className="mb-2 w-full"
    />
  )
}
function entryReviewStatus(entry: TranslationSessionEntry): ReviewStatus {
  return !entry.target.trim() ? 'untranslated' : (entry.reviewStatus ?? 'needs-review')
}
type ReferenceStatusKey = 'untranslated' | 'not-verified' | 'needs-review' | 'verified'
type ReferenceStatusCounts = Record<ReferenceStatusKey, number> & { total: number }
const REFERENCE_STATUS_ITEMS: Array<{ key: ReferenceStatusKey; label: string; color: string; track: string }> = [
  { key: 'untranslated', label: 'Untranslated', color: '#9ca3af', track: 'rgba(156,163,175,.2)' },
  { key: 'not-verified', label: 'Not verified', color: '#ef4444', track: 'rgba(239,68,68,.2)' },
  { key: 'needs-review', label: 'Needs Review', color: '#eab308', track: 'rgba(234,179,8,.2)' },
  { key: 'verified', label: 'Verified', color: '#10b981', track: 'rgba(16,185,129,.2)' }
]
function emptyReferenceStatusCounts(): ReferenceStatusCounts {
  return { untranslated: 0, 'not-verified': 0, 'needs-review': 0, verified: 0, total: 0 }
}
function referenceEntryKey(entry: ReferenceCatalogEntry): string {
  return `${entry.category}:${entry.name}`
}

function referenceTitleSource(entry: ReferenceCatalogEntry): string {
  // The game localization uses the origin character's display name without the
  // wiki's disambiguation suffix.
  if (entry.category === 'NPC' && normalize(entry.name) === normalize('The Dark Urge (Origin)')) {
    return 'The Dark Urge'
  }
  if (entry.category === 'NPC') {
    // Some wiki pages use a short heading while the localization uses the
    // character's full in-game title, which is repeated at the start of the
    // wiki description (for example, “Dextor” → “Sapper Dextor”).
    const subject = entry.description.match(/^(.+?)\s+is\b/i)?.[1]?.trim()
    if (subject && normalize(subject) !== normalize(entry.name) && normalize(subject).endsWith(normalize(entry.name))) {
      return subject
    }
  }
  return entry.name
}

function referenceTitleRows(
  entry: ReferenceCatalogEntry,
  rowsBySource: Map<string, TranslationSessionEntry[]>
): TranslationSessionEntry[] {
  const exactRows = rowsBySource.get(normalize(entry.name))
  if (exactRows?.length) return exactRows
  const fallbackSource = referenceTitleSource(entry)
  return fallbackSource === entry.name ? [] : rowsBySource.get(normalize(fallbackSource)) ?? []
}
function ReferenceStatusRings({ stats }: { stats: ReferenceStatusCounts }): React.JSX.Element {
  return (
    <span className="ml-1 inline-flex shrink-0 items-center gap-1.5">
      {REFERENCE_STATUS_ITEMS.map((status) => {
        const translated = status.key === 'untranslated'
        const count = translated ? stats.total - stats.untranslated : stats[status.key]
        const percent = stats.total ? Math.round((count / stats.total) * 100) : 0
        const label = translated ? 'Translated' : status.label
        return (
          <AppTooltip key={status.key} label={`${label} · ${percent}% · ${count} of ${stats.total}`}>
            <span
              aria-label={`${label}: ${count} of ${stats.total}`}
              role="img"
              className="relative h-3.5 w-3.5 rounded-full"
              style={{ background: translated
                ? `conic-gradient(var(--poly-accent) ${percent}%, color-mix(in srgb, var(--poly-accent) 20%, transparent) ${percent}%)`
                : `conic-gradient(${status.color} ${percent}%, ${status.track} ${percent}%)` }}
            >
              <span className="absolute inset-[2px] rounded-full bg-[#0c0d0f]" />
            </span>
          </AppTooltip>
        )
      })}
    </span>
  )
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
        className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-[100] w-max max-w-56 -translate-x-1/2 translate-y-[2px] whitespace-nowrap rounded-md border border-neutral-700 bg-[#131518] px-2 py-1.5 text-[10px] font-medium leading-tight text-neutral-200 opacity-0 shadow-2xl transition-all duration-150 group-hover/game-data-tooltip:translate-y-0 group-hover/game-data-tooltip:opacity-100 group-focus-visible/game-data-tooltip:translate-y-0 group-focus-visible/game-data-tooltip:opacity-100"
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
  const reveal = (uid: string) => {
    window.sessionStorage.setItem('polyhedron:reveal-uid', uid)
    window.location.hash = '#/translate'
  }
  const sourceCard = (source: string, entry?: TranslationSessionEntry) => (
    <div className="min-w-0">
      <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
        {label} · EN
        <button
          type="button"
          onClick={copy}
          title="Copy source"
          className="ml-1 rounded px-1 text-neutral-400 hover:bg-[#1c1f24]"
        >
          <Copy size={11} />
        </button>
        {showContentUid && entry && (
          <>
            <span className="text-neutral-600">|</span>
            <span className="font-mono text-[10px] font-normal normal-case tracking-normal text-neutral-400">
              {entry.uid}
            </span>
          </>
        )}
      </div>
      <div className="translation-source-text whitespace-pre-wrap rounded border border-[#1f2329] bg-[#0c0d0f] px-3 py-2 text-xs leading-5 text-neutral-200">
        {renderSource(source, { termGlossary, whitespaceHighlight: true })}
      </div>
    </div>
  )

  const translationCard = (entry: TranslationSessionEntry) => (
    <div className="min-w-0">
      <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
        Translation · {targetLang}
        <button
          type="button"
          onClick={() => paste(entry.rowId)}
          title="Paste translation"
          aria-label="Paste translation"
          className="ml-1 rounded px-1 text-neutral-400 hover:bg-[#1c1f24]"
        >
          <ClipboardPaste size={11} />
        </button>
      </div>
      <LocalTranslationInput
        value={entry.target}
        inputRef={(element) => inputRefFor(entry.rowId, element)}
        onSelectionChange={(selection) => onSelectionChange(entry.rowId, selection)}
        onCommit={(value) => update(entry.rowId, value)}
      />
      <div className="mt-1 flex min-h-6 flex-wrap items-center gap-1">
        <GameDataTooltipButton
          tooltip="Reveal in Translate"
          onClick={() => reveal(entry.uid)}
          className="inline-flex h-6 w-6 items-center justify-center rounded border border-[#1f2329] bg-[#131518] text-amber-300 transition-colors hover:border-amber-400/60 hover:text-amber-200"
        >
          <Eye size={11} />
        </GameDataTooltipButton>
        <span className="mx-1 h-4 border-l border-[#2a2f37]" aria-hidden="true" />
        <GameDataTooltipButton
          tooltip="Translate with Gemini"
          onClick={() => onGemini(entry)}
          className="inline-flex h-6 w-6 items-center justify-center rounded border border-[#1f2329] bg-[#131518] text-neutral-200 transition-colors hover:border-[#2a2f37] hover:text-white"
        >
          <Sparkles size={13} />
        </GameDataTooltipButton>
        <GameDataTooltipButton
          tooltip="Show similarity examples"
          onClick={() => onSimilarity(entry)}
          className="inline-flex h-6 w-6 items-center justify-center rounded border border-[#1f2329] bg-[#131518] text-neutral-500 transition-colors hover:border-[#2a2f37] hover:text-neutral-200"
        >
          <BookOpen size={13} />
        </GameDataTooltipButton>
        <GameDataTooltipButton
          tooltip="History of changes"
          onClick={() => onHistory(entry)}
          className="inline-flex h-6 w-6 items-center justify-center rounded border border-[#1f2329] bg-[#131518] text-neutral-500 transition-colors hover:border-[#2a2f37] hover:text-neutral-200"
        >
          <History size={11} />
        </GameDataTooltipButton>
        {extractLarianTags(entry.source).length > 0 && (
          <GameDataTooltipButton
            tooltip="Apply next source tag"
            onClick={() => onTag(entry)}
            className="inline-flex h-6 w-6 items-center justify-center rounded border border-[#1f2329] bg-[#131518] text-neutral-500 transition-colors hover:border-amber-400/60 hover:text-amber-400"
          >
            <Code2 size={13} />
          </GameDataTooltipButton>
        )}
        <GameDataTooltipButton
          tooltip="Needs review"
          onClick={() => toggleNeedsReview(entry.rowId)}
          className={cn(
            'inline-flex h-6 w-6 items-center justify-center rounded border transition-colors',
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
    </div>
  )

  return (
    <div className="mt-3 space-y-2">
      {entries.length === 0 ? (
        <div className="rounded border border-[#1f2329] bg-[#0c0d0f] p-2">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {sourceCard(sourceText)}
            <div className="min-w-0">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
                Translation · {targetLang}
              </div>
              <div className="flex min-h-10 items-center rounded border border-[#2a2f37] bg-[#0c0d0f] px-2 text-[11px] italic text-neutral-600">
                This text is not present in the loaded XML.
              </div>
            </div>
          </div>
        </div>
      ) : (
        entries.map((entry) => (
          <div key={entry.rowId} className="rounded border border-[#1f2329] bg-[#0c0d0f] p-2">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {sourceCard(entry.source, entry)}
              {translationCard(entry)}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
function GameDataList({
  stateKey,
  entries,
  allEntries,
  category,
  current,
  onSelect,
  rowsBySource,
  sourceKeysByPrefix,
  showTranslatedTitles,
  searching = false
}: {
  stateKey: string
  entries: ReferenceCatalogEntry[]
  allEntries: ReferenceCatalogEntry[]
  category: ReferenceCategory | undefined
  current: ReferenceCatalogEntry | null
  onSelect: (entry: ReferenceCatalogEntry) => void
  rowsBySource: Map<string, TranslationSessionEntry[]>
  sourceKeysByPrefix: Map<string, string[]>
  showTranslatedTitles: boolean
  searching?: boolean
}): React.JSX.Element {
  const parentRef = useRef<HTMLDivElement>(null)
  useScrollSelectedEntry(parentRef, current?.name)
  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    getItemKey: index => catalogRowKeys.get(entries[index]!)!,
    overscan: 8
  })
  const statusByEntry = useMemo(() => {
    const result = new Map<string, ReferenceStatusCounts>()
    for (const entry of allEntries) {
      const rows = [
        ...(entry.name.trim() ? referenceTitleRows(entry, rowsBySource) : []),
        ...(entry.description.trim() ? rowsForReferenceText(entry.description, rowsBySource, sourceKeysByPrefix) : [])
      ]
      const stats = emptyReferenceStatusCounts()
      for (const row of rows) {
        stats[entryReviewStatus(row)] += 1
        stats.total += 1
      }
      result.set(referenceEntryKey(entry), stats)
    }
    return result
  }, [allEntries, rowsBySource, sourceKeysByPrefix])
  const translatedKeys = useMemo(() => {
    const result = new Set<string>()
    for (const item of getReferenceCatalog()) {
      const titleRows = referenceTitleRows(item, rowsBySource)
      const descriptionRows = rowsForReferenceText(item.description, rowsBySource, sourceKeysByPrefix)
      if (
        titleRows.some((row) => row.target.trim()) &&
        descriptionRows.some((row) => row.target.trim())
      )
        result.add(`${item.category}:${item.name}`)
    }
    return result
  }, [rowsBySource, sourceKeysByPrefix])
  const verifiedKeys = useMemo(() => {
    const result = new Set<string>()
    for (const item of getReferenceCatalog()) {
      const titleRows = referenceTitleRows(item, rowsBySource)
      const descriptionRows = rowsForReferenceText(item.description, rowsBySource, sourceKeysByPrefix)
      const rows = [...titleRows, ...descriptionRows]
      if (
        rows.length > 0 &&
        rows.every((row) => row.target.trim() && row.reviewStatus === 'verified')
      ) {
        result.add(`${item.category}:${item.name}`)
      }
    }
    return result
  }, [rowsBySource, sourceKeysByPrefix])
  if (category === 'Item') {
    return <ItemTreeList
      stateKey={stateKey}
      entries={entries}
      current={current}
      onSelect={onSelect}
      searching={searching}
      statusByEntry={statusByEntry}
      rowsBySource={rowsBySource}
      showTranslatedTitles={showTranslatedTitles}
    />
  }
  if (category === 'NPC') {
    return <NpcTreeList stateKey={stateKey} entries={entries} current={current} onSelect={onSelect} statusByEntry={statusByEntry} searching={searching} rowsBySource={rowsBySource} showTranslatedTitles={showTranslatedTitles} />
  }
  if (category === 'Quest' || category === 'Book' || category === 'Location' || category === 'Character Creation') {
    return (
      <QuestTreeList
        stateKey={stateKey}
        entries={entries}
        allEntries={allEntries}
        current={current}
        onSelect={onSelect}
        statusByEntry={statusByEntry}
        rowsBySource={rowsBySource}
        showTranslatedTitles={showTranslatedTitles}
        collapseSectionsByDefault={category === 'Book'}
      />
    )
  }
  return (
    <div ref={parentRef} data-game-data-scroll-target="list" className="polyhedron-scroll min-h-0 flex-1 overflow-y-auto">
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => {
          const entry = entries[item.index]!
          const ItemIcon = iconFor(entry.category)
          const key = `${entry.category}:${entry.name}`
          const translated = translatedKeys.has(key)
          const verified = verifiedKeys.has(key)
          const titleRows = referenceTitleRows(entry, rowsBySource)
          const titleTranslation = showTranslatedTitles
            ? (titleRows.find((row) => row.target.trim() && row.reviewStatus === 'verified') ?? titleRows.find((row) => row.target.trim()))?.target.trim()
            : undefined
          return (
            <div
              key={item.key}
              className="absolute left-0 top-0 w-full pb-1"
              style={{ height: 56, transform: `translateY(${item.start}px)` }}
            >
              <button
                type="button"
                onClick={() => onSelect(entry)}
                data-game-data-selected={current?.name === entry.name ? 'true' : undefined}
                className={cn(
                  'game-data-list-row translation-special-filter-option flex h-[52px] w-full cursor-pointer items-start gap-2 rounded-md px-2.5 py-2 text-left transition-colors focus:outline-none focus-visible:outline-none',
                  current === entry
                    ? 'is-selected text-[var(--poly-accent)]'
                    : 'text-neutral-300'
                )}
              >
                <ItemIcon size={14} className="mt-0.5 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 truncate text-xs">
                    {entry.name}
                    {titleTranslation && <><span className="text-neutral-500"> · </span><span className="text-[var(--poly-accent)]">{titleTranslation}</span></>}
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
  const [category, setCategory] = useState<ReferenceCategory>(() => {
    const saved = readGameDataUiState().category
    return saved && CATEGORIES.some((item) => item.value === saved) ? saved : 'Quest'
  })
  const [query, setQuery] = useState(() => readGameDataUiState().query ?? '')
  const [matchCase, setMatchCase] = useState(() => readGameDataUiState().matchCase ?? false)
  const [wholeWord, setWholeWord] = useState(() => readGameDataUiState().wholeWord ?? false)
  const [selectedByCategory, setSelectedByCategory] = useState<Partial<Record<ReferenceCategory, string>>>(
    () => readGameDataUiState().selectedByCategory ?? {}
  )
  const [showTranslatedTitles, setShowTranslatedTitles] = useState(() => {
    try {
      return window.localStorage.getItem(TITLE_TRANSLATION_PREFERENCE) === 'true'
    } catch {
      return false
    }
  })
  const [selected, setSelected] = useState<ReferenceCatalogEntry | null>(() => {
    const saved = readGameDataUiState()
    const savedCategory = saved.category ?? 'Quest'
    return findGameDataEntry(savedCategory, saved.selectedByCategory?.[savedCategory])
  })
  const [showContentUid, setShowContentUid] = useState(() => readGameDataUiState().showContentUid ?? false)
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
      window.sessionStorage.setItem(GAME_DATA_STATE_KEY, JSON.stringify({
        category,
        query,
        matchCase,
        wholeWord,
        selectedByCategory,
        showContentUid
      } satisfies GameDataUiState))
    } catch {
      // Keep Game Data state for this visit if session storage is unavailable.
    }
  }, [category, matchCase, query, selectedByCategory, showContentUid, wholeWord])
  useEffect(() => {
    try {
      window.localStorage.setItem(TITLE_TRANSLATION_PREFERENCE, String(showTranslatedTitles))
    } catch {
      // Keep the preference for this session if storage is unavailable.
    }
  }, [showTranslatedTitles])
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
      setSelectedByCategory((previous) => ({ ...previous, Spell: spell.name }))
      setQuery('')
    }
  }, [searchParams, session.phase])
  const allEntries = useMemo(
    () =>
      getReferenceCatalog()
        .filter((entry) =>
          !category || (category === 'Item' ? (entry.itemGroups?.length ?? 0) > 0 : entry.category === category)
        )
        .filter(
        (entry) =>
          !entry.name.trim().startsWith('%%%') &&
          !entry.description.trim().startsWith('%%%') &&
          !/\|[^|\n]{1,120}\|/.test(entry.name) &&
          !/\|[^|\n]{1,120}\|/.test(entry.description)
        ),
    [category]
  )
  const sourceEntries = useSessionStructure(session.entries)
  const uidBySource = useRetainedMemo('game-data:uids', () => {
    if (!showContentUid) return new Map<string, string>()
    const map = new Map<string, string[]>()
    for (const row of sourceEntries) {
      const key = normalize(row.source)
      const uids = map.get(key)
      if (uids) uids.push(row.uid)
      else map.set(key, [row.uid])
    }
    return new Map([...map].map(([source, uids]) => [source, ` ${uids.join(' ')}`]))
  }, [sourceEntries, showContentUid])
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
  const sourceMembership = useRetainedMemo('game-data:membership', () => {
    const map = new Map<string, string[]>()
    for (const row of sourceEntries) {
      const key = normalize(row.source)
      const rows = map.get(key)
      if (rows) rows.push(row.rowId)
      else map.set(key, [row.rowId])
    }
    return map
  }, [sourceEntries])
  const sourceKeysByPrefix = useRetainedMemo('game-data:source-prefixes', () => {
    const prefixes = new Map<string, string[]>()
    for (const source of sourceMembership.keys()) {
      const prefix = source.slice(0, SOURCE_PREFIX_LENGTH)
      const matches = prefixes.get(prefix)
      if (matches) matches.push(source)
      else prefixes.set(prefix, [source])
    }
    return prefixes
  }, [sourceMembership])
  const rowsBySource = useRetainedMemo('game-data:rows', () => {
    const current = new Map(session.entries.map(entry => [entry.rowId, entry]))
    return new Map([...sourceMembership].map(([source, ids]) => [source, ids.map(id => current.get(id)!)]))
  }, [sourceMembership, session.entries])
  const requestedSpell = searchParams.get('spell')?.trim()
  const requestedEntry = requestedSpell
    ? (getReferenceCatalog('Spell').find(
        (entry) => normalize(entry.name) === normalize(requestedSpell)
      ) ?? null)
    : null
  const current =
    requestedEntry ??
    (selected && (!category || selected.category === category || (category === 'Item' && selected.itemGroups?.length))
      ? selected
      : (filtered[0] ?? null))
  const linkedTitle = current
    ? (rowsBySource.get(normalize(current.name))?.length
        ? rowsBySource.get(normalize(current.name))!
        : rowsBySource.get(normalize(referenceTitleSource(current))) ?? [])
    : []
  const linkedDescription = current
    ? rowsForReferenceText(current.description, rowsBySource, sourceKeysByPrefix)
    : []
  const Icon = iconFor(current?.category ?? category ?? 'Weapon')
  const wikiUrl = current
    ? `https://bg3.wiki${wikiPath(current.category, current.wikiTitle ?? current.name)}`
    : `https://bg3.wiki${wikiPath(category ?? 'Weapon')}`
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
  if (session.phase !== 'loaded') return (
    <div className="flex h-full items-center justify-center p-8 text-center">
      <div className="rounded-xl border border-[#1f2329] bg-[#131518] p-8">
        <Swords className="mx-auto mb-3" style={{ color: 'var(--poly-accent)' }} size={28} />
        <h1 className="mb-2 text-lg font-semibold text-neutral-100">Game Data</h1>
        <p className="text-sm text-neutral-500">Load a localization XML in Translate first.</p>
      </div>
    </div>
  )
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
        <header className="app-page-header flex shrink-0 flex-wrap items-center gap-3 border-b border-[#1f2329] bg-[#0f1114] px-6 py-5">
          <Icon size={20} className="text-amber-400" />
          <div>
            <h1 className="text-base font-semibold text-neutral-100">Game Data</h1>
              <p className="text-xs text-neutral-500">
                {filtered.length.toLocaleString()} entries · names and descriptions
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
        </header>
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(360px,0.78fr)_minmax(0,1.22fr)] lg:overflow-hidden">
          <aside className="flex min-h-[250px] max-h-[46vh] min-w-0 flex-col border-b border-[#1f2329] p-3 md:min-h-0 md:max-h-none md:border-b-0 md:border-r">
            <GameDataSearch
              query={query}
              onSearch={setQuery}
              category={category}
              onCategoryChange={(value) => {
                setCategory(value)
                const rememberedName = selectedByCategory[value]
                setSelected(findGameDataEntry(value, rememberedName))
              }}
              matchCase={matchCase}
              onMatchCaseChange={setMatchCase}
              wholeWord={wholeWord}
              onWholeWordChange={setWholeWord}
              showTranslatedTitles={showTranslatedTitles}
              onShowTranslatedTitlesChange={setShowTranslatedTitles}
            />
            <GameDataList
              stateKey={category}
              key={category ?? 'all'}
              category={category}
              entries={filtered}
              allEntries={allEntries}
              current={current}
              onSelect={(entry) => {
                setSelected(entry)
                setSelectedByCategory((previous) => ({ ...previous, [category]: entry.name }))
              }}
              rowsBySource={rowsBySource}
              sourceKeysByPrefix={sourceKeysByPrefix}
              searching={query.trim().length > 0}
              showTranslatedTitles={showTranslatedTitles}
            />
          </aside>
          <main className={cn(
            'grid min-h-[680px] min-w-0 grid-rows-[minmax(260px,auto)_minmax(320px,1fr)] p-3 sm:min-h-[720px] sm:p-4 md:min-h-0 md:grid-rows-[minmax(300px,0.5fr)_minmax(0,0.5fr)]'
          )}>
            <section className={cn(
              'mb-3 overflow-y-auto rounded-lg border border-[#1f2329] bg-[#131518] p-4'
            )}>
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
                    label={current.category === 'NPC' ? 'Source' : 'Title EN'}
                    source={current.name}
                    entries={linkedTitle}
                    targetLang={session.targetLang.toUpperCase()}
                    update={update}
                    copy={copy(linkedTitle[0]?.source ?? current.name)}
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
                  {((current.category !== 'NPC' && current.category !== 'Location' && current.category !== 'Character Creation') || linkedDescription.length > 0) && (
                    <TranslationField
                      label={current.category === 'NPC' ? 'Source' : 'Description EN'}
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
                  )}
                </>
              ) : (
                <p className="text-sm text-neutral-500">Select an entry from the list.</p>
              )}
            </section>
            <div className="min-h-0 overflow-hidden rounded-lg border border-[#1f2329] bg-[#0c0d0f]">
              <StyledWebview
                key={wikiUrl}
                title={current ? `BG3 Wiki: ${current.name}` : 'BG3 Wiki reference'}
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
