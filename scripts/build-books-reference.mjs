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

function decodeHtml(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&#x0*27;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
}

function plainText(value) {
  return decodeHtml(value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim())
}

function attribute(tag, name) {
  return tag.match(new RegExp(`\\b${name}="([^"]*)"`, 'i'))?.[1]
}

const parsed = await fetchJson({
  action: 'parse',
  page: 'Books',
  prop: 'text|revid',
  format: 'json'
})
const page = parsed.parse
const pageHtml = page?.text?.['*']
if (typeof pageHtml !== 'string') throw new Error('BG3 Wiki did not return the Books page')

const headingPattern = /<h([23])\b[^>]*>([\s\S]*?)<\/h\1>/gi
const headings = [...pageHtml.matchAll(headingPattern)]
const books = new Map()
let primarySection = ''
let currentSection = ''

for (let index = 0; index < headings.length; index += 1) {
  const heading = headings[index]
  const headline = heading[2].match(/<span class="mw-headline"[^>]*>([\s\S]*?)<\/span>/i)
  if (!headline) continue
  const headingName = plainText(headline[1])
  if (!headingName || headingName === 'Contents' || headingName === 'Gallery') continue
  if (heading[1] === '2') {
    primarySection = headingName
    currentSection = headingName
  } else if (primarySection === 'Common') {
    currentSection = `Common / ${headingName}`
  }
  if (!['Story Item', 'Legendary'].includes(primarySection) && primarySection !== 'Common') continue

  const next = headings[index + 1]
  const blockEnd = next?.index ?? pageHtml.length
  const block = pageHtml.slice(heading.index + heading[0].length, blockEnd)
  for (const link of block.matchAll(/<a\b[^>]*>/gi)) {
    const href = attribute(link[0], 'href')
    const title = attribute(link[0], 'title')
    if (!href?.startsWith('/wiki/') || !title || href.includes(':')) continue
    const name = decodeHtml(title.replaceAll('_', ' ')).trim()
    if (!name || name === headingName || name === 'Books') continue
    if (!books.has(name)) {
      books.set(name, {
        name,
        description: '',
        wikiTitle: name,
        section: currentSection,
        category: 'Book'
      })
    }
  }
}

const entries = [...books.values()]
for (let offset = 0; offset < entries.length; offset += 20) {
  const batch = entries.slice(offset, offset + 20)
  const result = await fetchJson({
    action: 'query',
    prop: 'extracts',
    exintro: '1',
    explaintext: '1',
    redirects: '1',
    titles: batch.map((entry) => entry.wikiTitle).join('|'),
    format: 'json'
  })
  for (const article of Object.values(result.query?.pages ?? {})) {
    const entry = books.get(article.title) ?? batch.find((item) => item.wikiTitle === article.title)
    if (!entry) continue
    const paragraphs = (article.extract ?? '').split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean)
    // The second lead paragraph is the in-game book quote; the first is wiki metadata.
    entry.description = paragraphs[1] ?? paragraphs[0] ?? ''
    entry.wikiTitle = article.title
  }
}

const output = {
  sourceUrl: 'https://bg3.wiki/wiki/Books',
  sourceRevision: page.revid,
  license: 'CC BY-NC-SA 4.0 or CC BY-SA 4.0 (see source page)',
  entries
}
const outputPath = path.join(root, 'resources/reference/BG3 Books.json')
fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
console.log(`Book reference: ${entries.length} books from ${output.sourceUrl}`)
