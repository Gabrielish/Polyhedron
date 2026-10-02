import { ArrowRight, File, Loader2, Sparkles } from 'lucide-react'
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
      if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, button')) return
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
        <header className="translate-idle-header shrink-0 border-b border-[#1f2329] bg-[#101114] px-6 py-5">
          <div className="mx-auto flex max-w-240 items-center justify-between gap-5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-amber-500/25 bg-amber-500/10 text-amber-400 shadow-[0_0_24px_rgba(245,158,11,0.08)]">
                <Sparkles size={17} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold text-neutral-100">
                  <File size={14} className="text-amber-400" />
                  {t('newProject', { ns: 'translate' })}
                </div>
                <p className="mt-0.5 truncate text-xs text-neutral-500">Set up your language pair, project and localization file.</p>
              </div>
            </div>
          </div>
        </header>

        <div className="translate-idle-content polyhedron-scroll min-h-0 flex-1 overflow-y-auto px-6 py-8 [scrollbar-gutter:stable]">
          <div className="mx-auto max-w-240 overflow-hidden rounded-2xl border border-neutral-800/90 bg-[#141416] shadow-[0_18px_70px_rgba(0,0,0,0.28)]">
            <div className="border-b border-neutral-800/80 px-7 py-5">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div>
                  <div className="text-[15px] font-semibold tracking-tight text-neutral-100">Choose a game profile</div>
                  <p className="mt-1 text-xs text-neutral-500">The profile controls which localization files Polyhedron accepts.</p>
                </div>
                <div className="w-64">
                  <ThemedSelect
                    value={setup.gameProfile}
                    onChange={setup.handleGameProfileChange}
                    options={GAME_PROFILES.map((profile) => ({ value: profile.id, label: profile.name, searchText: `${profile.name} ${profile.id}` }))}
                  />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 text-[11px] text-neutral-500">
                <span className="rounded-md border border-amber-500/20 bg-amber-500/8 px-2 py-1 font-mono text-amber-300">{setup.gameProfile.toUpperCase()}</span>
                {setup.gameProfileInfo.description}
              </div>
            </div>

            <div className="grid gap-0 border-b border-neutral-800/80 lg:grid-cols-[1fr_1fr]">
              <section className="border-b border-neutral-800/80 px-7 py-6 lg:border-b-0 lg:border-r">
                <div className="mb-4">
                  <h3 className="m-0 text-[15px] font-semibold tracking-tight text-neutral-100">{t('setup.languagePair.title', { ns: 'translate' })}</h3>
                  <p className="mt-1 m-0 text-xs text-neutral-500">{t('setup.languagePair.description', { ns: 'translate' })}</p>
                </div>
                <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2.5">
                  <div>
                    <span className="mb-1.5 block text-[10px] font-semibold tracking-[0.08em] text-neutral-500 uppercase">{t('setup.languagePair.source', { ns: 'translate' })}</span>
                    <LanguagePicker value={setup.sourceLang} onChange={setup.handleSourceChange} languages={setup.languages} />
                  </div>
                  <div className="pb-2 text-neutral-600"><ArrowRight size={16} /></div>
                  <div>
                    <span className="mb-1.5 block text-[10px] font-semibold tracking-[0.08em] text-neutral-500 uppercase">{t('setup.languagePair.target', { ns: 'translate' })}</span>
                    <LanguagePicker value={setup.targetLang} onChange={setup.handleTargetChange} languages={setup.languages} accent />
                  </div>
                </div>
              </section>

              <section className="px-7 py-6">
                <ModSelectionCard
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
                />
              </section>
            </div>

            <section className="px-7 py-6">
              <FileInputCard
                fileName={setup.fileName}
                acceptedExtensions={setup.gameProfileInfo.extensions}
                isDragging={setup.isDragging}
                onBrowse={setup.handleBrowse}
                onDragOver={(event) => { event.preventDefault(); setup.setIsDragging(true) }}
                onDragLeave={() => setup.setIsDragging(false)}
                onDrop={setup.handleDrop}
                onClear={setup.clearFile}
              />
            </section>

            <div className="flex flex-wrap items-center gap-3 border-t border-neutral-800/80 bg-[#101114] px-7 py-4">
              <div className="flex-1 text-xs text-neutral-500">
                {setup.ready ? t('setup.ready', { ns: 'translate', source: setup.srcLang?.name ?? setup.sourceLang, target: setup.tgtLang?.name ?? setup.targetLang }) : t('setup.idle', { ns: 'translate' })}
              </div>
              <button type="button" className={cn(btnPrimary, (!setup.ready || isLoading) && 'cursor-not-allowed opacity-40')} disabled={!setup.ready || isLoading} onClick={() => importFlow.openFile(setup.filePath, setup.ready)}>
                {isLoading ? <Loader2 size={13} className="animate-spin" /> : null}
                {t('setup.openEditor', { ns: 'translate' })}
              </button>
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
