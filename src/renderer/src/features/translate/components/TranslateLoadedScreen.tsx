import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { AlreadyTranslatedDialog } from '@/components/translation/AlreadyTranslatedDialog'
import { BatchActionBar } from '@/components/translation/BatchActionBar'
import { QuotaExceededDialog } from '@/components/translation/QuotaExceededDialog'
import { TranslationGrid } from '@/components/translation/TranslationGrid'
import { useRetainedMemo } from '@/hooks/useRetainedMemo'
import { analyzeTranslateEntries } from '../utils/entryStats'
import { getProviderMeta } from '@/features/settings/aiProviders'
import { useAISettings } from '@/hooks/useAISettings'
import { useConfig } from '@/hooks/useConfig'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import type { Language } from '@/types'
import {
  getTermGlossaryStorageKey,
  loadTermGlossary,
  type TermGlossaryEntry
} from '@/utils/termGlossary'
import { useBatchTranslation } from '../hooks/useBatchTranslation'
import { DatabaseSaveError, saveTranslations } from '../utils/saveTranslations'
import { useLoadedEditorShortcuts } from '../hooks/useLoadedEditorShortcuts'
import { useTranslationExport } from '../hooks/useTranslationExport'
import type { TranslationSession } from '../types'
import { CreatureGuideModal } from './CreatureGuideModal'
import { EditorHeader } from './EditorHeader'
import { PackageExportModal } from './PackageExportModal'
import { TermGlossaryModal } from './TermGlossaryModal'

interface TranslateLoadedScreenProps {
  session: TranslationSession
}

export function TranslateLoadedScreen({ session }: TranslateLoadedScreenProps): React.JSX.Element {
  const { t } = useAppTranslation('translate')
  const [viewMode, setViewMode] = useState<'side' | 'stacked'>('side')
  const [isCompactViewport, setIsCompactViewport] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 899px)').matches
  )
  const [languages, setLanguages] = useState<Language[]>([])
  const [termGlossaryOpen, setTermGlossaryOpen] = useState(false)
  const [creatureGuideOpen, setCreatureGuideOpen] = useState(false)
  const termGlossaryProjectKey =
    session.storedPath ?? session.inputPath ?? session.modName ?? 'current'
  const termGlossaryKey = getTermGlossaryStorageKey(
    termGlossaryProjectKey,
    session.sourceLang,
    session.targetLang
  )
  const [termGlossary, setTermGlossary] = useState<TermGlossaryEntry[]>(() =>
    loadTermGlossary(termGlossaryKey)
  )
  const sessionRef = useRef(session)
  sessionRef.current = session
  const [isSaving, setIsSaving] = useState(false)
  const saveInProgress = useRef(false)
  const batch = useBatchTranslation(session)
  const exportFlow = useTranslationExport(session, languages)
  const { provider: aiProvider } = useAISettings()
  const { config } = useConfig()
  const hideDeveloperNotes = config['hide_developer_notes'] !== 'false'
  const entryStats = useRetainedMemo('translate:entry-stats',
    () => analyzeTranslateEntries(session.entries, hideDeveloperNotes),
    [session.entries, hideDeveloperNotes])
  const visibleEntries = entryStats.visibleEntries
  const translatedCount = entryStats.translated
  const total = visibleEntries.length
  const pct = total > 0 ? (translatedCount / total) * 100 : 0
  const verifiedCount = entryStats.verified
  const fileName = session.inputPath
    ? (session.inputPath.split(/[\\/]/).pop() ?? session.modName)
    : session.modName || t('loaded.defaultFileName')

  useEffect(() => {
    window.api.language.getAll().then(setLanguages)
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(termGlossaryKey, JSON.stringify(termGlossary))
    } catch {
      // Glossary remains available for the current session if storage is unavailable.
    }
  }, [termGlossary, termGlossaryKey])

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

  const handleSaveSession = useCallback(async () => {
    if (saveInProgress.current) return
    saveInProgress.current = true
    setIsSaving(true)
    try {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
      const latest = sessionRef.current
      const count = await saveTranslations(latest)
      toast.success(t(count > 0 ? 'translate.sessionAndDatabaseSaved' : 'translate.sessionSaved', { ns: 'toasts' }))
    } catch (error) {
      toast.error(error instanceof DatabaseSaveError
        ? `${t('translate.sessionSavedDatabaseFailed', { ns: 'toasts' })} ${String(error.cause)}`
        : String(error))
    } finally {
      saveInProgress.current = false
      setIsSaving(false)
    }
  }, [t])

  useLoadedEditorShortcuts({
    onSave: handleSaveSession,
    onCycleExportFormat: exportFlow.cycleExportFormat,
    onOpenExport: exportFlow.openExport
  })

  return (
    <div className="translate-page flex h-full min-h-0 min-w-0 flex-col overflow-x-hidden">
      <EditorHeader
        session={session}
        fileName={fileName}
        viewMode={isCompactViewport ? 'stacked' : viewMode}
        isSaving={isSaving}
        translatedCount={translatedCount}
        total={total}
        pct={pct}
        verifiedCount={verifiedCount}
        batchCompleted={batch.batchCompleted}
        batchTotal={batch.batchTotal}
        onViewModeChange={setViewMode}
        onSave={handleSaveSession}
        onOpenTermGlossary={() => setTermGlossaryOpen(true)}
      />

      <div className="flex-1 min-h-0">
        <TranslationGrid
          entries={visibleEntries}
          entryStats={entryStats}
          onEntryChange={session.updateEntry}
          onEntryManualEdit={handleEntryManualEdit}
          termGlossary={termGlossary}
          viewMode={isCompactViewport ? 'stacked' : viewMode}
          selectionActions={
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
          }
        />
      </div>

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

      <TermGlossaryModal
        open={termGlossaryOpen}
        sourceLang={session.sourceLang}
        targetLang={session.targetLang}
        entries={termGlossary}
        onChange={setTermGlossary}
        onOpenCreatureGuide={() => {
          setTermGlossaryOpen(false)
          setCreatureGuideOpen(true)
        }}
        onClose={() => setTermGlossaryOpen(false)}
      />

      <CreatureGuideModal
        open={creatureGuideOpen}
        targetLang={session.targetLang}
        termGlossary={termGlossary}
        onSaveToGlossary={(entry, translation) => {
          setTermGlossary((current) => {
            const existing = current.find(
              (item) =>
                item.source.trim().toLocaleLowerCase() === entry.name.trim().toLocaleLowerCase()
            )
            if (existing) {
              return current.map((item) =>
                item.id === existing.id ? { ...item, translation } : item
              )
            }
            return [
              ...current,
              {
                id: `creature-${entry.id}`,
                source: entry.name,
                translation
              }
            ]
          })
          toast.success(`${entry.name} saved to Term Glossary`)
        }}
        onClose={() => setCreatureGuideOpen(false)}
      />
    </div>
  )
}
