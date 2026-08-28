import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from 'react'
import { getReferenceLinks, getReferenceTags, type ReferenceTag } from '@/data/gameReference'
import {
  matchesDialogueFilters,
  matchesDialogueScope,
  type DialogueFilter,
  type DialogueScope
} from '@/data/dialogReference'
import { i18n } from '@/i18n'
import type { XmlEntry, XmlLoadProgress } from '@/types'

export interface TranslationSessionEntry extends XmlEntry {
  rowId: string
}
export type GenderVariant = 'default' | 'female' | 'neutral'

type Phase = 'idle' | 'loading' | 'loaded'

export type FilterMode = 'all' | 'untranslated' | 'translated' | 'dictionary' | 'tags' | 'needs-review'
export interface FilterSpec {
  mode: FilterMode
  referenceTag: ReferenceTag | 'all'
  dialogueFilters: DialogueFilter[]
  dialogueScope: DialogueScope | null
  search: string
  exactMatch: boolean
  linkNameDescription: boolean
}
export type SelectionState =
  | { kind: 'explicit'; uids: Set<string> }
  | { kind: 'all-matching'; filter: FilterSpec; excluded: Set<string> }

// private helpers - mirror predicates from TranslationGrid so entryMatchesFilter stays pure
function getCategory(entry: TranslationSessionEntry): 'dictionary' | 'tool' | 'manual' | 'none' {
  if (entry.matchType === 'mod-text' || entry.matchType === 'text') return 'dictionary'
  if (entry.matchType === 'manual') return 'manual'
  if (entry.target.trim()) return 'tool'
  return 'none'
}

function hasXmlTags(entry: TranslationSessionEntry): boolean {
  return /(<[^>]+>|\{[^}]+\})/.test(entry.source)
}

export function isDeveloperNote(source: string): boolean {
  const value = source.trim()
  // Larian notes can have XML markup after the closing pipe (for example
  // `|internal note|<br>`), so do not require the string to end with `|`.
  return value.startsWith('%%%') || (value.startsWith('|') && value.indexOf('|', 1) > 0)
}

const searchCache = new WeakMap<TranslationSessionEntry, { source: string; uid: string; uidShort: string }>()

export function entryMatchesSearch(
  entry: TranslationSessionEntry,
  query: string,
  exactMatch: boolean
): boolean {
  const normalizedQuery = query.toLowerCase()
  const cached = searchCache.get(entry)
  const source = cached?.source ?? entry.source.toLowerCase()
  const uid = cached?.uid ?? entry.uid.toLowerCase()
  if (!cached) searchCache.set(entry, { source, uid, uidShort: uid.slice(-9) })
  const matchesText = (text: string): boolean => exactMatch ? text === normalizedQuery : text.includes(normalizedQuery)

  return (
    matchesText(source) ||
    matchesText(entry.target.toLowerCase()) ||
    matchesText(uid) ||
    matchesText(cached?.uidShort ?? uid.slice(-9))
  )
}

export function entryMatchesFilter(entry: TranslationSessionEntry, filter: FilterSpec): boolean {
  if (filter.mode === 'untranslated' && entry.target.trim()) return false
  if (filter.mode === 'translated' && !entry.target.trim()) return false
  if (filter.mode === 'dictionary' && getCategory(entry) !== 'dictionary') return false
  if (filter.mode === 'tags' && !hasXmlTags(entry)) return false
  if (filter.mode === 'needs-review' && !entry.needsReview) return false
  if (filter.referenceTag !== 'all' && !getReferenceTags(entry.source).includes(filter.referenceTag)) {
    return false
  }
  if (!matchesDialogueFilters(entry.source, filter.dialogueFilters)) return false
  if (!matchesDialogueScope(entry.source, filter.dialogueScope)) return false
  if (filter.search) {
    const directMatch = entryMatchesSearch(entry, filter.search, filter.exactMatch)
    if (directMatch) return true
    if (filter.linkNameDescription) {
      const query = filter.search.toLowerCase()
      return getReferenceLinks(entry.source).some((link) =>
        filter.exactMatch ? link.text.toLowerCase() === query : link.text.toLowerCase().includes(query)
      )
    }
    return false
  }
  return true
}

