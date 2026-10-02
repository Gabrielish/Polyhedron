import { XmlSelectionModal } from '@/features/translate/components/XmlSelectionModal'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import type { PreparedTranslationInput } from '@/types'
import { useMergeSetup } from '../hooks/useMergeSetup'
import type { SlotKey } from '../types'
import { MergeBottomBar } from './MergeBottomBar'
import { MergeFileStep } from './MergeFileStep'
import { MergeNameStep } from './MergeNameStep'

export function MergeToolScreen(): React.JSX.Element {
  const { t } = useAppTranslation('merge')
  const setup = useMergeSetup()
  const pendingSlot =
    setup.pendingSelection === 'source'
      ? setup.source
      : setup.pendingSelection === 'target'
        ? setup.target
        : null

  return (
    <>
      <div className="merge-tool-screen flex flex-col">
        <div className="flex shrink-0 items-center gap-3 border-b border-neutral-800/50 px-6 py-4">
          <span className="text-sm font-medium text-neutral-200">{t('title')}</span>
          <span className="flex-1" />
          <span className="flex items-center gap-2 font-mono text-[11px]">
            <span className={setup.step1Done ? 'text-amber-400' : 'text-neutral-600'}>
              1 {t('steps.source')}
            </span>
            <span className="text-neutral-700">-</span>
            <span className={setup.step2Done ? 'text-amber-400' : 'text-neutral-600'}>
              2 {t('steps.translated')}
            </span>
            <span className="text-neutral-700">-</span>
            <span className={setup.step3Done ? 'text-amber-400' : 'text-neutral-600'}>
              3 {t('steps.mod')}
            </span>
          </span>
        </div>

        <div className="merge-tool-scroll px-6">
          <div className="flex flex-col gap-0">
            <div className="grid grid-cols-1 md:grid-cols-2">
              <div className="md:border-r md:border-neutral-800/60 md:pr-6">
                <MergeFileStep
                  step="01"
                  title={t('sourceFile.title')}
                  description={t('sourceFile.description')}
                  slot={setup.source}
                  slotKey="source"
                  languages={setup.languages}
                  onLangChange={setup.setSourceLang}
                  onBrowse={setup.browseFile}
                  onDrop={setup.dropFile}
                  onDragChange={setup.setDragging}
                  onClear={setup.clearFile}
                />
              </div>

              <div className="md:pl-6">
                <MergeFileStep
                  step="02"
                  title={t('translatedFile.title')}
                  description={t('translatedFile.description')}
                  slot={setup.target}
                  slotKey="target"
                  languages={setup.languages}
                  accent
                  onLangChange={setup.setTargetLang}
                  onBrowse={setup.browseFile}
                  onDrop={setup.dropFile}
                  onDragChange={setup.setDragging}
                  onClear={setup.clearFile}
                />
              </div>
            </div>

            <MergeNameStep value={setup.modName} onChange={setup.setModName} />
          </div>
        </div>

        <MergeBottomBar
          ready={setup.ready}
          isRunning={setup.isRunning}
          progress={setup.progress}
          onCancel={() => {
            void setup.reset()
          }}
          onRun={() => {
            void setup.runMerge()
          }}
        />
      </div>

      {pendingSlot?.prepared && setup.pendingSelection && (
        <PendingSelectionModal
          prepared={pendingSlot.prepared}
          slotKey={setup.pendingSelection}
          onCancel={setup.closeSelection}
          onSelect={setup.selectCandidate}
        />
      )}
    </>
  )
}

interface PendingSelectionModalProps {
  prepared: PreparedTranslationInput
  slotKey: SlotKey
  onCancel: () => Promise<void>
  onSelect: (slotKey: SlotKey, candidateId: string) => void
}

function PendingSelectionModal({
  prepared,
  slotKey,
  onCancel,
  onSelect
}: PendingSelectionModalProps): React.JSX.Element {
  return (
    <XmlSelectionModal
      prepared={prepared}
      onCancel={onCancel}
      onSelect={async ([candidateId]) => {
        if (!candidateId) return
        onSelect(slotKey, candidateId)
      }}
    />
  )
}
