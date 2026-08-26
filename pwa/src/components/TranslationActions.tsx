type TranslationActionsProps = {
  onCopy: () => void
  onPaste: () => void
  onUndo: () => void
  canUndo: boolean
  message?: string
}

function ActionIcon({ type }: { type: 'copy' | 'paste' | 'undo' }): React.JSX.Element {
  if (type === 'copy') return <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="5.5" y="1.5" width="8" height="8" rx="1" /><rect x="2.5" y="6.5" width="8" height="8" rx="1" /></svg>
  if (type === 'paste') return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3.5h8.5M8.5 1.5l3 2-3 2M11.5 3.5v8a2 2 0 0 1-2 2H3" /><path d="M5 7.5h7.5" /></svg>
  return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 5.5 2.5 8 5 10.5" /><path d="M2.8 8h6.5a4 4 0 1 1 0 4" /></svg>
}

export function TranslationActions({ onCopy, onPaste, onUndo, canUndo, message }: TranslationActionsProps): React.JSX.Element {
  return <span className="translation-actions">
    <button type="button" title="Copy untranslated string" aria-label="Copy untranslated string" onClick={onCopy}><ActionIcon type="copy" /></button>
    <button type="button" title="Paste into translation" aria-label="Paste into translation" onClick={onPaste}><ActionIcon type="paste" /></button>
    <button type="button" title="Undo last change" aria-label="Undo last change" disabled={!canUndo} onClick={onUndo}><ActionIcon type="undo" /></button>
    {message && <small className="action-message" role="status">{message}</small>}
  </span>
}
