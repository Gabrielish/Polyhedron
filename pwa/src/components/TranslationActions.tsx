import { Copy, Flag, Undo2 } from 'lucide-react'

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
  return <span className="translation-actions">
    <button type="button" title="Copy untranslated string" aria-label="Copy untranslated string" onClick={onCopy}><Copy size={15} /></button>
    <button type="button" title="Paste into translation" aria-label="Paste into translation" onClick={onPaste}><Copy size={15} /></button>
    <button type="button" title="Undo last change" aria-label="Undo last change" disabled={!canUndo} onClick={onUndo}><Undo2 size={15} /></button>
    {onReview && <button type="button" className={needsReview ? 'review-active' : ''} title={needsReview ? 'Remove needs review' : 'Mark as needs review'} aria-label={needsReview ? 'Remove needs review' : 'Mark as needs review'} onClick={onReview}><Flag size={15} /></button>}
    {message && <small className="action-message" role="status">{message}</small>}
  </span>
}
