export type ItemTag = 'Weapon' | 'Armour' | 'Object' | 'Spell' | 'Status' | 'Passive' | 'Interrupt'
const patterns: Array<[ItemTag, RegExp]> = [
  ['Weapon', /\\b(weapon|sword|mace|dagger|bow|axe|spear|staff|hammer)\\b/i],
  ['Armour', /\\b(armour|armor|helmet|gloves|boots|shield|robe|cloak)\\b/i],
  ['Spell', /\\b(spell|cantrip|spell slot)\\b/i],
  ['Status', /\\b(status|condition|poisoned|blessed|burning|frightened)\\b/i],
  ['Passive', /\\b(passive|feature|proficiency)\\b/i],
  ['Object', /\\b(item|object|potion|scroll|ring|amulet)\\b/i]
]
export function getItemTags(source: string): ItemTag[] { return patterns.filter(([, pattern]) => pattern.test(source)).map(([tag]) => tag) }
