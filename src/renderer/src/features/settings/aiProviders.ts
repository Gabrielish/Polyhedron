import type { AiProviderId, ConfigKey } from '@/types'

export interface AiProviderMeta {
  id: AiProviderId
  name: string
  // Short label for compact spots like the per-row translate button (e.g. "Claude").
  short: string
  // Short monogram shown in the colored badge (matches design/ai.jsx).
  mark: string
  color: string
  models: string[]
  keyConfigKey: ConfigKey
  modelConfigKey: ConfigKey
  keyPlaceholder: string
}

export const AI_PROVIDERS: AiProviderMeta[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    short: 'GPT',
    mark: 'AI',
    color: '#10a37f',
    models: ['gpt-4o', 'gpt-4o-mini', 'o3-mini'],
    keyConfigKey: 'openai_key',
    modelConfigKey: 'openai_model',
    keyPlaceholder: 'sk-...'
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    short: 'Claude',
    mark: 'AN',
    color: '#d97757',
    models: ['claude-opus-4-8', 'claude-sonnet-5', 'claude-haiku-4-5-20251001'],
    keyConfigKey: 'anthropic_key',
    modelConfigKey: 'anthropic_model',
    keyPlaceholder: 'sk-ant-...'
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    short: 'Gemini',
    mark: 'GM',
    color: '#4285f4',
    models: ['gemini-2.5-pro', 'gemini-2.5-flash'],
    keyConfigKey: 'gemini_key',
    modelConfigKey: 'gemini_model',
    keyPlaceholder: 'AIza... / AQ...'
  },
  {
    id: 'grok',
    name: 'xAI Grok',
    short: 'Grok',
    mark: 'GR',
    color: '#8b8b8b',
    models: ['grok-4', 'grok-3'],
    keyConfigKey: 'grok_key',
    modelConfigKey: 'grok_model',
    keyPlaceholder: 'xai-...'
  }
]

export const AI_PROVIDER_IDS = AI_PROVIDERS.map((p) => p.id)
export const DEFAULT_AI_PROVIDER: AiProviderId = 'gemini'

export const DEFAULT_MODELS: Record<AiProviderId, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-sonnet-5',
  gemini: 'gemini-2.5-flash',
  grok: 'grok-4'
}

export function isAiProvider(value: string | undefined | null): value is AiProviderId {
  return !!value && (AI_PROVIDER_IDS as string[]).includes(value)
}

export function getProviderMeta(id: AiProviderId): AiProviderMeta {
  return AI_PROVIDERS.find((p) => p.id === id) ?? AI_PROVIDERS[0]
}
