import catalog from './gameReference.generated.json'

export type ReferenceCategory = 'Weapon' | 'Armour' | 'Object' | 'Passive' | 'Spell' | 'Status' | 'Interrupt'
export type ReferenceCatalogEntry = { name: string; description: string; category: ReferenceCategory }
export type ReferenceTag = 'Name' | 'Description' | 'Weapon' | 'Armour' | 'Object' | 'Spell' | 'Passive' | 'Status' | 'Interrupt'
export type ReferenceLink = { kind: 'Name' | 'Description'; text: string }

const entries = catalog as ReferenceCatalogEntry[]
const normalized = (value: string) => value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().toLocaleLowerCase()
const byText = new Map<string, ReferenceCatalogEntry[]>()
for (const entry of entries) {
  for (const value of [entry.name, entry.description]) {
    const key = normalized(value)
    if (!key) continue
    const list = byText.get(key) ?? []
    if (!list.includes(entry)) list.push(entry)
    byText.set(key, list)
  }
}

export function getReferenceCatalog(category?: ReferenceCategory): ReferenceCatalogEntry[] {
  return category ? entries.filter((entry) => entry.category === category) : entries
}
export function getReferenceLinks(source: string): ReferenceLink[] {
  const key = normalized(source)
  const matches = byText.get(key) ?? []
  return matches.flatMap((entry) => {
    const links: ReferenceLink[] = []
    if (normalized(entry.name) === key) links.push({ kind: 'Name', text: entry.description })
    if (normalized(entry.description) === key) links.push({ kind: 'Description', text: entry.name })
    return links
  })
}
export function getReferenceDisplayText(text: string): string { return text.replace(/<[^>]*>/g, '').trim() }
export function getReferenceTags(source: string): ReferenceTag[] {
  const tags = new Set<ReferenceTag>()
  for (const entry of byText.get(normalized(source)) ?? []) { tags.add(entry.category); if (normalized(entry.name) === normalized(source)) tags.add('Name'); if (normalized(entry.description) === normalized(source)) tags.add('Description') }
  return [...tags]
}
