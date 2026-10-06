// Read-only audit; credential values are never printed.
const { app, safeStorage } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const { createRequire } = require('node:module')
const assert = require('node:assert/strict')
const builderRequire = createRequire(require.resolve('electron-builder/package.json'))
const asar = createRequire(builderRequire.resolve('app-builder-lib/package.json'))('@electron/asar')
const Database = require('better-sqlite3')

app.whenReady().then(() => {
  const release = path.resolve(process.argv[2] || 'dist/security-check/win-unpacked')
  const resources = path.join(release, 'resources')
  const archive = path.join(resources, 'app.asar')
  const values = []
  const profileIndex = process.argv.indexOf('--profile')
  const decode = value => value?.startsWith('os-encrypted:v1:')
    ? safeStorage.decryptString(Buffer.from(value.slice('os-encrypted:v1:'.length), 'base64')) : value
  if (profileIndex >= 0) {
    const profile = path.resolve(process.argv[profileIndex + 1])
    const database = new Database(path.join(profile, 'polyhedron.db'), { readonly: true })
    for (const row of database.prepare('SELECT key,value FROM config').all()) {
      if (/^(openai|deepl|google|anthropic|gemini|grok)_key$/.test(row.key) && row.value) values.push(decode(row.value))
    }
    database.close()
    for (const name of ['google-drive-token.json', 'google-drive-token.secure.json']) {
      const file = path.join(profile, name)
      if (!fs.existsSync(file)) continue
      const saved = JSON.parse(fs.readFileSync(file, 'utf8'))
      if (saved.refresh_token) values.push(saved.refresh_token)
      if (saved.access_token) values.push(saved.access_token)
      if (saved.encryptedRefreshToken) values.push(decode(saved.encryptedRefreshToken))
    }
  }
  const names = asar.listPackage(archive)
  let checked = 0
  for (const name of names) {
    assert.ok(!/google-drive-(?:token|credentials)|\.pws$|\.db(?:-|$)|(?:^|[\\/])\.env(?:\.|$)/i.test(name), 'Forbidden user-data file in release')
    if (!/\.(?:js|cjs|mjs|json|txt|yml|yaml|html|css|sql|xml|config)$/i.test(name)) continue
    const file = name.replace(/^[\\/]/, '').replace(/\//g, '\\')
    const stat = asar.statFile(archive, file, false)
    if (stat.files || stat.link) continue
    const bytes = asar.extractFile(archive, file)
    for (const secret of values) assert.ok(!bytes.includes(Buffer.from(secret)), 'Personal credential found in release')
    checked++
  }
  const metadata = JSON.parse(fs.readFileSync(path.join(resources, 'google-drive/google-drive-credentials.json'), 'utf8'))
  const allowlisted = require('./prepare-google-oauth.cjs').publicDesktopCredentials(metadata)
  assert.deepEqual(metadata, allowlisted)
  for (const secret of values) assert.ok(!JSON.stringify(metadata).includes(secret), 'Personal credential in OAuth metadata')
  console.log(`PASS: ${checked} packaged text assets contain none of the ${values.length} supplied local credentials; no token/database/workspace files bundled; OAuth metadata allowlisted`)
  app.quit()
}).catch(error => { console.error(error.message); app.exit(1) })
