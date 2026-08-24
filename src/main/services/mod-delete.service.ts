// SQL transaction runs first; filesystem removal runs after and is best-effort (logged on failure, never rethrows).
import fs from 'node:fs/promises'
import type { drizzle } from 'drizzle-orm/better-sqlite3'
import { ModRepository } from '../database/repositories/mod.repo'
import { logError } from './log.service'
import { getStoredModDir } from './translation-import.service'

type AppDb = ReturnType<typeof drizzle>

export interface DeleteModResult {
  modName: string
  dictionaryRows: number
  hadMeta: boolean
  folderRemoved: boolean
  folderPath: string
}

export interface DeleteModInput {
  modName: string
  db: AppDb
}

export async function deleteMod(input: DeleteModInput): Promise<DeleteModResult> {
  const { modName, db } = input
  const modRepo = new ModRepository(db)
  const folderPath = getStoredModDir(modName)

  const { dictionaryRows, hadMeta } = modRepo.delete(modName)

  let folderRemoved = false
  try {
    await fs.access(folderPath)
    await fs.rm(folderPath, { recursive: true })
    folderRemoved = true
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code !== 'ENOENT') {
      logError('mod-delete: failed to remove folder', err, { modName, folderPath })
    }
  }

  return { modName, dictionaryRows, hadMeta, folderRemoved, folderPath }
}
