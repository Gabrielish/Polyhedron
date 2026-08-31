import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import { google } from 'googleapis'
import { authenticate } from '@google-cloud/local-auth'
import type { drive_v3 } from 'googleapis'
import { getDb } from '../database/connection'
import { config, mod } from '../database/schema'
import { exportWorkspace, getWorkspaceTranslationStats, importWorkspace, type WorkspaceTranslationStats } from './workspace.service'
import { extractZip } from './zip.service'
import { cleanupTempDir, createTempDir } from '../utils/tempDir'
import { parseLocalizationXml } from './xml-parser.service'

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
const CLOUD_FILE_NAME = 'icosa-workspace.icws'
const PWA_SYNC_FILE_NAME = 'polyhedron-workspace-sync.json'

type PwaSyncEntry = { uid: string; source: string; target: string; genderTargets?: Partial<Record<'default' | 'female' | 'neutral', string>>; matchType: 'none' | 'mod-text' | 'text' | 'manual'; needsReview: boolean }

type SavedSessionEntry = { uid?: string; target?: string; genderTargets?: PwaSyncEntry['genderTargets']; matchType?: PwaSyncEntry['matchType']; needsReview?: boolean }

function buildPwaSyncDocument() {
  const db = getDb()
  const configRows = db.select().from(config).all() as Array<{ key: string; value: string | null }>
  const settings = new Map(configRows.map((row) => [row.key, row.value ?? '']))
  const sourceLang = settings.get('last_source_lang') || 'en'
  const targetLang = settings.get('last_target_lang') || 'ro'
  const sessionsDir = path.join(app.getPath('userData'), 'icosa', 'sessions')
  const sessions: Array<{ id: string; modName: string; sourceLang: string; targetLang: string; updatedAt: string; entries: PwaSyncEntry[] }> = []
  let hash = 2166136261

  for (const row of db.select().from(mod).all() as Array<{ name: string; lastFilePath: string | null; updatedAt: string | null }>) {
    if (!row.lastFilePath || !fs.existsSync(row.lastFilePath)) continue
    let xmlEntries: Array<{ contentuid: string; text: string }>
    try { xmlEntries = parseLocalizationXml(row.lastFilePath) } catch { continue }
    const sessionKey = `${row.lastFilePath}|${sourceLang}|${targetLang}`
    const savedPath = path.join(sessionsDir, `${crypto.createHash('sha256').update(sessionKey).digest('hex')}.json`)
    let savedByUid = new Map<string, SavedSessionEntry>()
    if (fs.existsSync(savedPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(savedPath, 'utf8')) as { entries?: SavedSessionEntry[] }
        savedByUid = new Map((parsed.entries ?? []).map((entry) => [entry.uid ?? '', entry]))
      } catch { /* Ignore an incomplete session cache. */ }
    }
    const entries = xmlEntries.map((xmlEntry) => {
      const saved = savedByUid.get(xmlEntry.contentuid)
      const entry: PwaSyncEntry = { uid: xmlEntry.contentuid, source: xmlEntry.text, target: saved?.target ?? '', genderTargets: saved?.genderTargets, matchType: saved?.matchType ?? 'none', needsReview: saved?.needsReview === true }
      const value = `${entry.uid}\u0000${entry.target}`
      for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619) }
      return entry
    })
    sessions.push({ id: sessionKey, modName: row.name, sourceLang, targetLang, updatedAt: row.updatedAt ?? new Date().toISOString(), entries })
  }

  return { version: 1 as const, generatedAt: new Date().toISOString(), fingerprint: (hash >>> 0).toString(16), sessions }
}


function credentialsPath(): string {
  const candidates = [
    path.join(app.getPath('userData'), 'google-drive-credentials.json'),
    path.join(app.getPath('userData'), 'icosa', 'google-drive-credentials.json'),
    path.join(process.resourcesPath, 'tools', 'google-drive', 'google-drive-credentials.json'),
    path.join(app.getAppPath(), 'tools', 'google-drive', 'google-drive-credentials.json')
  ]
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0]
}

function tokenPath(): string {
  return path.join(app.getPath('userData'), 'icosa', 'google-drive-token.json')
}

async function getAuth() {
  const keyfilePath = credentialsPath()
  if (!fs.existsSync(keyfilePath)) {
    throw new Error(`Google Drive credentials are missing. Add google-drive-credentials.json to ${path.dirname(keyfilePath)}.`)
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
    q: `name = '${CLOUD_FILE_NAME}' and trashed = false`,
    fields: 'files(id,name,modifiedTime)',
    spaces: 'drive',
    pageSize: 10
  })
  return result.data.files?.[0] ?? null
}

export async function getPwaSyncModifiedTime(): Promise<string | null> {
  const drive = google.drive({ version: 'v3', auth: await getAuth() })
  const result = await drive.files.list({ q: `name = '${PWA_SYNC_FILE_NAME}' and trashed = false`, fields: 'files(modifiedTime)', spaces: 'drive', pageSize: 1 })
  return result.data.files?.[0]?.modifiedTime ?? null
}

