const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { createRequire } = require('node:module')
const ts = require('typescript')
const { createInstallerProgressScript, attachInstallerProgress } = require('../scripts/installer-progress-script.cjs')
const root = path.resolve(__dirname, '..')
const source = fs.readFileSync(path.join(root, 'src/preload/installer-progress.ts'), 'utf8')
const exportsObject = {}
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: exportsObject })
const progress = exportsObject.installerProgress
for (const invalid of [undefined, null, '', ' ', '-1', 'oops', Infinity, NaN, -1]) {
  assert.equal(progress('installing', invalid), undefined)
}
assert.equal(progress('installing', '45'), 45)
assert.equal(progress('installing', '95'), 95)
assert.equal(progress('installing', '100'), 99)
assert.equal(progress('installing', 1000), 99)
assert.equal(progress('error', '95'), 95)
assert.equal(progress('done', undefined), 100)
const builderRequire = createRequire(require.resolve('electron-builder/package.json'))
const templates = path.join(path.dirname(builderRequire.resolve('app-builder-lib/package.json')), 'templates/nsis')
const read = file => fs.readFileSync(path.join(templates, file), 'utf8')
const installer = read('installer.nsi'), section = read('installSection.nsh'), extraction = read('include/extractAppPackage.nsh')
const script = createInstallerProgressScript(installer, section, extraction)
assert.equal((script.match(/Nsis7z::ExtractWithCallback/g) || []).length, 2)
assert.ok(script.indexOf('!include installer.nsh') < script.indexOf('!macroundef extractUsing7za'))
assert.ok(script.indexOf('!macroundef extractUsing7za') < script.indexOf('!insertmacro installApplicationFiles'))
for (const preserved of ['CopyFiles /SILENT', 'RetryExtract7za:', 'AbortExtract7za:', 'registryAddInstallInfo', 'BUILD_UNINSTALLER']) {
  assert.ok(script.includes(preserved), preserved)
}
assert.ok(script.includes('"phase" "copying"'))
assert.ok(script.includes('"phase" "finalizing"'))
assert.ok(!script.includes('"progress" "100"'))
assert.throws(() => createInstallerProgressScript('', section, extraction), /template changed/)
assert.throws(() => createInstallerProgressScript(installer, section, extraction.replaceAll('Nsis7z::Extract', 'Changed::Extract')), /template changed/)
const renderer = fs.readFileSync(path.join(root, 'src/renderer/src/installer.tsx'), 'utf8')
assert.ok(!renderer.includes('27000') && !renderer.includes('performance.now'))
const native = fs.readFileSync(path.join(root, 'resources/installer/installer.nsh'), 'utf8')
assert.equal((native.match(/"progress" "100"/g) || []).length, 1)
assert.ok(native.indexOf('Function .onInstSuccess') < native.indexOf('"progress" "100"'))
async function verifyHook() {
  const token = {}, calls = []
  const target = { async computeScriptAndSignUninstaller(arg) { calls.push([this, arg]); return installer } }
  attachInstallerProgress(target, section, extraction)
  attachInstallerProgress(target, section, extraction)
  assert.equal(await target.computeScriptAndSignUninstaller(token), script)
  assert.deepEqual(calls, [[target, token]])
  assert.throws(() => attachInstallerProgress({}, section, extraction), /target changed/)
  console.log('PASS: native progress normalization, real extraction callbacks, retry/silent paths, uninstaller delegation and success-only completion')
}
verifyHook().catch(error => { console.error(error); process.exitCode = 1 })
