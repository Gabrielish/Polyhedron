const assert = require('node:assert/strict')
const { createRequire } = require('node:module')
const vm = require('node:vm')
const path = require('node:path')

async function run() {
  const root = path.resolve(__dirname, '..')
  const { build } = createRequire(require.resolve('vite/package.json'))('esbuild')
  const result = await build({ absWorkingDir: root, entryPoints: ['src/main/ipc/window.ipc.ts'], bundle: true, write: false, platform: 'node', format: 'cjs', external: ['electron'] })
  const handlers = new Map(), events = [], timers = []
  const mockApp = { relaunch: options => events.push(['relaunch', options]), exit: code => events.push(['exit', code]) }
  const exported = { exports: {} }
  vm.runInNewContext(result.outputFiles[0].text, {
    module: exported, exports: exported.exports,
    require: name => { assert.equal(name, 'electron'); return { app: mockApp, ipcMain: { handle: (name, callback) => handlers.set(name, callback) } } },
    process: { platform: 'win32', execPath: 'C:\\Polyhedron\\Polyhedron.exe', argv: ['Polyhedron.exe', '--test'] },
    setTimeout: callback => timers.push(callback)
  })
  let finishIcon, failIcon = false
  exported.exports.registerWindowHandlers(() => null, async () => {
    events.push(['persist'])
    if (failIcon) throw new Error('Icon generation failed')
    await new Promise(resolve => { finishIcon = resolve })
  })
  const pending = handlers.get('window:relaunch')()
  assert.deepEqual(events, [['persist']], 'Restart waits for icon persistence')
  finishIcon()
  await pending
  assert.equal(events[1][0], 'relaunch')
  assert.equal(events[1][1].execPath, 'C:\\Polyhedron\\Polyhedron.exe')
  assert.equal(events[1][1].args.join(), '--test')
  assert.equal(events.length, 2, 'IPC returns before old process exits')
  timers[0]()
  assert.deepEqual(events[2], ['exit', 0])
  failIcon = true
  await assert.rejects(handlers.get('window:relaunch')(), /Icon generation failed/)
  assert.equal(events.filter(event => event[0] === 'relaunch').length, 1, 'Failed persistence does not restart with stale artwork')
  console.log('PASS: Windows restart persists icon first, relaunches with original arguments, and reports errors')
}
run().catch(error => { console.error(error); process.exitCode = 1 })
