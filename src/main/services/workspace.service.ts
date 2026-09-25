import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { app } from 'electron'
import { backupDatabase, closeDb } from '../database/connection'
import { cleanupTempDir, createTempDir } from '../utils/tempDir'
import { createZip, extractZip } from './zip.service'
import { databasePath, projectPath } from '../utils/app-paths'

const WORKSPACE_VERSION = 1

export interface WorkspaceTranslationStats {
  translated: number
  total: number
  fingerprint: string
}

export function getWorkspaceTranslationStats(
  sessionsDir: string,
  sessionKey?: string
): WorkspaceTranslationStats {
  const stats: WorkspaceTranslationStats = { translated: 0, total: 0, fingerprint: '' }
  let hash = 2166136261
  if (!fs.existsSync(sessionsDir)) return stats
  const requestedFile = sessionKey
    ? `${crypto.createHash('sha256').update(sessionKey).digest('hex')}.json`
    : null
  for (const fileName of fs.readdirSync(sessionsDir)) {
    if (!fileName.endsWith('.json') || (requestedFile && fileName !== requestedFile)) continue
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(sessionsDir, fileName), 'utf8')) as {
        entries?: Array<{ target?: string }>
      }
      if (!Array.isArray(parsed.entries)) continue
      stats.total += parsed.entries.length
      stats.translated += parsed.entries.filter((entry) => Boolean(entry.target?.trim())).length
      for (const entry of parsed.entries) {
        const value = `${(entry as { uid?: string }).uid ?? ''}\u0000${entry.target ?? ''}\u0000${(entry as { matchType?: string }).matchType ?? ''}\u0000${(entry as { needsReview?: boolean }).needsReview ?? false}\u0000${(entry as { reviewStatus?: string }).reviewStatus ?? ''}\u0000${JSON.stringify((entry as { history?: unknown }).history ?? [])}`
        for (let index = 0; index < value.length; index += 1) {
          hash ^= value.charCodeAt(index)
          hash = Math.imul(hash, 16777619)
        }
      }
    } catch {
      // Ignore incomplete session files.
    }
  }
  stats.fingerprint = (hash >>> 0).toString(16)
  return stats
}

function sanitizeModName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100)
}

function portableFileName(value: string | null): string {
  if (!value) return ''
  return path.basename(value.replaceAll('\\', '/'))
}

function rewriteImportedPaths(dbPath: string): void {
  const sqlite = new Database(dbPath)
  try {
    const mods = sqlite.prepare('SELECT id, name, last_file_path FROM mod').all() as Array<{
      id: number
      name: string
      last_file_path: string | null
    }>
    const updateMod = sqlite.prepare('UPDATE mod SET last_file_path = ? WHERE id = ?')
    const updateMeta = sqlite.prepare('UPDATE mod_meta SET meta_file_path = ? WHERE mod_id = ?')
    sqlite.transaction(() => {
      for (const mod of mods) {
        const modDir = projectPath('mods', sanitizeModName(mod.name))
        const fileName = portableFileName(mod.last_file_path) || 'translation_merged.xml'
        updateMod.run(path.join(modDir, fileName), mod.id)
        updateMeta.run(path.join(modDir, 'meta.lsx'), mod.id)
      }
    })()
  } finally {
    sqlite.close()
  }
}

export async function exportWorkspace(outputPath: string): Promise<{ outputPath: string }> {
  const tempDir = createTempDir('polyhedron_workspace_export')
  try {
    fs.mkdirSync(tempDir, { recursive: true })
    await backupDatabase(path.join(tempDir, 'polyhedron.db'))
    const modsDir = projectPath('mods')
    if (fs.existsSync(modsDir)) fs.cpSync(modsDir, path.join(tempDir, 'mods'), { recursive: true })
    const sessionsDir = projectPath('sessions')
    if (fs.existsSync(sessionsDir))
      fs.cpSync(sessionsDir, path.join(tempDir, 'sessions'), { recursive: true })
    fs.writeFileSync(
      path.join(tempDir, 'workspace.json'),
      JSON.stringify({ version: WORKSPACE_VERSION, createdAt: new Date().toISOString() }, null, 2)
    )
    createZip(tempDir, outputPath)
    return { outputPath }
  } finally {
    cleanupTempDir(tempDir)
  }
}

export async function importWorkspace(
  inputPath: string
): Promise<{ backupPath: string; stats: WorkspaceTranslationStats }> {
  const tempDir = createTempDir('polyhedron_workspace_import')
  const userData = app.getPath('userData')
  const currentDbPath = databasePath()
  const backupPath = path.join(userData, `polyhedron.db.before-import-${Date.now()}`)
  try {
    extractZip(inputPath, tempDir)
    const importedDbPath = fs.existsSync(path.join(tempDir, 'polyhedron.db'))
      ? path.join(tempDir, 'polyhedron.db')
      : path.join(tempDir, 'icosa.db')
    if (!fs.existsSync(importedDbPath))
      throw new Error('Invalid workspace: polyhedron.db is missing.')
    await backupDatabase(backupPath)
    closeDb()
    fs.copyFileSync(importedDbPath, currentDbPath)
    const importedMods = path.join(tempDir, 'mods')
    const modsDir = projectPath('mods')
    if (fs.existsSync(importedMods)) {
      fs.rmSync(modsDir, { recursive: true, force: true })
      fs.mkdirSync(path.dirname(modsDir), { recursive: true })
      fs.cpSync(importedMods, modsDir, { recursive: true })
    }
    const importedSessions = path.join(tempDir, 'sessions')
    let stats: WorkspaceTranslationStats = { translated: 0, total: 0, fingerprint: '' }
    if (fs.existsSync(importedSessions)) {
      const sessionsDir = projectPath('sessions')
      if (fs.existsSync(sessionsDir)) {
        fs.cpSync(sessionsDir, path.join(userData, `sessions.before-import-${Date.now()}`), {
          recursive: true
        })
        fs.rmSync(sessionsDir, { recursive: true, force: true })
      }
      fs.mkdirSync(path.dirname(sessionsDir), { recursive: true })
      fs.cpSync(importedSessions, sessionsDir, { recursive: true })
      stats = getWorkspaceTranslationStats(sessionsDir)
    }
    rewriteImportedPaths(currentDbPath)
    return { backupPath, stats }
  } finally {
    cleanupTempDir(tempDir)
  }
}
