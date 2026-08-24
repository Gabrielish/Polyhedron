import { Check } from 'lucide-react'
import { useAppTranslation } from '@/i18n/useAppTranslation'

interface TranslationStatsProps {
  translatedCount: number
  total: number
  pct: number
  todayProgress?: number
  batchCompleted?: number
  batchTotal?: number
}

export function TranslationStats({ translatedCount, total, pct, todayProgress = 0, batchCompleted = 0, batchTotal = 0 }: TranslationStatsProps): React.JSX.Element {
  const { t } = useAppTranslation('translate')
  const daysRemaining = Math.ceil(Math.max(total - translatedCount, 0) / 250)
  const nextCheckpointPercent = [25, 50, 75, 100].find((checkpoint) => pct < checkpoint) ?? 100
  const nextCheckpointCount = Math.ceil((total * nextCheckpointPercent) / 100)
  const checkpointDays = Math.ceil(Math.max(nextCheckpointCount - translatedCount, 0) / 250)

  return (
    <div className="translation-stats flex min-w-95 flex-col gap-2">
      <div className="flex items-end justify-between gap-4 px-1 font-mono tabular-nums">
        <span className="text-xl font-bold text-amber-400">{translatedCount.toLocaleString()} <span className="font-normal text-neutral-500">/{total.toLocaleString()}</span></span>
        <span className="text-xl font-bold text-white">{pct.toFixed(2)}%</span>
      </div>
      <div className="group relative h-10 pr-5" title={`${Math.min(todayProgress, 250)}/250 today • Checkpoint ~${checkpointDays} days • ~${daysRemaining} days at 250/day`}>
        <div className="translation-progress-track absolute inset-y-1 left-0 right-4 overflow-visible rounded-full border">
          <div className="translation-progress-fill absolute inset-y-0 left-0 rounded-full bg-amber-500" style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }} />
          <div className="pointer-events-none absolute inset-0">
            {[25, 50, 75].map((checkpoint) => {
              const complete = pct >= checkpoint
              return (
                <span key={checkpoint} className={`absolute top-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-[#0b1114] ${complete ? 'bg-amber-500 text-white' : 'bg-[#273238] text-neutral-500'}`} style={{ left: `${checkpoint}%` }}>
                  <Check size={14} strokeWidth={4} />
                </span>
              )
            })}
          </div>
        </div>
        <div className={`translation-progress-bubble absolute right-0 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border-4 border-[#0b1114] ${pct >= 100 ? 'bg-amber-500 text-white' : 'bg-[#273238] text-neutral-400'}`}>
          <Check size={21} strokeWidth={4} />
        </div>
        <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-amber-500/30 bg-[#171a1f] px-3 py-2 text-[11px] font-medium text-neutral-300 shadow-xl group-hover:block">
          <span className="text-amber-300">Today&apos;s Progress: {Math.min(todayProgress, 250)}/250</span><span className="mx-2 text-neutral-600">•</span><span>Checkpoint ~{checkpointDays} days</span><span className="mx-2 text-neutral-600">•</span><span>~{daysRemaining} days at 250/day</span>
        </div>
      </div>
      {batchTotal > 0 && <div className="text-right font-mono text-[10px] text-neutral-500">{t('editor.batch', { completed: batchCompleted, total: batchTotal })}</div>}
    </div>
  )
}
