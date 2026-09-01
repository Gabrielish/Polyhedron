import React from 'react'

interface RenderSourceOptions {
  variant?: 'display' | 'editor'
  highlightQuery?: string
}

export function renderSource(
  text: string,
  { variant = 'display', highlightQuery = '' }: RenderSourceOptions = {}
): React.ReactNode {
  const query = highlightQuery.trim()
  // Highlight only the exact literal query; do not underline individual words
  // or tag fragments when the search contains a larger phrase.
  const searchTerms = query.length >= 2 ? [query] : []
  const decodeEntities = (value: string): string => value.replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&amp;/gi, '&')
  const tagHasQuery = (value: string): boolean => query.length >= 2 && decodeEntities(value).toLocaleLowerCase().includes(decodeEntities(query).toLocaleLowerCase())
  const highlightText = (value: string, keyPrefix: string): React.ReactNode => {
    if (searchTerms.length === 0) return value
    const lower = value.toLocaleLowerCase()
    let matchIndex = -1
    let matchLength = 0
    for (const term of searchTerms) {
      const index = lower.indexOf(term.toLocaleLowerCase())
      if (index >= 0 && (matchIndex < 0 || index < matchIndex)) { matchIndex = index; matchLength = term.length }
    }
    if (matchIndex < 0) return value
    return <>{value.slice(0, matchIndex)}<mark className="search-text-highlight">{value.slice(matchIndex, matchIndex + matchLength)}</mark>{highlightText(value.slice(matchIndex + matchLength), `${keyPrefix}-${matchIndex}`)}</>
  }
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  const re = /(<[^>]+>|\{[^}]+\})/g
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={`t${lastIndex}`}>{highlightText(text.slice(lastIndex, match.index), `t${lastIndex}`)}</span>)
    }
    const isTag = match[0].startsWith('<')
    const highlightClass =
      variant === 'editor'
        ? isTag
          ? 'bg-purple-500/14 text-purple-300 rounded-sm'
          : 'bg-amber-500/14 text-amber-400 rounded-sm'
        : isTag
          ? 'bg-purple-500/14 text-purple-300 px-1 py-px rounded-sm text-[0.92em]'
          : 'bg-amber-500/14 text-amber-400 px-1 py-px rounded-sm text-[0.92em]'
    parts.push(
      <span
        key={`m${match.index}`}
        className={`${highlightClass}${tagHasQuery(match[0]) ? ' search-tag-highlight' : ''}`}
      >
        {highlightText(match[0], `m${match.index}`)}
      </span>
    )
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) {
    parts.push(<span key={`t${lastIndex}`}>{highlightText(text.slice(lastIndex), `t${lastIndex}`)}</span>)
  }
  return parts.length > 0 ? parts : text
}
