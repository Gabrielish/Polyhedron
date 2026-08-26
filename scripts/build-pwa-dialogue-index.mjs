import fs from "node:fs"
import path from "node:path"

const sourcePath = path.resolve("src/renderer/src/data/dialogReference.generated.json")
const outputPath = path.resolve("pwa/public/data/dialogue-index.json")
const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"))
const compact = {
  version: source.version,
  categories: source.categories,
  files: source.files,
  dialogues: source.dialogues,
  nodes: source.nodes.map(([dialogue, node, hashes, next]) => [dialogue, node, hashes, next]),
  entries: source.entries
}
fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, JSON.stringify(compact))
console.log(`Wrote ${Math.round(fs.statSync(outputPath).size / 1024 / 1024)} MB dialogue index`)
