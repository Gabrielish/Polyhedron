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
  const queryPattern = query ? new RegExp(`(${query.replace(/[\\^$.*+?()[\]{}|]/g, '\\\\$&')})`, 'ig') : null
  const queryTokens = query.split(/[^\p{L}\p{N}_]+/u).filter((token) => token.length >= 3)
  const tokenPattern = queryTokens.length > 0 ? new RegExp(`(${queryTokens.map((token) => token.replace(/[\\^$.*+?()[\]{}|]/g, '\\\\$&')).join('|')})`, 'ig') : null
  const decodeEntities = (value: string): string => value.replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&amp;/gi, '&')
  const tagHasQuery = (value: string): boolean => query.length > 0 && (decodeEntities(value).toLocaleLowerCase().includes(decodeEntities(query).toLocaleLowerCase()) || queryTokens.some((token) => decodeEntities(value).toLocaleLowerCase().includes(token.toLocaleLowerCase())))
  const highlightText = (value: string, keyPrefix: string): React.ReactNode => {
    if (!queryPattern && !tokenPattern) return value
    const pattern = queryPattern && queryPattern.test(value) ? queryPattern : tokenPattern
    if (!pattern) return value
    return value.split(pattern).map((part, index) => queryTokens.some((token) => part.toLocaleLowerCase() === token.toLocaleLowerCase()) || part.toLocaleLowerCase() === query.toLocaleLowerCase()
      ? <mark key={`${keyPrefix}-${index}`} className="search-text-highlight">{part}</mark>
      : <React.Fragment key={`${keyPrefix}-${index}`}>{part}</React.Fragment>)
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