async function uploadPwaSyncFile(drive: drive_v3.Drive, document: ReturnType<typeof buildPwaSyncDocument>): Promise<void> {
  const result = await drive.files.list({ q: `name = '${PWA_SYNC_FILE_NAME}' and trashed = false`, fields: 'files(id)', spaces: 'drive', pageSize: 1 })
  const existing = result.data.files?.[0]
  const media = { mimeType: 'application/json', body: JSON.stringify(document) }
  if (existing?.id) await drive.files.update({ fileId: existing.id, media })
  else await drive.files.create({ requestBody: { name: PWA_SYNC_FILE_NAME, mimeType: 'application/json' }, media })
}

async function applyPwaSyncFromDrive(drive: drive_v3.Drive): Promise<void> {
  const result = await drive.files.list({ q: `name = '${PWA_SYNC_FILE_NAME}' and trashed = false`, fields: 'files(id)', spaces: 'drive', pageSize: 1 })
  const fileId = result.data.files?.[0]?.id
  if (!fileId) return
  const response = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'json' })
  const document = response.data as { version?: number; sessions?: Array<{ id?: string; modName?: string; sourceLang?: string; targetLang?: string; entries?: Array<{ uid?: string; source?: string; target?: string; genderTargets?: PwaSyncEntry['genderTargets']; matchType?: PwaSyncEntry['matchType']; needsReview?: boolean }> }> }
  if (document.version !== 1 || !Array.isArray(document.sessions)) return
  const sessionsDir = path.join(app.getPath('userData'), 'icosa', 'sessions')
  fs.mkdirSync(sessionsDir, { recursive: true })
  for (const session of document.sessions) {
    if (!session.sourceLang || !session.targetLang || !Array.isArray(session.entries)) continue
    const persistedEntries = session.entries.filter((entry) => entry.uid).map((entry) => ({ uid: entry.uid!, target: entry.target ?? '', genderTargets: entry.genderTargets, matchType: entry.matchType ?? 'none', needsReview: entry.needsReview === true }))
    if (session.id && persistedEntries.length > 0) {
      const sessionPath = path.join(sessionsDir, `${crypto.createHash('sha256').update(session.id).digest('hex')}.json`)
      let existingEntries: typeof persistedEntries = []
      if (fs.existsSync(sessionPath)) {
        try { existingEntries = (JSON.parse(fs.readFileSync(sessionPath, 'utf8')) as { entries?: typeof persistedEntries }).entries ?? [] } catch { /* Rebuild an incomplete cache. */ }
      }
      const byUid = new Map(existingEntries.map((entry) => [entry.uid, entry]))
      for (const entry of persistedEntries) byUid.set(entry.uid, entry)
      fs.writeFileSync(sessionPath, JSON.stringify({ version: 1, entries: [...byUid.values()] }), 'utf8')
    }
  }
}

export async function uploadWorkspaceToDrive(sessionKey?: string): Promise<{ fileName: string; modifiedTime?: string; stats: WorkspaceTranslationStats }> {
  const auth = await getAuth()
  const drive = google.drive({ version: 'v3', auth })
  const existing = await findWorkspaceFile(drive)
  const stats = getWorkspaceTranslationStats(path.join(app.getPath('userData'), 'icosa', 'sessions'), sessionKey)
  const tempDir = createTempDir('icosa_cloud_upload')
  const workspacePath = path.join(tempDir, CLOUD_FILE_NAME)

  try {
    await exportWorkspace(workspacePath)
    const media = { mimeType: 'application/octet-stream', body: fs.createReadStream(workspacePath) }
    const response = existing?.id
      ? await drive.files.update({ fileId: existing.id, media, fields: 'id,name,modifiedTime' })
      : await drive.files.create({
          requestBody: { name: CLOUD_FILE_NAME, mimeType: 'application/octet-stream' },
          media,
          fields: 'id,name,modifiedTime'
        })
    await uploadPwaSyncFile(drive, buildPwaSyncDocument())
    return { fileName: response.data.name ?? CLOUD_FILE_NAME, modifiedTime: response.data.modifiedTime ?? undefined, stats }
  } finally {
    cleanupTempDir(tempDir)
  }
}

export async function downloadWorkspaceFromDrive(sessionKey?: string): Promise<{ fileName: string; restartRequired: boolean; stats: WorkspaceTranslationStats }> {
  const auth = await getAuth()
  const drive = google.drive({ version: 'v3', auth })
  const cloudFile = await findWorkspaceFile(drive)
  if (!cloudFile?.id) throw new Error(`No ${CLOUD_FILE_NAME} file was found in Google Drive.`)

  const tempDir = createTempDir('icosa_cloud_download')
  const workspacePath = path.join(tempDir, CLOUD_FILE_NAME)
  try {
    fs.mkdirSync(tempDir, { recursive: true })
    const response = await drive.files.get({ fileId: cloudFile.id, alt: 'media' }, { responseType: 'stream' })
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
    return { fileName: CLOUD_FILE_NAME, restartRequired: true, stats }
  } finally {
    cleanupTempDir(tempDir)
  }
}
