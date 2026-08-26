import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { eq } from 'drizzle-orm'
import { app } from 'electron'
import type { RepositoryRegistry } from '../database/repositories/registry'
import { config } from '../database/schema'
import { findPakFiles } from '../utils/findPakFiles'
import { cleanupTempDir, createTempDir } from '../utils/tempDir'
import { packMod, unpackMod } from './lslib.service'
import {
  calculateVersion64,
  formatVersion,
  isValidMetaFolder,
  type MetaInfo,
  parseVersionString,
  readMetaInfo,
  sanitizeMetaFolder,
  writeMeta
} from './lsx-parser.service'
import { encodeEntities } from './xml-entities.service'
import { parseLocalizationXml, writeLocalizationXml } from './xml-parser.service'
import { createZip, extract } from './zip.service'
import { writePackage } from './pak/pak-writer'
import { writeLoca } from './pak/loca-writer'

export interface TranslationXmlCandidate {
  id: string
  absolutePath: string
  relativePath: string
  stringCount: number
  sizeKb: number
  valid: boolean
  status: 'valid' | 'invalid'
}

export interface PreparedTranslationInput {
  importId: string
  requiresSelection: boolean
  candidates: TranslationXmlCandidate[]
}

export interface CompleteTranslationImportResult {
  xmlPath: string
  meta: MetaInfo
}

export interface ExportPackagePayload {
  outputPath: string
  format: 'pak' | 'zip'
  modName: string
  entries: ExportPackageEntry[]
  meta: MetaInfo
  bg3LanguageFolder: string
}

export interface ExportPackageEntry {
  uid: string
  version: string
  source: string
  target: string
}

interface StagedImport {
  inputPath: string
  tempDirs: string[]
  candidates: TranslationXmlCandidate[]
  metaPath: string | null
}

const stagedImports = new Map<string, StagedImport>()
const execFileAsync = promisify(execFile)

function bundledAssetPath(relativePath: string): string {
  if (!app.isPackaged) return path.join(app.getAppPath(), relativePath)

  const unpackedPath = path.join(process.resourcesPath, 'app.asar.unpacked', relativePath)
  return fs.existsSync(unpackedPath)
    ? unpackedPath
    : path.join(process.resourcesPath, relativePath)
}

async function runDivine(args: string[]): Promise<void> {
  const divineDir = bundledAssetPath(path.join('tools', 'lslib', 'Tools'))
  const divinePath = path.join(divineDir, 'Divine.exe')
  if (!fs.existsSync(divinePath)) {
    throw new Error(`Divine.exe was not found at ${divinePath}`)
  }

  try {
    await execFileAsync(divinePath, args, {
      cwd: divineDir,
      windowsHide: true,
      maxBuffer: 20 * 1024 * 1024
    })
  } catch (error) {
    const details = error as { stderr?: string; stdout?: string; message?: string }
    throw new Error(
      `Divine failed: ${details.stderr?.trim() || details.stdout?.trim() || details.message || 'unknown error'}`
    )
  }
}

