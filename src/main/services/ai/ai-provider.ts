import type { AiProviderId } from '../../../preload/api-types'

export type { AiProviderId }

export interface AiChatRequest {
  model: string
  prompt: string
  signal?: AbortSignal
  // Output cap for providers that require one (Anthropic). Grouped requests raise it,
  // since their reply is the sum of many translations.
  maxTokens?: number
}

// One interface, many senders. Every provider receives the same rendered prompt;
// only the HTTP shaping differs (see openai-compatible / anthropic adapters).
export interface AiProvider {
  chat(req: AiChatRequest): Promise<string>
}
