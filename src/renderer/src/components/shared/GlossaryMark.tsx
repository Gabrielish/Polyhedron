import { Children, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export function GlossaryMark({ floating, children }: { floating?: boolean; children: ReactNode }): React.JSX.Element {
  const anchor = useRef<HTMLSpanElement>(null)
  const popup = useRef<HTMLSpanElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const parts = Children.toArray(children)
  const tooltip = parts.pop()
  const cancelClose = () => { if (timer.current) clearTimeout(timer.current) }
  const close = () => { cancelClose(); timer.current = setTimeout(() => setOpen(false), 120) }

  useLayoutEffect(() => {
    if (!open || !floating || !anchor.current || !popup.current) return
    const a = anchor.current.getBoundingClientRect(), p = popup.current.getBoundingClientRect()
    const margin = 8
    const below = a.bottom + margin
    const top = below + p.height <= innerHeight - margin ? below : Math.max(margin, a.top - p.height - margin)
    setPosition({ top, left: Math.max(margin, Math.min(a.left, innerWidth - p.width - margin)) })
  }, [open, floating])

  useEffect(() => {
    if (!open || !floating) return
    const hide = (event: Event) => {
      if (event.type === 'scroll' && event.target instanceof Node && popup.current?.contains(event.target)) return
      setOpen(false)
    }
    window.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)
    window.addEventListener('blur', hide)
    return () => {
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('resize', hide)
      window.removeEventListener('blur', hide)
    }
  }, [open, floating])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  return <span ref={anchor} className="term-glossary-mark group/term relative inline text-neutral-100"
    onMouseEnter={floating ? () => { cancelClose(); if (!open) { setPosition(null); setOpen(true) } } : undefined}
    onMouseLeave={floating ? close : undefined}>
    {parts}
    {!floating && tooltip}
    {floating && open && createPortal(
      <span ref={popup} className="floating-glossary-tooltip" role="tooltip"
        onMouseEnter={cancelClose} onMouseLeave={close}
        style={{ position: 'fixed', zIndex: 10000, top: position?.top ?? 0, left: position?.left ?? 0, visibility: position ? 'visible' : 'hidden', maxHeight: 'calc(100vh - 16px)', overflowY: 'auto' }}>
        {tooltip}
      </span>, document.body)}
  </span>
}