export async function exportLocalizationPak(
  entries: ExportPackageEntry[],
  outputPath: string
): Promise<{ outputPath: string }> {
  const templateRoot = bundledAssetPath(path.join('work', 'pak'))
  if (!fs.existsSync(templateRoot)) {
    throw new Error(`PAK template was not found at ${templateRoot}`)
  }

  const tempDir = createTempDir('icosa_pak_export')
  const packageRoot = path.join(tempDir, 'pak')
  const languageDir = path.join(packageRoot, 'Localization', 'English')
  const xmlPath = path.join(languageDir, 'english.xml')
  const locaPath = path.join(languageDir, 'english.loca')

  try {
    fs.cpSync(templateRoot, packageRoot, { recursive: true })
    fs.mkdirSync(languageDir, { recursive: true })

    const locaEntries = entries.map((entry) => ({
      key: entry.uid,
      version: entry.version,
      text: entry.target || entry.source
    }))
    if (process.platform === 'darwin') {
      writeLoca(locaEntries, locaPath)
    } else {
      writeLocalizationXml(
        entries.map((entry) => ({
          contentuid: entry.uid,
          version: entry.version,
          text: encodeEntities(entry.target || entry.source)
        })),
        xmlPath
      )
      await runDivine(['-g', 'bg3', '-s', xmlPath, '-d', locaPath, '-a', 'convert-loca'])
      if (!fs.existsSync(locaPath)) throw new Error('Divine did not create english.loca')
      fs.rmSync(xmlPath, { force: true })
    }
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    if (process.platform === 'darwin') {
      await writePackage(packageRoot, outputPath)
    } else {
      await runDivine(['-g', 'bg3', '-s', packageRoot, '-d', outputPath, '-a', 'create-package'])
    }
    if (!fs.existsSync(outputPath)) throw new Error('Divine did not create the PAK file')

    return { outputPath }
  } finally {
    cleanupTempDir(tempDir)
  }
}

export async function injectLocalizationPak(
  entries: ExportPackageEntry[],
  platform: 'windows' | 'macos'
): Promise<{ pakPath: string; backupCreated: boolean }> {
  const home = os.homedir()
  const candidates = platform === 'macos'
    ? [
        path.join(home, 'Library', 'Application Support', 'Steam', 'steamapps', 'common', 'Baldurs Gate 3', 'Baldur\'s Gate 3.app', 'Contents', 'Data', 'Localization'),
        path.join(home, 'Library', 'Application Support', 'Steam', 'steamapps', 'common', 'Baldurs Gate 3', 'Baldur\'s Gate 3.app', 'Contents', 'Resources', 'Data', 'Localization'),
        path.join(home, 'Library', 'Application Support', 'Steam', 'steamapps', 'common', 'Baldur\'s Gate 3', 'Baldur\'s Gate 3.app', 'Contents', 'Data', 'Localization'),
        path.join(home, 'Library', 'Application Support', 'Steam', 'steamapps', 'common', 'Baldur\'s Gate 3', 'Data', 'Localization')
      ]
    : [
        path.join('C:', 'Program Files (x86)', 'Steam', 'steamapps', 'common', 'Baldurs Gate 3', 'Data', 'Localization'),
        path.join('C:', 'Program Files', 'Steam', 'steamapps', 'common', 'Baldurs Gate 3', 'Data', 'Localization'),
        path.join(home, 'AppData', 'Local', 'Programs', 'Steam', 'steamapps', 'common', 'Baldurs Gate 3', 'Data', 'Localization')
      ]

  const localizationDir = candidates.find((candidate) => fs.existsSync(candidate))
  if (!localizationDir) {
    throw new Error(`Baldur's Gate 3 Localization folder was not found. Checked: ${candidates.join(' | ')}`)
  }

  const englishPath = path.join(localizationDir, 'English.pak')
  // Keep the backup outside the game's .pak scan. BG3 can load every .pak in
  // this directory, so an `EnglishOld.pak` backup may override translations.
  const backupPath = path.join(localizationDir, 'EnglishOld.pak.bak')
  const legacyBackupPath = path.join(localizationDir, 'EnglishOld.pak')
  const tempDir = createTempDir('icosa_inject')
  const tempPak = path.join(tempDir, 'English.pak')
  let backupCreated = false

  try {
    await exportLocalizationPak(entries, tempPak)
    if (fs.existsSync(legacyBackupPath) && !fs.existsSync(backupPath)) {
      fs.renameSync(legacyBackupPath, backupPath)
    }
    if (fs.existsSync(englishPath) && !fs.existsSync(backupPath)) {
      fs.renameSync(englishPath, backupPath)
      backupCreated = true
    } else if (fs.existsSync(englishPath)) {
      fs.rmSync(englishPath, { force: true })
    }
    fs.copyFileSync(tempPak, englishPath)
    return { pakPath: englishPath, backupCreated }
  } finally {
    cleanupTempDir(tempDir)
  }
}

