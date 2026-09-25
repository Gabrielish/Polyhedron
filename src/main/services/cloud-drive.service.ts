import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import { google } from 'googleapis'
import { authenticate } from '@google-cloud/local-auth'
import type { drive_v3 } from 'googleapis'
import { getDb } from '../database/connection'
import { config, mod } from '../database/schema'
import {
  exportWorkspace,
  getWorkspaceTranslationStats,
  importWorkspace,
  type WorkspaceTranslationStats
} from './workspace.service'
import { extractZip } from './zip.service'
import { cleanupTempDir, createTempDir } from '../utils/tempDir'
import { parseLocalizationXml } from './xml-parser.service'
import { projectPath, WORKSPACE_FILE_NAME } from '../utils/app-paths'

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
const CLOUD_FILE_NAME = WORKSPACE_FILE_NAME
const LEGACY_CLOUD_FILE_NAME = 'icosa-workspace.icws'
const PWA_SYNC_FILE_NAME = 'polyhedron-workspace-sync.json'
const TERM_GLOSSARY_FILE_NAME = 'polyhedron-term-glossary.json'

export type CloudTermGlossaryEntry = { id: string; source: string; translation: string }
type CloudTermGlossaryDocument = {
  version: 1
  glossaries: Record<string, CloudTermGlossaryEntry[]>
}

type PwaSyncEntry = {
  uid: string
  source: string
  target: string
  genderTargets?: Partial<Record<'default' | 'female' | 'neutral', string>>
  matchType: 'none' | 'mod-text' | 'text' | 'manual'
  needsReview: boolean
  reviewStatus?: 'untranslated' | 'not-verified' | 'needs-review' | 'verified'
  history?: Array<Record<string, unknown>>
}

type SavedSessionEntry = {
  uid?: string
  target?: string
  genderTargets?: PwaSyncEntry['genderTargets']
  matchType?: PwaSyncEntry['matchType']
  needsReview?: boolean
  reviewStatus?: PwaSyncEntry['reviewStatus']
  history?: PwaSyncEntry['history']
}

function buildPwaSyncDocument() {
  const db = getDb()
  const configRows = db.select().from(config).all() as Array<{ key: string; value: string | null }>
  const settings = new Map(configRows.map((row) => [row.key, row.value ?? '']))
  const sourceLang = settings.get('last_source_lang') || 'en'
  const targetLang = settings.get('last_target_lang') || 'ro'
  const sessionsDir = projectPath('sessions')
  const sessions: Array<{
    id: string
    modName: string
    sourceLang: string
    targetLang: string
    updatedAt: string
    entries: PwaSyncEntry[]
  }> = []
  let hash = 2166136261

  for (const row of db.select().from(mod).all() as Array<{
    name: string
    lastFilePath: string | null
    updatedAt: string | null
  }>) {
    if (!row.lastFilePath || !fs.existsSync(row.lastFilePath)) continue
    let xmlEntries: Array<{ contentuid: string; text: string }>
    try {
      xmlEntries = parseLocalizationXml(row.lastFilePath)
    } catch {
      continue
    }
    const sessionKey = `${row.lastFilePath}|${sourceLang}|${targetLang}`
    const savedPath = path.join(
      sessionsDir,
      `${crypto.createHash('sha256').update(sessionKey).digest('hex')}.json`
    )
    let savedByUid = new Map<string, SavedSessionEntry>()
    if (fs.existsSync(savedPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(savedPath, 'utf8')) as {
          entries?: SavedSessionEntry[]
        }
        savedByUid = new Map((parsed.entries ?? []).map((entry) => [entry.uid ?? '', entry]))
      } catch {
        /* Ignore an incomplete session cache. */
      }
    }
    const entries = xmlEntries.map((xmlEntry) => {
      const saved = savedByUid.get(xmlEntry.contentuid)
      const entry: PwaSyncEntry = {
        uid: xmlEntry.contentuid,
        source: xmlEntry.text,
        target: saved?.target ?? '',
        genderTargets: saved?.genderTargets,
        matchType: saved?.matchType ?? 'none',
        needsReview: saved?.needsReview === true,
        reviewStatus: saved?.reviewStatus,
        history: saved?.history
      }
      const value = `${entry.uid}\u0000${entry.target}`
      for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index)
        hash = Math.imul(hash, 16777619)
      }
      return entry
    })
    sessions.push({
      id: sessionKey,
      modName: row.name,
      sourceLang,
      targetLang,
      updatedAt: row.updatedAt ?? new Date().toISOString(),
      entries
    })
  }

  return {
    version: 1 as const,
    generatedAt: new Date().toISOString(),
    fingerprint: (hash >>> 0).toString(16),
    sessions
  }
}

