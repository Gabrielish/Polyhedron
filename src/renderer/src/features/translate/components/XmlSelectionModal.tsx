import { Check, Loader2, Package, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { getLocalizedErrorMessage } from '@/i18n/errors'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import { cn } from '@/lib/utils'
import type { PreparedTranslationInput } from '@/types'
import { btnBase, btnPrimary } from './styles'
import { XmlCandidateCard } from './XmlCandidateCard'

interface XmlSelectionModalProps {
  prepared: PreparedTranslationInput
  selectionMode?: 'single' | 'multi'
  onCancel: () => Promise<void>
  onSelect: (candidateIds: string[]) => Promise<void>
}

export function XmlSelectionModal({
  prepared,
  selectionMode = 'single',
  onCancel,
  onSelect
}: XmlSelectionModalProps): React.JSX.Element {
  const { t } = useAppTranslation(['translate', 'common'])
  const firstValidId = prepared.candidates.find((candidate) => candidate.valid)?.id ?? ''
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(firstValidId ? [firstValidId] : [])
  )
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') void onCancel()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onCancel])
  const validCandidateIds = prepared.candidates
    .filter((candidate) => candidate.valid)
    .map((candidate) => candidate.id)
  const selectedValidIds = validCandidateIds.filter((id) => selectedIds.has(id))
  const allValidSelected =
    validCandidateIds.length > 0 && validCandidateIds.every((id) => selectedIds.has(id))

  const selectCandidate = (candidateId: string) => {
    if (selectionMode === 'single') {
      setSelectedIds(new Set([candidateId]))
      return
    }

    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(candidateId)) next.delete(candidateId)
      else next.add(candidateId)
      return next
    })
  }

  const selectAllValid = () => {
    setSelectedIds(new Set(validCandidateIds))
  }

  const handleSelect = async () => {
    if (selectedValidIds.length === 0) return
    setLoading(true)
    try {
      await onSelect(selectedValidIds)
    } catch (err) {
      toast.error(getLocalizedErrorMessage(err, t))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
      <div className="flex max-h-[82vh] w-full max-w-250 flex-col overflow-hidden rounded-2xl border border-[#34343e] bg-[#15161b] shadow-[0_25px_80px_rgba(0,0,0,0.55)]">
        <div className="flex h-12 shrink-0 items-center gap-3 border-b border-[#2a2c34] px-5">
          <Package size={15} className="text-amber-400" />
          <div className="flex-1 min-w-0">
            <h2 className="m-0 text-sm font-semibold text-neutral-200">
              {t('xmlSelection.title', { ns: 'translate' })}
            </h2>
            <p className="m-0 text-[11px] text-neutral-500">
              {t('xmlSelection.description', { ns: 'translate' })}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void onCancel()}
            className="cursor-pointer rounded-lg border border-[#34343e] p-2 text-neutral-400 transition hover:text-white"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto icosa-scroll p-5">
          {selectionMode === 'multi' && (
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="font-mono text-[11px] text-neutral-500">
                {t('xmlSelection.selectedCount', {
                  ns: 'translate',
                  count: selectedValidIds.length
                })}
              </span>
              <button
                type="button"
                className={cn(
                  btnBase,
                  (allValidSelected || loading || validCandidateIds.length === 0) &&
                    'opacity-40 cursor-not-allowed'
                )}
                disabled={allValidSelected || loading || validCandidateIds.length === 0}
                onClick={selectAllValid}
              >
                {t('xmlSelection.selectAll', { ns: 'translate' })}
              </button>
            </div>
          )}
          <div className="flex flex-col gap-2.5">
            {prepared.candidates.map((candidate, index) => (
              <XmlCandidateCard
                key={candidate.id}
                candidate={candidate}
                index={index}
                selectionMode={selectionMode}
                selected={selectedIds.has(candidate.id)}
                onSelect={() => selectCandidate(candidate.id)}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-[#2a2c34] bg-[#101115] px-5 py-3">
          <button type="button" className={btnBase} onClick={onCancel}>
            {t('actions.cancel', { ns: 'common' })}
          </button>
          <button
            type="button"
            className={cn(
              btnPrimary,
              (selectedValidIds.length === 0 || loading) && 'opacity-40 cursor-not-allowed'
            )}
            disabled={selectedValidIds.length === 0 || loading}
            onClick={handleSelect}
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            {t('xmlSelection.useXml', { ns: 'translate' })}
          </button>
        </div>
      </div>
    </div>
  )
}
