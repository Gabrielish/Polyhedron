const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createRequire } = require('node:module')
const { buildSync } = createRequire(require.resolve('vite/package.json'))('esbuild')
const root = path.resolve(__dirname, '..')
const bundle = buildSync({ bundle:true,write:false,platform:'node',format:'cjs',entryPoints:[path.join(root,'src/renderer/src/data/creatureGuide.ts')] }).outputFiles[0].text
const compiled = {exports:{}}; new Function('module','exports','require',bundle)(compiled,compiled.exports,require)
const entries = compiled.exports.creatureGuideTypes.flatMap(type=>[type,...type.children])
const ids = new Set(entries.map(entry=>entry.id))
const directory = path.join(root,'src/renderer/src/assets/creatures')
const files = fs.readdirSync(directory).filter(filename=>/\.(jpg|png|webp)$/.test(filename))
assert(files.length > 0)
for (const filename of files) {
  const id = filename.replace(/\.[^.]+$/,'')
  assert(ids.has(id),'Portrait must match a registered creature: '+id)
  const bytes = fs.readFileSync(path.join(directory,filename))
  assert(filename.endsWith('.jpg') && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255,'Valid preserved JPEG: '+filename)
}
async function main() {
  const { createServer } = await import('vite')
  const server = await createServer({ configFile:false, root:path.join(root,'src/renderer'),optimizeDeps:{noDiscovery:true,include:[],entries:[]},server:{middlewareMode:true,watch:null},appType:'custom' })
  try {
    const result = await server.transformRequest('/src/data/creaturePortraits.ts')
    assert(result?.code,'Portrait URL module must compile through Vite')
    for (const filename of files) assert(result.code.includes(filename),'Bundled portrait missing: '+filename)
  } finally { await server.close() }
  console.log('PASS: '+files.length+' preserved portraits, valid creature IDs, image signatures and Vite asset inclusion; local overrides remain separate')
}
main().catch(error=>{console.error(error);process.exitCode=1})
