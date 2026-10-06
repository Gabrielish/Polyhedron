const { app, BrowserWindow, nativeTheme, nativeImage, shell } = require('electron')
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
  const { updateAppIcon, createAppIconSvg, savedWindowsAppIcon, applyWindowsAppIcon, currentNotificationIcon } = service.exports
  await app.whenReady()
  const window = new BrowserWindow({ show: false })
  await window.loadURL('data:text/html,' + encodeURIComponent(
    '<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; img-src \'self\' data:"><p id="branding">Original branding</p>'
  ))
  const icons = []
  assert.equal(currentNotificationIcon(window), undefined, 'No stale notification image before initialization')
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
    const notificationIcon = currentNotificationIcon(window)
    assert.deepEqual(notificationIcon.getSize(), { width: 256, height: 256 })
    assert.deepEqual(notificationIcon.toPNG(), icon.resize({ width: 256, height: 256, quality: 'best' }).toPNG(), 'Notification image matches the latest selected Dock artwork')
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
  const windowSetAppDetails = window.setAppDetails
  const windowIsVisible = window.isVisible
  const windowSetSkipTaskbar = window.setSkipTaskbar
  const readShortcut = shell.readShortcutLink
  const writeShortcut = shell.writeShortcutLink
  const originalDesktop = app.getPath('desktop')
  const originalAppData = app.getPath('appData')
  const testDesktop = path.join(output, 'desktop')
  const testAppData = path.join(output, 'appData')
  const shortcuts = new Map()
  for (const filename of [
    path.join(testDesktop, 'My Polyhedron.lnk'),
    path.join(testAppData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Polyhedron.lnk'),
    path.join(testAppData, 'Microsoft', 'Internet Explorer', 'Quick Launch', 'User Pinned', 'TaskBar', 'Polyhedron.lnk'),
    path.join(testDesktop, 'Unrelated.lnk')
  ]) {
    await fs.mkdir(path.dirname(filename), { recursive: true })
    await fs.writeFile(filename, 'test-only shortcut placeholder')
    shortcuts.set(filename, { target: filename.includes('Unrelated') ? '/unrelated/application.exe' : process.execPath,
      args: '--keep-my-arguments', cwd: output, description: 'Keep my description',
      appUserModelId: filename.includes('Unrelated') ? 'unrelated.app' : 'com.polyhedron.bg3-mod-translator', icon: 'old.ico', iconIndex: 0 })
  }
  app.setPath('desktop', testDesktop)
  app.setPath('appData', testAppData)
  shell.readShortcutLink = filename => ({ ...shortcuts.get(filename) })
  shell.writeShortcutLink = (filename, operation, details) => {
    assert.equal(operation, 'update')
    shortcuts.set(filename, { ...shortcuts.get(filename), ...details })
    return true
  }
  const appDetails = []
  const taskbarChanges = []
  window.setAppDetails = details => appDetails.push(details)
  window.isVisible = () => true
  window.setSkipTaskbar = skip => taskbarChanges.push(skip)
  let taskbarIcon
  window.setIcon = icon => {
    const ico = require('node:fs').readFileSync(icon)
    const offset = ico.readUInt32LE(18)
    taskbarIcon = nativeImage.createFromBuffer(ico.subarray(offset, offset + ico.readUInt32LE(14)))
  }
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
    assert.equal(appDetails.length, 4, 'Relaunch metadata and shell identity set separately for both styles')
    assert.notEqual(appDetails[0].appIconPath, appDetails[2].appIconPath, 'Different artwork uses different paths to avoid shell icon cache')
    for (let index = 0; index < appDetails.length; index += 2) {
      const details = appDetails[index]
      assert.ok(!details.appId, 'Relaunch metadata is supplied before the grouping identity')
      assert.equal(appDetails[index + 1].appId, 'com.polyhedron.bg3-mod-translator')
      const ico = await fs.readFile(details.appIconPath)
      assert.equal(ico.readUInt16LE(2), 1, 'ICO type')
      const sizes = [256,16,20,24,32,40,48,64,96,128]
      assert.equal(ico.readUInt16LE(4), sizes.length, 'ICO includes native Windows UI sizes')
      assert.equal(ico.readUInt16LE(10), 1, 'ICO planes at the correct offset')
      assert.equal(ico.readUInt16LE(12), 32, 'ICO bit depth at the correct offset')
      let offset = 6 + sizes.length * 16
      sizes.forEach((size, frame) => {
        const entry = 6 + frame * 16
        assert.equal(ico[entry], size === 256 ? 0 : size)
        assert.equal(ico[entry + 1], size === 256 ? 0 : size)
        assert.equal(ico.readUInt32LE(entry + 12), offset)
        const length = ico.readUInt32LE(entry + 8)
        const png = ico.subarray(offset, offset + length)
        assert.deepEqual([...png.subarray(0, 8)], [137,80,78,71,13,10,26,10], 'Valid PNG frame')
        assert.deepEqual(nativeImage.createFromBuffer(png).getSize(), {width:size,height:size}, 'Frame dimensions match directory')
        offset += length
      })
      assert.equal(offset, ico.length, 'Every frame is present without trailing data')
      assert.ok(details.relaunchCommand && details.relaunchDisplayName, 'Windows relaunch properties supplied together')
    }
    const saved = savedWindowsAppIcon()
    assert.equal(saved, appDetails[2].appIconPath, 'Startup restores the hashed icon path, not the cached stable filename')
    for (const [filename, details] of shortcuts) {
      assert.equal(details.icon, filename.includes('Unrelated') ? 'old.ico' : saved, 'Only matching desktop/Start/taskbar shortcuts receive the new icon')
      assert.equal(details.args, '--keep-my-arguments', 'Shortcut arguments are preserved')
      assert.equal(details.cwd, output, 'Shortcut working directory is preserved')
      assert.equal(details.description, 'Keep my description', 'Shortcut description is preserved')
    }
    await new Promise(resolve => setTimeout(resolve, 150))
    assert.deepEqual(taskbarChanges, [true, true, false], 'Rapid live updates restore the button once without hiding the app window')
    applyWindowsAppIcon(window, saved)
    assert.equal(taskbarChanges.length, 3, 'Unchanged icon does not churn the taskbar button')
    await updateAppIcon(window, '#A7F175', 'accent-dragon', 'black', true)
    const refreshed = appDetails.at(-2).appIconPath
    assert.notEqual(refreshed, saved, 'Explicit refresh bypasses the shell filename cache')
    assert.equal(savedWindowsAppIcon(), saved, 'Refresh preserves the canonical startup icon')
    assert.deepEqual(await fs.readFile(refreshed), await fs.readFile(saved), 'Refresh keeps the selected artwork unchanged')
    await updateAppIcon(window, '#A7F175', 'accent-dragon', 'black', true)
    assert.notEqual(appDetails.at(-2).appIconPath, refreshed, 'Repeated refresh requests get distinct shell cache keys')
    assert.deepEqual(taskbarChanges.slice(-4), [true, false, true, false], 'Explicit refresh restores the taskbar button each time')
    console.log('PASS: explicit Windows refresh, unique cache keys, persisted appearance unchanged')
    await fs.writeFile(path.join(app.getPath('userData'), 'taskbar-icon.ico'), Buffer.alloc(22))
    assert.equal(savedWindowsAppIcon(), null, 'Invalid legacy icon is not restored')
  } finally {
    Object.defineProperty(process, 'platform', platform)
    window.setIcon = windowSetIcon
    window.setAppDetails = windowSetAppDetails
    window.isVisible = windowIsVisible
    window.setSkipTaskbar = windowSetSkipTaskbar
    shell.readShortcutLink = readShortcut
    shell.writeShortcutLink = writeShortcut
    app.setPath('desktop', originalDesktop)
    app.setPath('appData', originalAppData)
    nativeTheme.themeSource = themeSource
  }
  console.log('PASS: Windows icon dispatch (native taskbar requires Windows verification)')
  console.log('Previews: ' + output)
  window.destroy()
  await updateAppIcon(window, '#ED1C24')
  app.quit()
}
run().catch(error => { console.error(error); app.exit(1) })
