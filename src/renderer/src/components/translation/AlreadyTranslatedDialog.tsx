import { AlertTriangle } from 'lucide-react'
import { ModalShell } from '@/components/shared/ModalShell'
import { useAppTranslation } from '@/i18n/useAppTranslation'

interface AlreadyTranslatedDialogProps {
  open: boolean
  translatedCount: number
  untranslatedCount: number
  onProceedAll(): void
  onSendOnlyUntranslated(): void
  onClose(): void
}

export function AlreadyTranslatedDialog({
  open,
  translatedCount,
  untranslatedCount,
  onProceedAll,
  onSendOnlyUntranslated,
  onClose
}: AlreadyTranslatedDialogProps): React.JSX.Element | null {
  const { t } = useAppTranslation('translate')

  return (
    <ModalShell
      open={open}
      title={t('alreadyTranslatedDialog.title')}
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
            {t('alreadyTranslatedDialog.cancel')}
          </button>
          <button
            type="button"
            onClick={onSendOnlyUntranslated}
            className="inline-flex h-8 cursor-pointer items-center rounded-md border border-neutral-700 bg-[#131518] px-3 text-xs font-medium text-neutral-200 transition-colors hover:bg-neutral-800"
          >
            {t('alreadyTranslatedDialog.onlyUntranslated', { untranslatedCount })}
          </button>
          <button
            type="button"
            onClick={onProceedAll}
            className="inline-flex h-8 cursor-pointer items-center rounded-md border border-amber-500 bg-amber-500 px-3 text-xs font-semibold text-neutral-950 transition-colors hover:border-amber-400 hover:bg-amber-400"
          >
            {t('alreadyTranslatedDialog.proceedAll')}
          </button>
        </>
      }
    >
      <p className="text-sm leading-6 text-neutral-300">
        {t('alreadyTranslatedDialog.description', { translatedCount })}
      </p>
    </ModalShell>
  )
}
