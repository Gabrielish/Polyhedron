import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const api = 'https://bg3.wiki/w/api.php'
const headers = { 'user-agent': 'Polyhedron reference index (BG3 Wiki character creation)' }

async function fetchJson(params) {
  const response = await fetch(`${api}?${new URLSearchParams(params)}`, { headers })
  if (!response.ok) throw new Error(`BG3 Wiki returned ${response.status}`)
  const result = await response.json()
  if (result.error) throw new Error(result.error.info)
  return result
}

const groups = [
  {
    section: 'Origins',
    entries: [
      ['Custom', 'Character_creation'], ['Astarion', 'Astarion'], ['Gale', 'Gale'],
      ['Karlach', 'Karlach'], ["Lae'zel", "Lae'zel"], ['Shadowheart', 'Shadowheart'],
      ['Wyll', 'Wyll'], ['The Dark Urge', 'The Dark Urge (Origin)']
    ]
  },
  {
    section: 'Race',
    entries: ['Human', 'Elf', 'Drow', 'Half-Elf', 'Half-Orc', 'Halfling', 'Dwarf', 'Gnome', 'Tiefling', 'Githyanki', 'Dragonborn'].map((name) => [name, name])
  },
  {
    section: 'Starting Class',
    entries: ['Barbarian', 'Bard', 'Cleric', 'Druid', 'Fighter', 'Monk', 'Paladin', 'Ranger', 'Rogue', 'Sorcerer', 'Warlock', 'Wizard'].map((name) => [name, name])
  },
  {
    section: 'Backgrounds',
    entries: ['Acolyte', 'Charlatan', 'Criminal', 'Entertainer', 'Folk Hero', 'Guild Artisan', 'Haunted One', 'Noble', 'Outlander', 'Sage', 'Soldier', 'Urchin'].map((name) => [name, name])
  },
  {
    section: 'Ability Scores',
    entries: ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'].map((name) => [name, name])
  },
  {
    section: 'Skills',
    entries: [
      'Acrobatics', 'Animal Handling', 'Arcana', 'Athletics', 'Deception', 'History', 'Insight',
      'Intimidation', 'Investigation', 'Medicine', 'Nature', 'Perception', 'Performance',
      'Persuasion', 'Religion', 'Sleight of Hand', 'Stealth', 'Survival'
    ].map((name) => [name, name])
  },
]

const parsed = await fetchJson({ action: 'parse', page: 'Character_creation', prop: 'revid', format: 'json' })
if (!parsed.parse?.revid) throw new Error('BG3 Wiki did not return the Character creation page')

const uniqueTitles = [...new Set(groups.flatMap((group) => group.entries.map(([, title]) => title.split('#')[0])))]
const descriptions = new Map()
for (let offset = 0; offset < uniqueTitles.length; offset += 20) {
  const titles = uniqueTitles.slice(offset, offset + 20)
  const result = await fetchJson({
    action: 'query', prop: 'extracts', exintro: '1', explaintext: '1', exchars: '900',
    redirects: '1', titles: titles.join('|'), format: 'json'
  })
  for (const page of Object.values(result.query?.pages ?? {})) {
    const firstParagraph = (page.extract ?? '').split(/\n\s*\n/).map((part) => part.trim()).find(Boolean) ?? ''
    descriptions.set(page.title.toLocaleLowerCase(), firstParagraph.replace(/\s+/g, ' ').trim())
  }
}

const entries = groups.flatMap((group) => group.entries.map(([name, wikiTitle]) => ({
  name,
  description: wikiTitle.includes('#') ? '' : descriptions.get(wikiTitle.toLocaleLowerCase()) ?? '',
  wikiTitle,
  section: group.section,
  category: 'Character Creation'
})))
const output = {
  sourceUrl: 'https://bg3.wiki/wiki/Character_creation',
  sourceRevision: parsed.parse.revid,
  license: 'CC BY-NC-SA 4.0 or CC BY-SA 4.0 (see source page)',
  entries
}
const outputPath = path.join(root, 'resources/reference/BG3 Character Creation.json')
fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
console.log(`Character creation reference: ${entries.length} entries from ${output.sourceUrl}`)
