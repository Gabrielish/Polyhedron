export interface TextMatchOptions {
  matchCase?: boolean
  wholeWord?: boolean
}

const WORD_CHAR = '[\\p{L}\\p{N}_]'
const matcherCache = new Map<string, RegExp>()

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function getTextMatcher(
  query: string,
  options: TextMatchOptions = {},
  extra: { global?: boolean } = {}
): RegExp | null {
  const text = query.trim()
  if (!text) return null
  const key = `${options.matchCase ? 'c' : ''}${options.wholeWord ? 'w' : ''}${extra.global ? 'g' : ''}|${text}`
  const cached = matcherCache.get(key)
  if (cached) {
    cached.lastIndex = 0
    return cached
  }
  const escaped = escapeRegExp(text)
  const pattern = options.wholeWord ? `(?<!${WORD_CHAR})${escaped}(?!${WORD_CHAR})` : escaped
  const matcher = new RegExp(pattern, `${extra.global ? 'g' : ''}${options.matchCase ? '' : 'i'}u`)
  if (matcherCache.size >= 100) {
    const oldest = matcherCache.keys().next().value
    if (oldest !== undefined) matcherCache.delete(oldest)
  }
  matcherCache.set(key, matcher)
  return matcher
}

export function textMatches(query: string, value: string, options: TextMatchOptions = {}): boolean {
  const matcher = getTextMatcher(query, options)
  return matcher ? matcher.test(value) : true
}
