import { Outlet } from 'react-router-dom'
import { useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { ScanSearch } from 'lucide-react'
import { useTranslationSession } from '@/context/TranslationSession'
import { QuickSearchModal } from '@/components/shared/QuickSearchModal'
import { useDockClearance } from '@/hooks/useDockClearance'
import { CloudSyncMenu } from './CloudSyncMenu'
import { TitleBar } from './TitleBar'
import { Sidebar } from './Sidebar'
import { RouteLoadingSkeleton } from './RouteLoadingSkeleton'
import { WhatsNewModal } from '@/components/shared/WhatsNewModal'

export function MainLayout(): React.JSX.Element {
  const session = useTranslationSession()
  const [navigationDockHidden, setNavigationDockHidden] = useState(
    () => localStorage.getItem('polyhedron-navigation-dock-hidden') === 'true'
  )
  const [routeLoading, setRouteLoading] = useState(false)
  const [loadingPathname, setLoadingPathname] = useState<string | null>(null)
  const [quickSearchQuery, setQuickSearchQuery] = useState('')
  const [quickSearchOpen, setQuickSearchOpen] = useState(false)
  const [quickSearchMenu, setQuickSearchMenu] = useState<{ x: number; y: number; query: string } | null>(null)
  const [whatsNewOpen, setWhatsNewOpen] = useState(false)
  const [appVersion, setAppVersion] = useState('')
  useEffect(() => {
    let active = true
    void window.api.app.getVersion().then((version) => {
      if (!active) return
      setAppVersion(version)
      const previousVersion = localStorage.getItem('polyhedron-whats-new-last-version')
      localStorage.setItem('polyhedron-whats-new-last-version', version)
      if (previousVersion !== version) setWhatsNewOpen(true)
    }).catch(() => undefined)
    return () => { active = false }
  }, [])
  useEffect(() => {
    const handleContextMenu = (event: MouseEvent) => {
      const target = event.target
      if (target instanceof Element && target.closest('[role="dialog"], input, textarea, [contenteditable="true"]')) return
      const selectedText = window.getSelection()?.toString().trim()
      if (!selectedText) return
      event.preventDefault()
      setQuickSearchMenu({ x: event.clientX, y: event.clientY, query: selectedText })
    }
    document.addEventListener('contextmenu', handleContextMenu)
    return () => document.removeEventListener('contextmenu', handleContextMenu)
  }, [])
  useEffect(() => {
    localStorage.setItem('polyhedron-navigation-dock-hidden', String(navigationDockHidden))
  }, [navigationDockHidden])
  useEffect(() => {
    const root = document.documentElement
    root.classList.add('polyhedron-scrollbars-auto-hide')
    const timers = new WeakMap<Element, number>()

    const showScrollbar = (event: Event) => {
      const target = event.target
      if (!(target instanceof Element)) return
      target.classList.add('polyhedron-scrollbars-visible')
      const previousTimer = timers.get(target)
      if (previousTimer !== undefined) window.clearTimeout(previousTimer)
      timers.set(
        target,
        window.setTimeout(() => target.classList.remove('polyhedron-scrollbars-visible'), 1500)
      )
    }

    document.addEventListener('scroll', showScrollbar, true)
    return () => {
      document.removeEventListener('scroll', showScrollbar, true)
      root.classList.remove('polyhedron-scrollbars-auto-hide')
    }
  }, [])
  const location = useLocation()
  useDockClearance(location.pathname, navigationDockHidden)
  const isMacOS = navigator.platform.toLowerCase().includes('mac')

  const toggleNavigationDock = () => setNavigationDockHidden((hidden) => !hidden)

  useEffect(() => {
    const handleNavigationStart = (event: Event) => {
      const pathname = (event as CustomEvent<{ pathname?: string }>).detail?.pathname
      if (pathname && pathname === location.pathname) return
      setLoadingPathname(pathname ?? null)
      setRouteLoading(true)
    }
    window.addEventListener('polyhedron:navigation-start', handleNavigationStart)
    return () => window.removeEventListener('polyhedron:navigation-start', handleNavigationStart)
  }, [location.pathname])

  useEffect(() => {
    setRouteLoading(false)
    setLoadingPathname(null)
  }, [location.pathname])

  return (
    <div className="flex h-screen w-screen bg-neutral-950">
      <Sidebar hidden={navigationDockHidden} />
      <div className={`app-content-shell relative flex min-w-0 flex-1 flex-col ${navigationDockHidden ? 'ml-0' : 'ml-14'}`}>
        <TitleBar navigationDockHidden={navigationDockHidden} onToggleNavigationDock={toggleNavigationDock} />
        <div
          className={`pointer-events-none absolute top-1 z-[2000] ${isMacOS ? 'right-2' : 'right-[150px]'}`}
        >
          <div className="pointer-events-auto">
            <CloudSyncMenu />
          </div>
        </div>
        <main className="app-route-viewport relative polyhedron-scroll flex min-h-0 flex-1 flex-col overflow-y-auto">
          {routeLoading ? (
            <RouteLoadingSkeleton pathname={loadingPathname ?? location.pathname} />
          ) : (
            <Outlet context={{ onOpenWhatsNew: () => setWhatsNewOpen(true) }} />
          )}
        </main>
      </div>
      <QuickSearchModal
        open={quickSearchOpen}
        initialQuery={quickSearchQuery}
        entries={session.entries}
        onClose={() => setQuickSearchOpen(false)}
      />
      <WhatsNewModal open={whatsNewOpen} version={appVersion} onClose={() => setWhatsNewOpen(false)} />
      {quickSearchMenu && (
        <div className="fixed inset-0 z-[4500]" onMouseDown={() => setQuickSearchMenu(null)}>
          <div
            role="menu"
            className="fixed z-[4501] w-32 max-w-[calc(100vw-16px)] overflow-hidden rounded-lg border border-neutral-600 bg-[#131518] p-1 shadow-2xl"
            style={{
              left: Math.max(8, Math.min(quickSearchMenu.x, window.innerWidth - 144)),
              top: Math.max(8, Math.min(quickSearchMenu.y, window.innerHeight - 48))
            }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setQuickSearchQuery(quickSearchMenu.query)
                setQuickSearchMenu(null)
                setQuickSearchOpen(true)
              }}
              className="group flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-xs text-neutral-300 transition-colors hover:bg-neutral-800"
            >
              <ScanSearch size={14} className="transition-colors group-hover:text-[var(--color-amber-300)]" />
              Quick Search
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
