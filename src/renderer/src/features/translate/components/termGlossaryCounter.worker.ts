import { countTermOccurrencesInCorpus } from '@/utils/termGlossary'

interface GlossaryCounterRequest {
  sourceTexts: string[]
  terms: Array<{ id: string; source: string }>
}

self.addEventListener('message', (event: MessageEvent<GlossaryCounterRequest>) => {
  const { sourceTexts, terms } = event.data
  const corpus = sourceTexts.join('\u0000').toLocaleLowerCase()
  const counts = Object.fromEntries(
    terms.map(({ id, source }) => [id, countTermOccurrencesInCorpus(source, corpus)])
  )
  self.postMessage(counts)
})
