import { useLayoutEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'

type ScrollPosition = { top: number; anchor?: string; offset?: number }
export type SpellsMemory = {
  values: Map<string, unknown>
  scroll: Map<string, ScrollPosition>
}
const projects = new Map<string, SpellsMemory>()

export function getSpellsViewMemory(key: string): SpellsMemory {
  let memory = projects.get(key)
  if (!memory) {
    memory = { values: new Map(), scroll: new Map() }
    projects.set(key, memory)
    if (projects.size > 4) projects.delete(projects.keys().next().value!)
  }
  return memory
}

export function useSpellsRememberedState<T>(
  memory: SpellsMemory,
  key: string,
  initial: T | (() => T)
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() =>
    memory.values.has(key)
      ? (memory.values.get(key) as T)
      : typeof initial === 'function'
        ? (initial as () => T)()
        : initial
  )
  useLayoutEffect(() => {
    memory.values.set(key, value)
  }, [memory, key, value])
  return [value, setValue]
}

// Restore a visible card, not just a pixel count: deferred cards above it can
// have different heights while their contents are being mounted again.
export function useSpellsRememberedScroll(memory: SpellsMemory, key: string) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const position = memory.scroll.get(key)
    let restoring = Boolean(position)
    const restore = () => {
      if (!position || !restoring) return
      const anchor = [...element.querySelectorAll<HTMLElement>('[data-spell-key]')].find(
        (card) => card.dataset.spellKey === position.anchor
      )
      element.scrollTop = anchor
        ? element.scrollTop +
          anchor.getBoundingClientRect().top -
          element.getBoundingClientRect().top -
          (position.offset ?? 0)
        : position.top
    }
    const stop = () => {
      restoring = false
    }
    restore()
    const observer = new ResizeObserver(restore)
    if (element.firstElementChild) observer.observe(element.firstElementChild)
    for (const event of ['wheel', 'touchstart', 'pointerdown', 'keydown'])
      document.addEventListener(event, stop, { passive: true, capture: true })
    return () => {
      observer.disconnect()
      for (const event of ['wheel', 'touchstart', 'pointerdown', 'keydown'])
        document.removeEventListener(event, stop, true)
      const top = element.getBoundingClientRect().top
      const anchor = [...element.querySelectorAll<HTMLElement>('[data-spell-key]')].find(
        (card) => card.getBoundingClientRect().bottom > top
      )
      memory.scroll.set(key, {
        top: element.scrollTop,
        anchor: anchor?.dataset.spellKey,
        offset: anchor ? anchor.getBoundingClientRect().top - top : undefined
      })
    }
  }, [memory, key])
  return ref
}
