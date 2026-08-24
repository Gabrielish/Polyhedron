import type { AiSimilarityExample } from '../../../preload/api-types'

// Token-budgeted packing of batch entries into grouped requests. Grouping amortizes the
// prompt template (sent once per group instead of once per line) and divides the request
// count, which is what free-tier rate limits actually meter.
//
// Why these numbers:
// - estimateTokens uses chars/3.5 - conservative for mixed EN/PT-BR game text with XML
//   tags (real BPE runs ~3.5-4.5 chars/token, so this overestimates = safe).
// - maxOutputTokens 4000 is the binding constraint: a grouped reply is the SUM of all
//   translations. 4000 fits every provider with >=4x margin (tightest hard cap is
//   gpt-4o-mini at 16384) and stays inside the Anthropic adapter's request budget.
// - maxInputTokens 10000 keeps latency, free-tier tokens-per-minute quotas and the blast
//   radius of a failed request small; context windows (>=128k) are never the limit.
// - maxLines 20 bounds alignment errors - models start misnumbering very large groups.
// A single line that exceeds the budgets on its own becomes a group of 1.
export const GROUP_LIMITS = {
  maxLines: 20,
  maxInputTokens: 10_000,
  maxOutputTokens: 4_000
} as const

export type GroupLimits = typeof GROUP_LIMITS

// max_tokens sent to providers that require one (Anthropic) for grouped requests:
// 2x headroom over the output budget above.
export const GROUP_REQUEST_MAX_TOKENS = 8192

// Translations can run longer than their source (PT-BR expands ~10-20% over EN).
const OUTPUT_EXPANSION = 1.4
// Per-line overhead: the `<<<n>>>` marker and its newline, on both input and output.
const MARKER_OVERHEAD_TOKENS = 8

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5)
}

export interface BatchGroupEntry {
  uid: string
  source: string
}

export interface BatchGroup {
  entries: BatchGroupEntry[]
  // Merged across the group's lines, deduped by source text, insertion-ordered.
  examples: AiSimilarityExample[]
}

function exampleTokens(example: AiSimilarityExample): number {
  // Rendered as `- "src" → "tgt"` in the reference-examples block.
  return estimateTokens(example.src) + estimateTokens(example.tgt) + 6
}

// Greedy sequential packing: entries keep their order; a group is closed when adding the
// next entry would exceed any limit. Examples are merged per group and deduped by source,
// so shared dictionary hits across neighbouring lines are only counted (and sent) once.
export function packEntriesIntoGroups(
  entries: BatchGroupEntry[],
  examplesByUid: ReadonlyMap<string, AiSimilarityExample[]>,
  baseOverheadTokens: number,
  limits: GroupLimits = GROUP_LIMITS
): BatchGroup[] {
  const groups: BatchGroup[] = []

  let current: BatchGroup | null = null
  let exampleKeys = new Set<string>()
  let inputTokens = 0
  let outputTokens = 0

  const close = (): void => {
    if (current && current.entries.length > 0) groups.push(current)
    current = null
    exampleKeys = new Set()
    inputTokens = 0
    outputTokens = 0
  }

  for (const entry of entries) {
    const sourceTokens = estimateTokens(entry.source)
    const lineInput = sourceTokens + MARKER_OVERHEAD_TOKENS
    const lineOutput = Math.ceil(sourceTokens * OUTPUT_EXPANSION) + MARKER_OVERHEAD_TOKENS

    const newExamples = (examplesByUid.get(entry.uid) ?? []).filter(
      (example) => !exampleKeys.has(example.src)
    )
    const newExampleTokens = newExamples.reduce((sum, example) => sum + exampleTokens(example), 0)

    const wouldExceed =
      current !== null &&
      (current.entries.length >= limits.maxLines ||
        inputTokens + lineInput + newExampleTokens > limits.maxInputTokens ||
        outputTokens + lineOutput > limits.maxOutputTokens)

    if (wouldExceed) close()

    if (current === null) {
      current = { entries: [], examples: [] }
      inputTokens = baseOverheadTokens
      outputTokens = 0
    }

    current.entries.push(entry)
    inputTokens += lineInput
    outputTokens += lineOutput
    for (const example of examplesByUid.get(entry.uid) ?? []) {
      if (exampleKeys.has(example.src)) continue
      exampleKeys.add(example.src)
      current.examples.push(example)
      inputTokens += exampleTokens(example)
    }
  }

  close()
  return groups
}
