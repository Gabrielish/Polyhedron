import { forwardRef, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { renderSource } from '@/utils/renderSource'
import type { TermGlossaryEntry } from '@/utils/termGlossary'

interface HighlightedTextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value'> {
  value: string
  containerClassName?: string
  overlayClassName?: string
  highlightQuery?: string
  searchHighlight?: 'underline' | 'select'
  termGlossary?: TermGlossaryEntry[]
  autoGrow?: boolean
  focusRing?: boolean
  disableOverlay?: boolean
}

export const HighlightedTextarea = forwardRef<HTMLTextAreaElement, HighlightedTextareaProps>(
  function HighlightedTextarea(
    {
      value,
      onChange,
      onFocus,
      onBlur,
      className,
      containerClassName,
      overlayClassName,
      highlightQuery,
      searchHighlight,
      termGlossary,
      autoGrow = false,
      focusRing = true,
      disableOverlay = false,
      placeholder,
      ...props
    },
    ref
  ) {
    const [draft, setDraft] = useState(value)
    const [focused, setFocused] = useState(false)
    const lastPropValue = useRef(value)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const overlayRef = useRef<HTMLDivElement>(null)

    const syncScroll = () => {
      const textarea = textareaRef.current
      const overlay = overlayRef.current
      if (!textarea || !overlay) return
      overlay.scrollLeft = textarea.scrollLeft
      overlay.scrollTop = textarea.scrollTop
    }

    useEffect(() => {
      if (!focused || value !== lastPropValue.current) setDraft(value)
      lastPropValue.current = value
    }, [value, focused])

    useEffect(() => {
      if (!autoGrow) return
      const textarea = textareaRef.current
      if (textarea) {
        textarea.style.height = 'auto'
        textarea.style.height = `${textarea.scrollHeight}px`
      }
    }, [autoGrow, draft, value])

    return (
      <div
        className={cn(
          'highlighted-textarea-shell relative overflow-hidden rounded-md border border-[#1f2329] bg-[#131518]',
          focusRing &&
            'transition-[box-shadow] focus-within:border-amber-500/60 focus-within:shadow-[0_0_0_3px_rgba(245,158,11,0.18)]',
          containerClassName
        )}
      >
        <div
          ref={overlayRef}
          aria-hidden="true"
          style={{ color: '#e5e5e5' }}
          className={cn(
            'pointer-events-none absolute inset-0 z-0 overflow-hidden px-2.5 py-2 font-sans text-[13px] leading-[1.55] text-neutral-200 whitespace-pre-wrap break-words',
            disableOverlay && 'invisible',
            overlayClassName
          )}
        >
          {draft ? (
            renderSource(draft, {
              variant: 'editor',
              highlightQuery,
              searchHighlight,
              termGlossary,
              whitespaceHighlight: true
            })
          ) : (
            <span className="italic text-neutral-600">{placeholder}</span>
          )}
        </div>

        <textarea
          {...props}
          ref={(node) => {
            textareaRef.current = node
            if (typeof ref === 'function') ref(node)
            else if (ref) ref.current = node
          }}
          value={draft}
          spellCheck={false}
          onFocus={(event) => {
            setFocused(true)
            onFocus?.(event)
          }}
          onBlur={(event) => {
            setFocused(false)
            onBlur?.(event)
          }}
          onChange={(event) => {
            setDraft(event.target.value)
            onChange?.(event)
          }}
          onScroll={syncScroll}
          placeholder={placeholder}
          style={{
            ...props.style,
            ...(autoGrow ? { height: 'auto', overflow: 'hidden' } : {}),
            color: disableOverlay ? 'var(--color-neutral-200, #e5e5e5)' : 'transparent',
            WebkitTextFillColor: disableOverlay
              ? 'var(--color-neutral-200, #e5e5e5)'
              : 'transparent',
            caretColor: 'var(--color-neutral-200, #e5e5e5)'
          }}
          className={cn(
            'relative z-10 box-border w-full resize-none !bg-transparent px-2.5 py-2 font-sans text-[13px] leading-[1.55] caret-neutral-200 focus:outline-none',
            disableOverlay
              ? '!text-neutral-200 placeholder:!text-neutral-600'
              : '!text-transparent placeholder:!text-transparent',
            className
          )}
        />
      </div>
    )
  }
)
