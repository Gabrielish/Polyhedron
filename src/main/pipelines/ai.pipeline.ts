import type { AiProviderId } from '../../preload/api-types'
import { LanguageRepository } from '../database/repositories/language.repo'
import { aiTranslate } from '../services/ai/ai-translate.service'
import { filterExamples } from '../services/ai/prompt-builder'
import type { SimilarEntry } from '../services/similarity.service'
import { BasePipeline } from './base.pipeline'

export interface AiPipelineSimilarity {
  enabled: boolean
  count: number
  minScore: number
}

// LLM translation for the full-mod .pak flow. Reuses BasePipeline's unpack/match/similarity
// orchestration; only translate() differs: render the configured prompt + reference examples
// and send it through the provider wrapper.
export class AIPipeline extends BasePipeline {
  private langRepo?: LanguageRepository
  private readonly nameCache = new Map<string, string>()

  constructor(
    private readonly providerId: AiProviderId,
    private readonly apiKey: string,
    private readonly model: string,
    private readonly template: string,
    private readonly similarity: AiPipelineSimilarity
  ) {
    super()
    if (similarity.enabled) this.similarityLimit = Math.max(1, similarity.count)
  }

  async translate(
    text: string,
    sourceLang: string,
    targetLang: string,
    context: SimilarEntry[] = []
  ): Promise<string> {
    const examples = this.similarity.enabled
      ? filterExamples(context, {
          count: this.similarity.count,
          minScore: this.similarity.minScore
        })
      : []

    return aiTranslate({
      providerId: this.providerId,
      apiKey: this.apiKey,
      model: this.model,
      template: this.template,
      sourceText: text,
      targetText: '',
      sourceLangName: this.langName(sourceLang),
      targetLangName: this.langName(targetLang),
      examples,
      signal: this.ctx.signal
    })
  }

  private langName(code: string): string {
    const cached = this.nameCache.get(code)
    if (cached) return cached
    this.langRepo ??= new LanguageRepository(this.ctx.db)
    const name = this.langRepo.findByCode(code)?.name ?? code
    this.nameCache.set(code, name)
    return name
  }
}
