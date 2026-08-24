import { DEFAULT_AI_PROVIDER, DEFAULT_MODELS, isAiProvider } from '@/features/settings/aiProviders'
import { useConfig } from '@/hooks/useConfig'
import type { AiProviderId } from '@/types'

function clampInt(raw: string | undefined, min: number, max: number, fallback: number): number {
  const n = Number.parseInt(raw ?? '', 10)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function clampFloat(raw: string | undefined, min: number, max: number, fallback: number): number {
  const n = Number.parseFloat(raw ?? '')
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

// Reads AI-related config into typed values used by the settings, modal and batch flows.
export function useAISettings() {
  const { config, loading, set } = useConfig()

  const provider: AiProviderId = isAiProvider(config['ai_provider'])
    ? config['ai_provider']
    : DEFAULT_AI_PROVIDER

  const similarity = {
    enabled: config['ai_similarity_enabled'] !== 'false',
    count: clampInt(config['ai_similarity_count'], 1, 10, 3),
    minScore: clampFloat(config['ai_similarity_min_score'], 0, 1, 0.35)
  }

  const activePromptSlotId = config['ai_active_prompt_slot']
    ? Number(config['ai_active_prompt_slot'])
    : null

  const modelFor = (id: AiProviderId): string => config[`${id}_model`] || DEFAULT_MODELS[id]
  const keyFor = (id: AiProviderId): string => config[`${id}_key`] ?? ''

  return { config, loading, set, provider, similarity, activePromptSlotId, modelFor, keyFor }
}

// Fuse returns a distance (0 = best); the UI shows similarity (higher = best).
export function toSimilarity(fuseScore: number): number {
  return 1 - fuseScore
}
