import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { ipcMain } from 'electron'
import type { RepositoryRegistry } from '../database/repositories/registry'
import { config } from '../database/schema'
import { packMod, unpackMod } from '../services/lslib.service'
import type { MetaInfo } from '../services/lsx-parser.service'
import { deleteMod } from '../services/mod-delete.service'
import {
  completeTranslationImport as completeImport,
  discardTranslationInput,
  exportLocalizationPak,
  exportTranslatedPackage,
  getMetaForMod,
  getStoredModDir,
  injectLocalizationPak,
  prepareTranslationInput,
  upsertMetaForMod
} from '../services/translation-import.service'
import { findLocalizationXmls, parseLocalizationXml } from '../services/xml-parser.service'
import { extract } from '../services/zip.service'
import { projectPath } from '../utils/app-paths'
import { findPakFiles } from '../utils/findPakFiles'
import { normalizeLangs, toBg3LanguageFolder } from '../utils/languages'

interface ExtractPayload {
  inputPath: string
  outputPath: string
  sourceLang?: string
}

interface PackPayload {
  inputFolder: string
  outputPath: string
}

export interface ModInfo {
  name: string
  totalStrings: number
  translatedStrings: number
  lastFilePath: string | null
  updatedAt: string | null
}

function sanitizeModName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100)
}

function isPathInside(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate)
  return (
    relative === '' ||
    (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  )
}

function sessionFileForKey(key: string): string {
  return projectPath('sessions', `${crypto.createHash('sha256').update(key).digest('hex')}.json`)
}

function copyRenamedSessionCache(
  oldPath: string | null | undefined,
  nextPath: string | null | undefined,
  repos: RepositoryRegistry
): void {
  if (!oldPath || !nextPath || oldPath === nextPath) return
  const settings = new Map(
    repos.db
      .select()
      .from(config)
      .all()
      .map((row) => [row.key, row.value ?? ''])
  )
  const sourceLang = settings.get('last_source_lang') || 'en'
  const targetLang = settings.get('last_target_lang') || 'ro'
  const oldSession = sessionFileForKey(`${oldPath}|${sourceLang}|${targetLang}`)
  const nextSession = sessionFileForKey(`${nextPath}|${sourceLang}|${targetLang}`)
  if (!fs.existsSync(oldSession) || fs.existsSync(nextSession)) return
  fs.mkdirSync(path.dirname(nextSession), { recursive: true })
  fs.copyFileSync(oldSession, nextSession)
}

function languageFolder(repos: RepositoryRegistry, languageCode: string): string {
  const language = repos.language.findByCode(languageCode)
  return toBg3LanguageFolder(languageCode, language?.name)
}

function isDeveloperNote(source: string): boolean {
  const value = source.trim()
  return value.startsWith('%%%') || (value.startsWith('|') && value.indexOf('|', 1) > 0)
}

function getSavedSessionProgress(
  storedPath: string | null,
  sourceLang: string,
  targetLang: string
): { total: number; translated: number } | null {
  if (!storedPath) return null
  const key = `${storedPath}|${sourceLang}|${targetLang}`
  const id = crypto.createHash('sha256').update(key).digest('hex')
  const filePath = projectPath('sessions', `${id}.json`)
  if (!fs.existsSync(filePath)) return null
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as {
      entries?: Array<{ source?: string; target?: string }>
    }
    if (
      !Array.isArray(parsed.entries) ||
      parsed.entries.some((entry) => typeof entry.source !== 'string')
    )
      return null
    const visible = parsed.entries.filter((entry) => !isDeveloperNote(entry.source ?? ''))
    return {
      total: visible.length,
      translated: visible.filter((entry) => (entry.target ?? '').trim() !== '').length
    }
  } catch {
    return null
  }
}

function getVisibleProgressFromStoredFile(
  modName: string,
  storedPath: string | null,
  sourceLang: string,
  targetLang: string,
  repos: RepositoryRegistry
): { total: number; translated: number } | null {
  if (!storedPath || !fs.existsSync(storedPath)) return null
  try {
    const visibleTotal = parseLocalizationXml(storedPath).filter(
      (entry) => !isDeveloperNote(entry.text)
    ).length
    if (visibleTotal === 0) return null

    const [language1, language2, swapped] = normalizeLangs(sourceLang, targetLang)
    const targetField = swapped ? 'textLanguage1' : 'textLanguage2'
    const translatedNotes = repos.dictionary.getByMod(modName).filter((entry) => {
      if (entry.language1 !== language1 || entry.language2 !== language2) return false
      return isDeveloperNote(entry[targetField])
    }).length

    return {
      total: visibleTotal,
      translated: Math.max(
        0,
        repos.dictionary.countByMod(modName, sourceLang, targetLang) - translatedNotes
      )
    }
  } catch {
    return null
  }
}

