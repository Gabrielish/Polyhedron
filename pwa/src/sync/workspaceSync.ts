export const WORKSPACE_SYNC_VERSION = 1 as const

export type SyncEntry = {
  uid: string
  source: string
  sourceMissing?: boolean
  target: string
  genderTargets?: Partial<Record<'default' | 'female' | 'neutral', string>>
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
  appearance?: { accent: string; buttonTextColor: 'white' | 'black' }
  sessions: SyncSession[]
}

export function isWorkspaceSyncDocument(value: unknown): value is WorkspaceSyncDocument {
  if (!value || typeof value !== 'object') return false
  const document = value as Partial<WorkspaceSyncDocument>
  return document.version === WORKSPACE_SYNC_VERSION && Array.isArray(document.sessions) && document.sessions.every(session => session && Array.isArray(session.entries) && session.entries.every(entry => entry && typeof entry.uid === 'string' && typeof entry.source === 'string' && typeof entry.target === 'string'))
}

// Older desktop sync files omitted source text. Normalize at the boundary so
// every editor receives strings, but keep missing-source information visible.
export function parseWorkspaceSyncDocument(value: unknown): WorkspaceSyncDocument {
  if (!value || typeof value !== 'object') throw new Error('This file is not a supported workspace sync document.')
  const raw = value as Record<string, unknown>
  if (raw.version !== WORKSPACE_SYNC_VERSION || !Array.isArray(raw.sessions)) throw new Error('This file is not a supported workspace sync document.')
  const sessions: SyncSession[] = raw.sessions.map((value, index) => {
    if (!value || typeof value !== 'object' || !Array.isArray(value.entries)) throw new Error(`Workspace project ${index + 1} has invalid entries.`)
    const session = value as Record<string, any>
    const entries: SyncEntry[] = session.entries.map((value: unknown, entryIndex: number) => {
      if (!value || typeof value !== 'object') throw new Error(`Workspace entry ${entryIndex + 1} is invalid.`)
      const entry = value as Record<string, any>
      if (typeof entry.uid !== 'string' || !entry.uid || (entry.source != null && typeof entry.source !== 'string') || (entry.target != null && typeof entry.target !== 'string')) throw new Error(`Workspace entry ${entryIndex + 1} has invalid text fields.`)
      if (entry.genderTargets != null && (typeof entry.genderTargets !== 'object' || Array.isArray(entry.genderTargets) || Object.values(entry.genderTargets).some(text => typeof text !== 'string'))) throw new Error(`Workspace entry ${entryIndex + 1} has invalid gender translations.`)
      return { ...entry, uid: entry.uid, source: entry.source ?? '', sourceMissing: entry.sourceMissing === true || typeof entry.source !== 'string', target: entry.target ?? '', genderTargets: entry.genderTargets ?? undefined, matchType: ['none', 'mod-text', 'text', 'manual'].includes(entry.matchType) ? entry.matchType : 'none', needsReview: entry.needsReview === true }
    })
    return { ...session, id: typeof session.id === 'string' ? session.id : `project-${index + 1}`, modName: typeof session.modName === 'string' ? session.modName : 'Workspace project', sourceLang: typeof session.sourceLang === 'string' ? session.sourceLang : '', targetLang: typeof session.targetLang === 'string' ? session.targetLang : '', updatedAt: typeof session.updatedAt === 'string' ? session.updatedAt : '', entries }
  })
  return { ...raw, version: WORKSPACE_SYNC_VERSION, generatedAt: typeof raw.generatedAt === 'string' ? raw.generatedAt : '', fingerprint: typeof raw.fingerprint === 'string' ? raw.fingerprint : '', sessions } as WorkspaceSyncDocument
}

export function emptyDocument(): WorkspaceSyncDocument {
  return { version: WORKSPACE_SYNC_VERSION, generatedAt: new Date().toISOString(), fingerprint: '', sessions: [] }
}
