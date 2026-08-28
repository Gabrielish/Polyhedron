import { Loader2, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import type { TranslationSession } from '../types'
import { cn } from '@/lib/utils'
import { btnPrimary } from './styles'

interface SessionSaveButtonProps {
  session: TranslationSession
  className?: string
  portalSelector?: string
}

export function SessionSaveButton({ session, className, portalSelector }: SessionSaveButtonProps): React.JSX.Element {
  const [isSaving, setIsSaving] = useState(false)
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (!portalSelector) return
    const target = document.querySelector<HTMLElement>(portalSelector)?.parentElement ?? null
    setPortalTarget(target)
  }, [portalSelector])

  const saveTranslations = async () => {
    setIsSaving(true)
    const sessionKey = `${session.storedPath ?? session.inputPath ?? session.modName}|${session.sourceLang}|${session.targetLang}`
    try {
      await window.api.session.save({
        key: sessionKey,
        entries: session.entries.map(({ uid, target, genderTargets, matchType, needsReview }) => ({ uid, target, genderTargets, matchType, needsReview }))
      })
      toast.success('Translations saved')
    } catch (error) {
      toast.error(String(error))
    } finally {
      setIsSaving(false)
    }
  }

  const button = (
    <button type="button" onClick={() => void saveTranslations()} disabled={isSaving} className={cn(btnPrimary, className, isSaving && 'cursor-not-allowed opacity-60')} title="Save translations">
      {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
      SAVE
      <span className="shortcut-hint inline-flex items-center justify-center font-mono text-[10px] text-black/65">Ctrl S</span>
    </button>
  )

  return portalSelector && portalTarget ? createPortal(button, portalTarget) : button
}
