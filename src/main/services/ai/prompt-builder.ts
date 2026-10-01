import type { AiSimilarityExample } from '../../../preload/api-types'
import { REQUIRED_PROMPT_VARS } from '../../../preload/api-types'
import type { SimilarEntry } from '../similarity.service'
import { buildLinesBlock, buildSingleResponseFormat, GROUP_RESPONSE_FORMAT } from './group-format'

// Markdown-optimised default prompt. Seeded into the prompt_slot table as the locked
// default; editing it in the UI forks a new slot instead of overwriting it.
// The reply-format instruction intentionally lives OUTSIDE the template: renderPrompt /
// renderGroupPrompt append a fixed "## Response format" section last, so batch grouping
// can swap it for the marker format without depending on user-editable text.
export const DEFAULT_PROMPT = `You are a translator specialized in **Baldur's Gate 3** mods, with deep knowledge of the **Dungeons & Dragons** (5e) universe.

## Goal
Translate from {SOURCE_LANGUAGE} to {TARGET_LANGUAGE}, preserving the tone, lore and official terminology.

## Rules
- Use the **official** D&D translations of the target language — e.g. in Brazilian Portuguese: "Saving Throw" → "Teste de Resistência", "Spell Slot" → "Espaço de Magia", "Ability Check" → "Teste de Habilidade".
- Keep **all** XML tags and placeholders (\`<LSTag ...>\`, \`{0}\`, \`{1}\`) exactly as they are, in the same position.
- Keep the game's heroic/dark tone. Do not add comments or explanations.

## Input
- Source language: {SOURCE_LANGUAGE}
- Current translation (if any): {TARGET_TEXT}
- Source text:
{SOURCE_TEXT}`

// Fixed, non-customisable block appended when similarity examples are included.
const SIMILARITY_HEADING = '## Reference examples'

export interface RenderPromptParams {
  template: string
  sourceText: string
  targetText: string
  sourceLangName: string
  targetLangName: string
  examples?: AiSimilarityExample[]
}

// Substitutes the four required variables, appends the reference-examples block and the
// fixed single-line response-format section (always last, so it wins over template text).
export function renderPrompt(params: RenderPromptParams): string {
  const { template, sourceText, targetText, sourceLangName, targetLangName, examples } = params

  const rendered = template
    .replaceAll('{SOURCE_TEXT}', sourceText)
    .replaceAll('{TARGET_TEXT}', targetText)
    .replaceAll('{SOURCE_LANGUAGE}', sourceLangName)
    .replaceAll('{TARGET_LANGUAGE}', targetLangName)

  return joinSections(rendered, buildSimilarityBlock(examples ?? []), [
    buildSingleResponseFormat(targetLangName)
  ])
}

/**
 * Renders the interactive "Ask Gemini" request. Unlike a normal translation request,
 * this deliberately asks for three alternatives and keeps the response machine-readable.
 */
export function renderVariantsPrompt(
  params: RenderPromptParams,
  variantCount: 1 | 2 | 3 = 3
): string {
  const { template, sourceText, targetText, sourceLangName, targetLangName, examples } = params

  const rendered = template
    .replaceAll('{SOURCE_TEXT}', sourceText)
    .replaceAll('{TARGET_TEXT}', targetText)
    .replaceAll('{SOURCE_LANGUAGE}', sourceLangName)
    .replaceAll('{TARGET_LANGUAGE}', targetLangName)

  const variantDescriptions = [
    'The first variant must be the closest, strictest translation of the source.',
    'The second variant must be natural Romanian without adding any information.',
    'The third variant must be an equally faithful alternative phrasing.'
  ].slice(0, variantCount)

  return joinSections(rendered, buildSimilarityBlock(examples ?? []), [
    `## Ask Gemini response format
Return exactly ${variantCount} faithful Romanian translation ${variantCount === 1 ? 'variant' : 'variants'} as valid JSON and nothing else.
Use this exact shape:
{"variants":["translation${variantCount > 1 ? ' 1' : ''}"${variantCount > 1 ? ',"translation 2"' : ''}${variantCount > 2 ? ',"translation 3"' : ''}]}

All variants must preserve the source meaning. Do not add details, omit information, or invent context.
${variantDescriptions.join(' ')} Preserve all tags, placeholders,
asterisks, names, numbers, and formatting exactly.`
  ])
}

export interface RenderGroupPromptParams {
  template: string
  sources: string[]
  sourceLangName: string
  targetLangName: string
  examples?: AiSimilarityExample[]
}

// Grouped variant: {SOURCE_TEXT} receives the numbered lines block and the appended
// response-format section switches to the sentinel-marker format the parser expects.
export function renderGroupPrompt(params: RenderGroupPromptParams): string {
  const { template, sources, sourceLangName, targetLangName, examples } = params

  const rendered = template
    .replaceAll('{SOURCE_TEXT}', buildLinesBlock(sources))
    .replaceAll('{TARGET_TEXT}', '')
    .replaceAll('{SOURCE_LANGUAGE}', sourceLangName)
    .replaceAll('{TARGET_LANGUAGE}', targetLangName)

  return joinSections(rendered, buildSimilarityBlock(examples ?? []), [GROUP_RESPONSE_FORMAT])
}

function joinSections(rendered: string, similarityBlock: string, tail: string[]): string {
  const sections = [rendered]
  if (similarityBlock) sections.push(similarityBlock)
  sections.push(...tail)
  return sections.join('\n\n')
}

export function buildSimilarityBlock(examples: AiSimilarityExample[]): string {
  if (examples.length === 0) return ''
  const bullets = examples.map((e) => `- "${e.src}" → "${e.tgt}"`).join('\n')
  return `${SIMILARITY_HEADING}\n${bullets}`
}

export interface SimilarityFilterOptions {
  count: number
  minScore: number
}

// Fuse returns a *distance* (0 = best). The UI works in *similarity* (higher = best) with a
// "ignore below X" threshold, so convert here (similarity = 1 - distance), drop low hits and
// keep the top `count`. Input is already ordered best-first by Fuse.
export function filterExamples(
  context: SimilarEntry[],
  { count, minScore }: SimilarityFilterOptions
): AiSimilarityExample[] {
  return context
    .filter((entry) => 1 - entry.score >= minScore)
    .slice(0, Math.max(0, count))
    .map((entry) => ({ src: entry.original, tgt: entry.translated }))
}

export { REQUIRED_PROMPT_VARS }
