import path from 'node:path'
import { Worker } from 'node:worker_threads'
import type { RepositoryRegistry } from '../database/repositories/registry'
import { databasePath } from '../utils/app-paths'
import { toBg3LanguageFolder } from '../utils/languages'
import type {
  XmlEntry,
  XmlLoadProgress,
  XmlLoadResult,
  XmlLoadWorkerInput
} from '../workers/xml-load.worker.runtime'

export type { XmlEntry, XmlLoadResult }

export type XmlLoadProgressUpdate = Exclude<XmlLoadProgress, { phase: 'done' } | { phase: 'error' }>

export interface LoadXmlParams {
  inputPath: string
  sourceLang: string
  targetLang: string
  modName?: string
  repos: RepositoryRegistry
  onProgress?: (p: XmlLoadProgressUpdate) => void
}

function languageFolder(repos: RepositoryRegistry, languageCode: string): string {
  const lang = repos.language.findByCode(languageCode)
  return toBg3LanguageFolder(languageCode, lang?.name)
}

function getDbPath(): string {
  return databasePath()
}

export function loadXmlViaWorker(params: LoadXmlParams): Promise<XmlLoadResult> {
  const { repos, onProgress, ...rest } = params
  const sourceFolder = languageFolder(repos, rest.sourceLang)
  const input: XmlLoadWorkerInput = { ...rest, sourceFolder, dbPath: getDbPath() }

  return new Promise<XmlLoadResult>((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'xml-load.worker.js'), { workerData: input })

    worker.on('message', (msg: XmlLoadProgress) => {
      if (msg.phase === 'done') {
        resolve(msg.result)
        return
      }
      if (msg.phase === 'error') {
        reject(new Error(msg.message))
        return
      }
      onProgress?.(msg)
    })

    worker.on('error', reject)
    worker.on('exit', (code) => {
      if (code !== 0) reject(new Error(`xml-load worker exited with code ${code}`))
    })
  })
}
