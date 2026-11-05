import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const apiUrl =
  'https://bg3.wiki/w/api.php?action=parse&page=Quests&prop=wikitext&format=json&origin=*'
const response = await fetch(apiUrl, { headers: { 'user-agent': 'Polyhedron reference index' } })
if (!response.ok) throw new Error(`BG3 Wiki returned ${response.status}`)
const payload = await response.json()
const page = payload.parse
const source = page?.wikitext?.['*']
if (typeof source !== 'string') throw new Error('BG3 Wiki did not return Quests wikitext')

function extractTemplates(text) {
  const templates = []
  let searchFrom = 0
  while (true) {
    const start = text.indexOf('{{ImageQuest|', searchFrom)
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
      } else {
        end += 1
      }
    }
    if (depth !== 0) throw new Error('Unclosed ImageQuest template in BG3 Wiki page')
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

function cleanWikitext(value) {
  return value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/\[\[([^\]]+)\]\]/g, (_match, target) => {
      const [pageName, display] = target.split('|')
      return (display ?? pageName).split('#')[0].replaceAll('_', ' ')
    })
    .replace(/\[https?:\/\/[^\s\]]+\s+([^\]]+)\]/g, '$1')
    .replace(/'''?/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function headingAt(text, position) {
  const headings = [...text.slice(0, position).matchAll(/^(={2,6})\s*(.*?)\s*\1\s*$/gm)]
  const levels = []
  for (const heading of headings) {
    const level = heading[1].length - 2
    levels.length = level
    levels[level] = heading[2].trim()
  }
  return levels.filter(Boolean).join(' / ')
}

const quests = []
for (const template of extractTemplates(source)) {
  const params = splitTopLevel(template.body)
  const positional = params.filter((param, index) =>
    index > 0 && !/^\s*[\w -]+\s*=/.test(param)
  )
  const wikiTitle = cleanWikitext(positional[1] ?? '')
  const aliasParam = params.find((param) => /^alias\s*=/.test(param))
  const alias = aliasParam?.replace(/^alias\s*=\s*/i, '')
  const name = cleanWikitext(alias || wikiTitle)
  const rawDescription = positional.slice(2).join('|')
  const subquestMarker = rawDescription.match(/(?:sub)?quests?\b/i)
  const subquestStart = subquestMarker?.index ?? -1
  const subquestSection = subquestStart >= 0 ? rawDescription.slice(subquestStart) : ''
  const firstSubquestLink = subquestSection.search(/\[\[/)
  const descriptionSource =
    subquestStart >= 0 && firstSubquestLink >= 0
      ? rawDescription.slice(0, subquestStart + firstSubquestLink)
      : rawDescription
  const description = cleanWikitext(descriptionSource)
    .replace(/^Main quest\.\s*/i, '')
    .replace(/\s*(?:sub)?quests?:\s*$/i, '')
    .trim()
  const subquests = [...subquestSection.matchAll(/\[\[([^\]]+)\]\]/g)].map((match) => {
    const [target, display] = match[1].split('|')
    return cleanWikitext(display ?? target).split('#')[0].trim()
  }).filter(Boolean)
  if (!name) continue
  quests.push({
    name,
    description,
    wikiTitle: wikiTitle || name,
    section: headingAt(source, template.start),
    subquests: [...new Set(subquests)],
    category: 'Quest'
  })
}

const unique = new Map()
for (const quest of quests) {
  const existing = unique.get(quest.name)
  if (!existing) {
    unique.set(quest.name, quest)
    continue
  }
  if (!existing.description && quest.description) existing.description = quest.description
  if (!existing.subquests.length && quest.subquests.length) existing.subquests = quest.subquests
  if (existing.wikiTitle === existing.name && quest.wikiTitle !== quest.name) {
    existing.wikiTitle = quest.wikiTitle
  }
}

const output = {
  sourceUrl: 'https://bg3.wiki/wiki/Quests',
  sourceRevision: page.revid,
  license: 'CC BY-NC-SA 4.0 or CC BY-SA 4.0 (see source page)',
  entries: [...unique.values()]
}
const outputPath = path.join(root, 'resources/reference/BG3 Quests.json')
fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
console.log(`Quest reference: ${output.entries.length} quests from ${output.sourceUrl}`)
