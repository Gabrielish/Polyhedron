import { encodeEntities } from '@/lib/xmlEntities'
import type { TranslationSession } from '../types'

export class DatabaseSaveError extends Error {
  constructor(cause: unknown) {
    super('Session saved, but reusable translations could not be saved.', { cause })
    this.name = 'DatabaseSaveError'
  }
}

const savedSnapshots = new Map<
  string,
  { revision: string; entries: Map<string, TranslationSession['entries'][number]> }
>()

export async function saveTranslations(session: TranslationSession): Promise<number> {
  const { entries, sourceLang, targetLang, modName } = session
  const key = `${session.storedPath ?? session.inputPath ?? modName}|${sourceLang}|${targetLang}`
  const revisionPromise = window.api.dictionary.revision().catch(() => null)
  await window.api.session.save({
    key,
    entries: entries.map(
      ({ uid, source, target, genderTargets, matchType, needsReview, reviewStatus, history }) => ({
        uid,
        source,
        target,
        genderTargets,
        matchType,
        needsReview,
        reviewStatus,
        history
      })
    )
  })
  const translated = entries.filter((entry) => entry.target.trim() !== '')
  if (translated.length === 0) return 0
  const revision = await revisionPromise
  const previous = savedSnapshots.get(key)
  const changed =
    previous && revision === previous.revision
      ? translated.filter((entry) => previous.entries.get(entry.rowId) !== entry)
      : translated
  if (changed.length === 0) return translated.length
  try {
    await window.api.dictionary.bulkUpsert(
      changed.map((entry) => ({
        language1: sourceLang,
        language2: targetLang,
        textLanguage1: encodeEntities(entry.source),
        textLanguage2: encodeEntities(entry.target),
        modName: modName || null,
        uid: entry.uid || null
      }))
    )
    const savedRevision = await window.api.dictionary.revision().catch(() => null)
    if (savedRevision === null) {
      savedSnapshots.delete(key)
      return translated.length
    }
    if (savedSnapshots.size >= 2 && !savedSnapshots.has(key))
      savedSnapshots.delete(savedSnapshots.keys().next().value!)
    savedSnapshots.set(key, {
      revision: savedRevision,
      entries: new Map(translated.map((entry) => [entry.rowId, entry]))
    })
  } catch (error) {
    throw new DatabaseSaveError(error)
  }
  return translated.length
}
