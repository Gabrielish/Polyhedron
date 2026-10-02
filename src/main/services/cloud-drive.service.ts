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
import { cleanupTempDir, createTempDir } from '../utils/tempDir'
import { parseLocalizationXml } from './xml-parser.service'
import { projectPath, WORKSPACE_FILE_NAME } from '../utils/app-paths'

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
const CLOUD_FILE_NAME = WORKSPACE_FILE_NAME
const LEGACY_CLOUD_FILE_NAME = 'icosa-workspace.icws'
const PWA_SYNC_FILE_NAME = 'polyhedron-workspace-sync.json'
const TERM_GLOSSARY_FILE_NAME = 'polyhedron-term-glossary.json'

export type CloudTermGlossaryEntry = { id: string; source: string; translation: string }
export type CloudAccount = {
  connected: boolean
  displayName?: string
  emailAddress?: string
  photoLink?: string
  photoDataUrl?: string
}
type CloudTermGlossaryDocument = {
  version: 1
  glossaries: Record<string, CloudTermGlossaryEntry[]>
}

type PwaSyncEntry = {
  uid: string
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
    const sessionKey = `${row.lastFilePath}|${sourceLang}|${targetLang}`
    const savedPath = path.join(
      sessionsDir,
      `${crypto.createHash('sha256').update(sessionKey).digest('hex')}.json`
    )
    let savedEntries: SavedSessionEntry[] | null = null
    if (fs.existsSync(savedPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(savedPath, 'utf8')) as {
          entries?: SavedSessionEntry[]
        }
        if (Array.isArray(parsed.entries) && parsed.entries.length > 0) {
          savedEntries = parsed.entries
        }
      } catch {
        /* Ignore an incomplete session cache. */
      }
    }

    // Session JSON already contains the complete UID/translation snapshot. Avoid
    // reparsing the source XML on every upload; only fall back to XML when a
    // session cache is missing or incomplete.
    const sourceEntries = savedEntries
      ? savedEntries
      : (() => {
          try {
            return parseLocalizationXml(row.lastFilePath!).map((xmlEntry) => ({
              uid: xmlEntry.contentuid,
              target: '',
              matchType: 'none' as const,
              needsReview: false
            }))
          } catch {
            return []
          }
        })()
    const entries = sourceEntries.map((saved) => {
      const entry: PwaSyncEntry = {
        uid: saved.uid ?? '',
        target: saved.target ?? '',
        genderTargets: saved.genderTargets,
        matchType: saved.matchType ?? 'none',
        needsReview: saved.needsReview === true,
        reviewStatus: saved.reviewStatus,
        history: saved.history
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

async function getDriveAccount(): Promise<CloudAccount> {
  const drive = google.drive({ version: 'v3', auth: await getAuth() })
  const response = await drive.about.get({ fields: 'user(displayName,emailAddress,photoLink)' })
  const user = response.data.user
  let photoDataUrl: string | undefined
  if (user?.photoLink) {
    try {
      const photoResponse = await fetch(user.photoLink)
      const contentType = photoResponse.headers.get('content-type') ?? 'image/jpeg'
      if (photoResponse.ok && contentType.startsWith('image/')) {
        const photo = Buffer.from(await photoResponse.arrayBuffer())
        if (photo.length <= 1024 * 1024) {
          photoDataUrl = `data:${contentType};base64,${photo.toString('base64')}`
        }
      }
    } catch {
      /* The account remains usable when Google's avatar is unavailable. */
    }
  }
  return {
    connected: true,
    displayName: user?.displayName ?? undefined,
    emailAddress: user?.emailAddress ?? undefined,
    photoLink: user?.photoLink ?? undefined,
    photoDataUrl
  }
}

export async function getCloudAccount(): Promise<CloudAccount> {
  if (!fs.existsSync(tokenPath())) return { connected: false }
  try {
    return await getDriveAccount()
  } catch {
    return { connected: false }
  }
}

export async function connectCloudAccount(): Promise<CloudAccount> {
  return getDriveAccount()
}

export function disconnectCloudAccount(): { connected: false } {
  fs.rmSync(tokenPath(), { force: true })
  return { connected: false }
}

async function findWorkspaceFile(drive: drive_v3.Drive): Promise<drive_v3.Schema$File | null> {
  const result = await drive.files.list({
    q: `(name = '${CLOUD_FILE_NAME}' or name = '${LEGACY_CLOUD_FILE_NAME}') and trashed = false`,
    fields: 'files(id,name,modifiedTime,description)',
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

export async function getCloudWorkspaceStatus(): Promise<{
  modifiedTime: string | null
  translated: number | null
  total: number | null
  fingerprint: string | null
}> {
  const drive = google.drive({ version: 'v3', auth: await getAuth() })
  const file = await findWorkspaceFile(drive)
  if (!file) return { modifiedTime: null, translated: null, total: null, fingerprint: null }
  try {
    const metadata = JSON.parse(file.description ?? '') as {
      translated?: unknown
      total?: unknown
      fingerprint?: unknown
    }
    if (typeof metadata.translated !== 'number' || typeof metadata.total !== 'number') {
      throw new Error('Workspace description has no sync statistics')
    }
    return {
      modifiedTime: file.modifiedTime ?? null,
      translated: metadata.translated,
      total: metadata.total,
      fingerprint: typeof metadata.fingerprint === 'string' ? metadata.fingerprint : null
    }
  } catch {
    // Older workspace files do not have Drive description metadata yet. Fall
    // back to the sync document so autosync can still protect against a
    // downgrade on another machine before the next manual upload.
    const syncFile = await drive.files.list({
      q: `name = '${PWA_SYNC_FILE_NAME}' and trashed = false`,
      fields: 'files(id)',
      spaces: 'drive',
      pageSize: 1
    })
    const syncFileId = syncFile.data.files?.[0]?.id
    if (!syncFileId) return { modifiedTime: file.modifiedTime ?? null, translated: null, total: null, fingerprint: null }
    try {
      const response = await drive.files.get({ fileId: syncFileId, alt: 'media' }, { responseType: 'json' })
      const document = response.data as {
        sessions?: Array<{ entries?: Array<{ target?: string }> }>
      }
      const entries = (document.sessions ?? []).flatMap((session) => session.entries ?? [])
      return {
        modifiedTime: file.modifiedTime ?? null,
        translated: entries.filter((entry) => Boolean(entry.target?.trim())).length,
        total: entries.length,
        fingerprint: null
      }
    } catch {
      return { modifiedTime: file.modifiedTime ?? null, translated: null, total: null, fingerprint: null }
    }
  }
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
  if (existing?.id) {
    await drive.files.update({
      fileId: existing.id,
      requestBody: {
        name: PWA_SYNC_FILE_NAME,
        description: JSON.stringify({ version: 1, generatedAt: document.generatedAt }),
        modifiedTime: document.generatedAt
      },
      media,
      fields: 'id,name,modifiedTime'
    })
  }
  else
    await drive.files.create({
      requestBody: {
        name: PWA_SYNC_FILE_NAME,
        mimeType: 'application/json',
        description: JSON.stringify({ version: 1, generatedAt: document.generatedAt })
      },
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

function getTermGlossaryIdentity(key: string): string | undefined {
  const rawKey = key.replace(/^polyhedron\.term-glossary:/, '')
  const parts = rawKey.split('|')
  if (parts.length < 3) return undefined

  const sourceLang = parts.at(-2)
  const targetLang = parts.at(-1)
  const filePath = normalizeTermGlossaryKey(parts.slice(0, -2).join('|')).toLowerCase()
  const modsMarker = '/mods/'
  const modRelativePath = filePath.includes(modsMarker)
    ? filePath.slice(filePath.lastIndexOf(modsMarker) + modsMarker.length)
    : filePath.split('/').slice(-2).join('/')

  return `${modRelativePath}|${sourceLang}|${targetLang}`
}

function resolveTermGlossaryEntries(
  document: CloudTermGlossaryDocument,
  glossaryKey: string
): CloudTermGlossaryEntry[] | undefined {
  const exact = document.glossaries[glossaryKey]
  const normalizedKey = normalizeTermGlossaryKey(glossaryKey)
  const legacy = Object.entries(document.glossaries).find(
    ([key, entries]) => entries.length > 0 && normalizeTermGlossaryKey(key) === normalizedKey
  )
  // Cloud glossary keys created on another machine contain that machine's
  // absolute path. Match the stable part after `/mods/` instead.
  const identity = getTermGlossaryIdentity(glossaryKey)
  if (!identity) return exact
  const matchingDocuments = Object.entries(document.glossaries).filter(
    ([key, entries]) => entries.length > 0 && getTermGlossaryIdentity(key) === identity
  )
  if (matchingDocuments.length === 0) return legacy?.[1] ?? exact

  // Older Drive files may contain both the old Icosa key and the newer
  // Polyhedron key. Merge them so no terms are hidden by the migration.
  const merged = new Map<string, CloudTermGlossaryEntry>()
  for (const [, entries] of matchingDocuments) {
    for (const entry of entries) {
      if (!entry?.source || typeof entry.translation !== 'string') continue
      merged.set(entry.source.trim().toLocaleLowerCase(), entry)
    }
  }
  return [...merged.values()]
}

async function applyPwaSyncFromDrive(
  drive: drive_v3.Drive
): Promise<{ translated: number; total: number } | undefined> {
  const result = await drive.files.list({
    q: `name = '${PWA_SYNC_FILE_NAME}' and trashed = false`,
    fields: 'files(id)',
    spaces: 'drive',
    pageSize: 1
  })
  const fileId = result.data.files?.[0]?.id
  if (!fileId) return undefined
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
  if (document.version !== 1 || !Array.isArray(document.sessions)) return undefined
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

  const entries = document.sessions.flatMap((session) => session.entries ?? [])
  return {
    total: entries.length,
    translated: entries.filter((entry) => Boolean(entry.target?.trim())).length
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
          requestBody: {
            name: CLOUD_FILE_NAME,
            description: JSON.stringify({ version: 1, ...stats })
          },
          media,
          fields: 'id,name,modifiedTime'
        })
      : await drive.files.create({
          requestBody: {
            name: CLOUD_FILE_NAME,
            mimeType: 'application/octet-stream',
            description: JSON.stringify({ version: 1, ...stats })
          },
          media,
          fields: 'id,name,modifiedTime'
        })
    const pwaSyncUpload = uploadPwaSyncFile(drive, buildPwaSyncDocument())
    const glossaryUpload = termGlossary
      ? uploadTermGlossaryFile(drive, termGlossary)
      : Promise.resolve()
    await Promise.all([pwaSyncUpload, glossaryUpload])
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
  _sessionKey?: string,
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
    const importedWorkspace = await importWorkspace(workspacePath)
    const syncStats = await applyPwaSyncFromDrive(drive)
    const termGlossary = await downloadTermGlossaryFile(drive, termGlossaryKey)
    // The archive may have been created on another machine, where the session
    // hash contains a different absolute file path. The sync file is the fast,
    // authoritative source for the confirmation stats. Fall back to the stats
    // already calculated by importWorkspace for older workspaces.
    return {
      fileName: CLOUD_FILE_NAME,
      restartRequired: true,
      stats: syncStats
        ? { ...syncStats, fingerprint: '' }
        : importedWorkspace.stats,
      termGlossary
    }
  } finally {
    cleanupTempDir(tempDir)
  }
}
