import type { WorkspaceSyncDocument } from './workspaceSync'
import { parseWorkspaceText } from '../utils/parseWorkspace'

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive'
const FILE_NAME = 'polyhedron-workspace-sync.json'
let scriptPromise: Promise<void> | null = null

type TokenClient = { requestAccessToken: (options?: { prompt?: string }) => void }
declare global {
  interface Window { google?: { accounts: { oauth2: { initTokenClient: (options: { client_id: string; scope: string; callback: (response: { access_token?: string; error?: string }) => void; error_callback?: (error: { type: string }) => void }) => TokenClient } } } }
}

export function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    const timeout = window.setTimeout(() => fail(), 15000)
    function fail(): void {
      window.clearTimeout(timeout)
      script.onload = script.onerror = null
      scriptPromise = null
      script.remove()
      reject(new Error('Google Identity Services could not be loaded. Please try again.'))
    }
    script.onload = () => {
      window.clearTimeout(timeout)
      if (!window.google?.accounts?.oauth2) { fail(); return }
      resolve()
    }
    script.onerror = fail
    document.head.appendChild(script)
  })
  return scriptPromise
}

export function requestDriveAccessToken(clientId: string, prompt = 'consent'): Promise<string> {
  // With the SDK preloaded, requestAccessToken runs in the original click,
  // rather than after an async script load that can lose user activation.
  if (!window.google?.accounts?.oauth2) return loadGoogleScript().then(() => requestDriveAccessToken(clientId, prompt))
  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      callback()
    }
    const client = window.google?.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (response) => response.access_token
        ? finish(() => resolve(response.access_token as string))
        : finish(() => reject(new Error(response.error || 'Google authorization was cancelled.'))),
      error_callback: (error) => finish(() => reject(new Error(error.type === 'popup_failed_to_open'
        ? 'Google sign-in was blocked by your browser. Allow the popup and try Download workspace again.'
        : error.type === 'popup_closed' ? 'Google sign-in was cancelled. You can try again.' : 'Google sign-in could not be completed. Please try again.')))
    })
    if (!client) {
      finish(() => reject(new Error('Google Identity Services is unavailable.')))
      return
    }
    client.requestAccessToken({ prompt })
    // prompt='' can still show Google's account/consent UI. Do not time it out
    // and launch another popup while the user is completing the first request.
  })
}

async function driveRequest<T>(token: string, url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) } })
  if (!response.ok) throw new Error(`Google Drive request failed (${response.status}).`)
  return response.json() as Promise<T>
}

type DriveFile = { id?: string; name?: string }

async function findWorkspaceFile(token: string): Promise<DriveFile | null> {
  const query = encodeURIComponent(`name = '${FILE_NAME}' and trashed = false`)
  const result = await driveRequest<{ files?: DriveFile[] }>(token, `https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive&fields=files(id,name)&pageSize=1`)
  return result.files?.[0] ?? null
}

function multipartBody(metadata: object, content: string, boundary: string): Blob {
  return new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--`], { type: `multipart/related; boundary=${boundary}` })
}

export async function uploadWorkspaceSync(token: string, document: WorkspaceSyncDocument): Promise<void> {
  const existing = await findWorkspaceFile(token)
  const boundary = `polyhedron_${Date.now()}`
  const body = multipartBody({ name: FILE_NAME, mimeType: 'application/json' }, JSON.stringify(document), boundary)
  const url = existing?.id ? `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=multipart` : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart'
  await driveRequest(token, url, { method: existing?.id ? 'PATCH' : 'POST', body, headers: { 'Content-Type': `multipart/related; boundary=${boundary}` } })
}

export async function downloadWorkspaceSync(token: string): Promise<WorkspaceSyncDocument> {
  const file = await findWorkspaceFile(token)
  if (!file?.id) throw new Error(`No ${FILE_NAME} file was found in Google Drive.`)
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, { headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) throw new Error(`Google Drive download failed (${response.status}).`)
  return parseWorkspaceText(await response.text())
}
