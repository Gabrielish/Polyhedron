import { ipcMain } from 'electron'
import { eq, sql } from 'drizzle-orm'
import { getDb } from '../database/connection'
import { config } from '../database/schema'
import { isSecretConfigKey, STORED_SECRET_MARKER } from '../../shared/secret-config'
import { encryptSecret } from '../services/secret-storage.service'

const GEMINI_MODEL_DEFAULT = 'gemini-3.6-flash'

function migrateGeminiModel(value: string | null | undefined): string | null | undefined {
  return value && /^models\/?gemini-2\./i.test(value) ? GEMINI_MODEL_DEFAULT : value
}

export function registerConfigHandlers(onIconAppearanceChange?: () => void): void {
  ipcMain.handle('config:get', (_event, { key }: { key: string }) => {
    const db = getDb()
    const row = db.select().from(config).where(eq(config.key, key)).get() as
      | { key: string; value: string | null }
      | undefined
    const value = key === 'gemini_model' ? migrateGeminiModel(row?.value) : row?.value
    if (key === 'gemini_model' && value !== row?.value) {
      db.update(config).set({ value: GEMINI_MODEL_DEFAULT }).where(eq(config.key, key)).run()
    }
    return { value: isSecretConfigKey(key) ? (row?.value ? STORED_SECRET_MARKER : '') : value ?? null }
  })

  ipcMain.handle('config:set', (_event, { key, value }: { key: string; value: string }) => {
    if (typeof key !== 'string' || typeof value !== 'string' || key.length > 100 || value.length > 100000) throw new Error('Invalid setting')
    if (isSecretConfigKey(key) && value === STORED_SECRET_MARKER) return { success: true }
    const db = getDb()
    db.insert(config)
      .values({ key, value: isSecretConfigKey(key) ? encryptSecret(value.trim()) : value })
      .onConflictDoUpdate({
        target: config.key,
        set: { value: sql`excluded.value` }
      })
      .run()
    if (key === 'theme_accent' || key === 'theme_app_icon_style' || key === 'theme_accent_foreground') onIconAppearanceChange?.()
    return { success: true }
  })

  ipcMain.handle('config:getAll', () => {
    const db = getDb()
    const rows = db.select().from(config).all() as { key: string; value: string | null }[]
    const geminiModel = rows.find((row) => row.key === 'gemini_model')
    const migratedGeminiModel = migrateGeminiModel(geminiModel?.value)
    if (geminiModel && migratedGeminiModel !== geminiModel.value) {
      db.update(config).set({ value: GEMINI_MODEL_DEFAULT }).where(eq(config.key, 'gemini_model')).run()
      geminiModel.value = GEMINI_MODEL_DEFAULT
    }
    return Object.fromEntries(rows.map((r) => [r.key, isSecretConfigKey(r.key) ? (r.value ? STORED_SECRET_MARKER : '') : r.value ?? '']))
  })
}
