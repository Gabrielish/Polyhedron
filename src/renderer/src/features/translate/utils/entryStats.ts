import { isDeveloperNote, type TranslationSessionEntry } from '@/context/TranslationSession'

export function analyzeTranslateEntries(
  entries: TranslationSessionEntry[],
  hideDeveloperNotes: boolean
) {
  const visibleEntries = hideDeveloperNotes ? ([] as TranslationSessionEntry[]) : entries
  const sourceFlags = new Map<string, { tags: boolean; brackets: boolean }>()
  let translated = 0
  let untranslated = 0
  let verified = 0
  let dictionary = 0
  let tags = 0
  let brackets = 0
  let needsReview = 0
  for (const entry of entries) {
    if (hideDeveloperNotes && isDeveloperNote(entry.source)) continue
    if (hideDeveloperNotes) visibleEntries.push(entry)
    if (entry.target.trim()) {
      translated++
      if (entry.reviewStatus === 'verified') verified++
    } else untranslated++
    if (entry.matchType === 'mod-text' || entry.matchType === 'text') dictionary++
    if (entry.needsReview) needsReview++
    let flags = sourceFlags.get(entry.source)
    if (!flags) {
      flags = {
        tags: /(<[^>]+>|\{[^}]+\})/.test(entry.source.replace(/<\/?(?:i|br|b)\b[^>]*>/gi, '')),
        brackets: /\[[^\]\r\n]+\]/.test(entry.source)
      }
      sourceFlags.set(entry.source, flags)
    }
    if (flags.tags) tags++
    if (flags.brackets) brackets++
  }
  return {
    visibleEntries,
    translated,
    untranslated,
    verified,
    dictionary,
    tags,
    brackets,
    needsReview
  }
}

export type TranslateEntryStats = ReturnType<typeof analyzeTranslateEntries>
