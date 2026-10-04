import type { ReactNode } from 'react'
import { useTranslationSession } from '@/context/TranslationSession'
import { cn } from '@/lib/utils'

function Block({ className }: { className?: string }): React.JSX.Element {
  return <div className={cn('app-skeleton-block h-3 rounded bg-[#20242a]', className)} />
}

function Frame({
  name,
  children,
  className
}: {
  name: string
  children: ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <div
      data-route-skeleton={name}
      role="status"
      aria-label={`Loading ${name}`}
      aria-busy="true"
      className={cn(
        'app-loading-skeleton flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#0c0d0f] motion-safe:animate-pulse',
        className
      )}
    >
      <div aria-hidden="true" className="contents">
        {children}
      </div>
    </div>
  )
}

function Heading({
  actions,
  title = 'w-36',
  subtitle = 'w-64',
  className
}: {
  actions?: ReactNode
  title?: string
  subtitle?: string
  className?: string
}): React.JSX.Element {
  return (
    <div
      className={cn(
        'app-page-header flex shrink-0 flex-wrap items-center gap-3 border-b border-[#1f2329] bg-[#0f1114] px-6 py-5',
        className
      )}
    >
      <Block className="h-5 w-5 shrink-0" />
      <div className="min-w-0 space-y-1.5">
        <Block className={cn('h-5 max-w-full', title)} />
        <Block className={cn('h-3 max-w-full bg-[#181c21]', subtitle)} />
      </div>
      {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

function Icons({ count = 3 }: { count?: number }): React.JSX.Element {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <Block key={i} className="h-8 w-8 shrink-0 rounded-md bg-[#181c21]" />
      ))}
    </>
  )
}

function Save(): React.JSX.Element {
  return <Block className="app-skeleton-action h-8 w-20 shrink-0 rounded-full bg-[#2a2f37]" />
}

function Search({
  scope = false,
  toggles = true,
  className
}: {
  scope?: boolean
  toggles?: boolean
  className?: string
}): React.JSX.Element {
  return (
    <div
      data-skeleton-search
      className={cn(
        'flex h-8 min-w-0 items-center gap-2 rounded-md border border-[#1f2329] bg-[#131518] px-3',
        className
      )}
    >
      <Block className="h-3.5 w-3.5 shrink-0 rounded-full" />
      {scope && (
        <>
          <Block className="h-3 w-16 shrink-0" />
          <Block className="h-2 w-2 shrink-0" />
          <div className="h-4 w-px shrink-0 bg-[#1f2329]" />
        </>
      )}
      <Block className="h-3 min-w-0 flex-1 bg-[#181c21]" />
      {toggles && (
        <>
          <div className="h-4 w-px shrink-0 bg-[#1f2329]" />
          <Block className="h-3 w-3.5 shrink-0" />
          <Block className="h-3 w-3.5 shrink-0" />
        </>
      )}
    </div>
  )
}

function Lines({ count = 2 }: { count?: number }): React.JSX.Element {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }, (_, i) => (
        <Block key={i} className={i % 2 ? 'w-4/5 bg-[#181c21]' : 'w-full bg-[#181c21]'} />
      ))}
    </div>
  )
}

function TranslationControls(): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Block className="h-5 w-14 rounded-full" />
      <Block className="h-5 w-12 rounded-full bg-[#181c21]" />
      <Block className="h-5 w-14 rounded-full bg-[#181c21]" />
      <div className="mx-1 h-4 w-px bg-[#1f2329]" />
      {Array.from({ length: 8 }, (_, i) => (
        <Block key={i} className="h-6 w-6 rounded-full bg-[#181c21]" />
      ))}
    </div>
  )
}

