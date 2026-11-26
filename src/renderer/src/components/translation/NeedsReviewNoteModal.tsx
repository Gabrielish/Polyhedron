import { Flag, Pencil, Plus } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import { ModalShell } from '@/components/shared/ModalShell'
import { useTranslationSession, type TranslationSessionEntry } from '@/context/TranslationSession'

export function NeedsReviewNoteModal({
  entry,
  onClose
}: {
  entry: TranslationSessionEntry | null
  onClose: () => void
}): React.JSX.Element | null {
  const session = useTranslationSession()
  const [draft, setDraft] = useState(() => entry?.needsReviewReason ?? '')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    const maxHeight = 240
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [draft])

  if (!entry) return null

  return (
    <ModalShell
      open
      title={entry.needsReview ? 'Edit review note' : 'Flag for review'}
      icon={<Flag size={18} />}
      sizeClassName="max-w-xl"
      contentClassName="!pb-0"
      footerClassName="border-t-0"
      onClose={onClose}
      footer={<div className="flex items-center gap-2">
        {entry.needsReview && <button
          type="button"
          onClick={() => {
            session.setNeedsReview(entry.rowId, false, '')
            onClose()
          }}
          className="group inline-flex items-center gap-2 rounded-lg border border-[#34343e] px-3 py-2 text-xs text-neutral-300 transition hover:bg-neutral-800 hover:text-white"
        >
          <Flag size={14} strokeWidth={2} className="text-rose-300 transition-colors group-hover:text-white" /> Remove
        </button>}
        <button
          type="button"
          onClick={() => {
            session.setNeedsReview(entry.rowId, true, draft.trim())
            onClose()
          }}
          className="accent-solid-button inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium"
        >
          {entry.needsReview
            ? <><Pencil size={14} strokeWidth={2} style={{ width: 14, height: 14 }} /> Edit</>
            : <><Plus size={14} strokeWidth={2} style={{ width: 14, height: 14 }} /> Add</>}
        </button>
      </div>}
    >
      <textarea
        ref={textareaRef}
        id="needs-review-reason"
        autoFocus
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="What should be checked or edited?"
        rows={1}
        className="min-h-[2.5rem] max-h-60 w-full resize-none overflow-hidden rounded-lg border border-[#30343b] bg-[#0c0d0f] px-3 py-2.5 text-sm text-neutral-100 outline-none transition focus:border-amber-500"
      />
    </ModalShell>
  )
}
