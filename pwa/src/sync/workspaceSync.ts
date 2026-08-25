export const WORKSPACE_SYNC_VERSION = 1 as const

export type SyncEntry = {
  uid: string
  source: string
  target: string
  matchType: 'none' | 'mod-text' | 'text' | 'manual'
  needsReview: boolean
}

export type SyncSession = {
  id: string
  modName: string
  sourceLang: string
  targetLang: string
  updatedAt: string
  entries: SyncEntry[]
}

export type WorkspaceSyncDocument = {
  version: typeof WORKSPACE_SYNC_VERSION
  generatedAt: string
  fingerprint: string
  sessions: SyncSession[]
}

export function isWorkspaceSyncDocument(value: unknown): value is WorkspaceSyncDocument {
  if (!value || typeof value !== 'object') return false
  const document = value as Partial<WorkspaceSyncDocument>
  return document.version === WORKSPACE_SYNC_VERSION && Array.isArray(document.sessions)
}

export function emptyDocument(): WorkspaceSyncDocument {
  return { version: WORKSPACE_SYNC_VERSION, generatedAt: new Date().toISOString(), fingerprint: '', sessions: [] }
}
