import { Pencil, Search, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { DeleteModConfirm } from '@/components/mods/DeleteModConfirm'
import { RenameModModal } from '@/features/translate/components/RenameModModal'
import { useManageMods } from '@/hooks/useManageMods'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import type { DeleteModResult, ModInfo, ModWithPriority } from '@/types'
import { normalizeSearchText } from '@/utils/search'

export function ManageModsPage(): React.JSX.Element {
  const { t } = useAppTranslation('mods')
  const { mods, loading, refetch } = useManageMods()
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [renameTarget, setRenameTarget] = useState<ModWithPriority | null>(null)
  const query = normalizeSearchText(searchQuery.trim())

  const filteredMods = useMemo(
    () =>
      mods
        .filter((mod) => !query || normalizeSearchText(mod.name).includes(query))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    [mods, query]
  )

  const handleRename = async (mod: ModInfo, nextName: string) => {
    await window.api.mod.rename({ modName: mod.name, nextName })
    await refetch()
    toast.success(`Renamed project to ${nextName}`)
  }

  const handleDeleteConfirmed = (_result: DeleteModResult) => {
    setDeleteTarget(null)
    void refetch()
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-neutral-800/50 px-6 py-4">
        <h2 className="text-sm font-medium text-neutral-200">Manage projects</h2>
        <span className="font-mono text-[11px] text-neutral-600">
          {filteredMods.length} {filteredMods.length === 1 ? 'Project' : 'Projects'}
        </span>
      </header>

      <div className="polyhedron-scroll min-h-0 flex-1 overflow-y-auto p-6">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-neutral-200">All projects</h2>
            <p className="mt-1 text-xs text-neutral-500">
              Manage project names and remove projects you no longer need.
            </p>
          </div>
          <div className="manage-mod-search relative flex h-8 w-56 shrink-0 items-center gap-2 rounded-md border border-[#1f2329] bg-transparent px-3 transition-colors focus-within:border-neutral-600">
            <Search size={13} className="shrink-0 text-neutral-500" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t('searchPlaceholder')}
              className="manage-mod-search-input min-w-0 flex-1 border-0 bg-transparent pr-5 text-sm text-neutral-200 placeholder:text-neutral-600 outline-none focus:border-0 focus:outline-none focus:ring-0"
            />
            {searchQuery && (
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-3 cursor-pointer text-neutral-500 transition-colors hover:text-neutral-200"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-neutral-800/80 bg-[#0f1114]">
          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-neutral-500">Loading projects…</div>
          ) : filteredMods.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-neutral-500">
              {query ? 'No projects match your search.' : 'No projects yet.'}
            </div>
          ) : (
            filteredMods.map((mod) => (
              <div
                key={mod.name}
                className="flex items-center gap-3 border-b border-[#1f2329] px-4 py-3 last:border-b-0 hover:bg-[#131518]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#1f2329] text-xs font-medium text-neutral-400">
                  {mod.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-neutral-200">{mod.name}</p>
                  <p className="text-xs text-neutral-500">
                    {(mod.totalStrings ?? 0).toLocaleString()} entries
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRenameTarget(mod)}
                  title="Edit project name"
                  className="rounded-md p-2 text-neutral-500 transition-colors hover:bg-amber-500/10 hover:text-amber-300"
                >
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(mod.name)}
                  title="Delete project"
                  className="rounded-md p-2 text-neutral-500 transition-colors hover:bg-amber-500/10 hover:text-amber-300"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <RenameModModal
        mod={renameTarget}
        onClose={() => setRenameTarget(null)}
        onRename={handleRename}
      />
      <DeleteModConfirm
        open={deleteTarget != null}
        modName={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirmed={handleDeleteConfirmed}
      />
    </div>
  )
}
