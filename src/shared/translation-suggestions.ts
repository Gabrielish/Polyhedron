export interface SuggestionSource {
  id: string
  name: string
  enabled: boolean
  builtin?: 'traducere1.xml' | 'traducere2.xml'
  available: boolean
}
export interface TranslationSuggestionPair {
  one: string
  two: string
  items: Array<{ sourceId: string; sourceName: string; text: string }>
}
export type SuggestionMap = Record<string, TranslationSuggestionPair>
