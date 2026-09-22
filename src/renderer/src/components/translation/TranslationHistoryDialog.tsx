import { History, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ModalShell } from '@/components/shared/ModalShell'
import { type TranslationHistoryEntry, useTranslationSession } from '@/context/TranslationSession'

export function TranslationHistoryDialog({
  source,
  history,
  onDelete,
  onClose
}: {
  source: string
  history: TranslationHistoryEntry[]
  onDelete?: (historyId: string) => void
  onClose: () => void
}): React.JSX.Element {
  const session = useTranslationSession()
  const [visibleHistory, setVisibleHistory] = useState(history)
  useEffect(() => setVisibleHistory(history), [history])
  const deleteEntry = (historyId: string) => {
    setVisibleHistory((current) => current.filter((change) => change.id !== historyId))
    if (onDelete) {
      onDelete(historyId)
      return
    }
    const entry = session.entries.find((item) => item.history?.some((change) => change.id === historyId))
    if (entry) session.deleteHistoryEntry(entry.rowId, historyId)
  }
  return (
    <ModalShell open title="History of changes" onClose={onClose} icon={<History size={16} />}>
      <div className="mb-3 rounded border border-[#1f2329] bg-[#0c0d0f] p-2 text-xs text-neutral-400">{source}</div>
      {visibleHistory.length === 0 ? (
        <p className="text-sm text-neutral-500">No non-empty changes recorded yet.</p>
      ) : (
        <div className="max-h-[55vh] space-y-2 overflow-y-auto">
          {[...visibleHistory].reverse().map((change) => (
            <div key={change.id} className="rounded border border-[#1f2329] bg-[#131518] p-3">
              <div className="mb-1 flex items-center justify-between gap-2 text-[10px] uppercase tracking-wide text-neutral-500">
                <span>{change.kind === 'translation' ? 'Translation' : change.kind === 'gender' ? `${change.variant ?? 'variant'} translation` : change.kind === 'review' ? 'Review status' : 'Needs review'}</span>
                <span className="inline-flex items-center gap-2"><time>{new Date(change.changedAt).toLocaleString()}</time><button type="button" onClick={() => deleteEntry(change.id)} title="Delete history entry" aria-label="Delete history entry" className="rounded p-0.5 text-neutral-500 hover:bg-red-500/15 hover:text-red-300"><X size={12} /></button></span>
              </div>
              <div className="whitespace-pre-wrap break-words text-sm text-neutral-200">{change.value}</div>
              {change.previousValue?.trim() && <div className="mt-1 border-t border-[#1f2329] pt-1 text-xs text-neutral-500">Previous: {change.previousValue}</div>}
            </div>
          ))}
        </div>
      )}
      <button type="button" onClick={onClose} className="mt-4 inline-flex items-center gap-1 rounded border border-[#2a2f37] px-3 py-1.5 text-xs text-neutral-300 hover:border-amber-500/50"><X size={13} /> Close</button>
    </ModalShell>
  )
}