export function DialogueGraphSkeleton(): React.JSX.Element {
  return (
    <div
      className="app-loading-skeleton flex h-full min-h-0 flex-col overflow-hidden bg-[#0c0d0f] p-0"
      aria-label="Loading dialogue graph"
    >
      <div className="flex h-20 shrink-0 items-center justify-between border-b border-[#1f2329] px-7">
        <Block className="h-6 w-8 rounded-md" />
        <Block className="h-7 w-44 rounded-md" />
        <Block className="h-6 w-6 rounded-full" />
      </div>
      <div className="min-h-0 flex-1 space-y-7 overflow-hidden p-7">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Block className="h-9 w-20 rounded-md" />
            <Block className="h-9 w-40 rounded-md" />
            <Block className="h-11 w-72 rounded-md" />
          </div>
          <div className="flex gap-2">
            <Block className="h-9 w-28 rounded-md" />
            <Block className="h-9 w-20 rounded-md" />
            <Block className="h-9 w-24 rounded-md" />
          </div>
          <div className="space-y-2">
            <Block className="h-5 w-full" />
            <Block className="h-5 w-3/4" />
          </div>
        </div>
        <div className="flex gap-2 border-b border-[#1f2329] pb-7">
          <Block className="h-11 w-36 rounded-md" />
          <Block className="h-11 w-24 rounded-md" />
        </div>
        <div className="space-y-5">
          <Block className="h-6 w-64" />
          <div className="space-y-4 rounded-xl border border-[#1f2329] bg-[#131518] p-5">
            <div className="flex items-center justify-between gap-4">
              <Block className="h-5 w-12" />
              <Block className="h-9 w-28 rounded-md" />
            </div>
            <Block className="h-6 w-40" />
            <Block className="h-6 w-4/5" />
            <Block className="h-5 w-3/5" />
          </div>
        </div>
      </div>
    </div>
  )
}

function WikiSkeleton(): React.JSX.Element {
  return (
    <div className="flex h-full min-h-0 flex-col gap-5 overflow-hidden rounded-lg border border-[#1f2329] bg-[#171717] p-4">
      <div className="flex justify-end gap-2">
        <Block className="h-3 w-20" />
        <Block className="h-3 w-16" />
        <Block className="h-6 w-28" />
      </div>
      <Block className="h-8 w-3/4" />
      <div className="grid flex-1 grid-cols-[1fr_0.7fr] gap-4">
        <Lines count={5} />
        <Block className="h-36" />
      </div>
    </div>
  )
}

function TranslateSetupSkeleton(): React.JSX.Element {
  return (
    <Frame name="Translate setup" className="p-8">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <Heading title="w-40" subtitle="w-72" className="mb-8 border-0 bg-transparent p-0" />
        <div className="overflow-hidden rounded-xl border border-neutral-800/80 bg-[#141416]">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800/50 px-6 py-3">
            <Block className="w-36" />
            <Block className="h-9 w-64" />
          </div>
          <div className="grid border-b border-neutral-800/50 lg:grid-cols-2">
            <div className="space-y-5 border-b border-neutral-800/50 p-4 lg:border-b-0 lg:border-r">
              <Block className="w-28" />
              <Lines count={1} />
              {[0, 1].map((i) => (
                <div key={i} className="space-y-2">
                  <Block className="h-2.5 w-20" />
                  <Block className="h-10 w-full" />
                </div>
              ))}
            </div>
            <div className="space-y-4 p-4">
              <Block className="w-20" />
              <Lines count={1} />
              <Search className="w-full" toggles={false} />
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="flex h-14 items-center gap-3 rounded-lg border border-neutral-800 p-3"
                >
                  <Block className="h-4 w-4 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Block className="w-3/4" />
                    <Block className="h-2 w-1/2" />
                  </div>
                  <Block className="h-2 w-20" />
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3 p-4">
            <Block className="w-32" />
            <Lines count={1} />
            <Block className="h-16 w-full border border-neutral-800 bg-[#0f1114]" />
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-neutral-800/50 px-6 py-4">
            <Block className="w-52" />
            <Block className="ml-auto h-8 w-20" />
            <Save />
          </div>
        </div>
      </div>
    </Frame>
  )
}

