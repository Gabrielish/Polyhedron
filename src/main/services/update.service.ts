import { autoUpdater } from 'electron-updater'
import { app, shell } from 'electron'
import type { BrowserWindow } from 'electron'

export type UpdateState =
  | { status: 'checking' }
  | { status: 'available'; version: string }
  | { status: 'not-available'; version: string }
  | { status: 'downloading'; percent: number }
  | { status: 'downloaded'; version: string }
  | { status: 'error'; message: string }

let currentWindow: (() => BrowserWindow | null) | null = null

function emit(state: UpdateState): void {
  currentWindow?.()?.webContents.send('update:state', state)
}

export function registerUpdateService(getWindow: () => BrowserWindow | null): void {
  currentWindow = getWindow
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => emit({ status: 'checking' }))
  autoUpdater.on('update-available', (info) => emit({ status: 'available', version: info.version }))
  autoUpdater.on('update-not-available', (info) => emit({ status: 'not-available', version: info.version }))
  autoUpdater.on('download-progress', (progress) => emit({ status: 'downloading', percent: progress.percent }))
  autoUpdater.on('update-downloaded', (info) => emit({ status: 'downloaded', version: info.version }))
  autoUpdater.on('error', (error) => emit({ status: 'error', message: error.message }))
}


function compareVersions(left: string, right: string): number {
  const a = left.split('.').map((part) => Number.parseInt(part, 10) || 0)
  const b = right.split('.').map((part) => Number.parseInt(part, 10) || 0)
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    if ((a[index] ?? 0) !== (b[index] ?? 0)) return (a[index] ?? 0) - (b[index] ?? 0)
  }
  return 0
}

async function checkLatestMacRelease(): Promise<void> {
  const response = await fetch('https://api.github.com/repos/Gabrielish/Polyhedron/releases/latest', {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Polyhedron'
    },
    signal: AbortSignal.timeout(10000)
  })
  if (!response.ok) throw new Error(`GitHub Releases returned HTTP ${response.status}`)

  const release = (await response.json()) as { tag_name?: string }
  const latestVersion = release.tag_name?.replace(/^v/i, '')
  if (!latestVersion) throw new Error('The latest GitHub release has no version tag.')

  if (compareVersions(latestVersion, app.getVersion()) <= 0) {
    emit({ status: 'not-available', version: latestVersion })
  } else {
    emit({ status: 'available', version: latestVersion })
  }
}

export async function checkForUpdates(): Promise<void> {
  if (!currentWindow) return
  try {
    if (process.platform === 'darwin') {
      await checkLatestMacRelease()
      return
    }
    await autoUpdater.checkForUpdates()
  } catch (error) {
    emit({ status: 'error', message: error instanceof Error ? error.message : String(error) })
  }
}

export async function downloadUpdate(): Promise<void> {
  try {
    // Unsigned macOS builds cannot be installed by electron-updater. Open the
    // release page so the user can download and replace the app manually.
    if (process.platform === 'darwin') {
      await shell.openExternal('https://github.com/Gabrielish/Polyhedron/releases/latest')
      return
    }
    await autoUpdater.downloadUpdate()
  } catch (error) {
    emit({ status: 'error', message: error instanceof Error ? error.message : String(error) })
  }
}

export function installUpdate(): void {
  autoUpdater.quitAndInstall()
}
