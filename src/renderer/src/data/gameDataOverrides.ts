import type { ReferenceCatalogEntry } from './gameReference'

export const GAME_DATA_OVERRIDES_STORAGE_KEY = 'polyhedron:game-data:user-overrides:v1'

export interface GameDataOverrides {
  npcFolders: string[]
  npcGroupsByEntry: Record<string, string[]>
  sourceNameByEntry: Record<string, string>
  sourceUidByEntry: Record<string, string>
  hiddenNpcEntries: string[]
  hiddenEntries: string[]
  descriptionSourceNameByEntry: Record<string, string>
  questSectionByEntry: Record<string, string>
  locationSectionByEntry: Record<string, string>
  bookSectionByEntry: Record<string, string>
  contentSourceNamesByEntry: Record<string, string[]>
  itemFolders: string[]
  itemGroupsByEntry: Record<string, string[]>
  characterCreationFolders: string[]
  characterCreationSectionByEntry: Record<string, string>
}

const emptyOverrides = (): GameDataOverrides => ({
  npcFolders: [],
  npcGroupsByEntry: {},
  sourceNameByEntry: {},
  sourceUidByEntry: {},
  hiddenNpcEntries: [],
  hiddenEntries: [],
  descriptionSourceNameByEntry: {},
  questSectionByEntry: {},
  locationSectionByEntry: {},
  bookSectionByEntry: {},
  contentSourceNamesByEntry: {},
  itemFolders: [],
  itemGroupsByEntry: {},
  characterCreationFolders: [],
  characterCreationSectionByEntry: {}
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

export function parseGameDataOverrides(value: unknown): GameDataOverrides {
  if (!isRecord(value)) return emptyOverrides()
  return {
    npcFolders: stringArray(value.npcFolders),
    npcGroupsByEntry: stringArrayRecord(value.npcGroupsByEntry),
    sourceNameByEntry: stringRecord(value.sourceNameByEntry),
    sourceUidByEntry: stringRecord(value.sourceUidByEntry),
    hiddenNpcEntries: stringArray(value.hiddenNpcEntries),
    hiddenEntries: stringArray(value.hiddenEntries),
    descriptionSourceNameByEntry: stringRecord(value.descriptionSourceNameByEntry),
    questSectionByEntry: stringRecord(value.questSectionByEntry),
    locationSectionByEntry: stringRecord(value.locationSectionByEntry),
    bookSectionByEntry: stringRecord(value.bookSectionByEntry),
    contentSourceNamesByEntry: stringArrayRecord(value.contentSourceNamesByEntry),
    itemFolders: stringArray(value.itemFolders),
    itemGroupsByEntry: stringArrayRecord(value.itemGroupsByEntry),
    characterCreationFolders: stringArray(value.characterCreationFolders),
    characterCreationSectionByEntry: stringRecord(value.characterCreationSectionByEntry)
  }
}

export function loadGameDataOverrides(): GameDataOverrides {
  try {
    const stored = window.localStorage.getItem(GAME_DATA_OVERRIDES_STORAGE_KEY)
    return stored ? parseGameDataOverrides(JSON.parse(stored) as unknown) : emptyOverrides()
  } catch {
    return emptyOverrides()
  }
}

export function saveGameDataOverrides(overrides: GameDataOverrides): void {
  try {
    window.localStorage.setItem(GAME_DATA_OVERRIDES_STORAGE_KEY, JSON.stringify(parseGameDataOverrides(overrides)))
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
  const hidden = new Set([...overrides.hiddenNpcEntries, ...overrides.hiddenEntries])
  return entries.flatMap((entry) => {
    const key = referenceEntryKey(entry)
    if (hidden.has(key)) return []

    const sourceName = overrides.sourceNameByEntry[key]
    const sourceUid = overrides.sourceUidByEntry[key]
    const descriptionSourceName = overrides.descriptionSourceNameByEntry[key]
    const contentSourceNames = overrides.contentSourceNamesByEntry[key]
    const npcGroups = overrides.npcGroupsByEntry[key]
    const section = overrides.questSectionByEntry[key]
    const locationSection = overrides.locationSectionByEntry[key]
    const bookSection = overrides.bookSectionByEntry[key]
    const characterCreationSection = overrides.characterCreationSectionByEntry[key]
    if (!sourceName && !sourceUid && !descriptionSourceName && !contentSourceNames && (!npcGroups || entry.category !== 'NPC') && (!section || entry.category !== 'Quest') && (!locationSection || entry.category !== 'Location') && (!bookSection || entry.category !== 'Book') && (!characterCreationSection || entry.category !== 'Character Creation')) return [entry]

    return [{
      ...entry,
      ...(sourceName ? { sourceName } : {}),
      ...(sourceUid ? { sourceUid } : {}),
      ...(descriptionSourceName ? { descriptionSourceName } : {}),
      ...(contentSourceNames?.length ? { contentSourceNames } : {}),
      ...(section && entry.category === 'Quest' ? { section } : {}),
      ...(locationSection && entry.category === 'Location' ? { section: locationSection } : {}),
      ...(bookSection && entry.category === 'Book' ? { section: bookSection } : {}),
      ...(characterCreationSection && entry.category === 'Character Creation' ? { section: characterCreationSection } : {}),
      ...(npcGroups && entry.category === 'NPC' ? { npcGroups } : {})
    }]
  })
}
