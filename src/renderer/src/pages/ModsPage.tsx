import { Boxes, GitMerge, PackageOpen, Wrench } from 'lucide-react'
import { useState } from 'react'
import { ManageModsPage } from './ManageModsPage'
import { MergeToolPage } from './MergeToolPage'
import { ExtractPage } from './ExtractPage'
import { PackagePage } from './PackagePage'

type ModTool = 'manage' | 'merge' | 'extract' | 'package'

const TOOLS: Array<{ id: ModTool; label: string; icon: typeof Boxes }> = [
  { id: 'manage', label: 'Manage Mods', icon: Boxes },
  { id: 'merge', label: 'Merge translations', icon: GitMerge },
  { id: 'extract', label: 'Extract mod', icon: PackageOpen },
  { id: 'package', label: 'Create package', icon: Wrench }
]

export function ModsPage({ embedded = false }: { embedded?: boolean }): React.JSX.Element {
  const [activeTool, setActiveTool] = useState<ModTool>('manage')
  return (
    <div className={embedded ? 'mods-embedded flex min-h-0 flex-col text-neutral-200' : 'flex h-full min-h-0 flex-col text-neutral-200'}>
      <header className="app-page-header shrink-0 border-b border-[#1f2329] px-8 pt-7 pb-5">
        <div className="mx-auto w-full max-w-4xl">
        <div className="flex items-start gap-3">
          <Boxes className="mt-0.5 text-amber-400" size={24} />
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-neutral-100">Mods</h1>
            <p className="mt-1 text-sm text-neutral-500">Manage, merge, extract and package your mods.</p>
          </div>
        </div>
        <nav className="mt-5 flex flex-wrap gap-2" aria-label="Mod tools">
          {TOOLS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTool(id)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${activeTool === id ? 'border-amber-500/50 bg-amber-500/12 text-amber-300' : 'border-[#2a2f37] bg-[#131518] text-neutral-400 hover:border-neutral-600 hover:text-neutral-200'}`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </nav>
        </div>
      </header>
      <main className={embedded ? 'mods-page-main' : 'mods-page-main min-h-0 flex-1 overflow-y-auto'}>
        {activeTool === 'manage' && <ManageModsPage />}
        {activeTool === 'merge' && <MergeToolPage />}
        {activeTool === 'extract' && <ExtractPage />}
        {activeTool === 'package' && <PackagePage />}
      </main>
    </div>
  )
}