function credentialsPath(): string {
  const candidates = [
    path.join(app.getPath('userData'), 'google-drive-credentials.json'),
    path.join(process.resourcesPath, 'tools', 'google-drive', 'google-drive-credentials.json'),
    path.join(app.getAppPath(), 'tools', 'google-drive', 'google-drive-credentials.json')
  ]
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0]
}

function tokenPath(): string {
  return projectPath('google-drive-token.json')
}

async function getAuth() {
  const keyfilePath = credentialsPath()
  if (!fs.existsSync(keyfilePath)) {
    throw new Error(
      `Google Drive credentials are missing. Add google-drive-credentials.json to ${path.dirname(keyfilePath)}.`
    )
  }

  const installed = JSON.parse(fs.readFileSync(keyfilePath, 'utf8')) as {
    installed?: { client_id?: string; client_secret?: string }
  }
  const clientId = installed.installed?.client_id
  const clientSecret = installed.installed?.client_secret
  if (!clientId || !clientSecret) throw new Error('Google Drive credentials are incomplete.')

  const savedTokenPath = tokenPath()
  if (fs.existsSync(savedTokenPath)) {
    const credentials = JSON.parse(fs.readFileSync(savedTokenPath, 'utf8')) as {
      type?: string
      client_id?: string
      client_secret?: string
      refresh_token?: string
    }
    const auth = new google.auth.OAuth2(clientId, clientSecret)
    auth.setCredentials({ refresh_token: credentials.refresh_token })
    try {
      await auth.getAccessToken()
      return auth
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (!/invalid_grant|invalid credentials|unauthorized/i.test(message)) throw error
      // Refresh tokens can be revoked or expire. Remove the stale token so the
      // next authentication transparently opens the Google consent flow again.
      fs.rmSync(savedTokenPath, { force: true })
    }
  }

  const authenticated = await authenticate({ keyfilePath, scopes: [DRIVE_SCOPE] })
  const auth = new google.auth.OAuth2(clientId, clientSecret)
  auth.setCredentials({ refresh_token: authenticated.credentials.refresh_token })
  fs.mkdirSync(path.dirname(savedTokenPath), { recursive: true })
  fs.writeFileSync(
    savedTokenPath,
    JSON.stringify({
      type: 'authorized_user',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: auth.credentials.refresh_token
    }),
    { encoding: 'utf8', mode: 0o600 }
  )
  return auth
}

async function findWorkspaceFile(drive: drive_v3.Drive): Promise<drive_v3.Schema$File | null> {
  const result = await drive.files.list({
    q: `(name = '${CLOUD_FILE_NAME}' or name = '${LEGACY_CLOUD_FILE_NAME}') and trashed = false`,
    fields: 'files(id,name,modifiedTime)',
    spaces: 'drive',
    pageSize: 10
  })
  const files = result.data.files ?? []
  return files.find((file) => file.name === CLOUD_FILE_NAME) ?? files[0] ?? null
}

export async function getPwaSyncModifiedTime(): Promise<string | null> {
  const drive = google.drive({ version: 'v3', auth: await getAuth() })
  const result = await drive.files.list({
    q: `name = '${PWA_SYNC_FILE_NAME}' and trashed = false`,
    fields: 'files(modifiedTime)',
    spaces: 'drive',
    pageSize: 1
  })
  return result.data.files?.[0]?.modifiedTime ?? null
}

async function uploadPwaSyncFile(
  drive: drive_v3.Drive,
  document: ReturnType<typeof buildPwaSyncDocument>
): Promise<void> {
  const result = await drive.files.list({
    q: `name = '${PWA_SYNC_FILE_NAME}' and trashed = false`,
    fields: 'files(id)',
    spaces: 'drive',
    pageSize: 1
  })
  const existing = result.data.files?.[0]
  const media = { mimeType: 'application/json', body: JSON.stringify(document) }
  if (existing?.id) await drive.files.update({ fileId: existing.id, media })
  else
    await drive.files.create({
      requestBody: { name: PWA_SYNC_FILE_NAME, mimeType: 'application/json' },
      media
    })
}

