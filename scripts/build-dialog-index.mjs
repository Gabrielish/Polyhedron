import fs from 'node:fs'
import path from 'node:path'

const projectRoot = process.cwd()
const sourceDir = path.join(projectRoot, 'reference', 'dialogs')
const outputFile = path.join(
  projectRoot,
  'src',
  'renderer',
  'src',
  'data',
  'dialogReference.generated.json'
)

const categoryOrder = [
  'Tutorial',
  'Act 1',
  'Camp',
  'Companions',
  'Act 2',
  'Act 3',
  'Global',
  'Generics',
  'World Cinematics',
  'Combat Cinematics',
  'Main Menu',
  'Test',
  'Other'
]

const categoryForFile = (fileName) => {
  const stem = fileName.replace(/\.html(?:\.html)?$/i, '')
  if (/^Tutorial$/i.test(stem)) return 'Tutorial'
  if (/^Act1/i.test(stem)) return 'Act 1'
  if (/^Camp/i.test(stem)) return 'Camp'
  if (/^Companions/i.test(stem)) return 'Companions'
  if (/^Act2/i.test(stem)) return 'Act 2'
  if (/^Act3/i.test(stem)) return 'Act 3'
  if (/^Global/i.test(stem)) return 'Global'
  if (/^Generics/i.test(stem)) return 'Generics'
  if (/^WorldCinematics/i.test(stem)) return 'World Cinematics'
  if (/^CombatCinematics/i.test(stem)) return 'Combat Cinematics'
  if (/^MainMenu/i.test(stem)) return 'Main Menu'
  if (/^Test/i.test(stem)) return 'Test'
  return 'Other'
}

const decodeHtml = (value) => value
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/<[^>]*>/g, '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;/gi, "'")
  .replace(/&#x27;/gi, "'")
  .replace(/\s+/g, ' ')
  .trim()

const normalize = (value) => decodeHtml(value).toLocaleLowerCase()

const hashText = (value) => {
  let hash = 14695981039346656037n
  for (const byte of Buffer.from(value, 'utf8')) {
    hash ^= BigInt(byte)
    hash = BigInt.asUintN(64, hash * 1099511628211n)
  }
  return hash.toString(16).padStart(16, '0')
}

const files = fs.readdirSync(sourceDir)
  .filter((fileName) => fileName.toLowerCase().endsWith('.html'))
  .sort((a, b) => a.localeCompare(b))

const records = new Map()
const nodes = []
const detailValues = []
const detailIds = new Map()
const fileNames = []
const dialogueNames = []
const fileIds = new Map()
const dialogueIds = new Map()

const getId = (map, values, value) => {
  const existing = map.get(value)
  if (existing !== undefined) return existing
  const id = values.length
  values.push(value)
  map.set(value, id)
  return id
}

const getDetailId = (value) => {
  const existing = detailIds.get(value)
  if (existing !== undefined) return existing
  const id = detailValues.length
  detailValues.push(value)
  detailIds.set(value, id)
  return id
}

for (const fileName of files) {
  const category = categoryForFile(fileName)
  const fileLabel = fileName.replace(/\.html(?:\.html)?$/i, '')
  const html = fs.readFileSync(path.join(sourceDir, fileName), 'utf8')
  const sections = html.split(/<hr\s*\/?>/i)

  for (const section of sections) {
    const fileMatch = section.match(/<i>File\s+([^<]+?)\.lsj<\/i>/i)
    const dialogueFile = fileMatch?.[1]?.split(/[\\/]/).pop() ?? fileLabel
    const dialogueId = getId(dialogueIds, dialogueNames, dialogueFile)
    // Capture the complete node, including links that appear after the uid line.
    const nodePattern = /<span\s+id="([0-9a-f-]{36})"><\/span>([\s\S]*?)(?:(?:=== END NODE ===)|(?=<span\s+id="[0-9a-f-]{36}">)|$)/gi

    for (const match of section.matchAll(nodePattern)) {
      const nodeId = match[1]
      const nodeBody = match[2]
      const texts = [...nodeBody.matchAll(/(?:\d+:\d+\s+-\s+)(.*?)(?=<br\s*\/?>|$)/gis)]
        .map((textMatch) => decodeHtml(textMatch[1]))
        .filter((text) => text && text !== 'null')
      const textHashes = []
      const detailTexts = []
      for (const detailMatch of nodeBody.matchAll(/<i>(.*?)<\/i>/gis)) {
        const detail = decodeHtml(detailMatch[1])
        if (detail && detail.toLowerCase() !== 'null') detailTexts.push(detail)
      }
      if (/<i>null<\/i>/i.test(nodeBody)) detailTexts.push('null')

      for (const text of texts) {
        const normalizedText = normalize(text)
        const key = hashText(normalizedText)
        if (!key) continue
        textHashes.push(key)
        const categoryId = categoryOrder.indexOf(category)
        const fileId = getId(fileIds, fileNames, fileLabel)
        const record = records.get(key) ?? { normalizedText, groups: [] }
        if (record.normalizedText !== normalizedText) {
          throw new Error(`Dialog index hash collision for ${text}`)
        }
        const group = [categoryId, fileId, dialogueId, nodeId]
        if (!record.groups.some((item) => item[0] === categoryId && item[1] === fileId && item[2] === dialogueId && item[3] === nodeId)) {
          record.groups.push(group)
        }
        records.set(key, record)
      }
      const nextNodes = [...nodeBody.matchAll(/href="[^"]+#([0-9a-f-]{36})"/gi)].map((link) => link[1])
      nodes.push([
        dialogueId,
        nodeId,
        [...new Set(textHashes)],
        [...new Set(nextNodes)],
        [...new Set(detailTexts.map(getDetailId))]
      ])
    }
  }
}

const output = {
  version: 1,
  categories: categoryOrder,
  files: fileNames,
  dialogues: dialogueNames,
  details: detailValues,
  nodes,
  entries: Object.fromEntries(
    [...records.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, record]) => [key, record.groups])
  )
}

fs.mkdirSync(path.dirname(outputFile), { recursive: true })
fs.writeFileSync(outputFile, `${JSON.stringify(output)}\n`, 'utf8')
console.log(`Dialog index: ${files.length} HTML files, ${records.size} texts -> ${path.relative(projectRoot, outputFile)}`)
