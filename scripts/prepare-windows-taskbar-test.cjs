const { createRequire } = require('node:module')
const fs = require('node:fs/promises')
const path = require('node:path')

async function run() {
  const root = path.resolve(__dirname, '..')
  const { build } = createRequire(require.resolve('vite/package.json'))('esbuild')
  await build({
    absWorkingDir: root, bundle: true, platform: 'node', format: 'cjs',
    external: ['electron'], entryPoints: ['src/main/services/app-icon.service.ts'],
    outfile: 'dist/icon-loader-test/app-icon-service.cjs',
    plugins: [{ name: 'isolated-taskbar-test', setup(builder) {
      builder.onLoad({ filter: /app-icon\.service\.ts$/ }, async ({ path: filename }) => ({
        // Use a separate shell identity so the test cannot merge with Polyhedron.
        contents: (await fs.readFile(filename, 'utf8')).replaceAll('com.polyhedron.bg3-mod-translator', 'com.polyhedron.taskbar-test'),
        loader: 'ts'
      }))
      builder.onLoad({ filter: /\.svg$/ }, async ({ path: filename }) => ({
        contents: await fs.readFile(filename.replace(/\?raw$/, ''), 'utf8'), loader: 'text'
      }))
    } }]
  })
  console.log('Prepared current icon service for the isolated Windows taskbar test.')
}
run().catch(error => { console.error(error); process.exitCode = 1 })
