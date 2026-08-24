import rawIndex from './dialogReference.generated.json'
const index = rawIndex as any

export type DialogueCategory = (typeof index.categories)[number]
export type DialogueGroup = { category: DialogueCategory; file: string; dialogue: string; node: string }
export type DialogueNode = { node: string; hashes: string[]; next: string[]; details: string[] }

const normalize = (value: string) => value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().toLocaleLowerCase()
const hashText = (value: string) => { let hash = 14695981039346656037n; for (const byte of new TextEncoder().encode(value)) { hash ^= BigInt(byte); hash = BigInt.asUintN(64, hash * 1099511628211n) }; return hash.toString(16).padStart(16, '0') }
const groupsByHash = new Map<string, DialogueGroup[]>()
for (const [hash, groups] of Object.entries(index.entries as Record<string, any[]>)) groupsByHash.set(hash, groups.map(([category, file, dialogue, node]) => ({ category: index.categories[category]!, file: index.files[file]!, dialogue: index.dialogues[dialogue]!, node })))
const nodesByDialogue = new Map<string, DialogueNode[]>()
for (const [dialogueId, node, hashes, next, detailIds] of index.nodes as any[]) { const dialogue = index.dialogues[dialogueId]!; const value = { node, hashes, next, details: detailIds.map((id) => index.details[id]!) }; const list = nodesByDialogue.get(dialogue) ?? []; list.push(value); nodesByDialogue.set(dialogue, list) }
export function getDialogueGroups(source: string): DialogueGroup[] { return groupsByHash.get(hashText(normalize(source))) ?? [] }
export function getDialogueNodes(dialogue: string): DialogueNode[] { return nodesByDialogue.get(dialogue) ?? [] }
export type DialogueFilter = 'greeting' | 'answer' | 'cinematic' | 'roll' | 'alias'
export type DialogueScope = { category?: DialogueCategory; file?: string; dialogue?: string; node?: string }
export function getDialogueFilterTags(source: string): DialogueFilter[] { const value = source.toLocaleLowerCase(); const tags: DialogueFilter[] = []; if (/\b(greeting|greet)\b/.test(value)) tags.push('greeting'); if (/\banswer\b/.test(value)) tags.push('answer'); if (/cinematic/.test(value)) tags.push('cinematic'); if (/roll.?result|roll result/.test(value)) tags.push('roll'); if (/\balias\b/.test(value)) tags.push('alias'); return tags }
export function matchesDialogueFilters(source: string, filters: DialogueFilter[]): boolean { return filters.length === 0 || filters.some((filter) => getDialogueFilterTags(source).includes(filter)) }
export function matchesDialogueScope(source: string, scope: DialogueScope | null): boolean { return !scope || getDialogueGroups(source).some((group) => (!scope.category || group.category === scope.category) && (!scope.file || group.file === scope.file) && (!scope.dialogue || group.dialogue === scope.dialogue) && (!scope.node || group.node === scope.node)) }
