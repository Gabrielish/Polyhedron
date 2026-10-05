import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { readFileSync, writeFileSync, renameSync, mkdtempSync, existsSync, readdirSync } from 'node:fs'
import { join, win32 } from 'node:path'
import { tmpdir } from 'node:os'
import { spawn } from 'node:child_process'
import type { InstallerStatus } from '../preload/installer-types'
import { version } from '../../package.json'

export async function startInstaller(): Promise<void> {
  const preview = process.argv.includes('--installer-preview')
  const job = process.argv.find((arg) => arg.startsWith('--installer-job-dir='))?.slice('--installer-job-dir='.length)
  if (!preview && (process.platform !== 'win32' || !job || !existsSync(join(job, 'status.ini')))) { app.quit(); return }
  app.setPath('userData', job && !preview ? join(job, 'profile') : mkdtempSync(join(tmpdir(), 'polyhedron-setup-')))
  await app.whenReady()
  let requested = false
  let status: InstallerStatus = { state: 'ready', target: 'C:\\Users\\You\\AppData\\Local\\Programs\\Polyhedron', version, preview }
  const request = (command: string, target = ''): void => {
    if (!job || preview) return
    const file = join(job, 'request.ini')
    writeFileSync(`${file}.tmp`, '\uFEFF[installer]\r\npid=' + process.pid + '\r\ncommand=' + command + '\r\ntarget=' + target + '\r\n', 'utf16le')
    renameSync(`${file}.tmp`, file)
  }
  const readStatus = (): InstallerStatus => {
    if (preview || !job) return status
    try {
      const bytes = readFileSync(join(job, 'status.ini'))
      const ini = bytes.toString(bytes[0] === 0xff ? 'utf16le' : 'utf8')
      const fields = Object.fromEntries(ini.split(/\r?\n/).filter((line) => line.includes('=')).map((line) => {
        const split = line.indexOf('='); return [line.slice(0, split), line.slice(split + 1)]
      }))
      if (['ready', 'installing', 'done', 'error'].includes(fields.state) && !(requested && fields.state === 'ready')) status = { ...status, state: fields.state as InstallerStatus['state'], target: fields.target || status.target }
      if (fields.pid && status.state !== 'done' && status.state !== 'error') {
        try { process.kill(Number(fields.pid), 0) } catch { status = { ...status, state: 'error', error: 'Setup stopped unexpectedly. Please run the installer again.' } }
      }
    } catch { /* Retain the previous state during an INI update. */ }
    return status
  }
  const window = new BrowserWindow({
    width: 720, height: 510, resizable: false, maximizable: false, frame: false,
    backgroundColor: '#050505', title: 'Polyhedron Setup', show: false,
    webPreferences: { preload: join(__dirname, '../preload/installer.js'), sandbox: true, contextIsolation: true }
  })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event) => event.preventDefault())
  window.on('close', (event) => { if (readStatus().state === 'installing') event.preventDefault() })
  window.on('closed', () => app.quit())
  const handle = (name: string, callback: (...args: unknown[]) => unknown): void => {
    ipcMain.handle(`installer:${name}`, (event, ...args) => {
      if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error('Invalid installer sender')
      return callback(...args)
    })
  }
  handle('status', readStatus)
  handle('minimize', () => window.minimize())
  handle('close', () => { if (readStatus().state !== 'installing') { request('cancel'); window.close() } })
  handle('browse', async () => {
    if (requested) return null
    const result = await dialog.showOpenDialog(window, { properties: ['openDirectory', 'createDirectory'] })
    if (result.canceled) return null
    const folder = result.filePaths[0]
    return win32.basename(folder).toLowerCase() === 'polyhedron' ? folder : win32.join(folder, 'Polyhedron')
  })
  handle('install', (input) => {
    if (requested || readStatus().state !== 'ready') throw new Error('Installation already started')
    if (typeof input !== 'string' || input.length > 240 || /[\x00-\x1f"<>|?*]/.test(input) || !/^[A-Za-z]:\\/.test(input)) throw new Error('Choose a valid local installation folder.')
    const target = win32.normalize(input)
    if (win32.basename(target).toLowerCase() !== 'polyhedron') throw new Error('The installation folder must be named Polyhedron.')
    if (!preview && existsSync(target) && readdirSync(target).length && !existsSync(join(target, 'Polyhedron.exe'))) throw new Error('Choose an empty folder or an existing Polyhedron installation.')
    requested = true
    request('start', target)
    status = { ...status, state: 'installing', target }
    if (preview) setTimeout(() => { status = { ...status, state: 'done' } }, 2500)
  })
  handle('launch', () => {
    if (readStatus().state !== 'done') throw new Error('Installation has not completed')
    if (!preview) {
      const child = spawn(join(status.target, 'Polyhedron.exe'), [], { detached: true, stdio: 'ignore', cwd: status.target })
      child.on('error', () => { /* Installation remains complete if launch fails. */ })
      child.unref()
    }
    window.close()
  })
  request('ready')
  if (process.env.ELECTRON_RENDERER_URL) await window.loadURL(`${process.env.ELECTRON_RENDERER_URL}/installer.html`)
  else await window.loadFile(join(__dirname, '../renderer/installer.html'))
  if (!process.argv.includes('--installer-smoke')) {
    // A one-time foreground handoff from the native splash. Do not keep Setup
    // above other applications after it has appeared.
    if (process.platform === 'win32') window.setAlwaysOnTop(true)
    window.show()
    window.focus()
    if (process.platform === 'win32') setTimeout(() => {
      if (!window.isDestroyed()) window.setAlwaysOnTop(false)
    }, 300)
  }
  request('visible')
}
