import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const api = 'https://bg3.wiki/w/api.php'
const headers = { 'user-agent': 'Polyhedron reference index (BG3 Wiki character catalog)' }

async function fetchApi(params) {
  const response = await fetch(`${api}?${new URLSearchParams(params)}`, { headers })
  if (!response.ok) throw new Error(`BG3 Wiki returned ${response.status}`)
  const result = await response.json()
  if (result.error) throw new Error(result.error.info)
  return result
}

async function getAllCharacterTitles() {
  const titles = []
  let continuation
  do {
    const result = await fetchApi({
      action: 'query',
      list: 'categorymembers',
      cmtitle: 'Category:Characters',
      cmtype: 'page',
      cmlimit: '500',
      ...(continuation ? { cmcontinue: continuation } : {}),
      format: 'json'
    })
    titles.push(...(result.query?.categorymembers ?? []).map((member) => member.title))
    continuation = result.continue?.cmcontinue
  } while (continuation)
  return [...new Set(titles)]
}

function extractLinks(wikitext) {
  return [...wikitext.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g)]
    .map((match) => match[1].replaceAll('_', ' ').trim())
}

async function getPartyAndCampNames(characterNames) {
  const result = await fetchApi({
    action: 'parse',
    page: 'Template:Party and camp',
    prop: 'wikitext',
    format: 'json'
  })
  const wikitext = result.parse?.wikitext?.['*'] ?? ''
  const knownNames = new Set(characterNames.map((name) => name.toLocaleLowerCase()))
  return new Set(
    extractLinks(wikitext)
      .filter((name) => knownNames.has(name.toLocaleLowerCase()))
      .map((name) => name.toLocaleLowerCase())
  )
}

const characterTitles = await getAllCharacterTitles()
const partyAndCampNames = await getPartyAndCampNames(characterTitles)
const characterPages = new Map()
let nextBatch = 0
async function fetchWorker() {
  while (nextBatch < characterTitles.length) {
    const start = nextBatch
    nextBatch += 20
    const titles = characterTitles.slice(start, start + 20)
    const result = await fetchApi({
      action: 'query',
      titles: titles.join('|'),
      prop: 'extracts|categories',
      exintro: '1',
      explaintext: '1',
      exchars: '1200',
      cllimit: 'max',
      format: 'json'
    })
    for (const page of Object.values(result.query?.pages ?? {})) {
      if (page.missing !== undefined) continue
      const categories = (page.categories ?? []).map((category) => category.title)
      let description = (page.extract ?? '').split(/\n\s*\n/)[0].trim()
      // The wiki sometimes appends an epigraph to the introductory paragraph.
      description = description.split(/\n\s*[“„]\s*\n/)[0].trim()
      characterPages.set(page.title, { description, categories })
    }
  }
}
await Promise.all(Array.from({ length: 4 }, fetchWorker))

