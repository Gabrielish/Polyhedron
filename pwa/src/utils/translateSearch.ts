import type { SyncEntry } from '../sync/workspaceSync'
import { matcher, type SearchOptions } from './workspace'
export type SortMode = 'default' | 'repeated-desc' | 'repeated-asc' | 'length-asc' | 'length-desc' | 'spaces-asc' | 'spaces-desc'
export type TranslateOptions = SearchOptions & { filter: string; sort: SortMode }
export type SearchResult = { indices: number[]; total: number; translated: number; counts: Record<string, number> }
export function filterTranslations(rows: SyncEntry[], options: TranslateOptions): SearchResult {
  const test = matcher(options)
  const counts = { all: 0, translated: 0, untranslated: 0, tags: 0, 'needs-review': 0 }
  const frequency = new Map<string, number>()
  const indices: number[] = []
  for (let index = 0; index < rows.length; index++) {
    const entry = rows[index]
    const source = entry.source.trim()
    if (source.startsWith('%%%') || (source.startsWith('|') && source.indexOf('|', 1) > 0)) continue
    const translated = !!entry.target.trim()
    const tags = /<[^>]+>|&lt;\/?[A-Za-z]/i.test(entry.source)
    counts.all++; counts[translated ? 'translated' : 'untranslated']++
    if (tags) counts.tags++
    if (entry.needsReview) counts['needs-review']++
    if (options.sort.startsWith('repeated')) frequency.set(entry.source, (frequency.get(entry.source) ?? 0) + 1)
    if (options.filter === 'translated' && !translated || options.filter === 'untranslated' && translated || options.filter === 'tags' && !tags || options.filter === 'needs-review' && !entry.needsReview) continue
    const fields = options.scope === 'source' ? [entry.source] : options.scope === 'target' ? [entry.target] : [entry.source, entry.target, entry.uid]
    if (fields.some(test)) indices.push(index)
  }
  if (options.sort !== 'default') {
    const spaces = (text: string) => (text.match(/^\s*/)?.[0].length ?? 0) + (text.match(/\s*$/)?.[0].length ?? 0)
    const rank = (entry: SyncEntry) => options.sort.startsWith('repeated') ? frequency.get(entry.source) ?? 0 : options.sort.startsWith('length') ? entry.source.length : spaces(entry.source) + spaces(entry.target)
    const ranks = new Map(indices.map(index => [index, rank(rows[index])]))
    const direction = options.sort.endsWith('desc') ? -1 : 1
    indices.sort((a, b) => direction * (ranks.get(a)! - ranks.get(b)!) || a - b)
  }
  return { indices, total: counts.all, translated: counts.translated, counts }
}
