import { Outlet } from 'react-router-dom'
import { useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useTranslationSession } from '@/context/TranslationSession'
import { CloudSyncMenu } from './CloudSyncMenu'
import { TitleBar } from './TitleBar'
import { Sidebar } from './Sidebar'

export function MainLayout(): React.JSX.Element {
  const [routeLoading, setRouteLoading] = useState(false)
  const [loadingPathname, setLoadingPathname] = useState<string | null>(null)
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
  const isMacOS = navigator.platform.toLowerCase().includes('mac')

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
      <Sidebar />
      <div className="app-content-shell relative ml-14 flex min-w-0 flex-1 flex-col">
        <TitleBar />
        <div
          className={`pointer-events-none absolute top-1 z-[2000] ${isMacOS ? 'right-2' : 'right-[150px]'}`}
        >
          <div className="pointer-events-auto">
            <CloudSyncMenu />
          </div>
        </div>
        <main className="relative polyhedron-scroll flex min-h-0 flex-1 flex-col overflow-y-auto">
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

function SkeletonHeader({ wide = false }: { wide?: boolean }): React.JSX.Element {
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-[#1f2329] bg-[#0f1114] px-6 py-5">
      <div className="h-7 w-36 rounded-md bg-[#1c2026]" />
      <div className={wide ? 'h-3 w-64 rounded bg-[#181c21]' : 'h-3 w-52 rounded bg-[#181c21]'} />
      <div className="ml-auto h-8 w-28 rounded-md bg-[#181c21]" />
    </div>
  )
}

function ToolbarSkeleton({ count = 3 }: { count?: number }): React.JSX.Element {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-[#1f2329] bg-[#0c0d0f] px-5 py-3">
      <div className="h-9 min-w-0 flex-1 rounded-md border border-[#1f2329] bg-[#131518]" />
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="h-9 w-36 rounded-md bg-[#181c21]" />
      ))}
    </div>
  )
}

function RouteLoadingSkeleton({ pathname }: { pathname: string }): React.JSX.Element {
  const session = useTranslationSession()
  if (pathname === '/' || (pathname === '/translate' && session.phase === 'idle')) {
    return <TranslateSetupSkeleton />
  }
  if (pathname === '/translate') return <TranslateSkeleton />
  if (pathname === '/dictionary') return <DatabaseSkeleton />
  if (pathname === '/consistency') return <ConsistencySkeleton />
  if (pathname === '/dialogues') return <DialogueSkeleton />
  if (pathname === '/game-data') return <GameDataSkeleton />
  if (pathname === '/spells') return <SpellsSkeleton />
  if (pathname === '/settings') return <SettingsSkeleton />
  if (pathname === '/workspace') return <WorkspaceSkeleton />
  return <CompactPageSkeleton />
}

