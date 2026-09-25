import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

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
  copyIfMissing(path.join(legacyRoot, 'google-drive-credentials.json'), path.join(currentRoot, 'google-drive-credentials.json'))
  copyIfMissing(path.join(legacyRoot, 'google-drive-token.json'), path.join(currentRoot, 'google-drive-token.json'))

  // Session/mod files used by the app live in the legacy nested directory.
  copyTreeIfMissing(path.join(legacyRoot, 'icosa'), path.join(currentRoot, 'icosa'))
  copyTreeIfMissing(path.join(legacyRoot, 'sessions'), path.join(currentRoot, 'sessions'))
  copyTreeIfMissing(path.join(legacyRoot, 'mods'), path.join(currentRoot, 'mods'))
}

function migrateDatabase(legacyRoot: string, currentRoot: string): void {
  const legacyDb = path.join(legacyRoot, 'icosa.db')
  if (!fs.existsSync(legacyDb)) return

  const currentDb = path.join(currentRoot, 'icosa.db')
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
