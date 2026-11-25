import { useVirtualizer } from '@tanstack/react-virtual'
import {
  ArrowRight,
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
  CirclePlus,
  FolderPlus,
  ExternalLink,
  Eye,
  Flag,
  FlaskConical,
  Hash,
  History,
  Languages,
  MapPin,
  Package,
  Pencil,
  ScrollText,
  Shield,
  Sparkles,
  Swords,
  Trash2,
  UsersRound,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useSearchParams } from 'react-router-dom'
import { GameDataFolderModal } from '@/components/reference/GameDataFolderModal'
import characterCreationSourceIndex from '@/data/characterCreationSources.json'
import { GameDataSourceModal } from '@/components/reference/GameDataSourceModal'
import { ModalShell } from '@/components/shared/ModalShell'
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
  type ReferenceCategory,
  type ReferenceQuestObjective
} from '@/data/gameReference'
import {
  loadGameDataOverrides,
  mergeGameDataEntries,
  referenceEntryKey,
  saveGameDataOverrides
} from '@/data/gameDataOverrides'
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
  { label: 'Alchemy', value: 'Alchemy' },
  { label: 'NPCs', value: 'NPC' },
  { label: 'Char. Creation', value: 'Character Creation' }
]
const TITLE_TRANSLATION_PREFERENCE = 'polyhedron:game-data:show-translated-item-titles'
const CHARACTER_CREATION_UNCOMPLETED_ONLY_PREFERENCE = 'polyhedron:game-data:character-creation-uncompleted-only'
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

