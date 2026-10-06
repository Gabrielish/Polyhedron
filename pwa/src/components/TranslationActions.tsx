import { useEffect, useState } from 'react'
import { ClipboardPaste, Copy, Flag, Undo2 } from 'lucide-react'

type TranslationActionsProps = {
  onCopy: () => void
  onPaste: () => void
  onUndo: () => void
  canUndo: boolean
  message?: string
  onReview?: () => void
  needsReview?: boolean
}

export function TranslationActions({ onCopy, onPaste, onUndo, canUndo, message, onReview, needsReview }: TranslationActionsProps): React.JSX.Element {
  const [feedback, setFeedback] = useState('')
  useEffect(() => { setFeedback(message ?? ''); const timeout = window.setTimeout(() => setFeedback(''), 1800); return () => window.clearTimeout(timeout) }, [message])
  return <span className="translation-actions">
    {feedback && <small className="action-message" role="status">{feedback}</small>}
    <button type="button" className="companion-tool" data-tooltip="Copy source" aria-label="Copy untranslated string" onClick={onCopy}><Copy size={15} /></button>
    <button type="button" className="companion-tool" data-tooltip="Paste" aria-label="Paste into translation" onClick={onPaste}><ClipboardPaste size={15} /></button>
    <button type="button" className="companion-tool" data-tooltip="Undo" aria-label="Undo last change" disabled={!canUndo} onClick={onUndo}><Undo2 size={15} /></button>
    {onReview && <button type="button" className={needsReview ? 'companion-tool review-active' : 'companion-tool'} aria-pressed={needsReview} data-tooltip={needsReview ? 'Remove needs review' : 'Mark as needs review'} aria-label={needsReview ? 'Remove needs review' : 'Mark as needs review'} onClick={onReview}><Flag size={15} /></button>}
  </span>
}
