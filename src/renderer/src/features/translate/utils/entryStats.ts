import {
  hasCapitalizationMismatch,
  isDeveloperNote,
  type TranslationSessionEntry
} from '@/context/TranslationSession'
import { larianTagSignature } from '@/utils/larianTags'
import { quoteStyleSignature, quoteStyleSignaturesMismatch } from '@/utils/quoteStyle'

export function analyzeTranslateEntries(
  entries: TranslationSessionEntry[],
  hideDeveloperNotes: boolean
) {
  const visibleEntries = hideDeveloperNotes ? ([] as TranslationSessionEntry[]) : entries
  const sourceFlags = new Map<
    string,
    { tags: boolean; brackets: boolean; larianTagSignature: string; quoteStyleSignature: string }
  >()
  let translated = 0
  let untranslated = 0
  let verified = 0
  let dictionary = 0
  let tags = 0
  let brackets = 0
  let needsReview = 0
  let warnings = 0
  let quoteMismatches = 0
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
        brackets: /\[[^\]\r\n]+\]/.test(entry.source),
        larianTagSignature: larianTagSignature(entry.source),
        quoteStyleSignature: quoteStyleSignature(entry.source)
      }
      sourceFlags.set(entry.source, flags)
    }
    if (flags.tags) tags++
    if (flags.brackets) brackets++
    let hasTagMismatch = false
    if (entry.target.trim()) {
      const targetTagSignature = larianTagSignature(entry.target)
      hasTagMismatch =
        (flags.larianTagSignature !== '[]' || targetTagSignature !== '[]') &&
        flags.larianTagSignature !== targetTagSignature
    }
    const hasCaseMismatch = hasCapitalizationMismatch(entry)
    const hasQuotesMismatch = entry.target.trim()
      ? quoteStyleSignaturesMismatch(flags.quoteStyleSignature, quoteStyleSignature(entry.target))
      : false
    if (hasTagMismatch || hasCaseMismatch) warnings++
    if (hasQuotesMismatch) quoteMismatches++
  }
  return {
    visibleEntries,
    translated,
    untranslated,
    verified,
    dictionary,
    tags,
    brackets,
    needsReview,
    warnings,
    quoteMismatches
  }
}

export type TranslateEntryStats = ReturnType<typeof analyzeTranslateEntries>
