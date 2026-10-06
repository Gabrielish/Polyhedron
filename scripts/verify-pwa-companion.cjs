const assert = require('node:assert/strict')
const path = require('node:path')
const { createRequire } = require('node:module')
const { buildSync } = createRequire(require.resolve('vite/package.json'))('esbuild')
const root = path.resolve(__dirname, '..')
function bundle(contents, clientId = 'undefined') {
  const output = buildSync({ absWorkingDir: root, bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', loader: { '.css': 'empty', '.svg': 'text' }, define: { 'import.meta.env.VITE_GOOGLE_CLIENT_ID': clientId }, stdin: { resolveDir: root, loader: 'jsx', contents } }).outputFiles[0].text
  const module = { exports: {} }
  new Function('module', 'exports', 'require', output)(module, module.exports, require)
  return module.exports
}
const html = bundle(`import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {App} from './pwa/src/App';module.exports=renderToStaticMarkup(<App/>);`)
assert.match(html, /Download workspace/)
assert.match(html, /Import file/)
assert.match(html, /Google Drive workspace/)
assert.doesNotMatch(html, /Polyhedron Mobile|connect-screen/)
assert.equal((html.match(/class="tab(?: active)?"/g) || []).length, 3)
async function main() {
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
  assert.equal(first, connection.beginDriveConnection(), 'Duplicate clicks share one authorization request')
  await Promise.resolve(); await Promise.resolve()
  assert.equal(requests, 1)
  callback({ access_token: 'test-token' })
  assert.equal(await first, 'test-token')
  assert.equal(storage.get('polyhedron.google-drive.connected'), 'true')
  assert(![...storage.values()].includes('test-token'), 'Access tokens must not be persisted')
  storage.clear()
  const retry = connection.beginDriveConnection()
  await Promise.resolve(); await Promise.resolve()
  callback({ error: 'access_denied' })
  await assert.rejects(retry, /access_denied/)
  const cancelled = connection.beginDriveConnection()
  await Promise.resolve(); await Promise.resolve()
  popupError({ type: 'popup_closed' })
  await assert.rejects(cancelled, /cancelled/)
  console.log('PASS: direct workspace UI, import entry point, missing OAuth config, single shared connection, denied authorization, memory-only tokens')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
