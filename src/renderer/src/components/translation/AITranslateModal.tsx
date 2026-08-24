import { BookOpen, Loader2, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ModalShell } from '@/components/shared/ModalShell'
import { PromptEditor } from '@/components/shared/PromptEditor'
import { getProviderMeta } from '@/features/settings/aiProviders'
import { useAISettings } from '@/hooks/useAISettings'
import { usePromptSlots } from '@/hooks/usePromptSlots'
import { getLocalizedErrorMessage } from '@/i18n/errors'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import type { SimilarEntry } from '@/types'
import { renderSource } from '@/utils/renderSource'

interface AITranslateModalProps {
  open: boolean
  source: string
  sourceLang: string
  targetLang: string
  onApply: (result: string) => void
  onClose: () => void
}

const MAX_VISIBLE_SIMS = 10

function scoreClass(similarity: number): string {
  if (similarity >= 0.75) return 'text-emerald-400'
  if (similarity >= 0.5) return 'text-amber-400'
  return 'text-neutral-400'
}

export function AITranslateModal({
  open,
  source,
  sourceLang,
  targetLang,
  onApply,
  onClose
}: AITranslateModalProps): React.JSX.Element | null {
  const { t } = useAppTranslation(['ai', 'common', 'toasts'])
  const { provider, similarity, activePromptSlotId, set } = useAISettings()
  const { slots, create, update } = usePromptSlots()

  const providerMeta = getProviderMeta(provider)

  const activeTemplate = useMemo(() => {
    const active = activePromptSlotId
      ? slots.find((s) => s.id === activePromptSlotId)
      : slots.find((s) => s.isDefault)
    return (active ?? slots.find((s) => s.isDefault))?.prompt ?? ''
  }, [slots, activePromptSlotId])

  const [prompt, setPrompt] = useState('')
  const [persist, setPersist] = useState(false)
  const [sims, setSims] = useState<SimilarEntry[]>([])
  const [checked, setChecked] = useState<Record<number, boolean>>({})
  const [translating, setTranslating] = useState(false)
  const promptInitialized = useRef(false)

  // Load the active prompt into the editor once slots are available.
  useEffect(() => {
    if (!open) {
      promptInitialized.current = false
      return
    }
    if (!promptInitialized.current && activeTemplate) {
      setPrompt(activeTemplate)
      promptInitialized.current = true
    }
  }, [open, activeTemplate])

  // Fetch similarity candidates (capped at 10 for display) and pre-check the passing top-N.
  useEffect(() => {
    if (!open || !similarity.enabled) {
      setSims([])
      setChecked({})
      return
    }
    let cancelled = false
    window.api.dictionary
      .similar({ text: source, lang1: sourceLang, lang2: targetLang, limit: MAX_VISIBLE_SIMS })
      .then((results) => {
        if (cancelled) return
        setSims(results)
        const preChecked: Record<number, boolean> = {}
        results
          .map((r, index) => ({ index, similarity: 1 - r.score }))
          .filter((r) => r.similarity >= similarity.minScore)
          .slice(0, similarity.count)
          .forEach((r) => {
            preChecked[r.index] = true
          })
        setChecked(preChecked)
      })
      .catch(() => {
        if (!cancelled) setSims([])
      })
    return () => {
      cancelled = true
    }
  }, [
    open,
    similarity.enabled,
    similarity.minScore,
    similarity.count,
    source,
    sourceLang,
    targetLang
  ])

  const chosenCount = Object.values(checked).filter(Boolean).length

  const toggle = (index: number): void => {
    setChecked((prev) => ({ ...prev, [index]: !prev[index] }))
  }

  const persistPrompt = async (): Promise<void> => {
    const active = activePromptSlotId
      ? slots.find((s) => s.id === activePromptSlotId)
      : slots.find((s) => s.isDefault)
    try {
      if (!active || active.isDefault) {
        const slot = await create(t('slots.copyName'), prompt)
        await set('ai_active_prompt_slot', String(slot.id))
      } else {
        await update(active.id, { prompt })
      }
      toast.success(t('ai.promptSaved', { ns: 'toasts' }))
    } catch (err) {
      toast.error(getLocalizedErrorMessage(err, t))
    }
  }

  const handleTranslate = async (): Promise<void> => {
    setTranslating(true)
    try {
      const examples = sims
        .filter((_, index) => checked[index])
        .map((s) => ({ src: s.original, tgt: s.translated }))
      const result = await window.api.ai.translate({
        provider,
        text: source,
        sourceLang,
        targetLang,
        prompt,
        examples
      })
      onApply(result)
      if (persist) await persistPrompt()
      onClose()
    } catch (err) {
      toast.error(getLocalizedErrorMessage(err, t))
    } finally {
      setTranslating(false)
    }
  }

  if (!open) return null

  return (
    <ModalShell
      open={open}
      title={t('modal.title')}
      icon={<Sparkles size={16} />}
      sizeClassName="max-w-2xl"
      onClose={onClose}
      footer={
        <>
          <span className="mr-auto flex items-center gap-1.5 text-xs text-neutral-500">
            <Sparkles size={12} />
            {providerMeta.name} ·{' '}
            {similarity.enabled
              ? t('modal.examplesN', { count: chosenCount })
              : t('modal.noContext')}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-md bg-neutral-800 px-4 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-700"
          >
            {t('actions.cancel', { ns: 'common' })}
          </button>
          <button
            type="button"
            onClick={() => void handleTranslate()}
            disabled={translating}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-amber-500/90 px-4 py-2 text-sm font-medium text-neutral-950 transition-colors hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {translating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            {t('modal.translate')}
          </button>
        </>
      }
    >
      <div className="flex max-h-[65vh] flex-col gap-5 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-neutral-700 [&::-webkit-scrollbar-track]:bg-neutral-900">
        <div>
          <div className="mb-1.5 text-[10px] font-semibold tracking-wide text-neutral-400 uppercase">
            {t('modal.source', { language: sourceLang })}
          </div>
          <div className="rounded-md border border-neutral-800 bg-[#0a0a0c] p-3 text-sm leading-relaxed whitespace-pre-wrap text-neutral-300">
            {renderSource(source)}
          </div>
        </div>

        {similarity.enabled && (
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-neutral-400 uppercase">
              <BookOpen size={12} />
              {t('modal.examples')}
              <span className="font-normal text-neutral-600 normal-case">
                {t('modal.showingSelected', { showing: sims.length, selected: chosenCount })}
              </span>
            </div>
            <div className="flex max-h-56 flex-col gap-1.5 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-neutral-700 [&::-webkit-scrollbar-track]:bg-neutral-900">
              {sims.length === 0 && (
                <div className="rounded-md border border-neutral-800 bg-[#0a0a0c] px-3 py-4 text-center text-xs text-neutral-600">
                  {t('modal.noExamples')}
                </div>
              )}
              {sims.map((sim, index) => {
                const similarityPct = 1 - sim.score
                const low = similarityPct < similarity.minScore
                return (
                  <label
                    // biome-ignore lint/suspicious/noArrayIndexKey: similarity results have no stable id
                    key={index}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-md border p-2.5 transition-colors ${
                      checked[index]
                        ? 'border-amber-500/50 bg-amber-500/5'
                        : 'border-neutral-800 bg-[#0a0a0c]'
                    } ${low ? 'opacity-60' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={!!checked[index]}
                      onChange={() => toggle(index)}
                      className="mt-0.5 accent-amber-500"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-neutral-300">{sim.original}</div>
                      <div className="truncate text-sm text-neutral-500">{sim.translated}</div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className={`font-mono text-xs ${scoreClass(similarityPct)}`}>
                        {(similarityPct * 100).toFixed(0)}%
                      </span>
                      {low && (
                        <span className="text-[10px] text-neutral-600">
                          {t('modal.belowThreshold')}
                        </span>
                      )}
                    </div>
                  </label>
                )
              })}
            </div>
            <p className="mt-2 text-xs text-neutral-500">{t('modal.appendNote')}</p>
          </div>
        )}

        <div>
          <div className="mb-1.5 text-[10px] font-semibold tracking-wide text-neutral-400 uppercase">
            {t('modal.linePrompt')}
          </div>
          <PromptEditor value={prompt} onChange={setPrompt} minHeightClassName="min-h-[160px]" />
          <label className="mt-2.5 flex cursor-pointer items-center gap-2 text-sm text-neutral-300">
            <input
              type="checkbox"
              checked={persist}
              onChange={() => setPersist((p) => !p)}
              className="accent-amber-500"
            />
            {t('modal.alsoUpdate')}
          </label>
        </div>
      </div>
    </ModalShell>
  )
}
