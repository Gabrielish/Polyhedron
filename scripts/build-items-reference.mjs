import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const api = 'https://bg3.wiki/w/api.php'
const headers = { 'user-agent': 'Polyhedron reference index (BG3 Wiki item catalog)' }
const groups = [
  {
    section: 'Equipment types',
    pages: [
      ['Amulets', 'Amulets'],
      ['Armour', 'Armour'],
      ['Camp Clothing', 'Camp Clothing'],
      ['Cloaks', 'Cloaks'],
      ['Clothing', 'Clothing'],
      ['Footwear', 'Footwear'],
      ['Headwear', 'Headwear'],
      ['Handwear', 'Handwear'],
      ['Instruments', 'Musical Instruments'],
      ['Rings', 'Rings'],
      ['Shields', 'Shields (equipment)'],
      ['Underwear', 'Underwear'],
      ['Melee weapons', 'List of melee weapons'],
      ['Ranged weapons', 'List of ranged weapons']
    ]
  },
  {
    section: 'Magic equipment',
    pages: [
      ['Magic items in Act One', 'List of magic items in Act One'],
      ['Magic items in Act Two', 'List of magic items in Act Two'],
      ['Magic items in Act Three', 'List of magic items in Act Three']
    ]
  },
  {
    section: 'Consumables',
    pages: [
      ['Ammunition', 'Arrows'],
      ['Camp Supplies', 'Camp Supplies'],
      ['Coatings', 'Coatings'],
      ['Dyes', 'Dyes'],
      ['Elixirs', 'Elixirs'],
      ['Grenades', 'Grenades'],
      ['Potions', 'Potions'],
      ['Scrolls', 'Scrolls']
    ]
  },
  {
    section: 'Miscellaneous',
    pages: [
      ['Books', 'Books'],
      ['Containers', 'Containers'],
      ['Notes', 'Notes'],
      ['Other', 'Miscellaneous'],
      ['Story Items', 'Story items'],
      ['Valuables', 'Valuables']
    ]
  }
]
const nonItemPages = new Set([
  'ability scores',
  'barter',
  'camp supplies',
  'creature sizes',
  'half-elf',
  'shields',
  'skills',
  'movement speed',
  'bahamut',
  'garl glittergold',
  'gruumsh',
  'laduguer',
  'kelemvor',
  'mielikki',
  'moradin',
  'oghma',
  'shar',
  'talos',
  'tempus',
  'tiamat',
  'yondalla'
])

async function fetchJson(params) {
  const response = await fetch(`${api}?${new URLSearchParams(params)}`, { headers })
  if (!response.ok) throw new Error(`BG3 Wiki returned ${response.status}`)
  const result = await response.json()
  if (result.error) throw new Error(result.error.info)
  return result
}

function decodeHtml(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&#x0*27;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
}

function plainText(value) {
  return decodeHtml(
    value
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  )
}

function attribute(tag, name) {
  return tag.match(new RegExp(`\\b${name}="([^"]*)"`, 'i'))?.[1]
}

async function parsePage(title) {
  let page = title
  for (let redirectCount = 0; redirectCount < 4; redirectCount += 1) {
    const parsed = await fetchJson({ action: 'parse', page, prop: 'text|revid', format: 'json' })
    const html = parsed.parse?.text?.['*']
    if (typeof html !== 'string') throw new Error(`BG3 Wiki did not return ${page}`)
    const redirect = html.match(/class="redirectText"[\s\S]*?<a\b[^>]*title="([^"]+)"/i)
    if (redirect) {
      page = decodeHtml(redirect[1])
      continue
    }
    return { html, revision: parsed.parse.revid, title: parsed.parse.title }
  }
  throw new Error(`Too many redirects while reading ${title}`)
}

