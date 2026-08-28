import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { app, ipcMain } from 'electron'

interface SessionEntry {
  uid: string
  target: string
  genderTargets?: Partial<Record<'default' | 'female' | 'neutral', string>>
  matchType: 'none' | 'mod-text' | 'text' | 'manual'
  needsReview: boolean
}

function sessionPath(key: string): string {
  const id = crypto.createHash('sha256').update(key).digest('hex')
  return path.join(app.getPath('userData'), 'icosa', 'sessions', `${id}.json`)
}

export function registerSessionHandlers(): void {
  ipcMain.handle('session:save', (_event, payload: { key: string; entries: SessionEntry[] }) => {
    const filePath = sessionPath(payload.key)
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, JSON.stringify({ version: 1, entries: payload.entries }), 'utf-8')
    return { success: true }
  })

  ipcMain.handle('session:load', (_event, payload: { key: string }) => {
    const filePath = sessionPath(payload.key)
    if (!fs.existsSync(filePath)) return null
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as { entries?: SessionEntry[] }
      return Array.isArray(parsed.entries) ? parsed.entries : null
    } catch {
      return null
    }
  })
}
