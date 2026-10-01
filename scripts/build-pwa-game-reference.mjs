import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const source = path.join(root, 'src', 'renderer', 'src', 'data', 'gameReference.generated.json')
const destination = path.join(root, 'pwa', 'public', 'data', 'game-reference.json')
fs.mkdirSync(path.dirname(destination), { recursive: true })
fs.copyFileSync(source, destination)
console.log(`Copied game reference catalog to ${path.relative(root, destination)}`)
