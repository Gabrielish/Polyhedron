import { autoUpdater } from 'electron-updater'
import { app, shell } from 'electron'
import type { BrowserWindow } from 'electron'
import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir, rename, rm } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'

export type UpdateState =
  | { status: 'checking' }
  | { status: 'available'; version: string }
  | { status: 'not-available'; version: string }
  | { status: 'downloading'; percent: number }
  | { status: 'downloaded'; version: string }
  | { status: 'force-downloaded'; version: string }
  | { status: 'error'; message: string }

let currentWindow: (() => BrowserWindow | null) | null = null
let updateCheckInProgress = false
let forcedInstallerPath: string | null = null

function emit(state: UpdateState): void {
  currentWindow?.()?.webContents.send('update:state', state)
}

function isMissingReleaseError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /(?:HTTP\s*)?404|latest\.yml/i.test(message)
}

function isTransientUpdateError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /(?:HTTP\s*|HttpError:\s*|status(?:Code)?["\s:=]+)(?:429|5\d{2})\b|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND/i.test(message)
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
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
  autoUpdater.on('error', (error) => {
    // checkForUpdates handles and retries transient failures before showing an error.
    if (updateCheckInProgress) return
    // A fresh repository may not have a published release yet. That is a
    // normal "no update available" state, not an error worth showing at launch.
    if (!isMissingReleaseError(error)) emit({ status: 'error', message: error.message })
  })
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
  if (response.status === 404) {
    emit({ status: 'not-available', version: app.getVersion() })
    return
  }
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
  if (process.platform === 'darwin') {
    try {
      await checkLatestMacRelease()
    } catch (error) {
      emit({ status: 'error', message: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  updateCheckInProgress = true
  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await autoUpdater.checkForUpdates()
        return
      } catch (error) {
        if (isMissingReleaseError(error)) {
          emit({ status: 'not-available', version: app.getVersion() })
          return
        }
        if (attempt === 0 && isTransientUpdateError(error)) {
          await wait(1200)
          continue
        }
        emit({ status: 'error', message: error instanceof Error ? error.message : String(error) })
        return
      }
    }
  } finally {
    updateCheckInProgress = false
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

type GitHubReleaseAsset = {
  name: string
  size: number
  digest?: string | null
  browser_download_url: string
}

type GitHubRelease = {
  tag_name?: string
  assets?: GitHubReleaseAsset[]
}

export async function forceDownloadUpdate(): Promise<'downloaded' | 'opened-release'> {
  const releaseUrl = 'https://github.com/Gabrielish/Polyhedron/releases/latest'
  if (
    process.platform !== 'win32' ||
    process.env.PORTABLE_EXECUTABLE_DIR ||
    process.env.PORTABLE_EXECUTABLE_FILE
  ) {
    await shell.openExternal(releaseUrl)
    return 'opened-release'
  }

  let tempPath: string | null = null
  try {
    const releaseResponse = await fetch('https://api.github.com/repos/Gabrielish/Polyhedron/releases/latest', {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Polyhedron' },
      signal: AbortSignal.timeout(15000)
    })
    if (!releaseResponse.ok) throw new Error(`GitHub Releases returned HTTP ${releaseResponse.status}`)
    const release = (await releaseResponse.json()) as GitHubRelease
    const version = release.tag_name?.replace(/^v/i, '')
    if (!version) throw new Error('The latest GitHub release has no version tag.')

    const assetName = `Polyhedron-${version}-windows-x64-setup.exe`
    const asset = release.assets?.find((item) => item.name === assetName)
    if (!asset) throw new Error(`The latest release does not include ${assetName}.`)
    const expectedDigest = asset.digest?.match(/^sha256:([a-f\d]{64})$/i)?.[1]?.toLowerCase()
    if (!expectedDigest) throw new Error('GitHub did not provide a SHA-256 checksum for the installer.')

    const response = await fetch(asset.browser_download_url, {
      headers: { 'User-Agent': 'Polyhedron' },
      signal: AbortSignal.timeout(10 * 60 * 1000)
    })
    if (!response.ok || !response.body) {
      throw new Error(`Installer download failed with HTTP ${response.status}`)
    }

    const tempDirectory = path.join(app.getPath('temp'), 'Polyhedron-update')
    await mkdir(tempDirectory, { recursive: true })
    tempPath = path.join(tempDirectory, `${assetName}.part`)
    const installerPath = path.join(tempDirectory, assetName)
    await rm(tempPath, { force: true })

    const hash = createHash('sha256')
    let received = 0
    const progress = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        received += chunk.length
        hash.update(chunk)
        emit({ status: 'downloading', percent: asset.size > 0 ? Math.min(100, (received / asset.size) * 100) : 0 })
        callback(null, chunk)
      }
    })
    emit({ status: 'downloading', percent: 0 })
    await pipeline(
      Readable.fromWeb(response.body as never),
      progress,
      createWriteStream(tempPath)
    )

    if (received !== asset.size || hash.digest('hex').toLowerCase() !== expectedDigest) {
      throw new Error('The installer checksum did not match the GitHub release.')
    }
    await rm(installerPath, { force: true })
    await rename(tempPath, installerPath)
    tempPath = null
    forcedInstallerPath = installerPath
    emit({ status: 'force-downloaded', version })
    return 'downloaded'
  } catch (error) {
    if (tempPath) await rm(tempPath, { force: true }).catch(() => undefined)
    const message = error instanceof Error ? error.message : String(error)
    emit({ status: 'error', message })
    throw error
  }
}

export async function installForcedUpdate(): Promise<void> {
  if (!forcedInstallerPath) throw new Error('Download the force update installer first.')
  const installerPath = forcedInstallerPath
  const installer = spawn(installerPath, [], { detached: true, stdio: 'ignore' })
  await new Promise<void>((resolve, reject) => {
    installer.once('error', reject)
    installer.once('spawn', resolve)
  })
  installer.unref()
  forcedInstallerPath = null
  setTimeout(() => app.quit(), 500)
}

export function installUpdate(): void {
  autoUpdater.quitAndInstall()
}
