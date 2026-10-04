import type { TranslationSessionEntry } from '@/context/TranslationSession'

type LoadedEntry = Awaited<ReturnType<typeof window.api.xml.load>>[number]
type SavedEntries = Awaited<ReturnType<typeof window.api.session.load>>

// Merge the saved overlay and assign stable row ids in one pass. UID duplicates
// retain the existing last-saved-entry-wins behavior, including gender/history.
export function prepareSessionEntries(
  entries: LoadedEntry[],
  saved: SavedEntries
): TranslationSessionEntry[] {
  const savedByUid = new Map(saved?.map((entry) => [entry.uid, entry]))
  return entries.map((entry, index) => {
    const previous = savedByUid.get(entry.uid)
    if (!previous) return { ...entry, rowId: `row-${index}` }
    const hasSavedTarget = Boolean(previous.target.trim())
    return {
      ...entry,
      rowId: `row-${index}`,
      target: hasSavedTarget || previous.needsReview ? previous.target : entry.target,
      matchType:
        hasSavedTarget || previous.matchType === 'manual' ? previous.matchType : entry.matchType,
      needsReview: previous.needsReview === true,
      reviewStatus: previous.reviewStatus ?? (hasSavedTarget ? 'needs-review' : 'untranslated'),
      genderTargets: previous.genderTargets ?? entry.genderTargets,
      history: previous.history ?? entry.history
    }
  })
}