export async function prepareTranslationInput(
  inputPath: string
): Promise<PreparedTranslationInput> {
  const ext = path.extname(inputPath).toLowerCase()
  const importId = randomUUID()

  if (ext === '.xml') {
    const candidate = inspectXmlCandidate(inputPath, inputPath, 'direct')
    stagedImports.set(importId, {
      inputPath,
      tempDirs: [],
      candidates: [candidate],
      metaPath: null
    })
    return { importId, requiresSelection: false, candidates: [candidate] }
  }

  const tempDir = createTempDir('icosa_import')
  const tempDirs = [tempDir]
  fs.mkdirSync(tempDir, { recursive: true })

  try {
    let pakPath = inputPath
    if (ext === '.zip') {
      const archiveDir = path.join(tempDir, 'archive')
      extract(inputPath, archiveDir)
      const pak = findPakFiles(archiveDir)[0]
      if (!pak) throw new Error('No .pak file found inside zip')
      pakPath = pak
    } else if (ext !== '.pak') {
      throw new Error(`Unsupported file type: ${ext}. Use .xml, .pak, or .zip`)
    }

    const unpackedDir = path.join(tempDir, 'unpacked')
    fs.mkdirSync(unpackedDir, { recursive: true })
    await unpackMod(pakPath, unpackedDir)

    const xmlPaths = findLocalizationXmlsDeep(unpackedDir)
    const candidates = xmlPaths.map((xmlPath, index) =>
      inspectXmlCandidate(xmlPath, unpackedDir, `candidate-${index}`)
    )
    const metaPath = findMetaLsx(unpackedDir)

    if (candidates.length === 0) {
      throw new Error('No localization XML files found in package')
    }

    stagedImports.set(importId, {
      inputPath,
      tempDirs,
      candidates,
      metaPath
    })

    return { importId, requiresSelection: true, candidates }
  } catch (err) {
    cleanupTempDir(tempDir)
    throw err
  }
}

export function getStagedCandidate(
  importId: string,
  candidateId: string
): TranslationXmlCandidate | undefined {
  const staged = stagedImports.get(importId)
  if (!staged) return undefined
  return staged.candidates.find((candidate) => candidate.id === candidateId)
}

export function discardTranslationInput(importId: string): void {
  const staged = stagedImports.get(importId)
  if (!staged) return
  stagedImports.delete(importId)
  for (const dir of staged.tempDirs) cleanupTempDir(dir)
}

export function completeTranslationImport(
  repos: RepositoryRegistry,
  params: {
    importId: string
    candidateIds: string[]
    modName: string
    targetLang: string
  }
): CompleteTranslationImportResult {
  const staged = stagedImports.get(params.importId)
  if (!staged) throw new Error('Import session expired. Select the file again.')

  const requestedIds = new Set(params.candidateIds)
  if (requestedIds.size === 0) throw new Error('No valid XML found')

  const candidates = staged.candidates.filter((candidate) => requestedIds.has(candidate.id))
  if (candidates.length !== requestedIds.size) throw new Error('Selected XML was not found')
  if (candidates.some((candidate) => !candidate.valid)) {
    throw new Error('Selected XML has an invalid format')
  }

  const modDir = getStoredModDir(params.modName)
  fs.mkdirSync(modDir, { recursive: true })

  const mergedEntries = candidates.flatMap((candidate) => parseLocalizationXml(candidate.absolutePath))
  const xmlPath = path.join(modDir, 'translation_merged.xml')
  writeLocalizationXml(mergedEntries, xmlPath)

  repos.mod.upsert(params.modName, {
    totalStrings: mergedEntries.length,
    lastFilePath: xmlPath
  })

  const meta = buildDefaultMeta(repos, {
    modName: params.modName,
    targetLang: params.targetLang,
    sourceMetaPath: staged.metaPath,
    outputPath: path.join(modDir, 'meta.lsx')
  })
  const savedMeta = repos.modMeta.upsertForModName(params.modName, meta)

  discardTranslationInput(params.importId)
  return { xmlPath, meta: savedMeta }
}