function usePersistedSet(key: string, initial: Set<string>): [Set<string>, React.Dispatch<React.SetStateAction<Set<string>>>, boolean] {
  const [hasSavedState] = useState(() => {
    try {
      return window.localStorage.getItem(key) !== null
    } catch {
      return false
    }
  })
  const [value, setValue] = useState<Set<string>>(() => {
    try {
      const saved = window.localStorage.getItem(key)
      return saved ? new Set(JSON.parse(saved) as string[]) : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify([...value]))
    } catch {
      // Preserve the state for this mounted route when local storage is unavailable.
    }
  }, [key, value])
  return [value, setValue, hasSavedState]
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
  if (category === 'Alchemy') return FlaskConical
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
    Alchemy: 'Alchemy',
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
  sourceKeysByPrefix,
  showTranslatedTitles,
  selectedObjective,
  onSelectObjective,
  collapseSectionsByDefault = false,
  onAddToSection
}: {
  stateKey: string
  entries: ReferenceCatalogEntry[]
  allEntries: ReferenceCatalogEntry[]
  current: ReferenceCatalogEntry | null
  onSelect: (entry: ReferenceCatalogEntry) => void
  statusByEntry: Map<string, ReferenceStatusCounts>
  rowsBySource: Map<string, TranslationSessionEntry[]>
  sourceKeysByPrefix: Map<string, string[]>
  showTranslatedTitles: boolean
  selectedObjective: { questName: string; objective: FlattenedQuestObjective } | null
  onSelectObjective: (entry: ReferenceCatalogEntry, objective: FlattenedQuestObjective) => void
  collapseSectionsByDefault?: boolean
  onAddToSection?: (section: string) => void
}): React.JSX.Element {
  const listRef = useRef<HTMLDivElement>(null)
  const hasAutoExpanded = useRef(false)
  const [expanded, setExpanded] = usePersistedSet(`polyhedron:game-data:${stateKey}:expanded`, new Set())
  const [expandedObjectives, setExpandedObjectives] = usePersistedSet(`polyhedron:game-data:${stateKey}:objectives-expanded`, new Set())
  const [expandedSections, setExpandedSections, expandedSectionsWereSaved] = usePersistedSet(`polyhedron:game-data:${stateKey}:expanded-sections`, new Set())
  const [collapsedSections, setCollapsedSections, collapsedSectionsWereSaved] = usePersistedSet(`polyhedron:game-data:${stateKey}:collapsed-sections`, new Set())
  const byName = useMemo(() => new Map(allEntries.map((entry) => [entry.name, entry])), [allEntries])
  const referenced = useMemo(
    () => new Set(entries.flatMap((entry) => entry.category === 'Location' ? entry.subLocations ?? [] : entry.subquests ?? [])),
    [entries]
  )
  const roots = entries.filter((entry) => !referenced.has(entry.name))
  useEffect(() => {
    if (!current || hasAutoExpanded.current) return
    hasAutoExpanded.current = true
    if (collapseSectionsByDefault ? expandedSectionsWereSaved : collapsedSectionsWereSaved) return
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
  }, [allEntries, byName, collapseSectionsByDefault, current?.name, collapsedSectionsWereSaved, expandedSectionsWereSaved, setCollapsedSections, setExpanded, setExpandedSections])
  useScrollSelectedEntry(listRef, current?.name, `${[...expanded].join('|')}:${[...expandedObjectives].join('|')}:${[...expandedSections].join('|')}:${[...collapsedSections].join('|')}`)
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
    const selected = current?.name === entry.name
    const objectiveNodes = entry.category === 'Quest' ? flattenQuestObjectiveNodes(entry.objectives ?? []) : []
    const hasObjectives = objectiveNodes.length > 0
    const open = expanded.has(entry.name) || expandedObjectives.has(entry.name)
    const titleRows = referenceTitleRows(entry, rowsBySource)
    const translatedTitle = showTranslatedTitles
      ? (titleRows.find((row) => row.target.trim() && row.reviewStatus === 'verified') ?? titleRows.find((row) => row.target.trim()))?.target.trim()
      : undefined
    const nextAncestors = new Set(ancestors).add(entry.name)
    return (
      <div key={`${entry.name}:${depth}`}>
        <div className="flex min-w-0 items-center gap-1" style={{ paddingLeft: depth * 12 }}>
          {hasChildren || hasObjectives ? (
            <button
              type="button"
              aria-label={`${open ? 'Collapse' : 'Expand'} ${entry.name}`}
              aria-expanded={open}
              onClick={() => {
                const shouldOpen = !open
                setExpanded((previous) => {
                  const next = new Set(previous)
                  shouldOpen ? next.add(entry.name) : next.delete(entry.name)
                  return next
                })
                setExpandedObjectives((previous) => {
                  const next = new Set(previous)
                  shouldOpen ? next.add(entry.name) : next.delete(entry.name)
                  return next
                })
              }}
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
            data-game-data-entry-key={referenceEntryKey(entry)}
            data-game-data-group-path={entry.section || 'Other quests'}
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
          <ReferenceMissingFields entry={entry} rowsBySource={rowsBySource} sourceKeysByPrefix={sourceKeysByPrefix} />
          <ReferenceStatusRings stats={statusByEntry.get(referenceEntryKey(entry)) ?? emptyReferenceStatusCounts()} />
        </div>
        {open && hasChildren && (
          <div className="mt-0.5 border-l border-[#24282f]" style={{ marginLeft: depth * 12 + 13 }}>
            {childEntries.map((child) => renderQuest(child, depth + 1, nextAncestors))}
          </div>
        )}
        {entry.category === 'Quest' && open && hasObjectives && (
          <div className="mt-0.5 space-y-0.5 border-l border-[#24282f] pl-1" style={{ marginLeft: depth * 12 + 28 }}>
              {objectiveNodes.map((objective) => {
                const objectiveTitleRows = rowsForQuestObjectiveText(entry, `${objective.key}:title`, objective.title, rowsBySource, sourceKeysByPrefix)
                const translatedObjectiveTitle = showTranslatedTitles
                  ? (objectiveTitleRows.find((row) => row.target.trim() && row.reviewStatus === 'verified') ?? objectiveTitleRows.find((row) => row.target.trim()))?.target.trim()
                  : undefined
                const objectiveRows = [
                  ...objectiveTitleRows,
                  ...objective.journalEntries.flatMap((text, index) => rowsForQuestObjectiveText(entry, `${objective.key}:description:${index}`, text, rowsBySource, sourceKeysByPrefix))
                ]
                const fieldStats = emptyReferenceStatusCounts()
                objectiveRows.forEach((row) => { fieldStats[entryReviewStatus(row)] += 1; fieldStats.total += 1 })
                const active = selectedObjective?.questName === entry.name && selectedObjective.objective.key === objective.key
                return <div key={objective.key} className="flex min-w-0 items-center gap-1" style={{ paddingLeft: Math.min(objective.depth, 5) * 10 }}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => onSelectObjective(entry, objective)}
                    className={cn('min-w-0 flex-1 truncate rounded px-2 py-1 text-left text-[10px] transition-colors', active ? 'bg-amber-500/10 text-amber-300' : 'text-neutral-400 hover:bg-[#1c1f24] hover:text-neutral-200')}
                  >
                    <span className="mr-1 text-[9px] text-neutral-600">•</span>{objective.title}{translatedObjectiveTitle && <><span className="text-neutral-500"> · </span><span className="text-[var(--poly-accent)]">{translatedObjectiveTitle}</span></>}
                  </button>
                  <ObjectiveMissingFields entry={entry} objective={objective} rowsBySource={rowsBySource} sourceKeysByPrefix={sourceKeysByPrefix} />
                  <ReferenceStatusRings stats={fieldStats} />
                </div>
              })}
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
            <div className="game-data-folder-row group sticky top-0 z-10 flex items-center rounded bg-[#0c0d0f] px-2 py-1.5">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => toggleSection(section)}
                className="game-data-folder-toggle flex min-w-0 flex-1 items-center gap-1.5 text-left text-[9px] font-semibold uppercase tracking-[0.1em] text-neutral-500 hover:text-neutral-300"
              >
                {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                <span className="min-w-0 flex-1 truncate">{section.replaceAll(' / ', ' · ')}</span>
              </button>
              {onAddToSection && <AppTooltip label="Add entry" focusable={false}>
                <button type="button" aria-label={`Add entry to ${section}`} onClick={() => onAddToSection(section)} className="game-data-folder-add inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#343a33] text-neutral-500 opacity-0 transition group-hover:opacity-100 focus:opacity-100">
                  <CirclePlus size={13} />
                </button>
              </AppTooltip>}
              <span className="mr-1 min-w-4 text-right text-[9px] font-normal normal-case tracking-normal text-neutral-600">{group.length}</span>
            </div>
          ) : (
            <div className="game-data-folder-row group sticky top-0 z-10 flex items-center rounded bg-[#0c0d0f] px-2 py-1.5">
              <h3 className="min-w-0 flex-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-neutral-600">
                {section.replaceAll(' / ', ' · ')}
              </h3>
              {onAddToSection && <AppTooltip label="Add entry" focusable={false}>
                <button type="button" aria-label={`Add entry to ${section}`} onClick={() => onAddToSection(section)} className="game-data-folder-add inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#343a33] text-neutral-500 opacity-0 transition group-hover:opacity-100 focus:opacity-100">
                  <CirclePlus size={13} />
                </button>
              </AppTooltip>}
              <span className="mr-1 min-w-4 text-right text-[9px] font-normal normal-case tracking-normal text-neutral-600">{group.length}</span>
            </div>
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

interface CharacterCreationFolderNode {
  children: Map<string, CharacterCreationFolderNode>
  entries: ReferenceCatalogEntry[]
}

const compareCharacterCreationLabel = (left: string, right: string): number =>
  left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })

function CharacterCreationTreeList({
  stateKey, entries, current, onSelect, statusByEntry, rowsBySource, sourceKeysByPrefix,
  showTranslatedTitles, customFolders, onAddToFolder
}: {
  stateKey: string
  entries: ReferenceCatalogEntry[]
  current: ReferenceCatalogEntry | null
  onSelect: (entry: ReferenceCatalogEntry) => void
  statusByEntry: Map<string, ReferenceStatusCounts>
  rowsBySource: Map<string, TranslationSessionEntry[]>
  sourceKeysByPrefix: Map<string, string[]>
  showTranslatedTitles: boolean
  customFolders: string[]
  onAddToFolder: (path: string, action: 'folder' | 'entry') => void
}): React.JSX.Element {
  const listRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = usePersistedSet(
    `polyhedron:game-data:${stateKey}:folders`,
    new Set(entries.map((entry) => (entry.section || 'Other').split('/')[0]!.trim()))
  )
  const tree = useMemo(() => {
    const root: CharacterCreationFolderNode = { children: new Map(), entries: [] }
    const ensure = (path: string) => {
      let node = root
      for (const part of path.split('/').map((item) => item.trim()).filter(Boolean)) {
        let child = node.children.get(part)
        if (!child) { child = { children: new Map(), entries: [] }; node.children.set(part, child) }
        node = child
      }
      return node
    }
    for (const folder of customFolders) ensure(folder)
    for (const entry of entries) ensure(entry.section || 'Other').entries.push(entry)
    return root
  }, [customFolders, entries])
  useScrollSelectedEntry(listRef, current?.name, [...expanded].join('|'))
  const count = (node: CharacterCreationFolderNode): number => node.entries.length + [...node.children.values()].reduce((total, child) => total + count(child), 0)
  const toggle = (path: string) => setExpanded((previous) => {
    const next = new Set(previous)
    if (next.has(path)) next.delete(path)
    else next.add(path)
    return next
  })
  const renderNode = (label: string, node: CharacterCreationFolderNode, parentPath: string, depth: number): React.JSX.Element => {
    const path = parentPath ? `${parentPath} / ${label}` : label
    const open = expanded.has(path)
    const folderCount = count(node)
    return <section key={path} className="mb-1">
      <div className="game-data-folder-row group sticky top-0 z-10 flex items-center rounded bg-[#0c0d0f] px-2 py-1.5" style={{ paddingLeft: 8 + depth * 12 }}>
        <button type="button" aria-expanded={open} onClick={() => toggle(path)} className="game-data-folder-toggle flex min-w-0 flex-1 items-center gap-1.5 text-left text-[9px] font-semibold uppercase tracking-[0.1em] text-neutral-500 hover:text-neutral-300">
          {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          <span className="min-w-0 flex-1 truncate">{label}</span>
        </button>
        <AppTooltip label="Add subfolder" focusable={false}><button type="button" aria-label={`Add subfolder to ${path}`} onClick={() => onAddToFolder(path, 'folder')} className="game-data-folder-add inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#343a33] text-neutral-500 opacity-0 transition group-hover:opacity-100 focus:opacity-100"><FolderPlus size={13} /></button></AppTooltip>
        <AppTooltip label="Add entry" focusable={false}><button type="button" aria-label={`Add entry to ${path}`} onClick={() => onAddToFolder(path, 'entry')} className="game-data-folder-add inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#343a33] text-neutral-500 opacity-0 transition group-hover:opacity-100 focus:opacity-100"><CirclePlus size={13} /></button></AppTooltip>
        <span className="ml-1 min-w-4 text-right text-[9px] font-normal normal-case tracking-normal text-neutral-600">{folderCount}</span>
      </div>
      {open && <div>
        {[...node.children].sort(([a], [b]) => compareCharacterCreationLabel(a, b)).map(([childLabel, child]) => renderNode(childLabel, child, path, depth + 1))}
        <div className="space-y-0.5">{[...node.entries].sort((a, b) => compareCharacterCreationLabel(a.name, b.name)).map((entry) => {
          const selected = current?.name === entry.name
          const titleRows = referenceTitleRows(entry, rowsBySource)
          const translatedTitle = showTranslatedTitles
            ? (titleRows.find((row) => row.target.trim() && row.reviewStatus === 'verified') ?? titleRows.find((row) => row.target.trim()))?.target.trim()
            : undefined
          return <div key={referenceEntryKey(entry)} className="flex min-w-0 items-center gap-1" style={{ paddingLeft: 9 + depth * 12 }}>
            <button type="button" onClick={() => onSelect(entry)} data-game-data-selected={selected ? 'true' : undefined} data-game-data-entry-key={referenceEntryKey(entry)} data-game-data-group-path={path} className={cn('min-w-0 flex-1 truncate rounded-md border-0 px-2 py-1.5 text-left text-[11px] transition-colors', selected ? 'bg-amber-500/10 text-amber-300' : 'text-neutral-300 hover:bg-[#1c1f24] hover:text-neutral-100')} title={translatedTitle ? `${entry.name} · ${translatedTitle}` : entry.name}>
              {entry.name}{translatedTitle && <><span className="text-neutral-500"> · </span><span className="text-[var(--poly-accent)]">{translatedTitle}</span></>}
            </button>
            <ReferenceMissingFields entry={entry} rowsBySource={rowsBySource} sourceKeysByPrefix={sourceKeysByPrefix} />
            <ReferenceStatusRings stats={statusByEntry.get(referenceEntryKey(entry)) ?? emptyReferenceStatusCounts()} />
          </div>
        })}</div>
      </div>}
    </section>
  }
  return <div ref={listRef} className="polyhedron-scroll min-h-0 flex-1 overflow-y-auto">{[...tree.children].sort(([a], [b]) => compareCharacterCreationLabel(a, b)).map(([label, node]) => renderNode(label, node, '', 0))}{entries.length === 0 && <p className="px-2 py-4 text-xs text-neutral-600">No character creation entries found in the loaded localization.</p>}</div>
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
  sourceKeysByPrefix,
  showTranslatedTitles,
  customFolders,
  onAddToFolder
}: {
  stateKey: string
  entries: ReferenceCatalogEntry[]
  current: ReferenceCatalogEntry | null
  onSelect: (entry: ReferenceCatalogEntry) => void
  statusByEntry: Map<string, ReferenceStatusCounts>
  searching: boolean
  rowsBySource: Map<string, TranslationSessionEntry[]>
  sourceKeysByPrefix: Map<string, string[]>
  showTranslatedTitles: boolean
  customFolders: string[]
  onAddToFolder: (path: string, action: 'folder' | 'entry') => void
}): React.JSX.Element {
  const listRef = useRef<HTMLDivElement>(null)
  const hasAutoExpanded = useRef(false)
  const [collapsed, setCollapsed, collapsedWasSaved] = usePersistedSet(`polyhedron:game-data:${stateKey}:collapsed`, new Set())
  const [expanded, setExpanded, expandedWasSaved] = usePersistedSet(`polyhedron:game-data:${stateKey}:expanded`, new Set())
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
    for (const folderPath of customFolders) {
      const path = folderPath.split(' / ').filter(Boolean)
      let siblings = roots
      for (const part of path) {
        let node = siblings.get(part)
        if (!node) { node = { entries: [], children: new Map() }; siblings.set(part, node) }
        siblings = node.children
      }
    }
    return roots
  }, [customFolders, entries])
  useEffect(() => {
    if (hasAutoExpanded.current) return
    const groupPaths = current?.npcGroups ?? []
    if (!groupPaths.length) return
    hasAutoExpanded.current = true
    if (collapsedWasSaved || expandedWasSaved) return
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
  }, [collapsedWasSaved, current?.name, current?.npcGroups, expandedWasSaved, setCollapsed, setExpanded])
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
  const renderEntry = (entry: ReferenceCatalogEntry, key: string, depth: number, groupPath: string): React.JSX.Element => {
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
      data-game-data-entry-key={referenceEntryKey(entry)}
      data-game-data-group-path={groupPath.replaceAll('/', ' / ')}
      className={cn(
        'flex min-h-8 w-full items-center rounded-md text-left text-[11px] transition-colors',
        depth === 0 ? 'px-2' : 'px-2',
        current?.name === entry.name ? 'bg-amber-500/10 text-amber-300' : 'text-neutral-300 hover:bg-[#1c1f24]'
      )}
      style={{ paddingLeft: `${12 + depth * 12}px`, paddingRight: 8 }}
    >
      <span className="min-w-0 flex-1 truncate">{entry.name}{translatedTitle && <><span className="text-neutral-500"> · </span><span className="text-[var(--poly-accent)]">{translatedTitle}</span></>}</span>
      <ReferenceMissingFields entry={entry} rowsBySource={rowsBySource} sourceKeysByPrefix={sourceKeysByPrefix} />
      <ReferenceStatusRings stats={statusByEntry.get(referenceEntryKey(entry)) ?? emptyReferenceStatusCounts()} />
    </button>
  }
  const renderGroup = (label: string, node: NpcGroupNode, path: string, depth: number): React.JSX.Element => {
    const open = searching || (depth === 0 ? !collapsed.has(path) : expanded.has(path))
    const addSubfolder = node.children.size > 0 && node.entries.length === 0
    const headerClass = depth === 0
      ? 'sticky top-0 z-10 bg-[#0c0d0f] px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500'
      : 'px-3 py-1.5 text-[11px] text-neutral-400'
    return (
      <div key={path}>
        <div className={cn('game-data-folder-row group flex w-full items-center gap-1.5 rounded', headerClass)}>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => toggle(path, depth)}
          className="game-data-folder-toggle flex min-w-0 flex-1 items-center gap-1.5 text-left hover:text-neutral-200"
        >
          {open ? <ChevronDown size={depth === 0 ? 12 : 11} /> : <ChevronRight size={depth === 0 ? 12 : 11} />}
          <span className="flex-1">{label}</span>
        </button>
        <AppTooltip
          label={addSubfolder ? 'Add subfolder' : 'Add entry'}
          focusable={false}
        >
          <button
            type="button"
            aria-label={`${addSubfolder ? 'Add subfolder to' : 'Add entry to'} ${label}`}
            onClick={() => onAddToFolder(path, addSubfolder ? 'folder' : 'entry')}
            className="game-data-folder-add inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#343a33] text-neutral-500 opacity-0 transition group-hover:opacity-100 focus:opacity-100"
          >
            {addSubfolder
              ? <FolderPlus size={14} className="block shrink-0" />
              : <CirclePlus size={14} className="block shrink-0" />}
          </button>
        </AppTooltip>
        <span className="mr-1 min-w-4 text-right text-[9px] font-normal normal-case tracking-normal text-neutral-600">{countEntries(node)}</span>
        </div>
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
              .map((entry) => renderEntry(entry, `${path}/${entry.name}`, depth + 1, path))}
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

interface ItemFolderNode {
  entries: ReferenceCatalogEntry[]
  children: Map<string, ItemFolderNode>
}

function AlchemyTreeList({
  stateKey, entries, current, onSelect, statusByEntry, rowsBySource, sourceKeysByPrefix,
  showTranslatedTitles, searching, categoryLabelSources
}: {
  stateKey: string
  entries: ReferenceCatalogEntry[]
  current: ReferenceCatalogEntry | null
  onSelect: (entry: ReferenceCatalogEntry) => void
  statusByEntry: Map<string, ReferenceStatusCounts>
  rowsBySource: Map<string, TranslationSessionEntry[]>
  sourceKeysByPrefix: Map<string, string[]>
  showTranslatedTitles: boolean
  searching: boolean
  categoryLabelSources: Record<string, string>
}): React.JSX.Element {
  const listRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = usePersistedSet(`polyhedron:game-data:${stateKey}:expanded`, new Set(['Ingredients', 'Potions', 'Elixirs', 'Grenades', 'Coatings']))
  const groups = useMemo(() => {
    const result = new Map<string, Map<string, ReferenceCatalogEntry[]>>()
    for (const entry of entries) {
      const [parent = 'Other', child = ''] = (entry.alchemyGroup ?? 'Other').split(' / ', 2)
      if (!result.has(parent)) result.set(parent, new Map())
      const children = result.get(parent)!
      if (child) {
        if (!children.has(child)) children.set(child, [])
        children.get(child)!.push(entry)
      } else {
        if (!children.has('')) children.set('', [])
        children.get('')!.push(entry)
      }
    }
    return result
  }, [entries])
  useScrollSelectedEntry(listRef, current?.name, [...expanded].join('|'))
  const toggle = (key: string) => setExpanded((previous) => {
    const next = new Set(previous)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })
  const order = ['Ingredients', 'Extracts', 'Potions', 'Elixirs', 'Grenades', 'Coatings']
  const displayChildLabel = (label: string) => label === 'Sublimates' ? 'Sublimate' : label === 'Vitriols' ? 'Vitriol' : label
  const categoryLabelEntry = (name: string): ReferenceCatalogEntry => ({
    name,
    description: '',
    category: 'Alchemy',
    id: `ALCHEMY_CATEGORY_${name}`,
    alchemyGroup: `Category labels / ${name}`,
    alchemyCategoryLabel: true,
    ...(categoryLabelSources[referenceEntryKey({ name, category: 'Alchemy' })]
      ? { sourceName: categoryLabelSources[referenceEntryKey({ name, category: 'Alchemy' })] }
      : {})
  })
  const renderCategoryLabel = (name: string, className: string) => {
    const labelEntry = categoryLabelEntry(name)
    const titleRows = referenceTitleRows(labelEntry, rowsBySource)
    const translation = showTranslatedTitles
      ? (titleRows.find((row) => row.target.trim() && row.reviewStatus === 'verified') ?? titleRows.find((row) => row.target.trim()))?.target.trim()
      : undefined
    return <>
      <span className={cn('min-w-0 truncate', className)}>{name}</span>
      {translation && <><span className="shrink-0 text-neutral-600"> · </span><span className="min-w-0 truncate font-normal normal-case tracking-normal text-[var(--poly-accent)]">{translation}</span></>}
    </>
  }
  const renderCategoryEditButton = (name: string) => <AppTooltip label={`Translate ${name}`} focusable={false}>
    <button type="button" aria-label={`Translate ${name}`} onClick={() => onSelect(categoryLabelEntry(name))} className="game-data-folder-add mr-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-neutral-500 opacity-0 transition hover:bg-[#1c1f24] hover:text-[var(--poly-accent)] group-hover:opacity-100 focus:opacity-100">
      <ArrowRight size={12} className="block shrink-0" />
    </button>
  </AppTooltip>
  const entryIcon = (entry?: ReferenceCatalogEntry, className = 'h-4 w-4') => entry?.icon
    ? <img src={entry.icon} alt="" loading="lazy" className={cn('shrink-0 object-contain', className)} />
    : <FlaskConical aria-hidden="true" className={cn('shrink-0 text-amber-300/70', className)} />
  return <div ref={listRef} data-game-data-scroll-target="list" className="polyhedron-scroll min-h-0 flex-1 overflow-y-auto">
    {[...groups].sort(([a], [b]) => {
      const ai = order.indexOf(a); const bi = order.indexOf(b)
      return (ai < 0 ? order.length : ai) - (bi < 0 ? order.length : bi) || a.localeCompare(b)
    }).map(([parent, children]) => {
      const parentCount = [...children.values()].reduce((sum, rows) => sum + rows.length, 0)
      const hasNested = [...children.keys()].some(Boolean)
      const parentOpen = searching || expanded.has(parent)
      const parentIconEntry = [...children.values()].flat().sort((a, b) => a.name.localeCompare(b.name))[0]
      const renderEntry = (entry: ReferenceCatalogEntry, depth = 0) => {
        const selected = current?.name === entry.name
        const titleRows = referenceTitleRows(entry, rowsBySource)
        const translation = showTranslatedTitles
          ? (titleRows.find((row) => row.target.trim() && row.reviewStatus === 'verified') ?? titleRows.find((row) => row.target.trim()))?.target.trim()
          : undefined
        return <div key={referenceEntryKey(entry)} className="flex min-w-0 items-center gap-1" style={{ paddingLeft: depth * 10 }}>
          <button type="button" onClick={() => onSelect(entry)} data-game-data-selected={selected ? 'true' : undefined} data-game-data-entry-key={referenceEntryKey(entry)} data-game-data-group-path={entry.alchemyGroup ?? parent} className={cn('min-w-0 flex-1 truncate rounded-md border-0 px-2 py-1.5 text-left text-[11px] transition-colors', selected ? 'bg-amber-500/10 text-amber-300' : 'text-neutral-300 hover:bg-[#1c1f24] hover:text-neutral-100')}>
            <span className="inline-flex min-w-0 items-center gap-1.5">{entryIcon(entry, 'h-4 w-4')}<span className="truncate">{entry.name}</span>{translation && <><span className="shrink-0 text-neutral-500"> · </span><span className="truncate text-[var(--poly-accent)]">{translation}</span></>}</span>
          </button>
          <ReferenceMissingFields entry={entry} rowsBySource={rowsBySource} sourceKeysByPrefix={sourceKeysByPrefix} />
          <ReferenceStatusRings stats={statusByEntry.get(referenceEntryKey(entry)) ?? emptyReferenceStatusCounts()} />
        </div>
      }
      return <section key={parent} className="mb-2">
        <div className="game-data-folder-row group sticky top-0 z-10 flex items-center rounded bg-[#0c0d0f] px-2 py-1.5">
          <button type="button" aria-expanded={parentOpen} onClick={() => toggle(parent)} className="game-data-folder-toggle flex min-w-0 flex-1 items-center gap-1.5 text-left text-[9px] font-semibold uppercase tracking-[0.1em] text-neutral-500 hover:text-neutral-300">
            {parentOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}{entryIcon(parentIconEntry, 'h-4 w-4')}
            {['Ingredients', 'Extracts', 'Potions', 'Elixirs', 'Grenades', 'Coatings'].includes(parent)
              ? <span className="inline-flex min-w-0 flex-1 items-center gap-1">{renderCategoryLabel(parent, '')}</span>
              : <span className="min-w-0 flex-1 truncate">{parent}</span>}
          </button>
          {['Ingredients', 'Extracts', 'Potions', 'Elixirs', 'Grenades', 'Coatings'].includes(parent) && <>
            <ReferenceMissingFields entry={categoryLabelEntry(parent)} rowsBySource={rowsBySource} sourceKeysByPrefix={sourceKeysByPrefix} />
            {renderCategoryEditButton(parent)}
          </>}
          <span className="mr-1 min-w-4 text-right text-[9px] text-neutral-600">{parentCount}</span>
        </div>
        {parentOpen && <div className="space-y-0.5">
          {[...children].sort(([a], [b]) => a.localeCompare(b)).map(([child, rows]) => child
            ? <div key={child}>
                {hasNested && <div className="group ml-4 flex h-7 w-[calc(100%-1rem)] items-center rounded text-[10px] text-neutral-400 hover:bg-[#1c1f24] hover:text-neutral-200">
                  <button type="button" aria-expanded={searching || expanded.has(`${parent}/${child}`)} onClick={() => toggle(`${parent}/${child}`)} className="game-data-folder-toggle flex h-full min-w-0 flex-1 items-center gap-1.5 rounded px-2 text-left">
                    {searching || expanded.has(`${parent}/${child}`) ? <ChevronDown size={11} /> : <ChevronRight size={11} />}{entryIcon(rows[0], 'h-4 w-4')}
                    {parent === 'Extracts'
                      ? <span className="inline-flex min-w-0 flex-1 items-center gap-1">{renderCategoryLabel(displayChildLabel(child), '')}</span>
                      : <span className="min-w-0 flex-1 truncate">{child}</span>}
                  </button>
                  {parent === 'Extracts' && <>
                    <ReferenceMissingFields entry={categoryLabelEntry(displayChildLabel(child))} rowsBySource={rowsBySource} sourceKeysByPrefix={sourceKeysByPrefix} />
                    {renderCategoryEditButton(displayChildLabel(child))}
                  </>}
                  <span className="mr-2 text-[9px] text-neutral-600">{rows.length}</span>
                </div>}
                {(searching || expanded.has(`${parent}/${child}`)) && <div className="space-y-0.5 border-l border-[#24282f] ml-6 pl-1">{rows.map((entry) => renderEntry(entry))}</div>}
              </div>
            : rows.map((entry) => renderEntry(entry)))}
        </div>}
      </section>
    })}
    {entries.length === 0 && <p className="px-2 py-4 text-xs text-neutral-600">No alchemy entries found.</p>}
  </div>
}

function ItemTreeList({
  stateKey,
  entries,
  current,
  onSelect,
  searching,
  statusByEntry,
  rowsBySource,
  sourceKeysByPrefix,
  showTranslatedTitles,
  onAddToFolder,
  customFolders,
  customGroupsByEntry
}: {
  stateKey: string
  entries: ReferenceCatalogEntry[]
  current: ReferenceCatalogEntry | null
  onSelect: (entry: ReferenceCatalogEntry) => void
  searching: boolean
  statusByEntry: Map<string, ReferenceStatusCounts>
  rowsBySource: Map<string, TranslationSessionEntry[]>
  sourceKeysByPrefix: Map<string, string[]>
  showTranslatedTitles: boolean
  onAddToFolder: (path: string, action: 'folder' | 'entry') => void
  customFolders: string[]
  customGroupsByEntry: Record<string, string[]>
}): React.JSX.Element {
  const listRef = useRef<HTMLDivElement>(null)
  const hasAutoExpanded = useRef(false)
  const hasCheckedCustomSelection = useRef(false)
  const [expandedSections, setExpandedSections, expandedSectionsWereSaved] = usePersistedSet(
    `polyhedron:game-data:${stateKey}:expanded-sections`,
    new Set(['Equipment types', 'Magic equipment', 'Consumables', 'Miscellaneous'])
  )
  const [expandedTypes, setExpandedTypes, expandedTypesWereSaved] = usePersistedSet(`polyhedron:game-data:${stateKey}:expanded-types`, new Set())
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
    // User-added entries can be associated directly with an existing item type
    // or subtype. Place them in that list instead of creating a duplicate folder.
    for (const entry of entries) {
      for (const groupPath of customGroupsByEntry[referenceEntryKey(entry)] ?? []) {
        const [section, type, subtype] = groupPath.split(' / ').map((part) => part.trim()).filter(Boolean)
        if (!section || !type) continue
        const typeGroup = result.get(section)?.get(type)
        if (!typeGroup) continue
        const items = subtype
          ? typeGroup.subtypes.get(subtype) ?? (() => {
              const created: ReferenceCatalogEntry[] = []
              typeGroup.subtypes.set(subtype, created)
              return created
            })()
          : typeGroup.items
        if (!items.some((item) => item.name === entry.name)) items.push(entry)
      }
    }
    return result
  }, [customGroupsByEntry, entries])
  const customGroups = useMemo(() => {
    const roots = new Map<string, Map<string, ItemFolderNode>>()
    const ensurePath = (section: string, folderPath: string) => {
      const parts = folderPath.split(' / ').map((part) => part.trim()).filter(Boolean)
      if (!parts.length) return
      let siblings = roots.get(section)
      if (!siblings) roots.set(section, (siblings = new Map()))
      let node: ItemFolderNode | undefined
      for (const part of parts) {
        node = siblings.get(part)
        if (!node) {
          node = { entries: [], children: new Map() }
          siblings.set(part, node)
        }
        siblings = node.children
      }
    }
    for (const folder of customFolders) {
      const [section, ...parts] = folder.split(' / ').map((part) => part.trim()).filter(Boolean)
      if (section && parts.length) ensurePath(section, parts.join(' / '))
    }
    for (const entry of entries) {
      for (const folder of customGroupsByEntry[referenceEntryKey(entry)] ?? []) {
        const [section, ...parts] = folder.split(' / ').map((part) => part.trim()).filter(Boolean)
        if (!section || !parts.length) continue
        if (parts.length <= 2 && groups.get(section)?.has(parts[0]!)) continue
        if (parts.length === 3 && groups.get(section)?.get(parts[0]!)?.subtypes.has(parts[1]!)) continue
        ensurePath(section, parts.join(' / '))
        let siblings = roots.get(section)
        let node: ItemFolderNode | undefined
        for (let index = 0; index < parts.length; index += 1) {
          node = siblings?.get(parts[index]!)
          if (!node) break
          if (index === parts.length - 1) node.entries.push(entry)
          siblings = node.children
        }
      }
    }
    return roots
  }, [customFolders, customGroupsByEntry, entries])
  useEffect(() => {
    if (hasAutoExpanded.current || !current?.itemGroups?.length) return
    hasAutoExpanded.current = true
    if (expandedSectionsWereSaved || expandedTypesWereSaved) return
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
  }, [current?.name, current?.itemGroups, expandedSectionsWereSaved, expandedTypesWereSaved, setExpandedSections, setExpandedTypes])
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
  const previousCustomFolders = useRef(customFolders)
  useEffect(() => {
    const added = customFolders.filter((folder) => !previousCustomFolders.current.includes(folder))
    previousCustomFolders.current = customFolders
    if (!added.length) return
    setExpandedSections((previous) => new Set([...previous, ...added.map((folder) => folder.split(' / ')[0]!).filter(Boolean)]))
    setExpandedTypes((previous) => {
      const next = new Set(previous)
      for (const folder of added) {
        const [section, ...parts] = folder.split(' / ').map((part) => part.trim()).filter(Boolean)
        if (!section) continue
        for (let index = 1; index <= parts.length; index += 1) next.add(`custom:${section}/${parts.slice(0, index).join('/')}`)
      }
      return next
    })
  }, [customFolders, setExpandedSections, setExpandedTypes])
  useEffect(() => {
    if (!current) return
    if (!hasCheckedCustomSelection.current) {
      hasCheckedCustomSelection.current = true
      if (expandedSectionsWereSaved || expandedTypesWereSaved) return
    }
    const groups = customGroupsByEntry[referenceEntryKey(current)] ?? []
    if (!groups.length) return
    setExpandedSections((previous) => new Set([...previous, ...groups.map((group) => group.split(' / ')[0]!).filter(Boolean)]))
    setExpandedTypes((previous) => {
      const next = new Set(previous)
      for (const group of groups) {
        const [section, ...parts] = group.split(' / ').map((part) => part.trim()).filter(Boolean)
        if (!section) continue
        for (let index = 1; index <= parts.length; index += 1) next.add(`custom:${section}/${parts.slice(0, index).join('/')}`)
      }
      return next
    })
  }, [current?.name, customGroupsByEntry, expandedSectionsWereSaved, expandedTypesWereSaved, setExpandedSections, setExpandedTypes])
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
  const renderItemEntry = (entry: ReferenceCatalogEntry, entryKey: string, groupPath?: string): React.JSX.Element => {
    const titleRows = referenceTitleRows(entry, rowsBySource)
    const titleTranslation = showTranslatedTitles
      ? (titleRows.find((row) => row.target.trim() && row.reviewStatus === 'verified') ?? titleRows.find((row) => row.target.trim()))?.target.trim()
      : undefined
    return <button
      key={entryKey}
      type="button"
      onClick={() => onSelect(entry)}
      title={entry.name}
      data-game-data-selected={current?.name === entry.name ? 'true' : undefined}
      data-game-data-entry-key={referenceEntryKey(entry)}
      data-game-data-group-path={groupPath}
      className={cn(
        'ml-5 flex min-h-8 w-[calc(100%-1.25rem)] items-center rounded px-2 text-left text-[11px] transition-colors',
        current?.name === entry.name ? 'bg-amber-500/10' : 'hover:bg-[#1c1f24]'
      )}
    >
      <span className={cn('min-w-0 flex-1 truncate', rarityColor(entry.rarity))} style={entry.rarity?.toLowerCase() === 'story item' ? { color: '#fb923c' } : undefined}>
        {entry.name}{titleTranslation && <><span className="text-neutral-500"> · </span><span className="text-[var(--poly-accent)]">{titleTranslation}</span></>}
      </span>
      <ReferenceMissingFields entry={entry} rowsBySource={rowsBySource} sourceKeysByPrefix={sourceKeysByPrefix} />
      <ReferenceStatusRings stats={statusByEntry.get(referenceEntryKey(entry)) ?? emptyReferenceStatusCounts()} />
    </button>
  }
  const countFolderEntries = (node: ItemFolderNode): number =>
    node.entries.length + [...node.children.values()].reduce((total, child) => total + countFolderEntries(child), 0)
  const renderCustomFolder = (label: string, node: ItemFolderNode, path: string, depth: number): React.JSX.Element => {
    const key = `custom:${path.replaceAll(' / ', '/')}`
    const open = searching || expandedTypes.has(key)
    const addSubfolder = node.children.size > 0 && node.entries.length === 0
    return <div key={key}>
      <div className="game-data-folder-row group flex items-center gap-1.5 rounded px-2 py-1.5" style={{ paddingLeft: `${12 + depth * 12}px` }}>
        <button type="button" aria-expanded={open} onClick={() => toggleType(key)} className="game-data-folder-toggle flex min-w-0 flex-1 items-center gap-1.5 text-left text-[11px] text-neutral-400 hover:text-neutral-200">
          {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          <span className="flex-1 truncate">{label}</span>
          <span className="text-[9px] text-neutral-600">{countFolderEntries(node)}</span>
        </button>
        <AppTooltip label={addSubfolder ? 'Add subfolder' : 'Add entry'} focusable={false}>
          <button type="button" aria-label={`${addSubfolder ? 'Add subfolder to' : 'Add entry to'} ${label}`} onClick={() => onAddToFolder(path, addSubfolder ? 'folder' : 'entry')} className="game-data-folder-add inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#343a33] text-neutral-500 opacity-0 transition group-hover:opacity-100 focus:opacity-100">
            {addSubfolder ? <FolderPlus size={13} /> : <CirclePlus size={13} />}
          </button>
        </AppTooltip>
      </div>
      {open && <div className="ml-2 border-l border-[#24282f]">
        {[...node.children].sort(([a], [b]) => a.localeCompare(b)).map(([childLabel, child]) => renderCustomFolder(childLabel, child, `${path} / ${childLabel}`, depth + 1))}
        {node.entries.map((entry) => renderItemEntry(entry, `${path}/${entry.name}`, path))}
      </div>}
    </div>
  }
  return (
    <div ref={listRef} className="polyhedron-scroll min-h-0 flex-1 overflow-y-auto">
      {[...groups].map(([section, types]) => {
        const sectionOpen = searching || expandedSections.has(section)
        const count = [...types.values()].reduce(
          (total, group) => total + group.items.length + [...group.subtypes.values()].reduce((sum, items) => sum + items.length, 0),
          0
        ) + [...(customGroups.get(section)?.values() ?? [])].reduce((total, node) => total + countFolderEntries(node), 0)
        return (
          <section key={section} className="mb-1">
            <div className="game-data-folder-row group sticky top-0 z-10 flex items-center gap-1.5 rounded bg-[#0c0d0f] px-2 py-2">
              <button
                type="button"
                aria-expanded={sectionOpen}
                onClick={() => toggleSection(section)}
                className="game-data-folder-toggle flex min-w-0 flex-1 items-center gap-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500 hover:text-neutral-300"
              >
                {sectionOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <span className="flex-1">{section}</span>
              </button>
              <AppTooltip label="Add subfolder" focusable={false}>
                <button type="button" aria-label={`Add subfolder to ${section}`} onClick={() => onAddToFolder(section, 'folder')} className="game-data-folder-add inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#343a33] text-neutral-500 opacity-0 transition group-hover:opacity-100 focus:opacity-100">
                  <FolderPlus size={13} />
                </button>
              </AppTooltip>
              <span className="mr-1 min-w-4 text-right text-[9px] font-normal normal-case tracking-normal text-neutral-600">{count}</span>
            </div>
            {sectionOpen && <>
            {[...types].map(([type, typeGroup]) => {
              const key = `${section}/${type}`
              const typeOpen = searching || expandedTypes.has(key)
              const typeCount = typeGroup.items.length + [...typeGroup.subtypes.values()].reduce((sum, items) => sum + items.length, 0)
              return (
                <div key={key}>
                  <div className="game-data-folder-row group flex items-center gap-1.5 rounded px-3 py-1.5">
                    <button
                      type="button"
                      aria-expanded={typeOpen}
                      onClick={() => toggleType(key)}
                      className="game-data-folder-toggle flex min-w-0 flex-1 items-center gap-1.5 text-left text-[11px] text-neutral-400 hover:text-neutral-200"
                    >
                      {typeOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                      <span className="flex-1">{type}</span>
                    </button>
                    <AppTooltip label="Add entry" focusable={false}>
                      <button type="button" aria-label={`Add entry to ${type}`} onClick={() => onAddToFolder(`${section} / ${type}`, 'entry')} className="game-data-folder-add inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#343a33] text-neutral-500 opacity-0 transition group-hover:opacity-100 focus:opacity-100">
                        <CirclePlus size={14} className="block shrink-0" />
                      </button>
                    </AppTooltip>
                    <span className="mr-1 min-w-4 text-right text-[9px] font-normal normal-case tracking-normal text-neutral-600">{typeCount}</span>
                  </div>
                  {typeOpen && typeGroup.subtypes.size === 0 && typeGroup.items.map((entry) => renderItemEntry(entry, `${key}/${entry.name}`, section))}
                  {typeOpen && [...typeGroup.subtypes].map(([subtype, items]) => {
                    const subtypeKey = `${key}/${subtype}`
                    const subtypeOpen = searching || expandedTypes.has(subtypeKey)
                    return (
                      <div key={subtypeKey}>
                        <div className="game-data-folder-row group ml-3 flex w-[calc(100%-0.75rem)] items-center gap-1.5 rounded px-3 py-1.5">
                          <button
                            type="button"
                            aria-expanded={subtypeOpen}
                            onClick={() => toggleType(subtypeKey)}
                            className="game-data-folder-toggle flex min-w-0 flex-1 items-center gap-1.5 text-left text-[11px] text-neutral-400 hover:text-neutral-200"
                          >
                            {subtypeOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                            <span className="flex-1">{subtype}</span>
                          </button>
                          <AppTooltip label="Add entry" focusable={false}>
                            <button type="button" aria-label={`Add entry to ${subtype}`} onClick={() => onAddToFolder(`${section} / ${type} / ${subtype}`, 'entry')} className="game-data-folder-add inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#343a33] text-neutral-500 opacity-0 transition group-hover:opacity-100 focus:opacity-100">
                              <CirclePlus size={14} className="block shrink-0" />
                            </button>
                          </AppTooltip>
                          <span className="mr-1 min-w-4 text-right text-[9px] font-normal normal-case tracking-normal text-neutral-600">{items.length}</span>
                        </div>
                        {subtypeOpen && items.map((entry) => renderItemEntry(entry, `${subtypeKey}/${entry.name}`, section))}
                      </div>
                    )
                  })}
                </div>
              )
            })}
            {[...(customGroups.get(section) ?? new Map<string, ItemFolderNode>())].sort(([a], [b]) => a.localeCompare(b)).map(([label, node]) => renderCustomFolder(label, node, `${section} / ${label}`, 0))}
            </>}
          </section>
        )
      })}
      {entries.length === 0 && <p className="px-2 py-4 text-xs text-neutral-600">No items found.</p>}
    </div>
  )
}
function normalize(value: string): string {
  const cacheKey = `${SOURCE_NORMALIZATION_VERSION}:${value}`
  const cached = normalizedSources.get(cacheKey)
  if (cached !== undefined) return cached
  const normalized = normalizeSearchText(
    // `<br>` separates paragraphs; inline formatting such as `<i>` should
    // disappear without adding spaces around the words it styles.
    value.replace(/<br\b[^>]*>/gi, ' ').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
  )
  if (normalizedSources.size >= 50000) normalizedSources.clear()
  normalizedSources.set(cacheKey, normalized)
  return normalized
}
const normalizedSources = new Map<string, string>()
const SOURCE_NORMALIZATION_VERSION = 3
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
function rowsForEntryDescription(
  entry: ReferenceCatalogEntry,
  rowsBySource: Map<string, TranslationSessionEntry[]>,
  sourceKeysByPrefix: Map<string, string[]>
): TranslationSessionEntry[] {
  if (entry.descriptionSourceName?.trim()) return rowsBySource.get(normalize(entry.descriptionSourceName)) ?? []
  return rowsForReferenceText(entry.description, rowsBySource, sourceKeysByPrefix)
}
function rowsForReferenceContent(
  entry: ReferenceCatalogEntry,
  rowsBySource: Map<string, TranslationSessionEntry[]>,
  sourceKeysByPrefix: Map<string, string[]>
): TranslationSessionEntry[] {
  const rows = linkedBookContentSourceTexts(entry, rowsBySource, sourceKeysByPrefix).flatMap((text) =>
    entry.contentSourceNames?.length
      ? rowsBySource.get(normalize(text)) ?? []
      : rowsForReferenceText(text, rowsBySource, sourceKeysByPrefix)
  )
  return [...new Map(rows.map((row) => [row.rowId, row])).values()]
}
type FlattenedQuestField = { text: string; label: 'Objective' | 'Journal entry'; depth: number; key: string }
type FlattenedQuestObjective = { title: string; journalEntries: string[]; depth: number; key: string }
function flattenQuestObjectiveNodes(objectives: ReferenceQuestObjective[]): FlattenedQuestObjective[] {
  const nodes: FlattenedQuestObjective[] = []
  const visit = (items: ReferenceQuestObjective[], path: string, depth: number) => {
    items.forEach((objective, index) => {
      const key = `${path}${index}`
      if (objective.title.trim() && !(objective.children.length > 0 && objective.journalEntries.length === 0)) {
        nodes.push({ title: objective.title, journalEntries: objective.journalEntries, depth, key })
      }
      visit(objective.children, `${key}.`, depth + 1)
    })
  }
  visit(objectives, '', 0)
  return nodes
}
function flattenQuestObjectives(objectives: ReferenceQuestObjective[]): FlattenedQuestField[] {
  const fields: FlattenedQuestField[] = []
  const visit = (nodes: ReferenceQuestObjective[], path: string, depth: number) => {
    nodes.forEach((objective, index) => {
      const key = `${path}${index}`
      if (objective.title.trim() && !(objective.children.length > 0 && objective.journalEntries.length === 0)) {
        fields.push({ text: objective.title, label: 'Objective', depth, key: `${key}:title` })
      }
      objective.journalEntries.forEach((text, journalIndex) => {
        if (text.trim()) fields.push({ text, label: 'Journal entry', depth: depth + 1, key: `${key}:description:${journalIndex}` })
      })
      visit(objective.children, `${key}.`, depth + 1)
    })
  }
  visit(objectives, '', 0)
  return fields
}
function rowsForQuestObjectives(
  entry: ReferenceCatalogEntry,
  rowsBySource: Map<string, TranslationSessionEntry[]>,
  sourceKeysByPrefix: Map<string, string[]>
): TranslationSessionEntry[] {
  const rows = flattenQuestObjectives(entry.objectives ?? [])
    .flatMap(({ text, key }) => rowsForQuestObjectiveText(entry, key, text, rowsBySource, sourceKeysByPrefix))
  return [...new Map(rows.map((row) => [row.rowId, row])).values()]
}
function rowsForQuestObjectiveText(
  entry: ReferenceCatalogEntry,
  fieldKey: string,
  fallbackText: string,
  rowsBySource: Map<string, TranslationSessionEntry[]>,
  sourceKeysByPrefix: Map<string, string[]>
): TranslationSessionEntry[] {
  const associatedSource = entry.questObjectiveSourceNames?.[fieldKey]
  return associatedSource?.trim()
    ? rowsBySource.get(normalize(associatedSource)) ?? []
    : rowsForReferenceText(fallbackText, rowsBySource, sourceKeysByPrefix)
}
function questObjectiveSourcesLinked(
  entry: ReferenceCatalogEntry,
  rowsBySource: Map<string, TranslationSessionEntry[]>,
  sourceKeysByPrefix: Map<string, string[]>
): boolean {
  return flattenQuestObjectives(entry.objectives ?? []).every(({ text, key }) =>
    rowsForQuestObjectiveText(entry, key, text, rowsBySource, sourceKeysByPrefix).length > 0
  )
}
function linkedBookContentSourceTexts(
  entry: ReferenceCatalogEntry,
  rowsBySource: Map<string, TranslationSessionEntry[]>,
  sourceKeysByPrefix: Map<string, string[]>
): string[] {
  const contentTexts = entry.contentSourceNames?.length ? entry.contentSourceNames : entry.content ?? []
  return contentTexts.filter((text) => entry.contentSourceNames?.length
    ? (rowsBySource.get(normalize(text))?.length ?? 0) > 0
    : rowsForReferenceText(text, rowsBySource, sourceKeysByPrefix).length > 0)
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
    <div className="mb-2 flex min-w-0 items-center gap-2">
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
        className="mb-0 min-w-0 flex-1"
      />
    </div>
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
function referenceTitleSource(entry: ReferenceCatalogEntry): string {
  if (entry.sourceName?.trim()) return entry.sourceName.trim()
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
  if (entry.sourceName?.trim()) {
    const associatedRows = rowsBySource.get(normalize(entry.sourceName))
    if (associatedRows?.length) return associatedRows
  }
  const exactRows = rowsBySource.get(normalize(entry.name))
  if (exactRows?.length) return exactRows
  const fallbackSource = referenceTitleSource(entry)
  return fallbackSource === entry.name ? [] : rowsBySource.get(normalize(fallbackSource)) ?? []
}
function ReferenceMissingFields({
  entry,
  rowsBySource,
  sourceKeysByPrefix
}: {
  entry: ReferenceCatalogEntry
  rowsBySource: Map<string, TranslationSessionEntry[]>
  sourceKeysByPrefix: Map<string, string[]>
}): React.JSX.Element | null {
  const missing: Array<{ marker: string; label: string }> = []
  if (!referenceTitleRows(entry, rowsBySource).length) missing.push({ marker: 'T', label: 'Title EN is missing from the loaded XML' })
  if (entry.category !== 'NPC' && entry.category !== 'Character Creation' && !entry.alchemyCategoryLabel && !rowsForEntryDescription(entry, rowsBySource, sourceKeysByPrefix).length) {
    missing.push({ marker: 'D', label: 'Description EN is missing from the loaded XML' })
  }
  if (entry.category === 'Book' && !rowsForReferenceContent(entry, rowsBySource, sourceKeysByPrefix).length) {
    missing.push({ marker: 'X', label: 'Book text EN is missing from the loaded XML' })
  }
  if (entry.category === 'Quest' && flattenQuestObjectives(entry.objectives ?? []).length > 0 && !questObjectiveSourcesLinked(entry, rowsBySource, sourceKeysByPrefix)) {
    missing.push({ marker: 'O', label: 'Quest objectives are missing from the loaded XML' })
  }
  if (!missing.length) return null
  return (
    <span className="ml-1 inline-flex shrink-0 items-center gap-1">
      {missing.map(({ marker, label }) => (
        <AppTooltip key={marker} label={label}>
          <span
            role="img"
            aria-label={label}
            className="inline-flex h-3.5 min-w-3.5 cursor-default select-none items-center justify-center rounded border border-rose-400/30 bg-rose-500/10 px-0.5 text-[8px] font-bold leading-none text-rose-300"
          >
            {marker}
          </span>
        </AppTooltip>
      ))}
    </span>
  )
}
function ObjectiveMissingFields({
  entry,
  objective,
  rowsBySource,
  sourceKeysByPrefix
}: {
  entry: ReferenceCatalogEntry
  objective: FlattenedQuestObjective
  rowsBySource: Map<string, TranslationSessionEntry[]>
  sourceKeysByPrefix: Map<string, string[]>
}): React.JSX.Element | null {
  const missing: Array<{ marker: 'T' | 'D'; label: string }> = []
  if (!rowsForQuestObjectiveText(entry, `${objective.key}:title`, objective.title, rowsBySource, sourceKeysByPrefix).length) {
    missing.push({ marker: 'T', label: 'Objective title EN is missing from the loaded XML' })
  }
  if (!objective.journalEntries.length || objective.journalEntries.some((text, index) =>
    !rowsForQuestObjectiveText(entry, `${objective.key}:description:${index}`, text, rowsBySource, sourceKeysByPrefix).length
  )) {
    missing.push({ marker: 'D', label: 'Objective description EN is missing from the loaded XML' })
  }
  if (!missing.length) return null
  return <span className="ml-1 inline-flex shrink-0 items-center gap-1">
    {missing.map(({ marker, label }) => <AppTooltip key={marker} label={label}>
      <span role="img" aria-label={label} className="inline-flex h-3.5 min-w-3.5 cursor-default select-none items-center justify-center rounded border border-rose-400/30 bg-rose-500/10 px-0.5 text-[8px] font-bold leading-none text-rose-300">{marker}</span>
    </AppTooltip>)}
  </span>
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
  termGlossary,
  sourceAssociationLabel,
  onSourceAssociation
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
  sourceAssociationLabel?: 'Add' | 'Edit'
  onSourceAssociation?: () => void
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
  const sourceAssociationControl = sourceAssociationLabel && onSourceAssociation ? (
    <button type="button" onClick={onSourceAssociation} className="ml-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] normal-case tracking-normal text-neutral-400 transition-colors hover:bg-[#1c1f24] hover:text-neutral-100">
      {sourceAssociationLabel === 'Edit' ? <Pencil size={10} /> : <BookText size={10} />}
      {sourceAssociationLabel}
    </button>
  ) : null

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
        {entries[0]?.rowId === entry.rowId && sourceAssociationControl}
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
              <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
                Translation · {targetLang}
                {sourceAssociationControl}
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
  selectedObjective,
  onSelectObjective,
  rowsBySource,
  sourceKeysByPrefix,
  showTranslatedTitles,
  customFolders,
  onAddToFolder,
  customCharacterCreationFolders,
  customItemFolders,
  customItemGroupsByEntry,
  alchemyCategorySources,
  onAddToSection,
  searching = false
}: {
  stateKey: string
  entries: ReferenceCatalogEntry[]
  allEntries: ReferenceCatalogEntry[]
  category: ReferenceCategory | undefined
  current: ReferenceCatalogEntry | null
  onSelect: (entry: ReferenceCatalogEntry) => void
  selectedObjective: { questName: string; objective: FlattenedQuestObjective } | null
  onSelectObjective: (entry: ReferenceCatalogEntry, objective: FlattenedQuestObjective) => void
  rowsBySource: Map<string, TranslationSessionEntry[]>
  sourceKeysByPrefix: Map<string, string[]>
  showTranslatedTitles: boolean
  customFolders: string[]
  onAddToFolder: (path: string, action: 'folder' | 'entry') => void
  customCharacterCreationFolders: string[]
  customItemFolders: string[]
  customItemGroupsByEntry: Record<string, string[]>
  alchemyCategorySources: Record<string, string>
  onAddToSection: (section: string) => void
  searching?: boolean
}): React.JSX.Element {
  const parentRef = useRef<HTMLDivElement>(null)
  useScrollSelectedEntry(parentRef, current?.name)
  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    getItemKey: index => catalogRowKeys.get(entries[index]!) ?? referenceEntryKey(entries[index]!),
    overscan: 8
  })
  const statusByEntry = useMemo(() => {
    const result = new Map<string, ReferenceStatusCounts>()
    for (const entry of allEntries) {
      const rows = [
        ...(entry.name.trim() ? referenceTitleRows(entry, rowsBySource) : []),
        ...(entry.category !== 'Character Creation' && entry.description.trim() ? rowsForEntryDescription(entry, rowsBySource, sourceKeysByPrefix) : []),
        ...(entry.effect ?? []).flatMap((text) => rowsForReferenceText(text, rowsBySource, sourceKeysByPrefix)),
        ...rowsForReferenceContent(entry, rowsBySource, sourceKeysByPrefix),
        ...rowsForQuestObjectives(entry, rowsBySource, sourceKeysByPrefix)
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
    for (const item of allEntries) {
      const titleRows = referenceTitleRows(item, rowsBySource)
      const descriptionRows = item.category === 'Character Creation' ? [] : rowsForEntryDescription(item, rowsBySource, sourceKeysByPrefix)
      const effectRows = (item.effect ?? []).flatMap((text) => rowsForReferenceText(text, rowsBySource, sourceKeysByPrefix))
      const contentRows = rowsForReferenceContent(item, rowsBySource, sourceKeysByPrefix)
      const objectiveRows = rowsForQuestObjectives(item, rowsBySource, sourceKeysByPrefix)
      if (
        titleRows.some((row) => row.target.trim()) &&
        (item.category === 'Character Creation' || descriptionRows.some((row) => row.target.trim())) &&
        effectRows.every((row) => row.target.trim()) &&
        (!contentRows.length || contentRows.every((row) => row.target.trim())) &&
        (!item.objectives?.length || questObjectiveSourcesLinked(item, rowsBySource, sourceKeysByPrefix) && objectiveRows.length > 0 && objectiveRows.every((row) => row.target.trim()))
      )
        result.add(`${item.category}:${item.name}`)
    }
    return result
  }, [allEntries, rowsBySource, sourceKeysByPrefix])
  const verifiedKeys = useMemo(() => {
    const result = new Set<string>()
    for (const item of allEntries) {
      const titleRows = referenceTitleRows(item, rowsBySource)
      const descriptionRows = item.category === 'Character Creation' ? [] : rowsForEntryDescription(item, rowsBySource, sourceKeysByPrefix)
      const effectRows = (item.effect ?? []).flatMap((text) => rowsForReferenceText(text, rowsBySource, sourceKeysByPrefix))
      const contentRows = rowsForReferenceContent(item, rowsBySource, sourceKeysByPrefix)
      const objectiveRows = rowsForQuestObjectives(item, rowsBySource, sourceKeysByPrefix)
      const rows = [...titleRows, ...descriptionRows, ...effectRows, ...contentRows, ...objectiveRows]
      if (
        rows.length > 0 &&
        (!item.objectives?.length || questObjectiveSourcesLinked(item, rowsBySource, sourceKeysByPrefix)) &&
        rows.every((row) => row.target.trim() && row.reviewStatus === 'verified')
      ) {
        result.add(`${item.category}:${item.name}`)
      }
    }
    return result
  }, [allEntries, rowsBySource, sourceKeysByPrefix])
  if (category === 'Item') {
    return <ItemTreeList
      stateKey={stateKey}
      entries={entries}
      current={current}
      onSelect={onSelect}
      searching={searching}
      statusByEntry={statusByEntry}
      rowsBySource={rowsBySource}
      sourceKeysByPrefix={sourceKeysByPrefix}
      showTranslatedTitles={showTranslatedTitles}
      onAddToFolder={onAddToFolder}
      customFolders={customItemFolders}
      customGroupsByEntry={customItemGroupsByEntry}
    />
  }
  if (category === 'Alchemy') {
    return <AlchemyTreeList
      stateKey={stateKey}
      entries={entries}
      current={current}
      onSelect={onSelect}
      statusByEntry={statusByEntry}
      rowsBySource={rowsBySource}
      sourceKeysByPrefix={sourceKeysByPrefix}
      showTranslatedTitles={showTranslatedTitles}
      categoryLabelSources={alchemyCategorySources}
      searching={searching}
    />
  }
  if (category === 'NPC') {
    return <NpcTreeList stateKey={stateKey} entries={entries} current={current} onSelect={onSelect} statusByEntry={statusByEntry} searching={searching} rowsBySource={rowsBySource} sourceKeysByPrefix={sourceKeysByPrefix} showTranslatedTitles={showTranslatedTitles} customFolders={customFolders} onAddToFolder={onAddToFolder} />
  }
  if (category === 'Character Creation') {
    return <CharacterCreationTreeList stateKey={stateKey} entries={entries} current={current} onSelect={onSelect} statusByEntry={statusByEntry} rowsBySource={rowsBySource} sourceKeysByPrefix={sourceKeysByPrefix} showTranslatedTitles={showTranslatedTitles} customFolders={customCharacterCreationFolders} onAddToFolder={onAddToFolder} />
  }
  if (category === 'Quest' || category === 'Book' || category === 'Location') {
    return (
      <QuestTreeList
        stateKey={stateKey}
        entries={entries}
        allEntries={allEntries}
        current={current}
        onSelect={onSelect}
        selectedObjective={selectedObjective}
        onSelectObjective={onSelectObjective}
        statusByEntry={statusByEntry}
        rowsBySource={rowsBySource}
        sourceKeysByPrefix={sourceKeysByPrefix}
        showTranslatedTitles={showTranslatedTitles}
        collapseSectionsByDefault={category === 'Book'}
        onAddToSection={onAddToSection}
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
                data-game-data-entry-key={referenceEntryKey(entry)}
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
                <ReferenceMissingFields entry={entry} rowsBySource={rowsBySource} sourceKeysByPrefix={sourceKeysByPrefix} />
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
  const [userOverrides, setUserOverrides] = useState(loadGameDataOverrides)
  const sourceNameByUid = useMemo(
    () => new Map(session.entries.map((entry) => [normalize(entry.uid), entry.source] as const)),
    [session.entries]
  )
  const sourceRowByUid = useMemo(
    () => new Map(session.entries.map((entry) => [normalize(entry.uid), entry] as const)),
    [session.entries]
  )
  const [folderModal, setFolderModal] = useState<{ path: string; category: 'NPC' | 'Item' | 'Character Creation' } | null>(null)
  const [sourceModal, setSourceModal] = useState<{ mode: 'add' | 'edit'; path: string; entry?: ReferenceCatalogEntry; category: 'NPC' | 'Quest' | 'Location' | 'Book' | 'Item' | 'Alchemy' | 'Character Creation'; field: 'title' | 'description' | 'content' | 'questObjective'; contentIndex?: number; objectiveFieldKey?: string; objectiveSource?: string } | null>(null)
  const [pendingEntryDelete, setPendingEntryDelete] = useState<{ entry: ReferenceCatalogEntry; path: string } | null>(null)
  const [entryContextMenu, setEntryContextMenu] = useState<{
    x: number
    y: number
    entry: ReferenceCatalogEntry
    path: string
  } | null>(null)
  const catalogEntries = useMemo(() => {
    const existing = getReferenceCatalog()
    const knownNames = new Set(existing.filter((entry) => entry.category === 'Character Creation').map((entry) => normalize(entry.name)))
    const dynamicOptions: ReferenceCatalogEntry[] = []
    const seen = new Set<string>()
    for (const option of characterCreationSourceIndex.entries as Array<{ id: string; section: string }>) {
      const sourceRow = sourceRowByUid.get(normalize(option.id))
      const sourceName = sourceRow?.source.trim()
      if (!sourceRow || !sourceName) continue
      const key = normalize(sourceName)
      if (knownNames.has(key) || seen.has(key)) continue
      seen.add(key)
      dynamicOptions.push({ category: 'Character Creation', id: sourceRow.uid, sourceUid: sourceRow.uid, sourceName, name: sourceName, description: '', section: option.section })
    }
    return mergeGameDataEntries([...existing, ...dynamicOptions], userOverrides).map((entry) => {
    if (entry.sourceName?.trim()) return entry
    const sourceUid = entry.sourceUid ?? entry.id
    if (!sourceUid) return entry
    const sourceName = sourceNameByUid.get(normalize(sourceUid))
    return sourceName ? { ...entry, sourceUid, sourceName } : entry
  })
  }, [sourceNameByUid, sourceRowByUid, userOverrides])
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
  const [showCharacterCreationUncompletedOnly, setShowCharacterCreationUncompletedOnly] = useState(() => {
    try {
      return window.localStorage.getItem(CHARACTER_CREATION_UNCOMPLETED_ONLY_PREFERENCE) === 'true'
    } catch {
      return false
    }
  })
  const [selected, setSelected] = useState<ReferenceCatalogEntry | null>(() => {
    const saved = readGameDataUiState()
    const savedCategory = saved.category ?? 'Quest'
    const name = saved.selectedByCategory?.[savedCategory]
    return catalogEntries.find((entry) =>
      entry.name === name && (savedCategory === 'Item' ? (entry.itemGroups?.length ?? 0) > 0 : entry.category === savedCategory)
    ) ?? null
  })
  const [selectedQuestObjective, setSelectedQuestObjective] = useState<{ questName: string; objective: FlattenedQuestObjective } | null>(null)
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
      window.localStorage.setItem(CHARACTER_CREATION_UNCOMPLETED_ONLY_PREFERENCE, String(showCharacterCreationUncompletedOnly))
    } catch {
      // Keep the chosen order for this session if browser storage is unavailable.
    }
  }, [showCharacterCreationUncompletedOnly])
  useEffect(() => {
    try {
      window.localStorage.setItem(termGlossaryKey, JSON.stringify(termGlossary))
    } catch {
      // The glossary remains available for the current session if storage is unavailable.
    }
  }, [termGlossary, termGlossaryKey])
  useEffect(() => {
    saveGameDataOverrides(userOverrides)
  }, [userOverrides])
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
      catalogEntries
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
    [category, catalogEntries]
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
        searchText: `${entry.name} ${entry.description} ${entry.sourceName ?? ''} ${entry.descriptionSourceName ?? ''} ${(entry.effect ?? []).join(' ')} ${(entry.content ?? []).join(' ')} ${flattenQuestObjectives(entry.objectives ?? []).map(({ text }) => text).join(' ')} ${showContentUid ? `${uidBySource.get(normalize(entry.name)) ?? ''} ${uidBySource.get(normalize(entry.description)) ?? ''}` : ''}`
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
  }, [sourceEntries, SOURCE_NORMALIZATION_VERSION])
  const sourceKeysByPrefix = useRetainedMemo('game-data:source-prefixes', () => {
    const prefixes = new Map<string, string[]>()
    for (const source of sourceMembership.keys()) {
      const prefix = source.slice(0, SOURCE_PREFIX_LENGTH)
      const matches = prefixes.get(prefix)
      if (matches) matches.push(source)
      else prefixes.set(prefix, [source])
    }
    return prefixes
  }, [sourceMembership, SOURCE_NORMALIZATION_VERSION])
  const rowsBySource = useRetainedMemo('game-data:rows', () => {
    const current = new Map(session.entries.map(entry => [entry.rowId, entry]))
    return new Map([...sourceMembership].map(([source, ids]) => [source, ids.map(id => current.get(id)!)]))
  }, [sourceMembership, session.entries, SOURCE_NORMALIZATION_VERSION])
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
  const linkedTitleUnsorted = current
    ? (referenceTitleRows(current, rowsBySource))
    : []
  const linkedTitle = current?.category === 'Character Creation' && showCharacterCreationUncompletedOnly
    ? linkedTitleUnsorted.filter((row) => !row.target.trim())
    : linkedTitleUnsorted
  const uncompletedTitleCount = linkedTitleUnsorted.filter((row) => !row.target.trim()).length
  const linkedDescription = current
    ? rowsForEntryDescription(current, rowsBySource, sourceKeysByPrefix)
    : []
  const descriptionIsItem = current
    ? category === 'Item' || (current.itemGroups?.length ?? 0) > 0
    : false
  const isGameDataItem = current
    ? category === 'Item' || current.category === 'Item'
    : false
  const isAlchemyEntry = current?.category === 'Alchemy' && !current.alchemyCategoryLabel
  const linkedEffects = current
    ? (current.effect ?? []).map((text) => ({
        text,
        rows: rowsForReferenceText(text, rowsBySource, sourceKeysByPrefix)
      })).filter(({ rows }) => rows.length > 0)
    : []
  const linkedBookContent = current?.category === 'Book'
    ? linkedBookContentSourceTexts(current, rowsBySource, sourceKeysByPrefix).map((text) => ({
        text,
        rows: current.contentSourceNames?.length
          ? rowsBySource.get(normalize(text)) ?? []
          : rowsForReferenceText(text, rowsBySource, sourceKeysByPrefix)
      })).filter((item) => item.rows.length > 0)
    : []
  const activeQuestObjective = current?.category === 'Quest' && selectedQuestObjective?.questName === current.name
    ? selectedQuestObjective.objective
    : null
  const contextBookTextSources = entryContextMenu?.entry.category === 'Book'
    ? linkedBookContentSourceTexts(entryContextMenu.entry, rowsBySource, sourceKeysByPrefix)
    : []
  const contextBookTextIndex = entryContextMenu?.entry.category === 'Book'
    ? (contextBookTextSources.length > 0 ? 0 : -1)
    : -1
  const contextHasBookText = contextBookTextIndex >= 0
  const contextHasTitle = entryContextMenu
    ? referenceTitleRows(entryContextMenu.entry, rowsBySource).length > 0
    : false
  const contextHasDescription = entryContextMenu
    ? rowsForEntryDescription(entryContextMenu.entry, rowsBySource, sourceKeysByPrefix).length > 0
    : false
  const sourceModalInitialUid = sourceModal?.entry
    ? sourceModal.field === 'questObjective'
      ? sourceModal.objectiveFieldKey
        ? rowsForQuestObjectiveText(sourceModal.entry, sourceModal.objectiveFieldKey, sourceModal.objectiveSource ?? '', rowsBySource, sourceKeysByPrefix)[0]?.uid
        : undefined
      : sourceModal.field === 'content'
      ? (() => {
          if (sourceModal.contentIndex === undefined) return undefined
          const contentSources = linkedBookContentSourceTexts(sourceModal.entry!, rowsBySource, sourceKeysByPrefix)
          const text = contentSources[sourceModal.contentIndex]
          if (!text) return undefined
          return (sourceModal.entry?.contentSourceNames?.length
            ? rowsBySource.get(normalize(text)) ?? []
            : rowsForReferenceText(text, rowsBySource, sourceKeysByPrefix))[0]?.uid
        })()
      : (
        (sourceModal.field === 'description'
          ? session.entries.find((row) => normalize(row.source) === normalize(sourceModal.entry?.descriptionSourceName ?? sourceModal.entry?.description ?? ''))
          : session.entries.find((row) => row.uid === sourceModal.entry?.sourceUid)) ??
        (sourceModal.field === 'description'
          ? rowsForEntryDescription(sourceModal.entry, rowsBySource, sourceKeysByPrefix)[0]
          : referenceTitleRows(sourceModal.entry, rowsBySource)[0])
      )?.uid
    : undefined
  const Icon = iconFor(current?.category ?? category ?? 'Weapon')
  const wikiUrl = current
    ? (current.wikiUrl ?? `https://bg3.wiki${wikiPath(current.category, current.wikiTitle ?? current.name)}`)
    : `https://bg3.wiki${wikiPath(category ?? 'Weapon')}`
  const openFolderAction = (path: string, action: 'folder' | 'entry') => {
    const normalizedPath = path.split('/').map((part) => part.trim()).filter(Boolean).join(' / ')
    const folderCategory = category === 'Item' ? 'Item' : category === 'Character Creation' ? 'Character Creation' : 'NPC'
    if (action === 'folder') setFolderModal({ path: normalizedPath, category: folderCategory })
    else setSourceModal({ mode: 'add', path: normalizedPath, category: folderCategory, field: 'title' })
  }
  const openAddSectionEntry = (section: string) => setSourceModal({
    mode: 'add',
    path: section,
    category: category === 'Location' || category === 'Book' || category === 'Item' || category === 'Character Creation' ? category : 'Quest',
    field: 'title'
  })
  const saveFolder = (name: string) => {
    if (!folderModal) return
    const path = `${folderModal.path} / ${name}`
    const existingFolders = folderModal.category === 'NPC' ? userOverrides.npcFolders : folderModal.category === 'Item' ? userOverrides.itemFolders : userOverrides.characterCreationFolders
    if (existingFolders.some((existing) => normalize(existing) === normalize(path))) {
      toast.error('A subfolder with that name already exists here.')
      return
    }
    setUserOverrides((previous) => folderModal.category === 'NPC'
      ? { ...previous, npcFolders: [...previous.npcFolders, path] }
      : folderModal.category === 'Item'
        ? { ...previous, itemFolders: [...previous.itemFolders, path] }
        : { ...previous, characterCreationFolders: [...previous.characterCreationFolders, path] })
    setFolderModal(null)
  }
  const saveSourceAssociation = (uid: string) => {
    if (!sourceModal) return
    const sourceRow = session.entries.find((entry) => entry.uid === uid)
    if (!sourceRow) { toast.error('That Source ID is no longer present in the loaded XML.'); return }
    if (sourceModal.field === 'questObjective') {
      if (!sourceModal.entry || !sourceModal.objectiveFieldKey) {
        toast.error('Could not identify the selected quest objective field.')
        return
      }
      const key = referenceEntryKey(sourceModal.entry)
      const objectiveSources = {
        ...(sourceModal.entry.questObjectiveSourceNames ?? {}),
        [sourceModal.objectiveFieldKey]: sourceRow.source
      }
      setUserOverrides((previous) => {
        const entrySources = previous.questObjectiveSourceNamesByEntry[key] ?? {}
        return {
          ...previous,
          questObjectiveSourceNamesByEntry: {
            ...previous.questObjectiveSourceNamesByEntry,
            [key]: { ...entrySources, [sourceModal.objectiveFieldKey!]: sourceRow.source }
          }
        }
      })
      // `current` prefers the selected entry object, which can predate the updated catalog.
      // Refresh it too so the newly associated XML row is visible immediately.
      setSelected({ ...sourceModal.entry, questObjectiveSourceNames: objectiveSources })
      setSourceModal(null)
      return
    }
    const entry = sourceModal.mode === 'edit'
      ? sourceModal.entry
      : catalogEntries.find((candidate) => candidate.category === sourceModal.category && (
          (sourceModal.category !== 'Item' || (candidate.itemGroups?.length ?? 0) > 0) &&
          ((candidate.id && normalize(candidate.id) === normalize(uid)) ||
            normalize(candidate.name) === normalize(sourceRow.source) ||
            normalize(referenceTitleSource(candidate)) === normalize(sourceRow.source) ||
            (candidate.sourceName && normalize(candidate.sourceName) === normalize(sourceRow.source)))
        ))
    if (!entry) {
      toast.error(`No existing Wiki ${sourceModal.category} matches this Source ID or source text. No Game Data entry was created.`)
      return
    }
    const key = referenceEntryKey(entry)
    const currentContentSources = userOverrides.contentSourceNamesByEntry[key] ?? entry.contentSourceNames ?? linkedBookContentSourceTexts(entry, rowsBySource, sourceKeysByPrefix)
    const nextContentSources = sourceModal.field === 'content'
      ? sourceModal.contentIndex === undefined
        ? [...new Set([...currentContentSources, sourceRow.source])]
        : currentContentSources.map((text, index) => index === sourceModal.contentIndex ? sourceRow.source : text)
      : currentContentSources
    setUserOverrides((previous) => ({
      ...previous,
      ...(sourceModal.field === 'description'
        ? { descriptionSourceNameByEntry: { ...previous.descriptionSourceNameByEntry, [key]: sourceRow.source } }
        : sourceModal.field === 'content'
          ? { contentSourceNamesByEntry: { ...previous.contentSourceNamesByEntry, [key]: nextContentSources } }
        : {
            sourceUidByEntry: { ...previous.sourceUidByEntry, [key]: sourceRow.uid },
            sourceNameByEntry: { ...previous.sourceNameByEntry, [key]: sourceRow.source }
          }),
      ...(sourceModal.mode === 'add' && sourceModal.category === 'NPC' ? {
        npcGroupsByEntry: {
          ...previous.npcGroupsByEntry,
          [key]: [...new Set([...(previous.npcGroupsByEntry[key] ?? entry.npcGroups ?? []), sourceModal.path])]
        },
        hiddenNpcEntries: previous.hiddenNpcEntries.filter((hiddenKey) => hiddenKey !== key)
      } : {}),
      ...(sourceModal.mode === 'add' && sourceModal.category === 'Quest' ? {
        questSectionByEntry: { ...previous.questSectionByEntry, [key]: sourceModal.path },
        hiddenEntries: previous.hiddenEntries.filter((hiddenKey) => hiddenKey !== key)
      } : {}),
      ...(sourceModal.mode === 'add' && sourceModal.category === 'Location' ? {
        locationSectionByEntry: { ...previous.locationSectionByEntry, [key]: sourceModal.path },
        hiddenEntries: previous.hiddenEntries.filter((hiddenKey) => hiddenKey !== key)
      } : {}),
      ...(sourceModal.mode === 'add' && sourceModal.category === 'Book' ? {
        bookSectionByEntry: { ...previous.bookSectionByEntry, [key]: sourceModal.path },
        hiddenEntries: previous.hiddenEntries.filter((hiddenKey) => hiddenKey !== key)
      } : {}),
      ...(sourceModal.mode === 'add' && sourceModal.category === 'Item' ? {
        itemGroupsByEntry: { ...previous.itemGroupsByEntry, [key]: [...new Set([...(previous.itemGroupsByEntry[key] ?? []), sourceModal.path])] },
        hiddenEntries: previous.hiddenEntries.filter((hiddenKey) => hiddenKey !== key)
      } : {}),
      ...(sourceModal.mode === 'add' && sourceModal.category === 'Character Creation' ? {
        characterCreationSectionByEntry: { ...previous.characterCreationSectionByEntry, [key]: sourceModal.path },
        hiddenEntries: previous.hiddenEntries.filter((hiddenKey) => hiddenKey !== key)
      } : {})
    }))
    setCategory(sourceModal.category)
    const selectedEntry = {
      ...entry,
      ...(sourceModal.field === 'description'
        ? { descriptionSourceName: sourceRow.source }
        : sourceModal.field === 'content'
          ? { contentSourceNames: nextContentSources }
        : { sourceUid: sourceRow.uid, sourceName: sourceRow.source }),
      ...(sourceModal.mode === 'add' && sourceModal.category === 'NPC'
        ? { npcGroups: [...new Set([...(entry.npcGroups ?? []), sourceModal.path])] }
        : {}),
      ...(sourceModal.mode === 'add' && (sourceModal.category === 'Quest' || sourceModal.category === 'Location' || sourceModal.category === 'Book' || sourceModal.category === 'Character Creation') ? { section: sourceModal.path } : {})
    }
    setSelected(selectedEntry)
    setSelectedByCategory((previous) => ({ ...previous, [sourceModal.category]: entry.name }))
    setSourceModal(null)
  }
  const openEditEntry = (entry: ReferenceCatalogEntry, field: 'title' | 'description' | 'content' = 'title', contentIndex?: number) => {
    setEntryContextMenu(null)
    const sourceCategory = (category === 'Item' ? 'Item' : entry.category) as 'NPC' | 'Quest' | 'Location' | 'Book' | 'Item' | 'Alchemy' | 'Character Creation'
    setSourceModal({ mode: 'edit', path: entry.npcGroups?.[0] ?? entry.section ?? '', entry, category: sourceCategory, field, contentIndex })
  }
  const openQuestObjectiveAssociation = (entry: ReferenceCatalogEntry, fieldKey: string, source: string) => {
    setSourceModal({ mode: 'edit', path: '', entry, category: 'Quest', field: 'questObjective', objectiveFieldKey: fieldKey, objectiveSource: source })
  }
  const deleteGameDataEntry = () => {
    if (!pendingEntryDelete) return
    const { entry, path } = pendingEntryDelete
    const key = referenceEntryKey(entry)
    if (entry.category === 'Item' && userOverrides.itemGroupsByEntry[key]?.includes(path)) {
      setUserOverrides((previous) => ({
        ...previous,
        itemGroupsByEntry: {
          ...previous.itemGroupsByEntry,
          [key]: (previous.itemGroupsByEntry[key] ?? []).filter((groupPath) => normalize(groupPath) !== normalize(path))
        }
      }))
      if (selected && referenceEntryKey(selected) === key) setSelected(null)
      setEntryContextMenu(null)
      setPendingEntryDelete(null)
      return
    }
    if (entry.category !== 'NPC') {
      setUserOverrides((previous) => ({ ...previous, hiddenEntries: [...new Set([...previous.hiddenEntries, key])] }))
      if (selected && referenceEntryKey(selected) === key) setSelected(null)
      setEntryContextMenu(null)
      setPendingEntryDelete(null)
      return
    }
    const existingPaths = userOverrides.npcGroupsByEntry[key] ?? entry.npcGroups ?? []
    const remainingPaths = existingPaths.filter((candidate) => normalize(candidate) !== normalize(path))
    setUserOverrides((previous) => ({
      ...previous,
      npcGroupsByEntry: { ...previous.npcGroupsByEntry, [key]: remainingPaths },
      hiddenNpcEntries: remainingPaths.length ? previous.hiddenNpcEntries : [...new Set([...previous.hiddenNpcEntries, key])]
    }))
    if (selected && referenceEntryKey(selected) === key) setSelected(null)
    setEntryContextMenu(null)
    setPendingEntryDelete(null)
  }
  const handleGameDataContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    const row = (event.target as HTMLElement).closest<HTMLElement>('[data-game-data-entry-key]')
    const key = row?.dataset.gameDataEntryKey
    if (!key) {
      setEntryContextMenu(null)
      return
    }
    const entry = catalogEntries.find((candidate) => referenceEntryKey(candidate) === key)
    if (!entry) return
    const isItemEntry = (entry.itemGroups?.length ?? 0) > 0
    if (!isItemEntry && entry.category !== 'NPC' && entry.category !== 'Quest' && entry.category !== 'Location' && entry.category !== 'Book' && entry.category !== 'Item' && entry.category !== 'Alchemy' && entry.category !== 'Character Creation') return
    event.preventDefault()
    setSelected(entry)
    const listCategory = category === 'Item' ? 'Item' : entry.category
    setSelectedByCategory((previous) => ({ ...previous, [listCategory]: entry.name }))
    const path = (row?.dataset.gameDataGroupPath ?? entry.npcGroups?.[0] ?? entry.section ?? '').split('/').map((part) => part.trim()).filter(Boolean).join(' / ')
    setEntryContextMenu({ x: event.clientX, y: event.clientY, entry, path })
  }
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
  const renderQuestTextField = (source: string, label: string, fieldKey: string) => {
    const linkedRows = current?.category === 'Quest'
      ? rowsForQuestObjectiveText(current, fieldKey, source, rowsBySource, sourceKeysByPrefix)
      : rowsForReferenceText(source, rowsBySource, sourceKeysByPrefix)
    const displaySource = current?.questObjectiveSourceNames?.[fieldKey] ?? source
    return (
      <div key={`${current?.name}:${fieldKey}`} className="min-w-0">
        <TranslationField
        label={label}
        source={displaySource}
        entries={linkedRows}
        targetLang={session.targetLang.toUpperCase()}
        update={update}
        copy={copy(displaySource)}
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
        onSelectionChange={(rowId, selection) => tagSelections.current.set(rowId, selection)}
        toggleNeedsReview={session.toggleNeedsReview}
        setReviewStatus={session.setReviewStatus}
        termGlossary={termGlossary}
        sourceAssociationLabel={linkedRows.length > 0 ? 'Edit' : 'Add'}
        onSourceAssociation={() => current && openQuestObjectiveAssociation(current, fieldKey, source)}
      />
      </div>
    )
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
      <GameDataFolderModal
        open={folderModal !== null}
        parentPath={folderModal?.path ?? ''}
        onClose={() => setFolderModal(null)}
        onSubmit={saveFolder}
      />
      <GameDataSourceModal
        open={sourceModal !== null}
        title={sourceModal?.field === 'questObjective'
          ? 'Associate quest objective Source'
          : sourceModal?.mode === 'edit' ? sourceModal.field === 'content' ? 'Add book text' : `Edit ${sourceModal.field} Source association` : 'Add existing Game Data entry'}
        description={sourceModal?.mode === 'edit'
          ? sourceModal.field === 'questObjective'
            ? `Choose the correct localization string for “${sourceModal.objectiveSource ?? ''}”.`
            : sourceModal.field === 'content'
            ? `Choose a Source string to add as text for “${sourceModal.entry?.name ?? ''}”.`
            : `Choose the correct localization string for “${sourceModal.entry?.name ?? ''}”. Its Wiki name and link will stay unchanged.`
          : `Choose a Source string for ${sourceModal?.path ?? ''}. It will be added only when it matches an existing Wiki ${sourceModal?.category ?? 'NPC'}.`}
        sourceEntries={session.entries}
        initialUid={sourceModalInitialUid}
        onClose={() => setSourceModal(null)}
        onSubmit={saveSourceAssociation}
      />
      <ModalShell
        open={pendingEntryDelete !== null}
        title="Delete Game Data entry?"
        sizeClassName="max-w-md"
        icon={<CircleAlert size={18} />}
        onClose={() => setPendingEntryDelete(null)}
      >
        <p className="text-sm leading-6 text-neutral-300">
          Remove “{pendingEntryDelete?.entry.name ?? ''}” from {pendingEntryDelete?.entry.category === 'NPC'
            ? `“${pendingEntryDelete?.path ?? ''}”`
            : `${pendingEntryDelete?.entry.category === 'Quest' ? 'Quests' : pendingEntryDelete?.entry.category === 'Location' ? 'Locations' : pendingEntryDelete?.entry.category === 'Book' ? 'Books' : 'Items'}`}?
        </p>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={deleteGameDataEntry}
            className="accent-solid-control inline-flex items-center gap-1.5 rounded-md border border-[var(--poly-accent)] bg-[var(--poly-accent)] px-3 py-2 text-xs font-semibold"
          >
            <Trash2 size={13} aria-hidden="true" />
            Delete
          </button>
        </div>
      </ModalShell>
      <div
        className="flex h-full min-h-0 flex-col bg-[#0c0d0f] text-neutral-200"
        onContextMenu={handleGameDataContextMenu}
      >
        <header className="app-page-header flex shrink-0 flex-wrap items-center gap-3 border-b border-[#1f2329] bg-[#0f1114] px-6 py-5">
          <Icon size={20} className="text-amber-400" />
          <div>
            <h1 className="text-base font-semibold text-neutral-100">Game Data</h1>
              <p className="text-xs text-neutral-500">
                {filtered.length.toLocaleString()} entries · names, descriptions{category === 'Book' ? ' and book text' : ''}
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
                setSelectedQuestObjective(null)
                const rememberedName = selectedByCategory[value]
                setSelected(catalogEntries.find((entry) =>
                  entry.name === rememberedName && (value === 'Item' ? (entry.itemGroups?.length ?? 0) > 0 : entry.category === value)
                ) ?? null)
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
                setSelectedQuestObjective(null)
                setSelected(entry)
                setSelectedByCategory((previous) => ({ ...previous, [category]: entry.name }))
              }}
              selectedObjective={selectedQuestObjective}
              onSelectObjective={(entry, objective) => {
                setSelected(entry)
                setSelectedByCategory((previous) => ({ ...previous, Quest: entry.name }))
                setSelectedQuestObjective({ questName: entry.name, objective })
              }}
              rowsBySource={rowsBySource}
              sourceKeysByPrefix={sourceKeysByPrefix}
              searching={query.trim().length > 0}
              showTranslatedTitles={showTranslatedTitles}
              customFolders={userOverrides.npcFolders}
              onAddToFolder={openFolderAction}
              customCharacterCreationFolders={userOverrides.characterCreationFolders}
              customItemFolders={userOverrides.itemFolders}
              customItemGroupsByEntry={userOverrides.itemGroupsByEntry}
              alchemyCategorySources={userOverrides.sourceNameByEntry}
              onAddToSection={openAddSectionEntry}
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
                    <h2 className="text-lg font-semibold">{activeQuestObjective?.title ?? current.name}</h2>
                    <span className="rounded border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300">
                      {activeQuestObjective ? 'Objective' : current.category}
                    </span>
                    {current.category === 'Character Creation' && <label className="ml-auto inline-flex cursor-pointer items-center gap-2 text-xs text-neutral-300">
                      <input
                        type="checkbox"
                        checked={showCharacterCreationUncompletedOnly}
                        onChange={(event) => setShowCharacterCreationUncompletedOnly(event.target.checked)}
                        className="h-3.5 w-3.5 accent-[var(--poly-accent)]"
                      />
                      <span>Uncompleted ({uncompletedTitleCount})</span>
                    </label>}
                  </div>
                  {!activeQuestObjective && (current.category === 'Character Creation' && showCharacterCreationUncompletedOnly && linkedTitle.length === 0
                    ? <div className="rounded border border-[#252a31] bg-[#0c0d0f] px-3 py-4 text-xs text-neutral-500">No uncompleted title translations found for this entry.</div>
                    : <TranslationField
                    label={current.category === 'NPC' ? 'Source' : 'Title EN'}
                    source={referenceTitleSource(current)}
                    entries={linkedTitle}
                    targetLang={session.targetLang.toUpperCase()}
                    update={update}
                    copy={copy(linkedTitle[0]?.source ?? referenceTitleSource(current))}
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
                    sourceAssociationLabel={current.alchemyCategoryLabel || isGameDataItem ? (linkedTitle.length ? 'Edit' : 'Add') : undefined}
                    onSourceAssociation={current.alchemyCategoryLabel || isGameDataItem ? () => openEditEntry(current) : undefined}
                    />)}
                  {!activeQuestObjective && current.category !== 'Character Creation' && (descriptionIsItem
                    ? current.category === 'Item' || (current.itemGroups?.length ?? 0) > 0 || linkedDescription.length > 0
                    : (current.description.trim() || linkedDescription.length > 0) &&
                      (current.category !== 'NPC' || linkedDescription.length > 0)) && (
                    <TranslationField
                      label={current.category === 'NPC' ? 'Source' : 'Description EN'}
                      source={current.descriptionSourceName ?? current.description}
                      entries={linkedDescription}
                      targetLang={session.targetLang.toUpperCase()}
                      update={update}
                      copy={copy(current.descriptionSourceName ?? current.description)}
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
                      sourceAssociationLabel={isGameDataItem || isAlchemyEntry ? (linkedDescription.length ? 'Edit' : 'Add') : undefined}
                      onSourceAssociation={isGameDataItem || isAlchemyEntry ? () => openEditEntry(current, 'description') : undefined}
                    />
                  )}
                  {activeQuestObjective && (
                    <div className="space-y-2">
                      {renderQuestTextField(activeQuestObjective.title, 'Objective title', `${activeQuestObjective.key}:title`)}
                      {activeQuestObjective.journalEntries.map((text, index) => renderQuestTextField(text, 'Description EN', `${activeQuestObjective.key}:description:${index}`))}
                    </div>
                  )}
                  {linkedEffects.map(({ text, rows }, index) => (
                    <TranslationField
                      key={`${current.name}:effect:${index}`}
                      label="Effect EN"
                      source={text}
                      entries={rows}
                      targetLang={session.targetLang.toUpperCase()}
                      update={update}
                      copy={copy(text)}
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
                  ))}
                  {linkedBookContent.map(({ text, rows }, index) => (
                    <TranslationField
                      key={`${current.name}:book-content:${index}`}
                      label="Book text"
                      source={text}
                      entries={rows}
                      targetLang={session.targetLang.toUpperCase()}
                      update={update}
                      copy={copy(text)}
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
                  ))}
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
        {entryContextMenu && (
          <div
            className="fixed inset-0 z-[4000]"
            onMouseDown={() => setEntryContextMenu(null)}
          >
            <div
              role="menu"
              className={cn('fixed z-[4001] max-w-[calc(100vw-16px)] overflow-hidden rounded-lg border border-neutral-600 bg-[#131518] p-1 shadow-2xl', entryContextMenu.entry.category !== 'NPC' ? 'w-48' : 'w-32')}
              style={{
                left: Math.max(8, Math.min(entryContextMenu.x, window.innerWidth - (entryContextMenu.entry.category !== 'NPC' ? 208 : 144))),
                top: Math.max(8, Math.min(entryContextMenu.y, window.innerHeight - (entryContextMenu.entry.category === 'Book' ? 152 : entryContextMenu.entry.category !== 'NPC' ? 120 : 80)))
              }}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => openEditEntry(entryContextMenu.entry)}
                className="game-data-entry-context-menu-option group flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-xs text-neutral-300 transition-colors hover:bg-neutral-800"
              >
                {contextHasTitle || entryContextMenu.entry.category === 'NPC'
                  ? <Pencil size={14} className="transition-colors group-hover:text-[var(--color-amber-300)]" />
                  : entryContextMenu.entry.category === 'Quest'
                    ? <ScrollText size={14} className="transition-colors group-hover:text-[var(--color-amber-300)]" />
                    : entryContextMenu.entry.category === 'Location'
                      ? <MapPin size={14} className="transition-colors group-hover:text-[var(--color-amber-300)]" />
                    : category === 'Item'
                      ? <Package size={14} className="transition-colors group-hover:text-[var(--color-amber-300)]" />
                      : entryContextMenu.entry.category === 'Alchemy'
                        ? <FlaskConical size={14} className="transition-colors group-hover:text-[var(--color-amber-300)]" />
                    : <BookText size={14} className="transition-colors group-hover:text-[var(--color-amber-300)]" />}
                {entryContextMenu.entry.category === 'NPC' ? 'Edit' : `${contextHasTitle ? 'Edit' : 'Add'} title`}
              </button>
              {entryContextMenu.entry.category !== 'NPC' && entryContextMenu.entry.category !== 'Character Creation' && <button
                type="button"
                role="menuitem"
                onClick={() => openEditEntry(entryContextMenu.entry, 'description')}
                className="game-data-entry-context-menu-option group flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-xs text-neutral-300 transition-colors hover:bg-neutral-800"
              >
                {contextHasDescription
                  ? <Pencil size={14} className="transition-colors group-hover:text-[var(--color-amber-300)]" />
                  : entryContextMenu.entry.category === 'Quest'
                    ? <ScrollText size={14} className="transition-colors group-hover:text-[var(--color-amber-300)]" />
                    : entryContextMenu.entry.category === 'Location'
                      ? <MapPin size={14} className="transition-colors group-hover:text-[var(--color-amber-300)]" />
                    : category === 'Item'
                      ? <Package size={14} className="transition-colors group-hover:text-[var(--color-amber-300)]" />
                      : entryContextMenu.entry.category === 'Alchemy'
                        ? <FlaskConical size={14} className="transition-colors group-hover:text-[var(--color-amber-300)]" />
                    : <BookText size={14} className="transition-colors group-hover:text-[var(--color-amber-300)]" />}
                {contextHasDescription ? 'Edit description' : 'Add description'}
              </button>}
              {entryContextMenu.entry.category === 'Book' && <button
                type="button"
                role="menuitem"
                onClick={() => openEditEntry(entryContextMenu.entry, 'content', contextHasBookText ? contextBookTextIndex : undefined)}
                className="game-data-entry-context-menu-option group flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-xs text-neutral-300 transition-colors hover:bg-neutral-800"
              >
                {contextHasBookText
                  ? <Pencil size={14} className="transition-colors group-hover:text-[var(--color-amber-300)]" />
                  : <BookText size={14} className="transition-colors group-hover:text-[var(--color-amber-300)]" />}
                {contextHasBookText ? 'Edit text' : 'Add text'}
              </button>}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                    setPendingEntryDelete({ entry: entryContextMenu.entry, path: entryContextMenu.path })
                  setEntryContextMenu(null)
                }}
                className="game-data-entry-context-menu-option group flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-xs text-neutral-300 transition-colors hover:bg-neutral-800"
              >
                <Trash2 size={14} className="transition-colors group-hover:text-[var(--color-amber-300)]" /> Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