function TranslateSkeleton(): React.JSX.Element {
  return (
    <Frame name="Translate">
      <div className="editor-header shrink-0 border-b border-[#1f2329] bg-[#0f1114] px-7 pt-5 pb-4">
        <div className="editor-header-top mb-4 flex flex-wrap items-center gap-3">
          <Block className="h-8 w-20" />
          <Block className="h-5 w-5" />
          <div className="min-w-0 space-y-2">
            <Block className="h-5 w-24" />
            <Block className="w-56 max-w-full" />
          </div>
          <div className="editor-header-actions ml-auto flex items-center gap-1.5">
            <Block className="h-7 w-16" />
            <Icons />
            <Save />
          </div>
        </div>
        <div className="editor-header-language-row flex items-end gap-8">
          <div className="editor-header-language-block min-w-0 flex-1">
            <div className="mb-2 flex items-center gap-3.5">
              <Block className="h-8 w-12" />
              <Block className="h-5 w-5" />
              <Block className="h-8 w-12" />
            </div>
            <div className="flex min-h-7 flex-wrap gap-2">
              {Array.from({ length: 6 }, (_, i) => (
                <Block key={i} className="h-6 w-20 rounded-full" />
              ))}
            </div>
          </div>
          <div className="translation-stats flex min-w-95 flex-col gap-2">
            <div className="flex justify-between">
              <Block className="h-6 w-36" />
              <Block className="h-6 w-20" />
            </div>
            <div className="relative h-10 pr-5">
              <Block className="mt-1 h-8 w-full rounded-full" />
              <Block className="absolute top-0 right-0 h-10 w-10 rounded-full" />
            </div>
          </div>
        </div>
      </div>
      <div className="flex min-h-12 shrink-0 flex-wrap items-center gap-3 border-b border-[#1f2329] px-5 py-1">
        <Search scope className="w-[clamp(360px,38vw,560px)] min-w-45 max-w-full" />
        <div className="flex h-8 items-center gap-1 rounded-md border border-[#1f2329] px-1.5">
          {Array.from({ length: 6 }, (_, i) => (
            <Block key={i} className="h-5 w-5" />
          ))}
        </div>
        <Block className="h-8 w-52" />
        <Block className="h-8 w-36" />
        <Block className="ml-auto h-8 w-8" />
      </div>
      <div className="grid h-8 shrink-0 grid-cols-[56px_1fr] border-b border-[#1f2329] min-[900px]:grid-cols-[56px_1fr_1fr]">
        <div className="border-r border-[#1f2329]" />
        {[0, 1].map((i) => (
          <div
            key={i}
            className={cn(
              'items-center px-4',
              i ? 'hidden border-l border-[#1f2329] min-[900px]:flex' : 'flex'
            )}
          >
            <Block className="w-28" />
          </div>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="grid min-h-32 grid-cols-[56px_1fr] border-b border-[#1f2329] min-[900px]:grid-cols-[56px_1fr_1fr]"
          >
            <div className="flex flex-col items-center gap-3 border-r border-[#1f2329] py-3">
              <Block className="h-4 w-4" />
              <Block className="h-2.5 w-6" />
              <Block className="mt-auto h-2 w-2 rounded-full" />
            </div>
            <div className="space-y-3 p-4">
              <Lines />
              <Block className="h-5 w-20" />
              <div className="space-y-2 min-[900px]:hidden">
                <Block className="h-14 border border-[#1f2329] bg-[#131518]" />
                <TranslationControls />
              </div>
            </div>
            <div className="hidden space-y-3 border-l border-[#1f2329] p-3 min-[900px]:block">
              <Block className="h-14 border border-[#1f2329] bg-[#131518]" />
              <TranslationControls />
            </div>
          </div>
        ))}
      </div>
    </Frame>
  )
}

