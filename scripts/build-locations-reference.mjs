import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const api = 'https://bg3.wiki/w/api.php'
const headers = { 'user-agent': 'Polyhedron reference index' }

async function fetchJson(params) {
  const response = await fetch(`${api}?${new URLSearchParams(params)}`, { headers })
  if (!response.ok) throw new Error(`BG3 Wiki returned ${response.status}`)
  return response.json()
}

function decode(value) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&#x0*27;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
}

function normalize(value) {
  return decode(value.replaceAll('_', ' ')).normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase()
}

function displayTitle(value) {
  return decode(value.replaceAll('_', ' ')).replace(/\s*\((?:location|area|region)\)$/i, '').trim()
}

function cleanWikitext(value) {
  return decode(value
    .replace(/<br\s*\/?>(?:\s*)/gi, ' ')
    .replace(/\[\[([^\]]+)\]\]/g, (_match, target) => {
      const [pageName, display] = target.split('|')
      return (display ?? pageName).split('#')[0].replaceAll('_', ' ')
    })
    .replace(/\{\{[^{}]*\}\}/g, '')
    .replace(/\[https?:\/\/[^\s\]]+\s+([^\]]+)\]/g, '$1')
    .replace(/'''?/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim())
}

function extractTemplates(text) {
  const templates = []
  let searchFrom = 0
  while (true) {
    const start = text.indexOf('{{ImageLocation|', searchFrom)
    if (start < 0) break
    let depth = 0
    let end = start
    while (end < text.length) {
      if (text.startsWith('{{', end)) {
        depth += 1
        end += 2
      } else if (text.startsWith('}}', end)) {
        depth -= 1
        end += 2
        if (depth === 0) break
      } else end += 1
    }
    if (depth !== 0) throw new Error('Unclosed ImageLocation template in BG3 Wiki page')
    templates.push({ start, body: text.slice(start + 2, end - 2) })
    searchFrom = end
  }
  return templates
}

function splitTopLevel(value) {
  const parts = []
  let start = 0
  let braces = 0
  let links = 0
  for (let index = 0; index < value.length; index += 1) {
    if (value.startsWith('{{', index)) {
      braces += 1
      index += 1
    } else if (value.startsWith('}}', index)) {
      braces -= 1
      index += 1
    } else if (value.startsWith('[[', index)) {
      links += 1
      index += 1
    } else if (value.startsWith(']]', index)) {
      links -= 1
      index += 1
    } else if (value[index] === '|' && braces === 0 && links === 0) {
      parts.push(value.slice(start, index).trim())
      start = index + 1
    }
  }
  parts.push(value.slice(start).trim())
  return parts
}

function extractLinks(value) {
  return [...value.matchAll(/\[\[([^\]]+)\]\]/g)].map((match) => {
    const [target, display] = match[1].split('|')
    return {
      title: decode(target.split('#')[0].trim()),
      name: displayTitle(display ?? target.split('#')[0].trim())
    }
  }).filter((link) => link.name && !link.title.includes(':'))
}

function sectionAt(text, position) {
  const headings = [...text.slice(0, position).matchAll(/^(={2,6})\s*(.*?)\s*\1\s*$/gm)]
  const levels = []
  for (const heading of headings) {
    const level = heading[1].length - 2
    levels.length = level
    levels[level] = cleanWikitext(heading[2])
  }
  const names = levels.filter(Boolean)
  const act = names[0] || 'Other Locations'
  const subgroups = names.slice(1)
    .filter((name) => !/^(?:over|under)[ -]world$/i.test(name))
    .map((name) => /^other planes of existence$/i.test(name) ? 'Other Planes' : name)
  return [act, ...subgroups].join(' / ')
}

const listPage = await fetchJson({
  action: 'parse',
  page: 'List_of_locations',
  prop: 'wikitext|revid',
  format: 'json'
})
const source = listPage.parse?.wikitext?.['*']
if (typeof source !== 'string') throw new Error('BG3 Wiki did not return the locations page')

const categoryMembers = []
let continuation
do {
  const result = await fetchJson({
    action: 'query',
    list: 'categorymembers',
    cmtitle: 'Category:Locations',
    cmlimit: 'max',
    format: 'json',
    ...continuation
  })
  categoryMembers.push(...(result.query?.categorymembers ?? []).filter((page) => page.ns === 0))
  continuation = result.continue
} while (continuation)

const pagesByTitle = new Map(categoryMembers.map((page) => [normalize(page.title), page.title]))
const titlesByBaseName = new Map()
for (const page of categoryMembers) {
  const key = normalize(displayTitle(page.title))
  const matches = titlesByBaseName.get(key) ?? []
  matches.push(page.title)
  titlesByBaseName.set(key, matches)
}
function resolveTitle(value) {
  const exact = pagesByTitle.get(normalize(value))
  if (exact) return exact
  const matches = titlesByBaseName.get(normalize(displayTitle(value))) ?? []
  return matches.length === 1 ? matches[0] : null
}

const locationsByTitle = new Map()
const sectionOrder = new Map()
let templateOrder = 0
for (const template of extractTemplates(source)) {
  const params = splitTopLevel(template.body)
  const name = cleanWikitext(params[2] ?? '')
  const wikiTitle = resolveTitle(name)
  if (!name || !wikiTitle) continue
  const description = cleanWikitext(params[3] ?? '')
  const subLocations = extractLinks(params.slice(4).join('|'))
    .map((link) => ({ ...link, wikiTitle: resolveTitle(link.title) ?? link.title }))
  const existing = locationsByTitle.get(wikiTitle)
  if (existing) {
    if (!existing.description && description) existing.description = description
    for (const child of subLocations) {
      if (!existing.subLocations.some((item) => item.wikiTitle === child.wikiTitle)) {
        existing.subLocations.push(child)
      }
    }
    continue
  }
  const section = sectionAt(source, template.start)
  if (!sectionOrder.has(section)) sectionOrder.set(section, sectionOrder.size)
  locationsByTitle.set(wikiTitle, {
    name,
    wikiTitle,
    description,
    section,
    subLocations,
    order: templateOrder++
  })
}

const actByTitle = new Map()
for (let offset = 0; offset < categoryMembers.length; offset += 50) {
  const batch = categoryMembers.slice(offset, offset + 50)
  const result = await fetchJson({
    action: 'query',
    prop: 'categories',
    cllimit: 'max',
    titles: batch.map((page) => page.title).join('|'),
    format: 'json'
  })
  for (const page of Object.values(result.query?.pages ?? {})) {
    const categories = (page.categories ?? []).map((item) => item.title)
    const act = categories.find((category) => /^Category:(?:Prologue|Act One|Act Two|Act Three) Locations$/i.test(category))
    if (act) actByTitle.set(normalize(page.title), act.replace(/^Category:/, '').replace(/ Locations$/i, ''))
  }
}

const extractByTitle = new Map()
for (let offset = 0; offset < categoryMembers.length; offset += 20) {
  const batch = categoryMembers.slice(offset, offset + 20)
  const result = await fetchJson({
    action: 'query',
    prop: 'extracts',
    exintro: '1',
    explaintext: '1',
    redirects: '1',
    titles: batch.map((page) => page.title).join('|'),
    format: 'json'
  })
  for (const page of Object.values(result.query?.pages ?? {})) {
    const firstParagraph = (page.extract ?? '').split(/\n\s*\n/).map((part) => part.trim()).find(Boolean) ?? ''
    extractByTitle.set(normalize(page.title), firstParagraph.replace(/\s+/g, ' ').trim())
  }
}

const entries = categoryMembers.map((page) => {
  const template = locationsByTitle.get(page.title)
  const name = template?.name ?? displayTitle(page.title)
  const section = template?.section ?? `${actByTitle.get(normalize(page.title)) ?? 'Other Locations'} / Other Locations`
  return {
    name,
    description: template?.description || extractByTitle.get(normalize(page.title)) || '',
    wikiTitle: page.title,
    section,
    subLocations: (template?.subLocations ?? []).map((child) => {
      const resolved = resolveTitle(child.wikiTitle) ?? child.wikiTitle
      return displayTitle(child.name || resolved)
    }).filter((child, index, children) => children.indexOf(child) === index),
    category: 'Location',
    _order: template?.order ?? Number.MAX_SAFE_INTEGER
  }
}).sort((left, right) => {
  const actOrder = (section) => {
    const act = section.split(' / ')[0]
    return ({ Prologue: 0, 'Act One': 1, 'Act Two': 2, 'Act Three': 3, 'Other Locations': 4 })[act] ?? 5
  }
  const byAct = actOrder(left.section) - actOrder(right.section)
  if (byAct) return byAct
  const sectionIndex = (section) => sectionOrder.get(section) ?? Number.MAX_SAFE_INTEGER
  const bySection = sectionIndex(left.section) - sectionIndex(right.section)
  if (bySection) return bySection
  const byGroup = left.section.localeCompare(right.section)
  if (byGroup) return byGroup
  const bySourceOrder = left._order - right._order
  return bySourceOrder || left.name.localeCompare(right.name)
})

// Keep linked sublocations under their parent and include every page from the wiki's location category.
for (const entry of entries) delete entry._order
const output = {
  sourceUrl: 'https://bg3.wiki/wiki/Locations',
  sourceRevision: listPage.parse?.revid,
  license: 'CC BY-NC-SA 4.0 or CC BY-SA 4.0 (see source page)',
  entries
}
const outputPath = path.join(root, 'resources/reference/BG3 Locations.json')
fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
console.log(`Location reference: ${entries.length} locations from ${output.sourceUrl}`)
