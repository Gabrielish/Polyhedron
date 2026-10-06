import { app, nativeImage, nativeTheme, shell, type BrowserWindow } from 'electron'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import dragonSvg from '../../renderer/src/assets/dungeons-dragons.svg?raw'
import { logError } from './log.service'

const DEFAULT_ACCENT = '#8C52FF'
const requests = new WeakMap<BrowserWindow, number>()
const WINDOWS_APP_ID = 'com.polyhedron.bg3-mod-translator'
const appliedWindowsIcons = new WeakMap<BrowserWindow, string>()
const taskbarRefreshTimers = new WeakMap<BrowserWindow, ReturnType<typeof setTimeout>>()
const windowsIconWrites = new WeakMap<BrowserWindow, Promise<void>>()
const notificationIcons = new WeakMap<BrowserWindow, Electron.NativeImage>()

/** Notification artwork is independent of the OS's cached application badge. */
export function currentNotificationIcon(window: BrowserWindow): Electron.NativeImage | undefined {
  return window.isDestroyed() ? undefined : notificationIcons.get(window)
}

function windowsIconFilename(ico: Buffer): string {
  return `taskbar-icon-${createHash('sha256').update(ico).digest('hex').slice(0, 16)}.ico`
}

/** Reuse the content-addressed icon at startup, not the shell-cached stable path. */
export function savedWindowsAppIcon(): string | null {
  if (process.platform !== 'win32') return null
  try {
    const stablePath = join(app.getPath('userData'), 'taskbar-icon.ico')
    const ico = readFileSync(stablePath)
    // Older releases wrote a malformed directory entry. Do not restore it.
    const count = ico.length >= 6 ? ico.readUInt16LE(4) : 0
    const dataOffset = 6 + count * 16
    if (count < 1 || ico.length < dataOffset + 8 || ico.readUInt16LE(2) !== 1 || ico.readUInt32LE(18) !== dataOffset) return null
    const hashedPath = join(app.getPath('userData'), windowsIconFilename(ico))
    return existsSync(hashedPath) ? hashedPath : stablePath
  } catch {
    return null
  }
}

/** Set relaunch metadata before the AppUserModelID causes shell grouping. */
export function applyWindowsAppIcon(window: BrowserWindow, iconPath: string, forceRefresh = false): void {
  if (process.platform !== 'win32' || window.isDestroyed()) return
  const previousPath = appliedWindowsIcons.get(window)
  window.setIcon(iconPath)
  window.setAppDetails({
    appIconPath: iconPath, appIconIndex: 0,
    relaunchCommand: `"${process.execPath}"`, relaunchDisplayName: 'Polyhedron'
  })
  window.setAppDetails({ appId: WINDOWS_APP_ID })
  appliedWindowsIcons.set(window, iconPath)
  if ((!forceRefresh && previousPath === iconPath) || !window.isVisible()) return

  // Explorer can retain the old group image even after WM_SETICON and the
  // relaunch properties change. Re-register the taskbar button, not the window:
  // no hide/show, focus change, Explorer restart, or appearance-specific app ID.
  const pending = taskbarRefreshTimers.get(window)
  if (pending) clearTimeout(pending)
  window.setSkipTaskbar(true)
  taskbarRefreshTimers.set(window, setTimeout(() => {
    taskbarRefreshTimers.delete(window)
    if (!window.isDestroyed()) window.setSkipTaskbar(false)
  }, forceRefresh ? 250 : 100))
}

