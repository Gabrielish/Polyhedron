import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Boxes, Info, Search } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { DeleteModConfirm } from '@/components/mods/DeleteModConfirm'
import { FallbackModRow } from '@/components/mods/FallbackModRow'
import { ModListEmpty } from '@/components/mods/ModListEmpty'
import { PriorityModRow } from '@/components/mods/PriorityModRow'
import { useManageMods } from '@/hooks/useManageMods'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import type { DeleteModResult } from '@/types'

const ROW_HEIGHT = 56

export function ManageModsPage(): React.JSX.Element {
  const { t } = useAppTranslation('mods')
  const { mods, loading, refetch, promote, demote, moveUp, moveDown, setPosition, reorder } = useManageMods()

  const [searchQuery, setSearchQuery] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const query = searchQuery.trim().toLowerCase()

  const prioritized = useMemo(
    () =>
      mods.filter((m) => m.priority != null).sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0)),
    [mods]
  )

  const fallback = useMemo(
    () =>
      mods
        .filter((m) => m.priority == null)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    [mods]
  )

  const prioritizedFiltered = useMemo(
    () => prioritized.filter((m) => !query || m.name.toLowerCase().includes(query)),
    [prioritized, query]
  )

  const fallbackFiltered = useMemo(
    () => fallback.filter((m) => !query || m.name.toLowerCase().includes(query)),
    [fallback, query]
  )

  // - dnd-kit sensors with a 4px activation threshold to avoid accidental drags
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = prioritized.findIndex((m) => m.name === active.id)
    const newIndex = prioritized.findIndex((m) => m.name === over.id)
    const next = arrayMove(prioritized, oldIndex, newIndex)
    void reorder(next.map((m) => m.name))
  }

  // - priority section scroll ref + virtualizer
  const priorityScrollRef = useRef<HTMLDivElement>(null)
  const priorityVirtualizer = useVirtualizer({
    count: prioritizedFiltered.length,
    getScrollElement: () => priorityScrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5
  })

  // - fallback section scroll ref + virtualizer
  const fallbackScrollRef = useRef<HTMLDivElement>(null)
  const fallbackVirtualizer = useVirtualizer({
    count: fallbackFiltered.length,
    getScrollElement: () => fallbackScrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5
  })

  const prioritySectionHeight = Math.max(160, Math.min(prioritized.length * ROW_HEIGHT, 360))

  const handleDeleteConfirmed = (_result: DeleteModResult) => {
    setDeleteTarget(null)
    void refetch()
  }

  const isSearchActive = query.length > 0

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0f1114]">
      {/* header */}
      <header className="flex items-center justify-between border-b border-[#1f2329] px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Boxes size={18} className="text-amber-500" />
            <span className="text-base font-semibold text-neutral-200">{t('title')}</span>
          </div>
          <span className="text-sm text-neutral-500">{t('subtitle')}</span>
        </div>

        <div className="flex h-8 w-56 items-center gap-2 rounded-md border border-[#1f2329] bg-[#131518] px-3 focus-within:border-amber-500/50">
          <Search size={13} className="shrink-0 text-neutral-500" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t('searchPlaceholder')}
            className="min-w-0 flex-1 bg-transparent text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none"
          />
        </div>
      </header>

      {/* info banner */}
      <div className="mx-5 mt-4 flex gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
        <Info size={16} className="mt-0.5 shrink-0 text-amber-500" />
        <div className="text-sm">
          <p className="font-semibold text-amber-400">{t('priority.infoTitle')}</p>
          <p className="mt-0.5 text-neutral-400">{t('priority.infoBody')}</p>
        </div>
      </div>

      {/* content */}
      <div className="icosa-scroll flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
        {/* priority section */}
        <section className="flex flex-col">
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-amber-500">
              {t('priority.heading')} &mdash; {prioritized.length} mods
            </h2>
            {query && prioritizedFiltered.length !== prioritized.length && (
              <span className="text-xs text-neutral-500">
                ({prioritizedFiltered.length} matching)
              </span>
            )}
          </div>

          {loading ? (
            <div className="rounded-lg border border-[#1f2329] bg-[#131518] px-4 py-6 text-center text-sm text-neutral-500">
              &hellip;
            </div>
          ) : (
            <div
              className="overflow-hidden rounded-lg border border-[#1f2329] bg-[#0c0d0f]"
              style={{ maxHeight: `${prioritySectionHeight}px` }}
            >
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={prioritized.map((m) => m.name)}
                  strategy={verticalListSortingStrategy}
                >
                  <div ref={priorityScrollRef} className="icosa-scroll h-full overflow-y-auto">
                    {prioritizedFiltered.length === 0 ? (
                      <ModListEmpty message={t('priority.empty')} />
                    ) : (
                      <div
                        style={{ height: priorityVirtualizer.getTotalSize(), position: 'relative' }}
                      >
                        {priorityVirtualizer.getVirtualItems().map((virtualItem) => {
                          const mod = prioritizedFiltered[virtualItem.index]
                          return (
                            <div
                              key={mod.name}
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                transform: `translateY(${virtualItem.start}px)`
                              }}
                            >
                              <PriorityModRow
                                mod={mod}
                                index={virtualItem.index}
                                total={prioritizedFiltered.length}
                                onMoveUp={() => moveUp(mod.name)}
                                onMoveDown={() => moveDown(mod.name)}
                                onSetPosition={(pos) => setPosition(mod.name, pos)}
                                onDemote={() => demote(mod.name)}
                                onDelete={() => setDeleteTarget(mod.name)}
                                isSearchActive={isSearchActive}
                              />
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}
        </section>

        {/* fallback section */}
        <section className="flex min-h-0 flex-1 flex-col">
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
              {t('fallback.heading')} &mdash; {fallback.length} mods
            </h2>
            {query && fallbackFiltered.length !== fallback.length && (
              <span className="text-xs text-neutral-500">({fallbackFiltered.length} matching)</span>
            )}
          </div>

          {loading ? (
            <div className="rounded-lg border border-[#1f2329] bg-[#131518] px-4 py-6 text-center text-sm text-neutral-500">
              &hellip;
            </div>
          ) : (
            <div
              ref={fallbackScrollRef}
              className="icosa-scroll min-h-0 flex-1 overflow-y-auto rounded-lg border border-[#1f2329] bg-[#0c0d0f]"
            >
              {fallbackFiltered.length === 0 ? (
                <ModListEmpty message={t('fallback.empty')} />
              ) : (
                <div style={{ height: fallbackVirtualizer.getTotalSize(), position: 'relative' }}>
                  {fallbackVirtualizer.getVirtualItems().map((virtualItem) => {
                    const mod = fallbackFiltered[virtualItem.index]
                    return (
                      <div
                        key={mod.name}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          transform: `translateY(${virtualItem.start}px)`
                        }}
                      >
                        <FallbackModRow
                          mod={mod}
                          onPromote={() => promote(mod.name)}
                          onDelete={() => setDeleteTarget(mod.name)}
                        />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      <DeleteModConfirm
        open={deleteTarget != null}
        modName={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirmed={handleDeleteConfirmed}
      />
    </div>
  )
}
