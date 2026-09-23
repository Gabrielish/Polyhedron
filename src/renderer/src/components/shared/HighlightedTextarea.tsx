import { forwardRef, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { renderSource } from '@/utils/renderSource'

interface HighlightedTextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value'> {
  value: string
  containerClassName?: string
  overlayClassName?: string
  highlightQuery?: string
  autoGrow?: boolean
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
      autoGrow = false,
      placeholder,
      ...props
    },
    ref
  ) {
    const [draft, setDraft] = useState(value)
    const [focused, setFocused] = useState(false)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    useEffect(() => {
      if (!focused) setDraft(value)
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
          'relative overflow-hidden rounded-md border border-[#1f2329] bg-[#131518] transition-[box-shadow] focus-within:border-amber-500/60 focus-within:shadow-[0_0_0_3px_rgba(245,158,11,0.18)]',
          containerClassName
        )}
      >
        <div
          aria-hidden="true"
          style={{ color: '#e5e5e5' }}
          className={cn(
            'pointer-events-none absolute inset-0 z-0 overflow-hidden px-2.5 py-2 text-[13px] leading-[1.55] text-neutral-200 whitespace-pre-wrap wrap-break-word',
            overlayClassName
          )}
        >
          {draft ? (
            renderSource(draft, { variant: 'editor', highlightQuery })
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
          placeholder={placeholder}
          style={{
            ...props.style,
            ...(autoGrow ? { height: 'auto', overflow: 'hidden' } : {}),
            color: 'transparent',
            WebkitTextFillColor: 'transparent',
            caretColor: 'var(--color-neutral-200, #e5e5e5)'
          }}
          className={cn(
            'relative z-10 w-full resize-none !bg-transparent px-2.5 py-2 text-[13px] leading-[1.55] !text-transparent caret-neutral-200 placeholder:!text-transparent focus:outline-none',
            className
          )}
        />
      </div>
    )
  }
)
