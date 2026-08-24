import type { AiProviderId, AiSimilarityExample } from '../../../preload/api-types'
import { type BatchGroupEntry, GROUP_REQUEST_MAX_TOKENS } from './batch-grouping'
import { parseGroupResponse } from './group-format'
import { renderGroupPrompt, renderPrompt } from './prompt-builder'
import { createAiProvider } from './provider-registry'

export interface AiTranslateParams {
  providerId: AiProviderId
  apiKey: string
  model: string
  template: string
  sourceText: string
  targetText: string
  sourceLangName: string
  targetLangName: string
  examples?: AiSimilarityExample[]
  signal?: AbortSignal
}

// Shared by every AI entry point (single line, grid batch, .pak pipeline): render the
// template with the four variables + reference examples, then hand the finished prompt to
// the provider adapter. The wrapper is the only thing that knows how to talk to each API.
export async function aiTranslate(params: AiTranslateParams): Promise<string> {
  const prompt = renderPrompt({
    template: params.template,
    sourceText: params.sourceText,
    targetText: params.targetText,
    sourceLangName: params.sourceLangName,
    targetLangName: params.targetLangName,
    examples: params.examples
  })

  const provider = createAiProvider(params.providerId, params.apiKey)
  return provider.chat({ model: params.model, prompt, signal: params.signal })
}

export interface AiTranslateGroupParams {
  providerId: AiProviderId
  apiKey: string
  model: string
  template: string
  entries: BatchGroupEntry[]
  sourceLangName: string
  targetLangName: string
  examples: AiSimilarityExample[]
  signal?: AbortSignal
}

export interface AiTranslateGroupResult {
  // uid -> translated text, for the lines the model answered with a valid marker.
  translations: Map<string, string>
  // Lines the reply skipped or misnumbered - the caller retries these individually.
  missedUids: string[]
}

// Grouped variant used by the grid batch: one request carries N numbered lines and the
// reply is parsed back by marker. Never throws on a malformed reply - misses are
// reported so the caller can fall back to per-line translation (precision first).
export async function aiTranslateGroup(
  params: AiTranslateGroupParams
): Promise<AiTranslateGroupResult> {
  const prompt = renderGroupPrompt({
    template: params.template,
    sources: params.entries.map((entry) => entry.source),
    sourceLangName: params.sourceLangName,
    targetLangName: params.targetLangName,
    examples: params.examples
  })

  const provider = createAiProvider(params.providerId, params.apiKey)
  const raw = await provider.chat({
    model: params.model,
    prompt,
    signal: params.signal,
    maxTokens: GROUP_REQUEST_MAX_TOKENS
  })

  const byIndex = parseGroupResponse(raw, params.entries.length)
  const translations = new Map<string, string>()
  const missedUids: string[] = []

  params.entries.forEach((entry, i) => {
    const text = byIndex.get(i + 1)
    if (text !== undefined) translations.set(entry.uid, text)
    else missedUids.push(entry.uid)
  })

  return { translations, missedUids }
}
