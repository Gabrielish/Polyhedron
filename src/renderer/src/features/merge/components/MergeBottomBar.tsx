import { Loader2, Merge } from 'lucide-react'
import { btnBase, btnPrimary } from '@/features/translate/components/styles'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import { cn } from '@/lib/utils'
import type { MergeProgress } from '@/types'

interface MergeBottomBarProps {
  ready: boolean
  isRunning: boolean
  progress: MergeProgress | null
  onCancel: () => void
  onRun: () => void
}

export function MergeBottomBar({
  ready,
  isRunning,
  progress,
  onCancel,
  onRun
}: MergeBottomBarProps): React.JSX.Element {
  const { t } = useAppTranslation(['merge', 'common'])

  const showProgress =
    isRunning &&
    progress !== null &&
    progress !== undefined &&
    progress.phase !== 'done' &&
    progress.phase !== 'error'

  const progressLabel = (): string => {
    if (!progress) return t('bottomBar.running', { ns: 'merge' })
    if (progress.phase === 'parsing') return t('bottomBar.progressParsing', { ns: 'merge' })
    if (progress.phase === 'loading-map') return t('bottomBar.progressLoadingMap', { ns: 'merge' })
    if (progress.phase === 'classifying') return t('bottomBar.progressClassifying', { ns: 'merge' })
    if (progress.phase === 'writing')
      return t('bottomBar.progressWriting', {
        ns: 'merge',
        processed: progress.processed.toLocaleString(),
        total: progress.total.toLocaleString()
      })
    return t('bottomBar.running', { ns: 'merge' })
  }

  const progressPct =
    progress?.phase === 'writing' && progress.total > 0
      ? (progress.processed / progress.total) * 100
      : undefined

  return (
    <div className="shrink-0 border-t border-[#1f2329] px-6 py-3">
      <div className="mx-auto flex max-w-220 flex-col gap-2 rounded-xl border border-neutral-700 bg-[#131518] px-4 py-3 shadow-xl">
        {showProgress && (
          <div className="space-y-1.5">
            {progressPct !== undefined ? (
              <div className="h-2 rounded-full bg-[#1d2127]">
                <div
                  className="h-full rounded-full bg-amber-400/80 transition-[width] duration-200"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            ) : (
              <div className="h-2 animate-pulse rounded-full bg-amber-400/30" />
            )}
            <p className="text-xs text-neutral-400">{progressLabel()}</p>
          </div>
        )}
        <div className="flex items-center gap-2.5">
          <div className="flex-1 text-xs text-neutral-400">
            {isRunning && !showProgress
              ? t('bottomBar.running', { ns: 'merge' })
              : ready
                ? t('bottomBar.ready', { ns: 'merge' })
                : t('bottomBar.idle', { ns: 'merge' })}
          </div>
          <button type="button" className={btnBase} onClick={onCancel} disabled={isRunning}>
            {t('actions.cancel', { ns: 'common' })}
          </button>
          <button
            type="button"
            className={cn(btnPrimary, (!ready || isRunning) && 'cursor-not-allowed opacity-40')}
            disabled={!ready || isRunning}
            onClick={onRun}
          >
            {isRunning ? <Loader2 size={13} className="animate-spin" /> : <Merge size={13} />}
            {isRunning
              ? t('bottomBar.running', { ns: 'merge' })
              : t('actions.run', { ns: 'common' })}
          </button>
        </div>
      </div>
    </div>
  )
}
