import type { ReactNode } from 'react'

interface SettingsSectionCardProps {
  title: string
  contentTitle?: string
  subtitle?: string
  icon?: ReactNode
  children: ReactNode
}

// Match the standard Settings cards: title, divider, then the section content.
export function SettingsSectionCard({
  title,
  contentTitle = title,
  subtitle,
  icon,
  children
}: SettingsSectionCardProps): React.JSX.Element {
  return (
    <div className="app-panel-surface overflow-hidden rounded-xl border border-neutral-800/80 bg-[#141416]">
      <div className="border-b border-neutral-800/50 px-6 py-4">
        <h2 className="text-sm font-medium text-neutral-200">{title}</h2>
      </div>
      <div className="p-6">
        {(icon || subtitle) && (
          <div className="mb-4 flex items-start gap-3">
            {icon && <span className="mt-0.5 shrink-0 text-amber-400" aria-hidden="true">{icon}</span>}
            <div className="min-w-0">
              <p className="text-sm font-medium text-neutral-200">{contentTitle}</p>
              {subtitle && <p className="mt-1 text-xs text-neutral-500">{subtitle}</p>}
            </div>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
