const { app, BrowserWindow, ipcMain, nativeImage, shell } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const { execFile } = require('node:child_process')
const { promisify } = require('node:util')

const root = path.resolve(__dirname, '..')
const trace = message => fs.appendFileSync(path.join(root, 'dist', 'icon-loader-test', 'fixture-trace.txt'), message + '\n')
process.on('uncaughtException', error => { trace(error.stack || String(error)); app.exit(1) })
process.on('unhandledRejection', error => { trace(error.stack || String(error)); app.exit(1) })
app.disableHardwareAcceleration()
trace('Starting fixture')
const automated = process.argv.includes('--self-test') || process.argv.includes('--restore-check')
const profile = path.join(app.getPath('temp'), 'polyhedron-taskbar-test-profile', automated ? 'automated' : 'interactive')
const desktop = path.join(profile, 'desktop')
const appData = path.join(profile, 'appData')
fs.mkdirSync(desktop, { recursive: true })
fs.mkdirSync(appData, { recursive: true })
app.setPath('desktop', desktop)
app.setPath('appData', appData)
app.setPath('userData', profile)
app.setAppUserModelId('com.polyhedron.taskbar-test')
const { updateAppIcon, savedWindowsAppIcon, applyWindowsAppIcon, createAppIconSvg } = require(path.join(root, 'dist', 'icon-loader-test', 'app-icon-service.cjs'))
app.whenReady().then(async () => {
  trace('Electron ready')
  const saved = savedWindowsAppIcon()
  const shortcutPath = path.join(desktop, 'Polyhedron Test.lnk')
  if (!fs.existsSync(shortcutPath)) shell.writeShortcutLink(shortcutPath, 'create', {
    target: process.execPath, args: `"${__filename}"`, icon: path.join(root, 'build', 'icon.ico'),
    iconIndex: 0, appUserModelId: 'com.polyhedron.taskbar-test'
  })
  const initialShortcut = shell.readShortcutLink(shortcutPath)
  trace('Shortcut prepared')
  const window = new BrowserWindow({ width: 600, height: 330, title: 'Polyhedron taskbar test',
    show: false, icon: saved || path.join(root, 'build', 'icon.ico'), backgroundColor: '#101010',
    webPreferences: { nodeIntegration: true, contextIsolation: false } })
  trace('Window created')
  if (saved) applyWindowsAppIcon(window, saved)
  const record = (mode) => {
    fs.writeFileSync(path.join(profile, 'state.json'), JSON.stringify({
      mode, handle: window.getNativeWindowHandle().readBigUInt64LE().toString(),
      saved: savedWindowsAppIcon(), shortcut: shell.readShortcutLink(shortcutPath), timestamp: Date.now()
    }, null, 2))
  }
  const apply = async mode => {
    if (mode === 'restart') { app.relaunch(); app.quit(); return mode }
    if (mode !== 'legacy') {
      await updateAppIcon(window, mode === 'green' ? '#A7F175' : mode === 'purple' ? '#8C52FF' : '#ED1C24', mode === 'green' ? 'accent-dragon' : 'accent-background', 'white', mode === 'refresh')
      record(mode)
      return mode + ' — current service applied'
    }
    const iconPath = path.join(profile, 'legacy-red.ico')
    const svg = Buffer.from(createAppIconSvg('#ED1C24', 'accent-background', 'white')).toString('base64')
    const url = await window.webContents.executeJavaScript(`(async () => {
      const image = new Image(); image.src = 'data:image/svg+xml;base64,${svg}'; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
      canvas.getContext('2d').drawImage(image, 0, 0, 256, 256); return canvas.toDataURL();
    })()`)
    const image = nativeImage.createFromDataURL(url)
    const png = image.toPNG()
    const header = Buffer.alloc(22)
    header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4)
    header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12)
    header.writeUInt32LE(png.length, 14); header.writeUInt32LE(22, 18)
    fs.writeFileSync(iconPath, Buffer.concat([header, png]))
    window.setIcon(image)
    const details = { appIconPath: iconPath, appIconIndex: 0,
      relaunchCommand: `"${process.execPath}" "${__filename}"`, relaunchDisplayName: 'Polyhedron taskbar test' }
    window.setAppDetails({ appId: 'com.polyhedron.taskbar-test', ...details })
    record(mode)
    return mode
  }
  ipcMain.handle('icon-test:apply', (_event, mode) => apply(mode))
  await window.loadURL('data:text/html,' + encodeURIComponent(`<style>body{background:#101010;color:#eee;font:16px Segoe UI;padding:25px}button{background:#A7F175;border:0;border-radius:16px;padding:12px;margin:8px}p{color:#aaa}</style>
    <h2>Polyhedron taskbar test</h2><p>Isolated window — no workspace or settings changes.</p>
    <button onclick="apply('legacy')">Old method</button><button onclick="apply('red')">Red / white dragon</button><button onclick="apply('green')">Green dragon</button><button onclick="apply('purple')">Purple / white dragon</button><button onclick="apply('refresh')">Force refresh (red)</button><button onclick="apply('restart')">Restart test</button><p id="status">${saved ? 'Restored saved icon' : 'Default green icon'}</p>
    <script>async function apply(mode){ document.getElementById('status').textContent = await require('electron').ipcRenderer.invoke('icon-test:apply',mode) }</script>`))
  trace('Renderer loaded')
  window.show()
  record('startup')
  if (automated) {
    try {
      if (!process.argv.includes('--restore-check')) {
        await apply('red')
        trace('Red applied')
        await apply('green')
        trace('Green applied')
        await apply('red')
        trace('Red reapplied')
        await apply('refresh')
        const firstRefresh = shell.readShortcutLink(shortcutPath).icon
        await apply('refresh')
        assert.notEqual(shell.readShortcutLink(shortcutPath).icon, firstRefresh, 'Repeated refresh must change the shell cache key')
        trace('Two explicit refreshes applied')
      }
      const selected = savedWindowsAppIcon()
      assert.ok(selected, 'Selected icon must survive restart')
      const shortcut = shell.readShortcutLink(shortcutPath)
      assert.deepEqual(fs.readFileSync(shortcut.icon), fs.readFileSync(selected), 'Shortcut and startup icon have identical selected artwork')
      assert.equal(shortcut.args, `"${__filename}"`)
      assert.equal(shortcut.appUserModelId, 'com.polyhedron.taskbar-test')
      assert.equal(shortcut.target, initialShortcut.target)
      assert.equal(shortcut.cwd, initialShortcut.cwd)
      assert.equal(shortcut.description, initialShortcut.description)
      const probe = await promisify(execFile)('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
        path.join(root, 'scripts', 'verify-windows-window-icon.ps1'), '-WindowHandle',
        window.getNativeWindowHandle().readBigUInt64LE().toString(), '-IconPath', process.argv.includes('--restore-check') ? selected : shortcut.icon], { encoding: 'utf8' })
      console.log(probe.stdout)
      console.log('PASS: ' + (process.argv.includes('--restore-check') ? 'fresh process restores selected icon before showing window' : 'live red/green/red changes and native shortcut persistence'))
      fs.writeFileSync(path.join(root, 'dist', 'icon-loader-test', process.argv.includes('--restore-check') ? 'restore-pass.txt' : 'live-pass.txt'), selected)
      app.exit(0)
    } catch (error) { console.error(error); app.exit(1) }
  }
})
app.on('window-all-closed', () => app.quit())
