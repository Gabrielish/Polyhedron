import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import { google } from 'googleapis'
import { authenticate } from '@google-cloud/local-auth'
import type { drive_v3 } from 'googleapis'
import { getDb } from '../database/connection'
import { dictionary } from '../database/schema'
import { DictionaryRepository } from '../database/repositories/dictionary.repo'
import { exportWorkspace, getWorkspaceTranslationStats, importWorkspace, type WorkspaceTranslationStats } from './workspace.service'
import { extractZip } from './zip.service'
import { cleanupTempDir, createTempDir } from '../utils/tempDir'

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
const CLOUD_FILE_NAME = 'icosa-workspace.icws'
const PWA_SYNC_FILE_NAME = 'polyhedron-workspace-sync.json'

type PwaSyncEntry = { uid: string; source: string; target: string; matchType: 'text'; needsReview: boolean }

function buildPwaSyncDocument() {
  const rows = getDb().select().from(dictionary).all()
  const grouped = new Map<string, { id: string; modName: string; sourceLang: string; targetLang: string; updatedAt: string; entries: PwaSyncEntry[] }>()
  let hash = 2166136261
  for (const row of rows) {
    const modName = row.modName ?? 'Workspace'
    const id = `${modName}\u0000${row.language1}\u0000${row.language2}`
    let session = grouped.get(id)
    if (!session) { session = { id, modName, sourceLang: row.language1, targetLang: row.language2, updatedAt: new Date().toISOString(), entries: [] }; grouped.set(id, session) }
    const entry: PwaSyncEntry = { uid: row.uid ?? String(row.id), source: row.textLanguage1, target: row.textLanguage2, matchType: 'text', needsReview: false }
    session.entries.push(entry)
    const value = `${entry.uid}\u0000${entry.target}`
    for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619) }
  }
  return { version: 1 as const, generatedAt: new Date().toISOString(), fingerprint: (hash >>> 0).toString(16), sessions: [...grouped.values()] }
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
    return auth
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
  const document = response.data as { version?: number; sessions?: Array<{ modName?: string; sourceLang?: string; targetLang?: string; entries?: Array<{ uid?: string; source?: string; target?: string }> }> }
  if (document.version !== 1 || !Array.isArray(document.sessions)) return
  const dictionaryRepo = new DictionaryRepository(getDb())
  for (const session of document.sessions) {
    if (!session.sourceLang || !session.targetLang || !Array.isArray(session.entries)) continue
    for (const entry of session.entries) {
      if (!entry.source?.trim()) continue
      dictionaryRepo.upsert({ sourceLang: session.sourceLang, targetLang: session.targetLang, sourceText: entry.source, targetText: entry.target ?? '', modName: session.modName ?? null, uid: entry.uid ?? null })
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
