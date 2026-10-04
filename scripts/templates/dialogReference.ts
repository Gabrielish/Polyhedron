import rawIndex from './dialogReference.generated.json?raw'
type RawIndex = {
  categories: string[]
  files: string[]
  dialogues: string[]
  details: string[]
  entries: Record<string, Array<[number, number, number, string]>>
  nodes: Array<[number, string, string[], string[], number[]]>
}
let index: RawIndex | undefined
function getIndex(): RawIndex {
  return (index ??= JSON.parse(rawIndex) as RawIndex)
}

export type DialogueCategory = string
export type DialogueGroup = {
  category: DialogueCategory
  file: string
  dialogue: string
  node: string
}
export type DialogueNode = { node: string; hashes: string[]; next: string[]; details: string[] }

export type DialogueNodeMetadata = { speaker?: string; category?: string }
const nodeSpeakersCache = new Map<string, Promise<Map<string, DialogueNodeMetadata>>>()
export function loadDialogueNodeSpeakers(
  filename: string
): Promise<Map<string, DialogueNodeMetadata>> {
  const cached = nodeSpeakersCache.get(filename)
  if (cached) return cached
  const request = window.api.dialogue
    .speakers(filename)
    .then((payload) => new Map(Object.entries(payload)))
    .catch(() => new Map<string, DialogueNodeMetadata>())
  nodeSpeakersCache.set(filename, request)
  return request
}

const normalize = (value: string) =>
  value
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase()
const hashText = (value: string) => {
  let high = 0xcbf29ce4
  let low = 0x84222325
  for (const byte of new TextEncoder().encode(value)) {
    low = (low ^ byte) >>> 0
    // FNV prime = 2^40 + 435. Keep two exact uint32 limbs instead of
    // allocating BigInts for every UTF-8 byte; product stays below 2^53.
    const product = low * 435
    high = (Math.imul(high, 435) + Math.floor(product / 0x100000000) + (low << 8)) >>> 0
    low = product >>> 0
  }
  return high.toString(16).padStart(8, '0') + low.toString(16).padStart(8, '0')
}
const groupsByHash = new Map<string, DialogueGroup[]>()
const nodesByDialogue = new Map<string, DialogueNode[]>()
const sourceGroups = new Map<string, DialogueGroup[]>()
let rawNodesByDialogue: Map<string, RawIndex['nodes']> | undefined
export function getDialogueGroups(source: string): DialogueGroup[] {
  const cached = sourceGroups.get(source)
  if (cached) return cached
  const hash = hashText(normalize(source))
  let groups = groupsByHash.get(hash)
  if (!groups) {
    const data = getIndex()
    groups = (data.entries[hash] ?? []).map(([category, file, dialogue, node]) => ({
      category: data.categories[category]!,
      file: data.files[file]!,
      dialogue: data.dialogues[dialogue]!,
      node
    }))
    groupsByHash.set(hash, groups)
  }
  if (sourceGroups.size >= 50000) sourceGroups.delete(sourceGroups.keys().next().value!)
  sourceGroups.set(source, groups)
  return groups
}
export function getDialogueNodes(dialogue: string): DialogueNode[] {
  const cached = nodesByDialogue.get(dialogue)
  if (cached) return cached
  const data = getIndex()
  if (!rawNodesByDialogue) {
    rawNodesByDialogue = new Map()
    for (const row of data.nodes) {
      const name = data.dialogues[row[0]]!
      const list = rawNodesByDialogue.get(name)
      if (list) list.push(row)
      else rawNodesByDialogue.set(name, [row])
    }
  }
  const nodes = (rawNodesByDialogue.get(dialogue) ?? []).map(
    ([, node, hashes, next, detailIds]) => ({
      node,
      hashes,
      next,
      details: detailIds.map((id) => data.details[id]!)
    })
  )
  nodesByDialogue.set(dialogue, nodes)
  return nodes
}
export type DialogueFilter = 'greeting' | 'answer' | 'cinematic' | 'roll' | 'alias'
export type DialogueScope = {
  category?: DialogueCategory
  file?: string
  dialogue?: string
  node?: string
}
export function getDialogueFilterTags(source: string): DialogueFilter[] {
  const value = source.toLocaleLowerCase()
  const tags: DialogueFilter[] = []
  if (/\b(greeting|greet)\b/.test(value)) tags.push('greeting')
  if (/\banswer\b/.test(value)) tags.push('answer')
  if (/cinematic/.test(value)) tags.push('cinematic')
  if (/roll.?result|roll result/.test(value)) tags.push('roll')
  if (/\balias\b/.test(value)) tags.push('alias')
  return tags
}
export function matchesDialogueFilters(source: string, filters: DialogueFilter[]): boolean {
  return (
    filters.length === 0 || filters.some((filter) => getDialogueFilterTags(source).includes(filter))
  )
}
export function matchesDialogueScope(source: string, scope: DialogueScope | null): boolean {
  return (
    !scope ||
    getDialogueGroups(source).some(
      (group) =>
        (!scope.category || group.category === scope.category) &&
        (!scope.file || group.file === scope.file) &&
        (!scope.dialogue || group.dialogue === scope.dialogue) &&
        (!scope.node || group.node === scope.node)
    )
  )
}
