import { AlertTriangle, Languages } from 'lucide-react'
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
      sizeClassName="max-w-lg"
      panelClassName="border-[#2a2f37] bg-[#111216]"
      icon={<AlertTriangle size={16} />}
      onClose={onClose}
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 cursor-pointer items-center rounded-md border border-neutral-700 bg-[#131518] px-3.5 text-xs font-medium text-neutral-300 transition-colors hover:border-neutral-600 hover:bg-neutral-800 hover:text-neutral-100"
          >
            {t('alreadyTranslatedDialog.cancel')}
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSendOnlyUntranslated}
              className="inline-flex h-9 cursor-pointer items-center whitespace-nowrap rounded-md border border-neutral-700 bg-[#131518] px-3.5 text-xs font-medium text-neutral-200 transition-colors hover:border-neutral-600 hover:bg-neutral-800"
            >
              {t('alreadyTranslatedDialog.onlyUntranslated', { untranslatedCount })}
            </button>
            <button
              type="button"
              onClick={onProceedAll}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-amber-500 bg-amber-500 px-4 text-xs font-semibold text-neutral-950 transition-colors hover:border-amber-400 hover:bg-amber-400"
            >
              <Languages size={13} aria-hidden="true" />
              {t('alreadyTranslatedDialog.proceedAll')}
            </button>
          </div>
        </div>
      }
    >
      <p className="text-sm leading-6 text-neutral-300">
        {t('alreadyTranslatedDialog.description', { translatedCount })}
      </p>
    </ModalShell>
  )
}
