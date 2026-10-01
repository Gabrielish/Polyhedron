import { asc, eq, sql } from 'drizzle-orm'
import type { drizzle } from 'drizzle-orm/better-sqlite3'
import type { PromptSlot } from '../../../preload/api-types'
import {
  missingPromptVars,
  reservedPromptHeadings,
  unknownPromptVars
} from '../../../preload/api-types'
import { type PromptSlotRow, promptSlot } from '../schema'

type AppDb = ReturnType<typeof drizzle>

function toPromptSlot(row: PromptSlotRow): PromptSlot {
  return {
    id: row.id,
    name: row.name,
    prompt: row.prompt,
    isDefault: row.isDefault === 1,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null
  }
}

function assertVarsPresent(prompt: string): void {
  const missing = missingPromptVars(prompt)
  if (missing.length > 0) {
    throw new Error(
      `Prompt is missing required variables: ${missing.map((v) => `{${v}}`).join(', ')}`
    )
  }
  const unknown = unknownPromptVars(prompt)
  if (unknown.length > 0) {
    throw new Error(`Prompt contains unknown variables: ${unknown.map((v) => `{${v}}`).join(', ')}`)
  }
  const reserved = reservedPromptHeadings(prompt)
  if (reserved.length > 0) {
    throw new Error(`Prompt contains reserved sections: ${reserved.join(', ')}`)
  }
}

export class PromptSlotRepository {
  constructor(private db: AppDb) {}

  // Default slot first, then by insertion order.
  list(): PromptSlot[] {
    const rows = this.db
      .select()
      .from(promptSlot)
      .orderBy(sql`${promptSlot.isDefault} desc`, asc(promptSlot.id))
      .all() as PromptSlotRow[]
    return rows.map(toPromptSlot)
  }

  getById(id: number): PromptSlot | undefined {
    const row = this.db.select().from(promptSlot).where(eq(promptSlot.id, id)).get() as
      | PromptSlotRow
      | undefined
    return row ? toPromptSlot(row) : undefined
  }

  getDefault(): PromptSlot | undefined {
    const row = this.db.select().from(promptSlot).where(eq(promptSlot.isDefault, 1)).get() as
      | PromptSlotRow
      | undefined
    return row ? toPromptSlot(row) : undefined
  }

  create(params: { name: string; prompt: string }): PromptSlot {
    assertVarsPresent(params.prompt)
    const row = this.db
      .insert(promptSlot)
      .values({ name: params.name.trim() || 'Prompt', prompt: params.prompt, isDefault: 0 })
      .returning()
      .get() as PromptSlotRow
    return toPromptSlot(row)
  }

  // The seeded default is locked; editing it in the UI forks a new slot instead.
  update(params: { id: number; name?: string; prompt?: string }): PromptSlot {
    const existing = this.getById(params.id)
    if (!existing) throw new Error(`Prompt slot ${params.id} not found`)
    if (existing.isDefault) throw new Error('The default prompt cannot be edited')
    if (params.prompt !== undefined) assertVarsPresent(params.prompt)

    const row = this.db
      .update(promptSlot)
      .set({
        name: params.name?.trim() ? params.name.trim() : existing.name,
        prompt: params.prompt ?? existing.prompt,
        updatedAt: sql`(datetime('now'))`
      })
      .where(eq(promptSlot.id, params.id))
      .returning()
      .get() as PromptSlotRow
    return toPromptSlot(row)
  }

  delete(id: number): void {
    const existing = this.getById(id)
    if (!existing) return
    if (existing.isDefault) throw new Error('The default prompt cannot be deleted')
    this.db.delete(promptSlot).where(eq(promptSlot.id, id)).run()
  }
}