async function updateWindowsShortcuts(iconPath: string, isCurrent: () => boolean): Promise<void> {
  const appData = app.getPath('appData')
  const roots = [
    { path: app.getPath('desktop'), depth: 0 },
    { path: join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs'), depth: 3 },
    { path: join(appData, 'Microsoft', 'Internet Explorer', 'Quick Launch', 'User Pinned', 'TaskBar'), depth: 0 }
  ]
  const executable = resolve(process.execPath).toLowerCase()
  async function visit(directory: string, depth: number): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      if (!isCurrent()) return
      const shortcutPath = join(directory, entry.name)
      if (entry.isDirectory() && depth > 0) { await visit(shortcutPath, depth - 1); continue }
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.lnk')) continue
      let shortcut: Electron.ShortcutDetails
      try { shortcut = shell.readShortcutLink(shortcutPath) } catch { continue }
      // Never change another application's shortcut. Match the executable, or
      // Polyhedron's explicit identity (also covers a stale installation path).
      const belongsToApp = (resolve(shortcut.target).toLowerCase() === executable &&
        (app.isPackaged || shortcut.appUserModelId === WINDOWS_APP_ID)) ||
        (shortcut.appUserModelId === WINDOWS_APP_ID && basename(shortcut.target).toLowerCase() === 'polyhedron.exe')
      if (!belongsToApp || (shortcut.icon === iconPath && shortcut.iconIndex === 0)) continue
      try {
        // Update only icon fields; preserve target, arguments, working directory,
        // and pin identity. Electron also sends SHChangeNotify(SHCNE_UPDATEITEM).
        if (!shell.writeShortcutLink(shortcutPath, 'update', { target: shortcut.target, icon: iconPath, iconIndex: 0 })) {
          throw new Error('Could not update the Polyhedron shortcut icon')
        }
      } catch (error) { logError('app.icon.shortcut', error) }
    }
  }
  for (const root of roots) await visit(root.path, root.depth)
}

function toIco(image: Electron.NativeImage): Buffer {
  // Include exact taskbar/menu sizes so Windows needn't downsample a single
  // 256px frame. Each frame is resized from the original 1024px raster.
  const sizes = [256, 16, 20, 24, 32, 40, 48, 64, 96, 128]
  const frames = sizes.map(size => image.resize({ width: size, height: size, quality: 'best' }).toPNG())
  const header = Buffer.alloc(6 + sizes.length * 16)
  header.writeUInt16LE(0, 0)
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
  return Buffer.concat([header, ...frames])
}

