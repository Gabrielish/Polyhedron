import { app } from 'electron'
import { execFile } from 'node:child_process'
import { realpath } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { logError } from './log.service'

const APP_ID = 'com.polyhedron.bg3-mod-translator'
interface BundleInfo {
  CFBundleIdentifier?: string
  CFBundleShortVersionString?: string
  CFBundleVersion?: string
}
interface ImageInfo {
  images?: Array<{ 'system-entities'?: Array<{ 'mount-point'?: string }> }>
}

function command(file: string, args: string[], input?: string): Promise<string> {
  return new Promise((resolveOutput, reject) => {
    const child = execFile(file, args, { timeout: 10000, maxBuffer: 4 * 1024 * 1024 }, (error, stdout) => {
      if (error) reject(error)
      else resolveOutput(stdout)
    })
    // plutil reads stdin explicitly; no shell interpolation or temporary files.
    child.stdin?.on('error', () => {})
    child.stdin?.end(input)
  })
}

async function bundleInfo(bundle: string): Promise<BundleInfo> {
  return JSON.parse(await command('/usr/bin/plutil', ['-convert', 'json', '-o', '-', join(bundle, 'Contents/Info.plist')])) as BundleInfo
}

/** Only eject matching installation images after the installed copy is running. */
export async function ejectMacInstallationImages(): Promise<void> {
  if (process.platform !== 'darwin' || !app.isPackaged || !app.isInApplicationsFolder()) return
  try {
    const installedBundle = await realpath(resolve(dirname(process.execPath), '../..'))
    const installed = await bundleInfo(installedBundle)
    if (installed.CFBundleIdentifier !== APP_ID || !installed.CFBundleShortVersionString || !installed.CFBundleVersion) return
    const plist = await command('/usr/bin/hdiutil', ['info', '-plist'])
    const images = JSON.parse(await command('/usr/bin/plutil', ['-convert', 'json', '-o', '-', '-'], plist)) as ImageInfo
    const mounts = new Set((images.images ?? []).flatMap(image => (image['system-entities'] ?? []).map(entity => entity['mount-point']).filter((mount): mount is string => Boolean(mount))))
    for (const mount of mounts) {
      // A disk image, our volume name, our app identity/version and the expected
      // Applications shortcut must all match. Never touch unrelated volumes.
      if (dirname(mount) !== '/Volumes' || !/^Polyhedron(?:\s|$)/.test(basename(mount))) continue
      try {
        const sourceBundle = await realpath(join(mount, basename(installedBundle)))
        if (sourceBundle === installedBundle || dirname(sourceBundle) !== mount) continue
        if (await realpath(join(mount, 'Applications')) !== '/Applications') continue
        const source = await bundleInfo(sourceBundle)
        if (source.CFBundleIdentifier !== APP_ID || source.CFBundleShortVersionString !== installed.CFBundleShortVersionString || source.CFBundleVersion !== installed.CFBundleVersion) continue
        // Normal detach closes Finder's volume window too. If copying or any
        // other process keeps it busy, leave it mounted; never force an eject.
        await command('/usr/bin/hdiutil', ['detach', mount])
      } catch (error) { logError('app.installImage.eject', error) }
    }
  } catch (error) { logError('app.installImage.inspect', error) }
}
