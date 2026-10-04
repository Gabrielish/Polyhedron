import crypto from 'node:crypto'
import { ipcMain } from 'electron'
import { projectPath } from '../utils/app-paths'
import { runFileTask } from '../services/file-task.service'

interface SessionEntry {
  uid: string
  source?: string
  target: string
  genderTargets?: Partial<Record<'default' | 'female' | 'neutral', string>>
  matchType: 'none' | 'mod-text' | 'text' | 'manual'
  needsReview: boolean
  reviewStatus?: 'untranslated' | 'not-verified' | 'needs-review' | 'verified'
  history?: Array<Record<string, unknown>>
}

function sessionPath(key: string): string {
  const id = crypto.createHash('sha256').update(key).digest('hex')
  return projectPath('sessions', `${id}.json`)
}

const pending = new Map<string, Promise<unknown>>()
export async function flushSessionSaves(): Promise<void> {
  await new Promise<void>(resolve => setImmediate(resolve))
  while (pending.size > 0) await Promise.allSettled([...pending.values()])
}

export function registerSessionHandlers(): void {
  ipcMain.handle('session:save', (_event, payload: { key: string; entries: SessionEntry[] }) => {
    const filePath = sessionPath(payload.key)
    const save = (pending.get(filePath) ?? Promise.resolve()).catch(() => undefined).then(async () => {
      await runFileTask({ kind: 'save-session', filePath, entries: payload.entries })
      return { success: true }
    })
    pending.set(filePath, save)
    void save.finally(() => { if (pending.get(filePath) === save) pending.delete(filePath) }).catch(() => undefined)
    return save
  })

  ipcMain.handle('session:load', async (_event, payload: { key: string }) => {
    const filePath = sessionPath(payload.key)
    await pending.get(filePath)
    return runFileTask<SessionEntry[] | null>({ kind: 'load-session', filePath })
  })
}