function TranslateSetupSkeleton(): React.JSX.Element {
  return (
    <div className="flex min-h-full flex-1 flex-col animate-pulse bg-[#0c0d0f]">
      <div className="shrink-0 border-b border-[#1f2329] bg-[#101114] px-6 py-4">
        <div className="mx-auto flex max-w-220 items-center gap-5">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl border border-[#6d45d8]/40 bg-[#241b3b]" />
            <div className="space-y-2">
              <div className="h-4 w-40 rounded bg-[#20242a]" />
              <div className="h-3 w-64 rounded bg-[#181c21]" />
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden px-6 pt-7 pb-6">
        <div className="mx-auto flex max-w-220 flex-col gap-3.5">
          <div className="rounded-xl border border-[#1f2329] bg-[#141416] p-6">
            <div className="mb-5 space-y-2">
              <div className="h-5 w-28 rounded bg-[#20242a]" />
              <div className="h-3 w-48 rounded bg-[#181c21]" />
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3.5">
              <div className="space-y-2">
                <div className="h-3 w-14 rounded bg-[#181c21]" />
                <div className="h-12 rounded-lg border border-[#1f2329] bg-[#0f1114]" />
              </div>
              <div className="mb-4 h-5 w-5 rounded bg-[#20242a]" />
              <div className="space-y-2">
                <div className="h-3 w-14 rounded bg-[#181c21]" />
                <div className="h-12 rounded-lg border border-[#241b3b] bg-[#0f1114]" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#1f2329] bg-[#141416] p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="h-5 w-16 rounded bg-[#20242a]" />
                <div className="h-3 w-64 rounded bg-[#181c21]" />
              </div>
              <div className="h-8 w-32 rounded-md bg-[#181c21]" />
            </div>
            <div className="mb-2 h-8 rounded-md border border-[#1f2329] bg-[#0f1114]" />
            <div className="space-y-1.5">
              {Array.from({ length: 2 }).map((_, index) => (
                <div
                  key={index}
                  className="grid h-14 grid-cols-[20px_1fr_140px] items-center gap-3 rounded-lg border border-[#1f2329] bg-[#0f1114] px-3.5"
                >
                  <div className="h-4 w-4 rounded-full border border-[#3b354d]" />
                  <div className="space-y-1.5">
                    <div className="h-3 w-40 rounded bg-[#20242a]" />
                    <div className="h-2.5 w-28 rounded bg-[#181c21]" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="h-2.5 rounded-full bg-[#24202e]" />
                    <div className="ml-auto h-2.5 w-10 rounded bg-[#181c21]" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[#1f2329] bg-[#141416] p-6">
            <div className="mb-4 space-y-2">
              <div className="h-5 w-20 rounded bg-[#20242a]" />
              <div className="h-3 w-56 rounded bg-[#181c21]" />
            </div>
            <div className="h-16 rounded-lg border border-[#1f2329] bg-[#0f1114]" />
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-[#1f2329] bg-[#141416] px-4 py-3">
            <div className="h-3 w-56 rounded bg-[#181c21]" />
            <div className="ml-auto h-9 w-20 rounded-md bg-[#181c21]" />
            <div className="h-9 w-32 rounded-full bg-[#6d45d8]/50" />
          </div>
        </div>
      </div>
    </div>
  )
}

function TranslateSkeleton(): React.JSX.Element {
  return (
    <div className="flex min-h-full flex-1 flex-col animate-pulse bg-[#0f1114]">
      <div className="shrink-0 border-b border-[#1f2329] bg-[#0f1114] px-7 pt-5 pb-4">
        <div className="mb-4 flex items-center gap-3">
          <div className="h-9 w-24 rounded-xl border border-[#1f2329] bg-[#131518]" />
          <div className="h-5 w-5 rounded bg-amber-500/45" />
          <div className="space-y-2">
            <div className="h-5 w-24 rounded bg-[#20242a]" />
            <div className="h-3 w-56 rounded bg-[#181c21]" />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="h-9 w-24 rounded-lg bg-[#181c21]" />
            <div className="h-9 w-9 rounded-lg bg-[#181c21]" />
            <div className="h-9 w-9 rounded-lg bg-[#181c21]" />
            <div className="h-9 w-9 rounded-lg bg-[#181c21]" />
            <div className="h-9 w-24 rounded-full bg-amber-500/45" />
            <div className="h-9 w-28 rounded-full bg-amber-500/45" />
          </div>
        </div>
        <div className="flex items-end gap-8">
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex items-center gap-3.5">
              <div className="h-9 w-12 rounded bg-[#20242a]" />
              <div className="h-6 w-6 rounded bg-[#2a2f37]" />
              <div className="h-9 w-12 rounded bg-amber-500/50" />
            </div>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-7 w-24 rounded-full bg-[#181c21]" />
              ))}
            </div>
          </div>
          <div className="w-64 rounded-2xl border border-[#1f2329] bg-[#131518] p-3.5">
            <div className="mb-3 flex justify-between">
              <div className="h-5 w-24 rounded bg-amber-500/45" />
              <div className="h-5 w-16 rounded bg-[#181c21]" />
            </div>
            <div className="mb-3 h-2 rounded-full bg-[#1d2127]">
              <div className="h-full w-3/4 rounded-full bg-amber-500/70" />
            </div>
            <div className="h-3 w-full rounded bg-[#181c21]" />
          </div>
        </div>
      </div>
      <div className="flex min-h-12 shrink-0 flex-wrap items-center gap-3 border-b border-[#1f2329] bg-[#0c0d0f] px-5 py-1">
        <div className="h-8 w-[clamp(360px,38vw,560px)] min-w-45 max-w-full rounded-md border border-[#1f2329] bg-[#131518]" />
        <div className="flex h-8 w-fit gap-1 rounded-md border border-[#1f2329] bg-[#131518] px-1.5 py-1">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-6 w-6 rounded bg-[#181c21]" />
          ))}
        </div>
        <div className="h-8 w-52 rounded-md bg-[#181c21]" />
        <div className="h-8 w-36 rounded-md bg-[#181c21]" />
        <div className="ml-auto h-8 w-8 rounded-md border border-[#1f2329] bg-[#131518]" />
      </div>
      <div
        className="grid h-8 shrink-0 border-b border-[#1f2329] bg-[#0f1114]"
        style={{ gridTemplateColumns: '56px 1fr 1fr' }}
      >
        <div className="border-r border-[#1f2329]" />
        <div className="flex items-center px-4">
          <div className="h-3 w-24 rounded bg-[#20242a]" />
        </div>
        <div className="flex items-center border-l border-[#1f2329] px-4">
          <div className="h-3 w-28 rounded bg-[#20242a]" />
        </div>
      </div>
      <div className="flex-1 overflow-hidden bg-[#0f1114]">
        {Array.from({ length: 7 }).map((_, index) => (
          <div
            key={index}
            className="grid min-h-32 border-b border-[#1f2329]"
            style={{ gridTemplateColumns: '56px 1fr 1fr' }}
          >
            <div className="flex flex-col items-center gap-3 border-r border-[#1f2329] px-3 py-3">
              <div className="h-4 w-4 rounded bg-[#20242a]" />
              <div className="h-3 w-6 rounded bg-[#181c21]" />
              <div className="mt-auto h-2 w-2 rounded-full bg-[#2b3444]" />
            </div>
            <div className="space-y-3 px-4 py-4">
              <div className="h-4 w-[78%] rounded bg-[#20242a]" />
              <div className="h-4 w-[62%] rounded bg-[#181c21]" />
              <div className="flex gap-2 pt-2">
                <div className="h-5 w-20 rounded bg-amber-500/35" />
                <div className="h-5 w-5 rounded bg-[#181c21]" />
              </div>
            </div>
            <div className="border-l border-[#1f2329] px-4 py-3">
              <div className="h-14 rounded-lg border border-[#1f2329] bg-[#0c0d0f]" />
              <div className="mt-3 flex gap-2">
                <div className="h-6 w-16 rounded-full bg-amber-500/35" />
                <div className="h-6 w-7 rounded-full bg-[#181c21]" />
                <div className="h-6 w-7 rounded-full bg-[#181c21]" />
                <div className="h-6 w-7 rounded-full bg-[#181c21]" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ConsistencySkeleton(): React.JSX.Element {
  return (
    <div className="flex min-h-full flex-1 flex-col animate-pulse bg-[#0f1114]">
      <div className="flex shrink-0 items-center gap-3 border-b border-[#1f2329] bg-[#0f1114] px-6 py-6">
        <div className="h-6 w-6 rounded bg-[#241b3b]" />
        <div className="space-y-2">
          <div className="h-6 w-36 rounded bg-[#20242a]" />
          <div className="h-3 w-64 rounded bg-[#181c21]" />
        </div>
        <div className="ml-auto flex gap-3">
          <div className="h-8 w-24 rounded-full bg-[#241b3b]" />
          <div className="h-8 w-36 rounded-full bg-[#2b1d25]" />
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 border-b border-[#1f2329] bg-[#0c0d0f] px-5 py-3">
        <div className="h-9 w-[clamp(360px,38vw,560px)] min-w-45 max-w-full shrink-0 rounded-md border border-[#1f2329] bg-[#131518]" />
        <div className="h-9 w-44 rounded-md bg-[#181c21]" />
        <div className="h-9 w-44 rounded-md bg-[#181c21]" />
        <div className="h-9 w-44 rounded-md bg-[#181c21]" />
      </div>
      <div className="flex-1 space-y-2 bg-[#0c0d0f] p-5">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="rounded-lg border border-[#1f2329] bg-[#131518] p-4">
            <div className="flex items-start gap-3">
              <div className="mt-1 h-5 w-5 shrink-0 rounded bg-[#241b3b]" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-4">
                  <div className="h-5 w-[42%] rounded bg-[#20242a]" />
                  <div className="flex gap-3">
                    <div className="h-7 w-20 rounded-full bg-[#181c21]" />
                    <div className="h-7 w-32 rounded-full bg-[#241b3b]" />
                  </div>
                </div>
                <div className="mt-2 h-3 w-56 rounded bg-[#181c21]" />
                <div className="mt-4 flex items-center gap-3">
                  <div className="h-8 w-60 rounded-md bg-[#241b3b]" />
                  <div className="h-7 w-8 rounded-md bg-[#181c21]" />
                  <div className="h-7 w-8 rounded-md bg-[#181c21]" />
                  <div className="h-8 w-52 rounded-md bg-[#1b2524]" />
                  <div className="h-7 w-8 rounded-md bg-[#181c21]" />
                  <div className="h-7 w-8 rounded-md bg-[#181c21]" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function DatabaseSkeleton(): React.JSX.Element {
  return (
    <div className="flex min-h-full flex-1 flex-col animate-pulse bg-[#0f1114]">
      <div className="flex shrink-0 items-center justify-between border-b border-[#1f2329] bg-[#0f1114] px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 rounded bg-[#6d45d8]/50" />
          <div className="space-y-2">
            <div className="h-6 w-32 rounded bg-[#20242a]" />
            <div className="h-3 w-40 rounded bg-[#181c21]" />
          </div>
        </div>
        <div className="flex gap-3">
          <div className="h-9 w-28 rounded-lg bg-[#181c21]" />
          <div className="h-9 w-28 rounded-full bg-[#6d45d8]/50" />
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-end gap-2 border-b border-[#1f2329] bg-[#0f1114] px-5 py-4">
        <div className="h-10 w-[clamp(360px,38vw,560px)] min-w-45 max-w-full rounded-md border border-[#1f2329] bg-[#131518]" />
        <div className="h-10 w-32 rounded-md bg-[#181c21]" />
        <div className="h-10 w-44 rounded-md bg-[#181c21]" />
        <div className="h-10 w-36 rounded-md bg-[#181c21]" />
        <div className="h-10 w-36 rounded-md bg-[#181c21]" />
        <div className="ml-auto flex gap-2">
          <div className="h-10 w-20 rounded-md bg-[#181c21]" />
          <div className="h-10 w-20 rounded-md bg-[#181c21]" />
          <div className="h-10 w-32 rounded-full bg-[#6d45d8]/50" />
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-12 border-b border-[#1f2329] bg-[#131518] px-5 py-4">
        <div className="space-y-2">
          <div className="h-3 w-16 rounded bg-[#181c21]" />
          <div className="h-5 w-28 rounded bg-[#6d45d8]/45" />
        </div>
        <div className="space-y-2">
          <div className="h-3 w-12 rounded bg-[#181c21]" />
          <div className="h-5 w-16 rounded bg-[#20242a]" />
        </div>
        <div className="space-y-2">
          <div className="h-3 w-12 rounded bg-[#181c21]" />
          <div className="h-5 w-8 rounded bg-[#20242a]" />
        </div>
        <div className="space-y-2">
          <div className="h-3 w-24 rounded bg-[#181c21]" />
          <div className="h-5 w-8 rounded bg-[#20242a]" />
        </div>
        <div className="ml-auto space-y-2 text-right">
          <div className="ml-auto h-3 w-16 rounded bg-[#181c21]" />
          <div className="ml-auto h-3 w-20 rounded bg-[#20242a]" />
        </div>
      </div>
      <div className="flex-1 overflow-hidden bg-[#0f1114]">
        <div
          className="grid h-12 border-b border-[#1f2329] bg-[#131518]"
          style={{ gridTemplateColumns: '60px 110px 1.2fr 1.2fr 260px 120px 120px' }}
        >
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={index} className="flex items-center px-4">
              <div className="h-3 w-16 rounded bg-[#20242a]" />
            </div>
          ))}
        </div>
        {Array.from({ length: 9 }).map((_, index) => (
          <div
            key={index}
            className="grid h-20 border-b border-[#1f2329]"
            style={{ gridTemplateColumns: '60px 110px 1.2fr 1.2fr 260px 120px 120px' }}
          >
            <div className="p-5">
              <div className="h-4 w-4 rounded bg-[#20242a]" />
            </div>
            <div className="flex items-center px-4">
              <div className="h-3 w-12 rounded bg-[#181c21]" />
            </div>
            <div className="flex items-center px-4">
              <div className="h-4 w-3/5 rounded bg-[#20242a]" />
            </div>
            <div className="flex items-center px-4">
              <div className="h-4 w-3/5 rounded bg-[#20242a]" />
            </div>
            <div className="space-y-2 px-4 py-4">
              <div className="h-7 w-44 rounded-md bg-[#181c21]" />
              <div className="h-2.5 w-32 rounded bg-[#181c21]" />
            </div>
            <div className="flex items-center px-4">
              <div className="h-3 w-12 rounded bg-[#241b3b]" />
            </div>
            <div className="flex items-center justify-end gap-2 px-4">
              <div className="h-8 w-8 rounded-full bg-[#181c21]" />
              <div className="h-8 w-8 rounded-full bg-[#181c21]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function DialogueSkeleton(): React.JSX.Element {
  return (
    <div className="flex min-h-full flex-1 flex-col animate-pulse bg-[#0f1114]">
      <div className="shrink-0 border-b border-[#1f2329] bg-[#0f1114] px-7 py-5">
        <div className="flex items-center gap-4">
          <div className="h-8 w-8 rounded bg-[#241b3b]" />
          <div className="space-y-2">
            <div className="h-6 w-44 rounded bg-[#20242a]" />
            <div className="h-3 w-32 rounded bg-[#181c21]" />
          </div>
          <div className="ml-auto flex items-center gap-4">
            <div className="h-8 w-8 rounded bg-[#181c21]" />
            <div className="h-8 w-8 rounded bg-[#181c21]" />
            <div className="h-9 w-28 rounded-full bg-[#6d45d8]/50" />
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 border-b border-[#1f2329] bg-[#0c0d0f] px-6 py-3">
        <div className="flex h-8 min-w-0 flex-[0_0_calc(39%_-_5px)] items-center gap-2 rounded-md border border-[#1f2329] bg-[#131518] px-3">
          <div className="h-3 w-3 rounded-full bg-[#2a2f37]" />
          <div className="h-3 w-12 rounded bg-[#2a2f37]" />
          <div className="h-4 w-px bg-[#1f2329]" />
          <div className="h-3 flex-1 rounded bg-[#181c21]" />
          <div className="h-4 w-5 rounded bg-[#20242a]" />
          <div className="h-4 w-5 rounded bg-[#20242a]" />
        </div>
        <div className="ml-3 flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border border-[#1f2329] bg-[#131518] px-3">
          <div className="h-3 w-3 rounded-full bg-[#2a2f37]" />
          <div className="h-3 flex-1 rounded bg-[#181c21]" />
          <div className="h-4 w-5 rounded bg-[#20242a]" />
          <div className="h-4 w-5 rounded bg-[#20242a]" />
        </div>
        <div className="h-9 w-44 rounded-lg border border-[#1f2329] bg-[#181c21]" />
        <div className="h-9 w-28 rounded-lg border border-[#1f2329] bg-[#181c21]" />
        <div className="h-9 w-32 rounded-lg border border-[#1f2329] bg-[#181c21]" />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(360px,0.78fr)_minmax(0,1.22fr)] gap-px bg-[#1f2329]">
        <div className="grid min-h-0 grid-rows-[minmax(0,0.32fr)_minmax(0,0.68fr)] bg-[#0c0d0f]">
          <div className="flex-1 space-y-1 overflow-hidden rounded-lg border border-[#1f2329] bg-[#0f1114] p-3">
            {Array.from({ length: 9 }).map((_, index) => (
              <div
                key={index}
                className={`flex h-9 items-center gap-2 rounded-md px-3 ${index === 0 || index === 2 ? 'bg-[#241b3b]' : 'bg-transparent'}`}
              >
                <div className="h-3 w-3 rounded bg-[#20242a]" />
                <div className={`h-3 rounded bg-[#20242a] ${index === 1 ? 'ml-3 w-[62%]' : 'w-[55%]'}`} />
                <div className="ml-auto h-4 w-14 rounded bg-[#2b2119]" />
                <div className="h-4 w-12 rounded bg-[#192a25]" />
              </div>
            ))}
          </div>
          <div className="h-full rounded-lg border border-[#241b3b] bg-[#131518] p-4">
            <div className="mb-5 h-10 rounded-lg bg-[#111521]" />
            <div className="mb-4 h-6 w-3/4 rounded bg-[#202536]" />
            <div className="space-y-3">
              <div className="h-3 w-full rounded bg-[#20242a]" />
              <div className="h-3 w-5/6 rounded bg-[#20242a]" />
              <div className="h-3 w-3/4 rounded bg-[#20242a]" />
            </div>
          </div>
        </div>
        <div className="min-h-0 space-y-4 overflow-hidden bg-[#0c0d0f] p-5">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="rounded-xl border border-[#1f2329] bg-[#131518] p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="h-5 w-14 rounded bg-[#241b3b]" />
                <div className="h-5 w-12 rounded bg-[#2b2119]" />
                <div className="h-5 w-16 rounded bg-[#192a25]" />
              </div>
              {index === 1 && <div className="mb-4 h-10 rounded-lg border border-[#1f2329] bg-[#0c0d0f]" />}
              <div className="grid grid-cols-2 gap-5">
                {Array.from({ length: 2 }).map((__, columnIndex) => (
                  <div key={columnIndex}>
                    <div className="mb-2 h-3 w-28 rounded bg-[#241b3b]" />
                    <div className="h-14 rounded-lg border border-[#1f2329] bg-[#0c0d0f]" />
                    {columnIndex === 1 && (
                      <div className="mt-2 flex gap-2">
                        {Array.from({ length: 7 }).map((___, controlIndex) => (
                          <div key={controlIndex} className="h-5 w-5 rounded-full bg-[#20242a]" />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function GameDataSkeleton(): React.JSX.Element {
  return (
    <div className="flex min-h-full flex-1 flex-col animate-pulse bg-[#0f1114]">
      <div className="flex shrink-0 items-center gap-4 border-b border-[#1f2329] bg-[#0f1114] px-7 py-6">
        <div className="h-8 w-8 rounded bg-[#241b3b]" />
        <div className="space-y-2">
          <div className="h-6 w-36 rounded bg-[#20242a]" />
          <div className="h-3 w-72 rounded bg-[#181c21]" />
        </div>
        <div className="ml-auto flex items-center gap-4">
          <div className="h-9 w-28 rounded-lg border border-[#1f2329] bg-[#131518]" />
          <div className="h-9 w-8 rounded bg-[#181c21]" />
          <div className="h-9 w-8 rounded bg-[#181c21]" />
          <div className="h-9 w-28 rounded-full bg-[#6d45d8]/50" />
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[42%_58%] gap-px bg-[#1f2329]">
        <div className="min-h-0 overflow-hidden bg-[#0c0d0f] p-4">
          <div className="mb-3 flex h-9 items-center gap-2 rounded-md border border-[#1f2329] bg-[#131518] px-3">
            <div className="h-4 w-4 rounded-full bg-[#20242a]" />
            <div className="h-5 w-16 rounded bg-[#241b3b]" />
            <div className="h-4 w-px bg-[#2a2f37]" />
            <div className="h-3 flex-1 rounded bg-[#181c21]" />
            <div className="h-4 w-10 rounded bg-[#20242a]" />
            <div className="h-4 w-10 rounded bg-[#20242a]" />
          </div>
          <div className="space-y-1">
            {Array.from({ length: 16 }).map((_, index) => (
              <div
                key={index}
                className={`flex min-h-[52px] items-start gap-3 rounded-md px-3 py-2 ${index === 0 ? 'bg-[#241b3b]' : 'bg-transparent'}`}
              >
                <div className="mt-1 h-4 w-4 rounded bg-[#20242a]" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="h-4 w-[62%] rounded bg-[#20242a]" />
                  <div className="h-2.5 w-20 rounded bg-[#181c21]" />
                </div>
                <div className="h-5 w-14 rounded bg-[#2b2119]" />
              </div>
            ))}
          </div>
        </div>
        <div className="flex min-h-0 flex-col gap-4 overflow-hidden bg-[#0c0d0f] p-5">
          <div className="shrink-0 rounded-xl border border-[#1f2329] bg-[#131518] p-5">
            <div className="mb-5 flex items-center gap-3">
              <div className="h-7 w-7 rounded bg-[#241b3b]" />
              <div className="h-6 w-56 rounded bg-[#20242a]" />
              <div className="h-6 w-16 rounded-md bg-[#241b3b]" />
            </div>
            <div className="space-y-4">
              {Array.from({ length: 2 }).map((_, index) => (
                <div key={index} className="space-y-3 rounded-lg border border-[#1f2329] bg-[#0c0d0f] p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-28 rounded bg-[#241b3b]" />
                    <div className="h-3 w-4 rounded bg-[#20242a]" />
                  </div>
                  <div className="h-12 rounded-md bg-[#181c21]" />
                  <div className="flex gap-2">
                    {Array.from({ length: 8 }).map((__, controlIndex) => (
                      <div key={controlIndex} className="h-5 w-5 rounded bg-[#20242a]" />
                    ))}
                  </div>
                  <div className="h-16 rounded-md bg-[#181c21]" />
                </div>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1 rounded-xl border border-[#1f2329] bg-[#131518] p-4">
            <div className="flex h-full flex-col gap-5 rounded-lg bg-[#171717] p-6">
              <div className="flex justify-end gap-3">
                <div className="h-3 w-20 rounded bg-[#20242a]" />
                <div className="h-3 w-16 rounded bg-[#181c21]" />
                <div className="h-7 w-44 rounded border border-[#2a2f37] bg-[#1c1c1c]" />
              </div>
              <div className="flex flex-1 items-center justify-center">
                <div className="h-28 w-72 rounded-lg bg-[#20242a]" />
              </div>
              <div className="h-8 w-3/4 rounded bg-[#20242a]" />
              <div className="space-y-2">
                <div className="h-3 w-full rounded bg-[#1c1c1c]" />
                <div className="h-3 w-5/6 rounded bg-[#1c1c1c]" />
                <div className="h-3 w-2/3 rounded bg-[#1c1c1c]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SpellsSkeleton(): React.JSX.Element {
  return (
    <div className="flex min-h-full flex-1 flex-col animate-pulse bg-[#0f1114]">
      <div className="flex shrink-0 items-center gap-4 border-b border-[#1f2329] bg-[#0f1114] px-7 py-6">
        <div className="h-8 w-8 rounded bg-[#6d45d8]/50" />
        <div className="space-y-2">
          <div className="h-6 w-24 rounded bg-[#20242a]" />
          <div className="h-3 w-72 rounded bg-[#181c21]" />
        </div>
        <div className="ml-auto flex items-center gap-4">
          <div className="flex h-9 w-24 gap-1 rounded-lg border border-[#1f2329] bg-[#131518] p-1">
            <div className="flex-1 rounded bg-[#24202f]" />
            <div className="flex-1 rounded bg-[#181c21]" />
          </div>
          <div className="h-9 w-9 rounded bg-[#181c21]" />
          <div className="h-9 w-28 rounded-full bg-[#6d45d8]/50" />
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 border-b border-[#1f2329] bg-[#0c0d0f] px-5 py-3">
        <div className="h-9 min-w-0 flex-1 rounded-md border border-[#1f2329] bg-[#131518]" />
        <div className="h-9 w-9 rounded-md bg-[#181c21]" />
        <div className="h-9 w-44 rounded-md bg-[#181c21]" />
        <div className="h-9 w-44 rounded-md bg-[#181c21]" />
        <div className="h-9 w-28 rounded-md bg-[#181c21]" />
      </div>
      <div className="flex-1 overflow-hidden bg-[#0c0d0f] px-5 py-4">
        <div className="mb-4 flex items-center gap-3">
          <div className="h-4 w-4 rounded bg-[#20242a]" />
          <div className="h-5 w-20 rounded bg-[#20242a]" />
          <div className="h-5 w-12 rounded-full bg-[#241b3b]" />
          <div className="h-3 w-44 rounded bg-[#181c21]" />
          <div className="h-px flex-1 bg-[#1f2329]" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, index) => (
            <div
              key={index}
              className="flex min-h-64 flex-col rounded-xl border border-[#1f2329] bg-[#131518] p-4"
            >
              <div className="mb-4 flex gap-3">
                <div className="h-16 w-16 shrink-0 rounded-lg border border-[#2a2f37] bg-[#1c2026]" />
                <div className="min-w-0 flex-1 space-y-2 pt-1">
                  <div className="h-4 w-[78%] rounded bg-[#20242a]" />
                  <div className="h-3 w-[58%] rounded bg-[#181c21]" />
                  <div className="h-3 w-[88%] rounded bg-[#181c21]" />
                </div>
                <div className="h-7 w-7 rounded-full bg-[#181c21]" />
              </div>
              <div className="space-y-2">
                <div className="h-3 w-full rounded bg-[#181c21]" />
                <div className="h-3 w-[82%] rounded bg-[#181c21]" />
                <div className="h-3 w-[66%] rounded bg-[#181c21]" />
              </div>
              <div className="mt-auto border-t border-[#1f2329] pt-4">
                <div className="mb-3 h-3 w-28 rounded bg-[#20242a]" />
                <div className="flex gap-2">
                  <div className="h-7 w-7 rounded-full bg-[#181c21]" />
                  <div className="h-7 w-7 rounded-full bg-[#2b1d25]" />
                  <div className="h-7 w-7 rounded-full bg-[#2b2a1d]" />
                  <div className="h-7 w-7 rounded-full bg-[#192a25]" />
                  <div className="ml-auto h-7 w-20 rounded-md bg-[#241b3b]" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SettingsSkeleton(): React.JSX.Element {
  return (
    <div className="flex min-h-full flex-1 justify-center animate-pulse bg-[#0c0d0f] p-8">
      <div className="w-full max-w-4xl space-y-6">
        <div className="mb-8 flex items-center gap-3">
          <div className="h-6 w-6 rounded bg-[#6d45d8]/50" />
          <div className="space-y-2">
            <div className="h-7 w-28 rounded bg-[#20242a]" />
            <div className="h-3 w-80 rounded bg-[#181c21]" />
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-[#1f2329] bg-[#131518]">
          <div className="border-b border-[#1f2329] px-6 py-5">
            <div className="h-4 w-36 rounded bg-[#20242a]" />
          </div>
          <div className="flex items-center justify-between gap-4 p-6">
            <div className="space-y-3">
              <div className="h-4 w-36 rounded bg-[#20242a]" />
              <div className="h-3 w-64 rounded bg-[#181c21]" />
            </div>
            <div className="h-10 w-44 rounded-lg bg-[#181c21]" />
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-[#1f2329] bg-[#131518]">
          <div className="border-b border-[#1f2329] px-6 py-5">
            <div className="h-4 w-24 rounded bg-[#20242a]" />
          </div>
          <div className="space-y-5 p-6">
            <div className="h-4 w-3/5 rounded bg-[#181c21]" />
            <div className="grid grid-cols-2 gap-4">
              <div className="h-36 rounded-xl bg-[#1d1a2b]" />
              <div className="h-36 rounded-xl bg-[#181c21]" />
            </div>
            <div className="border-t border-[#1f2329] pt-5">
              <div className="mb-3 h-4 w-28 rounded bg-[#20242a]" />
              <div className="h-3 w-80 rounded bg-[#181c21]" />
              <div className="mt-4 flex gap-3">
                <div className="h-10 w-48 rounded-lg bg-[#181c21]" />
                <div className="h-10 w-12 rounded-lg bg-[#6d45d8]/45" />
                <div className="h-10 w-28 rounded-lg bg-[#181c21]" />
                <div className="h-10 w-20 rounded-lg bg-[#181c21]" />
              </div>
            </div>
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-[#1f2329] bg-[#131518]">
          <div className="border-b border-[#1f2329] px-6 py-5">
            <div className="h-4 w-20 rounded bg-[#20242a]" />
          </div>
          <div className="space-y-5 p-6">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="flex items-center justify-between border-b border-[#1f2329] pb-5 last:border-0 last:pb-0"
              >
                <div className="space-y-2">
                  <div className="h-4 w-44 rounded bg-[#20242a]" />
                  <div className="h-3 w-72 rounded bg-[#181c21]" />
                </div>
                <div className="h-10 w-48 rounded-lg bg-[#181c21]" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function WorkspaceSkeleton(): React.JSX.Element {
  return (
    <div className="flex min-h-full flex-1 justify-center animate-pulse bg-[#0c0d0f] p-8">
      <div className="w-full max-w-4xl space-y-6">
        <div className="mb-8 flex items-center gap-3">
          <div className="h-6 w-6 rounded bg-[#6d45d8]/50" />
          <div className="space-y-2">
            <div className="h-7 w-36 rounded bg-[#20242a]" />
            <div className="h-3 w-96 rounded bg-[#181c21]" />
          </div>
        </div>
        <div className="rounded-xl border border-[#241b3b] bg-[#151122] p-6">
          <div className="flex gap-3">
            <div className="h-5 w-5 rounded bg-[#6d45d8]/50" />
            <div className="space-y-2">
              <div className="h-4 w-80 rounded bg-[#2b2544]" />
              <div className="h-3 w-[620px] max-w-full rounded bg-[#201b32]" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-5">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="rounded-xl border border-[#1f2329] bg-[#131518] p-6">
              <div className="mb-6 flex items-start justify-between">
                <div className="h-7 w-7 rounded bg-[#6d45d8]/50" />
                <div className="h-3 w-12 rounded bg-[#181c21]" />
              </div>
              <div className="mb-3 h-5 w-44 rounded bg-[#20242a]" />
              <div className="mb-7 h-3 w-full rounded bg-[#181c21]" />
              <div className="h-10 w-36 rounded-md bg-[#6d45d8]/50" />
            </div>
          ))}
        </div>
        <div className="border-t border-[#1f2329] pt-6">
          <div className="mb-2 flex items-center gap-3">
            <div className="h-7 w-7 rounded bg-[#6d45d8]/50" />
            <div className="h-7 w-56 rounded bg-[#20242a]" />
          </div>
          <div className="ml-10 h-3 w-96 rounded bg-[#181c21]" />
        </div>
        <div className="rounded-xl border border-[#241b3b] bg-[#151122] p-6">
          <div className="flex gap-3">
            <div className="h-5 w-5 rounded bg-[#6d45d8]/50" />
            <div className="space-y-3 flex-1">
              <div className="h-4 w-36 rounded bg-[#2b2544]" />
              <div className="h-3 w-full rounded bg-[#201b32]" />
              <div className="h-3 w-4/5 rounded bg-[#201b32]" />
            </div>
          </div>
        </div>
        <div className="text-xs">
          <div className="mb-4 h-3 w-64 rounded bg-[#181c21]" />
          <div className="grid grid-cols-2 gap-5">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="rounded-xl border border-[#1f2329] bg-[#131518] p-6">
                <div className="mb-6 flex items-start justify-between">
                  <div className="h-7 w-7 rounded bg-[#6d45d8]/50" />
                  <div className="h-3 w-14 rounded bg-[#181c21]" />
                </div>
                <div className="mb-3 h-5 w-44 rounded bg-[#20242a]" />
                <div className="mb-7 h-3 w-64 rounded bg-[#181c21]" />
                <div className="h-10 w-36 rounded-md bg-[#6d45d8]/50" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function CompactPageSkeleton(): React.JSX.Element {
  return (
    <div className="flex min-h-full flex-1 flex-col animate-pulse bg-[#0f1114]">
      <SkeletonHeader />
      <ToolbarSkeleton count={2} />
      <div className="flex-1 space-y-px bg-[#0f1114] p-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="grid min-h-36 grid-cols-2 gap-px border-b border-[#1f2329] bg-[#1b1f25] p-4"
          >
            <div className="space-y-3 bg-[#0f1114] p-2">
              <div className="h-4 w-28 rounded bg-[#1c2026]" />
              <div className="h-4 w-4/5 rounded bg-[#181c21]" />
              <div className="h-4 w-3/5 rounded bg-[#181c21]" />
            </div>
            <div className="space-y-3 bg-[#0f1114] p-2">
              <div className="h-4 w-24 rounded bg-[#241b3b]" />
              <div className="h-12 w-full rounded-lg border border-[#1f2329] bg-[#0c0d0f]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
