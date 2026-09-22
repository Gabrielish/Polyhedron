import { Check } from 'lucide-react'
import { useAppTranslation } from '@/i18n/useAppTranslation'

interface TranslationStatsProps {
  translatedCount: number
  total: number
  pct: number
  verifiedCount: number
  batchCompleted?: number
  batchTotal?: number
}

export function TranslationStats({ translatedCount, total, pct, verifiedCount, batchCompleted = 0, batchTotal = 0 }: TranslationStatsProps): React.JSX.Element {
  const { t } = useAppTranslation('translate')
  const showVerified = total > 0 && translatedCount >= total
  const activeCount = showVerified ? verifiedCount : translatedCount
  const activePct = showVerified ? (verifiedCount / total) * 100 : pct
  const tooltipLabel = showVerified ? 'Translation Progress' : 'Verified Progress'
  const tooltipCount = showVerified ? translatedCount : verifiedCount
  const tooltipPct = showVerified ? pct : (total > 0 ? (verifiedCount / total) * 100 : 0)
  const tooltipColor = showVerified ? 'text-amber-300' : 'text-emerald-300'
  const progressTooltip = <><span className={`font-semibold ${tooltipColor}`}>{tooltipLabel}</span><span className="mx-2 text-neutral-600">·</span><span className="text-neutral-200">{tooltipCount.toLocaleString()}/{total.toLocaleString()}</span><span className="mx-2 text-neutral-600">–</span><span className={`font-bold ${tooltipColor}`}>{tooltipPct.toFixed(2)}%</span></>

  return (
    <div className="translation-stats flex min-w-95 flex-col gap-2">
      <div className="flex items-end justify-between gap-4 px-1 font-mono tabular-nums">
        <span className="text-xl font-bold text-amber-400">{activeCount.toLocaleString()} <span className="font-normal text-neutral-500">/{total.toLocaleString()}</span></span>
        <span className="text-xl font-bold text-white">{activePct.toFixed(2)}%</span>
      </div>
      <div className="group relative h-10 pr-5">
        <div className="translation-progress-track absolute inset-y-1 left-0 right-4 overflow-visible rounded-full border">
          <div className="translation-progress-fill absolute inset-y-0 left-0 rounded-full bg-amber-500" style={{ width: `${Math.min(Math.max(activePct, 0), 100)}%` }} />
          <div className="pointer-events-none absolute inset-0">
            {[25, 50, 75].map((checkpoint) => {
              const complete = activePct >= checkpoint
              return (
                <span key={checkpoint} className={`absolute top-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-[#0b1114] ${complete ? 'bg-amber-500 text-white' : 'bg-[#273238] text-neutral-500'}`} style={{ left: `${checkpoint}%` }}>
                  <Check size={14} strokeWidth={4} />
                </span>
              )
            })}
          </div>
        </div>
        <div className={`translation-progress-bubble absolute right-0 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border-4 border-[#0b1114] ${activePct >= 100 ? 'bg-amber-500 text-white' : 'bg-[#273238] text-neutral-400'}`}>
          <Check size={21} strokeWidth={4} />
        </div>
        <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-amber-500/30 bg-[#171a1f] px-3 py-2 text-[11px] font-medium text-neutral-300 shadow-xl group-hover:block">
          {progressTooltip}
        </div>
      </div>
      {batchTotal > 0 && <div className="text-right font-mono text-[10px] text-neutral-500">{t('editor.batch', { completed: batchCompleted, total: batchTotal })}</div>}
    </div>
  )
}
