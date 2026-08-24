import { ArrowUpToLine, Trash2 } from 'lucide-react'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import type { ModWithPriority } from '@/types'

interface FallbackModRowProps {
  mod: ModWithPriority
  onPromote: () => void
  onDelete: () => void
}

export function FallbackModRow({
  mod,
  onPromote,
  onDelete
}: FallbackModRowProps): React.JSX.Element {
  const { t } = useAppTranslation('mods')
  const initial = mod.name.charAt(0).toUpperCase()

  return (
    <div className="grid grid-cols-[auto_1fr_auto_auto] gap-3 items-center px-4 py-3 hover:bg-[#131518] transition-colors border-b border-[#1f2329] last:border-b-0">
      {/* left - avatar letter */}
      <span className="w-8 h-8 rounded bg-[#1f2329] flex items-center justify-center text-xs font-medium text-neutral-400 shrink-0">
        {initial}
      </span>

      {/* center - name and string count */}
      <div className="min-w-0">
        <p className="text-sm font-medium text-neutral-200 truncate">{mod.name}</p>
        {mod.totalStrings != null && (
          <p className="text-xs text-neutral-500">{mod.totalStrings.toLocaleString()} entries</p>
        )}
      </div>

      {/* promote button */}
      <button
        type="button"
        onClick={onPromote}
        title={t('actions.promote')}
        className="text-neutral-400 hover:text-amber-400 hover:bg-amber-500/10 p-1.5 rounded transition-colors cursor-pointer"
      >
        <ArrowUpToLine size={15} />
      </button>

      {/* delete button */}
      <button
        type="button"
        onClick={onDelete}
        title={t('actions.delete')}
        className="text-neutral-500 hover:text-red-400 hover:bg-red-500/10 p-1.5 rounded transition-colors cursor-pointer"
      >
        <Trash2 size={15} />
      </button>
    </div>
  )
}
