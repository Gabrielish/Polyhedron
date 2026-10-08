export const releasesRepo = 'https://github.com/Gabrielish/Polyhedron'

interface ReleaseAsset {
  name: string
  browser_download_url: string
  download_count?: number
  digest?: string | null
}
interface GitHubRelease {
  tag_name: string
  assets: ReleaseAsset[]
}
export interface ReleaseDownload {
  url: string
  downloads?: number
  digest?: string | null
}
export function virusTotalReport(download?: ReleaseDownload): string | undefined {
  const hash = typeof download?.digest === 'string' ? /^sha256:([a-f0-9]{64})$/i.exec(download.digest)?.[1] : undefined
  return hash ? `https://www.virustotal.com/gui/file/${hash.toLowerCase()}` : undefined
}
export function releaseDownloads(data: GitHubRelease): {
  version: string
  windows?: ReleaseDownload
  mac?: ReleaseDownload
} {
  const find = (pattern: RegExp): ReleaseDownload | undefined => {
    const item = data.assets.find(asset => pattern.test(asset.name) && asset.browser_download_url.startsWith(`${releasesRepo}/releases/download/`))
    if (!item) return undefined
    return {
      url: item.browser_download_url,
      downloads: typeof item.download_count === 'number' && Number.isSafeInteger(item.download_count) && item.download_count >= 0 ? item.download_count : undefined,
      digest: item.digest
    }
  }
  return { version: data.tag_name, windows: find(/windows.*setup\.exe$/i), mac: find(/arm64\.dmg$/i) }
}
