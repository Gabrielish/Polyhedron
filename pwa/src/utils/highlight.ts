import { normalizeSearchText, stripSearchDiacritics } from '../../../src/renderer/src/utils/search'
import type { SearchOptions } from './workspace'
export function matchRanges(text: string, options: SearchOptions): Array<[number, number]> {
  const fold = options.matchCase ? stripSearchDiacritics : normalizeSearchText
  const query = fold(options.query.trim())
  if (!query) return []
  let normalized = ''; let offset = 0
  const starts: number[] = []; const ends: number[] = []
  for (const character of text) { const value = fold(character); for (let i = 0; i < value.length; i++) { starts.push(offset); ends.push(offset + character.length) }; normalized += value; offset += character.length }
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const expression = new RegExp(`${options.exact || options.startsWith ? '^' : ''}${options.wholeWord ? '(?<![\\p{L}\\p{N}_])' : ''}${escaped}${options.wholeWord ? '(?![\\p{L}\\p{N}_])' : ''}${options.exact ? '$' : ''}`, 'gu')
  return [...normalized.matchAll(expression)].map(match => [starts[match.index!], ends[match.index! + match[0].length - 1]])
}
