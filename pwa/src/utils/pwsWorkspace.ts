import { unzipSync, strFromU8 } from 'fflate'
import type { SqlJsStatic } from 'sql.js'
import { parseWorkspaceSyncDocument, type WorkspaceSyncDocument } from '../sync/workspaceSync'

const MB = 1024 * 1024
export async function parsePwsWorkspace(bytes: Uint8Array, SQL: SqlJsStatic): Promise<WorkspaceSyncDocument> {
  if (bytes.length > 256 * MB) throw new Error('This workspace is too large for browser import. Please use Google Drive sync or a smaller export.')
  if (bytes[0] !== 80 || bytes[1] !== 75) throw new Error('Invalid .pws file: expected a desktop workspace archive.')
  let total = 0, count = 0
  const paths = new Set<string>()
  const files = unzipSync(bytes, { filter: file => {
    if (++count > 20000) throw new Error('Workspace archive contains too many files.')
    const name = file.name.replaceAll('\\', '/')
    if (name.startsWith('/') || name.split('/').includes('..') || name.includes('\0') || /^[A-Za-z]:/.test(name)) throw new Error('Workspace archive contains an unsafe file path.')
    const needed = /^(polyhedron|icosa)\.db$/.test(name) || name === 'workspace.json' || /^sessions\/[a-f0-9]{64}\.json$/i.test(name) || /^mods\/.+\.xml$/i.test(name)
    if (!needed) return false
    if (paths.has(name)) throw new Error('Workspace archive contains duplicate files.')
    paths.add(name)
    total += file.originalSize
    // Desktop databases also contain reference data and can be larger than
    // individual translation files, even for an otherwise modest export.
    const fileLimit = /^(polyhedron|icosa)\.db$/.test(name) ? 256 * MB : 128 * MB
    if (file.originalSize > fileLimit || total > 512 * MB) throw new Error('Workspace contents are too large for browser import.')
    return true
  } })
  const archive = new Map(Object.entries(files).map(([name, contents]) => [name.replaceAll('\\', '/'), contents]))
  const manifest = archive.get('workspace.json')
  if (!manifest || JSON.parse(strFromU8(manifest)).version !== 1) throw new Error('Unsupported desktop workspace version.')
  const database = archive.get('polyhedron.db') ?? archive.get('icosa.db')
  if (!database) throw new Error('Invalid workspace: polyhedron.db is missing.')
  const db = new SQL.Database(database)
  try {
    db.run('PRAGMA trusted_schema = OFF; PRAGMA query_only = ON;')
    // Read only project metadata and language selection, never credentials or
    // appearance settings. The database stays entirely inside this worker.
    const settings = new Map<string, string>()
    const config = db.prepare("SELECT key, value FROM config WHERE key IN ('last_source_lang', 'last_target_lang')")
    try { while (config.step()) { const row = config.getAsObject(); settings.set(String(row.key), String(row.value ?? '')) } } finally { config.free() }
    const sourceLang = settings.get('last_source_lang') || 'en'
    const targetLang = settings.get('last_target_lang') || 'ro'
    const mods = db.prepare('SELECT name, last_file_path, updated_at FROM mod')
    const projects: Array<{ name: string; path: string; updatedAt: string }> = []
    try { while (mods.step()) { const row = mods.getAsObject(); if (typeof row.last_file_path === 'string' && row.last_file_path) projects.push({ name: String(row.name), path: row.last_file_path, updatedAt: String(row.updated_at ?? '') }) } } finally { mods.free() }
    const sessions = []
    for (const project of projects) {
      const key = `${project.path}|${sourceLang}|${targetLang}`
      const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key)))].map(byte => byte.toString(16).padStart(2, '0')).join('')
      const saved = archive.get(`sessions/${hash}.json`)
      const modFolder = project.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100)
      const fileName = project.path.replaceAll('\\', '/').split('/').at(-1) || 'translation_merged.xml'
      const xml = archive.get(`mods/${modFolder}/${fileName}`)
      const sourceByUid = new Map<string, string>()
      if (xml) {
        // Match the desktop parser: preserve mixed LSTag/font content verbatim.
        for (const match of strFromU8(xml).matchAll(/<content\s+contentuid="([^"]+)"(?:\s+version="[^"]+")?\s*>([\s\S]*?)<\/content>/g)) sourceByUid.set(match[1], match[2])
      }
      const parsed = saved ? JSON.parse(strFromU8(saved)) : undefined
      if (saved && !Array.isArray(parsed?.entries)) throw new Error(`Project ${project.name} has invalid saved translations.`)
      const savedEntries: Array<Record<string, unknown>> = parsed?.entries?.length ? parsed.entries : [...sourceByUid].map(([uid, source]) => ({ uid, source, target: '' }))
      const entries = savedEntries.map(entry => {
        const source = typeof entry.source === 'string' ? entry.source : sourceByUid.get(String(entry.uid))
        return { ...entry, source, sourceMissing: source === undefined || entry.sourceMissing === true }
      })
      if (entries.length) sessions.push({ id: key, modName: project.name, sourceLang, targetLang, updatedAt: project.updatedAt, entries })
    }
    if (!sessions.length) throw new Error('This .pws contains no translation projects that can be opened in the companion.')
    return parseWorkspaceSyncDocument({ version: 1, generatedAt: new Date().toISOString(), fingerprint: '', sessions })
  } finally { db.close() }
}
