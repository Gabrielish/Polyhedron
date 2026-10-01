import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const referenceDir = path.join(root, 'reference')
const output = path.join(root, 'src', 'renderer', 'src', 'data', 'gameReference.generated.json')
const files = [
  ['BG3 Weapons.html', 'Weapon'],
  ['BG3 Armors.html', 'Armour'],
  ['BG3 Objects.html', 'Object'],
  ['BG3 Spells.html', 'Spell'],
  ['BG3 Passives.html', 'Passive'],
  ['BG3 Statuses.html', 'Status'],
  ['BG3 Interrupts.html', 'Interrupt']
]
const decode = (value) =>
  value
    .replace(/<br\s*\/?>(?:\s*)/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
const field = (block, key) =>
  block.match(
    new RegExp(
      `(?:^|<br\\s*\\/?>(?:\\s*))${key}:\\s*([\\s\\S]*?)(?=<br\\s*\\/?>(?:\\s*)|<b>|$)`,
      'i'
    )
  )?.[1] ?? ''
const cleanField = (value) => decode(value).replace(/\*+$/, '').trim()
const entries = []
for (const [file, category] of files) {
  const html = fs.readFileSync(path.join(referenceDir, file), 'utf8')
  for (const block of html.split(/<hr\s*\/?>(?=<b>)/i).slice(1)) {
    const name = decode(block.match(/^\s*<b>([^<]+)<\/b>/i)?.[1] ?? '')
    const display = decode(
      block.match(/(?:<b>)?DisplayName:\s*([\s\S]*?)(?=<br\s*\/?>(?:\s*)|<b>|$)/i)?.[1] ?? ''
    )
    const description = decode(
      block.match(/(?:<b>)?Description:\s*([\s\S]*?)(?=<br\s*\/?>(?:\s*)|<b>|$)/i)?.[1] ?? ''
    )
    const itemName = display || name
    if (itemName && (display || description)) {
      const rawFlags = field(block, 'SpellFlags')
      const rawCosts = field(block, 'UseCosts')
      const rawType = field(block, 'SpellType')
      const rawAction = field(block, 'SpellActionType')
      const rawIcon = field(block, 'Icon')
      const rawLevel = field(block, 'Level')
      const conditions = [...block.matchAll(/ApplyStatus\((?:SELF,)?([A-Z0-9_]+)/gi)].map(
        (match) => match[1]
      )
      entries.push({
        name: cleanField(itemName),
        description: cleanField(description),
        category,
        id: name,
        icon: cleanField(rawIcon),
        flags: cleanField(rawFlags),
        useCosts: cleanField(rawCosts),
        spellType: cleanField(rawType),
        actionType: cleanField(rawAction),
        level: cleanField(rawLevel),
        conditions: [...new Set(conditions)],
        hasUnresolvedFields: /\*+$/.test(display) || /\*+$/.test(description)
      })
    }
  }
}
const unique = [
  ...new Map(
    entries.map((entry) => [
      `${entry.category}\u0000${entry.name}\u0000${entry.description}`,
      entry
    ])
  ).values()
]
fs.mkdirSync(path.dirname(output), { recursive: true })
fs.writeFileSync(output, `${JSON.stringify(unique)}\n`, 'utf8')
console.log(`Reference index: ${unique.length} entries -> ${path.relative(root, output)}`)
