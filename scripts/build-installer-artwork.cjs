// Render repo-native artwork; no user profile or translation content is used.
const { app, BrowserWindow, nativeImage } = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const assert = require('node:assert/strict')

function toBmp(image) {
  const { width, height } = image.getSize()
  const source = image.toBitmap()
  const stride = Math.ceil(width * 3 / 4) * 4
  const bmp = Buffer.alloc(54 + stride * height)
  bmp.write('BM')
  bmp.writeUInt32LE(bmp.length, 2)
  bmp.writeUInt32LE(54, 10)
  bmp.writeUInt32LE(40, 14)
  bmp.writeInt32LE(width, 18)
  bmp.writeInt32LE(height, 22)
  bmp.writeUInt16LE(1, 26)
  bmp.writeUInt16LE(24, 28)
  bmp.writeUInt32LE(stride * height, 34)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const from = (y * width + x) * 4
      const to = 54 + (height - y - 1) * stride + x * 3
      source.copy(bmp, to, from, from + 3)
    }
  }
  return bmp
}

async function run() {
  const root = path.resolve(__dirname, '..')
  app.setPath('userData', await fs.mkdtemp(path.join(os.tmpdir(), 'polyhedron-installer-artwork-')))
  await app.whenReady()
  const window = new BrowserWindow({ show: false })
  await window.loadURL('data:text/html,<meta http-equiv="Content-Security-Policy" content="default-src %27self%27; img-src data:">')
  const render = async (svg, width, height, scale = 1) => {
    const url = await window.webContents.executeJavaScript(`(async () => {
      const image = new Image(); image.src = 'data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}';
      await image.decode(); const canvas = document.createElement('canvas');
      canvas.width = ${width * scale}; canvas.height = ${height * scale};
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/png');
    })()`)
    const image = nativeImage.createFromDataURL(url)
    assert.deepEqual(image.getSize(), { width: width * scale, height: height * scale })
    return image
  }
  const background = await fs.readFile(path.join(root, 'resources/installer/dmg-background.svg'), 'utf8')
  for (const scale of [1, 2]) {
    const image = await render(background, 4096, 2304, scale)
    for (const [x, y] of [[1100, 650], [4095, 2303]]) {
      const pixel = image.crop({ x: x * scale, y: y * scale, width: 1, height: 1 }).toBitmap()
      assert.deepEqual([...pixel], [16, 16, 16, 255], 'Expanded Finder area stays opaque dark, not white')
    }
    await fs.writeFile(path.join(root, `resources/installer/dmg-background${scale === 2 ? '@2x' : ''}.png`), image.toPNG())
  }
  const icon = 'data:image/png;base64,' + (await fs.readFile(path.join(root, 'resources/installer/icon.png'))).toString('base64')
  const dragonSvg = await fs.readFile(path.join(root, 'src/renderer/src/assets/dungeons-dragons.svg'), 'utf8')
  const dragonPath = dragonSvg.match(/<path\b[^>]*\bd="([^"]+)"/)?.[1]
  assert.ok(dragonPath, 'Dragon silhouette must be available')
  const sidebar = `<svg xmlns="http://www.w3.org/2000/svg" width="164" height="314">
    <defs>
      <linearGradient id="b" x2="0" y2="1"><stop stop-color="#1B2118"/><stop offset="1" stop-color="#101010"/></linearGradient>
      <radialGradient id="glow" gradientUnits="userSpaceOnUse" cx="82" cy="157" r="110">
        <stop stop-color="#A7F175" stop-opacity="0.13"/><stop offset="1" stop-color="#A7F175" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="164" height="314" fill="url(#b)"/>
    <rect width="164" height="314" fill="url(#glow)"/>
    <svg x="9" y="95.66" width="146" height="122.68" viewBox="0 0 12.21 10.26" preserveAspectRatio="xMidYMid meet">
      <path d="${dragonPath}" fill="#A7F175"/>
    </svg>
  </svg>`
  const header = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="57">
    <rect width="150" height="57" fill="#101010"/>
    <rect x="0" y="0" width="3" height="57" fill="#A7F175"/>
    <image href="${icon}" x="12" y="3" width="51" height="51"/>
    <text x="68" y="27" font-family="Arial, sans-serif" font-weight="bold" font-size="11" fill="#E5E5E5">Polyhedron</text>
    <text x="68" y="41" font-family="Arial, sans-serif" font-size="8" fill="#737373">WINDOWS</text>
  </svg>`
  assert.ok(!/\bmods?\b|Translate\. Organize\./i.test(sidebar + header), 'Installer artwork contains no mod branding or slogan')
  assert.ok(!/<text\b|<image\b/.test(sidebar), 'Sidebar contains only the unframed dragon, no text or app icon tile')
  const welcome = await fs.readFile(path.join(root, 'resources/installer/installer.nsh'), 'utf8')
  assert.ok(!/\bmods?\b/i.test(welcome), 'Installer welcome describes translation, not mods')
  for (const [name, svg, width, height] of [['installerSidebar', sidebar, 164, 314], ['installerHeader', header, 150, 57]]) {
    const image = await render(svg, width, height)
    const bmp = toBmp(image)
    assert.equal(bmp.readUInt16LE(28), 24)
    assert.equal(bmp.readInt32LE(18), width)
    assert.equal(bmp.readInt32LE(22), height)
    await fs.writeFile(path.join(root, `resources/installer/${name}.bmp`), bmp)
    await fs.writeFile(path.join(root, `resources/installer/${name}.png`), image.toPNG())
  }
  console.log('Verified macOS DMG backgrounds (1x/2x) and Windows NSIS sidebar/header (24-bit BMP).')
  window.destroy()
  app.quit()
}
run().catch(error => { console.error(error); app.exit(1) })
