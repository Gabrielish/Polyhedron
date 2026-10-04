import { Boxes } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ThemedSelect } from '@/components/shared/ThemedSelect'
import { ExtractPage } from './ExtractPage'
import { ManageModsPage } from './ManageModsPage'
import { MergeToolPage } from './MergeToolPage'
import { PackagePage } from './PackagePage'

type ModTool = 'manage' | 'merge' | 'extract' | 'package'

const TOOLS: Array<{ id: ModTool; label: string }> = [
  { id: 'manage', label: 'Manage projects' },
  { id: 'merge', label: 'Merge translations' },
  { id: 'extract', label: 'Extract mod' },
  { id: 'package', label: 'Create package' }
]

export function ModsPage({ embedded = false }: { embedded?: boolean }): React.JSX.Element {
  const [activeTool, setActiveTool] = useState<ModTool>('manage')
  const [selectionCount, setSelectionCount] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (selectionCount === 0) return
    const frame = requestAnimationFrame(() => {
      const target = embedded ? rootRef.current : contentRef.current?.lastElementChild
      target?.scrollIntoView({ behavior: 'smooth', block: 'end', inline: 'nearest' })
    })
    return () => cancelAnimationFrame(frame)
  }, [activeTool, embedded, selectionCount])

  return (
    <div
      ref={rootRef}
      className={
        embedded
          ? 'mods-embedded flex min-h-0 flex-col text-neutral-200'
          : 'flex h-full min-h-0 flex-col text-neutral-200'
      }
    >
      <header
        className={`app-page-header shrink-0 pb-5 ${embedded ? 'px-0 pt-0' : 'border-b border-[#1f2329] px-8 pt-7'}`}
      >
        <div className={embedded ? 'w-full' : 'mx-auto w-full max-w-4xl'}>
          <div className="flex items-start justify-between gap-6">
            <div className="flex min-w-0 items-center gap-3">
              <Boxes className="shrink-0 text-amber-400" size={20} />
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold text-neutral-100">Mods</h1>
                <p className="mt-1 text-sm text-neutral-500">
                  Manage, merge, extract and package your mods.
                </p>
              </div>
            </div>
            <ThemedSelect
              value={activeTool || 'manage'}
              onChange={(value) => {
                setActiveTool(value as ModTool)
                setSelectionCount(count => count + 1)
              }}
              options={TOOLS.map(({ id, label }) => ({ value: id, label }))}
              placeholder="Manage projects"
              className="w-56 shrink-0"
              triggerClassName="h-9 border-neutral-700 bg-[#131518] px-3 text-xs text-neutral-200 hover:border-neutral-600"
              menuClassName="border-neutral-700"
            />
          </div>
        </div>
      </header>
      <div
        className={
          embedded
            ? 'overflow-hidden rounded-xl border border-neutral-800/80 bg-[#141416]'
            : 'min-h-0 flex-1 overflow-hidden rounded-xl border border-neutral-800/80 bg-[#141416]'
        }
      >
        <main ref={contentRef} className={embedded ? 'mods-page-main' : 'mods-page-main min-h-0 overflow-y-auto'}>
          {activeTool === 'manage' && <ManageModsPage />}
          {activeTool === 'merge' && <MergeToolPage />}
          {activeTool === 'extract' && <ExtractPage />}
          {activeTool === 'package' && <PackagePage />}
        </main>
      </div>
      {embedded && <div className="mods-bottom-spacer" aria-hidden="true" />}
    </div>
  )
}
