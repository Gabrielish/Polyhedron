import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import { google } from 'googleapis'
import { authenticate } from '@google-cloud/local-auth'
import type { drive_v3 } from 'googleapis'
import { exportWorkspace, getWorkspaceTranslationStats, importWorkspace, type WorkspaceTranslationStats } from './workspace.service'
import { extractZip } from './zip.service'
import { cleanupTempDir, createTempDir } from '../utils/tempDir'

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
const CLOUD_FILE_NAME = 'icosa-workspace.icws'


function credentialsPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'tools', 'google-drive', 'google-drive-credentials.json')
    : path.join(app.getAppPath(), 'tools', 'google-drive', 'google-drive-credentials.json')
}

function tokenPath(): string {
  return path.join(app.getPath('userData'), 'icosa', 'google-drive-token.json')
}

async function getAuth() {
  const keyfilePath = credentialsPath()
  if (!fs.existsSync(keyfilePath)) {
    throw new Error('Google Drive credentials are missing. Add tools/google-drive/google-drive-credentials.json.')
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

export async function uploadWorkspaceToDrive(): Promise<{ fileName: string; modifiedTime?: string; stats: WorkspaceTranslationStats }> {
  const auth = await getAuth()
  const drive = google.drive({ version: 'v3', auth })
  const existing = await findWorkspaceFile(drive)
  const stats = getWorkspaceTranslationStats(path.join(app.getPath('userData'), 'icosa', 'sessions'))
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
    return { fileName: response.data.name ?? CLOUD_FILE_NAME, modifiedTime: response.data.modifiedTime ?? undefined, stats }
  } finally {
    cleanupTempDir(tempDir)
  }
}

export async function downloadWorkspaceFromDrive(): Promise<{ fileName: string; restartRequired: boolean; stats: WorkspaceTranslationStats }> {
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
    const stats = getWorkspaceTranslationStats(path.join(extractedDir, 'sessions'))
    await importWorkspace(workspacePath)
    return { fileName: CLOUD_FILE_NAME, restartRequired: true, stats }
  } finally {
    cleanupTempDir(tempDir)
  }
}