export function getMetaForMod(
  repos: RepositoryRegistry,
  params: { modName: string; targetLang: string }
): MetaInfo {
  const existing = repos.modMeta.findByModName(params.modName)
  if (existing) return existing

  return buildDefaultMeta(repos, {
    modName: params.modName,
    targetLang: params.targetLang,
    outputPath: path.join(getStoredModDir(params.modName), 'meta.lsx')
  })
}

export function upsertMetaForMod(
  repos: RepositoryRegistry,
  modName: string,
  input: MetaInfo
): MetaInfo {
  validateMetaInput(input)
  repos.mod.upsert(modName)
  const version = {
    major: input.versionMajor,
    minor: input.versionMinor,
    revision: input.versionRevision,
    build: input.versionBuild
  }
  const meta = writeMeta({
    sourcePath: input.metaFilePath,
    outputPath: input.metaFilePath,
    name: input.name,
    folder: input.folder,
    author: input.author,
    description: input.description,
    uuid: input.uuid,
    version,
    version64: calculateVersion64(version)
  })
  return repos.modMeta.upsertForModName(modName, meta)
}

export async function exportTranslatedPackage(
  repos: RepositoryRegistry,
  payload: ExportPackagePayload
): Promise<{ outputPath: string }> {
  const meta = upsertMetaForMod(repos, payload.modName, payload.meta)
  if (!/^[a-zA-Z0-9]+$/.test(payload.bg3LanguageFolder)) {
    throw new Error('BG3 language folder must not contain spaces or special characters')
  }

  const tempDir = createTempDir('icosa_export')
  fs.mkdirSync(tempDir, { recursive: true })

  try {
    const packageRoot = path.join(tempDir, meta.folder)
    const modRoot = path.join(packageRoot, 'Mods', meta.folder)
    const localizationDir = path.join(modRoot, 'Localization', payload.bg3LanguageFolder)
    const originalXmlName = readOriginalXmlName(repos, payload.modName, meta.folder)
    const exportXmlPath = path.join(localizationDir, originalXmlName)
    const exportMetaPath = path.join(modRoot, 'meta.lsx')

    const locEntries = payload.entries.map((entry) => ({
      contentuid: entry.uid,
      version: entry.version,
      text: encodeEntities(entry.target || entry.source)
    }))
    writeLocalizationXml(locEntries, exportXmlPath)
    writeMeta({
      sourcePath: meta.metaFilePath,
      outputPath: exportMetaPath,
      name: meta.name,
      folder: meta.folder,
      author: meta.author,
      description: meta.description,
      uuid: meta.uuid,
      version: {
        major: meta.versionMajor,
        minor: meta.versionMinor,
        revision: meta.versionRevision,
        build: meta.versionBuild
      },
      version64: meta.version64
    })

    const pakOutput =
      payload.format === 'pak'
        ? payload.outputPath
        : path.join(tempDir, 'zipRoot', `${meta.folder}.pak`)
    fs.mkdirSync(path.dirname(pakOutput), { recursive: true })
    await packMod(packageRoot, pakOutput)

    if (payload.format === 'zip') {
      createZip(path.dirname(pakOutput), payload.outputPath)
    }

    return { outputPath: payload.outputPath }
  } finally {
    cleanupTempDir(tempDir)
  }
}

