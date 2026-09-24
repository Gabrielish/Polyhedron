import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { BookText, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import type { TermGlossaryEntry } from '@/utils/termGlossary'
import { RomanianDiacritics } from './RomanianDiacritics'

interface TermGlossaryModalProps {
  open: boolean
  entries: TermGlossaryEntry[]
  onChange: (entries: TermGlossaryEntry[]) => void
  onClose: () => void
}

export function TermGlossaryModal({
  open,
  entries,
  onChange,
  onClose
}: TermGlossaryModalProps): React.JSX.Element | null {
  const [source, setSource] = useState('')
  const [translation, setTranslation] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [duplicateMessage, setDuplicateMessage] = useState('')
  const [showRomanianDiacritics, setShowRomanianDiacritics] = useState(false)

  useEffect(() => {
    if (!open) {
      setShowRomanianDiacritics(false)
      return
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  const sortedEntries = useMemo(
    () => {
      const query = search.trim().toLocaleLowerCase()
      return [...entries]
        .filter(
          (entry) =>
            !query ||
            entry.source.toLocaleLowerCase().includes(query) ||
            entry.translation.toLocaleLowerCase().includes(query)
        )
        .sort((a, b) => a.source.localeCompare(b.source, undefined, { sensitivity: 'base' }))
    },
    [entries, search]
  )

  if (!open) return null

  const resetForm = () => {
    setSource('')
    setTranslation('')
    setEditingId(null)
    setDuplicateMessage('')
  }

  const submit = () => {
    const nextSource = source.trim()
    const nextTranslation = translation.trim()
    if (!nextSource || !nextTranslation) return

    const duplicate = entries.find(
      (entry) =>
        entry.id !== editingId &&
        entry.source.trim().toLocaleLowerCase() === nextSource.toLocaleLowerCase()
    )
    if (duplicate) {
      setDuplicateMessage(`The term “${duplicate.source}” already exists in the glossary.`)
      return
    }
    setDuplicateMessage('')

    if (editingId) {
      onChange(
        entries.map((entry) =>
          entry.id === editingId
            ? { ...entry, source: nextSource, translation: nextTranslation }
            : entry
        )
      )
    } else {
      onChange([
        ...entries,
        { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, source: nextSource, translation: nextTranslation }
      ])
    }
    resetForm()
  }

  const startEdit = (entry: TermGlossaryEntry) => {
    setEditingId(entry.id)
    setSource(entry.source)
    setTranslation(entry.translation)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="term-glossary-title"
        className="flex max-h-[min(720px,90vh)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#34343e] bg-[#15161b] shadow-[0_25px_80px_rgba(0,0,0,0.55)]"
      >
        <div className="flex items-center gap-3 border-b border-[#2a2c34] px-5 py-4">
          <button
            type="button"
            onClick={() => setShowRomanianDiacritics((visible) => !visible)}
            aria-expanded={showRomanianDiacritics}
            title="Romanian diacritics"
            className="cursor-pointer text-amber-400 transition-colors hover:text-amber-300"
          >
            <BookText size={21} />
          </button>
          <div className="min-w-0 flex-1">
            <h2 id="term-glossary-title" className="text-lg font-semibold text-neutral-100">
              Term Glossary
            </h2>
            <p className="text-xs text-neutral-500">
              Preferred translations are shown as dotted underlines in Source EN.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-[#34343e] p-2 text-neutral-400 transition hover:text-white" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="border-b border-[#2a2c34] p-5">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">
              English term
              <input
                value={source}
                onChange={(event) => {
                  setSource(event.target.value)
                  setDuplicateMessage('')
                }}
                onKeyDown={(event) => event.key === 'Enter' && submit()}
                placeholder="Source term..."
                className="mt-1.5 h-10 w-full rounded-lg border border-[#34343e] bg-[#0f1013] px-3 text-sm normal-case tracking-normal text-neutral-100 outline-none transition focus:border-amber-500/70"
              />
            </label>
            <label className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">
              Romanian translation
              <input
                value={translation}
                onChange={(event) => {
                  setTranslation(event.target.value)
                  setDuplicateMessage('')
                }}
                onKeyDown={(event) => event.key === 'Enter' && submit()}
                placeholder="Translation..."
                className="mt-1.5 h-10 w-full rounded-lg border border-[#34343e] bg-[#0f1013] px-3 text-sm normal-case tracking-normal text-neutral-100 outline-none transition focus:border-amber-500/70"
              />
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={submit} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3 text-sm font-semibold text-black transition hover:bg-amber-400">
                {editingId ? <Pencil size={15} /> : <Plus size={16} />}
                {editingId ? 'Update' : 'Add'}
              </button>
              {editingId && (
                <button type="button" onClick={resetForm} className="h-10 rounded-lg border border-[#34343e] px-3 text-sm text-neutral-400 transition hover:text-white">
                  Cancel
                </button>
              )}
            </div>
          </div>
          {duplicateMessage && (
            <p role="alert" className="mt-3 text-xs font-medium text-red-300">
              {duplicateMessage}
            </p>
          )}
        </div>

        {showRomanianDiacritics && (
          <div className="flex flex-wrap items-center gap-2 border-b border-[#2a2c34] px-5 py-3">
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
              Romanian diacritics
            </span>
            <RomanianDiacritics />
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-neutral-500" size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search glossary..."
              aria-label="Search glossary"
              className="h-10 w-full rounded-lg border border-[#34343e] bg-[#0f1013] pr-3 pl-9 text-sm text-neutral-100 outline-none transition placeholder:text-neutral-600 focus:border-amber-500/70"
            />
          </div>
          {sortedEntries.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#34343e] px-4 py-10 text-center text-sm text-neutral-500">
              {search.trim() ? 'No matching glossary terms.' : 'No terms yet. Add your first preferred translation above.'}
            </div>
          ) : (
            <div className="space-y-2">
              {sortedEntries.map((entry) => (
                <div key={entry.id} className="flex items-center gap-3 rounded-xl border border-[#2c2e37] bg-[#1b1c21] px-3 py-2.5">
                  <div className="min-w-0 flex-1 text-sm">
                    <span className="font-medium text-neutral-100">{entry.source}</span>
                    <span className="mx-2 text-neutral-600">→</span>
                    <span className="text-amber-300">{entry.translation}</span>
                  </div>
                  <button type="button" onClick={() => startEdit(entry)} className="rounded-md p-1.5 text-neutral-500 transition hover:bg-white/5 hover:text-white" aria-label={`Edit ${entry.source}`}>
                    <Pencil size={15} />
                  </button>
                  <button type="button" onClick={() => onChange(entries.filter((item) => item.id !== entry.id))} className="rounded-md p-1.5 text-neutral-500 transition hover:bg-red-500/10 hover:text-red-300" aria-label={`Delete ${entry.source}`}>
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