async function categoryMembers(category) {
  const titles = []
  const childCategories = []
  let continuation = undefined
  do {
    const result = await fetchJson({
      action: 'query',
      list: 'categorymembers',
      cmtitle: `Category:${category}`,
      cmtype: 'page|subcat',
      cmlimit: '500',
      ...(continuation ? { cmcontinue: continuation } : {}),
      format: 'json'
    })
    for (const member of result.query?.categorymembers ?? []) {
      if (member.ns === 14) childCategories.push(member.title.replace(/^Category:/, ''))
      else if (member.ns === 0) titles.push(member.title)
    }
    continuation = result.continue?.cmcontinue
  } while (continuation)
  return { titles, childCategories }
}

function addItem(name, groupInfo) {
  const cleanName = decodeHtml(name.replaceAll('_', ' ')).trim()
  if (
    !cleanName ||
    cleanName.includes('/') ||
    /^(File|Category|Template|Template talk|Special|Talk|Help):/i.test(cleanName) ||
    nonItemPages.has(cleanName.toLocaleLowerCase()) ||
    /^(&nbsp;|Common$|Uncommon$|Rare$|Very rare$|Legendary$|-+$)/i.test(cleanName)
  )
    return false
  const existing = byWikiTitle.get(cleanName)
  if (existing) {
    if (
      !existing.itemGroups.some(
        (item) => item.section === groupInfo.section && item.type === groupInfo.type
      )
    ) {
      existing.itemGroups.push(groupInfo)
    }
    if (!existing.rarity && groupInfo.type === 'Story Items') existing.rarity = 'Story Item'
    return false
  }
  byWikiTitle.set(cleanName, {
    name: cleanName,
    description: '',
    category: 'Item',
    itemGroups: [groupInfo],
    ...(groupInfo.type === 'Story Items' ? { rarity: 'Story Item' } : {}),
    wikiTitle: cleanName
  })
  return true
}

function readRarity(rowHtml) {
  const value = rowHtml.match(/\bbg3wiki-itemicon-([a-z-]+)\b/i)?.[1]?.toLowerCase()
  if (!value) return undefined
  const rarityNames = {
    common: 'Common',
    uncommon: 'Uncommon',
    rare: 'Rare',
    'very-rare': 'Very rare',
    legendary: 'Legendary',
    'story-item': 'Story Item'
  }
  return rarityNames[value]
}

const MELEE_WEAPON_TYPES = [
  ['Great Sword', /\bgreatswords?\b/i],
  ['Great Club', /\bgreatclubs?\b/i],
  ['Great Axe', /\bgreataxes?\b/i],
  ['Long Sword', /\blongswords?\b/i],
  ['Short Sword', /\bshortswords?\b/i],
  ['Quarterstaff', /\bquarterstaffs?\b|\bquarterstaves\b/i],
  ['Battleaxe', /\bbattleaxes?\b/i],
  ['Handaxe', /\bhandaxes?\b/i],
  ['Light Hammer', /\blight hammers?\b/i],
  ['Warhammer', /\bwarhammers?\b/i],
  ['War Pick', /\bwar picks?\b/i],
  ['Morningstar', /\bmorningstars?\b/i],
  ['Dagger', /\bdaggers?\b/i],
  ['Club', /\bclubs?\b/i],
  ['Flail', /\bflails?\b/i],
  ['Glaive', /\bglaives?\b/i],
  ['Halberd', /\bhalberds?\b/i],
  ['Javelin', /\bjavelins?\b/i],
  ['Mace', /\bmaces?\b/i],
  ['Maul', /\bmauls?\b/i],
  ['Pike', /\bpikes?\b/i],
  ['Rapier', /\brapiers?\b/i],
  ['Scimitar', /\bscimitars?\b/i],
  ['Sickle', /\bsickles?\b/i],
  ['Spear', /\bspears?\b/i],
  ['Trident', /\btridents?\b/i]
]
const RANGED_WEAPON_TYPES = [
  ['Hand Crossbow', /\bhand\s*crossbows?\b/i],
  ['Heavy Crossbow', /\bheavy\s*crossbows?\b/i],
  ['Light Crossbow', /\blight\s*crossbows?\b/i],
  ['Longbow', /\blongbows?\b/i],
  ['Shortbow', /\bshortbows?\b/i],
  ['Dart', /\bdarts?\b/i],
  ['Sling', /\bslings?\b/i],
  ['Crossbow', /\bcrossbows?\b/i]
]

