import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function AppMessage({
  children,
  tone = 'info',
  className
}: {
  children: ReactNode
  tone?: 'success' | 'info' | 'warning' | 'error'
  className?: string
}): React.JSX.Element {
  const Icon = tone === 'error' ? AlertCircle : tone === 'warning' ? AlertTriangle : tone === 'success' ? CheckCircle2 : Info
  return (
    <div className={cn('app-message flex items-start gap-3 rounded-xl border px-4 py-3 text-xs leading-5', className)} data-message-tone={tone} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon size={18} className="app-message-icon mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">{children}</div>
    </div>
  )
}