function buildDefaultMeta(
  repos: RepositoryRegistry,
  params: {
    modName: string
    targetLang: string
    outputPath: string
    sourceMetaPath?: string | null
  }
): MetaInfo {
  const targetLanguage = repos.language.findByCode(params.targetLang)
  const targetName = targetLanguage?.name ?? params.targetLang
  const targetSuffix = params.targetLang.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  const defaultName = `${params.modName} ${targetSuffix}`.trim()
  const defaultFolder = sanitizeMetaFolder(defaultName)
  const original =
    params.sourceMetaPath && fs.existsSync(params.sourceMetaPath)
      ? readMetaInfo(params.sourceMetaPath)
      : null
  const version = original
    ? {
        major: original.versionMajor,
        minor: original.versionMinor,
        revision: original.versionRevision,
        build: original.versionBuild
      }
    : { major: 1, minor: 0, revision: 0, build: 1 }
  const version64 = original?.version64 ?? calculateVersion64(version)

  return writeMeta({
    sourcePath: params.sourceMetaPath ?? undefined,
    outputPath: params.outputPath,
    name: defaultName,
    folder: defaultFolder,
    author: readDefaultAuthor(repos),
    description: `${targetName} Translation`,
    uuid: randomUUID(),
    version,
    version64
  })
}

function validateMetaInput(meta: MetaInfo): void {
  if (!isValidMetaFolder(meta.folder)) {
    throw new Error('Folder must contain only letters, numbers, underscores, or hyphens')
  }
  const versionText = formatVersion({
    major: meta.versionMajor,
    minor: meta.versionMinor,
    revision: meta.versionRevision,
    build: meta.versionBuild
  })
  parseVersionString(versionText)
}

function readDefaultAuthor(repos: RepositoryRegistry): string {
  const row = repos.db.select().from(config).where(eq(config.key, 'author')).get() as
    | { value: string | null }
    | undefined
  return row?.value?.trim() || 'Icosa'
}

function readOriginalXmlName(
  repos: RepositoryRegistry,
  modName: string,
  fallbackFolder: string
): string {
  const lastFilePath = repos.mod.findByName(modName)?.lastFilePath
  const fileName = lastFilePath ? path.basename(lastFilePath) : ''
  return fileName.toLowerCase().endsWith('.xml') ? fileName : `${fallbackFolder}.xml`
}

export function getStoredModDir(modName: string): string {
  return path.join(app.getPath('userData'), 'icosa', 'mods', sanitizeStoredModName(modName))
}

function sanitizeStoredModName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100)
}

function inspectXmlCandidate(
  xmlPath: string,
  rootDir: string,
  id: string
): TranslationXmlCandidate {
  const stat = fs.statSync(xmlPath)
  let stringCount = 0
  try {
    stringCount = parseLocalizationXml(xmlPath).length
  } catch {
    stringCount = 0
  }
  return {
    id,
    absolutePath: xmlPath,
    relativePath: relativeFromLocalization(xmlPath, rootDir),
    stringCount,
    sizeKb: Number((stat.size / 1024).toFixed(1)),
    valid: stringCount > 0,
    status: stringCount > 0 ? 'valid' : 'invalid'
  }
}

function findLocalizationXmlsDeep(dir: string): string[] {
  const results: string[] = []
  if (!fs.existsSync(dir)) return results
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...findLocalizationXmlsDeep(full))
    } else if (entry.name.toLowerCase().endsWith('.xml') && isInsideLocalization(full)) {
      results.push(full)
    }
  }
  return results.sort((a, b) => a.localeCompare(b))
}

function isInsideLocalization(filePath: string): boolean {
  return filePath.split(/[\\/]/).includes('Localization')
}

function relativeFromLocalization(filePath: string, rootDir: string): string {
  const parts = path.relative(rootDir, filePath).split(/[\\/]/)
  const localizationIndex = parts.indexOf('Localization')
  if (localizationIndex === -1) return path.basename(filePath)
  return parts.slice(localizationIndex).join(path.sep)
}

function findMetaLsx(dir: string): string | null {
  if (!fs.existsSync(dir)) return null
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      const found = findMetaLsx(full)
      if (found) return found
    } else if (entry.name === 'meta.lsx') {
      return full
    }
  }
  return null
}
