import { Check } from 'lucide-react'
import { useState } from 'react'
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
  const [showVerified, setShowVerified] = useState(false)
  const activeCount = showVerified ? verifiedCount : translatedCount
  const activePct = showVerified && total > 0 ? (verifiedCount / total) * 100 : pct
  const progressColor = showVerified ? 'emerald' : 'amber'

  return (
    <div className="translation-stats flex min-w-95 flex-col gap-2">
      <div className="flex items-end justify-between gap-4 px-1 font-mono tabular-nums">
        <span className={`text-xl font-extrabold ${showVerified ? 'text-emerald-400' : 'text-amber-400'}`}>{activeCount.toLocaleString()} <span className="font-extrabold text-neutral-500">/{total.toLocaleString()}</span></span>
        <span className="text-xl font-extrabold text-white">{activePct.toFixed(2)}%</span>
      </div>
      <div
        className="group relative h-10 cursor-pointer pr-5"
        role="button"
        tabIndex={0}
        aria-label={showVerified ? 'Show translation progress' : 'Show verified progress'}
        onClick={() => setShowVerified((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            setShowVerified((value) => !value)
          }
        }}
      >
        <div className="translation-progress-track absolute inset-y-1 left-0 right-4 overflow-visible rounded-full border">
          <div className="absolute inset-0 overflow-hidden rounded-full">
            <div className={`translation-progress-fill absolute inset-y-0 left-0 rounded-l-full ${progressColor === 'amber' ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(Math.max(activePct, 0), 100)}%`, ...(showVerified ? { background: '#10b981', boxShadow: '0 0 8px rgb(16 185 129 / 28%), inset 0 1px 0 rgb(255 255 255 / 18%)' } : {}) }} />
          </div>
        </div>
        <div className={`translation-progress-bubble absolute right-0 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border-4 border-[#0b1114] ${activePct >= 100 ? (progressColor === 'amber' ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white') : 'bg-[#273238] text-neutral-400'}`} style={{ ...(showVerified ? { boxShadow: '0 0 0 1px rgb(255 255 255 / 12%), 0 0 8px rgb(16 185 129 / 28%)' } : {}), ...(showVerified && activePct >= 100 ? { background: '#10b981' } : {}) }}>
          <Check size={21} strokeWidth={4} />
        </div>
      </div>
      {batchTotal > 0 && <div className="text-right font-mono text-[10px] text-neutral-500">{t('editor.batch', { completed: batchCompleted, total: batchTotal })}</div>}
    </div>
  )
}
