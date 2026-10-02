import { AlertTriangle, FolderPlus, Pencil, Search, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import { cn } from '@/lib/utils'
import type { ModInfo } from '@/types'
import { formatRelativeDate } from '../utils/relativeDate'
import { RenameModModal } from './RenameModModal'
import { ModalShell } from '@/components/shared/ModalShell'

interface ModSelectionCardProps {
  showHeader?: boolean
  showModeToggle?: boolean
  isNewMod: boolean
  selectedMod: string | null
  newModName: string
  mods: ModInfo[]
  filteredMods: ModInfo[]
  modSearch: string
  onExistingMode: () => void
  onNewMode: () => void
  onNewModNameChange: (value: string) => void
  onModSearchChange: (value: string) => void
  onModSelect: (mod: ModInfo) => void
  onModRename: (mod: ModInfo, nextName: string) => Promise<void>
  onModDelete: (mod: ModInfo) => Promise<void>
}

export function ModSelectionCard({
  showHeader = true,
  showModeToggle = true,
  isNewMod,
  selectedMod,
  newModName,
  mods,
  filteredMods,
  modSearch,
  onExistingMode,
  onNewMode,
  onNewModNameChange,
  onModSearchChange,
  onModSelect,
  onModRename,
  onModDelete
}: ModSelectionCardProps): React.JSX.Element {
  const { t, currentLanguage } = useAppTranslation(['translate', 'common'])
  const shouldHighlightNewMode = mods.length === 0 && isNewMod

  return (
    <>
      <div className={cn('flex items-start gap-3', !showHeader && 'relative h-0 justify-end')}>
        {showHeader && (
          <div className="flex-1">
            <h3 className="text-[15px] font-semibold text-neutral-200 tracking-tight m-0">
              {t('setup.modSelection.title')}
            </h3>
            <p className="text-xs text-neutral-500 mt-1 m-0">
              {t('setup.modSelection.description')}
            </p>
          </div>
        )}
        {showModeToggle && (
          <div
            className={cn(
              'relative z-10 flex shrink-0 items-center gap-0.5 rounded-lg border border-[#2a2f37] bg-[#0f1114] p-0.5 text-xs shadow-sm',
              !showHeader && 'absolute right-0 -top-1'
            )}
          >
            <button
              type="button"
              onClick={onExistingMode}
              className={cn(
                'h-6 rounded-md px-3 text-xs cursor-pointer transition-all',
                !isNewMod
                  ? 'bg-[#1f2329] text-neutral-200'
                  : 'bg-transparent text-neutral-500 hover:text-neutral-300'
              )}
            >
              {t('setup.modSelection.existing')}
            </button>
            <button
              type="button"
              onClick={onNewMode}
              className={cn(
                'h-6 rounded-md px-3 text-xs cursor-pointer transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40',
                isNewMod
                  ? 'bg-[#1f2329] text-neutral-200'
                  : 'bg-transparent text-neutral-500 hover:text-neutral-300',
                shouldHighlightNewMode && 'ring-2 ring-amber-500/40'
              )}
            >
              {t('setup.modSelection.new')}
            </button>
          </div>
        )}
      </div>

      {!isNewMod ? (
        <div className="flex flex-col gap-2">
          <div className="relative mt-[21px]">
            <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-neutral-400">
              <Search size={14} strokeWidth={2} />
            </span>
            <input
              className="h-9.5 w-full rounded-md border border-[#1f2329] bg-[#0f1114] pl-9 pr-40 text-sm text-neutral-200 transition-[border-color,background-color,box-shadow] placeholder:text-neutral-600 hover:border-neutral-600 focus:border-amber-500 focus:outline-none focus:shadow-[0_0_0_3px_rgba(245,158,11,0.15)]"
              placeholder={t('setup.modSelection.searchPlaceholder')}
              value={modSearch}
              onChange={(event) => onModSearchChange(event.target.value)}
            />
            {modSearch && (
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onModSearchChange('')}
                aria-label="Clear search"
                className="absolute right-36 top-1/2 -translate-y-1/2 cursor-pointer text-neutral-500 transition-colors hover:text-neutral-200"
              >
                <X size={13} />
              </button>
            )}
            <ModeToggle
              isNewMod={isNewMod}
              shouldHighlightNewMode={shouldHighlightNewMode}
              onExistingMode={onExistingMode}
              onNewMode={onNewMode}
            />
          </div>

          <div className="polyhedron-scroll flex max-h-28 flex-col gap-1.5 overflow-y-auto pr-1">
            {filteredMods.length === 0 ? (
              <p className="text-xs text-neutral-600 py-4 text-center">
                {mods.length === 0
                  ? t('setup.modSelection.noMods')
                  : t('setup.modSelection.noSearchResults')}
              </p>
            ) : (
              filteredMods.map((mod) => (
                <ModOption
                  key={mod.name}
                  mod={mod}
                  selected={selectedMod === mod.name}
                  onSelect={() => onModSelect(mod)}
                  currentLanguage={currentLanguage}
                  onRename={onModRename}
                  onDelete={onModDelete}
                />
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className="relative mt-[21px]">
            <FolderPlus
              size={13}
              strokeWidth={2}
              className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-neutral-400"
            />
            <input
              className="h-9.5 w-full rounded-md border border-[#1f2329] bg-[#0f1114] pl-9 pr-40 text-sm text-neutral-200 transition-[border-color,background-color,box-shadow] placeholder:text-neutral-600 hover:border-neutral-600 focus:border-amber-500 focus:outline-none focus:shadow-[0_0_0_3px_rgba(245,158,11,0.15)]"
              placeholder={t('setup.modSelection.newProjectPlaceholder')}
              value={newModName}
              onChange={(event) => onNewModNameChange(event.target.value)}
              autoFocus={mods.length === 0}
            />
            <ModeToggle
              isNewMod={isNewMod}
              shouldHighlightNewMode={shouldHighlightNewMode}
              onExistingMode={onExistingMode}
              onNewMode={onNewMode}
            />
          </div>
        </div>
      )}
    </>
  )
}

function ModeToggle({
  isNewMod,
  shouldHighlightNewMode,
  onExistingMode,
  onNewMode
}: {
  isNewMod: boolean
  shouldHighlightNewMode: boolean
  onExistingMode: () => void
  onNewMode: () => void
}): React.JSX.Element {
  const { t } = useAppTranslation('translate')
  return (
    <div className="absolute right-1 top-1/2 z-10 flex -translate-y-1/2 items-center gap-0.5 rounded-md border border-[#2a2f37] bg-[#131518] p-0.5 text-xs">
      <button
        type="button"
        onClick={onExistingMode}
        className={cn(
          'h-6 rounded px-2.5 text-[11px] transition-all',
          !isNewMod ? 'bg-[#1f2329] text-neutral-200' : 'text-neutral-500 hover:text-neutral-300'
        )}
      >
        {t('setup.modSelection.existing')}
      </button>
      <button
        type="button"
        onClick={onNewMode}
        className={cn(
          'h-6 rounded px-2.5 text-[11px] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40',
          isNewMod ? 'bg-[#1f2329] text-neutral-200' : 'text-neutral-500 hover:text-neutral-300',
          shouldHighlightNewMode && 'ring-2 ring-amber-500/40'
        )}
      >
        {t('setup.modSelection.new')}
      </button>
    </div>
  )
}

function ModOption({
  mod,
  selected,
  onSelect,
  currentLanguage,
  onRename,
  onDelete
}: {
  mod: ModInfo
  selected: boolean
  onSelect: () => void
  currentLanguage: string
  onRename: (mod: ModInfo, nextName: string) => Promise<void>
  onDelete: (mod: ModInfo) => Promise<void>
}): React.JSX.Element {
  const pct =
    mod.totalStrings > 0 ? Math.min((mod.translatedStrings / mod.totalStrings) * 100, 100) : 0
  const { t } = useAppTranslation('translate')
  const rel = formatRelativeDate(mod.updatedAt, currentLanguage)
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null)
  const [editing, setEditing] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    const close = () => setMenuPosition(null)
    window.addEventListener('polyhedron:close-mod-context-menu', close)
    if (!menuPosition) {
      return () => window.removeEventListener('polyhedron:close-mod-context-menu', close)
    }
    document.addEventListener('click', close)
    return () => {
      document.removeEventListener('click', close)
      window.removeEventListener('polyhedron:close-mod-context-menu', close)
    }
  }, [menuPosition])

  const editName = async () => {
    setEditing(true)
  }

  const deleteProject = () => {
    setDeleteError(null)
    setDeleteOpen(true)
  }

  const confirmDelete = async () => {
    setDeleting(true)
    setDeleteError(null)
    try {
      await onDelete(mod)
      setDeleteOpen(false)
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : 'Unable to delete project.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onSelect}
        onContextMenu={(event) => {
          event.preventDefault()
          event.stopPropagation()
          window.dispatchEvent(new Event('polyhedron:close-mod-context-menu'))
          setMenuPosition({ x: event.clientX, y: event.clientY })
        }}
        className={cn(
          'grid w-full items-center gap-3 rounded-lg border px-3.5 py-3 text-left transition-all',
          'grid-cols-[20px_1fr_140px]',
          selected
            ? 'border-amber-500 bg-amber-400/10'
            : 'border-[#1f2329] bg-[#0f1114] hover:border-neutral-600 hover:bg-neutral-800/40'
        )}
      >
        <div
          className={cn(
            'w-4.5 h-4.5 rounded-full border flex items-center justify-center shrink-0',
            selected ? 'border-amber-400' : 'border-neutral-600'
          )}
        >
          {selected && <div className="w-2 h-2 rounded-full bg-amber-400" />}
        </div>

        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-neutral-200 truncate">{mod.name}</div>
          <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 mt-0.5">
            {mod.totalStrings > 0 && <span>{t('grid.entries', { count: mod.totalStrings })}</span>}
            {mod.totalStrings > 0 && rel && <span>-</span>}
            {rel && <span>{rel}</span>}
          </div>
        </div>

        <div className="mod-progress flex min-w-28 flex-col gap-1.5">
          <div className="mod-progress-track h-2.5 overflow-hidden rounded-full">
            <div
              className="mod-progress-fill h-full rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="text-right font-mono text-[10px] font-semibold tabular-nums text-neutral-500">
            {pct.toFixed(2)}%
          </div>
        </div>
      </button>
      {menuPosition &&
        createPortal(
          <div
            className="fixed z-[9999] w-36 overflow-hidden rounded-lg border border-neutral-600 bg-[#131518] p-1 shadow-2xl"
            style={{ left: menuPosition.x, top: menuPosition.y }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-neutral-300 transition-colors hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
              onClick={() => {
                setMenuPosition(null)
                void editName()
              }}
            >
              <Pencil size={13} /> Edit
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-red-300 transition-colors hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
              onClick={() => {
                setMenuPosition(null)
                deleteProject()
              }}
            >
              <Trash2 size={13} /> Delete
            </button>
          </div>,
          document.body
        )}
      <RenameModModal
        mod={editing ? mod : null}
        onClose={() => setEditing(false)}
        onRename={onRename}
      />
      <ModalShell
        open={deleteOpen}
        title="Delete project"
        description="This action cannot be undone."
        icon={<AlertTriangle size={16} />}
        sizeClassName="max-w-md"
        onClose={() => !deleting && setDeleteOpen(false)}
        footer={
          <button
            type="button"
            onClick={() => void confirmDelete()}
            disabled={deleting}
            className="accent-solid-button inline-flex h-8 items-center rounded-md px-3 text-xs font-semibold text-[color:var(--poly-accent-foreground)] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        }
      >
        <p className="text-sm text-neutral-300">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-neutral-100">{mod.name}</span>?
        </p>
        {deleteError && <p className="mt-3 text-xs text-red-400">{deleteError}</p>}
      </ModalShell>
    </div>
  )
}