function weaponSubtype(entry, weaponGroup) {
  const text = `${entry.name} ${entry.description}`
  const types = weaponGroup === 'Melee weapons' ? MELEE_WEAPON_TYPES : RANGED_WEAPON_TYPES
  return types.find(([, pattern]) => pattern.test(text))?.[0] ??
    (weaponGroup === 'Melee weapons' ? 'Other Melee' : 'Other Ranged')
}

function applyTableRarities(pageHtml) {
  for (const table of pageHtml.matchAll(
    /<table\b(?=[^>]*\bclass="[^"]*\bwikitable\b)[^>]*>([\s\S]*?)<\/table>/gi
  )) {
    for (const row of table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const rarity = readRarity(row[1])
      if (!rarity) continue
      const title = row[1].match(/<a\b[^>]*href="\/wiki\/[^\"]+"[^>]*title="([^\"]+)"/i)?.[1]
      if (!title) continue
      const item = byWikiTitle.get(decodeHtml(title.replaceAll('_', ' ')))
      if (item) item.rarity = rarity
    }
  }
}

const byWikiTitle = new Map()
const itemsOverview = await parsePage('Items')
const categoryOverrides = {
  Instruments: 'Musical_Instruments',
  Shields: 'Shields_(equipment)',
  'Melee weapons': 'Melee_weapons',
  'Ranged weapons': 'Ranged_weapons',
  Ammunition: 'Arrows',
  Other: 'Miscellaneous',
  'Story Items': 'Story_items'
}
for (const group of groups) {
  for (const [itemType, pageTitle] of group.pages) {
    const page = await parsePage(pageTitle)
    const groupInfo = { section: group.section, type: itemType }
    let count = 0
    const listPage = group.section === 'Equipment types' || group.section === 'Magic equipment'
    if (listPage) {
      const itemTables = page.html.matchAll(
        /<table\b(?=[^>]*\bclass="[^"]*\bwikitable\b)[^>]*>([\s\S]*?)<\/table>/gi
      )
      for (const table of itemTables) {
        for (const row of table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
          const firstCell = row[1].match(/<td\b[^>]*>([\s\S]*?)<\/td>/i)?.[1]
          if (!firstCell) continue
          const link = firstCell.match(/<a\b[^>]*>/i)?.[0]
          const href = link ? attribute(link, 'href') : undefined
          const title = link ? attribute(link, 'title') : undefined
          if (
            link &&
            (!href?.startsWith('/wiki/') ||
              !title ||
              /^(File|Category|Template|Special):/i.test(title))
          ) {
            continue
          }
          const name = decodeHtml((title ?? plainText(firstCell)).replaceAll('_', ' ')).trim()
          if (!name || name === page.title || name === itemType) continue
          const rarity = readRarity(row[1])
          if (addItem(name, groupInfo)) count += 1
          const item = byWikiTitle.get(name)
          if (item && rarity) item.rarity = rarity
        }
      }
    }
    if (!itemType.startsWith('Magic items in Act')) {
      const category = categoryOverrides[itemType] ?? itemType.replace(/\s+/g, '_')
      const visited = new Set()
      const collectCategory = async (categoryTitle) => {
        if (visited.has(categoryTitle)) return
        visited.add(categoryTitle)
        const members = await categoryMembers(categoryTitle)
        for (const title of members.titles) if (addItem(title, groupInfo)) count += 1
        for (const child of members.childCategories) await collectCategory(child)
      }
      await collectCategory(category)
    }
    applyTableRarities(page.html)
    console.log(`${itemType}: ${count} listed on ${page.title}`)
  }
}

