import { useEffect, useRef, useState, type ReactNode } from 'react'

// Keep the complete catalog/grid in place, but build expensive card contents only
// near the viewport. Once mounted, a card stays mounted so edits and expansions
// aren't lost when scrolling away. One observer per scroll container.
const observers = new WeakMap<
  Element,
  {
    observer: IntersectionObserver
    callbacks: Map<Element, () => void>
  }
>()

function observeCard(element: Element, activate: () => void): () => void {
  const root = element.closest('.polyhedron-scroll')
  if (!root || typeof IntersectionObserver === 'undefined') {
    activate()
    return () => {}
  }
  let shared = observers.get(root)
  if (!shared) {
    const callbacks = new Map<Element, () => void>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          observer.unobserve(entry.target)
          const callback = callbacks.get(entry.target)
          callbacks.delete(entry.target)
          callback?.()
        }
      },
      { root, rootMargin: '600px 0px' }
    )
    shared = { observer, callbacks }
    observers.set(root, shared)
  }
  shared.callbacks.set(element, activate)
  shared.observer.observe(element)
  return () => {
    shared.callbacks.delete(element)
    shared.observer.unobserve(element)
    if (shared.callbacks.size === 0) {
      shared.observer.disconnect()
      observers.delete(root)
    }
  }
}

export function DeferredSpellCard({
  children,
  memoryKey
}: {
  children: () => ReactNode
  memoryKey?: string
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!ref.current || visible) return
    return observeCard(ref.current, () => setVisible(true))
  }, [visible])

  return (
    <div
      ref={ref}
      data-spell-key={memoryKey}
      className="min-w-0"
      style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 220px' }}
      data-deferred-spell-card={visible ? 'ready' : 'pending'}
    >
      {visible ? (
        children()
      ) : (
        <div
          aria-hidden="true"
          className="app-loading-skeleton app-skeleton-card h-[220px] rounded-xl border border-[#252a31] bg-[#131518] p-3 motion-safe:animate-pulse"
        >
          <div className="flex gap-3">
            <div className="app-skeleton-block h-14 w-14 shrink-0 rounded-lg bg-neutral-800/50" />
            <div className="flex-1 space-y-3 pt-1">
              <div className="app-skeleton-block h-3 w-2/3 rounded bg-neutral-800/50" />
              <div className="app-skeleton-block h-2 w-1/3 rounded bg-neutral-800/40" />
            </div>
          </div>
          <div className="app-skeleton-block mt-5 h-16 rounded bg-neutral-800/30" />
        </div>
      )}
    </div>
  )
}
