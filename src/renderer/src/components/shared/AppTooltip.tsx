import { useId, useState, type ReactNode, type SyntheticEvent } from 'react'
import { createPortal } from 'react-dom'

export function AppTooltip({ label, children }: { label: string; children: ReactNode }): React.JSX.Element {
  const id = useId()
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const show = (event: SyntheticEvent<HTMLSpanElement>): void => {
    const rect = event.currentTarget.getBoundingClientRect()
    setPosition({ top: rect.top - 8, left: rect.left + rect.width / 2 })
  }
  return (
    <span
      className="inline-flex shrink-0 items-center"
      tabIndex={0}
      aria-label={label}
      aria-describedby={position ? id : undefined}
      onMouseEnter={show}
      onMouseLeave={() => setPosition(null)}
      onFocus={show}
      onBlur={() => setPosition(null)}
      onKeyDown={event => { if (event.key === 'Escape') setPosition(null) }}
    >
      {children}
      {position && createPortal(
        <span id={id} role="tooltip" className="pointer-events-none fixed z-[5000] -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-neutral-700 bg-[#131518] px-2 py-1.5 text-[10px] font-medium leading-tight text-neutral-200 shadow-2xl" style={position}>
          {label}
        </span>, document.body
      )}
    </span>
  )
}