export function registerModHandlers(repos: RepositoryRegistry): void {
  ipcMain.handle('mod:extract', async (_event, payload: ExtractPayload) => {
    const { inputPath, outputPath, sourceLang = 'English' } = payload

    const ext = path.extname(inputPath).toLowerCase()

    let pakPath = inputPath

    if (ext === '.zip' || ext === '.rar') {
      const tmpDir = `${outputPath}_tmp_archive`
      extract(inputPath, tmpDir)
      const paks = findPakFiles(tmpDir)
      if (paks.length === 0) throw new Error('No .pak file found inside archive')
      pakPath = paks[0]
    }

    await unpackMod(pakPath, outputPath)
    const xmlFiles = findLocalizationXmls(outputPath, languageFolder(repos, sourceLang))

    return { success: true, xmlFiles }
  })

  ipcMain.handle('mod:pack', async (_event, payload: PackPayload) => {
    const { inputFolder, outputPath } = payload
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    await packMod(inputFolder, outputPath)
    return { success: true, pakPath: outputPath }
  })

  ipcMain.handle(
    'mod:prepareTranslationInput',
    async (
      _event,
      { inputPath, gameProfile }: { inputPath: string; gameProfile: 'bg3' | 'dos1' | 'dos2' }
    ) => {
      return prepareTranslationInput(inputPath, gameProfile)
    }
  )

  ipcMain.handle('mod:discardTranslationInput', (_event, { importId }: { importId: string }) => {
    discardTranslationInput(importId)
    return { success: true }
  })

  ipcMain.handle(
    'mod:completeTranslationImport',
    (
      _event,
      params: { importId: string; candidateIds: string[]; modName: string; targetLang: string }
    ) => {
      return completeImport(repos, params)
    }
  )

  ipcMain.handle('mod:getMeta', (_event, params: { modName: string; targetLang: string }) =>
    getMetaForMod(repos, params)
  )

  ipcMain.handle('mod:upsertMeta', (_event, params: { modName: string; meta: MetaInfo }) =>
    upsertMetaForMod(repos, params.modName, params.meta)
  )

  ipcMain.handle(
    'mod:exportTranslatedPackage',
    async (
      _event,
      params: {
        outputPath: string
        format: 'pak' | 'zip'
        modName: string
        entries: { uid: string; version: string; source: string; target: string }[]
        meta: MetaInfo
        bg3LanguageFolder: string
      }
    ) => exportTranslatedPackage(repos, params)
  )

  ipcMain.handle(
    'mod:exportLocalizationPak',
    (
      _event,
      params: {
        outputPath: string
        entries: { uid: string; version: string; source: string; target: string }[]
      }
    ) => exportLocalizationPak(params.entries, params.outputPath)
  )

  ipcMain.handle(
    'mod:injectLocalizationPak',
    (
      _event,
      params: {
        platform: 'windows' | 'macos'
        entries: { uid: string; version: string; source: string; target: string }[]
      }
    ) => injectLocalizationPak(params.entries, params.platform)
  )

  ipcMain.handle('mod:getAll', (_event, params?: { lang1?: string; lang2?: string }) => {
    const mods = repos.mod.getAll()
    const { lang1, lang2 } = params ?? {}
    return mods.map((m): ModInfo => {
      const saved =
        lang1 && lang2 ? getSavedSessionProgress(m.lastFilePath ?? null, lang1, lang2) : null
      const visible =
        !saved && lang1 && lang2
          ? getVisibleProgressFromStoredFile(m.name, m.lastFilePath ?? null, lang1, lang2, repos)
          : null
      return {
        name: m.name,
        totalStrings: saved?.total ?? visible?.total ?? m.totalStrings ?? 0,
        translatedStrings:
          saved?.translated ??
          visible?.translated ??
          (lang1 && lang2 ? repos.dictionary.countByMod(m.name, lang1, lang2) : 0),
        lastFilePath: m.lastFilePath ?? null,
        updatedAt: m.updatedAt ?? null
      }
    })
  })

  ipcMain.handle(
    'mod:upsert',
    (
      _event,
      {
        name,
        totalStrings,
        lastFilePath
      }: { name: string; totalStrings?: number; lastFilePath?: string }
    ) => {
      repos.mod.upsert(name, { totalStrings, lastFilePath })
      return { success: true }
    }
  )

  ipcMain.handle(
    'mod:rename',
    (_event, { modName, nextName }: { modName: string; nextName: string }) => {
      const current = modName.trim()
      const next = nextName.trim()
      if (!current || !next) throw new Error('Project name cannot be empty')
      if (current !== next && repos.mod.findByName(next))
        throw new Error('Project name already exists')
      if (current === next) return { success: true }

      const currentMod = repos.mod.findByName(current)
      if (!currentMod) throw new Error(`Project not found: ${current}`)
      const currentMeta = repos.modMeta.findByModName(current)
      const oldDir = getStoredModDir(current)
      const nextDir = getStoredModDir(next)
      const folderExists = fs.existsSync(oldDir)
      const destinationExists = fs.existsSync(nextDir)
      if (oldDir === nextDir)
        throw new Error('The new project name maps to the existing storage folder')
      if (destinationExists) throw new Error('A folder already exists for the new project name')

      const nextFilePath =
        currentMod.lastFilePath && isPathInside(oldDir, currentMod.lastFilePath)
          ? path.join(nextDir, path.relative(oldDir, currentMod.lastFilePath))
          : (currentMod.lastFilePath ?? undefined)
      const nextMetaPath =
        currentMeta && isPathInside(oldDir, currentMeta.metaFilePath)
          ? path.join(nextDir, path.relative(oldDir, currentMeta.metaFilePath))
          : currentMeta?.metaFilePath

      let movedFolder = false
      if (oldDir !== nextDir && folderExists) {
        fs.renameSync(oldDir, nextDir)
        movedFolder = true
      }

      try {
        repos.mod.rename(current, next, {
          lastFilePath: nextFilePath,
          metaFilePath: nextMetaPath
        })
      } catch (error) {
        if (movedFolder && fs.existsSync(nextDir) && !fs.existsSync(oldDir)) {
          fs.renameSync(nextDir, oldDir)
        }
        throw error
      }
      // The session cache is an optimization; a failed copy must not undo a
      // successful rename. The PWA sync document can rebuild it on download.
      try {
        copyRenamedSessionCache(currentMod.lastFilePath, nextFilePath, repos)
      } catch {
        // Keep the rename successful; the next session save recreates the cache.
      }
      return { success: true }
    }
  )

  ipcMain.handle(
    'mod:storeFile',
    async (_event, { modName, filePath }: { modName: string; filePath: string }) => {
      const modDir = projectPath('mods', sanitizeModName(modName))
      fs.mkdirSync(modDir, { recursive: true })

      const fileName = path.basename(filePath)
      const destPath = path.join(modDir, fileName)

      // Avoid copying a file onto itself
      if (path.resolve(filePath) !== path.resolve(destPath)) {
        fs.copyFileSync(filePath, destPath)
      }

      return { storedPath: destPath }
    }
  )

  ipcMain.handle('mod:delete', async (_e, { modName }: { modName: string }) =>
    deleteMod({ modName, db: repos.db })
  )

  ipcMain.handle('mod:previewDelete', (_e, { modName }: { modName: string }) => {
    const folderPath = getStoredModDir(modName)
    const folderExists = fs.existsSync(folderPath)
    const dictionaryRows = repos.dictionary.countAllByMod(modName)
    return { dictionaryRows, folderPath, folderExists }
  })

  ipcMain.handle(
    'mod:setPriority',
    (_e, { modName, priority }: { modName: string; priority: number | null }) => {
      repos.mod.setPriority(modName, priority)
      repos.mod.compactPriority()
      return { success: true }
    }
  )

  ipcMain.handle('mod:reorderPriority', (_e, { orderedNames }: { orderedNames: string[] }) => {
    repos.mod.reorderPriority(orderedNames)
    return { success: true }
  })

  ipcMain.handle('mod:listWithPriority', (_e, params?: { lang1?: string; lang2?: string }) => {
    const mods = repos.mod.getAll()
    const { lang1, lang2 } = params ?? {}
    return mods.map((m) => ({
      name: m.name,
      totalStrings: m.totalStrings ?? 0,
      translatedStrings: lang1 && lang2 ? repos.dictionary.countByMod(m.name, lang1, lang2) : 0,
      lastFilePath: m.lastFilePath ?? null,
      updatedAt: m.updatedAt ?? null,
      priority: m.priority ?? null
    }))
  })
}
