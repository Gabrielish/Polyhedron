// Exact lookup first; the legacy substring fallback keeps the first session row.
// Normalization is done while building bySource, never inside a catalog x session loop.
export function createSourceResolver<T>(
  bySource: Map<string, T[]>,
  normalize: (value: string) => string,
  fallbackSources: Map<string, T[]> = bySource
) {
  const cache = new Map<string, T | undefined>()
  return (source: string): T | undefined => {
    const target = normalize(source)
    if (cache.has(target)) return cache.get(target)
    let match = bySource.get(target)?.[0]
    if (!match) {
      for (const [candidate, entries] of fallbackSources) {
        if (candidate.includes(target) || target.includes(candidate)) {
          match = entries[0]
          break
        }
      }
    }
    cache.set(target, match)
    return match
  }
}
