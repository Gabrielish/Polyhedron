// Validate checked-in branding, not a local application/installer build.
const { app, nativeImage } = require('electron')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve(__dirname, '..')

async function run() {
  await app.whenReady()
  const config = fs.readFileSync(path.join(root, 'config/electron-builder.yml'), 'utf8')
  const mac = config.slice(config.indexOf('\nmac:\n') >= 0 ? config.indexOf('\nmac:\n') : config.indexOf('\nmac:\r\n'))
  assert.match(mac, /CFBundleIconFile: PolyhedronGreen\.icns/)
  assert.match(mac, /from: resources\/installer\/icon\.icns\s+to: Resources\/PolyhedronGreen\.icns/)
  const bytes = fs.readFileSync(path.join(root, 'resources/installer/icon.icns'))
  assert.equal(bytes.toString('ascii', 0, 4), 'icns')
  assert.equal(bytes.readUInt32BE(4), bytes.length)
  let pngFrames = 0
  for (let offset = 8; offset < bytes.length;) {
    const size = bytes.readUInt32BE(offset + 4)
    assert.ok(size >= 8 && offset + size <= bytes.length)
    const frame = bytes.subarray(offset + 8, offset + size)
    if (frame.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') {
      const image = nativeImage.createFromBuffer(frame)
      assert.ok(!image.isEmpty())
      let green = 0, red = 0
      const pixels = image.toBitmap()
      for (let p = 0; p < pixels.length; p += 4) {
        const [b, g, r, a] = pixels.subarray(p, p + 4)
        if (a < 128) continue
        if (g > r * 1.2 && g > b * 1.2) green++
        if (r > g * 1.2 && r > b * 1.2) red++
      }
      assert.ok(green > 10, 'Every PNG icon resolution must contain the green dragon')
      assert.equal(red, 0, 'No old red dragon in the packaged icon')
      pngFrames++
    }
    offset += size
  }
  assert.ok(pngFrames >= 7)
  const service = fs.readFileSync(path.join(root, 'src/main/services/app-icon.service.ts'), 'utf8')
  assert.ok(service.includes('app.dock?.setIcon(icon)'), 'Keep Dock customization independent')
  console.log(`PASS: macOS plist/copy target match, ${pngFrames} green icon resolutions, unchanged Dock customization`)
  app.quit()
}
run().catch(error => { console.error(error); app.exit(1) })
