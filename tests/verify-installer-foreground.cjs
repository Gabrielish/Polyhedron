const assert = require('node:assert/strict')
const { createRequire } = require('node:module')
const vm = require('node:vm')
const fs = require('node:fs/promises')

async function run() {
  const { build } = createRequire(require.resolve('vite/package.json'))('esbuild')
  const result = await build({ entryPoints: ['src/main/installer.ts'], bundle: true, write: false, platform: 'node', format: 'cjs', external: ['electron'] })
  const events = [], timers = [], exported = { exports: {} }
  let profile
  class Window {
    constructor() { this.webContents = { setWindowOpenHandler() {}, on() {} } }
    on() {}
    async loadFile() { events.push('loaded') }
    setAlwaysOnTop(value) { events.push(['top', value]) }
    show() { events.push('show') }
    focus() { events.push('focus') }
    isDestroyed() { return false }
  }
  vm.runInNewContext(result.outputFiles[0].text, {
    module: exported, exports: exported.exports, __dirname: '/isolated/out/main',
    process: { platform: 'win32', argv: ['electron', '--installer-preview'], env: {} },
    setTimeout: (callback, delay) => timers.push({ callback, delay }),
    require: name => name === 'electron' ? {
      app: { setPath: (_key, value) => { profile = value }, whenReady: async () => {} },
      BrowserWindow: Window, dialog: {}, ipcMain: { handle() {} }
    } : require(name)
  })
  try {
    await exported.exports.startInstaller()
    assert.deepEqual(events, ['loaded', ['top', true], 'show', 'focus'])
    assert.equal(timers[0].delay, 300)
    timers[0].callback()
    assert.deepEqual(events.at(-1), ['top', false])
    console.log('PASS: Setup foreground handoff occurs only after loading; always-on-top is temporary')
  } finally {
    if (profile) await fs.rm(profile, { recursive: true, force: true })
  }
}
run().catch(error => { console.error(error); process.exitCode = 1 })
