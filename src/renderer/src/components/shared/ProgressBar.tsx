import { cn } from '@/lib/utils'

interface ProgressBarProps {
  current: number
  total: number
  className?: string
  indeterminate?: boolean
  showCounts?: boolean
  showPercentage?: boolean
  percentageOnRight?: boolean
  tone?: 'default' | 'accent'
}

export function ProgressBar({ current, total, className, indeterminate = false, showCounts = true, showPercentage = true, percentageOnRight = false, tone = 'default' }: ProgressBarProps): React.JSX.Element {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {!indeterminate && (showPercentage || showCounts) && <div className={cn('flex text-xs text-neutral-400', percentageOnRight ? 'justify-end' : 'justify-between')}>
        {showPercentage && <span>{pct}%</span>}
        {showCounts && <span>{current} / {total}</span>}
      </div>}
      <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-800">
        <div
          className={indeterminate ? 'setup-progress h-full rounded-full bg-amber-500' : cn('h-full rounded-full transition-all duration-200', tone === 'accent' ? 'bg-amber-500' : 'bg-blue-500')}
          style={{ width: indeterminate ? '33.333%' : `${pct}%` }}
        />
      </div>
    </div>
  )
}
