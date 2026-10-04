import { Check, File, Upload, X } from 'lucide-react'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import { cn } from '@/lib/utils'
import { btnBase, btnGhostIcon } from './styles'

interface FileInputCardProps {
  showHeader?: boolean
  fileName: string | null
  acceptedExtensions?: string[]
  dropPrompt?: string
  isDragging: boolean
  onBrowse: () => Promise<void>
  onDragOver: (event: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: (event: React.DragEvent) => void
  onClear: () => void
}

export function FileInputCard({
  showHeader = true,
  fileName,
  acceptedExtensions = ['xml', 'pak', 'zip'],
  dropPrompt,
  isDragging,
  onBrowse,
  onDragOver,
  onDragLeave,
  onDrop,
  onClear
}: FileInputCardProps): React.JSX.Element {
  const { t } = useAppTranslation(['translate', 'common'])

  return (
    <>
      {showHeader && (
        <div>
          <h3 className="text-[15px] font-semibold text-neutral-200 tracking-tight m-0">
            {t('setup.fileCard.title', { ns: 'translate' })}
          </h3>
          <p className="text-xs text-neutral-500 mt-1 m-0">
            {t('setup.fileCard.description', { ns: 'translate' })}
          </p>
        </div>
      )}

      <section
        aria-label={t('setup.fileCard.dropZone', { ns: 'translate' })}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          'rounded-xl border transition-all',
          fileName
            ? 'p-3 border-amber-500 bg-[#0f1114]'
            : isDragging
              ? 'p-3 border-dashed border-amber-500 bg-amber-400/5'
              : 'p-3 border-dashed border-[#2a2f37] bg-[#0f1114]'
        )}
      >
        {!fileName ? (
          <div className="flex items-center gap-3">
            <div
              aria-hidden="true"
              className={cn(
                'h-10 w-10 shrink-0 rounded-xl border flex items-center justify-center',
                isDragging
                  ? 'border-amber-400 bg-[#131518] text-amber-400'
                  : 'border-[#1f2329] bg-neutral-900 text-neutral-500'
              )}
            >
              <Upload size={17} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-neutral-300">
                {dropPrompt ?? t('setup.fileCard.dropPrompt', { ns: 'translate' })}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[10px] text-neutral-600">
                {acceptedExtensions.map((extension) => (
                  <span key={extension} className="font-mono">
                    .{extension}
                  </span>
                ))}
              </div>
            </div>
            <button type="button" onClick={onBrowse} className={btnBase}>
              <File size={13} />
              {t('setup.fileCard.browseFile', { ns: 'translate' })}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-400/10 text-amber-400 flex items-center justify-center shrink-0">
              <File size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-mono text-[13px] font-semibold text-neutral-200 truncate">
                {fileName}
              </div>
              <div className="flex items-center gap-1 text-[11px] text-amber-400 mt-0.5">
                <Check size={10} />
                {t('setup.fileCard.fileSelected', { ns: 'translate' })}
              </div>
            </div>
            <button type="button" onClick={onClear} className={btnGhostIcon}>
              <X size={14} />
            </button>
          </div>
        )}
      </section>
    </>
  )
}