async function addLinkedItemsFromHeading(
  pageTitle,
  level,
  headingMatcher,
  groupInfo,
  endAtSameLevel
) {
  const page = await parsePage(pageTitle)
  const headings = [...page.html.matchAll(/<h([23])\b[^>]*>([\s\S]*?)<\/h\1>/gi)]
  const selectedHeadings = headings.filter((heading) => {
    const headline = heading[2].match(/<span class="mw-headline"[^>]*>([\s\S]*?)<\/span>/i)?.[1]
    return Number(heading[1]) === level && headingMatcher.test(plainText(headline ?? ''))
  })
  const titles = new Set()
  for (const heading of selectedHeadings) {
    const headingIndex = headings.indexOf(heading)
    const start = heading.index + heading[0].length
    const next = headings
      .slice(headingIndex + 1)
      .find((candidate) =>
        endAtSameLevel ? Number(candidate[1]) === level : Number(candidate[1]) <= level
      )
    const end = next?.index ?? page.html.length
    for (const match of page.html.slice(start, end).matchAll(/<a\b[^>]*>/gi)) {
      const href = attribute(match[0], 'href')
      const title = attribute(match[0], 'title')
      if (
        !href?.startsWith('/wiki/') ||
        !title ||
        /^(File|Category|Template|Special):/i.test(title)
      )
        continue
      titles.add(title)
    }
  }
  let added = 0
  for (const title of titles) if (addItem(title, groupInfo)) added += 1
  console.log(`${groupInfo.type}: ${added} listed under ${pageTitle}`)
}

await addLinkedItemsFromHeading(
  'Miscellaneous',
  2,
  /^Other Miscellaneous$/i,
  { section: 'Miscellaneous', type: 'Other' },
  true
)
await addLinkedItemsFromHeading(
  'Valuables',
  3,
  /^(Currency|Ingots|Gemstones|Paintings|Valuable Clutter)$/i,
  { section: 'Miscellaneous', type: 'Valuables' },
  true
)

const booksPath = path.join(root, 'resources/reference/BG3 Books.json')
if (fs.existsSync(booksPath)) {
  const books = JSON.parse(fs.readFileSync(booksPath, 'utf8'))
  const bookGroup = { section: 'Miscellaneous', type: 'Books' }
  for (const book of books.entries) {
    const rarity =
      book.section === 'Story Item' || book.section === 'Legendary' ? book.section : 'Common'
    const entry = byWikiTitle.get(book.name)
    if (entry) {
      if (
        !entry.itemGroups.some(
          (item) => item.section === bookGroup.section && item.type === bookGroup.type
        )
      ) {
        entry.itemGroups.push(bookGroup)
      }
      entry.description ||= book.description
      entry.rarity ||= rarity
    } else {
      byWikiTitle.set(book.name, { ...book, rarity, itemGroups: [bookGroup] })
    }
  }
}

const items = [...byWikiTitle.values()]
let nextBatch = 0
async function enrichWorker() {
  while (nextBatch < items.length) {
    const offset = nextBatch
    nextBatch += 20
    const batch = items.slice(offset, offset + 20)
    const result = await fetchJson({
      action: 'query',
      prop: 'extracts',
      exintro: '1',
      explaintext: '1',
      redirects: '1',
      titles: batch.map((item) => item.wikiTitle).join('|'),
      format: 'json'
    })
    for (const article of Object.values(result.query?.pages ?? {})) {
      const item =
        byWikiTitle.get(article.title) ?? batch.find((entry) => entry.wikiTitle === article.title)
      if (!item) continue
      item.wikiTitle = article.title
      item.description =
        (article.extract ?? '')
          .split(/\n\s*\n/)
          .map((text) => text.trim())
          .find(Boolean) ?? ''
    }
  }
}
await Promise.all(Array.from({ length: 4 }, enrichWorker))

for (const item of items) {
  item.itemGroups = item.itemGroups.map((group) =>
    group.section === 'Equipment types' &&
    (group.type === 'Melee weapons' || group.type === 'Ranged weapons')
      ? { ...group, subtype: weaponSubtype(item, group.type) }
      : group
  )
}

const output = {
  sourceUrl: 'https://bg3.wiki/wiki/Items',
  sourceRevision: itemsOverview.revision,
  license: 'CC BY-NC-SA 4.0 or CC BY-SA 4.0 (see source page)',
  groups,
  entries: items
}
const outputPath = path.join(root, 'resources/reference/BG3 Items.json')
fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
console.log(`Item reference: ${items.length} items from ${output.sourceUrl}`)
