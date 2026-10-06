const { app, safeStorage, BrowserWindow } = require('electron')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const Module = require('node:module')
const { createRequire } = Module
const crypto = require('node:crypto')
const Database = require('better-sqlite3')

async function run() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'polyhedron-security-test-'))
  app.setPath('userData', temp)
  await app.whenReady()
  const root = path.resolve(__dirname, '..')
  const { build } = createRequire(require.resolve('vite/package.json'))('esbuild')
  global.__securityMocks = {}
  let sequence = 0
  async function loadTs(file, mocks = {}) {
    const map = {}
    for (const [name, mock] of Object.entries(mocks)) {
      const id = String(++sequence)
      global.__securityMocks[id] = mock
      map[name] = id
    }
    const bundle = await build({ entryPoints: [path.join(root, file)], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', plugins: [{ name: 'security-fixtures', setup(b) {
      b.onResolve({ filter: /.*/ }, args => map[args.path] ? { path: map[args.path], namespace: 'fixture' } : undefined)
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: `module.exports=globalThis.__securityMocks[${JSON.stringify(args.path)}]` }))
    } }] })
    const fixtureModule = new Module(path.join(root, 'scripts/.security-fixture.cjs'), module)
    fixtureModule.filename = path.join(root, 'scripts/.security-fixture.cjs')
    fixtureModule.paths = Module._nodeModulePaths(path.join(root, 'scripts'))
    fixtureModule._compile(bundle.outputFiles[0].text, fixtureModule.filename)
    return fixtureModule.exports
  }
  const secret = await loadTs('src/main/services/secret-storage.service.ts')
  assert.ok(safeStorage.isEncryptionAvailable())
  const fixtureKey = 'AIza_FAKE_TEST_KEY_NEVER_A_REAL_CREDENTIAL'
  const cipher = secret.encryptSecret(fixtureKey)
  assert.ok(!cipher.includes(fixtureKey))
  assert.equal(secret.decryptSecret(cipher), fixtureKey)
  const dbPath = path.join(temp, 'fixture.db')
  let db = new Database(dbPath)
  db.exec('CREATE TABLE config (key TEXT PRIMARY KEY, value TEXT); CREATE TABLE translations (text TEXT);')
  db.prepare('INSERT INTO config VALUES (?, ?)').run('gemini_key', fixtureKey)
  db.prepare('INSERT INTO config VALUES (?, ?)').run('theme_accent', '#A7F175')
  db.prepare('INSERT INTO translations VALUES (?)').run('Preserve my translation')
  secret.migrateStoredApiKeys(db)
  assert.ok(db.prepare('SELECT value FROM config WHERE key=?').get('gemini_key').value.startsWith('os-encrypted:v1:'))
  secret.migrateStoredApiKeys(db) // Idempotent; never encrypt twice.
  console.log('PASS: real OS encryption and lossless API-key migration')

  const handlers = new Map()
  const drizzle = require('drizzle-orm/better-sqlite3').drizzle(db)
  const configModule = await loadTs('src/main/ipc/config.ipc.ts', {
    electron: { ipcMain: { handle: (name, fn) => handlers.set(name, fn) } },
    '../database/connection': { getDb: () => drizzle },
    '../services/secret-storage.service': secret
  })
  configModule.registerConfigHandlers()
  const publicConfig = handlers.get('config:getAll')()
  assert.equal(publicConfig.gemini_key, '__POLYHEDRON_SECRET_SAVED__')
  assert.ok(!JSON.stringify(publicConfig).includes(fixtureKey))
  handlers.get('config:set')({}, { key: 'gemini_key', value: '__POLYHEDRON_SECRET_SAVED__' })
  assert.equal(secret.decryptSecret(db.prepare('SELECT value FROM config WHERE key=?').get('gemini_key').value), fixtureKey)
  handlers.get('config:set')({}, { key: 'gemini_key', value: 'replacement-test-key' })
  assert.equal(secret.decryptSecret(db.prepare('SELECT value FROM config WHERE key=?').get('gemini_key').value), 'replacement-test-key')
  console.log('PASS: configuration IPC returns presence only; replacement keys are encrypted')
  const localValue = db.prepare('SELECT value FROM config WHERE key=?').get('gemini_key').value
  db.close()
  const workspace = await loadTs('src/main/services/workspace-security.service.ts')
  workspace.sanitizeWorkspaceDatabase(dbPath)
  db = new Database(dbPath)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM config WHERE key=?').get('gemini_key').n, 0)
  assert.equal(db.prepare('SELECT value FROM config WHERE key=?').get('theme_accent').value, '#A7F175')
  assert.equal(db.prepare('SELECT text FROM translations').get().text, 'Preserve my translation')
  db.close()
  const bytes = fs.readFileSync(dbPath)
  assert.ok(!bytes.includes(Buffer.from(fixtureKey)) && !bytes.includes(Buffer.from(localValue)))
  workspace.restoreLocalSecrets(dbPath, [{ key: 'gemini_key', value: localValue }])
  db = new Database(dbPath)
  assert.equal(secret.decryptSecret(db.prepare('SELECT value FROM config WHERE key=?').get('gemini_key').value), 'replacement-test-key')
  db.close()
  console.log('PASS: export strips secrets and recoverable pages; import retains local keys and translations')

  const listeners = new Map(), events = new Map()
  const fakeIpc = { handle: (key, fn) => listeners.set(key, fn), on: (key, fn) => { events.set(key, fn); return fakeIpc } }
  const ipc = await loadTs('src/main/utils/ipc-security.ts', { electron: { ipcMain: fakeIpc } })
  const frame = {}, contents = { mainFrame: frame }
  ipc.installIpcSecurity(() => ({ webContents: contents }))
  fakeIpc.handle('secrets', () => 'allowed')
  assert.equal(listeners.get('secrets')({ sender: contents, senderFrame: frame }), 'allowed')
  assert.throws(() => listeners.get('secrets')({ sender: {}, senderFrame: frame }), /Untrusted/)
  assert.throws(() => listeners.get('secrets')({ sender: contents, senderFrame: {} }), /Untrusted/)
  assert.equal(ipc.isAllowedExternalUrl('file:///C:/private'), false)
  assert.equal(ipc.isAllowedExternalUrl('javascript:alert(1)'), false)
  assert.equal(ipc.isAllowedReferenceUrl('https://bg3.wiki.evil.test'), false)
  assert.equal(ipc.isAllowedReferenceUrl('https://bg3.wiki/wiki/Gale'), true)
  console.log('PASS: untrusted windows/subframes and dangerous external URLs rejected')

  let authorization, callbackResult, verifiedExchange = false
  class FakeOAuth {
    constructor() { this.credentials = {} }
    async generateCodeVerifierAsync() {
      const codeVerifier = crypto.randomBytes(32).toString('base64url')
      this.verifier = codeVerifier
      return { codeVerifier, codeChallenge: crypto.createHash('sha256').update(codeVerifier).digest('base64url') }
    }
    generateAuthUrl(options) {
      authorization = options
      return 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams(options)
    }
    async getToken(options) {
      assert.equal(options.codeVerifier, this.verifier)
      assert.equal(crypto.createHash('sha256').update(this.verifier).digest('base64url'), authorization.code_challenge)
      verifiedExchange = true
      return { tokens: { refresh_token: 'FAKE_TEST_REFRESH_TOKEN' } }
    }
    setCredentials(value) { this.credentials = value }
  }
  const oauth = await loadTs('src/main/services/google-oauth.service.ts', {
    googleapis: { google: { auth: { OAuth2: FakeOAuth } } },
    electron: { shell: { openExternal: async () => {
      assert.equal(new URL(authorization.redirect_uri).hostname, '127.0.0.1')
      assert.equal(authorization.code_challenge_method, 'S256')
      const wrong = await fetch(authorization.redirect_uri + '?code=bad&state=wrong')
      assert.equal(wrong.status, 400)
      const unicodeState = await fetch(authorization.redirect_uri + '?code=bad&state=' + encodeURIComponent('é'.repeat(64)))
      assert.equal(unicodeState.status, 400)
      assert.equal(verifiedExchange, false)
      callbackResult = await fetch(authorization.redirect_uri + '?code=test-code&state=' + authorization.state)
    } } }
  })
  const authenticated = await oauth.authenticateDesktopGoogle('public-client', 'public-client-secret', 'https://www.googleapis.com/auth/drive.file')
  assert.equal(authenticated.credentials.refresh_token, 'FAKE_TEST_REFRESH_TOKEN')
  assert.equal(verifiedExchange, true)
  // The callback handler finishes before fetch's response promise necessarily resolves.
  await new Promise(resolve => setTimeout(resolve, 50))
  assert.equal(callbackResult.status, 200)
  console.log('PASS: fresh-profile OAuth callback validates state and PKCE; no Google account or network authorization used')

  const cloudProfile = path.join(temp, 'cloud-profile')
  const bundleRoot = path.join(temp, 'bundle')
  const bundledCredentials = path.join(bundleRoot, 'tools/google-drive/google-drive-credentials.json')
  fs.mkdirSync(cloudProfile, { recursive: true })
  fs.mkdirSync(path.dirname(bundledCredentials), { recursive: true })
  fs.writeFileSync(bundledCredentials, JSON.stringify({ installed: { client_id: 'fixture.apps.googleusercontent.com', client_secret: 'public-desktop-client' } }))
  const legacyToken = path.join(cloudProfile, 'google-drive-token.json')
  fs.writeFileSync(legacyToken, JSON.stringify({ client_id: 'fixture.apps.googleusercontent.com', refresh_token: 'FAKE_LEGACY_REFRESH' }))
  let consentCount = 0
  class CachedAuth {
    constructor() { this.credentials = {} }
    setCredentials(value) { this.credentials = value }
    async getAccessToken() { assert.ok(this.credentials.refresh_token); return { token: 'FAKE_ACCESS' } }
  }
  const cloud = await loadTs('src/main/services/cloud-drive.service.ts', {
    electron: { app: { getPath: () => cloudProfile, getAppPath: () => bundleRoot } },
    '../utils/app-paths': { projectPath: (...parts) => path.join(cloudProfile, ...parts), WORKSPACE_FILE_NAME: 'polyhedron-workspace.pws' },
    './secret-storage.service': secret,
    './google-oauth.service': { authenticateDesktopGoogle: async (id, _publicSecret, scope) => {
      assert.equal(id, 'fixture.apps.googleusercontent.com')
      assert.equal(scope, 'https://www.googleapis.com/auth/drive.file')
      consentCount++
      const auth = new CachedAuth()
      auth.setCredentials({ refresh_token: 'FAKE_NEW_USER_REFRESH' })
      return auth
    } },
    googleapis: { google: { auth: { OAuth2: CachedAuth }, drive: () => ({ about: { get: async () => ({ data: { user: { displayName: 'Test user' } } }) } }) } }
  })
  assert.equal((await cloud.getCloudAccount()).connected, true)
  assert.equal(consentCount, 0)
  assert.equal(fs.existsSync(legacyToken), false)
  const secureTokenPath = path.join(cloudProfile, 'google-drive-token.secure.json')
  const encryptedToken = JSON.parse(fs.readFileSync(secureTokenPath, 'utf8'))
  assert.ok(!fs.readFileSync(secureTokenPath, 'utf8').includes('FAKE_LEGACY_REFRESH'))
  assert.equal(secret.decryptSecret(encryptedToken.encryptedRefreshToken), 'FAKE_LEGACY_REFRESH')
  cloud.disconnectCloudAccount()
  assert.equal((await cloud.getCloudAccount()).connected, false)
  assert.equal(consentCount, 0)
  assert.equal((await cloud.connectCloudAccount()).connected, true)
  assert.equal(consentCount, 1)
  assert.equal(secret.decryptSecret(JSON.parse(fs.readFileSync(secureTokenPath, 'utf8')).encryptedRefreshToken), 'FAKE_NEW_USER_REFRESH')
  console.log('PASS: legacy Google tokens migrate encrypted; new users use bundled client metadata and their own authorization; startup never opens sign-in')

  const migrationParent = path.join(temp, 'migration')
  const migratedProfile = path.join(migrationParent, 'polyhedron')
  const oldProfile = path.join(migrationParent, 'icosa')
  fs.mkdirSync(oldProfile, { recursive: true })
  fs.writeFileSync(path.join(oldProfile, 'google-drive-token.json'), JSON.stringify({ refresh_token: 'FAKE_OLD_PROFILE_TOKEN' }))
  const migration = await loadTs('src/main/services/user-data-migration.service.ts', {
    electron: { app: { getPath: () => migratedProfile } },
    '../utils/app-paths': { databasePath: folder => path.join(folder, 'polyhedron.db'), projectDataPath: folder => path.join(folder, 'projects') }
  })
  migration.migrateLegacyUserData()
  assert.equal(fs.existsSync(path.join(migratedProfile, 'google-drive-token.json')), true)
  fs.unlinkSync(path.join(migratedProfile, 'google-drive-token.json'))
  migration.migrateLegacyUserData()
  assert.equal(fs.existsSync(path.join(migratedProfile, 'google-drive-token.json')), false)
  console.log('PASS: disconnect cannot resurrect legacy Google authorization on restart')

  const logs = await loadTs('src/main/services/log.service.ts', {
    electron: { app: { getPath: () => temp } }
  })
  const logSecrets = ['sk-fixtureSecret123', 'AIza' + 'A'.repeat(30), 'ya29.fixtureAccess', '1//fixtureRefresh', 'fixtureQuerySecret']
  logs.writeLog({ scope: 'test', message: `${logSecrets.slice(0, 4).join(' ')} https://example.test/?key=${logSecrets[4]}`, stack: 'Bearer fixtureBearer', meta: { apiKey: 'fixtureMeta' } })
  const logText = fs.readFileSync(logs.getLogPath(), 'utf8')
  for (const value of [...logSecrets, 'fixtureBearer', 'fixtureMeta']) assert.ok(!logText.includes(value))
  console.log('PASS: log messages, stacks and metadata redact credential formats')

  const { publicDesktopCredentials } = require('./prepare-google-oauth.cjs')
  const clean = publicDesktopCredentials({ installed: { client_id: 'test.apps.googleusercontent.com', client_secret: 'public-desktop-client', refresh_token: 'DO_NOT_SHIP', access_token: 'DO_NOT_SHIP' }, refresh_token: 'DO_NOT_SHIP' })
  assert.ok(!JSON.stringify(clean).includes('DO_NOT_SHIP'))
  assert.throws(() => publicDesktopCredentials({ web: { client_id: 'test', client_secret: 'secret' } }))
  console.log('PASS: installer OAuth metadata is allowlisted; user tokens and web-client configs cannot be bundled')

  // Exercise the real built preload in a sandbox, not only a mocked IPC event.
  const preload = path.join(root, 'out/preload/index.js')
  if (fs.existsSync(preload)) {
    const rendererDb = new Database(dbPath)
    const rendererOrm = require('drizzle-orm/better-sqlite3').drizzle(rendererDb)
    let mainWindow
    const realGuard = await loadTs('src/main/utils/ipc-security.ts')
    realGuard.installIpcSecurity(() => mainWindow)
    const realConfig = await loadTs('src/main/ipc/config.ipc.ts', { '../database/connection': { getDb: () => rendererOrm }, '../services/secret-storage.service': secret })
    realConfig.registerConfigHandlers()
    mainWindow = new BrowserWindow({ show: false, webPreferences: { preload, sandbox: true, contextIsolation: true, nodeIntegration: false } })
    mainWindow.webContents.on('preload-error', (_event, _path, error) => console.error('Preload error:', error))
    await mainWindow.loadURL('about:blank')
    assert.equal(await mainWindow.webContents.executeJavaScript('typeof window.api'), 'object')
    const exposed = await mainWindow.webContents.executeJavaScript('window.api.config.getAll()')
    assert.equal(exposed.gemini_key, '__POLYHEDRON_SECRET_SAVED__')
    assert.equal(await mainWindow.webContents.executeJavaScript('typeof require'), 'undefined')
    const otherWindow = new BrowserWindow({ show: false, webPreferences: { preload, sandbox: true, contextIsolation: true } })
    await otherWindow.loadURL('about:blank')
    const rejected = await otherWindow.webContents.executeJavaScript('window.api.config.getAll().then(()=>false).catch(e=>e.message.includes("Untrusted IPC sender"))')
    assert.equal(rejected, true)
    otherWindow.destroy()
    mainWindow.destroy()
    rendererDb.close()
    console.log('PASS: built preload works with renderer sandbox; real IPC rejects a second window')
  }
  app.quit()
}
run().catch(error => { console.error(error); app.exit(1) })
