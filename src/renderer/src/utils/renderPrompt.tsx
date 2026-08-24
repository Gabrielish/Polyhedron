import type { ReactNode } from 'react'
import { REQUIRED_PROMPT_VARS } from '@/types'

const REQUIRED = new Set<string>(REQUIRED_PROMPT_VARS)

// Paints {VARS} (accent if required, danger if unknown) and markdown tokens (headings, bold,
// inline code) — the same overlay-highlight technique used for XML tags in source strings.
export function renderPromptHighlight(text: string): ReactNode {
  const parts: ReactNode[] = []
  const re = /(\{[A-Z_]+\})|(^#{1,6} .*$)|(\*\*[^*]+\*\*)|(`[^`]+`)/gm
  let last = 0
  let key = 0
  let match = re.exec(text)

  while (match !== null) {
    if (match.index > last) {
      parts.push(<span key={`t${key++}`}>{text.slice(last, match.index)}</span>)
    }
    const token = match[0]
    if (match[1]) {
      const name = token.slice(1, -1)
      // No horizontal padding here: the overlay must keep the exact same text metrics as the
      // transparent textarea underneath, or the caret drifts out of position after each token.
      parts.push(
        <span
          key={`v${key++}`}
          className={
            REQUIRED.has(name)
              ? 'rounded-sm bg-amber-500/16 text-amber-400 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.35)]'
              : 'rounded-sm bg-red-500/14 text-red-400 underline decoration-red-500 decoration-wavy'
          }
        >
          {token}
        </span>
      )
    } else {
      parts.push(
        <span key={`m${key++}`} className="text-sky-400">
          {token}
        </span>
      )
    }
    last = match.index + token.length
    match = re.exec(text)
  }

  if (last < text.length) parts.push(<span key={`t${key++}`}>{text.slice(last)}</span>)
  // Trailing newline so the overlay height tracks the textarea's last line.
  parts.push('\n')
  return parts
}
