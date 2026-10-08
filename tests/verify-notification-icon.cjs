const assert = require('node:assert/strict')
const vm = require('node:vm')
const { createRequire } = require('node:module')
const path = require('node:path')

async function run() {
  const { build } = createRequire(require.resolve('vite/package.json'))('esbuild')
  const bundle = await build({
    entryPoints: [path.resolve(__dirname, '../src/main/ipc/window.ipc.ts')],
    bundle: true, write: false, platform: 'node', format: 'cjs',
    external: ['electron', '../services/app-icon.service']
  })
  for (const platform of ['darwin', 'win32']) {
    const handlers = new Map()
    const notifications = []
    let icon = { selected: 'red-dragon' }
    let focused = false
    const window = { isFocused: () => focused, flashFrame() {} }
    const module = { exports: {} }
    vm.runInNewContext(bundle.outputFiles[0].text, {
      module, exports: module.exports, process: { platform }, setTimeout: () => {},
      require: name => name === 'electron' ? {
        app: { dock: { bounce() {} } },
        ipcMain: { handle: (name, callback) => handlers.set(name, callback) },
        Notification: class {
          static isSupported() { return true }
          constructor(options) { this.options = options }
          show() { notifications.push(this.options) }
        }
      } : { currentNotificationIcon: win => { assert.equal(win, window); return icon } }
    })
    module.exports.registerWindowHandlers(() => window)
    const notify = handlers.get('window:notifySyncComplete')
    notify(null, { direction: 'upload', translated: 100, total: 200 })
    if (platform === 'darwin') assert.ok(!('icon' in notifications[0]), 'macOS must not attach a duplicate image')
    else assert.equal(notifications[0].icon, icon)
    assert.equal(notifications[0].title, 'Polyhedron · Upload complete')
    assert.equal(notifications[0].sound, platform === 'darwin' ? 'Glass' : undefined)
    icon = { selected: 'purple-background' }
    notify(null, { direction: 'download', translated: 101, total: 200 })
    if (platform === 'darwin') assert.ok(!('icon' in notifications[1]), 'Dock artwork must not become a notification attachment')
    else assert.equal(notifications[1].icon, icon, 'Use fresh artwork, not a cached first choice')
    assert.equal(notifications[1].title, 'Polyhedron · Download complete')
    focused = true
    notify(null, { direction: 'upload', translated: 100, total: 200 })
    assert.equal(notifications.length, 2, 'No native notification while focused')
    console.log(`PASS: ${platform} notification artwork policy, upload/download, focus behavior, sound`)
  }
}
run().catch(error => { console.error(error); process.exitCode = 1 })
