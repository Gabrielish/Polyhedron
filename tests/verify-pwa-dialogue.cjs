const assert = require('node:assert/strict')
const { createRequire } = require('node:module')
const { buildSync } = createRequire(require.resolve('vite/package.json'))('esbuild')
const fs = require('node:fs')
const reference = JSON.parse(fs.readFileSync('pwa/public/data/dialogue-index.json', 'utf8'))
assert(!reference.nodes, 'Unused graph data must not be shipped to the companion')
let fetches = 0; const results = []
global.fetch = async () => { fetches++; return { ok:true, json:async () => reference } }
global.self = { postMessage: result => results.push(result), onmessage:null }
const output = buildSync({ bundle:true, write:false, platform:'node', format:'cjs', entryPoints:['pwa/src/workers/dialogue.worker.ts'], define:{'import.meta.env.BASE_URL':'"/Polyhedron/"'} }).outputFiles[0].text
new Function('require',output)(require)
async function main() {
  const rows = [{uid:'one',source:'This text is ancient. A dedication to a forgotten god?'},{uid:'two',source:'*You do not recognise the language on the plaque.*'}]
  await self.onmessage({data:{id:1,rows,url:'test'}})
  assert.equal(results[0].items.length,1)
  assert.equal(results[0].items[0].name,'CHA_BronzePlaque_AD_SanctumStatue')
  assert.equal(results[0].items[0].nodes.length,2)
  assert.equal(results[0].items[0].act,'Act 1')
  await self.onmessage({data:{id:2,rows:[...rows,rows[0]],url:'test'}})
  assert.equal(results[1].items[0].nodes.length,2,'Duplicate rows must not duplicate nodes')
  assert.equal(fetches,1,'Reference is loaded once per worker')
  console.log('PASS: real dialogue mapping, act classification, duplicate-node elimination, cached reference and reduced payload')
}
main().catch(error=>{ console.error(error); process.exitCode=1 })
