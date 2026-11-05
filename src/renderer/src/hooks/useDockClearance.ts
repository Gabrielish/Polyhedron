import { useLayoutEffect } from 'react'

// Measure the scrollable tail needed to align the last item with the floating dock.
export function useDockClearance(pathname: string, dockHidden = false): void {
  useLayoutEffect(() => {
    const root = document.documentElement
    const shell = document.querySelector('.app-content-shell')
    if (dockHidden) {
      // Keep CSS fallbacks from reintroducing the default dock tail while hidden.
      root.style.setProperty('--app-dock-clearance', '0px')
      return () => root.style.removeProperty('--app-dock-clearance')
    }
    if (!shell) {
      root.style.removeProperty('--app-dock-clearance')
      return
    }
    let frame = 0
    let disposed = false
    const observed = new Set<Element>()
    const update = () => {
      frame = 0
      if (disposed) return
      const dock = document.querySelector('.sidebar-shell')
      const elements = [
        ...(dock ? [dock] : []),
        ...shell.querySelectorAll('.translation-pagination-footer, .dictionary-footer')
      ]
      for (const element of observed) {
        if (!elements.includes(element)) { resize.unobserve(element); observed.delete(element) }
      }
      let top = window.innerHeight
      for (const element of elements) {
        if (!observed.has(element)) { resize.observe(element); observed.add(element) }
        const rect = element.getBoundingClientRect()
        if (root.dataset.theme === 'liquid-glass' && getComputedStyle(element).position === 'fixed' && rect.width > 0 && rect.height > 0) {
          top = Math.min(top, rect.top)
        }
      }
      const clearance = top < window.innerHeight ? Math.ceil(window.innerHeight - top) + 1 : 0
      root.style.setProperty('--app-dock-clearance', `${clearance}px`)
    }
    const schedule = () => {
      if (!disposed && !frame) frame = requestAnimationFrame(update)
    }
    const resize = new ResizeObserver(schedule)
    const content = new MutationObserver(schedule)
    const theme = new MutationObserver(schedule)
    content.observe(shell, { childList: true, subtree: true })
    // The dock is a sibling of the content shell and is remounted after its hide animation.
    if (shell.parentElement) content.observe(shell.parentElement, { childList: true })
    theme.observe(root, { attributes: true, attributeFilter: ['data-theme'] })
    window.addEventListener('resize', schedule)
    window.addEventListener('polyhedron:dock-settled', schedule)
    update()
    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      resize.disconnect()
      content.disconnect()
      theme.disconnect()
      window.removeEventListener('resize', schedule)
      window.removeEventListener('polyhedron:dock-settled', schedule)
      root.style.removeProperty('--app-dock-clearance')
    }
  }, [pathname, dockHidden])
}
