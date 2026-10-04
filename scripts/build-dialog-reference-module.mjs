import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const output = path.join(root, 'src/renderer/src/data/dialogReference.ts')
fs.mkdirSync(path.dirname(output), { recursive: true })
fs.copyFileSync(path.join(root, 'scripts/templates/dialogReference.ts'), output)
