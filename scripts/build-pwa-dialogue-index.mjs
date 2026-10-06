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
  // The companion opens full graphs on the external viewer. Its local editor
  // only needs source-to-dialogue mappings, not the unused graph (~19 MB).
  entries: source.entries
}
fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, JSON.stringify(compact))
console.log(`Wrote ${Math.round(fs.statSync(outputPath).size / 1024 / 1024)} MB dialogue index`)
