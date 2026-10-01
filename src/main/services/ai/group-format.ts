// Sentinel-marker wire format for grouped translation requests. JSON was rejected on
// purpose: game strings are full of quotes, newlines and placeholders, and model-emitted
// JSON breaks on escaping far too often. Numbered markers need no escaping, survive
// multiline translations, and parse with a single regex. The odds of `<<<n>>>` appearing
// in real localization text are negligible.

function marker(index: number): string {
  return `<<<${index}>>>`
}

// The numbered block substituted into {SOURCE_TEXT} for grouped requests.
export function buildLinesBlock(sources: string[]): string {
  return sources.map((source, i) => `${marker(i + 1)}\n${source}`).join('\n')
}

// Fixed, system-appended section - the user can never remove or edit it, which is what
// guarantees the response stays parseable regardless of the selected prompt slot.
export const GROUP_RESPONSE_FORMAT = `## Response format (mandatory)
The source text contains multiple numbered lines. Translate each one. Reply with every
translation preceded by its own marker, in order, exactly like this:
<<<1>>>
translation of line 1
<<<2>>>
translation of line 2
Do not output anything before the first marker or after the last translation. Do not
repeat the source text. Do not merge, skip or renumber lines. This section overrides any
earlier instruction to reply with a single translation.`

// Single-line counterpart appended by renderPrompt (kept out of the editable template so
// it is always present and always last, for default and custom prompts alike).
export function buildSingleResponseFormat(targetLangName: string): string {
  return `## Response format (mandatory)
Reply with **only** the final translation in ${targetLangName} - no comments, no quotes
around it, no explanations.`
}

// Extracts `index -> translation` from a grouped reply. Tolerates code fences and any
// preamble before the first marker; indices outside 1..expectedCount are ignored. Callers
// treat absent indices as misses and fall back to per-line translation.
export function parseGroupResponse(raw: string, expectedCount: number): Map<number, string> {
  const cleaned = raw.replace(/^```[a-z]*\s*$/gim, '')
  const result = new Map<number, string>()

  const markerRe = /<<<(\d+)>>>/g
  const found: { index: number; start: number; end: number }[] = []
  let match = markerRe.exec(cleaned)
  while (match !== null) {
    found.push({
      index: Number.parseInt(match[1], 10),
      start: match.index,
      end: match.index + match[0].length
    })
    match = markerRe.exec(cleaned)
  }

  for (let i = 0; i < found.length; i++) {
    const { index, end } = found[i]
    if (index < 1 || index > expectedCount) continue
    const sliceEnd = i + 1 < found.length ? found[i + 1].start : cleaned.length
    const text = cleaned.slice(end, sliceEnd).trim()
    if (text.length > 0 && !result.has(index)) result.set(index, text)
  }

  return result
}