async function readTermGlossaryDocument(
  drive: drive_v3.Drive
): Promise<{ fileId?: string; document: CloudTermGlossaryDocument }> {
  const result = await drive.files.list({
    q: `name = '${TERM_GLOSSARY_FILE_NAME}' and trashed = false`,
    fields: 'files(id)',
    spaces: 'drive',
    pageSize: 1
  })
  const fileId = result.data.files?.[0]?.id ?? undefined
  if (!fileId) return { document: { version: 1, glossaries: {} } }
  try {
    const response = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'json' })
    const value = response.data as Partial<CloudTermGlossaryDocument>
    if (value.version === 1 && value.glossaries && typeof value.glossaries === 'object') {
      return {
        fileId,
        document: {
          version: 1,
          glossaries: value.glossaries as Record<string, CloudTermGlossaryEntry[]>
        }
      }
    }
  } catch {
    // Rebuild the document if the existing file is empty or malformed.
  }
  return { fileId, document: { version: 1, glossaries: {} } }
}

async function uploadTermGlossaryFile(
  drive: drive_v3.Drive,
  glossary: { key: string; entries: CloudTermGlossaryEntry[] }
): Promise<void> {
  const { fileId, document } = await readTermGlossaryDocument(drive)
  const existingEntries = resolveTermGlossaryEntries(document, glossary.key)
  // A migrated Polyhedron profile can still load an empty new key while the
  // user's real glossary is stored under the legacy Icosa path. Preserve that
  // data instead of replacing it with an empty array during upload.
  document.glossaries[glossary.key] =
    glossary.entries.length > 0 ? glossary.entries : (existingEntries ?? [])
  const media = { mimeType: 'application/json', body: JSON.stringify(document) }
  if (fileId) await drive.files.update({ fileId, media })
  else
    await drive.files.create({
      requestBody: { name: TERM_GLOSSARY_FILE_NAME, mimeType: 'application/json' },
      media
    })
}

async function downloadTermGlossaryFile(
  drive: drive_v3.Drive,
  glossaryKey?: string
): Promise<CloudTermGlossaryEntry[] | undefined> {
  if (!glossaryKey) return undefined
  const { document } = await readTermGlossaryDocument(drive)
  return resolveTermGlossaryEntries(document, glossaryKey)
}

function normalizeTermGlossaryKey(key: string): string {
  return key
    .replaceAll('\\', '/')
    .replace(/\/Application Support\/icosa\/icosa\//gi, '/Application Support/polyhedron/')
    .replace(/\/Application Support\/icosa\//gi, '/Application Support/polyhedron/')
}

function resolveTermGlossaryEntries(
  document: CloudTermGlossaryDocument,
  glossaryKey: string
): CloudTermGlossaryEntry[] | undefined {
  const exact = document.glossaries[glossaryKey]
  if (exact && exact.length > 0) return exact
  const normalizedKey = normalizeTermGlossaryKey(glossaryKey)
  const legacy = Object.entries(document.glossaries).find(
    ([key, entries]) => entries.length > 0 && normalizeTermGlossaryKey(key) === normalizedKey
  )
  // An empty Polyhedron key can be left behind by the rename migration while
  // the populated legacy key still exists. Prefer the migrated data in that
  // case; only fall back to the exact key when no legacy match was found.
  return legacy?.[1] ?? exact
}

async function applyPwaSyncFromDrive(drive: drive_v3.Drive): Promise<void> {
  const result = await drive.files.list({
    q: `name = '${PWA_SYNC_FILE_NAME}' and trashed = false`,
    fields: 'files(id)',
    spaces: 'drive',
    pageSize: 1
  })
  const fileId = result.data.files?.[0]?.id
  if (!fileId) return
  const response = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'json' })
  const document = response.data as {
    version?: number
    sessions?: Array<{
      id?: string
      modName?: string
      sourceLang?: string
      targetLang?: string
      entries?: Array<{
        uid?: string
        source?: string
        target?: string
        genderTargets?: PwaSyncEntry['genderTargets']
        matchType?: PwaSyncEntry['matchType']
        needsReview?: boolean
        reviewStatus?: 'not-verified' | 'needs-review' | 'verified'
        history?: PwaSyncEntry['history']
      }>
    }>
  }
  if (document.version !== 1 || !Array.isArray(document.sessions)) return
  const sessionsDir = projectPath('sessions')
  fs.mkdirSync(sessionsDir, { recursive: true })
  // The sync document may have been created on another machine, so its
  // session id can contain a foreign absolute file path. Resolve it against
  // the freshly imported local mod record instead of hashing that path.
  const localMods = dbModRows()
  for (const session of document.sessions) {
    if (!session.sourceLang || !session.targetLang || !Array.isArray(session.entries)) continue
    const persistedEntries = session.entries
      .filter((entry) => entry.uid)
      .map((entry) => ({
        uid: entry.uid!,
        target: entry.target ?? '',
        genderTargets: entry.genderTargets,
        matchType: entry.matchType ?? 'none',
        needsReview: entry.needsReview === true,
        reviewStatus: entry.reviewStatus,
        history: entry.history
      }))
    if (session.id && persistedEntries.length > 0) {
      const localMod = localMods.find((modRow) => modRow.name === session.modName)
      const localSessionKey = localMod?.lastFilePath
        ? `${localMod.lastFilePath}|${session.sourceLang}|${session.targetLang}`
        : session.id
      const sessionPath = path.join(
        sessionsDir,
        `${crypto.createHash('sha256').update(localSessionKey).digest('hex')}.json`
      )
      let existingEntries: typeof persistedEntries = []
      if (fs.existsSync(sessionPath)) {
        try {
          existingEntries =
            (
              JSON.parse(fs.readFileSync(sessionPath, 'utf8')) as {
                entries?: typeof persistedEntries
              }
            ).entries ?? []
        } catch {
          /* Rebuild an incomplete cache. */
        }
      }
      const byUid = new Map(existingEntries.map((entry) => [entry.uid, entry]))
      for (const entry of persistedEntries) byUid.set(entry.uid, entry)
      fs.writeFileSync(
        sessionPath,
        JSON.stringify({ version: 1, entries: [...byUid.values()] }),
        'utf8'
      )
    }
  }
}

