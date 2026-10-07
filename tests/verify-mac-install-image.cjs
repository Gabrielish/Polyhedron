const assert = require('node:assert/strict')
const { createRequire } = require('node:module')
const vm = require('node:vm')

async function run() {
  const { build } = createRequire(require.resolve('vite/package.json'))('esbuild')
  const result = await build({ entryPoints: ['src/main/services/mac-install-image.service.ts'], bundle: true, write: false, platform: 'node', format: 'cjs', external: ['electron'], plugins: [{ name: 'isolated-log', setup(builder) { builder.onLoad({ filter: /log\.service\.ts$/ }, () => ({ contents: 'export function logError() {}', loader: 'ts' })) } }] })
  const identity = { CFBundleIdentifier: 'com.polyhedron.bg3-mod-translator', CFBundleShortVersionString: '1.0.0', CFBundleVersion: '1.0.0' }
  async function test(name, options = {}) {
    const calls = [], exported = { exports: {} }
    const mount = '/Volumes/Polyhedron 1.0.0'
    const images = { images: [{ 'system-entities': [{ 'mount-point': mount }, { 'mount-point': mount }, { 'mount-point': '/Volumes/OtherApp' }, { 'mount-point': '/Volumes/Polyhedron old' }] }] }
    vm.runInNewContext(result.outputFiles[0].text, {
      module: exported, exports: exported.exports, process: { platform: options.platform || 'darwin', execPath: options.fromImage ? mount + '/Polyhedron.app/Contents/MacOS/Polyhedron' : '/Applications/Polyhedron.app/Contents/MacOS/Polyhedron' },
      require: key => {
        if (key === 'electron') return { app: { isPackaged: options.packaged !== false, isInApplicationsFolder: () => !options.fromImage } }
        if (key === 'node:fs/promises') return { realpath: async file => {
          if (file.endsWith('/Applications')) return options.wrongShortcut ? '/Users/Someone/Applications' : '/Applications'
          if (options.escapedBundle && file.startsWith(mount)) return '/Applications/Polyhedron.app'
          return file
        } }
        if (key === 'node:child_process') return { execFile: (file, args, _settings, callback) => {
          calls.push([file, Array.from(args)])
          let output = '', error = null
          if (file.endsWith('/plutil')) {
            output = JSON.stringify(args.at(-1) === '-' ? images : args.at(-1).startsWith('/Volumes/Polyhedron old') ? { ...identity, CFBundleVersion: 'old' } : args.at(-1).startsWith('/Volumes') && options.wrongIdentity ? { ...identity, CFBundleIdentifier: 'another.app' } : args.at(-1).startsWith('/Volumes') && options.wrongVersion ? { ...identity, CFBundleVersion: 'other' } : identity)
          } else if (args[0] === 'info') output = '<plist/>'
          else if (args[0] === 'detach' && options.busy) error = new Error('Resource busy')
          queueMicrotask(() => callback(error, output))
          return { stdin: { on() {}, end() {} } }
        } }
        return require(key)
      }
    })
    await exported.exports.ejectMacInstallationImages()
    const detach = calls.filter(([file, args]) => file.endsWith('/hdiutil') && args[0] === 'detach')
    const expected = options.expected ?? 1
    assert.equal(detach.length, expected, name)
    if (expected) assert.deepEqual(detach[0][1], ['detach', mount], 'Exact volume, no force flag; duplicate mounts processed once')
    if (options.platform === 'win32' || options.packaged === false || options.fromImage) assert.equal(calls.length, 0, 'Unsupported startup does not inspect or eject volumes')
    console.log('PASS: ' + name)
  }
  await test('only matching installed Polyhedron image is ejected')
  await test('Windows is untouched', { platform: 'win32', expected: 0 })
  await test('development is untouched', { packaged: false, expected: 0 })
  await test('running from DMG never ejects its own volume', { fromImage: true, expected: 0 })
  await test('different app identity is ignored', { wrongIdentity: true, expected: 0 })
  await test('different build is ignored', { wrongVersion: true, expected: 0 })
  await test('unexpected Applications link is ignored', { wrongShortcut: true, expected: 0 })
  await test('bundle outside the image is ignored', { escapedBundle: true, expected: 0 })
  await test('busy image does not force eject or reject startup', { busy: true })
}
run().catch(error => { console.error(error); process.exitCode = 1 })
