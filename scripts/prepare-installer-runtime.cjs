// electron-builder afterPack: extract only Electron and Setup at startup,
// not the application's databases, native modules, tools and reference data.
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const { promisify } = require('node:util')
const execFile = promisify(require('node:child_process').execFile)
const { path7za } = require('7zip-bin')
const { createRequire } = require('node:module')
const { attachInstallerProgress } = require('./installer-progress-script.cjs')

module.exports = async context => {
  if (context.electronPlatformName !== 'win32') return
  const root = context.packager.projectDir
  const builderRequire = createRequire(require.resolve('electron-builder/package.json'))
  const templates = path.join(path.dirname(builderRequire.resolve('app-builder-lib/package.json')), 'templates/nsis')
  const [section, extraction] = await Promise.all([
    'installSection.nsh', 'include/extractAppPackage.nsh'
  ].map(file => fs.readFile(path.join(templates, file), 'utf8')))
  for (const target of context.targets) {
    if (target.name === 'nsis' || target.name === 'nsis-web') attachInstallerProgress(target, section, extraction)
  }
  const stage = await fs.mkdtemp(path.join(os.tmpdir(), 'polyhedron-setup-runtime-'))
  const archive = path.join(root, 'resources/installer/setup-ui.7z')
  try {
    for (const entry of await fs.readdir(context.appOutDir, { withFileTypes: true })) {
      if (entry.name === 'resources') continue
      await fs.cp(path.join(context.appOutDir, entry.name), path.join(stage, entry.name), { recursive: true })
    }
    const ui = path.join(stage, 'resources/app')
    await fs.mkdir(path.join(ui, 'out/main'), { recursive: true })
    await fs.mkdir(path.join(ui, 'out/preload'), { recursive: true })
    await fs.mkdir(path.join(ui, 'out/renderer'), { recursive: true })
    await fs.copyFile(path.join(root, 'out/main/installer.js'), path.join(ui, 'out/main/installer.js'))
    await fs.copyFile(path.join(root, 'out/preload/installer.js'), path.join(ui, 'out/preload/installer.js'))
    await fs.copyFile(path.join(root, 'out/renderer/installer.html'), path.join(ui, 'out/renderer/installer.html'))
    // Shared renderer chunks/styles are small; retaining all assets avoids
    // brittle filename/import parsing when Vite changes its chunk graph.
    await fs.cp(path.join(root, 'out/renderer/assets'), path.join(ui, 'out/renderer/assets'), { recursive: true })
    const { version } = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'))
    await fs.writeFile(path.join(ui, 'package.json'), JSON.stringify({ name: 'polyhedron-setup', version, main: 'out/main/installer-entry.cjs' }))
    await fs.writeFile(path.join(ui, 'out/main/installer-entry.cjs'), "require('./installer.js').startInstaller().catch(error => { console.error(error); require('electron').app.exit(1) })\n")
    await fs.rm(archive, { force: true })
    // Light compression prioritizes decompression/startup over download size.
    await execFile(path7za, ['a', '-t7z', '-mx=1', archive, '.'], { cwd: stage })
    console.log('Prepared lightweight Windows Setup runtime (no application data or services).')
  } finally {
    await fs.rm(stage, { recursive: true, force: true })
  }
}
