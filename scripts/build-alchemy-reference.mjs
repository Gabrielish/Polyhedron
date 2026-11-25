import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const apiBase = 'https://bg3.wiki/w/api.php'
const headers = { 'user-agent': 'Polyhedron reference index' }
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function api(params) {
  const url = new URL(apiBase)
  url.search = new URLSearchParams({ ...params, format: 'json', origin: '*' }).toString()
  const response = await fetch(url, { headers })
  if (!response.ok) throw new Error(`BG3 Wiki returned ${response.status}`)
  return response.json()
}

function splitTopLevel(value) {
  const parts = []
  let start = 0
  let braces = 0
  let links = 0
  for (let index = 0; index < value.length; index += 1) {
    if (value.startsWith('{{', index)) { braces += 1; index += 1 }
    else if (value.startsWith('}}', index)) { braces -= 1; index += 1 }
    else if (value.startsWith('[[', index)) { links += 1; index += 1 }
    else if (value.startsWith(']]', index)) { links -= 1; index += 1 }
    else if (value[index] === '|' && braces === 0 && links === 0) {
      parts.push(value.slice(start, index).trim())
      start = index + 1
    }
  }
  parts.push(value.slice(start).trim())
  return parts
}

function clean(value) {
  return value
    .replace(/\[\[([^\]]+)\]\]/g, (_match, target) => {
      const [page, display] = target.split('|')
      return (display ?? page).split('#')[0].replaceAll('_', ' ')
    })
    .replace(/\[https?:\/\/[^\s\]]+\s+([^\]]+)\]/g, '$1')
    .replace(/\{\{(?:CharLink|Cond|DamageText|InfoBlob|r)\|([^|}]+)(?:\|[^}]*)?\}\}/gi, '$1')
    .replace(/\{\{[^{}|]+\|([^|}]+)(?:\|([^}]+))?\}\}/g, (_match, first, display) => clean(display ?? first))
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/'''?/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function parseTemplateParams(wikitext) {
  let searchFrom = 0
  while (searchFrom < wikitext.length) {
    const start = wikitext.indexOf('{{', searchFrom)
    if (start < 0) break
    let depth = 0
    let end = start
    while (end < wikitext.length) {
      if (wikitext.startsWith('{{', end)) { depth += 1; end += 2 }
      else if (wikitext.startsWith('}}', end)) {
        depth -= 1
        end += 2
        if (!depth) break
      } else end += 1
    }
    if (depth) break
    const params = splitTopLevel(wikitext.slice(start + 2, end - 2))
    if (params.some((part) => /^\s*description\s*=/i.test(part))) return params
    searchFrom = end
  }
  return null
}

function field(params, name) {
  const value = params?.find((part) => new RegExp(`^\\s*${name}\\s*=`, 'i').test(part))
  return value?.replace(new RegExp(`^\\s*${name}\\s*=\\s*`, 'i'), '').trim() ?? ''
}

function templatePageName(value) {
  const params = splitTopLevel(value)
  return clean(params[1]?.split('=')[0] ?? '')
}

async function categoryMembers(category) {
  const pages = []
  let cmcontinue
  do {
    const data = await api({ action: 'query', list: 'categorymembers', cmtitle: `Category:${category}`, cmlimit: 'max', ...(cmcontinue ? { cmcontinue } : {}) })
    pages.push(...(data.query?.categorymembers ?? []).filter((page) => page.ns === 0).map((page) => page.title))
    cmcontinue = data.continue?.cmcontinue
  } while (cmcontinue)
  return [...new Set(pages)]
}

async function pageWikitext(title) {
  const data = await api({ action: 'parse', page: title, prop: 'wikitext' })
  return data.parse?.wikitext?.['*'] ?? ''
}

function tableRows(section) {
  return section.split('|-').slice(1).map((row) => row.split('\n').filter((line) => line.trim().startsWith('|') && !line.trim().startsWith('|}')))
}

function cellText(cell) {
  return clean(cell.replace(/^\s*\|\s*/, '').replace(/\|\|\s*$/, ''))
}

function recipeName(cell) {
  const template = cell.match(/\{\{(?:MdRarityItem|MdItemIcon|SmRarityItem|SmItemIcon)\|([^|}]+)/i)
  return template ? clean(template[1].replaceAll('_', ' ')) : ''
}

function parseRecipeRows(wikitext) {
  const types = [
    ['Potions', 'Potions'], ['Elixirs', 'Elixirs'], ['Grenades', 'Grenades'], ['Coatings', 'Coatings']
  ]
  const recipes = []
  for (const [heading, group] of types) {
    const headingRegex = new RegExp(`^===\\s*${heading}\\s*===\\s*$`, 'mi')
    const headingMatch = headingRegex.exec(wikitext)
    if (!headingMatch) continue
    const bodyStart = headingMatch.index + headingMatch[0].length
    const remaining = wikitext.slice(bodyStart)
    const nextHeading = remaining.search(/^={2,6}\s/m)
    const section = remaining.slice(0, nextHeading < 0 ? undefined : nextHeading)
    for (const row of tableRows(section)) {
      const cells = row.flatMap((line) => line.split(/\|\|/))
      if (cells.length < 4) continue
      const result = recipeName(cells[0])
      if (!result) continue
      const specificExtract = recipeName(cells[1])
      const rawIngredient = recipeName(cells[2])
      const generic = cellText(cells[3]).replace(/\{\{[\s\S]*$/, '').trim()
      const recipe = [specificExtract, rawIngredient && `Source ingredient: ${rawIngredient}`, generic && `Any ${generic}`].filter(Boolean).join(' · ')
      recipes.push({ name: result, group, recipe, rawIngredient, specificExtract })
    }
  }
  return recipes
}

const article = await api({ action: 'parse', page: 'Alchemy', prop: 'wikitext' })
const alchemyWikitext = article.parse?.wikitext?.['*']
if (!alchemyWikitext) throw new Error('BG3 Wiki did not return Alchemy wikitext')

const extractSectionStart = alchemyWikitext.indexOf('== Extractions ==')
const extractSectionEnd = alchemyWikitext.indexOf('\n==', extractSectionStart + 2)
const extractSection = alchemyWikitext.slice(extractSectionStart, extractSectionEnd > 0 ? extractSectionEnd : undefined)
const extractHeaders = ['Ashes', 'Essences', 'Salts', 'Sublimates', 'Suspensions', 'Vitriols']
const extractionByName = new Map()
  for (const row of tableRows(extractSection)) {
  const cells = row.flatMap((line) => line.split(/\|\|/))
  for (let index = 0; index < Math.min(cells.length, extractHeaders.length); index += 1) {
    const template = cells[index].match(/\{\{SmItemIcon\|([^}]+)\}\}/i)
    if (!template) continue
    const params = splitTopLevel(template[1])
    const extractName = clean(params[0].replaceAll('_', ' '))
    const alias = clean(params.find((value) => /^alias\s*=/.test(value))?.replace(/^alias\s*=\s*/i, '') ?? '')
    extractionByName.set(extractName, { name: extractName, group: `Extracts / ${extractHeaders[index]}`, ingredientName: alias })
  }
}

const recipeRows = parseRecipeRows(alchemyWikitext)
const recipesByIngredient = new Map()
const recipesByExtract = new Map()
for (const recipe of recipeRows) {
  if (recipe.rawIngredient) recipesByIngredient.set(recipe.rawIngredient, [...(recipesByIngredient.get(recipe.rawIngredient) ?? []), recipe.name])
  if (recipe.specificExtract) recipesByExtract.set(recipe.specificExtract, [...(recipesByExtract.get(recipe.specificExtract) ?? []), recipe.name])
}

const ingredientPages = await categoryMembers('Alchemical ingredients')
const extractPages = await categoryMembers('Alchemical extracts')
const work = [
  ...ingredientPages.map((title) => ({ title, kind: 'ingredient' })),
  ...extractPages.map((title) => ({ title, kind: 'extract' }))
]
const entries = []
let cursor = 0
await Promise.all(Array.from({ length: 4 }, async () => {
  while (cursor < work.length) {
    const { title, kind } = work[cursor++]
    try {
      const wikitext = await pageWikitext(title)
      const params = parseTemplateParams(wikitext)
      const description = clean(field(params, 'quote')) || clean(field(params, 'description'))
      const whereToFind = clean(field(params, 'where to find'))
      const icon = field(params, 'icon') || field(params, 'controller icon')
      const actualName = clean(field(params, 'description').match(/'''([^']+)'''/)?.[1] ?? title.replace(/\s*\(ingredient\)$/i, ''))
      const extraction = extractionByName.get(title) ?? [...extractionByName.values()].find((item) => item.name === title)
      const name = kind === 'ingredient' ? actualName || title : extraction?.name ?? title
      const alchemyGroup = kind === 'ingredient' ? 'Ingredients' : extraction?.group ?? 'Extracts / Other'
      const related = kind === 'ingredient' ? recipesByIngredient.get(name) ?? [] : recipesByExtract.get(name) ?? []
      const rawIngredient = extraction?.ingredientName
      const relatedExtract = kind === 'ingredient' ? [...extractionByName.values()].find((item) => item.ingredientName === name)?.name : undefined
      entries.push({
        name,
        description,
        category: 'Alchemy',
        wikiTitle: title,
        ...(icon ? { iconFile: icon } : {}),
        alchemyGroup,
        ...(whereToFind ? { alchemyWhereToFind: whereToFind } : {}),
        ...(related.length ? { alchemyRecipes: [...new Set(related)] } : {}),
        ...(rawIngredient ? { alchemyIngredient: rawIngredient } : {}),
        ...(relatedExtract ? { alchemyExtract: relatedExtract } : {})
      })
    } catch (error) {
      console.warn(`Could not load alchemy entry ${title}: ${error.message}`)
    }
    await sleep(30)
  }
}))

