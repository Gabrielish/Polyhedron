import Fuse from 'fuse.js'
import type { SimilarityRow } from '../database/repositories/dictionary.repo'

export interface SimilarEntry {
  original: string
  translated: string
  score: number
}

const FUSE_OPTIONS = {
  keys: ['source'],
  includeScore: true,
  threshold: 0.6
}

export class SimilarityIndex {
  private fuse: Fuse<SimilarityRow>
  private count: number

  constructor(corpus: SimilarityRow[]) {
    this.fuse = new Fuse(corpus, FUSE_OPTIONS)
    this.count = corpus.length
  }

  add(entry: SimilarityRow): void {
    this.fuse.add(entry)
    this.count++
  }

  search(text: string, limit = 5): SimilarEntry[] {
    if (this.count === 0) return []
    return this.fuse.search(text, { limit }).map((r) => ({
      original: r.item.source,
      translated: r.item.target,
      score: r.score ?? 1
    }))
  }
}

export function findSimilar(
  sourceText: string,
  corpus: SimilarityRow[],
  limit = 5
): SimilarEntry[] {
  if (corpus.length === 0) return []
  return new SimilarityIndex(corpus).search(sourceText, limit)
}
