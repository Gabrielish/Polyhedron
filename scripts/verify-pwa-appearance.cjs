const assert = require('node:assert/strict')
const { createRequire } = require('node:module')
const vm = require('node:vm')
const path = require('node:path')
const { buildSync } = createRequire(require.resolve('vite/package.json'))('esbuild')
const bundle = buildSync({ entryPoints: [path.join(__dirname, '../pwa/src/sync/appearance.ts')], bundle: true, write: false, platform: 'node', format: 'cjs' }).outputFiles[0].text
const saved = new Map(), styles = new Map()
const context = { exports: {}, module: { exports: {} }, localStorage: { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) }, window: { document: { documentElement: { style: { setProperty: (key, value) => styles.set(key, value) } } } } }
vm.runInNewContext(bundle, context)
const api = context.module.exports
for (const accent of ['#8C52FF', '#A7F175', '#ED1C24']) for (const buttonTextColor of ['white', 'black']) {
  const appearance = api.normalizeAppearance({ accent: accent.toLowerCase(), buttonTextColor })
  assert.equal(appearance.accent, accent)
  api.applyAppearance(appearance)
  assert.equal(styles.get('--accent'), accent)
  assert.equal(styles.get('--accent-foreground'), buttonTextColor === 'black' ? '#101010' : '#FFFFFF')
  assert.equal(api.readAppearance().accent, accent)
  assert.equal(api.readAppearance().buttonTextColor, buttonTextColor)
}
for (const invalid of [undefined, {}, { accent: 'red', buttonTextColor: 'white' }, { accent: '#123456; background:red', buttonTextColor: 'black' }, { accent: '#123456', buttonTextColor: 'invalid' }]) assert.equal(api.normalizeAppearance(invalid), null)
saved.set(api.APPEARANCE_STORAGE_KEY, '{broken')
assert.equal(api.readAppearance().accent, api.DEFAULT_APPEARANCE.accent)
context.localStorage.setItem = () => { throw new Error('Storage unavailable') }
api.applyAppearance({ accent: '#123456', buttonTextColor: 'black' })
assert.equal(styles.get('--accent-rgb'), '18 52 86')
console.log('PASS: synced colors, white/black foreground, offline persistence, invalid metadata and unavailable storage')
