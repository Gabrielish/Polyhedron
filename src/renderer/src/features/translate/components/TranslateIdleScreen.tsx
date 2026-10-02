import { ArrowRight, File, Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import { cn } from '@/lib/utils'
import { ThemedSelect } from '@/components/shared/ThemedSelect'
import { useTranslateSetup } from '../hooks/useTranslateSetup'
import { useTranslationImport } from '../hooks/useTranslationImport'
import { GAME_PROFILES } from '../gameProfiles'
import type { TranslationSession } from '../types'
import { FileInputCard } from './FileInputCard'
import { LanguagePicker } from './LanguagePicker'
import { ModSelectionCard } from './ModSelectionCard'
import { btnPrimary } from './styles'
import { XmlSelectionModal } from './XmlSelectionModal'

interface TranslateIdleScreenProps {
  session: TranslationSession
}

function SetupCard({
  title,
  headerAction,
  children
}: {
  title: string
  headerAction?: React.ReactNode
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-800/80 bg-[#141416]">
      <div className="flex items-center justify-between gap-4 border-b border-neutral-800/50 px-6 py-3">
        <h2 className="text-sm font-medium text-neutral-200">{title}</h2>
        {headerAction}
      </div>
      <div>{children}</div>
    </div>
  )
}

export function TranslateIdleScreen({ session }: TranslateIdleScreenProps): React.JSX.Element {
  const { t } = useAppTranslation(['translate', 'common'])
  const setup = useTranslateSetup(session)
  const importFlow = useTranslationImport({
    session,
    sourceLang: setup.sourceLang,
    targetLang: setup.targetLang,
    modName: setup.modName,
    gameProfile: setup.gameProfile
  })
  const isLoading = session.phase === 'loading' || importFlow.isPreparing
  const baseLabel =
    importFlow.isPreparing && session.phase !== 'loading'
      ? t('setup.loadingPreparingFile', { ns: 'translate' })
      : session.loadingLabel || t('setup.loadingEditor', { ns: 'translate' })
  const loadingProgress = session.loadingProgress

  useEffect(() => {
    const handleOpenShortcut = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey)
        return
      if (
        event.target instanceof HTMLElement &&
        event.target.closest('input, textarea, select, button')
      )
        return
      if (!setup.ready || isLoading) return
      event.preventDefault()
      void importFlow.openFile(setup.filePath, setup.ready)
    }
    window.addEventListener('keydown', handleOpenShortcut)
    return () => window.removeEventListener('keydown', handleOpenShortcut)
  }, [importFlow.openFile, isLoading, setup.filePath, setup.ready])

  const loadingLabel = (() => {
    if (!loadingProgress || importFlow.isPreparing) return baseLabel
    if (loadingProgress.phase === 'unpacking')
      return t('setup.loadingUnpacking', { ns: 'translate' })
    if (loadingProgress.phase === 'parsing') return t('setup.loadingParsing', { ns: 'translate' })
    // - phases: unpacking, parsing, loading-cache, matching
    if (loadingProgress.phase === 'loading-cache')
      return t('setup.loadingCache', { ns: 'translate' })
    if (loadingProgress.phase === 'matching')
      return t('setup.loadingMatching', {
        ns: 'translate',
        processed: loadingProgress.processed.toLocaleString(),
        total: loadingProgress.total.toLocaleString()
      })
    return baseLabel
  })()

  return (
    <>
      <div className="translate-idle-shell relative flex h-full min-h-0 flex-col">
        <div className="translate-idle-content polyhedron-scroll min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
          <div className="p-8">
            <div className="mx-auto max-w-4xl space-y-6">
              <div className="app-page-header mb-8 flex items-center gap-3">
                <File className="h-5 w-5 shrink-0 text-amber-500" />
                <div className="min-w-0">
                  <h1 className="text-2xl font-semibold text-neutral-100">
                    {t('newProject', { ns: 'translate' })}
                  </h1>
                  <p className="mt-1 text-sm text-neutral-500">
                    Set up your language pair, project and localization file.
                  </p>
                </div>
              </div>

              <SetupCard
                title="Translation project"
                headerAction={
                  <div className="w-64 shrink-0">
                    <ThemedSelect
                      value={setup.gameProfile}
                      onChange={setup.handleGameProfileChange}
                      options={GAME_PROFILES.map((profile) => ({
                        value: profile.id,
                        label: profile.name,
                        searchText: `${profile.name} ${profile.id}`
                      }))}
                    />
                  </div>
                }
              >
                <div className="grid border-b border-neutral-800/50 lg:grid-cols-2">
                  <div className="border-b border-neutral-800/50 p-4 lg:border-b-0 lg:border-r">
                    <h3 className="mb-1 text-sm font-medium text-neutral-200">
                      {t('setup.languagePair.title', { ns: 'translate' })}
                    </h3>
                    <p className="mb-5 text-xs text-neutral-500">
                      {t('setup.languagePair.description', { ns: 'translate' })}
                    </p>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2.5">
                      <div>
                        <span className="mb-1.5 block text-[10px] font-semibold tracking-[0.08em] text-neutral-500 uppercase">
                          {t('setup.languagePair.source', { ns: 'translate' })}
                        </span>
                        <LanguagePicker
                          value={setup.sourceLang}
                          onChange={setup.handleSourceChange}
                          languages={setup.languages}
                        />
                      </div>
                      <div className="pb-2 text-neutral-600">
                        <ArrowRight size={16} />
                      </div>
                      <div>
                        <span className="mb-1.5 block text-[10px] font-semibold tracking-[0.08em] text-neutral-500 uppercase">
                          {t('setup.languagePair.target', { ns: 'translate' })}
                        </span>
                        <LanguagePicker
                          value={setup.targetLang}
                          onChange={setup.handleTargetChange}
                          languages={setup.languages}
                          accent
                        />
                      </div>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="text-sm font-medium text-neutral-200">Project</h3>
                    <p className="mb-5 mt-1 text-xs text-neutral-500">
                      {t('setup.modSelection.description', { ns: 'translate' })}
                    </p>
                    <ModSelectionCard
                      showHeader={false}
                      showModeToggle={false}
                      isNewMod={setup.isNewMod}
                      selectedMod={setup.selectedMod}
                      newModName={setup.newModName}
                      mods={setup.mods}
                      filteredMods={setup.filteredMods}
                      modSearch={setup.modSearch}
                      onExistingMode={() => setup.setIsNewMod(false)}
                      onNewMode={() => setup.setIsNewMod(true)}
                      onNewModNameChange={setup.setNewModName}
                      onModSearchChange={setup.handleModSearchChange}
                      onModSelect={setup.handleModSelect}
                      onModRename={setup.handleModRename}
                      onModDelete={setup.handleModDelete}
                    />
                  </div>
                </div>

                <div className="border-b border-neutral-800/50 p-4">
                  <h3 className="text-sm font-medium text-neutral-200">Localization file</h3>
                  <p className="mb-4 mt-1 text-xs text-neutral-500">
                    {t('setup.fileCard.description', { ns: 'translate' })}
                  </p>
                  <FileInputCard
                    showHeader={false}
                    fileName={setup.fileName}
                    acceptedExtensions={setup.gameProfileInfo.extensions}
                    isDragging={setup.isDragging}
                    onBrowse={setup.handleBrowse}
                    onDragOver={(event) => {
                      event.preventDefault()
                      setup.setIsDragging(true)
                    }}
                    onDragLeave={() => setup.setIsDragging(false)}
                    onDrop={setup.handleDrop}
                    onClear={setup.clearFile}
                  />
                </div>
              </SetupCard>

              <div className="overflow-hidden rounded-xl border border-neutral-800/80 bg-[#141416]">
                <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="text-xs text-neutral-500">
                    {setup.ready
                      ? t('setup.ready', {
                          ns: 'translate',
                          source: setup.srcLang?.name ?? setup.sourceLang,
                          target: setup.tgtLang?.name ?? setup.targetLang
                        })
                      : t('setup.idle', { ns: 'translate' })}
                  </div>
                  <button
                    type="button"
                    className={cn(
                      btnPrimary,
                      (!setup.ready || isLoading) && 'cursor-not-allowed opacity-40'
                    )}
                    disabled={!setup.ready || isLoading}
                    onClick={() => importFlow.openFile(setup.filePath, setup.ready)}
                  >
                    {isLoading ? <Loader2 size={13} className="animate-spin" /> : null}
                    {t('setup.openEditor', { ns: 'translate' })}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0f1114]/80 backdrop-blur-[2px]">
            <div className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-[#2a2f37] bg-[#131518] px-5 py-5 shadow-2xl">
              <div className="flex items-center gap-3">
                <Loader2 size={18} className="animate-spin text-amber-400" />
                <div className="text-sm font-semibold text-neutral-200">{loadingLabel}</div>
              </div>
              {loadingProgress?.phase === 'matching' && loadingProgress.total > 0 && (
                <div className="h-2 rounded-full bg-[#1d2127]">
                  <div
                    className="h-full rounded-full bg-amber-400/80 transition-[width] duration-200"
                    style={{
                      width: `${(loadingProgress.processed / loadingProgress.total) * 100}%`
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {importFlow.preparedImport && (
        <XmlSelectionModal
          prepared={importFlow.preparedImport}
          selectionMode="multi"
          onCancel={importFlow.closeImportModal}
          onSelect={(candidateIds) =>
            importFlow.preparedImport
              ? importFlow.completeImport(importFlow.preparedImport.importId, candidateIds)
              : Promise.resolve()
          }
        />
      )}
    </>
  )
}
