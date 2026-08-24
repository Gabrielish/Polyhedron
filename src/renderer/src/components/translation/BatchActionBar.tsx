import { Loader2, Sparkles } from 'lucide-react'
import { useAppTranslation } from '@/i18n/useAppTranslation'

interface BatchActionBarProps {
  selectedCount: number
  batchCompleted: number
  batchTotal: number
  onTranslateDeepL: () => void
  onTranslateGoogle: () => void
  onTranslateAI: () => void
  aiProviderName: string
  onCancelTranslation: () => void
  onClearSelection: () => void
  isTranslating: boolean
}

export function BatchActionBar({
  selectedCount,
  batchCompleted,
  batchTotal,
  onTranslateDeepL,
  onTranslateGoogle,
  onTranslateAI,
  aiProviderName,
  onCancelTranslation,
  onClearSelection,
  isTranslating
}: BatchActionBarProps): React.JSX.Element | null {
  const { t } = useAppTranslation(['translate', 'common', 'ai'])

  if (selectedCount === 0 && !isTranslating) return null

  return (
    <div className="flex shrink-0 items-center gap-3 border-t border-neutral-700 bg-neutral-900 px-4 py-3">
      <span className="shrink-0 text-sm text-neutral-400">
        {t('batchBar.selectedCount', { ns: 'translate', count: selectedCount })}
      </span>

      {isTranslating ? (
        <>
          <div className="flex items-center gap-2 text-sm text-neutral-400">
            <Loader2 size={14} className="animate-spin" />
            {t('batchBar.translating', {
              ns: 'translate',
              completed: batchCompleted,
              total: batchTotal || selectedCount
            })}
          </div>
          <button
            type="button"
            onClick={onCancelTranslation}
            className="cursor-pointer rounded-md border border-red-500/60 px-3 py-1.5 text-sm font-medium text-red-200 transition-colors hover:bg-red-500/10"
          >
            {t('batchBar.stop', { ns: 'translate' })}
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={onTranslateAI}
            className="flex cursor-pointer items-center gap-1.5 rounded-md bg-amber-500/90 px-3 py-1.5 text-sm font-medium text-neutral-950 transition-colors hover:bg-amber-500"
          >
            <Sparkles size={14} />
            {t('actions.translateWithAIProvider', { ns: 'ai', provider: aiProviderName })}
          </button>
          <button
            type="button"
            onClick={onTranslateDeepL}
            className="cursor-pointer rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            {t('batchBar.translateWithDeepL', { ns: 'translate' })}
          </button>
          <button
            type="button"
            onClick={onTranslateGoogle}
            className="cursor-pointer rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
          >
            {t('batchBar.translateWithGoogle', { ns: 'translate' })}
          </button>
        </>
      )}

      <button
        type="button"
        onClick={onClearSelection}
        disabled={isTranslating}
        className="ml-auto cursor-pointer text-xs text-neutral-500 transition-colors hover:text-neutral-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {t('batchBar.clearSelection', { ns: 'translate' })}
      </button>
    </div>
  )
}
