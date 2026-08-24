import { eq, sql } from 'drizzle-orm'
import type { drizzle } from 'drizzle-orm/better-sqlite3'
import { DEFAULT_PROMPT } from '../../services/ai/prompt-builder'
import { type PromptSlotRow, promptSlot } from '../schema'

type AppDb = ReturnType<typeof drizzle>

const DEFAULT_SLOT_NAME = 'Default · BG3'

// Seed the locked default prompt slot. It is read-only in the UI (editing forks a new slot),
// so the app's DEFAULT_PROMPT constant is the source of truth: when it changes between
// releases, the existing default row is updated to match on startup.
export function seedPromptSlots(db: AppDb): void {
  const existing = db.select().from(promptSlot).where(eq(promptSlot.isDefault, 1)).get() as
    | PromptSlotRow
    | undefined

  if (!existing) {
    db.insert(promptSlot)
      .values({ name: DEFAULT_SLOT_NAME, prompt: DEFAULT_PROMPT, isDefault: 1 })
      .run()
    return
  }

  if (existing.prompt !== DEFAULT_PROMPT || existing.name !== DEFAULT_SLOT_NAME) {
    db.update(promptSlot)
      .set({
        name: DEFAULT_SLOT_NAME,
        prompt: DEFAULT_PROMPT,
        updatedAt: sql`(datetime('now'))`
      })
      .where(eq(promptSlot.id, existing.id))
      .run()
  }
}
