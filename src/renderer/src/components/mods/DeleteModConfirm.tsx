import { AlertTriangle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ModalShell } from '@/components/shared/ModalShell'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import type { DeleteModPreview, DeleteModResult } from '@/types'

interface DeleteModConfirmProps {
  open: boolean
  modName: string | null
  onClose: () => void
  onConfirmed: (result: DeleteModResult) => void
}

export function DeleteModConfirm({
  open,
  modName,
  onClose,
  onConfirmed
}: DeleteModConfirmProps): React.JSX.Element | null {
  const { t } = useAppTranslation('mods')

  const [preview, setPreview] = useState<DeleteModPreview | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open || !modName) return

    setLoadingPreview(true)
    setPreview(null)

    window.api.mod
      .previewDelete({ modName })
      .then((data) => {
        setPreview(data)
      })
      .catch(() => {
        toast.error(t('toast.deleteFailed'))
        onClose()
      })
      .finally(() => {
        setLoadingPreview(false)
      })
  }, [open, modName, t, onClose])

  async function handleConfirm() {
    if (!modName) return

    setSubmitting(true)
    try {
      const result = await window.api.mod.delete({ modName })
      toast.success(t('toast.deleted', { name: modName }))
      onConfirmed(result)
      onClose()
    } catch {
      toast.error(t('toast.deleteFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const disabled = loadingPreview || submitting

  return (
    <ModalShell
      open={open}
      title={t('delete.title')}
      sizeClassName="max-w-md"
      icon={<AlertTriangle size={16} />}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 cursor-pointer items-center rounded-md border border-neutral-700 bg-[#131518] px-3 text-xs font-medium text-neutral-200 transition-colors hover:bg-neutral-800"
          >
            {t('delete.cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={disabled}
            className="inline-flex h-8 cursor-pointer items-center rounded-md border border-red-500/40 bg-red-500/10 px-3 text-xs font-semibold text-red-200 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('delete.confirm')}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-neutral-300">{t('delete.subject', { name: modName })}</p>
        {loadingPreview ? (
          <div className="h-16 animate-pulse rounded bg-[#1f2329]" />
        ) : preview ? (
          <ul className="list-inside list-disc space-y-1 rounded border border-[#1f2329] bg-[#0f1114] p-3 text-sm text-neutral-400">
            <li>{t('delete.impactRows', { count: preview.dictionaryRows })}</li>
            <li>
              {preview.folderExists
                ? t('delete.impactFolder', { path: preview.folderPath })
                : t('delete.impactFolderMissing')}
            </li>
          </ul>
        ) : null}
        <p className="text-xs font-medium text-red-400">{t('delete.irreversible')}</p>
      </div>
    </ModalShell>
  )
}
