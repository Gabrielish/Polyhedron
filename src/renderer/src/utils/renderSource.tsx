import React from 'react'
import type { TermGlossaryEntry } from './termGlossary'

interface RenderSourceOptions {
  variant?: 'display' | 'editor'
  highlightQuery?: string
  termGlossary?: TermGlossaryEntry[]
}

export function renderSource(
  text: string,
  { variant = 'display', highlightQuery = '', termGlossary = [] }: RenderSourceOptions = {}
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
  const glossaryMatches: Array<{
    start: number
    end: number
    source: string
    translation: string
  }> = []
  for (const term of [...termGlossary].sort((a, b) => b.source.length - a.source.length)) {
    const needle = term.source.trim()
    if (!needle) continue
    const haystack = text.toLocaleLowerCase()
    const lowerNeedle = needle.toLocaleLowerCase()
    let from = 0
    while (from < haystack.length) {
      const index = haystack.indexOf(lowerNeedle, from)
      if (index < 0) break
      const end = index + needle.length
      const isWordCharacter = (character: string | undefined): boolean =>
        Boolean(character && /[\p{L}\p{N}_]/u.test(character))
      // Do not match a glossary term inside another word (e.g. "gain" in
      // "against"). Multi-word terms still work because the boundaries are
      // checked only at the beginning and end of the full expression.
      if (isWordCharacter(text[index - 1]) || isWordCharacter(text[end])) {
        from = index + 1
        continue
      }
      glossaryMatches.push({ start: index, end, source: term.source, translation: term.translation })
      from = end
    }
  }
  // Use only the longest non-overlapping ranges for the underline itself, but
  // keep every match available for the tooltip (e.g. "Gain" + "You gain").
  const termRanges = glossaryMatches.filter((range) => {
    const previous = glossaryMatches.find(
      (candidate) =>
        candidate !== range &&
        candidate.start <= range.start &&
        candidate.end >= range.end &&
        candidate.source.length > range.source.length
    )
    return !previous
  })
  const highlightText = (value: string, keyPrefix: string, offset: number, includeTerms = true): React.ReactNode => {
    const ranges = matchRanges.map(([start, end]) => [Math.max(start, offset), Math.min(end, offset + value.length)] as [number, number]).filter(([start, end]) => end > start)
    const terms = (includeTerms ? termRanges : [])
      .map((term) => ({ ...term, start: Math.max(term.start, offset), end: Math.min(term.end, offset + value.length) }))
      .filter((term) => term.end > term.start)
    if (ranges.length === 0 && terms.length === 0) return value
    const children: React.ReactNode[] = []
    const boundaries = new Set<number>([0, value.length])
    ranges.forEach(([start, end]) => {
      boundaries.add(start - offset)
      boundaries.add(end - offset)
    })
    terms.forEach(({ start, end }) => {
      boundaries.add(start - offset)
      boundaries.add(end - offset)
    })
    const sortedBoundaries = [...boundaries].sort((a, b) => a - b)
    for (let index = 0; index < sortedBoundaries.length - 1; index += 1) {
      const localStart = sortedBoundaries[index]
      const localEnd = sortedBoundaries[index + 1]
      if (localEnd <= localStart) continue
      const absoluteStart = offset + localStart
      const term = termRanges.find(({ start, end }) => absoluteStart >= start && absoluteStart < end)
      const tooltipTerms = glossaryMatches.filter(
        ({ start, end }) => absoluteStart < end && offset + localEnd > start
      )
      const isSearchMatch = ranges.some(([start, end]) => absoluteStart < end && offset + localEnd > start)
      let node: React.ReactNode = value.slice(localStart, localEnd)
      if (isSearchMatch) node = <mark className="search-text-highlight">{node}</mark>
      if (term && tooltipTerms.length > 0) {
        node = (
          <span
            className="term-glossary-mark group/term relative inline text-neutral-100"
          >
            {node}
            <span className="bulk-status-menu term-glossary-tooltip absolute z-[5000] max-w-64 text-left text-xs leading-relaxed text-neutral-300 opacity-0 shadow-2xl transition-opacity duration-500 group-hover/term:opacity-100 group-hover/term:duration-150">
              <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-300/80">
                Glossary
              </span>
              <span className="block whitespace-normal break-words text-neutral-100">
                {tooltipTerms.length === 1
                  ? (
                      <button
                        type="button"
                        className="block w-full cursor-copy text-left text-neutral-100 transition-colors hover:text-white"
                        onClick={(event) => {
                          event.stopPropagation()
                          void navigator.clipboard?.writeText(tooltipTerms[0].translation)
                        }}
                      >
                        {tooltipTerms[0].translation}
                      </button>
                    )
                  : tooltipTerms.map((match, matchIndex) => (
                      <button
                        key={`${match.source}-${match.translation}-${matchIndex}`}
                        type="button"
                        className="block w-full cursor-copy text-left transition-colors hover:text-white"
                        onClick={(event) => {
                          event.stopPropagation()
                          void navigator.clipboard?.writeText(match.translation)
                        }}
                      >
                        <span className="text-neutral-100">{match.source}</span>
                        <span className="mx-1.5 text-neutral-500">→</span>
                        <span className="text-neutral-100">{match.translation}</span>
                      </button>
                    ))}
              </span>
            </span>
          </span>
        )
      }
      children.push(<React.Fragment key={`${keyPrefix}-text-${localStart}`}>{node}</React.Fragment>)
    }
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
        {highlightText(match[0], `m${match.index}`, match.index, false)}
      </span>
    )
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) {
    parts.push(<span key={`t${lastIndex}`}>{highlightText(text.slice(lastIndex), `t${lastIndex}`, lastIndex)}</span>)
  }
  return parts.length > 0 ? parts : text
}
