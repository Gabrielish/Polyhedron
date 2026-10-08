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
assert.equal((html.match(/href="#app"/g) || []).length, 2, 'Companion links appear only in hero and navbar')
assert.doesNotMatch(html, /id="companion"|href="#companion"|lp-download-web|Open companion/)
assert.equal((html.match(/class="lp-download-card"/g) || []).length, 2)
const linuxCard = html.match(/<article class="lp-download-card lp-download-coming">[\s\S]*?<\/article>/)?.[0]
assert(linuxCard)
assert.match(linuxCard, /<h3>Linux<\/h3>/)
assert.match(linuxCard, /Coming soon/)
assert.doesNotMatch(linuxCard, /href=|<button|<a\s/)
assert(html.indexOf('<h3>Windows</h3>') < html.indexOf('<h3>macOS</h3>'))
assert(html.indexOf('<h3>macOS</h3>') < html.indexOf('<h3>Linux</h3>'))
assert.match(html, /class="lp-hero-copy"/)
assert.doesNotMatch(html, /lp-hero-dragon/)
assert.match(html, /class="lp-brand"[^>]*><svg/)
assert.match(html, /lucide-apple/)
assert.equal((html.match(/<details>/g) || []).length, 9)
assert.match(html, /id="extra-questions" hidden=""/)
assert.match(html, /class="lp-faq-toggle" type="button" aria-expanded="false" aria-controls="extra-questions"/)
assert.match(html, /Show more/)
assert.match(html, /href="#download"/)
assert.match(html, /class="lp-section-heading lp-download-heading"/)
assert.doesNotMatch(html, /Get Polyhedron for Windows or macOS/)
assert.match(html, /Polyhedron is a desktop application built with Electron, React and TypeScript/)
assert.match(html, /local SQLite storage/)
assert.match(html, /class="lp-download-note lp-release-note"/)
assert.match(html, /id="support"/)
assert.match(html, /href="https:\/\/www\.patreon\.com\/cw\/Gabrielish"/)
assert.match(html, /id="feedback" aria-labelledby="feedback-heading"/)
assert.match(html, /class="lp-wrap lp-support lp-feedback"/)
assert(html.indexOf('id="support"') < html.indexOf('id="feedback"'))
assert(html.indexOf('id="feedback"') < html.indexOf('class="lp-wrap lp-faq"'))
assert.match(html, /Share an idea/)
assert.match(html, /Submitted feedback is public/)
assert.match(html, /href="https:\/\/github\.com\/Gabrielish\/Polyhedron\/issues\/new\?title=Suggestion/)
assert.match(html, /href="#feedback"/)
assert.match(html, /href="https:\/\/www\.virustotal\.com\/gui\/file\/fa24539148f9d0b596bc57e563d2dc79d750cba977714b01150a3fa2c9eae88b\?nocache=1" target="_blank" rel="noopener noreferrer"/)
assert.doesNotMatch(html, /Links use the SHA-256|Reports apply to the exact scanned files/)
assert.doesNotMatch(html, /lp-download-count|downloads · latest release|Download count unavailable/)
const ts = require('typescript')
const downloadsModule = { exports: {} }
const downloadsSource = fs.readFileSync(path.join(root, 'pwa/src/releaseDownloads.ts'), 'utf8')
new Function('module', 'exports', ts.transpileModule(downloadsSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(downloadsModule, downloadsModule.exports)
const { releaseDownloads, releasesRepo, virusTotalReport } = downloadsModule.exports
const currentWindowsHash = '5327948d887742463201007d7751efb2736d38eaaa8a03e06924486ee39b4418'
const currentMacHash = 'acf30b83a35c931cd4f80b90ae202b0b9eb3882b0142c6dd12d0d051ee22901c'
for (const hash of [currentWindowsHash, currentMacHash]) {
  assert.equal(virusTotalReport({ url: '', digest: `sha256:${hash}` }), `https://www.virustotal.com/gui/file/${hash}`)
}
assert.equal(virusTotalReport({ url: '', digest: `sha256:${currentMacHash.toUpperCase()}` }), `https://www.virustotal.com/gui/file/${currentMacHash}`)
for (const digest of [undefined, null, '', 'sha256:short', `md5:${currentWindowsHash}`, 'sha256:https://example.com']) assert.equal(virusTotalReport({ url: '', digest }), undefined)
assert.equal(virusTotalReport(), undefined)
const releaseAsset = (name, download_count = 0, browser_download_url = `${releasesRepo}/releases/download/v-test/${name}`) => ({ name, download_count, browser_download_url })
const downloads = releaseDownloads({ tag_name: 'v-test', assets: [
  releaseAsset('Polyhedron-windows-x64-setup.exe.blockmap', 999),
  releaseAsset('Polyhedron-windows-x64-setup.exe', 500, 'https://example.com/fake.exe'),
  releaseAsset('Polyhedron-windows-x64-setup.exe', 12),
  releaseAsset('Polyhedron-arm64.zip', 600),
  releaseAsset('Polyhedron-arm64.dmg', 0)
] })
assert.equal(downloads.version, 'v-test')
assert.equal(downloads.windows.downloads, 12)
assert.equal(downloads.mac.downloads, 0, 'Zero is a real count, not missing data')
assert.match(downloads.windows.url, /setup\.exe$/)
assert.match(downloads.mac.url, /arm64\.dmg$/)
assert.equal(releaseDownloads({ tag_name: 'v-empty', assets: [] }).windows, undefined)
assert.equal(releaseDownloads({ tag_name: 'v-bad-count', assets: [releaseAsset('Polyhedron-arm64.dmg', -1)] }).mac.downloads, undefined)
assert.doesNotMatch(html, /baldurs-gate-3-166380267/)
assert.match(html, /href="https:\/\/ko-fi\.com\/gabrielish" target="_blank" rel="noopener noreferrer"/)
assert.match(html, /aria-controls="site-navigation"/)
assert.match(html, /aria-expanded="false"/)
assert.equal((html.match(/role="tab"/g) || []).length, 7)
const workspaceTabs = [...html.matchAll(/<button[^>]*role="tab"[^>]*>[\s\S]*?<\/button>/g)].map(match => match[0].replace(/<[^>]+>/g, ''))
assert.deepEqual(workspaceTabs, ['Translate', 'Consistency', 'Dialogue Nodes', 'Game Data', 'Spells', 'Workspace', 'Term Glossary'])
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
assert.match(index, /rel="apple-touch-icon" sizes="180x180" href="\.\/icons\/polyhedron-home-v3-180.png"/)
for (const size of [180,192,512]) {
  const icon = fs.readFileSync(path.join(root, `pwa/public/icons/polyhedron-home-${size === 180 ? 'v3' : 'v2'}-${size}.png`))
  assert.equal(icon.readUInt32BE(16), size)
  assert.equal(icon.readUInt32BE(20), size)
}
assert.deepEqual(manifest.icons.map(icon => icon.src), ['icons/polyhedron-home-v2-192.png', 'icons/polyhedron-home-v2-512.png'])
assert(manifest.icons.every(icon => icon.purpose === 'any maskable'))
console.log('PASS: landing CTAs, mobile menu, seven workspace tabs, twelve search/editing explanations, real screenshots, correct Pages asset paths and companion manifest')
