import {
  ChevronDown,
  ChevronRight,
  ClipboardPaste,
  Copy,
  ExternalLink,
  GitBranch,
  Search
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { type GenderVariant, useTranslationSession } from '@/context/TranslationSession'
import { type DialogueCategory, getDialogueGroups, getDialogueNodes } from '@/data/dialogReference'
import { SessionSaveButton } from '@/features/translate/components/SessionSaveButton'
import { cn } from '@/lib/utils'

const DIALOGUE_VIEW_STATE_KEY = 'icosa.dialogue-nodes.view'
type DialogueViewState = {
  activeAct?: string
  selectedKey?: string | null
  dialogueSearch?: string
  expandedNodes?: string[]
}
function loadDialogueViewState(): DialogueViewState {
  try {
    return JSON.parse(
      window.localStorage.getItem(DIALOGUE_VIEW_STATE_KEY) ?? '{}'
    ) as DialogueViewState
  } catch {
    return {}
  }
}

const ACTS: Array<{ label: string; categories: DialogueCategory[] }> = [
  { label: 'Act 1', categories: ['Act 1'] },
  { label: 'Act 2', categories: ['Act 2'] },
  { label: 'Act 3', categories: ['Act 3'] },
  {
    label: 'Global',
    categories: [
      'Global',
      'Camp',
      'Companions',
      'Generics',
      'Tutorial',
      'World Cinematics',
      'Combat Cinematics',
      'Main Menu',
      'Test',
      'Other'
    ]
  }
]
type Choice = { category: DialogueCategory; subcategory: string; file: string; dialogue: string }
type DialogueNavigationState = {
  category?: DialogueCategory
  file?: string
  dialogue?: string
  node?: string
  source?: string
  uid?: string
}

function actForCategory(category?: DialogueCategory): string {
  if (category === 'Act 1' || category === 'Act 2' || category === 'Act 3') return category
  return 'Global'
}

type TreeNode = { key: string; label: string; children: Map<string, TreeNode>; choices: Choice[] }
function pathForChoice(choice: Choice): string[] {
  const f = choice.file
  const rules: Array<[RegExp, string]> = [
    [/Act3_EndGame/i, 'End Game'],
    [/Act3_LowerCity/i, 'Lower City'],
    [/Act3_Wyrm/i, "Wyrm's Crossing"],
    [/Act2_Haven/i, 'Last Light Inn'],
    [/Act2_Epilogue/i, 'Epilogue'],
    [/Act3i/i, 'Act 3B'],
    [/Chapel/i, 'Chapel'],
    [/Crash/i, 'Crash Site'],
    [/DEN/i, 'Druid Grove'],
    [/Forest/i, 'Forest'],
    [/GOB|Goblin/i, 'Goblin Camp'],
    [/HAG|HagLair/i, 'Hag Lair'],
    [/Plains/i, 'Plains'],
    [/Swamp/i, 'Swamp'],
    [/Underdark/i, 'Underdark'],
    [/AstralPlane/i, 'Astral Plane'],
    [/LowerCreche/i, 'Lower Creche'],
    [/Monastery/i, 'Monastery'],
    [/UpperCreche/i, 'Upper Creche'],
    [/Colony/i, 'Colony'],
    [/Moonrise/i, 'Moonrise Towers'],
    [/Shadowland/i, 'Shadowland'],
    [/Shar/i, 'Shar Temple'],
    [/Town/i, 'Town'],
    [/Intermezzo/i, 'Intermezzo'],
    [/Camp_/i, 'Camp'],
    [/Companions_/i, 'Companions'],
    [/Generics/i, 'Generics'],
    [/Tutorial/i, 'Tutorial'],
    [/Global_/i, 'Global']
  ]
  const parent = rules.find(([re]) => re.test(f))?.[1] ?? choice.category
  const path = [choice.subcategory, parent]
  const childRules: Array<[RegExp, string]> = [
    [/SpeakWithDead/i, 'Speak with Dead'],
    [/Goblin_ADs|Underdark_ADs|NPCs_ADs/i, 'Automated Dialogues'],
    [/Goblin_VBs|Underdark_VBs/i, 'VBs'],
    [/Haven%20Outcasts/i, 'Haven Outcasts'],
    [/Act3_EndGame_Epilogue/i, 'Epilogue'],
    [/Wyrm_Signs|LowerCity_Signs/i, 'Signs'],
    [/BhaalTemple/i, 'Bhaal Temple'],
    [/DevilsFee/i, "Devil's Fee"],
    [/DockWarehouse/i, 'Dock Warehouse'],
    [/HouseOfHope/i, 'House of Hope'],
    [/SteelWatchStreets/i, 'Steel Watch Streets'],
    [/The%20Lodge/i, 'The Lodge'],
    [/WaterQueensHouse/i, "Water Queen's House"],
    [/SteelWatchFoundry_ControlLevel/i, 'Control Level'],
    [/SteelWatchFoundry_GroundLevel/i, 'Ground Level'],
    [/SteelWatchFoundry_LabLevel/i, 'Lab Level'],
    [/Camp_Relationship_Dialogs/i, 'Camp Relationship Dialogues'],
    [/Campfire_Moments/i, 'Campfire Moments'],
    [/Camp_NPCs/i, 'NPCs'],
    [/Sleep_Cutscenes/i, 'Sleep Cutscenes'],
    [/SoloDreams/i, 'Solo Dreams'],
    [/Group_Discussions/i, 'Group Discussions'],
    [/Origin_Moments/i, 'Origin Moments'],
    [/Party_Banter/i, 'Party Banter'],
    [/Reflection_Dialogs/i, 'Reflection Dialogues'],
    [/World_Relationship_Dialogs/i, 'World Relationship Dialogues'],
    [/Disturbances/i, 'Disturbances'],
    [/KorrillaTheSpy/i, 'Korrilla the Spy'],
    [/NO_RECORD/i, 'No Record'],
    [/PointAndClick/i, 'Point And Click'],
    [/Shovel/i, 'Shovel']
  ]
  const child = childRules.find(([re]) => re.test(f))?.[1]
  if (child && !path.includes(child)) path.push(child)
  if (child === 'Automated Dialogues' && /NPCs_ADs/i.test(f) && !path.includes('NPCs'))
    path.splice(2, 0, 'NPCs')
  return [...new Set(path)]
}
function makeTree(choices: Choice[]): TreeNode[] {
  const root = new Map<string, TreeNode>()
  for (const choice of choices) {
    let map = root
    let parent: TreeNode | null = null
    for (const label of pathForChoice(choice)) {
      const key = (parent?.key ?? 'root') + '/' + label
      let node = map.get(key)
      if (!node) {
        node = { key, label, children: new Map(), choices: [] }
        map.set(key, node)
      }
      parent = node
      map = node.children
    }
    parent?.choices.push(choice)
  }
  return [...root.values()]
}
function treeCount(node: TreeNode): number {
  return (
    node.choices.length +
    [...node.children.values()].reduce((sum, child) => sum + treeCount(child), 0)
  )
}
function visibleTreeRows(nodes: TreeNode[], expanded: Set<string>): number {
  return nodes.reduce((count, node) => {
    const childRows = expanded.has(node.key)
      ? visibleTreeRows([...node.children.values()], expanded)
      : 0
    return count + 1 + childRows
  }, 0)
}
function treePathForChoice(
  nodes: TreeNode[],
  selectedKey: string,
  parents: string[] = []
): string[] | null {
  for (const node of nodes) {
    const path = [...parents, node.key]
    if (node.choices.some((choice) => choice.file + ':' + choice.dialogue === selectedKey))
      return path
    const childPath = treePathForChoice([...node.children.values()], selectedKey, path)
    if (childPath) return childPath
  }
  return null
}
function treeCompletion(node: TreeNode, translated: Set<string>): number {
  const dialogues = treeCompletionDialogues(node)
  if (dialogues.size === 0) return 0
  const complete = [...dialogues].filter((dialogue) => translated.has(dialogue)).length
  return Math.round((complete / dialogues.size) * 1000) / 10
}
function treeCompletionDialogues(node: TreeNode): Set<string> {
  const dialogues = new Set(node.choices.map((choice) => choice.dialogue))
  for (const child of node.children.values())
    for (const dialogue of treeCompletionDialogues(child)) dialogues.add(dialogue)
  return dialogues
}
function TreeItems({
  nodes,
  expanded,
  toggle,
  selected,
  select,
  translated
}: {
  nodes: TreeNode[]
  expanded: Set<string>
  toggle: (key: string) => void
  selected: Choice | null
  select: (key: string) => void
  translated: Set<string>
}): React.JSX.Element {
  return (
    <div className="space-y-0.5">
      {nodes.map((node) => {
        const open = expanded.has(node.key)
        return (
          <div key={node.key}>
            <button
              type="button"
              onClick={() => toggle(node.key)}
              className="flex w-full items-center gap-1 rounded px-2 py-1.5 text-left text-xs text-neutral-300 hover:bg-[#131518]"
            >
              {open ? (
                <ChevronDown size={12} className="text-amber-300" />
              ) : (
                <ChevronRight size={12} className="text-neutral-600" />
              )}
              <span className="truncate font-medium">{node.label}</span>
              <span className="ml-auto shrink-0 text-[10px] text-neutral-600">
                {treeCount(node)}
              </span>
              <span className="shrink-0 text-[10px] font-semibold text-orange-300">
                {treeCompletion(node, translated)}%
              </span>
            </button>
            {open && (
              <div className="ml-3 border-l border-[#1f2329] pl-2">
                {node.children.size > 0 && (
                  <TreeItems
                    nodes={[...node.children.values()]}
                    expanded={expanded}
                    toggle={toggle}
                    selected={selected}
                    select={select}
                    translated={translated}
                  />
                )}
                {node.choices.map((choice) => {
                  const key = choice.file + ':' + choice.dialogue
                  return (
                    <button
                      key={key}
                      type="button"
                      data-dialogue-choice={key}
                      onClick={() => select(key)}
                      className={cn(
                        'mb-1 block w-full truncate rounded border px-2 py-1 text-left text-[10px]',
                        selected?.file === choice.file && selected.dialogue === choice.dialogue
                          ? 'border-amber-400/30 bg-amber-500/10 text-amber-200'
                          : 'border-transparent text-neutral-500 hover:border-[#2a2f37]'
                      )}
                    >
                      <span className="truncate">{choice.dialogue}</span>
                      {translated.has(choice.dialogue) && (
                        <span className="ml-2 shrink-0 rounded border border-emerald-400/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-300">
                          Translated
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function TranslationInput({
  value,
  onCommit
}: {
  value: string
  onCommit: (value: string) => void
}): React.JSX.Element {
  const [draft, setDraft] = useState(value)
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (!focused) setDraft(value)
  }, [value, focused])
  return (
    <textarea
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false)
        onCommit(draft)
      }}
      rows={4}
      placeholder="Translate here..."
      className="min-h-24 w-full resize-y rounded border border-[#2a2f37] bg-[#0c0d0f] px-3 py-2 text-xs leading-5 text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/15"
    />
  )
}

type DialogueEntryIndex = Map<
  string,
  Map<string, ReturnType<typeof useTranslationSession>['entries']>
>

export function DialogueNodesPage(): React.JSX.Element {
  const session = useTranslationSession()
  const location = useLocation()
  const navigationState = (location.state ?? {}) as DialogueNavigationState
  const graphWebviewRef = useRef<HTMLElement | null>(null)
  const copySource = async (event: React.MouseEvent, source: string) => {
    event.stopPropagation()
    await navigator.clipboard.writeText(source)
  }
  const pasteTranslation = async (event: React.MouseEvent, rowId: string) => {
    event.stopPropagation()
    const text = await navigator.clipboard.readText()
    if (text) session.updateEntry(rowId, text)
  }
  const [activeAct, setActiveAct] = useState(() =>
    navigationState.category
      ? actForCategory(navigationState.category)
      : (loadDialogueViewState().activeAct ?? 'Act 1')
  )
  const [selectedKey, setSelectedKey] = useState<string | null>(
    () =>
      navigationState.file && navigationState.dialogue
        ? `${navigationState.file}:${navigationState.dialogue}`
        : (loadDialogueViewState().selectedKey ?? null)
  )
  const [focusedNode, setFocusedNode] = useState<string | null>(
    () => navigationState.node ?? null
  )
  const [focusedSource, setFocusedSource] = useState<string | null>(
    () => navigationState.source ?? null
  )
  const [genderVariants, setGenderVariants] = useState<Record<string, GenderVariant>>({})
  const [focusedUid, setFocusedUid] = useState<string | null>(
    () => navigationState.uid ?? null
  )
  const [dialogueSearch, setDialogueSearch] = useState(
    () => (navigationState.dialogue ? '' : (loadDialogueViewState().dialogueSearch ?? ''))
  )
  const [dialogueTextSearch, setDialogueTextSearch] = useState('')
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(
    () => new Set(loadDialogueViewState().expandedNodes ?? [])
  )
  useEffect(() => {
    window.localStorage.setItem(
      DIALOGUE_VIEW_STATE_KEY,
      JSON.stringify({ activeAct, selectedKey, dialogueSearch, expandedNodes: [...expandedNodes] })
    )
  }, [activeAct, selectedKey, dialogueSearch, expandedNodes])
  const dialogueEntryIndex = useMemo<DialogueEntryIndex>(() => {
    const index: DialogueEntryIndex = new Map()
    for (const entry of session.entries)
      for (const group of getDialogueGroups(entry.source)) {
        let nodes = index.get(group.dialogue)
        if (!nodes) {
          nodes = new Map()
          index.set(group.dialogue, nodes)
        }
        const current = nodes.get(group.node) ?? []
        if (!current.some((item) => item.source === entry.source)) current.push(entry)
        nodes.set(group.node, current)
      }
    return index
  }, [session.entries])
  const choices = useMemo(() => {
    const allowed = new Set(ACTS.find((act) => act.label === activeAct)?.categories ?? [])
    const result = new Map<string, Choice>()
    for (const entry of session.entries)
      for (const group of getDialogueGroups(entry.source)) {
        if (allowed.has(group.category))
          result.set(`${group.file}:${group.dialogue}`, {
            category: group.category,
            subcategory:
              group.category === 'Act 1'
                ? /(Act1b|Act 1B|Act1_B)/i.test(group.file + ' ' + group.dialogue)
                  ? 'Act 1B'
                  : 'Act 1'
                : group.category === 'Act 2'
                  ? /(Act2b|Act 2B|Act2_B)/i.test(group.file + ' ' + group.dialogue)
                    ? 'Act 2B'
                    : 'Act 2'
                  : group.category === 'Act 3'
                  ? /(Act3b|Act3i|Act 3B|Act3_B)/i.test(group.file + ' ' + group.dialogue)
                      ? 'Act 3B'
                      : 'Act 3'
                    : group.category,
            file: group.file,
            dialogue: group.dialogue
          })
      }
    return [...result.values()].sort((a, b) => a.dialogue.localeCompare(b.dialogue))
  }, [activeAct, session.entries])
  const translatedDialogues = useMemo(() => {
    const translated = new Set<string>()
    for (const choice of choices) {
      const rows = [...(dialogueEntryIndex.get(choice.dialogue)?.values() ?? [])].flat()
      if (rows.length > 0 && rows.every((entry) => entry.target.trim().length > 0))
        translated.add(choice.dialogue)
    }
    return translated
  }, [choices, dialogueEntryIndex])
  const visibleChoices = useMemo(() => {
    const nameQuery = dialogueSearch.trim().toLocaleLowerCase()
    const textQuery = dialogueTextSearch.trim().toLocaleLowerCase()
    return choices.filter((choice) => {
      if (nameQuery && !choice.dialogue.toLocaleLowerCase().includes(nameQuery)) return false
      if (!textQuery) return true
      const rows = [...(dialogueEntryIndex.get(choice.dialogue)?.values() ?? [])].flat()
      return rows.some((entry) => `${entry.source}\n${entry.target}`.toLocaleLowerCase().includes(textQuery))
    })
  }, [choices, dialogueEntryIndex, dialogueSearch, dialogueTextSearch])
  const tree = useMemo(() => makeTree(visibleChoices), [visibleChoices])
  useEffect(() => {
    if (!selectedKey) return
    const path = treePathForChoice(tree, selectedKey)
    if (!path) return
    setExpandedNodes((current) => {
      const next = new Set(current)
      for (const key of path) next.add(key)
      return next.size === current.size ? current : next
    })
  }, [selectedKey, tree])
  const toggleTree = (key: string) =>
    setExpandedNodes((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  const selected =
    visibleChoices.find((choice) => `${choice.file}:${choice.dialogue}` === selectedKey) ??
    visibleChoices[0] ??
    null
  const nodes = useMemo(() => (selected ? getDialogueNodes(selected.dialogue) : []), [selected])

  useEffect(() => {
    if (!focusedNode || !selected) return
    let attempts = 0
    let retryTimer: number | undefined
    const focusTargets = () => {
      const nodeTarget = document.getElementById(`dialogue-node-${focusedNode}`)
      if (!nodeTarget) {
        if (attempts++ < 12) retryTimer = window.setTimeout(focusTargets, 100)
        return
      }
      const stringTarget = [...nodeTarget.querySelectorAll<HTMLElement>('[data-dialogue-source], [data-dialogue-uid]')]
        .find((element) =>
          (focusedUid && element.dataset.dialogueUid === focusedUid) ||
          (focusedSource && element.dataset.dialogueSource === focusedSource)
        )
      ;(stringTarget ?? nodeTarget).scrollIntoView({ behavior: 'smooth', block: 'center' })
      retryTimer = window.setTimeout(() => {
        setFocusedNode(null)
        setFocusedSource(null)
        setFocusedUid(null)
      }, 2400)
    }
    focusTargets()
    return () => {
      if (retryTimer) window.clearTimeout(retryTimer)
    }
  }, [focusedNode, focusedSource, focusedUid, selected?.dialogue, nodes])

  useEffect(() => {
    if (!selectedKey) return
    let attempts = 0
    let retryTimer: number | undefined
    const focusTreeChoice = () => {
      const target = [...document.querySelectorAll<HTMLElement>('[data-dialogue-choice]')]
        .find((element) => element.dataset.dialogueChoice === selectedKey)
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' })
        return
      }
      if (attempts++ < 12) retryTimer = window.setTimeout(focusTreeChoice, 100)
    }
    focusTreeChoice()
    return () => {
      if (retryTimer) window.clearTimeout(retryTimer)
    }
  }, [selectedKey, expandedNodes, tree])


  if (session.phase !== 'loaded')
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div className="rounded-xl border border-[#1f2329] bg-[#131518] p-8">
          <GitBranch className="mx-auto mb-3 text-amber-500" size={28} />
          <h1 className="mb-2 text-lg font-semibold text-neutral-100">Dialogue Nodes</h1>
          <p className="text-sm text-neutral-500">Load a localization XML in Translate first.</p>
        </div>
      </div>
    )

  const treePanelRows = Math.min(4, Math.max(1, visibleTreeRows(tree, expandedNodes)))
  const treePanelStyle = { '--dialogue-tree-mobile-height': `${treePanelRows * 42 + 24}px` } as React.CSSProperties

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0c0d0f]">
      <header className="app-page-header shrink-0 border-b border-[#1f2329] bg-[#0f1114] px-6 py-5">
        <div className="mb-4 flex items-center gap-3">
          <GitBranch className="text-amber-500" size={20} />
          <div>
            <h1 className="text-xl font-bold text-neutral-100">Dialogue Nodes</h1>
            <p className="text-xs text-neutral-500">
              Translate {session.sourceLang.toUpperCase()} → {session.targetLang.toUpperCase()}
            </p>
          </div>
          <SessionSaveButton session={session} className="ml-auto" />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {ACTS.map((act) => (
            <button
              key={act.label}
              type="button"
              onClick={() => {
                setActiveAct(act.label)
                setSelectedKey(null)
                setExpandedNodes(new Set())
              }}
              className={cn(
                'rounded-md border px-4 py-2 text-xs font-semibold',
                activeAct === act.label
                  ? 'border-amber-400/40 bg-amber-500/15 text-amber-200'
                  : 'border-transparent text-neutral-500 hover:border-[#2a2f37] hover:text-neutral-200'
              )}
            >
              {act.label}
            </button>
          ))}
          <div className="ml-0 flex min-w-0 flex-1 justify-end gap-2 sm:ml-auto sm:min-w-[280px] lg:min-w-[360px]">
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-[#2a2f37] bg-[#131518] px-3 text-xs text-neutral-500 focus-within:border-amber-400/40">
              <Search size={14} />
              <input
                value={dialogueSearch}
                onChange={(event) => setDialogueSearch(event.target.value)}
                placeholder="Search dialogue node name..."
                className="min-w-0 flex-1 bg-transparent py-2 text-xs text-neutral-200 outline-none placeholder:text-neutral-600"
              />
            </label>
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-[#2a2f37] bg-[#131518] px-3 text-xs text-neutral-500 focus-within:border-amber-400/40">
              <Search size={14} />
              <input
                value={dialogueTextSearch}
                onChange={(event) => setDialogueTextSearch(event.target.value)}
                placeholder="Search source or translation..."
                className="min-w-0 flex-1 bg-transparent py-2 text-xs text-neutral-200 outline-none placeholder:text-neutral-600"
              />
            </label>
            <button
              type="button"
              disabled={!selected}
              onClick={() => selected && window.api.dialogue.open(selected.dialogue)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded border border-[#2a2f37] bg-[#131518] px-3 text-[11px] text-neutral-300 hover:border-amber-400/40 hover:text-amber-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ExternalLink size={12} /> Open online
            </button>
          </div>
        </div>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:overflow-hidden lg:grid-cols-[minmax(360px,0.78fr)_minmax(0,1.22fr)]">
        <aside style={treePanelStyle} className="contents lg:grid lg:min-h-0 lg:max-h-none lg:grid-rows-[minmax(0,0.32fr)_minmax(0,0.68fr)] lg:border-r lg:border-[#1f2329]">
          <div className="order-1 min-h-[var(--dialogue-tree-mobile-height)] overflow-y-auto border-b border-[#1f2329] p-3 lg:order-none lg:min-h-0">
            <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-600">
              Dialogue tree · {visibleChoices.length}
            </div>
            <TreeItems
              nodes={tree}
              expanded={expandedNodes}
              toggle={toggleTree}
              selected={selected}
              select={setSelectedKey}
              translated={translatedDialogues}
            />
            {visibleChoices.length === 0 && (
              <p className="px-2 py-4 text-xs text-neutral-600">
                No dialogue nodes found for this act.
              </p>
            )}
          </div>
          <div className="order-3 min-h-[420px] overflow-hidden border-b border-[#1f2329] p-3 lg:order-none lg:min-h-0 lg:border-b-0">
            {selected ? (
              <div className="flex h-full min-h-0 w-full flex-col rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                <div className="relative flex min-h-0 flex-1 w-full min-w-0 overflow-hidden rounded-lg border border-[#1f2329] bg-[#0c0d0f]">
                  <webview
                    ref={graphWebviewRef}
                    title="BG3 dialogue graph"
                    src={
                      'https://bg3.game-script.com/files/' + encodeURIComponent(selected.dialogue)
                    }
                    allowpopups
                    className="block h-full min-h-0 w-full min-w-0 border-0"
                    style={{ height: '100%', width: '100%', display: 'flex' }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-neutral-600">
                Select a dialogue to view its graph.
              </div>
            )}
          </div>
        </aside>
        <section className="order-2 icosa-scroll min-h-[700px] min-w-0 overflow-y-auto border-b border-[#1f2329] p-3 sm:p-5 lg:order-none lg:min-h-0 lg:border-b-0">
          {selected ? (
            <div className="w-full space-y-3">
              {nodes.map((node, index) => {
                const matches = dialogueEntryIndex.get(selected.dialogue)?.get(node.node) ?? []
                const borderClass = 'border-[#1f2329]'
                return (
                  <div
                    key={node.node}
                    id={`dialogue-node-${node.node}`}
                    className={cn(
                      'rounded-lg border bg-[#131518] p-4 transition-shadow',
                      borderClass,
                      focusedNode === node.node && 'ring-2 ring-amber-400/60 shadow-[0_0_24px_rgba(34,211,238,0.18)]'
                    )}
                  >
                    <div className="mb-3 flex gap-2 font-mono text-[10px] text-neutral-500">
                      <span className="text-amber-300">Node {index + 1}</span>
                      <span>{node.node}</span>
                    </div>
                    {node.details.length > 0 && (
                      <div className="mb-3 rounded border border-[#1f2329] bg-[#0c0d0f] px-3 py-2 text-[10px] leading-4 text-neutral-500">
                        {node.details.join(' · ')}
                      </div>
                    )}
                    {matches.length === 0 ? (
                      <div className="text-xs italic text-neutral-600">
                        No matching localization string
                      </div>
                    ) : (
                      matches.map((entry) => (
                        <div
                          key={entry.rowId}
                          data-dialogue-source={entry.source}
                          data-dialogue-uid={entry.uid}
                          className="mb-3 grid grid-cols-1 gap-3 last:mb-0 lg:grid-cols-2"
                        >
                          {entry.genderVariant && entry.genderVariant !== 'default' && (
                            <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-400">
                              <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5">{entry.genderVariant}</span>
                            </div>
                          )}
                          <div>
                            <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-600">
                              Source · {session.sourceLang.toUpperCase()}
                              <button
                                type="button"
                                aria-label="Copy source"
                                title="Copy source"
                                onClick={(event) => copySource(event, entry.source)}
                                className="inline-flex h-5 items-center rounded px-1.5 text-neutral-400 hover:bg-[#1c1f24] hover:text-neutral-200"
                              >
                                <Copy size={11} />
                              </button>
                            </div>
                            <div className="rounded border border-[#1f2329] bg-[#0c0d0f] px-3 py-2 text-xs leading-5 text-neutral-200">
                              {entry.source}
                            </div>
                          </div>
                          <div>
                            {(() => {
                              const variant = genderVariants[entry.rowId] ?? entry.genderVariant ?? 'default'
                              const value = variant === 'default' ? entry.target : (entry.genderTargets?.[variant] ?? '')
                              return (
                                <>
                            <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-500/70">
                              Translation · {session.targetLang.toUpperCase()}
                              <button
                                type="button"
                                aria-label="Paste translation"
                                title="Paste translation"
                                onClick={(event) => pasteTranslation(event, entry.rowId)}
                                className="inline-flex h-5 items-center rounded px-1.5 text-amber-300/80 hover:bg-amber-500/10 hover:text-amber-200"
                              >
                                <ClipboardPaste size={11} />
                              </button>
                            </div>
                            <TranslationInput
                              value={value}
                              onCommit={(value) => {
                                if (variant === 'default') {
                                  if (value !== entry.target) session.updateEntry(entry.rowId, value)
                                } else if (value !== (entry.genderTargets?.[variant] ?? '')) {
                                  session.updateGenderVariant(entry.rowId, variant, value)
                                }
                                session.markManual(entry.rowId)
                              }}
                            />
                            <div className="mt-1 flex gap-1">
                              {(['default', 'female', 'neutral'] as GenderVariant[]).map((item) => (
                                <button key={item} type="button" onClick={() => setGenderVariants((previous) => ({ ...previous, [entry.rowId]: item }))} className={`rounded border px-1.5 py-0.5 text-[9px] uppercase ${variant === item ? 'border-amber-500/40 bg-amber-500/10 text-amber-300' : 'border-[#1f2329] text-neutral-600 hover:text-neutral-400'}`}>{item}</button>
                              ))}
                            </div>
                                </>
                              )
                            })()}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-neutral-600">
              Select a dialogue from the list.
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