function ConsistencySkeleton(): React.JSX.Element {
  return (
    <Frame name="Consistency">
      <Heading
        className="py-4"
        actions={
          <>
            <Block className="h-6 w-20 rounded-full" />
            <Block className="h-6 w-28 rounded-full" />
          </>
        }
      />
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[#1f2329] px-4 py-2">
        <Search className="w-[clamp(360px,38vw,560px)] min-w-45 max-w-full" />
        {[0, 1, 2].map((i) => (
          <Block key={i} className="h-8 w-44" />
        ))}
      </div>
      <div className="min-h-0 flex-1 space-y-[5px] overflow-hidden p-4">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="rounded-lg border border-[#1f2329] bg-[#131518] p-3">
            <div className="mb-2 flex items-start gap-2">
              <Block className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1 space-y-2">
                <Block className="h-4 w-3/4" />
                <Block className="h-2.5 w-1/2" />
              </div>
              <Block className="h-6 w-20" />
              <Block className="h-6 w-28" />
            </div>
            <div className="flex flex-wrap gap-2">
              {[0, 1].map((j) => (
                <div key={j} className="flex items-center gap-1">
                  <Block className="h-7 w-7" />
                  <Block className="h-7 w-48" />
                  <Block className="h-7 w-7" />
                  <Block className="h-7 w-7" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Frame>
  )
}

export function DialogueNodeLoadingSkeleton(): React.JSX.Element {
  return (
    <div className="app-loading-skeleton space-y-3" aria-hidden="true">
      {[0, 1].map((i) => (
        <div key={i} className="rounded-xl border border-[#1f2329] bg-[#131518] p-4">
          <div className="mb-4 flex items-center gap-2">
            <Block className="h-5 w-14" />
            <div className="mx-1 h-4 w-px bg-[#1f2329]" />
            <Block className="h-5 w-12" />
            <Block className="h-5 w-16" />
          </div>
          {i === 1 && <Block className="mb-4 h-8 border border-[#1f2329] bg-[#0c0d0f]" />}
          <div className="grid gap-3 lg:grid-cols-2">
            {[0, 1].map((col) => (
              <div key={col} className="space-y-2">
                <Block className="w-24" />
                <Block className="h-12 border border-[#1f2329] bg-[#0c0d0f]" />
                {col === 1 && <TranslationControls />}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function DialogueSkeleton(): React.JSX.Element {
  return (
    <Frame name="Dialogue Nodes">
      <div className="shrink-0 border-b border-[#1f2329] bg-[#0f1114] px-6 py-5">
        <Heading
          title="w-36"
          subtitle="w-32"
          className="mb-4 border-0 p-0"
          actions={
            <>
              <Icons count={2} />
              <Save />
            </>
          }
        />
        <div className="flex flex-wrap gap-1.5">
          <div className="flex min-w-0 flex-1 flex-wrap gap-2 sm:min-w-[280px] lg:min-w-[360px]">
            <Search
              scope
              className="w-full lg:w-auto lg:basis-[calc(39%_-_5px)] lg:grow-0 lg:shrink-0"
            />
            <Search className="w-full lg:ml-3 lg:w-auto lg:flex-1" />
            <Block className="h-8 w-36 shrink-0" />
            <Block className="h-8 w-24 shrink-0" />
            <Block className="h-8 w-28 shrink-0" />
          </div>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(360px,0.78fr)_minmax(0,1.22fr)]">
        <div className="contents lg:grid lg:min-h-0 lg:grid-rows-[minmax(0,0.32fr)_minmax(0,0.68fr)] lg:border-r lg:border-[#1f2329]">
          <div className="order-1 min-h-48 overflow-hidden border-b border-[#1f2329] p-3 lg:order-none lg:min-h-0">
            <Block className="mb-2 ml-2 h-2.5 w-36" />
            <div className="space-y-1">
              {Array.from({ length: 8 }, (_, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-2 py-1.5',
                    i > 1 && 'ml-6',
                    i === 2 && 'bg-[#181c21]'
                  )}
                >
                  <Block className="h-3 w-3 shrink-0" />
                  <Block className="h-3 min-w-0 flex-1" />
                  <Block className="h-4 w-14 shrink-0" />
                  <Block className="h-4 w-16 shrink-0" />
                </div>
              ))}
            </div>
          </div>
          <div className="order-3 min-h-[420px] overflow-hidden p-0 lg:order-none lg:min-h-0">
            <DialogueGraphSkeleton />
          </div>
        </div>
        <div className="order-2 min-h-[700px] space-y-3 overflow-hidden p-3 sm:p-5 lg:order-none lg:min-h-0">
          <DialogueNodeLoadingSkeleton />
        </div>
      </div>
    </Frame>
  )
}

function GameDataSkeleton(): React.JSX.Element {
  return (
    <Frame name="Game Data">
      <Heading
        subtitle="w-72"
        actions={
          <>
            <Block className="h-6 w-24" />
            <Icons count={2} />
            <Save />
          </>
        }
      />
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[minmax(280px,0.42fr)_minmax(0,0.58fr)]">
        <div className="flex min-h-[250px] max-h-[46vh] min-w-0 flex-col overflow-hidden border-b border-[#1f2329] p-3 md:min-h-0 md:max-h-none md:border-b-0 md:border-r">
          <Search scope className="mb-2 h-8 w-full" />
          <div className="space-y-1">
            {Array.from({ length: 16 }, (_, i) => (
              <div
                key={i}
                className={cn(
                  'flex h-[52px] items-start gap-3 rounded-md px-3 py-2',
                  i === 0 && 'bg-[#181c21]'
                )}
              >
                <Block className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Block className="h-3.5 w-3/5" />
                    <Block className="h-4 w-14" />
                  </div>
                  <Block className="h-2.5 w-14" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="grid min-h-[680px] min-w-0 grid-rows-[minmax(260px,auto)_minmax(320px,1fr)] overflow-hidden p-3 sm:min-h-[720px] sm:p-4 md:min-h-0 md:grid-rows-[minmax(300px,0.5fr)_minmax(0,0.5fr)]">
          <div className="mb-3 min-h-0 overflow-hidden rounded-lg border border-[#1f2329] bg-[#131518] p-4">
            <div className="mb-2 flex items-center gap-2">
              <Block className="h-4.5 w-4.5" />
              <Block className="h-6 w-48" />
              <Block className="h-5 w-14" />
            </div>
            {[0, 1].map((i) => (
              <div
                key={i}
                className="mb-3 space-y-2 rounded-md border border-[#1f2329] bg-[#0c0d0f] p-2"
              >
                <Block className="h-2.5 w-28" />
                <Lines count={i ? 2 : 1} />
                <div className="flex flex-wrap items-center gap-1.5">
                  <Block className="h-3 w-16" />
                  {Array.from({ length: 10 }, (_, j) => (
                    <Block key={j} className="h-6 w-6 rounded-full" />
                  ))}
                </div>
                <Block className={cn('h-10 border border-[#1f2329] bg-[#131518]', i && 'h-14')} />
              </div>
            ))}
          </div>
          <WikiSkeleton />
        </div>
      </div>
    </Frame>
  )
}

function readSpellsView(): 'cards' | 'list' {
  try {
    return JSON.parse(localStorage.getItem('polyhedron.spells-view') ?? '{}').view === 'list'
      ? 'list'
      : 'cards'
  } catch {
    return 'cards'
  }
}

function SpellsSkeleton(): React.JSX.Element {
  const view = readSpellsView()
  return (
    <Frame name="Spells">
      <Heading
        title="w-20"
        subtitle="w-80"
        actions={
          <>
            <Block className="h-7 w-16" />
            <Icons count={1} />
            <Save />
          </>
        }
      />
      <div className="spells-toolbar flex shrink-0 flex-wrap items-center gap-3 border-b border-[#1f2329] px-5 py-1">
        <Search scope toggles={false} className="w-[clamp(360px,38vw,560px)] min-w-45 max-w-full" />
        <Block className="h-8 w-11" />
        <div className="flex flex-wrap gap-2">
          <Block className="h-8 w-40" />
          <Block className="h-8 w-40" />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden p-4 sm:p-6">
        <div className="mb-3 flex items-center gap-3">
          <Block className="h-3 w-3" />
          <Block className="h-4 w-14" />
          <Block className="h-5 w-10 rounded-full" />
          <Block className="h-2.5 w-24" />
          <div className="h-px flex-1 bg-[#1f2329]" />
        </div>
        <div className="mb-3 flex items-center gap-3 pt-2">
          <Block className="h-3 w-24" />
          <Block className="h-4 w-8 rounded-full" />
          <Block className="h-2.5 w-20" />
          <div className="h-px flex-1 bg-[#1f2329]" />
        </div>
        <div
          data-skeleton-spells-view={view}
          className={cn(
            'grid grid-cols-1 gap-3',
            view === 'cards' && 'sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'
          )}
        >
          {Array.from({ length: 12 }, (_, i) => (
            <div
              key={i}
              className="flex min-h-52 min-w-0 flex-col overflow-hidden rounded-xl border border-[#252a31] bg-[#131518] p-3"
            >
              <div className="mb-3 flex min-w-0 gap-3">
                <Block className="h-14 w-14 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Block className="h-4 w-3/5" />
                    <div className="flex gap-1.5">
                      {[0, 1, 2].map((j) => (
                        <Block key={j} className="h-6 w-6 rounded-full" />
                      ))}
                    </div>
                  </div>
                  <Block className="w-4/5" />
                  <Lines count={2} />
                  <Block className="w-3/4" />
                </div>
              </div>
              {i % 3 === 2 && (
                <div className="mb-3 space-y-2 border-t border-[#1f2329] pt-3">
                  <Block className="h-2.5 w-24" />
                  <Block className="h-2.5 w-20" />
                </div>
              )}
              <div className="mt-auto flex items-center gap-1.5 border-t border-[#1f2329] pt-3">
                {[0, 1, 2, 3].map((j) => (
                  <Block key={j} className="h-5 w-5 rounded-full" />
                ))}
                <Block className="ml-auto h-5 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Frame>
  )
}

function Section({
  children,
  title = 'w-32'
}: {
  children: ReactNode
  title?: string
}): React.JSX.Element {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-800/80 bg-[#141416]">
      <div className="border-b border-neutral-800/50 px-6 py-4">
        <Block className={title} />
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

export function SettingsLoadingSkeleton(): React.JSX.Element {
  return (
    <Frame name="Settings" className="settings-page-shell h-auto min-h-full shrink-0 p-8">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <Heading title="w-28" subtitle="w-72" className="mb-8 border-0 bg-transparent p-0" />
        <Section>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex gap-3">
              <Block className="h-4.5 w-4.5" />
              <div className="space-y-2">
                <Block className="w-32" />
                <Block className="h-2.5 w-64 max-w-full" />
              </div>
            </div>
            <Block className="h-9 w-20" />
          </div>
        </Section>
        <Section title="w-40">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-neutral-800 bg-[#0f1013] p-4">
              <div className="flex items-center gap-3">
                <Block className="h-9 w-9 rounded-full" />
                <div className="space-y-2">
                  <Block className="w-32" />
                  <Block className="h-2.5 w-40" />
                </div>
              </div>
              <Block className="h-9 w-28" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[0, 1].map((i) => (
                <div key={i} className="space-y-2 rounded-lg border border-neutral-800 p-3">
                  <Block className="h-2.5 w-20" />
                  <Block className="w-28" />
                </div>
              ))}
            </div>
            <div className="flex flex-wrap justify-between gap-4 border-t border-neutral-800/70 pt-4">
              <div className="space-y-2">
                <Block className="w-44" />
                <Block className="h-2.5 w-64 max-w-full" />
              </div>
              <Block className="h-8 w-44" />
            </div>
          </div>
        </Section>
        <Section title="w-24">
          <Block className="mb-4 w-52" />
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="space-y-3 rounded-lg border border-neutral-800 bg-[#0f1114] p-3"
              >
                <div className="flex gap-1.5">
                  {[0, 1, 2].map((j) => (
                    <Block key={j} className="h-5 w-5 rounded-full" />
                  ))}
                </div>
                <Block className="w-24" />
                <Block className="h-2.5 w-full" />
              </div>
            ))}
          </div>
          <div className="mt-5 space-y-3 border-t border-neutral-800 pt-5">
            <Block className="w-32" />
            <Block className="h-2.5 w-64" />
            <div className="flex flex-wrap gap-2">
              <Block className="h-10 w-44" />
              <Block className="h-10 w-12" />
              <Block className="h-10 w-20" />
            </div>
          </div>
        </Section>
        <Section title="w-32">
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between gap-4">
                <div className="space-y-2">
                  <Block className="w-40" />
                  <Block className="h-2.5 w-52" />
                </div>
                <Block className={cn('h-6 w-10 rounded-full', i === 0 && 'h-8 w-40 rounded-md')} />
              </div>
            ))}
          </div>
        </Section>
      </div>
    </Frame>
  )
}

function WorkspaceActionCards(): React.JSX.Element {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {[0, 1].map((i) => (
        <div key={i} className="rounded-xl border border-neutral-800/80 bg-[#141416] p-6">
          <div className="mb-4 flex justify-between">
            <Block className="h-6 w-6" />
            <Block className="h-2.5 w-14" />
          </div>
          <Block className="h-4 w-36" />
          <Block className="mt-2 h-2.5 w-full" />
          <Block className="mt-5 h-8 w-36" />
        </div>
      ))}
    </div>
  )
}

function WorkspaceSkeleton({ loaded }: { loaded: boolean }): React.JSX.Element {
  return (
    <Frame name="Workspace" className="h-auto min-h-full shrink-0 p-8">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <Heading subtitle="w-80" className="mb-8 border-0 bg-transparent p-0" />
        <WorkspaceActionCards />
        <div className="flex flex-wrap items-center justify-between gap-6 rounded-xl border border-neutral-800/80 bg-[#141416] p-4">
          <div className="space-y-2">
            <Block className="h-4 w-44" />
            <Block className="h-2.5 w-56" />
          </div>
          {loaded && (
            <div className="flex gap-2">
              <Block className="h-8 w-28" />
              <Block className="h-8 w-20" />
            </div>
          )}
        </div>
        <div className="border-t border-[#1f2329] pt-4">
          <Heading title="w-44" subtitle="w-80" className="mb-8 border-0 bg-transparent p-0" />
          <WorkspaceActionCards />
        </div>
        <div className="border-t border-[#1f2329] pt-4">
          <Heading
            title="w-20"
            subtitle="w-64"
            className="mb-5 border-0 bg-transparent p-0"
            actions={<Block className="h-9 w-56" />}
          />
          <Search className="w-full" toggles={false} />
          <div className="mt-4 rounded-xl border border-neutral-800 p-4">
            <Lines count={3} />
          </div>
        </div>
      </div>
    </Frame>
  )
}

export function RouteLoadingSkeleton({ pathname }: { pathname: string }): React.JSX.Element {
  const session = useTranslationSession()
  if (pathname === '/' || (pathname === '/translate' && session.phase !== 'loaded'))
    return <TranslateSetupSkeleton />
  if (pathname === '/translate' || pathname.startsWith('/translate/entry/'))
    return <TranslateSkeleton />
  if (
    ['/consistency', '/dialogues', '/game-data', '/spells'].includes(pathname) &&
    session.phase !== 'loaded'
  )
    return (
      <Frame name="Reference">
        <div className="flex h-full items-center justify-center p-8">
          <div className="w-80 space-y-4 rounded-xl border border-[#1f2329] bg-[#131518] p-8">
            <Block className="mx-auto h-7 w-7" />
            <Block className="mx-auto h-5 w-32" />
            <Lines />
          </div>
        </div>
      </Frame>
    )
  if (pathname === '/consistency') return <ConsistencySkeleton />
  if (pathname === '/dialogues') return <DialogueSkeleton />
  if (pathname === '/game-data') return <GameDataSkeleton />
  if (pathname === '/spells') return <SpellsSkeleton />
  if (pathname === '/settings') return <SettingsLoadingSkeleton />
  if (pathname === '/workspace') return <WorkspaceSkeleton loaded={session.phase === 'loaded'} />
  return (
    <Frame name="Page">
      <Heading />
      <div className="p-4">
        <Lines count={4} />
      </div>
    </Frame>
  )
}
