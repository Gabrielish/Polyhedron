const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createRequire } = require('node:module')
const { buildSync } = createRequire(require.resolve('vite/package.json'))('esbuild')
const root = path.resolve(__dirname, '..')
const bundle = buildSync({
  absWorkingDir: root, bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic',
  loader: { '.css': 'empty', '.svg': 'text' }, define: { 'import.meta.env.BASE_URL': '"/Polyhedron/"', 'import.meta.env.VITE_GOOGLE_CLIENT_ID': 'undefined' },
  stdin: { resolveDir: root, loader: 'jsx', contents: `import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {LandingPage} from './pwa/src/LandingPage';module.exports=renderToStaticMarkup(<LandingPage/>);` },
}).outputFiles[0].text
const result = { exports: {} }
new Function('module', 'exports', 'require', bundle)(result, result.exports, require)
const html = result.exports
assert.match(html, /href="#app"/)
assert.match(html, /href="#download"/)
assert.match(html, /id="support"/)
assert.match(html, /href="https:\/\/www\.patreon\.com\/Gabrielish\/posts\/baldurs-gate-3-166380267\?/)
assert.match(html, /href="https:\/\/ko-fi\.com\/gabrielish" target="_blank" rel="noopener noreferrer"/)
assert.match(html, /aria-controls="site-navigation"/)
assert.match(html, /aria-expanded="false"/)
assert.equal((html.match(/role="tab"/g) || []).length, 7)
assert.equal((html.match(/aria-pressed="(?:true|false)"/g) || []).length, 12)
for (const name of ['Match case', 'Whole word', 'Find and replace']) assert.match(html, new RegExp(`aria-label="${name}"`))
assert.match(html, /aria-live="polite"/)
assert.match(html, /src="\/Polyhedron\/showcase\/translate.png"/)
assert.doesNotMatch(html, /lp-window-bar|lp-window-dots|showcase\/[^" ]+\.jpg/)
assert.doesNotMatch(html, /<iframe|accounts\.google\.com|gabrielbundea.*@/i)
for (const image of ['translate', 'dialogues', 'game-data', 'spells', 'consistency', 'workspace', 'glossary']) {
  const bytes = fs.readFileSync(path.join(root, `pwa/public/showcase/${image}.png`))
  assert.deepEqual([...bytes.subarray(0, 8)], [137,80,78,71,13,10,26,10])
  assert.equal(bytes.readUInt32BE(16), 1920)
  assert.equal(bytes.readUInt32BE(20), 1170)
}
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'pwa/public/manifest.webmanifest'), 'utf8'))
assert.equal(manifest.start_url, '/Polyhedron/#app')
assert.equal(manifest.scope, '/Polyhedron/')
const index = fs.readFileSync(path.join(root, 'pwa/index.html'), 'utf8')
assert.match(index, /href="\.\/manifest.webmanifest"/)
assert.match(index, /name="description"/)
assert.match(index, /rel="icon" type="image\/png" sizes="32x32" href="\.\/icons\/polyhedron-32.png"/)
for (const size of [32, 64, 180, 192, 512]) {
  const icon = fs.readFileSync(path.join(root, `pwa/public/icons/polyhedron-${size}.png`))
  assert.equal(icon.readUInt32BE(16), size)
  assert.equal(icon.readUInt32BE(20), size)
}
assert.match(index, /rel="apple-touch-icon" sizes="180x180" href="\.\/icons\/polyhedron-home-v2-180.png"/)
for (const size of [180,192,512]) {
  const icon = fs.readFileSync(path.join(root, `pwa/public/icons/polyhedron-home-v2-${size}.png`))
  assert.equal(icon.readUInt32BE(16), size)
  assert.equal(icon.readUInt32BE(20), size)
}
assert.deepEqual(manifest.icons.map(icon => icon.src), ['icons/polyhedron-home-v2-192.png', 'icons/polyhedron-home-v2-512.png'])
assert(manifest.icons.every(icon => icon.purpose === 'any maskable'))
console.log('PASS: landing CTAs, mobile menu, seven workspace tabs, twelve search/editing explanations, real screenshots, correct Pages asset paths and companion manifest')