export interface TranslationSessionState {
  phase: Phase
  loadingLabel: string
  loadingProgress: XmlLoadProgress | null
  entries: TranslationSessionEntry[]
  sourceFrequencies: Map<string, number>
  targetFrequencies: Map<string, number>
  selection: SelectionState
  modName: string
  sourceLang: string
  targetLang: string
  inputPath: string | null
  storedPath: string | null
}

export function materializeSelectedEntries(
  state: TranslationSessionState
): TranslationSessionEntry[] {
  const { selection, entries } = state
  if (selection.kind === 'explicit') {
    return entries.filter((e) => selection.uids.has(e.rowId))
  }
  return entries.filter(
    (e) => entryMatchesFilter(e, selection.filter) && !selection.excluded.has(e.rowId)
  )
}

const EMPTY_EXPLICIT: SelectionState = { kind: 'explicit', uids: new Set() }

type Action =
  | { type: 'SET_PHASE'; phase: Phase; loadingLabel?: string }
  | { type: 'SET_LOADING_PROGRESS'; progress: XmlLoadProgress | null }
  | { type: 'SET_ENTRIES'; entries: TranslationSessionEntry[] }
  | { type: 'UPDATE_ENTRY'; rowId: string; target: string }
  | { type: 'UPDATE_GENDER_VARIANT'; rowId: string; variant: GenderVariant; target: string }
  | { type: 'MARK_MANUAL'; rowId: string }
  | { type: 'TOGGLE_NEEDS_REVIEW'; rowId: string }
  | { type: 'SELECT_ALL_MATCHING'; filter: FilterSpec }
  | { type: 'SELECT_ROWS'; rowIds: string[] }
  | { type: 'TOGGLE_ENTRY'; rowId: string }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_MOD_NAME'; name: string }
  | { type: 'SET_SOURCE_LANG'; lang: string }
  | { type: 'SET_TARGET_LANG'; lang: string }
  | { type: 'SET_INPUT_PATH'; path: string }
  | { type: 'SET_STORED_PATH'; path: string }
  | { type: 'RESET' }

function reducer(state: TranslationSessionState, action: Action): TranslationSessionState {
  switch (action.type) {
    case 'SET_PHASE':
      return {
        ...state,
        phase: action.phase,
        loadingLabel: action.phase === 'loading' ? (action.loadingLabel ?? state.loadingLabel) : ''
      }
    case 'SET_LOADING_PROGRESS':
      return { ...state, loadingProgress: action.progress }
    case 'SET_ENTRIES': {
      const sourceFrequencies = new Map<string, number>()
      const targetFrequencies = new Map<string, number>()
      for (const entry of action.entries) {
        sourceFrequencies.set(entry.source, (sourceFrequencies.get(entry.source) ?? 0) + 1)
        if (entry.target) {
          targetFrequencies.set(entry.target, (targetFrequencies.get(entry.target) ?? 0) + 1)
        }
      }
      return {
        ...state,
        entries: action.entries,
        sourceFrequencies,
        targetFrequencies,
        selection: EMPTY_EXPLICIT,
        phase: 'loaded',
        loadingLabel: '',
        loadingProgress: null
      }
    }
    case 'UPDATE_ENTRY': {
      const currentEntry = state.entries.find((entry) => entry.rowId === action.rowId)
      if (!currentEntry || currentEntry.target === action.target) return state

      const targetFrequencies = new Map(state.targetFrequencies)
      if (currentEntry.target) {
        const previousCount = targetFrequencies.get(currentEntry.target) ?? 0
        if (previousCount <= 1) targetFrequencies.delete(currentEntry.target)
        else targetFrequencies.set(currentEntry.target, previousCount - 1)
      }
      if (action.target) {
        targetFrequencies.set(action.target, (targetFrequencies.get(action.target) ?? 0) + 1)
      }

      return {
        ...state,
        targetFrequencies,
        entries: state.entries.map((e) =>
          e.rowId === action.rowId ? { ...e, target: action.target } : e
        )
      }
    }
    case 'UPDATE_GENDER_VARIANT': {
      const currentEntry = state.entries.find((entry) => entry.rowId === action.rowId)
      if (!currentEntry) return state
      const genderTargets = { ...(currentEntry.genderTargets ?? {}), [action.variant]: action.target }
      return { ...state, entries: state.entries.map((entry) => entry.rowId === action.rowId ? { ...entry, genderTargets } : entry) }
    }
    case 'MARK_MANUAL':
      return {
        ...state,
        entries: state.entries.map((e) =>
          e.rowId === action.rowId ? { ...e, matchType: 'manual' } : e
        )
      }
    case 'TOGGLE_NEEDS_REVIEW':
      return {
        ...state,
        entries: state.entries.map((e) =>
          e.rowId === action.rowId ? { ...e, needsReview: !e.needsReview } : e
        )
      }
    case 'SELECT_ALL_MATCHING':
      return {
        ...state,
        selection: { kind: 'all-matching', filter: action.filter, excluded: new Set() }
      }
    case 'SELECT_ROWS':
      return { ...state, selection: { kind: 'explicit', uids: new Set(action.rowIds) } }
    case 'TOGGLE_ENTRY': {
      const { selection } = state
      if (selection.kind === 'explicit') {
        const uids = new Set(selection.uids)
        if (uids.has(action.rowId)) uids.delete(action.rowId)
        else uids.add(action.rowId)
        return { ...state, selection: { kind: 'explicit', uids } }
      }
      // all-matching: toggle exclusion (excluded = visually unchecked)
      const excluded = new Set(selection.excluded)
      if (excluded.has(action.rowId)) excluded.delete(action.rowId)
      else excluded.add(action.rowId)
      return { ...state, selection: { ...selection, excluded } }
    }
    case 'CLEAR_SELECTION':
      return { ...state, selection: EMPTY_EXPLICIT }
    case 'SET_MOD_NAME':
      return { ...state, modName: action.name }
    case 'SET_SOURCE_LANG':
      return { ...state, sourceLang: action.lang }
    case 'SET_TARGET_LANG':
      return { ...state, targetLang: action.lang }
    case 'SET_INPUT_PATH':
      return { ...state, inputPath: action.path }
    case 'SET_STORED_PATH':
      return { ...state, storedPath: action.path }
    case 'RESET':
      return {
        ...state,
        phase: 'idle',
        loadingLabel: '',
        loadingProgress: null,
        entries: [],
        sourceFrequencies: new Map<string, number>(),
        targetFrequencies: new Map<string, number>(),
        selection: EMPTY_EXPLICIT,
        inputPath: null,
        storedPath: null
      }
    default:
      return state
  }
}

