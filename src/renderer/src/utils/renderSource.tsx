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
  // Compute matches against the complete string so a query can cross a
  // rendered Larian tag boundary (plain text + <LSTag> + plain text).
  const matchRanges: Array<[number, number]> = []
  if (query.length >= 2) {
    const haystack = text.toLocaleLowerCase()
    const needle = query.toLocaleLowerCase()
    let from = 0
    while (from < haystack.length) {
      const index = haystack.indexOf(needle, from)
      if (index < 0) break
      matchRanges.push([index, index + needle.length])
      from = index + needle.length
    }
  }
  const highlightText = (value: string, keyPrefix: string, offset: number): React.ReactNode => {
    const ranges = matchRanges.map(([start, end]) => [Math.max(start, offset), Math.min(end, offset + value.length)] as [number, number]).filter(([start, end]) => end > start)
    if (ranges.length === 0) return value
    const children: React.ReactNode[] = []
    let cursor = 0
    for (const [start, end] of ranges) {
      const localStart = start - offset
      const localEnd = end - offset
      if (localStart > cursor) children.push(<React.Fragment key={`${keyPrefix}-text-${cursor}`}>{value.slice(cursor, localStart)}</React.Fragment>)
      children.push(<mark key={`${keyPrefix}-mark-${localStart}`} className="search-text-highlight">{value.slice(localStart, localEnd)}</mark>)
      cursor = localEnd
    }
    if (cursor < value.length) children.push(<React.Fragment key={`${keyPrefix}-text-${cursor}`}>{value.slice(cursor)}</React.Fragment>)
    return children
  }
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  const re = /(<[^>]+>|\{[^}]+\})/g
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={`t${lastIndex}`}>{highlightText(text.slice(lastIndex, match.index), `t${lastIndex}`, lastIndex)}</span>)
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
        className={`${highlightClass}${matchRanges.some(([start, end]) => end > match!.index && start < match!.index + match![0].length) ? ' search-tag-highlight' : ''}`}
      >
        {highlightText(match[0], `m${match.index}`, match.index)}
      </span>
    )
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) {
    parts.push(<span key={`t${lastIndex}`}>{highlightText(text.slice(lastIndex), `t${lastIndex}`, lastIndex)}</span>)
  }
  return parts.length > 0 ? parts : text
}
