import { requestDriveAccessToken } from './googleDrive'

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
const connectedKey = 'polyhedron.google-drive.connected'
let pending: Promise<string> | null = null
let connecting = false

// Share the landing-page click's request with the workspace. Tokens remain
// in memory; visiting #app directly never starts Google authorization.
export function beginDriveConnection(): Promise<string> {
  if (connecting && pending) return pending
  connecting = true
  pending = (async () => {
    if (!clientId) throw new Error('Google Drive is not configured for this site yet. Please try the published site or import a workspace file.')
    let previouslyConnected = false
    try { previouslyConnected = localStorage.getItem(connectedKey) === 'true' } catch { /* Optional storage. */ }
    let token: string
    try { token = await requestDriveAccessToken(clientId, previouslyConnected ? '' : 'consent') }
    catch (error) {
      if (!previouslyConnected) throw error
      token = await requestDriveAccessToken(clientId, 'consent')
    }
    try { localStorage.setItem(connectedKey, 'true') } catch { /* Optional storage. */ }
    return token
  })().finally(() => { connecting = false })
  return pending
}
export function pendingDriveConnection(): Promise<string> | null { return pending }