function dbModRows(): Array<{ name: string; lastFilePath: string | null }> {
  return getDb().select().from(mod).all() as Array<{ name: string; lastFilePath: string | null }>
}

export async function uploadWorkspaceToDrive(
  sessionKey?: string,
  termGlossary?: { key: string; entries: CloudTermGlossaryEntry[] }
): Promise<{ fileName: string; modifiedTime?: string; stats: WorkspaceTranslationStats }> {
  const auth = await getAuth()
  const drive = google.drive({ version: 'v3', auth })
  const existing = await findWorkspaceFile(drive)
  const stats = getWorkspaceTranslationStats(projectPath('sessions'), sessionKey)
  const tempDir = createTempDir('polyhedron_cloud_upload')
  const workspacePath = path.join(tempDir, CLOUD_FILE_NAME)

  try {
    await exportWorkspace(workspacePath)
    const media = { mimeType: 'application/octet-stream', body: fs.createReadStream(workspacePath) }
    const response = existing?.id
      ? await drive.files.update({
          fileId: existing.id,
          requestBody: { name: CLOUD_FILE_NAME },
          media,
          fields: 'id,name,modifiedTime'
        })
      : await drive.files.create({
          requestBody: { name: CLOUD_FILE_NAME, mimeType: 'application/octet-stream' },
          media,
          fields: 'id,name,modifiedTime'
        })
    await uploadPwaSyncFile(drive, buildPwaSyncDocument())
    if (termGlossary) await uploadTermGlossaryFile(drive, termGlossary)
    return {
      fileName: response.data.name ?? CLOUD_FILE_NAME,
      modifiedTime: response.data.modifiedTime ?? undefined,
      stats
    }
  } finally {
    cleanupTempDir(tempDir)
  }
}

export async function downloadWorkspaceFromDrive(
  sessionKey?: string,
  termGlossaryKey?: string
): Promise<{
  fileName: string
  restartRequired: boolean
  stats: WorkspaceTranslationStats
  termGlossary?: CloudTermGlossaryEntry[]
}> {
  const auth = await getAuth()
  const drive = google.drive({ version: 'v3', auth })
  const cloudFile = await findWorkspaceFile(drive)
  if (!cloudFile?.id) throw new Error(`No ${CLOUD_FILE_NAME} file was found in Google Drive.`)

  const tempDir = createTempDir('polyhedron_cloud_download')
  const workspacePath = path.join(tempDir, CLOUD_FILE_NAME)
  try {
    fs.mkdirSync(tempDir, { recursive: true })
    const response = await drive.files.get(
      { fileId: cloudFile.id, alt: 'media' },
      { responseType: 'stream' }
    )
    const output = fs.createWriteStream(workspacePath)
    await new Promise<void>((resolve, reject) => {
      response.data.pipe(output)
      response.data.on('error', reject)
      output.on('finish', resolve)
      output.on('error', reject)
    })
    const extractedDir = path.join(tempDir, 'extracted')
    extractZip(workspacePath, extractedDir)
    const stats = getWorkspaceTranslationStats(path.join(extractedDir, 'sessions'), sessionKey)
    await importWorkspace(workspacePath)
    await applyPwaSyncFromDrive(drive)
    const termGlossary = await downloadTermGlossaryFile(drive, termGlossaryKey)
    return { fileName: CLOUD_FILE_NAME, restartRequired: true, stats, termGlossary }
  } finally {
    cleanupTempDir(tempDir)
  }
}
