import { Outlet } from 'react-router-dom'
import { useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useDockClearance } from '@/hooks/useDockClearance'
import { CloudSyncMenu } from './CloudSyncMenu'
import { TitleBar } from './TitleBar'
import { Sidebar } from './Sidebar'
import { RouteLoadingSkeleton } from './RouteLoadingSkeleton'

export function MainLayout(): React.JSX.Element {
  const [navigationDockHidden, setNavigationDockHidden] = useState(
    () => localStorage.getItem('polyhedron-navigation-dock-hidden') === 'true'
  )
  const [routeLoading, setRouteLoading] = useState(false)
  const [loadingPathname, setLoadingPathname] = useState<string | null>(null)
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
            <Outlet />
          )}
        </main>
      </div>
    </div>
  )
}
