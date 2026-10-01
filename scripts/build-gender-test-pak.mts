import path from 'node:path'
import pakWriter from '../src/main/services/pak/pak-writer'

const projectRoot = process.cwd()
const sourceRoot = path.join(projectRoot, 'mods', 'PolyhedronGenderTest')
const outputPath = path.join(projectRoot, 'mods', 'PolyhedronGenderTest.pak')

const writePackage = (pakWriter as unknown as { writePackage: (source: string, output: string) => Promise<void> }).writePackage
await writePackage(sourceRoot, outputPath)
console.log(`Gender test PAK: ${outputPath}`)