interface TranslationSessionContext extends TranslationSessionState {
  todayProgress: number
  // new selection API
  selectAllMatching: (filter: FilterSpec) => void
  selectRows: (rowIds: string[]) => void
  toggleEntry: (rowId: string) => void
  clearSelection: () => void
  isSelected: (rowId: string) => boolean
  selectedCount: number
  // compat shims - replaced in task 05
  /** @deprecated use isSelected */
  selectedUids: Set<string>
  /** @deprecated use toggleEntry */
  selectEntry: (rowId: string, selected: boolean) => void
  /** @deprecated use selectAllMatching */
  selectEntries: (rowIds: string[], selected: boolean) => void
  // other
  loadSession: (
    inputPath: string,
    sourceLang: string,
    targetLang: string,
    modName: string,
    options?: { storedPath?: string }
  ) => Promise<void>
  updateEntry: (rowId: string, target: string) => void
  updateGenderVariant: (rowId: string, variant: GenderVariant, target: string) => void
  markManual: (rowId: string) => void
  toggleNeedsReview: (rowId: string) => void
  setModName: (name: string) => void
  setSourceLang: (lang: string) => void
  setTargetLang: (lang: string) => void
  resetSession: () => void
}

const Context = createContext<TranslationSessionContext | null>(null)

const DEFAULT_SOURCE = 'en'
const DEFAULT_TARGET = 'ro'
const DAILY_PROGRESS_KEY = 'icosa.daily-progress'

type DailyProgress = { date: string; count: number; ids: string[] }

function readDailyProgress(): DailyProgress {
  const date = new Date().toISOString().slice(0, 10)
  try {
    const saved = JSON.parse(window.localStorage.getItem(DAILY_PROGRESS_KEY) ?? '') as Partial<DailyProgress>
    if (saved.date === date && Array.isArray(saved.ids)) {
      return { date, count: saved.ids.length, ids: saved.ids }
    }
  } catch {
    // Start a clean daily counter when storage is empty or malformed.
  }
  return { date, count: 0, ids: [] }
}

