import type { ReferenceCatalogEntry } from './gameReference'

const STORAGE_KEY = 'polyhedron:game-data:user-overrides:v1'

export interface GameDataOverrides {
  npcFolders: string[]
  npcGroupsByEntry: Record<string, string[]>
  sourceNameByEntry: Record<string, string>
  sourceUidByEntry: Record<string, string>
  hiddenNpcEntries: string[]
}

const emptyOverrides = (): GameDataOverrides => ({
  npcFolders: [],
  npcGroupsByEntry: {},
  sourceNameByEntry: {},
  sourceUidByEntry: {},
  hiddenNpcEntries: []
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean))]
    : []
}

function stringArrayRecord(value: unknown): Record<string, string[]> {
  if (!isRecord(value)) return {}
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key.trim())
      .map(([key, paths]) => [key, stringArray(paths)])
      .filter(([, paths]) => paths.length > 0)
  )
}

function stringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {}
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => entry[0].trim().length > 0 && typeof entry[1] === 'string' && entry[1].trim().length > 0
    )
  )
}

function parseOverrides(value: unknown): GameDataOverrides {
  if (!isRecord(value)) return emptyOverrides()
  return {
    npcFolders: stringArray(value.npcFolders),
    npcGroupsByEntry: stringArrayRecord(value.npcGroupsByEntry),
    sourceNameByEntry: stringRecord(value.sourceNameByEntry),
    sourceUidByEntry: stringRecord(value.sourceUidByEntry),
    hiddenNpcEntries: stringArray(value.hiddenNpcEntries)
  }
}

export function loadGameDataOverrides(): GameDataOverrides {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored ? parseOverrides(JSON.parse(stored) as unknown) : emptyOverrides()
  } catch {
    return emptyOverrides()
  }
}

export function saveGameDataOverrides(overrides: GameDataOverrides): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parseOverrides(overrides)))
  } catch {
    // Keep the in-memory edits usable if browser storage is unavailable.
  }
}

export function referenceEntryKey(entry: Pick<ReferenceCatalogEntry, 'category' | 'name'>): string {
  return `${entry.category}:${entry.name}`
}

export function mergeGameDataEntries(
  entries: ReferenceCatalogEntry[],
  overrides: GameDataOverrides
): ReferenceCatalogEntry[] {
  const hidden = new Set(overrides.hiddenNpcEntries)
  return entries.flatMap((entry) => {
    const key = referenceEntryKey(entry)
    if (entry.category === 'NPC' && hidden.has(key)) return []

    const sourceName = overrides.sourceNameByEntry[key]
    const sourceUid = overrides.sourceUidByEntry[key]
    const npcGroups = overrides.npcGroupsByEntry[key]
    if (!sourceName && !sourceUid && (!npcGroups || entry.category !== 'NPC')) return [entry]

    return [{
      ...entry,
      ...(sourceName ? { sourceName } : {}),
      ...(sourceUid ? { sourceUid } : {}),
      ...(npcGroups && entry.category === 'NPC' ? { npcGroups } : {})
    }]
  })
}
