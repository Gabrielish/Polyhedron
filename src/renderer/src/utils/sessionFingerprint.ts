type FingerprintEntry = {
  uid: string
  target: string
  matchType: string
  needsReview: boolean
  reviewStatus?: string
  history?: unknown
}

// Same ordered FNV hash as workspace.service, with time slices for UI responsiveness.
export async function calculateSessionFingerprint(
  entries: readonly FingerprintEntry[],
  signal?: AbortSignal
): Promise<string> {
  let hash = 2166136261
  let offset = 0
  while (offset < entries.length) {
    if (signal?.aborted) throw new DOMException('Fingerprint cancelled', 'AbortError')
    const deadline = performance.now() + 6
    do {
      const entry = entries[offset++]!
      const value = `${entry.uid}\u0000${entry.target}\u0000${entry.matchType}\u0000${entry.needsReview}\u0000${entry.reviewStatus ?? ''}\u0000${JSON.stringify(entry.history ?? [])}`
      for (let i = 0; i < value.length; i++) {
        hash ^= value.charCodeAt(i)
        hash = Math.imul(hash, 16777619)
      }
    } while (offset < entries.length && performance.now() < deadline)
    if (offset < entries.length) await new Promise<void>((resolve) => setTimeout(resolve, 0))
  }
  if (signal?.aborted) throw new DOMException('Fingerprint cancelled', 'AbortError')
  return (hash >>> 0).toString(16)
}