export function TranslationSessionProvider({
  children
}: {
  children: React.ReactNode
}): React.JSX.Element {
  const [state, dispatch] = useReducer(reducer, {
    phase: 'idle',
    loadingLabel: '',
    loadingProgress: null,
    entries: [],
    sourceFrequencies: new Map<string, number>(),
    targetFrequencies: new Map<string, number>(),
    selection: EMPTY_EXPLICIT,
    modName: '',
    sourceLang: DEFAULT_SOURCE,
    targetLang: DEFAULT_TARGET,
    inputPath: null,
    storedPath: null
  })
  const [dailyProgress, setDailyProgress] = useState<DailyProgress>(readDailyProgress)

  useEffect(() => {
    window.api.config.getAll().then((cfg) => {
      if (cfg.last_source_lang) dispatch({ type: 'SET_SOURCE_LANG', lang: cfg.last_source_lang })
      if (cfg.last_target_lang === 'pt-BR') {
        dispatch({ type: 'SET_TARGET_LANG', lang: DEFAULT_TARGET })
        void window.api.config.set({ key: 'last_target_lang', value: DEFAULT_TARGET })
      } else if (cfg.last_target_lang) {
        dispatch({ type: 'SET_TARGET_LANG', lang: cfg.last_target_lang })
      }
    })
  }, [])

  const loadSession = useCallback(
    async (
      inputPath: string,
      sourceLang: string,
      targetLang: string,
      modName: string,
      options?: { storedPath?: string }
    ) => {
      dispatch({
        type: 'SET_PHASE',
        phase: 'loading',
        loadingLabel: i18n.t('setup.loadingPreparingSession', { ns: 'translate' })
      })
      dispatch({ type: 'SET_INPUT_PATH', path: inputPath })
      dispatch({ type: 'SET_MOD_NAME', name: modName })
      const storedPath =
        options?.storedPath ??
        (await window.api.mod.storeFile({ modName, filePath: inputPath })).storedPath
      dispatch({ type: 'SET_STORED_PATH', path: storedPath })
      dispatch({
        type: 'SET_PHASE',
        phase: 'loading',
        loadingLabel: i18n.t('setup.loadingEntries', { ns: 'translate' })
      })
      const unsub = window.api.xml.onLoadProgress((p) => {
        dispatch({ type: 'SET_LOADING_PROGRESS', progress: p })
      })
      let entries: Awaited<ReturnType<typeof window.api.xml.load>>
      try {
        entries = await window.api.xml.load({
          inputPath: storedPath,
          sourceLang,
          targetLang,
          modName
        })
        const saved = await window.api.session.load({ key: `${storedPath}|${sourceLang}|${targetLang}` })
        if (saved) {
          const savedByUid = new Map(saved.map((entry) => [entry.uid, entry]))
          entries = entries.map((entry) => {
            const previous = savedByUid.get(entry.uid)
            return previous
              ? {
                  ...entry,
                  target: previous.target.trim() || previous.needsReview ? previous.target : entry.target,
                  matchType: previous.target.trim() || previous.matchType === 'manual' ? previous.matchType : entry.matchType,
                  needsReview: previous.needsReview === true
                }
              : entry
          })
        }
      } finally {
        unsub()
      }
      if (modName) {
        dispatch({
          type: 'SET_PHASE',
          phase: 'loading',
          loadingLabel: i18n.t('setup.loadingModData', { ns: 'translate' })
        })
        await window.api.mod.upsert({
          name: modName,
          totalStrings: entries.length > 0 ? entries.length : undefined,
          lastFilePath: storedPath
        })
      }
      dispatch({
        type: 'SET_ENTRIES',
        entries: entries.map((entry, index) => ({ ...entry, rowId: `row-${index}` }))
      })
    },
    []
  )

  const updateEntry = useCallback((rowId: string, target: string) => {
    const currentEntry = state.entries.find((entry) => entry.rowId === rowId)
    if (currentEntry && !currentEntry.target.trim() && target.trim()) {
      const currentDaily = readDailyProgress()
      const id = currentEntry.uid || rowId
      if (!currentDaily.ids.includes(id)) {
        const nextDaily = { date: currentDaily.date, ids: [...currentDaily.ids, id], count: currentDaily.count + 1 }
        window.localStorage.setItem(DAILY_PROGRESS_KEY, JSON.stringify(nextDaily))
        setDailyProgress(nextDaily)
      }
    }
    dispatch({ type: 'UPDATE_ENTRY', rowId, target })
  }, [state.entries])

  const updateGenderVariant = useCallback((rowId: string, variant: GenderVariant, target: string) => {
    dispatch({ type: 'UPDATE_GENDER_VARIANT', rowId, variant, target })
  }, [])

  const markManual = useCallback((rowId: string) => {
    dispatch({ type: 'MARK_MANUAL', rowId })
  }, [])

  const toggleNeedsReview = useCallback((rowId: string) => {
    dispatch({ type: 'TOGGLE_NEEDS_REVIEW', rowId })
  }, [])

  const selectAllMatching = useCallback((filter: FilterSpec) => {
    dispatch({ type: 'SELECT_ALL_MATCHING', filter })
  }, [])

  const selectRows = useCallback((rowIds: string[]) => {
    dispatch({ type: 'SELECT_ROWS', rowIds })
  }, [])

  const toggleEntry = useCallback((rowId: string) => {
    dispatch({ type: 'TOGGLE_ENTRY', rowId })
  }, [])

  const clearSelection = useCallback(() => {
    dispatch({ type: 'CLEAR_SELECTION' })
  }, [])

  const isSelected = useCallback(
    (rowId: string): boolean => {
      const { selection, entries } = state
      if (selection.kind === 'explicit') return selection.uids.has(rowId)
      const entry = entries.find((e) => e.rowId === rowId)
      if (!entry) return false
      return entryMatchesFilter(entry, selection.filter) && !selection.excluded.has(rowId)
    },
    [state]
  )

  const selectedCount = useMemo(() => {
    const { selection, entries } = state
    if (selection.kind === 'explicit') return selection.uids.size
    let count = 0
    for (const entry of entries) {
      if (entryMatchesFilter(entry, selection.filter) && !selection.excluded.has(entry.rowId)) {
        count++
      }
    }
    return count
  }, [state])

  // compat shim: materializes Set<string> for legacy consumers (task 05 removes)
  const selectedUids = useMemo(() => {
    const { selection, entries } = state
    if (selection.kind === 'explicit') return selection.uids
    const result = new Set<string>()
    for (const entry of entries) {
      if (entryMatchesFilter(entry, selection.filter) && !selection.excluded.has(entry.rowId)) {
        result.add(entry.rowId)
      }
    }
    return result
  }, [state])

  // compat shim: maps old per-row select to toggleEntry (task 05 removes)
  const selectEntry = useCallback(
    (rowId: string, selected: boolean) => {
      if (isSelected(rowId) !== selected) dispatch({ type: 'TOGGLE_ENTRY', rowId })
    },
    [isSelected]
  )

  // compat shim: maps old bulk select to individual toggles (task 05 removes)
  const selectEntries = useCallback(
    (rowIds: string[], selected: boolean) => {
      for (const rowId of rowIds) {
        if (isSelected(rowId) !== selected) dispatch({ type: 'TOGGLE_ENTRY', rowId })
      }
    },
    [isSelected]
  )

  const setModName = useCallback((name: string) => {
    dispatch({ type: 'SET_MOD_NAME', name })
  }, [])

  const setSourceLang = useCallback((lang: string) => {
    dispatch({ type: 'SET_SOURCE_LANG', lang })
  }, [])

  const setTargetLang = useCallback((lang: string) => {
    dispatch({ type: 'SET_TARGET_LANG', lang })
  }, [])

  const resetSession = useCallback(() => {
    dispatch({ type: 'RESET' })
  }, [])

  return (
    <Context.Provider
      value={{
        ...state,
        todayProgress: dailyProgress.count,
        selectAllMatching,
        selectRows,
        toggleEntry,
        clearSelection,
        isSelected,
        selectedCount,
        selectedUids,
        selectEntry,
        selectEntries,
        loadSession,
    updateEntry,
    updateGenderVariant,
        markManual,
        toggleNeedsReview,
        setModName,
        setSourceLang,
        setTargetLang,
        resetSession
      }}
    >
      {children}
    </Context.Provider>
  )
}

export function useTranslationSession(): TranslationSessionContext {
  const ctx = useContext(Context)
  if (!ctx) throw new Error('useTranslationSession must be used inside TranslationSessionProvider')
  return ctx
}
