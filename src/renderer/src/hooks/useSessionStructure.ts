import { useMemo, useRef } from 'react'
import type { TranslationSessionEntry } from '@/context/TranslationSession'

// Source membership stays stable while targets, review state and history change.
export function useSessionStructure(entries: TranslationSessionEntry[]): TranslationSessionEntry[] {
  const structure = useRef(entries)
  return useMemo(() => {
    const previous = structure.current
    if (
      previous !== entries &&
      (previous.length !== entries.length ||
        entries.some(
          (entry, i) =>
            entry.rowId !== previous[i]?.rowId ||
            entry.source !== previous[i]?.source ||
            entry.uid !== previous[i]?.uid
        ))
    )
      structure.current = entries
    return structure.current
  }, [entries])
}
