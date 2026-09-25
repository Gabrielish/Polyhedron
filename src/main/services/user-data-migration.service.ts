import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import Database from 'better-sqlite3'
import { app } from 'electron'
import { databasePath, projectDataPath } from '../utils/app-paths'

/**
 * The app was historically stored under an `icosa` user-data directory. Keep
 * the old data available after the product/package rename without deleting or
 * overwriting anything the new profile may already contain.
 */
export function migrateLegacyUserData(): void {
  const currentRoot = app.getPath('userData')
  const legacyRoot = path.join(path.dirname(currentRoot), 'icosa')
  if (path.resolve(currentRoot) === path.resolve(legacyRoot) || !fs.existsSync(legacyRoot)) return

  fs.mkdirSync(currentRoot, { recursive: true })

  migrateDatabase(legacyRoot, currentRoot)
  // The first recovery created a new profile containing the old filenames.
  // Move those files to their final Polyhedron names before opening the DB.
  migrateDatabaseFileNames(currentRoot)
  copyIfMissing(
    path.join(legacyRoot, 'google-drive-credentials.json'),
    path.join(currentRoot, 'google-drive-credentials.json')
  )
  copyIfMissing(
    path.join(legacyRoot, 'google-drive-token.json'),
    path.join(currentRoot, 'google-drive-token.json')
  )

  // Session/mod files used by the app live in the legacy nested directory.
  copyTreeIfMissing(path.join(legacyRoot, 'icosa'), projectDataPath(currentRoot))
  copyTreeIfMissing(path.join(legacyRoot, 'sessions'), path.join(currentRoot, 'sessions'))
  copyTreeIfMissing(path.join(legacyRoot, 'mods'), path.join(currentRoot, 'mods'))
  rewriteDatabasePaths(currentRoot)
}

function rewriteDatabasePaths(currentRoot: string): void {
  const dbPath = databasePath(currentRoot)
  if (!fs.existsSync(dbPath)) return
  const sqlite = new Database(dbPath)
  try {
    const mods = sqlite.prepare('SELECT id, name, last_file_path FROM mod').all() as Array<{
      id: number
      name: string
      last_file_path: string | null
    }>
    const config = new Map(
      (
        sqlite.prepare('SELECT key, value FROM config').all() as Array<{
          key: string
          value: string | null
        }>
      ).map((row) => [row.key, row.value ?? ''])
    )
    const sourceLang = config.get('last_source_lang') || 'en'
    const targetLang = config.get('last_target_lang') || 'ro'
    const sessionsDir = path.join(currentRoot, 'sessions')
    const updateMod = sqlite.prepare('UPDATE mod SET last_file_path = ? WHERE id = ?')
    const updateMeta = sqlite.prepare('UPDATE mod_meta SET meta_file_path = ? WHERE mod_id = ?')

    sqlite.transaction(() => {
      for (const mod of mods) {
        const modDir = path.join(currentRoot, 'mods', sanitizeModName(mod.name))
        const fileName = portableFileName(mod.last_file_path) || 'translation_merged.xml'
        const nextPath = path.join(modDir, fileName)
        if (mod.last_file_path !== nextPath) updateMod.run(nextPath, mod.id)
        try {
          updateMeta.run(path.join(modDir, 'meta.lsx'), mod.id)
        } catch {
          // Older workspace databases may not have the metadata table yet.
        }

        if (mod.last_file_path && mod.last_file_path !== nextPath) {
          const oldSession = sessionFile(
            sessionsDir,
            `${mod.last_file_path}|${sourceLang}|${targetLang}`
          )
          const newSession = sessionFile(sessionsDir, `${nextPath}|${sourceLang}|${targetLang}`)
          if (fs.existsSync(oldSession) && !fs.existsSync(newSession))
            renameIfPresent(oldSession, newSession)
        }
      }
    })()
  } finally {
    sqlite.close()
  }
}

function sessionFile(sessionsDir: string, key: string): string {
  return path.join(sessionsDir, `${crypto.createHash('sha256').update(key).digest('hex')}.json`)
}

function sanitizeModName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100)
}

function portableFileName(value: string | null): string {
  return value ? path.basename(value.replaceAll('\\', '/')) : ''
}

function migrateDatabaseFileNames(currentRoot: string): void {
  const oldDatabase = path.join(currentRoot, 'icosa.db')
  const newDatabase = databasePath(currentRoot)
  if (fs.existsSync(oldDatabase) && !fs.existsSync(newDatabase)) {
    renameIfPresent(oldDatabase, newDatabase)
    renameIfPresent(`${oldDatabase}-wal`, `${newDatabase}-wal`)
    renameIfPresent(`${oldDatabase}-shm`, `${newDatabase}-shm`)
  }

  const oldProjects = path.join(currentRoot, 'icosa')
  const newProjects = projectDataPath(currentRoot)
  if (fs.existsSync(oldProjects)) {
    copyTreeIfMissing(oldProjects, newProjects)
    try {
      fs.rmSync(oldProjects, { recursive: true, force: true })
    } catch {
      /* Keep legacy data if it is locked. */
    }
  }
}

function migrateDatabase(legacyRoot: string, currentRoot: string): void {
  const legacyDb = path.join(legacyRoot, 'icosa.db')
  if (!fs.existsSync(legacyDb)) return

  const currentDb = databasePath(currentRoot)
  const legacySize = safeSize(legacyDb)
  const currentSize = safeSize(currentDb)
  // A fresh profile contains only the schema and is tiny compared with a real
  // translation database. Never replace a current profile of comparable size.
  if (currentSize > 0 && legacySize <= currentSize * 4) return

  if (currentSize > 0) {
    const backupBase = `${currentDb}.before-polyhedron-migration-${Date.now()}`
    renameIfPresent(currentDb, backupBase)
    renameIfPresent(`${currentDb}-wal`, `${backupBase}-wal`)
    renameIfPresent(`${currentDb}-shm`, `${backupBase}-shm`)
  }

  copyIfMissing(legacyDb, currentDb)
  copyIfMissing(`${legacyDb}-wal`, `${currentDb}-wal`)
  copyIfMissing(`${legacyDb}-shm`, `${currentDb}-shm`)
}

function safeSize(filePath: string): number {
  try {
    return fs.statSync(filePath).size
  } catch {
    return 0
  }
}

function renameIfPresent(source: string, destination: string): void {
  if (!fs.existsSync(source)) return
  try {
    fs.renameSync(source, destination)
  } catch {
    // A locked/partial cache should not prevent the app from opening.
  }
}

function copyIfMissing(source: string, destination: string): void {
  if (!fs.existsSync(source) || fs.existsSync(destination)) return
  try {
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    fs.copyFileSync(source, destination)
  } catch {
    // Migration is best-effort; the original legacy data remains untouched.
  }
}

function copyTreeIfMissing(source: string, destination: string): void {
  if (!fs.existsSync(source)) return
  fs.mkdirSync(destination, { recursive: true })
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name)
    const destinationPath = path.join(destination, entry.name)
    if (entry.isDirectory()) copyTreeIfMissing(sourcePath, destinationPath)
    else copyIfMissing(sourcePath, destinationPath)
  }
}