// The Alchemy page lists crafted outputs and their ingredients, but the small
// item art lives on each output's own wiki page. Read those infobox icons too.
let recipeCursor = 0
await Promise.all(Array.from({ length: 4 }, async () => {
  while (recipeCursor < recipeRows.length) {
    const recipe = recipeRows[recipeCursor++]
    try {
      const wikitext = await pageWikitext(recipe.name)
      const params = parseTemplateParams(wikitext)
      recipe.iconFile = field(params, 'icon') || field(params, 'controller icon') || ''
    } catch {
      recipe.iconFile = ''
    }
    await sleep(30)
  }
}))

// Resolve the wiki file names to their stable image URLs (hashed paths).
const iconFiles = [...new Set([
  ...entries.map((entry) => entry.iconFile),
  ...recipeRows.map((recipe) => recipe.iconFile)
].filter(Boolean))]
const iconUrls = new Map()
for (let index = 0; index < iconFiles.length; index += 50) {
  const batch = iconFiles.slice(index, index + 50)
  const data = await api({
    action: 'query',
    titles: batch.map((file) => `File:${file}`).join('|'),
    prop: 'imageinfo',
    iiprop: 'url',
    iiurlwidth: '64'
  })
  for (const page of Object.values(data.query?.pages ?? {})) {
    const fileName = page.title?.replace(/^File:/i, '').replaceAll('_', ' ')
    const url = page.imageinfo?.[0]?.thumburl ?? page.imageinfo?.[0]?.url
    if (fileName && url) iconUrls.set(fileName.toLocaleLowerCase(), url)
  }
}
for (const entry of entries) {
  const icon = iconUrls.get(entry.iconFile?.replaceAll('_', ' ').toLocaleLowerCase())
  if (icon) entry.icon = icon
  delete entry.iconFile
}
for (const recipe of recipeRows) {
  const icon = iconUrls.get(recipe.iconFile?.replaceAll('_', ' ').toLocaleLowerCase())
  if (icon) recipe.icon = icon
  delete recipe.iconFile
}

const output = {
  sourceUrl: 'https://bg3.wiki/wiki/Alchemy',
  sourceRevision: article.parse.revid,
  license: 'CC BY-NC-SA 4.0 or CC BY-SA 4.0 (see source page)',
  recipes: recipeRows,
  entries: [...new Map(entries.map((entry) => [`${entry.alchemyGroup}\0${entry.name}`, entry])).values()]
}
const outputPath = path.join(root, 'resources/reference/BG3 Alchemy.json')
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
console.log(`Alchemy reference: ${output.entries.length} ingredients and extracts from ${output.sourceUrl}`)