const roleGroups = [
  ['Category:Origins', 'Party and camp / Origin Characters'],
  ['Category:Companions', 'Party and camp / Companions'],
  ['Category:Temporary Companions', 'Party and camp / Temporary Companions'],
  ['Category:Hirelings', 'Party and camp / Hirelings'],
  ['Category:Camp Followers', 'Party and camp / Camp Followers'],
  ['Category:Attached Followers', 'Party and camp / Attached Followers']
]
const locationGroups = new Map([
  ['nautiloid', 'Prologue'],
  ['ravaged beach', 'Prologue'],
  ['emerald grove', 'Act One / Wilderness'],
  ['forest', 'Act One / Wilderness'],
  ['goblin camp', 'Act One / Wilderness'],
  ['overgrown ruins', 'Act One / Wilderness'],
  ['sunlit wetlands', 'Act One / Wilderness'],
  ['the risen road', 'Act One / Wilderness'],
  ['blighted village', 'Act One / Wilderness'],
  ['grymforge', 'Act One / Underdark'],
  ['underdark', 'Act One / Underdark'],
  ['rosymorn monastery', 'Act One / Rosymorn Monastery'],
  ['mountain pass', 'Act One / Rosymorn Monastery'],
  ['shadow-cursed lands', 'Act Two / Shadow-Cursed Lands'],
  ['mind flayer colony', 'Act Two / Shadow-Cursed Lands'],
  ['moonrise towers', 'Act Two / Shadow-Cursed Lands'],
  ['reithwin town', 'Act Two / Shadow-Cursed Lands'],
  ['gauntlet of shar', 'Act Two / Shadow-Cursed Lands'],
  ['rivington', 'Act Three / Rivington'],
  ["baldur's mouth", "Act Three / Baldur's Gate"],
  ['basilisk gate barracks', "Act Three / Baldur's Gate"],
  ['the blushing mermaid', "Act Three / Baldur's Gate"],
  ['counting house', "Act Three / Baldur's Gate"],
  ['grey harbour docks', "Act Three / Baldur's Gate"],
  ['iron throne', "Act Three / Baldur's Gate"],
  ["wyrm's crossing", "Act Three / Wyrm's Crossing"],
  ["wyrm's rock fortress", "Act Three / Wyrm's Crossing"],
  ['cloister of sombre embrace', "Act Three / Baldur's Gate"],
  ['lower city', "Act Three / Baldur's Gate"],
  ['steel watch foundry', "Act Three / Baldur's Gate"],
  ['szarr palace', "Act Three / Baldur's Gate"],
  ['undercity', "Act Three / Baldur's Gate"],
  ['upper city', "Act Three / Baldur's Gate"],
  ['prologue', 'Prologue'],
  ['astral plane', 'Other Planes'],
  ['house of hope', 'Other Planes']
])

function groupsFor(title, categories) {
  const groups = new Set()
  const categorySet = new Set(categories)
  for (const [category, group] of roleGroups) {
    if (categorySet.has(category)) groups.add(group)
  }
  if (partyAndCampNames.has(title.toLocaleLowerCase()) && groups.size === 0) {
    groups.add('Party and camp / Other')
  }

  for (const category of categories) {
    const match = category.match(/^Category:Characters in (.+)$/)
    if (!match || /^Act (One|Two|Three)$/i.test(match[1])) continue
    const location = match[1].toLocaleLowerCase().replace(/^the\s+/, '')
    const group = locationGroups.get(location)
    if (group) groups.add(group)
  }
  for (const act of ['One', 'Two', 'Three']) {
    const actThreeAlias = act === 'Three' && categorySet.has('Category:Characters in Act 3')
    if (categorySet.has(`Category:Characters in Act ${act}`) || actThreeAlias) {
      const prefix = `Act ${act}`
      if (![...groups].some((group) => group.startsWith(`${prefix} /`))) {
        groups.add(`${prefix} / Other Locations`)
      }
    }
  }
  const onlyMentioned = categorySet.has('Category:Mentioned characters') && groups.size === 0
  if (groups.size === 0 && !onlyMentioned) groups.add('Other NPCs')
  return [...groups]
}

const entries = []
for (const [name, page] of characterPages) {
  const npcGroups = groupsFor(name, page.categories)
  if (!npcGroups.length) continue
  entries.push({
    name,
    description: page.description,
    category: 'NPC',
    npcGroups,
    wikiTitle: name
  })
}
entries.sort((a, b) => a.name.localeCompare(b.name))

const source = await fetchApi({ action: 'parse', page: 'List of characters', prop: 'revid', format: 'json' })
const output = {
  sourceUrl: 'https://bg3.wiki/wiki/List_of_characters',
  sourceRevision: source.parse?.revid,
  license: 'CC BY-NC-SA 4.0 or CC BY-SA 4.0 (see source page)',
  entries
}
const outputPath = path.join(root, 'resources/reference/BG3 NPCs.json')
fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
console.log(`NPC reference: ${entries.length} characters with ${entries.filter((entry) => entry.description).length} descriptions`)
