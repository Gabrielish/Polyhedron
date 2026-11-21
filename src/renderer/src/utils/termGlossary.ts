export interface TermGlossaryEntry {
  id: string
  source: string
  translation: string
}

export function countTermOccurrencesInCorpus(term: string, corpus: string): number {
  const needle = term.trim().toLocaleLowerCase()
  if (!needle) return 0

  let count = 0
  const isWordCharacter = (character: string | undefined): boolean =>
    Boolean(character && /[\p{L}\p{N}_]/u.test(character))
  let from = 0
  while (from < corpus.length) {
    const index = corpus.indexOf(needle, from)
    if (index < 0) break
    const end = index + needle.length
    if (!isWordCharacter(corpus[index - 1]) && !isWordCharacter(corpus[end])) {
      count += 1
      from = end
    } else {
      from = index + 1
    }
  }

  return count
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
    const parseEntries = (raw: string | null): TermGlossaryEntry[] => {
      if (!raw) return []
      const value = JSON.parse(raw)
      if (!Array.isArray(value)) return []
      return value.filter((entry): entry is TermGlossaryEntry =>
        Boolean(
          entry &&
            typeof entry.id === 'string' &&
            typeof entry.source === 'string' &&
            typeof entry.translation === 'string' &&
            entry.source.trim() &&
            entry.translation.trim()
        )
      )
    }
    const direct = parseEntries(window.localStorage.getItem(key))
    if (direct.length > 0) return direct

    // Migrate a glossary saved before the Icosa → Polyhedron rename. This is
    // intentionally local as well as cloud-side so an already-downloaded
    // legacy glossary remains visible after the app is rebuilt.
    const normalizeKey = (value: string): string =>
      value
        .replaceAll('\\', '/')
        .replace(/\/Application Support\/icosa\/icosa\//gi, '/Application Support/polyhedron/')
        .replace(/\/Application Support\/icosa\//gi, '/Application Support/polyhedron/')
    const normalizedKey = normalizeKey(key)
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const candidateKey = window.localStorage.key(index)
      if (!candidateKey || normalizeKey(candidateKey) !== normalizedKey) continue
      const legacyEntries = parseEntries(window.localStorage.getItem(candidateKey))
      if (legacyEntries.length === 0) continue
      window.localStorage.setItem(key, JSON.stringify(legacyEntries))
      return legacyEntries
    }
    return []
  } catch {
    return []
  }
}
