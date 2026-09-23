import { BookOpen, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ModalShell } from '@/components/shared/ModalShell'
import { useAISettings } from '@/hooks/useAISettings'
import type { SimilarEntry } from '@/types'

interface SimilarityExamplesModalProps {
  open: boolean
  source: string
  sourceLang: string
  targetLang: string
  onClose: () => void
}

function scoreClass(score: number): string {
  if (score >= 0.75) return 'text-emerald-400'
  if (score >= 0.5) return 'text-amber-400'
  return 'text-neutral-400'
}

export function SimilarityExamplesModal({
  open,
  source,
  sourceLang,
  targetLang,
  onClose
}: SimilarityExamplesModalProps): React.JSX.Element | null {
  const { similarity } = useAISettings()
  const [examples, setExamples] = useState<SimilarEntry[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !source.trim()) return
    let cancelled = false
    setLoading(true)
    window.api.dictionary
      .similar({ text: source, lang1: sourceLang, lang2: targetLang, limit: 10 })
      .then((results) => {
        if (!cancelled) setExamples(results)
      })
      .catch(() => {
        if (!cancelled) setExamples([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, source, sourceLang, targetLang])

  return (
    <ModalShell
      open={open}
      title="Similarity examples"
      description={`${sourceLang} → ${targetLang}`}
      icon={<BookOpen size={16} />}
      sizeClassName="max-w-2xl"
      panelClassName="border-amber-500/20 bg-[#0a0b0d]/90 shadow-[0_16px_45px_rgba(0,0,0,0.52),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-2xl"
      onClose={onClose}
    >
      <div className="space-y-3">
        <div className="rounded-lg border border-white/10 bg-white/[0.045] p-3 text-sm text-neutral-100 shadow-inner shadow-white/[0.025]">
          {source}
        </div>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-xs text-neutral-500">
            <Loader2 size={14} className="animate-spin" /> Loading examples…
          </div>
        ) : examples.length === 0 ? (
          <div className="py-8 text-center text-xs text-neutral-600">
            No similar examples found.
          </div>
        ) : (
          <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
            {examples.map((example, index) => {
              const score = 1 - example.score
              return (
                <div
                  key={`${example.original}-${index}`}
                  className="group rounded-lg border border-white/10 bg-white/[0.035] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] transition-colors hover:border-amber-500/30 hover:bg-white/[0.06]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1 text-xs">
                      <div className="break-words text-neutral-200">{example.original}</div>
                      <div className="break-words text-neutral-500">{example.translated}</div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border border-current/20 bg-current/10 px-2 py-0.5 font-mono text-[10px] ${scoreClass(score)}`}
                    >
                      {(score * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <div className="text-[10px] text-neutral-600">
          {similarity.enabled
            ? `Configured for ${similarity.count} examples above ${Math.round(similarity.minScore * 100)}% similarity.`
            : 'Similarity examples are disabled for Gemini prompts.'}
        </div>
      </div>
    </ModalShell>
  )
}
