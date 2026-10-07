// Run on macOS: pnpm exec electron scripts/build-installer-icons.cjs
// Installer branding is deliberately fixed, never read from a user's profile.
const { app, BrowserWindow, nativeImage, nativeTheme } = require('electron')
const { createRequire } = require('node:module')
const Module = require('node:module')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const assert = require('node:assert/strict')

async function run() {
  if (process.platform !== 'darwin') throw new Error('Generate the shared installer icons on macOS (iconutil is required).')
  const root = path.resolve(__dirname, '..')
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'polyhedron-installer-icons-'))
  app.setPath('userData', path.join(temporary, 'profile'))
  const { build } = createRequire(require.resolve('vite/package.json'))('esbuild')
  const bundle = await build({
    absWorkingDir: root, bundle: true, write: false, platform: 'node', format: 'cjs',
    external: ['electron'], entryPoints: ['src/main/services/app-icon.service.ts'],
    plugins: [{ name: 'svg-source', setup(builder) {
      builder.onLoad({ filter: /\.svg$/ }, async ({ path: filename }) => ({
        contents: await fs.readFile(filename, 'utf8'), loader: 'text'
      }))
    } }]
  })
  const service = new Module(path.join(root, 'scripts', 'installer-icon-renderer.cjs'), module)
  service.filename = path.join(root, 'scripts', 'installer-icon-renderer.cjs')
  service.paths = module.paths
  service._compile(bundle.outputFiles[0].text, service.filename)
  await app.whenReady()
  nativeTheme.themeSource = 'dark'
  const window = new BrowserWindow({ show: false })
  await window.loadURL('data:text/html,<meta http-equiv="Content-Security-Policy" content="default-src %27self%27; img-src data:">')
  const macSvg = service.exports.createAppIconSvg('#A7F175', 'accent-dragon', 'black', 'darwin')
  const winSvg = service.exports.createAppIconSvg('#A7F175', 'accent-dragon', 'black', 'win32')
  const render = async svg => window.webContents.executeJavaScript(`(async () => {
    const image = new Image();
    image.src = 'data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}';
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1024;
    canvas.getContext('2d').drawImage(image, 0, 0);
    return canvas.toDataURL('image/png');
  })()`)
  const image = nativeImage.createFromDataURL(await render(macSvg))
  const windowsImage = nativeImage.createFromDataURL(await render(winSvg))
  assert.deepEqual(image.getSize(), { width: 1024, height: 1024 })
  assert.deepEqual(windowsImage.getSize(), { width: 1024, height: 1024 })
  const bitmap = image.toBitmap()
  let greenPixels = 0
  for (let i = 0; i < bitmap.length; i += 4) {
    if (bitmap[i] === 117 && bitmap[i + 1] === 241 && bitmap[i + 2] === 167 && bitmap[i + 3] === 255) greenPixels++
  }
  assert.ok(greenPixels > 60000, 'Dragon must be solid #A7F175')
  const centerTop = (160 * 1024 + 512) * 4
  assert.ok(bitmap[centerTop] < 60 && bitmap[centerTop + 1] < 60 && bitmap[centerTop + 2] < 60, 'Background must stay dark')

  const iconset = path.join(temporary, 'Polyhedron.iconset')
  await fs.mkdir(iconset)
  for (const size of [16, 32, 128, 256, 512]) {
    for (const scale of [1, 2]) {
      const pixels = size * scale
      await fs.writeFile(path.join(iconset, `icon_${size}x${size}${scale === 2 ? '@2x' : ''}.png`),
        image.resize({ width: pixels, height: pixels, quality: 'best' }).toPNG())
    }
  }
  const icns = path.join(temporary, 'icon.icns')
  execFileSync('/usr/bin/iconutil', ['-c', 'icns', '-o', icns, iconset])
  const icnsBytes = await fs.readFile(icns)
  assert.equal(icnsBytes.toString('ascii', 0, 4), 'icns')

  // PNG-compressed ICO entries are supported by modern Windows; include small
  // sizes so shortcuts, title bars and installers don't downsample a single image.
  const sizes = [16, 24, 32, 48, 64, 128, 256]
  const frames = sizes.map(size => windowsImage.resize({ width: size, height: size, quality: 'best' }).toPNG())
  const header = Buffer.alloc(6 + sizes.length * 16)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(sizes.length, 4)
  let offset = header.length
  sizes.forEach((size, index) => {
    const entry = 6 + index * 16
    header[entry] = header[entry + 1] = size === 256 ? 0 : size
    header.writeUInt16LE(1, entry + 4)
    header.writeUInt16LE(32, entry + 6)
    header.writeUInt32LE(frames[index].length, entry + 8)
    header.writeUInt32LE(offset, entry + 12)
    offset += frames[index].length
  })
  const ico = Buffer.concat([header, ...frames])
  assert.equal(ico.readUInt16LE(4), 7)
  for (let i = 0; i < sizes.length; i++) {
    const start = ico.readUInt32LE(6 + i * 16 + 12)
    assert.deepEqual(nativeImage.createFromBuffer(ico.subarray(start, start + frames[i].length)).getSize(), { width: sizes[i], height: sizes[i] })
  }
  await fs.writeFile(path.join(root, 'resources/installer', 'icon.png'), image.toPNG())
  await fs.writeFile(path.join(root, 'resources/installer', 'icon.icns'), icnsBytes)
  await fs.writeFile(path.join(root, 'resources/installer', 'icon.ico'), ico)
  console.log('Generated and verified resources/installer/icon.png, resources/installer/icon.icns, resources/installer/icon.ico: #A7F175 dragon, dark macOS-style background.')
  window.destroy()
  app.quit()
}

run().catch(error => { console.error(error); app.exit(1) })