export function createAppIconSvg(accent: string, style = 'accent-background', foreground = 'black', targetPlatform = process.platform): string {
  const color = /^#[0-9a-f]{6}$/i.test(accent.trim()) ? accent.trim() : DEFAULT_ACCENT
  const inverted = style === 'accent-dragon'
  const background = inverted
    ? process.platform === 'darwin' && !nativeTheme.shouldUseDarkColors ? '#F4F1ED' : '#101010'
    : color
  const dragonPath = dragonSvg.match(/<path\b[^>]*\bd="([^"]+)"/)?.[1]
  if (!dragonPath) throw new Error('Application icon dragon path is missing')

  // Leave more transparent breathing room in the Dock. Scale the complete
  // artwork together so the dragon/background proportions stay unchanged.
  const artworkTransform = targetPlatform === 'darwin'
    ? 'translate(512 512) scale(0.92) translate(-512 -512)'
    : 'translate(512 512) scale(1.08) translate(-512 -512)'
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    <defs>
      <linearGradient id="surface" x1="0.5" y1="0" x2="0.5" y2="1">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.16"/>
        <stop offset="0.45" stop-color="#ffffff" stop-opacity="0.025"/>
        <stop offset="1" stop-color="#000000" stop-opacity="0.24"/>
      </linearGradient>
      <linearGradient id="rim" x1="0.5" y1="0" x2="0.5" y2="1">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.48"/>
        <stop offset="0.12" stop-color="#ffffff" stop-opacity="0.12"/>
        <stop offset="0.25" stop-color="#ffffff" stop-opacity="0"/>
        <stop offset="0.72" stop-color="#000000" stop-opacity="0.08"/>
        <stop offset="1" stop-color="#000000" stop-opacity="0.42"/>
      </linearGradient>
      <filter id="shadow" x="-15%" y="-15%" width="130%" height="140%">
        <feDropShadow dx="0" dy="8" stdDeviation="9" flood-color="#000000" flood-opacity="0.28"/>
      </filter>
      <filter id="soft-rim" x="-5%" y="-5%" width="110%" height="110%">
        <feGaussianBlur stdDeviation="4"/>
      </filter>
    </defs>
    <g transform="${artworkTransform}">
    <rect x="64" y="64" width="896" height="896" rx="196" fill="${background}" filter="url(#shadow)"/>
    <rect x="64" y="64" width="896" height="896" rx="196" fill="url(#surface)"/>
    <rect x="72" y="72" width="880" height="880" rx="188" fill="none" stroke="url(#rim)" stroke-width="14" opacity="0.65" filter="url(#soft-rim)"/>
    <rect x="66" y="66" width="892" height="892" rx="194" fill="none" stroke="url(#rim)" stroke-width="3" opacity="0.55"/>
    <g transform="translate(512 512) scale(0.9) translate(-512 -512)">
    <svg x="100" y="166" width="824" height="692" viewBox="0 0 12.21 10.26">
      <path fill="${inverted ? color : foreground === 'white' ? '#FFFFFF' : '#101010'}" d="${dragonPath}"/>
    </svg>
    </g>
    </g>
  </svg>`
}

/** Updates the OS icon and matching Windows shortcuts; renderer branding is untouched. */
export async function updateAppIcon(window: BrowserWindow, accent: string, style = 'accent-background', foreground = 'black', forceRefresh = false): Promise<void> {
  if (window.isDestroyed() || !['darwin', 'win32'].includes(process.platform)) return
  const request = (requests.get(window) ?? 0) + 1
  requests.set(window, request)
  try {
    const svg = createAppIconSvg(accent, style, foreground)
    // Rasterize a detached SVG/canvas using the existing renderer. Neither is
    // inserted into the page, and no extra BrowserWindow changes app lifecycle.
    const dataUrl: string = await window.webContents.executeJavaScript(`(async () => {
      const image = new Image();
      image.src = 'data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}';
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1024;
      canvas.getContext('2d').drawImage(image, 0, 0);
      return canvas.toDataURL('image/png');
    })()`)
    if (window.isDestroyed() || requests.get(window) !== request) return
    const icon = nativeImage.createFromDataURL(dataUrl)
    if (icon.isEmpty()) throw new Error('Generated application icon is empty')
    notificationIcons.set(window, icon.resize({ width: 256, height: 256, quality: 'best' }))
    if (process.platform === 'darwin') app.dock?.setIcon(icon)
    else {
      // With an AppUserModelId Windows uses the relaunch icon for the taskbar
      // button and can ignore WM_SETICON. Refresh that path as well.
      const ico = toIco(icon)
      const canonicalPath = join(app.getPath('userData'), windowsIconFilename(ico))
      // An explicit refresh must also bypass Explorer's filename-based cache,
      // even when the selected artwork itself has not changed.
      const iconPath = forceRefresh
        ? canonicalPath.replace(/\.ico$/, `-refresh-${randomUUID()}.ico`)
        : canonicalPath
      // Serialize the persistent copy so rapid color/style clicks cannot leave
      // an older image on disk after a newer one has already been applied.
      const write = (windowsIconWrites.get(window) ?? Promise.resolve()).catch(() => {}).then(async () => {
        if (window.isDestroyed() || requests.get(window) !== request) return
        await mkdir(app.getPath('userData'), { recursive: true })
        await writeFile(canonicalPath, ico)
        if (forceRefresh) await writeFile(iconPath, ico)
        if (window.isDestroyed() || requests.get(window) !== request) return
        await writeFile(join(app.getPath('userData'), 'taskbar-icon.ico'), ico)
      })
      windowsIconWrites.set(window, write)
      await write
      if (window.isDestroyed() || requests.get(window) !== request) return
      await updateWindowsShortcuts(iconPath, () => !window.isDestroyed() && requests.get(window) === request)
      if (window.isDestroyed() || requests.get(window) !== request) return
      applyWindowsAppIcon(window, iconPath, forceRefresh)
      if (forceRefresh) await new Promise<void>(resolve => setTimeout(resolve, 300))
    }
  } catch (error) {
    if (!window.isDestroyed() && requests.get(window) === request) {
      logError('app.icon', error)
    }
    if (forceRefresh) throw error
  }
}
