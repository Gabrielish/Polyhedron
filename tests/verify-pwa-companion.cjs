const assert = require('node:assert/strict')
const path = require('node:path')
const { createRequire } = require('node:module')
const { buildSync } = createRequire(require.resolve('vite/package.json'))('esbuild')
const root = path.resolve(__dirname, '..')
const companionStyles = require('node:fs').readFileSync(path.join(root, 'pwa/src/styles.css'), 'utf8')
assert.match(companionStyles, /:is\(button,a\.secondary-button\):not\(\.primary-button,\.tab\.active\):hover:not\(:disabled\)/)
assert.match(companionStyles, /\.primary-button:hover:not\(:disabled\) \{ color:#101010;/)
assert.match(companionStyles, /\.tab\.active:hover:not\(:disabled\) \{ color:#101010;/)
function bundle(contents, clientId = 'undefined') {
  const output = buildSync({ absWorkingDir: root, bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', loader: { '.css': 'empty', '.svg': 'text' }, define: { 'import.meta.env.VITE_GOOGLE_CLIENT_ID': clientId, 'import.meta.env.BASE_URL': '"/Polyhedron/"', 'import.meta.url': '"file:///test/companion.js"' }, stdin: { resolveDir: root, loader: 'jsx', contents } }).outputFiles[0].text
  const module = { exports: {} }
  new Function('module', 'exports', 'require', output)(module, module.exports, require)
  return module.exports
}
const html = bundle(`import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {App} from './pwa/src/App';module.exports=renderToStaticMarkup(<App/>);`)
assert.match(html, /Download workspace/)
assert.match(html, /Import file/)
assert.match(html, /Open a workspace/)
assert.match(html, /class="companion-workspace-bar"/)
assert.doesNotMatch(html, /companion-legal|Before connecting, review our/)
assert.doesNotMatch(html, /companion-intro|companion-empty|No workspace loaded/)
assert.equal((html.match(/>Import file<\/button>/g) || []).length, 1)
assert.match(html, /Google Drive workspace/)
assert.match(html, /class="companion-page"/)
assert.match(html, /class="lp-header companion-header"/)
assert.match(html, /class="lp-brand" href="#app" aria-label="Polyhedron companion"/)
assert.match(html, /class="lp-nav-connect companion-back" href="#top"/)
assert.doesNotMatch(html, /class="brand-lockup" href="#top"/)
assert.doesNotMatch(html, /Polyhedron Mobile|connect-screen/)
assert.equal((html.match(/class="tab(?: active)?"/g) || []).length, 4)
assert.match(html, />Spells<\/button>/)
async function main() {
  const { parseWorkspaceSyncDocument, isWorkspaceSyncDocument } = bundle(`export * from './pwa/src/sync/workspaceSync';`)
  const legacy = { version: 1, sessions: [{ id: 'legacy', modName: 'Legacy workspace', sourceLang: 'en', targetLang: 'ro', entries: [{ uid: 'legacy-one', target: 'Traducere păstrată', needsReview: true, history: [{ action: 'test' }] }] }] }
  assert.equal(isWorkspaceSyncDocument(legacy), false)
  const normalized = parseWorkspaceSyncDocument(legacy)
  assert.equal(normalized.sessions[0].entries[0].source, '')
  assert.equal(normalized.sessions[0].entries[0].sourceMissing, true)
  assert.equal(normalized.sessions[0].entries[0].target, 'Traducere păstrată')
  assert.equal(normalized.sessions[0].entries[0].needsReview, true)
  assert.deepEqual(normalized.sessions[0].entries[0].history, [{ action: 'test' }])
  assert.equal(legacy.sessions[0].entries[0].source, undefined, 'Normalization must not mutate cloud input')
  assert.equal(isWorkspaceSyncDocument(normalized), true)
  assert.throws(() => parseWorkspaceSyncDocument({ version: 1, sessions: [{ entries: null }] }), /invalid entries/)
  assert.throws(() => parseWorkspaceSyncDocument({ version: 1, sessions: [{ entries: [{ uid: 'bad', source: 123 }] }] }), /invalid text/)
  assert.throws(() => parseWorkspaceSyncDocument({ version: 1, sessions: [{ entries: [{ uid: 'bad', genderTargets: { female: 123 } }] }] }), /invalid gender/)
  const missing = bundle(`export * from './pwa/src/sync/driveConnection';`)
  assert.equal(missing.pendingDriveConnection(), null)
  await assert.rejects(missing.beginDriveConnection(), /not configured/)
  const storage = new Map()
  global.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }
  let requests = 0
  let callback
  let popupError
  global.window = { google: { accounts: { oauth2: { initTokenClient: options => {
    callback = options.callback
    popupError = options.error_callback
    return { requestAccessToken: () => { requests++ } }
  } } } } }
  const connection = bundle(`export * from './pwa/src/sync/driveConnection';`, '"test-client"')
  assert.equal(connection.pendingDriveConnection(), null, 'Page visits must not start authorization')
  const first = connection.beginDriveConnection()
  assert.equal(requests, 1, 'The preloaded SDK must open from the click synchronously')
  assert.equal(first, connection.beginDriveConnection(), 'Duplicate clicks share one authorization request')
  await Promise.resolve(); await Promise.resolve()
  assert.equal(requests, 1)
  callback({ access_token: 'test-token' })
  assert.equal(await first, 'test-token')
  assert.equal(storage.get('polyhedron.google-drive.connected'), 'true')
  assert(![...storage.values()].includes('test-token'), 'Access tokens must not be persisted')
  const returning = connection.beginDriveConnection()
  assert.equal(requests, 2)
  const beforeFailure = requests
  popupError({ type: 'popup_closed' })
  await assert.rejects(returning, /cancelled/)
  assert.equal(requests, beforeFailure, 'Closing a returning-user popup must not open a second popup')
  storage.clear()
  const retry = connection.beginDriveConnection()
  await Promise.resolve(); await Promise.resolve()
  callback({ error: 'access_denied' })
  await assert.rejects(retry, /access_denied/)
  const cancelled = connection.beginDriveConnection()
  await Promise.resolve(); await Promise.resolve()
  popupError({ type: 'popup_closed' })
  await assert.rejects(cancelled, /cancelled/)
  console.log('PASS: legacy source-less workspace normalization, invalid data rejection, direct workspace UI, single shared connection, cancelled authorization, memory-only tokens')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
