const { app, BrowserWindow, nativeTheme } = require('electron')
const { createRequire } = require('node:module')
const Module = require('node:module')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const assert = require('node:assert/strict')

async function run() {
  const root = path.resolve(__dirname, '..')
  const output = await fs.mkdtemp(path.join(os.tmpdir(), 'polyhedron-app-icon-'))
  app.setPath('userData', path.join(output, 'profile'))
  const { build } = createRequire(require.resolve('vite/package.json'))('esbuild')
  const bundle = await build({
    absWorkingDir: root, bundle: true, write: false, platform: 'node', format: 'cjs',
    external: ['electron'], entryPoints: ['src/main/services/app-icon.service.ts'],
    plugins: [{ name: 'svg-source', setup(builder) {
      builder.onLoad({ filter: /\.svg$/ }, async ({ path: filename }) => ({
        contents: await fs.readFile(filename.replace(/\?raw$/, ''), 'utf8'), loader: 'text'
      }))
    } }]
  })
  const service = new Module(path.join(root, 'scripts', 'app-icon-test.cjs'), module)
  service.filename = path.join(root, 'scripts', 'app-icon-test.cjs')
  service.paths = module.paths
  service._compile(bundle.outputFiles[0].text, service.filename)
  const { updateAppIcon, createAppIconSvg } = service.exports
  await app.whenReady()
  const window = new BrowserWindow({ show: false })
  await window.loadURL('data:text/html,' + encodeURIComponent(
    '<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; img-src \'self\' data:"><p id="branding">Original branding</p>'
  ))
  const icons = []
  const setIcon = app.dock.setIcon.bind(app.dock)
  app.dock.setIcon = icon => { icons.push(icon); setIcon(icon) }
  const pixel = (icon, x, y) => [...icon.toBitmap().subarray((y * 1024 + x) * 4, (y * 1024 + x) * 4 + 4)]
  const checkSurface = (icon, color) => {
    const rgb = [5, 3, 1].map(i => parseInt(color.slice(i, i + 2), 16))
    const top = pixel(icon, 512, 160), bottom = pixel(icon, 512, 875)
    assert.equal(top[3], 255, 'Background remains opaque')
    assert.ok(rgb.every((channel, i) => Math.abs(top[i] - channel) < 45), 'Surface keeps the selected base color')
    assert.ok(top.slice(0, 3).reduce((a,b)=>a+b,0) > bottom.slice(0, 3).reduce((a,b)=>a+b,0), 'Material has a lit top and shaded bottom')
  }
  for (const color of ['#8C52FF', '#A7F175', '#ED1C24']) {
    await updateAppIcon(window, color)
    const icon = icons.at(-1)
    assert.ok(icon, 'Dock icon must be applied')
    assert.deepEqual(icon.getSize(), { width: 1024, height: 1024 })
    checkSurface(icon, color)
    assert.ok(pixel(icon, 512, 80)[3] < 10, 'Dock top padding contains only a faint shadow')
    assert.ok(pixel(icon, 80, 512)[3] < 10, 'Dock horizontal padding contains only a faint shadow')
    const bitmap = icon.toBitmap()
    let dragonPixels = 0
    let dragonLeft = 1024, dragonRight = 0
    for (let i = 0; i < bitmap.length; i += 4) {
      if (bitmap[i] === 16 && bitmap[i + 1] === 16 && bitmap[i + 2] === 16 && bitmap[i + 3] === 255) {
        dragonPixels++
        const x = (i / 4) % 1024
        dragonLeft = Math.min(dragonLeft, x)
        dragonRight = Math.max(dragonRight, x)
      }
    }
    assert.ok(dragonPixels > 60000, 'Dragon has a solid #101010 silhouette')
    assert.ok(dragonRight - dragonLeft < 685, 'Dragon is smaller within the unchanged Dock background')
    assert.ok(createAppIconSvg(color).includes('scale(0.9)'), 'Dragon uses uniform scaling, not a width-only resize')
    assert.equal(pixel(icon, 0, 0)[3], 0, 'Transparent outside rounded icon')
    await fs.writeFile(path.join(output, color.slice(1) + '.png'), icon.toPNG())
    console.log('PASS: background ' + color + ', dragon #101010, native Dock update')
  }
  const before = icons.length
  await Promise.all(['#123456', '#654321', '#ABCDEF'].map(color => updateAppIcon(window, color)))
  assert.equal(icons.length, before + 1, 'Only latest rapid change is applied')
  checkSurface(icons.at(-1), '#ABCDEF')
  assert.ok(createAppIconSvg('invalid').includes('fill="#8C52FF"'))
  assert.equal(await window.webContents.executeJavaScript('document.body.textContent'), 'Original branding')
  assert.equal(await window.webContents.executeJavaScript('document.querySelectorAll("svg, canvas, img").length'), 0)
  console.log('PASS: rapid changes, invalid-color fallback, renderer untouched')
  await updateAppIcon(window, '#8C52FF', 'accent-background', 'white')
  const whiteBitmap = icons.at(-1).toBitmap()
  let whiteDragonPixels = 0
  for (let i = 0; i < whiteBitmap.length; i += 4) {
    if (whiteBitmap[i] === 255 && whiteBitmap[i + 1] === 255 && whiteBitmap[i + 2] === 255 && whiteBitmap[i + 3] === 255) whiteDragonPixels++
  }
  assert.ok(whiteDragonPixels > 60000, 'White button text produces a white dragon on the accent background')
  assert.ok(createAppIconSvg('#A7F175', 'accent-dragon', 'white').includes('<path fill="#A7F175"'), 'Inverted mode keeps the accent dragon regardless of button text color')
  console.log('PASS: button text color controls dragon foreground only in accent-background mode')
  const themeSource = nativeTheme.themeSource
  for (const source of ['light', 'dark']) {
    nativeTheme.themeSource = source
    await updateAppIcon(window, '#A7F175', 'accent-dragon')
    const icon = icons.at(-1)
    checkSurface(icon, source === 'dark' ? '#101010' : '#F4F1ED')
    assert.ok(createAppIconSvg('#A7F175', 'accent-dragon').includes('<path fill="#A7F175"'))
    if (source === 'dark') {
      const left = pixel(icon, 104, 512), right = pixel(icon, 919, 512)
      assert.ok(left.slice(0, 3).every((channel, i) => Math.abs(channel - right[i]) <= 2), 'Rim lighting is symmetric, not biased to the upper left')
      const brightness = rgba => rgba.slice(0, 3).reduce((a, b) => a + b, 0)
      assert.ok(brightness(pixel(icon, 512, 105)) > brightness(left) + 30, 'Specular highlight is concentrated on the top edge')
    }
    await fs.writeFile(path.join(output, 'inverted-' + source + '.png'), icon.toPNG())
    console.log('PASS: inverted dragon, macOS ' + source + ' background')
  }
  nativeTheme.themeSource = themeSource
  const dockCount = icons.length
  const platform = Object.getOwnPropertyDescriptor(process, 'platform')
  const windowSetIcon = window.setIcon
  let taskbarIcon
  window.setIcon = icon => { taskbarIcon = icon }
  try {
    Object.defineProperty(process, 'platform', { ...platform, value: 'win32' })
    await updateAppIcon(window, '#A7F175')
    assert.ok(taskbarIcon, 'Windows path must call BrowserWindow.setIcon')
    assert.deepEqual(taskbarIcon.getSize(), { width: 256, height: 256 })
    const nativePixel = (x, y) => [...taskbarIcon.toBitmap().subarray((y * 256 + x) * 4, (y * 256 + x) * 4 + 4)]
    assert.equal(nativePixel(128, 40)[3], 255, 'Windows taskbar surface remains opaque')
    nativeTheme.themeSource = 'light'
    await updateAppIcon(window, '#A7F175', 'accent-dragon')
    assert.equal(nativePixel(128, 40)[3], 255, 'Windows inverted taskbar surface remains opaque')
    assert.equal(icons.length, dockCount, 'Windows path must not update Dock')
  } finally {
    Object.defineProperty(process, 'platform', platform)
    window.setIcon = windowSetIcon
    nativeTheme.themeSource = themeSource
  }
  console.log('PASS: Windows icon dispatch (native taskbar requires Windows verification)')
  console.log('Previews: ' + output)
  window.destroy()
  await updateAppIcon(window, '#ED1C24')
  app.quit()
}
run().catch(error => { console.error(error); app.exit(1) })
