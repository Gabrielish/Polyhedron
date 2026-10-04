import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

interface ModalShellProps {
  open: boolean
  title: string
  description?: string
  icon?: ReactNode
  sizeClassName?: string
  panelClassName?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

export function ModalShell({
  open,
  title,
  description,
  icon,
  sizeClassName = 'max-w-3xl',
  panelClassName,
  onClose,
  children,
  footer
}: ModalShellProps): React.JSX.Element | null {
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="app-modal-overlay fixed inset-0 z-[5000] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'app-modal-panel w-full overflow-hidden rounded-xl border border-neutral-800/80 bg-[#141416]',
          sizeClassName,
          panelClassName
        )}
      >
        <div className="flex items-start gap-3 border-b border-[#2a2c34] px-5 py-4">
          {icon && (
            <div className="mt-0.5 flex shrink-0 items-center justify-center text-amber-400">
              {icon}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="app-modal-title text-sm font-medium text-neutral-200">{title}</div>
            {description && <div className="mt-1 text-xs text-neutral-500">{description}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer rounded-lg border border-[#34343e] p-2 text-neutral-400 transition hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-5">{children}</div>

        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-[#2a2c34] bg-[#101115] px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
