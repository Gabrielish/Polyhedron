import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { renderPromptHighlight } from '@/utils/renderPrompt'

interface PromptEditorProps {
  value: string
  onChange: (value: string) => void
  readOnly?: boolean
  error?: boolean
  minHeightClassName?: string
}

// Overlay-highlight prompt editor: a transparent textarea sits above a synced highlight
// layer that paints {VARS} and markdown. Same technique as HighlightedTextarea.
export function PromptEditor({
  value,
  onChange,
  readOnly = false,
  error = false,
  minHeightClassName = 'min-h-[240px]'
}: PromptEditorProps): React.JSX.Element {
  const highlightRef = useRef<HTMLPreElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [focused, setFocused] = useState(false)

  const syncScroll = (): void => {
    if (highlightRef.current && textareaRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft
    }
  }

  const borderState = error
    ? 'border-red-500/60 shadow-[0_0_0_3px_rgba(239,68,68,0.22)]'
    : focused
      ? 'border-amber-500/60 shadow-[0_0_0_3px_rgba(245,158,11,0.18)]'
      : 'border-[#1f2329]'

  return (
    <div className={cn('relative rounded-lg', readOnly && 'opacity-90')}>
      <pre
        ref={highlightRef}
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-0 z-0 m-0 overflow-hidden rounded-lg border bg-[#0f1114] px-3.5 py-3 font-mono text-xs leading-[1.65] break-words whitespace-pre-wrap text-neutral-200 transition-[border-color,box-shadow]',
          minHeightClassName,
          borderState
        )}
      >
        {renderPromptHighlight(value)}
      </pre>
      <textarea
        ref={textareaRef}
        value={value}
        readOnly={readOnly}
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
        onScroll={syncScroll}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={cn(
          'relative z-10 block w-full resize-y rounded-lg border border-transparent bg-transparent px-3.5 py-3 font-mono text-xs leading-[1.65] break-words whitespace-pre-wrap text-transparent caret-neutral-200 focus:outline-none',
          '[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-neutral-900 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-neutral-700 [&:hover::-webkit-scrollbar-thumb]:bg-neutral-600',
          minHeightClassName
        )}
      />
    </div>
  )
}
