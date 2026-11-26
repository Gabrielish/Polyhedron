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

function templateAt(text, start) {
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
  return depth === 0 ? { start, end, body: text.slice(start + 2, end - 2) } : null
}

function findDirectTemplates(text, name) {
  const found = []
  let index = 0
  while (index < text.length) {
    const start = text.indexOf('{{', index)
    if (start < 0) break
    const template = templateAt(text, start)
    if (!template) break
    const templateName = template.body.split('|', 1)[0].trim()
    if (templateName.toLocaleLowerCase() === name.toLocaleLowerCase()) found.push(template)
    index = template.end
  }
  return found
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

function unwrapJournalText(value) {
  let text = cleanWikitext(value).replace(/^\\(?=["“”])/, '')
  // Wiki puts quotation marks around journal excerpts for presentation; they are not part of the string.
  if (text.startsWith('“') || text.startsWith('"')) text = text.slice(1).trim()
  if (text.endsWith('”') || text.endsWith('"')) text = text.slice(0, -1).trim()
  return text.replace(/\.'$/, '.')
}

function parseQuestObjectives(wikitext) {
  const headings = [...wikitext.matchAll(/^(={2,6})\s*(.*?)\s*\1\s*$/gm)]
  const objectiveHeadings = headings.filter((heading) => /^Objectives(?:\s*\([^)]*\))?$/i.test(heading[2].trim()))
  if (objectiveHeadings.length === 0) return []

  const parseTemplate = (template) => {
    const parts = splitTopLevel(template.body)
    const title = cleanWikitext(parts[1] ?? '')
    const content = parts.slice(2).join('|')
    const childTemplates = findDirectTemplates(content, 'Quest objective')
    const children = childTemplates.map(parseTemplate)
    let contentWithoutChildren = content
    for (const child of childTemplates.reverse()) {
      const relativeStart = child.start
      contentWithoutChildren = `${contentWithoutChildren.slice(0, relativeStart)}\n${contentWithoutChildren.slice(child.end)}`
    }
    const journalEntries = [...contentWithoutChildren.matchAll(/^\s*\*+\s*(.+?)\s*$/gm)]
      .map((match) => {
        let entry = unwrapJournalText(match[1])
        // Conditional variants are formatted as `If ...: "Journal text"`
        // or `When entering via ...: Journal text`. Keep the journal entry,
        // not its condition, without stripping colons from narrative text.
        const conditional = entry.match(/^(?:If\b[^:]*:\s*|When entering via\b[^:]*:\s*)(.+)$/i)
        if (conditional) entry = unwrapJournalText(conditional[1])
        return unwrapJournalText(entry)
      })
      .filter((entry) => entry && !/^Read .+?:?$/i.test(entry) && !/^(?:If|When|Should)\b[^:]*:\s*$/i.test(entry))
    return { title, journalEntries: [...new Set(journalEntries)], children }
  }
  const parseLevel = (text) => findDirectTemplates(text, 'Quest objective')
    .map(parseTemplate)
    .filter((objective) => objective.title || objective.journalEntries.length || objective.children.length)

  const objectives = objectiveHeadings.flatMap((heading) => {
    const start = heading.index + heading[0].length
    const nextHeading = headings.find((candidate) => candidate.index > heading.index && candidate[1].length <= heading[1].length)
    return parseLevel(wikitext.slice(start, nextHeading?.index ?? wikitext.length))
  })
  // Companion quests can have separate Origin and Companion objective sections.
  // Merge identical objective labels so the title appears once with all journal variants.
  const mergeByTitle = (nodes) => {
    const merged = new Map()
    for (const node of nodes) {
      const existing = merged.get(node.title)
      if (!existing) {
        merged.set(node.title, { ...node, children: mergeByTitle(node.children) })
      } else {
        existing.journalEntries = [...new Set([...existing.journalEntries, ...node.journalEntries])]
        existing.children = mergeByTitle([...existing.children, ...node.children])
      }
    }
    return [...merged.values()]
  }
  return mergeByTitle(objectives)
}

async function fetchQuestObjectives(title) {
  const url = new URL('https://bg3.wiki/w/api.php')
  url.search = new URLSearchParams({ action: 'parse', page: title, prop: 'wikitext', format: 'json', origin: '*' }).toString()
  const response = await fetch(url, { headers: { 'user-agent': 'Polyhedron reference index' } })
  if (!response.ok) return []
  const payload = await response.json()
  const wikitext = payload.parse?.wikitext?.['*']
  return typeof wikitext === 'string' ? parseQuestObjectives(wikitext) : []
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

// Objectives live on individual quest pages, rather than in the Quests category index.
// Fetch with a small concurrency limit so refreshing the reference does not hammer the Wiki.
const questEntries = [...unique.values()]
let nextQuestIndex = 0
await Promise.all(Array.from({ length: 3 }, async () => {
  while (nextQuestIndex < questEntries.length) {
    const index = nextQuestIndex++
    const quest = questEntries[index]
    try {
      quest.objectives = await fetchQuestObjectives(quest.wikiTitle.replaceAll(' ', '_'))
    } catch (error) {
      console.warn(`Could not load objectives for ${quest.wikiTitle}: ${error.message}`)
      quest.objectives = []
    }
  }
}))

const output = {
  sourceUrl: 'https://bg3.wiki/wiki/Quests',
  sourceRevision: page.revid,
  license: 'CC BY-NC-SA 4.0 or CC BY-SA 4.0 (see source page)',
  entries: [...unique.values()]
}
const outputPath = path.join(root, 'resources/reference/BG3 Quests.json')
fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
console.log(`Quest reference: ${output.entries.length} quests from ${output.sourceUrl}; ${output.entries.filter((quest) => quest.objectives?.length).length} with objectives`)
