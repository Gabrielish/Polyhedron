import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AlreadyTranslatedDialog } from '@/components/translation/AlreadyTranslatedDialog'
import { BatchActionBar } from '@/components/translation/BatchActionBar'
import { QuotaExceededDialog } from '@/components/translation/QuotaExceededDialog'
import { TranslationGrid } from '@/components/translation/TranslationGrid'
import { getProviderMeta } from '@/features/settings/aiProviders'
import { useAISettings } from '@/hooks/useAISettings'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import type { Language } from '@/types'
import { useBatchTranslation } from '../hooks/useBatchTranslation'
import { useDictionarySave } from '../hooks/useDictionarySave'
import { useLoadedEditorShortcuts } from '../hooks/useLoadedEditorShortcuts'
import { useTranslationExport } from '../hooks/useTranslationExport'
import type { TranslationSession } from '../types'
import { EditorHeader } from './EditorHeader'
import { PackageExportModal } from './PackageExportModal'

interface TranslateLoadedScreenProps {
  session: TranslationSession
}

export function TranslateLoadedScreen({ session }: TranslateLoadedScreenProps): React.JSX.Element {
  const { t } = useAppTranslation('translate')
  const [viewMode, setViewMode] = useState<'side' | 'stacked'>('side')
  const [isCompactViewport, setIsCompactViewport] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 899px)').matches
  )
  const [languages, setLanguages] = useState<Language[]>([])
  const dictionarySave = useDictionarySave(session)
  const batch = useBatchTranslation(session)
  const exportFlow = useTranslationExport(session, languages)
  const { provider: aiProvider } = useAISettings()

  const translatedCount = session.entries.filter((entry) => entry.target.trim() !== '').length
  const total = session.entries.length
  const pct = total > 0 ? (translatedCount / total) * 100 : 0
  const fileName = session.inputPath
    ? (session.inputPath.split(/[\\/]/).pop() ?? session.modName)
    : session.modName || t('loaded.defaultFileName')

  useEffect(() => {
    window.api.language.getAll().then(setLanguages)
  }, [])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 899px)')
    const handleViewportChange = () => setIsCompactViewport(mediaQuery.matches)
    handleViewportChange()
    mediaQuery.addEventListener('change', handleViewportChange)
    return () => mediaQuery.removeEventListener('change', handleViewportChange)
  }, [])

  const handleEntryManualEdit = useCallback(
    (rowId: string) => {
      session.markManual(rowId)
    },
    [session]
  )

  const handleSaveToDictionary = useCallback(async () => {
    const confirmed = window.confirm(
      'Save the current translations to the Glossary? This will update reusable glossary entries.'
    )
    if (confirmed) await dictionarySave.saveAll()
  }, [dictionarySave.saveAll])

  const handleSaveSession = useCallback(async () => {
    const sessionKey = `${session.storedPath ?? session.inputPath ?? session.modName}|${session.sourceLang}|${session.targetLang}`
    try {
      await window.api.session.save({
        key: sessionKey,
        entries: session.entries.map(({ uid, target, matchType, needsReview }) => ({
          uid,
          target,
          matchType,
          needsReview
        }))
      })
      toast.success(t('translate.sessionSaved', { ns: 'toasts' }))
    } catch (error) {
      toast.error(String(error))
    }
  }, [session.entries, session.inputPath, session.storedPath, t])

  useLoadedEditorShortcuts({
    onSave: handleSaveSession,
    onCycleExportFormat: exportFlow.cycleExportFormat,
    onOpenExport: exportFlow.openExport
  })

  return (
    <div className="flex flex-col h-full min-h-0">
      <EditorHeader
        session={session}
        fileName={fileName}
        viewMode={isCompactViewport ? 'stacked' : viewMode}
        isSaving={dictionarySave.isSaving}
        translatedCount={translatedCount}
        total={total}
        pct={pct}
        batchCompleted={batch.batchCompleted}
        batchTotal={batch.batchTotal}
        onViewModeChange={setViewMode}
        onSave={handleSaveSession}
        onSaveToGlossary={handleSaveToDictionary}
      />

      <div className="flex-1 min-h-0">
        <TranslationGrid
          entries={session.entries}
          onEntryChange={session.updateEntry}
          onEntryManualEdit={handleEntryManualEdit}
          viewMode={isCompactViewport ? 'stacked' : viewMode}
        />
      </div>

      <BatchActionBar
        selectedCount={session.selectedCount}
        batchCompleted={batch.batchCompleted}
        batchTotal={batch.batchTotal}
        onTranslateDeepL={() => batch.batchTranslate('deepl')}
        onTranslateGoogle={() => batch.batchTranslate('google')}
        onTranslateAI={() => batch.batchTranslate(aiProvider)}
        aiProviderName={getProviderMeta(aiProvider).name}
        onCancelTranslation={batch.cancelBatch}
        onClearSelection={session.clearSelection}
        isTranslating={batch.isBatchTranslating}
      />

      <AlreadyTranslatedDialog
        open={batch.pendingDecision}
        translatedCount={batch.pendingTranslatedCount}
        untranslatedCount={batch.pendingUntranslatedCount}
        onProceedAll={batch.confirmProceedAll}
        onSendOnlyUntranslated={batch.confirmSendOnlyUntranslated}
        onClose={batch.cancelPending}
      />

      {exportFlow.exportMeta && (
        <PackageExportModal
          meta={exportFlow.exportMeta}
          languages={languages}
          selectedLanguageFolder={exportFlow.bg3LanguageFolder}
          isExporting={exportFlow.isExporting}
          onCancel={exportFlow.closeExportModal}
          onSubmit={exportFlow.submitPackageExport}
        />
      )}

      <QuotaExceededDialog
        open={batch.quotaExceeded !== null}
        service={batch.quotaExceeded?.service ?? ''}
        remaining={batch.quotaExceeded?.remaining ?? 0}
        requested={batch.quotaExceeded?.requested ?? 0}
        allowedEntries={batch.quotaExceeded?.allowedEntries}
        totalEntries={batch.quotaExceeded?.totalEntries}
        renewalAt={batch.quotaExceeded?.renewalAt}
        onConfirmPartial={
          batch.quotaExceeded && batch.quotaExceeded.allowedEntries > 0
            ? batch.confirmPartialBatch
            : undefined
        }
        onClose={batch.dismissQuotaExceeded}
      />
    </div>
  )
}
