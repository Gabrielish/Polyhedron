const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs')
const { createHash } = require('node:crypto')
const { createRequire } = require('node:module')
const { zipSync, strToU8 } = require('fflate')
const initSqlJs = require('sql.js')
const { buildSync } = createRequire(require.resolve('vite/package.json'))('esbuild')
const root = path.resolve(__dirname, '..')

async function fixture(SQL) {
  const db = new SQL.Database()
  db.run('CREATE TABLE config (key TEXT, value TEXT); CREATE TABLE mod (name TEXT, last_file_path TEXT, updated_at TEXT);')
  db.run("INSERT INTO config VALUES ('last_source_lang','en'),('last_target_lang','ro'),('google_api_key','DO_NOT_IMPORT'),('theme_accent','#ff0000')")
  const projectPath = 'C:\\Projects\\Example\\english.xml'
  db.run('INSERT INTO mod VALUES (?, ?, ?)', ['Example', projectPath, '2026-10-08'])
  const key = `${projectPath}|en|ro`
  const sessionFile = `sessions/${createHash('sha256').update(key).digest('hex')}.json`
  const files = {
    'workspace.json': strToU8('{"version":1}'),
    'polyhedron.db': db.export(),
    'mods/Example/english.xml': strToU8('<contentList><content contentuid="one" version="1">Hello &amp; <LSTag Type="Image" Info="SoftWarning"/></content><content contentuid="two">Another source</content></contentList>'),
    [sessionFile]: strToU8(JSON.stringify({ version: 1, entries: [
      { uid: 'one', target: 'Salut', genderTargets: { female: 'Bună' }, matchType: 'manual', needsReview: true, reviewStatus: 'needs-review', history: [{ action: 'edit' }] },
      { uid: 'two', source: 'Cached source', target: 'Altă traducere' },
      { uid: 'missing', target: 'Keep this translation' }
    ] }))
  }
  db.close()
  return { files, sessionFile, bytes: zipSync(files) }
}

async function main() {
  const SQL = await initSqlJs()
  const code = buildSync({ entryPoints: [path.join(root, 'pwa/src/utils/pwsWorkspace.ts')], bundle: true, write: false, platform: 'node', format: 'cjs', external: ['fflate'] }).outputFiles[0].text
  const loaded = { exports: {} }
  new Function('module', 'exports', 'require', code)(loaded, loaded.exports, require)
  const { parsePwsWorkspace } = loaded.exports
  const data = await fixture(SQL)
  const result = await parsePwsWorkspace(data.bytes, SQL)
  assert.equal(result.sessions.length, 1)
  const project = result.sessions[0]
  assert.equal(project.modName, 'Example')
  assert.equal(project.sourceLang, 'en'); assert.equal(project.targetLang, 'ro')
  assert.equal(project.entries[0].source, 'Hello &amp; <LSTag Type="Image" Info="SoftWarning"/>')
  assert.equal(project.entries[0].target, 'Salut')
  assert.equal(project.entries[0].genderTargets.female, 'Bună')
  assert.equal(project.entries[0].needsReview, true)
  assert.equal(project.entries[0].reviewStatus, 'needs-review')
  assert.deepEqual(project.entries[0].history, [{ action: 'edit' }])
  assert.equal(project.entries[1].source, 'Cached source')
  assert.equal(project.entries[2].sourceMissing, true)
  assert.equal(project.entries[2].target, 'Keep this translation')
  assert(!JSON.stringify(result).includes('DO_NOT_IMPORT'))
  assert.equal(result.appearance, undefined)
  const withoutCache = { ...data.files }; delete withoutCache[data.sessionFile]
  const fallback = await parsePwsWorkspace(zipSync(withoutCache), SQL)
  assert.equal(fallback.sessions[0].entries.length, 2)
  assert.equal(fallback.sessions[0].entries[0].target, '')
  const legacy = { ...data.files, 'icosa.db': data.files['polyhedron.db'] }; delete legacy['polyhedron.db']
  assert.equal((await parsePwsWorkspace(zipSync(legacy), SQL)).sessions.length, 1)
  await assert.rejects(parsePwsWorkspace(strToU8('not a zip'), SQL), /Invalid .pws/)
  await assert.rejects(parsePwsWorkspace(zipSync({ 'workspace.json': strToU8('{"version":1}') }), SQL), /database|polyhedron.db/)
  await assert.rejects(parsePwsWorkspace(zipSync({ ...data.files, 'workspace.json': strToU8('{"version":999}') }), SQL), /Unsupported/)
  await assert.rejects(parsePwsWorkspace(zipSync({ ...data.files, '../secret.xml': strToU8('unsafe') }), SQL), /unsafe/)
  await assert.rejects(parsePwsWorkspace(zipSync({ ...data.files, [data.sessionFile]: strToU8('{"entries":null}') }), SQL), /invalid saved/)
  if (process.versions.electron) {
    // Integration against the running development preview: real browser Worker,
    // local WASM asset and file input. No app or installer build is performed.
    const { app, BrowserWindow } = require('electron')
    await app.whenReady()
    const win = new BrowserWindow({ show: false, webPreferences: { backgroundThrottling: false } })
    try {
      await win.loadURL('http://127.0.0.1:5174/Polyhedron/#app')
      const evaluate = js => win.webContents.executeJavaScript(js)
      for (let n = 0; n < 100; n++) { if (await evaluate('!!document.querySelector("input[type=file]")')) break; await new Promise(resolve => setTimeout(resolve, 100)) }
      await new Promise(resolve => setTimeout(resolve, 1000))
      await evaluate(`const input=document.querySelector('input[type=file]');const transfer=new DataTransfer();transfer.items.add(new File([Uint8Array.from(atob('${Buffer.from(data.bytes).toString('base64')}'),c=>c.charCodeAt(0))],'fixture.pws'));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));undefined`)
      let imported = false
      for (let n = 0; n < 150; n++) {
        imported = await evaluate('document.body.textContent.includes("Imported 1 project from fixture.pws")')
        if (imported) break
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      assert.ok(imported, await evaluate('document.body.textContent'))
      assert.ok(await evaluate('document.querySelector("#workspace-project").textContent.includes("Example")'))
      console.log('PASS: live companion file input, Worker and locally served SQLite WASM')
    } finally { win.destroy(); app.quit() }
  }
  console.log('PASS: PWS projects, source recovery, variants/review/history, legacy archive, no credentials, invalid archive/path rejection')
}
main().catch(error => { console.error(error); if (process.versions.electron) require('electron').app.exit(1); else process.exitCode = 1 })
