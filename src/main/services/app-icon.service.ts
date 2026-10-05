import { app, nativeImage, nativeTheme, type BrowserWindow } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import dragonSvg from '../../renderer/src/assets/dungeons-dragons.svg?raw'
import { logError } from './log.service'

const DEFAULT_ACCENT = '#8C52FF'
const requests = new WeakMap<BrowserWindow, number>()

function toIco(image: Electron.NativeImage): Buffer {
  const png = image.toPNG()
  const header = Buffer.alloc(22)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(1, 4)
  header[6] = 0
  header[7] = 0
  header.writeUInt16LE(1, 8)
  header.writeUInt16LE(32, 10)
  header.writeUInt32LE(png.length, 12)
  header.writeUInt32LE(22, 16)
  return Buffer.concat([header, png])
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

/** Updates only the running app's OS icon; renderer branding is untouched. */
export async function updateAppIcon(window: BrowserWindow, accent: string, style = 'accent-background', foreground = 'black'): Promise<void> {
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
    if (process.platform === 'darwin') app.dock?.setIcon(icon)
    else {
      // Windows taskbar HICONs are cached/rejected inconsistently at 1024px.
      // Give the shell the same artwork at the native maximum icon size.
      const taskbarIcon = icon.resize({ width: 256, height: 256 })
      window.setIcon(taskbarIcon)
      // With an AppUserModelId Windows uses the relaunch icon for the taskbar
      // button and can ignore WM_SETICON. Refresh that path as well.
      const iconPath = join(app.getPath('userData'), 'taskbar-icon.ico')
      await mkdir(app.getPath('userData'), { recursive: true })
      await writeFile(iconPath, toIco(taskbarIcon))
      if (window.isDestroyed() || requests.get(window) !== request) return
      window.setAppDetails({ appId: 'com.polyhedron.bg3-mod-translator', appIconPath: iconPath })
    }
  } catch (error) {
    if (!window.isDestroyed() && requests.get(window) === request) {
      logError('app.icon', error)
    }
  }
}
