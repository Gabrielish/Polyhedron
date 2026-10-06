import { sourceKey, type SourceRow } from '../utils/workspace'
import type { DialogueItem } from '../utils/dialogue'
type Index = { categories: string[]; files: string[]; dialogues: string[]; entries: Record<string, Array<[number, number, number, string]>> }
let index: Promise<Index> | null = null
const hashes = new Map<string, string>()
const encoder = new TextEncoder()
function hashText(source: string): string {
  const normalized = sourceKey(source)
  const cached = hashes.get(normalized)
  if (cached) return cached
  let hash = 14695981039346656037n
  for (const byte of encoder.encode(normalized)) { hash ^= BigInt(byte); hash = BigInt.asUintN(64, hash * 1099511628211n) }
  const result = hash.toString(16).padStart(16, '0')
  if (hashes.size > 300000) hashes.clear()
  hashes.set(normalized, result)
  return result
}
const scope = self as unknown as { onmessage: ((event: MessageEvent) => void) | null; postMessage: (value: unknown) => void }
scope.onmessage = async event => {
  const { id, rows, url } = event.data as { id: number; rows: SourceRow[]; url: string }
  try {
    if (!index) index = fetch(url).then(response => { if (!response.ok) throw new Error('Dialogue reference could not be loaded.'); return response.json() as Promise<Index> }).catch(error => { index = null; throw error })
    const data = await index
    const items = new Map<string, DialogueItem>()
    const seen = new Map<string, Set<string>>()
    for (const row of rows) {
      if (!row.source.trim()) continue
      for (const [categoryId, fileId, dialogueId, nodeId] of data.entries[hashText(row.source)] ?? []) {
        const category = data.categories[categoryId] ?? 'Global'
        const name = data.dialogues[dialogueId] ?? ''
        const file = data.files[fileId] ?? ''
        const act = category === 'Act 1' ? /AstralPlane|Monastery|UpperCreche|LowerCreche/i.test(file) ? 'Act 1B' : 'Act 1' : category === 'Act 2' ? /Intermezzo/i.test(file) ? 'Act 2B' : 'Act 2' : category === 'Act 3' ? /Act3i|Act3b/i.test(file) ? 'Act 3B' : 'Act 3' : 'Global'
        const item = items.get(name) ?? { act, name, file, nodes: [] }
        const duplicates = seen.get(name) ?? new Set<string>()
        const key = `${nodeId}\0${row.uid}`
        if (!duplicates.has(key)) { item.nodes.push({ id: nodeId, uid: row.uid }); duplicates.add(key) }
        seen.set(name, duplicates); items.set(name, item)
      }
    }
    scope.postMessage({ id, items: [...items.values()].sort((a, b) => a.name.localeCompare(b.name)) })
  } catch (error) { scope.postMessage({ id, error: error instanceof Error ? error.message : 'Could not load dialogues.' }) }
}
