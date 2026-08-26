import { useState } from 'react'
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
  function run(action: () => void, label: string): void {
    setFeedback('')
    window.setTimeout(() => {
      setFeedback(label)
      window.setTimeout(() => setFeedback(''), 1000)
    }, 0)
    action()
  }
  return <span className="translation-actions">
    {feedback && <small className="action-message" role="status">{feedback}</small>}
    <button type="button" title="Copy untranslated string" aria-label="Copy untranslated string" onClick={() => run(onCopy, 'Copied')}><Copy size={15} /></button>
    <button type="button" title="Paste into translation" aria-label="Paste into translation" onClick={() => run(onPaste, 'Pasted')}><ClipboardPaste size={15} /></button>
    <button type="button" title="Undo last change" aria-label="Undo last change" disabled={!canUndo} onClick={() => run(onUndo, 'Undone')}><Undo2 size={15} /></button>
    {onReview && <button type="button" className={needsReview ? 'review-active' : ''} title={needsReview ? 'Remove needs review' : 'Mark as needs review'} aria-label={needsReview ? 'Remove needs review' : 'Mark as needs review'} onClick={() => run(onReview, 'Flagged')}><Flag size={15} /></button>}
  </span>
}
