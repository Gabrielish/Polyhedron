import { Globe2, Languages, Loader2, Sparkles, Square, X } from 'lucide-react'
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

const actionButton = 'inline-flex h-7 items-center gap-1.5 rounded-md border border-[#2a2f37] bg-[#131518] px-2.5 text-[11px] font-semibold text-neutral-200 transition-colors hover:border-neutral-500 hover:bg-[#1c1f24]'

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
    <div className="translation-batch-action-bar flex shrink-0 flex-wrap items-center gap-2 border-b border-[#1f2329] bg-[#0c0d0f] px-5 py-1.5">
      <button
        type="button"
        onClick={onClearSelection}
        disabled={isTranslating}
        title={t('batchBar.clearSelection', { ns: 'translate' })}
        className="-ml-1 inline-flex h-7 w-7 items-center justify-center rounded-md border border-amber-500/40 bg-[#131518] text-amber-500 transition-colors hover:border-amber-400 hover:bg-amber-500/10 hover:text-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <X size={14} />
      </button>

      <span className="shrink-0 rounded-md border border-amber-500/30 bg-amber-500/5 px-2.5 py-1 text-[11px] font-semibold text-amber-300">
        {t('batchBar.selectedCount', { ns: 'translate', count: selectedCount })}
      </span>

      {isTranslating ? (
        <>
          <div className="flex items-center gap-2 px-1 text-xs text-neutral-400">
            <Loader2 size={14} className="animate-spin" />
            {t('batchBar.translating', { ns: 'translate', completed: batchCompleted, total: batchTotal || selectedCount })}
          </div>
          <button type="button" onClick={onCancelTranslation} title={t('batchBar.stop', { ns: 'translate' })} className={actionButton + ' border-red-500/40 text-red-200'}>
            <Square size={12} /> {t('batchBar.stop', { ns: 'translate' })}
          </button>
        </>
      ) : (
        <>
          <button type="button" onClick={onTranslateAI} title={t('actions.translateWithAIProvider', { ns: 'ai', provider: aiProviderName })} className={actionButton}>
            <Sparkles size={13} className="text-amber-400" /> Translate with {aiProviderName}
          </button>
          <button type="button" onClick={onTranslateDeepL} title={t('batchBar.translateWithDeepL', { ns: 'translate' })} className={actionButton}>
            <Languages size={13} className="text-blue-400" /> Translate with DeepL
          </button>
          <button type="button" onClick={onTranslateGoogle} title={t('batchBar.translateWithGoogle', { ns: 'translate' })} className={actionButton}>
            <Globe2 size={13} className="text-red-400" /> Translate with Google
          </button>
        </>
      )}
    </div>
  )
}
