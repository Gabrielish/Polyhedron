const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const root = path.resolve(__dirname, '..')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const exists = file => assert.ok(fs.existsSync(path.join(root, file)), `Missing path: ${file}`)
for (const directory of ['src', 'pwa', 'config', 'resources', 'scripts', 'tests', 'docs']) exists(directory)
for (const old of ['build', 'drizzle', 'mods', 'patches', 'reference', 'tools', 'work']) {
  assert.ok(!fs.existsSync(path.join(root, old)), `Old root directory still present: ${old}`)
}
assert.equal(pkg.build.extends, './config/electron-builder.yml')
exists(pkg.build.extends)
for (const command of Object.values(pkg.scripts)) {
  for (const match of command.matchAll(/(?:node|electron)\s+((?:scripts|tests)\/[^\s]+)/g)) exists(match[1])
  for (const match of command.matchAll(/(?:--config|-p)\s+([^\s]+)/g)) exists(match[1])
}
const workflow = fs.readFileSync(path.join(root, '.github/workflows/deploy-v1.yml'), 'utf8')
assert.ok(workflow.includes('tests/verify-pwa-*.cjs'))
assert.ok(workflow.includes('resources/reference/**'))
for (const match of workflow.matchAll(/node\s+(tests\/[^\s]+)/g)) exists(match[1])
for (const name of ['node', 'web']) {
  const config = JSON.parse(fs.readFileSync(path.join(root, `config/tsconfig.${name}.json`), 'utf8'))
  assert.equal(config.extends, `@electron-toolkit/tsconfig/tsconfig.${name}.json`)
}
for (const file of ['resources/installer/icon.png', 'resources/installer/icon.icns', 'resources/installer/icon.ico',
  'resources/installer/installer.nsh', 'resources/migrations/meta/_journal.json',
  'resources/reference/dialogs', 'resources/localization-template/Localization/English/Gender',
  'resources/patches/dmg-builder@26.8.1.patch']) exists(file)
assert.ok(fs.readFileSync(path.join(root, '.gitignore'), 'utf8').includes('/resources/reference/imported-translations/'))
assert.ok(!fs.readFileSync(path.join(root, 'src/main/services/workspace.service.ts'), 'utf8').includes('suggestionSourcesDirectory'))
console.log('PASS: consolidated root, unchanged pnpm commands, config inheritance, workflow paths, runtime assets and local-only suggestions')
