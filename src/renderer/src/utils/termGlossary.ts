export interface TermGlossaryEntry {
  id: string
  source: string
  translation: string
}

export function getTermGlossaryStorageKey(
  projectKey: string,
  sourceLang: string,
  targetLang: string
): string {
  return `polyhedron.term-glossary:${projectKey}|${sourceLang}|${targetLang}`
}

export function loadTermGlossary(key: string): TermGlossaryEntry[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) ?? '[]')
    if (!Array.isArray(value)) return []
    return value.filter(
      (entry): entry is TermGlossaryEntry =>
        Boolean(
          entry &&
            typeof entry.id === 'string' &&
            typeof entry.source === 'string' &&
            typeof entry.translation === 'string' &&
            entry.source.trim() &&
            entry.translation.trim()
        )
    )
  } catch {
    return []
  }
}
