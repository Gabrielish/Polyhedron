// Dedicated full-bleed home-screen artwork. iOS/Android apply their own mask;
// never bake the inset macOS icon tile into an apple-touch/maskable icon.
// Run: pnpm exec electron scripts/build-pwa-home-icons.cjs
const { app, BrowserWindow, nativeImage } = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const assert = require('node:assert/strict')
async function run() {
  const root = path.resolve(__dirname, '..')
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'polyhedron-home-icons-'))
  app.setPath('userData', temporary)
  await app.whenReady()
  app.dock?.hide()
  const source = await fs.readFile(path.join(root, 'src/renderer/src/assets/dungeons-dragons.svg'), 'utf8')
  const dragon = source.match(/<path\b[^>]*\bd="([^"]+)"/)?.[1]
  assert(dragon, 'Use the original vector dragon')
  // iOS uses a rounded-square mask: fill ~77% of its width. Android's
  // maskable assets retain the smaller artwork inside the 40% safe circle.
  const artwork = size => {
    const width = size === 180 ? 786 : 604
    const height = size === 180 ? 660 : 508
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><defs><linearGradient id="background" x2="0" y2="1"><stop stop-color="#282828"/><stop offset="1" stop-color="#101010"/></linearGradient></defs><rect width="1024" height="1024" fill="url(#background)"/><svg x="${(1024 - width) / 2}" y="${(1024 - height) / 2}" width="${width}" height="${height}" viewBox="0 0 12.21 10.26"><path fill="#A7F175" d="${dragon}"/></svg></svg>`
  }
  const window = new BrowserWindow({ show:false })
  await window.loadURL('data:text/html,<meta http-equiv="Content-Security-Policy" content="default-src %27none%27; img-src data:">')
  const render = async size => window.webContents.executeJavaScript(`(async () => {
    const image = new Image(); image.src = 'data:image/svg+xml;base64,${Buffer.from(artwork(size)).toString('base64')}'; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1024;
    canvas.getContext('2d').drawImage(image,0,0); return canvas.toDataURL('image/png');
  })()`)
  const output = path.join(root, 'pwa/public/icons')
  await fs.mkdir(output, { recursive:true })
  for (const size of [180,192,512]) {
    const icon = nativeImage.createFromDataURL(await render(size))
    const resized = icon.resize({ width:size, height:size, quality:'best' })
    const pixels = resized.toBitmap()
    assert.equal(pixels.length, size * size * 4)
    for (let i = 3; i < pixels.length; i += 4) assert.equal(pixels[i],255,'Home-screen icons must be fully opaque, including all corners')
    await fs.writeFile(path.join(output, `polyhedron-home-${size === 180 ? 'v3' : 'v2'}-${size}.png`), resized.toPNG())
  }
  window.destroy()
  console.log('Generated opaque 180/192/512px home-screen icons from the vector dragon; no baked-in rounded tile.')
  app.quit()
}
run().catch(error => { console.error(error); app.exit(1) })
