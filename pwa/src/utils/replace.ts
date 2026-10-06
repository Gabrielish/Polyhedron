import type { SyncEntry } from '../sync/workspaceSync'
export function replacementChanges(entries: SyncEntry[], indices: number[], find: string, replacement: string, matchCase: boolean, wholeWord: boolean, firstOnly: boolean): Map<string, Partial<SyncEntry>> {
  const changes = new Map<string, Partial<SyncEntry>>()
  if (!find) return changes
  const escaped = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const expression = new RegExp(wholeWord ? `(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])` : escaped, `${firstOnly ? '' : 'g'}${matchCase ? '' : 'i'}u`)
  for (const index of indices) {
    const entry = entries[index]
    if (!entry) continue
    const target = entry.target.replace(expression, () => replacement)
    if (target !== entry.target) { changes.set(entry.uid, { target, matchType: 'manual' }); if (firstOnly) break }
  }
  return changes
}
