import {
  ChevronRight,
  ExternalLink,
  PawPrint,
  Save,
  Search,
  X
} from 'lucide-react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  type CreatureGuideEntry,
  type CreatureGuideType,
  creatureGuideTypes
} from '@/data/creatureGuide'
import { normalizeSearchText } from '@/utils/search'
import type { TermGlossaryEntry } from '@/utils/termGlossary'

interface CreatureGuideModalProps {
  open: boolean
  targetLang: string
  termGlossary: TermGlossaryEntry[]
  onSaveToGlossary: (entry: CreatureGuideEntry, translation: string) => void
  onClose: () => void
}

function findSavedTranslation(entry: CreatureGuideEntry, glossary: TermGlossaryEntry[]): string {
  const source = normalizeSearchText(entry.name)
  return glossary.find((item) => normalizeSearchText(item.source) === source)?.translation ?? ''
}

export function CreatureGuideModal({
  open,
  targetLang,
  termGlossary,
  onSaveToGlossary,
  onClose
}: CreatureGuideModalProps): React.JSX.Element | null {
  const [selectedTypeId, setSelectedTypeId] = useState('aberration')
  const [selectedEntryId, setSelectedEntryId] = useState('spectator')
  const [search, setSearch] = useState('')
  const [translation, setTranslation] = useState('')
  const [imageOverrides, setImageOverrides] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem('polyhedron-creature-images') ?? '{}')
    } catch {
      return {}
    }
  })
  const isRomanian = /^(?:ro|romanian)(?:[-_]|$)/i.test(targetLang.trim())

  useEffect(() => {
    localStorage.setItem('polyhedron-creature-images', JSON.stringify(imageOverrides))
  }, [imageOverrides])

  const saveImage = (entryId: string, file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      const source = String(reader.result)
      const image = new Image()
      image.onload = () => {
        const scale = Math.min(1, 512 / Math.max(image.width, image.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(image.width * scale))
        canvas.height = Math.max(1, Math.round(image.height * scale))
        canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height)
        setImageOverrides((current) => ({
          ...current,
          [entryId]: canvas.toDataURL('image/jpeg', 0.82)
        }))
      }
      image.src = source
    }
    reader.readAsDataURL(file)
  }

  const selectedType =
    creatureGuideTypes.find((type) => type.id === selectedTypeId) ?? creatureGuideTypes[0]
  const selectedEntry =
    selectedType.children.find((entry) => entry.id === selectedEntryId) ?? selectedType
  const selectedImage = imageOverrides[selectedEntry.id]

  useEffect(() => {
    if (!open) return
    const saved = findSavedTranslation(selectedEntry, termGlossary)
    setTranslation(saved || selectedEntry.translation || '')
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose, selectedEntry, termGlossary])

  const filteredTypes = useMemo(() => {
    const query = normalizeSearchText(search.trim())
    if (!query) return creatureGuideTypes
    return creatureGuideTypes
      .map((type) => ({
        ...type,
        children: type.children.filter((entry) =>
          [type.name, entry.name, entry.translation ?? ''].some((value) =>
            normalizeSearchText(value).includes(query)
          )
        )
      }))
      .filter((type) => normalizeSearchText(type.name).includes(query) || type.children.length > 0)
  }, [search])

  if (!open) return null

  const selectType = (type: CreatureGuideType) => {
    setSelectedTypeId(type.id)
    setSelectedEntryId(type.children[0]?.id ?? type.id)
  }

  const saveTranslation = () => {
    const value = translation.trim()
    if (!value) return
    onSaveToGlossary(selectedEntry, value)
  }

  return createPortal(
    // biome-ignore lint/a11y/noStaticElementInteractions: the backdrop closes the modal when clicked outside the dialog
    <div
      className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/65 px-4 py-5 backdrop-blur-sm"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="creature-guide-title"
        className="flex h-[min(800px,92vh)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#34343e] bg-[#15161b] shadow-[0_25px_80px_rgba(0,0,0,0.6)]"
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-[#2a2c34] px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300">
            <PawPrint size={19} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="creature-guide-title" className="text-lg font-semibold text-neutral-100">
              Creature Guide
            </h2>
            <p className="text-xs text-neutral-500">
              BG3 creature types, portraits, and preferred translations.
            </p>
          </div>
          <a
            href="https://bg3.wiki/wiki/List_of_creature_types"
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-1.5 rounded-md border border-[#34343e] px-2.5 py-1.5 text-xs text-neutral-400 transition hover:border-amber-500/50 hover:text-amber-300 sm:inline-flex"
          >
            BG3 Wiki <ExternalLink size={13} />
          </a>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#34343e] p-2 text-neutral-400 transition hover:text-white"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <aside className="w-full shrink-0 border-b border-[#2a2c34] bg-[#121318] md:w-44 md:border-r md:border-b-0">
            <div className="relative border-b border-[#2a2c34] p-3">
              <Search
                className="pointer-events-none absolute top-1/2 left-6 -translate-y-1/2 text-neutral-600"
                size={15}
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search creatures..."
                aria-label="Search creatures"
                className="h-9 w-full rounded-md border border-[#34343e] bg-[#0f1013] pr-8 pl-8 text-xs text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-amber-500/70"
              />
              {search && (
                <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => setSearch('')} aria-label="Clear search" className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-neutral-500 transition-colors hover:text-neutral-200">
                  <X size={13} />
                </button>
              )}
            </div>
            <div className="polyhedron-scroll flex max-h-40 gap-1 overflow-x-auto p-2 md:max-h-none md:flex-col md:overflow-y-auto md:overflow-x-hidden">
              {filteredTypes.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => selectType(type)}
                  className={`flex shrink-0 items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs transition ${selectedType.id === type.id ? 'bg-amber-500/12 text-amber-300' : 'text-neutral-400 hover:bg-white/5 hover:text-neutral-200'}`}
                >
                  <span className="min-w-0 flex-1">{type.name}</span>
                  <span className="font-mono text-[10px] text-neutral-600">
                    {type.children.length || '—'}
                  </span>
                  {selectedType.id === type.id && <ChevronRight size={13} />}
                </button>
              ))}
            </div>
          </aside>

          <section className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 sm:p-5">
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-neutral-100">{selectedType.name}</h3>
                <a
                  href={selectedType.wikiUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${selectedType.name} on BG3 Wiki`}
                  className="text-neutral-600 transition hover:text-amber-300"
                >
                  <ExternalLink size={13} />
                </a>
                </div>
                <span className="font-mono text-[10px] text-neutral-600">
                  {selectedType.children.length} entries
                </span>
              </div>

              {selectedType.children.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#34343e] px-4 py-10 text-center text-sm text-neutral-500">
                  No creatures listed for this type yet.
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {selectedType.children.map((entry, index) => {
                    const saved = findSavedTranslation(entry, termGlossary)
                    return (
                      <Fragment key={entry.id}>
                        {entry.group && selectedType.children[index - 1]?.group !== entry.group && (
                          <div className="col-span-full pt-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
                            {entry.group}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => setSelectedEntryId(entry.id)}
                          className={`flex min-w-0 items-center gap-3 rounded-xl border p-2.5 text-left transition ${selectedEntry.id === entry.id ? 'border-amber-500/60 bg-amber-500/8' : 'border-[#2c2e37] bg-[#1b1c21] hover:border-[#4a4d58]'}`}
                        >
                        <label
                          className="relative h-12 w-12 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-dashed border-[#34343e]"
                          onClick={(event) => event.stopPropagation()}
                          title="Choose image"
                        >
                          {imageOverrides[entry.id] ? (
                            <img src={imageOverrides[entry.id]} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-[9px] text-neutral-600">Add image</span>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            className="absolute inset-0 cursor-pointer opacity-0"
                            onChange={(event) => saveImage(entry.id, event.target.files?.[0])}
                          />
                        </label>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-neutral-100">
                            {entry.name}
                          </span>
                          <span
                            className={`mt-1 block truncate text-[10px] ${saved ? 'text-emerald-300' : 'text-neutral-600'}`}
                          >
                            {saved || 'No translation saved'}
                          </span>
                        </span>
                        <ChevronRight size={14} className="shrink-0 text-neutral-600" />
                        </button>
                      </Fragment>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="mt-3 shrink-0 rounded-xl border border-[#34343e] bg-[#0f1013] p-3.5">
              <div className="mb-3 flex items-center gap-2">
                <label className="relative flex h-9 w-9 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-dashed border-[#34343e] text-[8px] text-neutral-600">
                  {selectedImage ? (
                    <img src={selectedImage} alt="" className="h-full w-full object-cover" />
                  ) : (
                    'Add'
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="absolute inset-0 cursor-pointer opacity-0"
                    onChange={(event) => saveImage(selectedEntry.id, event.target.files?.[0])}
                  />
                </label>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-neutral-100">{selectedEntry.name}</p>
                  <p className="text-[10px] text-neutral-600">
                    {isRomanian
                      ? 'Preferred Romanian translation'
                      : `Preferred ${targetLang.toUpperCase()} translation`}
                  </p>
                </div>
                <a
                  href={selectedEntry.wikiUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${selectedEntry.name} on BG3 Wiki`}
                  className="text-neutral-500 hover:text-amber-300"
                >
                  <ExternalLink size={14} />
                </a>
              </div>
              <div className="flex gap-2">
                <input
                  value={translation}
                  onChange={(event) => setTranslation(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && saveTranslation()}
                  placeholder={`Translate ${selectedEntry.name}...`}
                  className="h-10 min-w-0 flex-1 rounded-lg border border-[#34343e] bg-[#15161b] px-3 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-amber-500/70"
                />
                <button
                  type="button"
                  onClick={saveTranslation}
                  disabled={!translation.trim()}
                  className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-amber-500 px-3 text-sm font-semibold text-[color:var(--poly-accent-foreground)] transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Save size={14} /> Save
                </button>
              </div>
              <p className="mt-2 text-[10px] text-neutral-600">
                Saved entries are added to Term Glossary and become available to its tooltip.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>,
    document.body
  )
}
