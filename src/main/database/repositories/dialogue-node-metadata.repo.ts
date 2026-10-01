import { eq, inArray } from 'drizzle-orm'
import type { drizzle } from 'drizzle-orm/better-sqlite3'
import {
  dialogueNodeMetadata,
  type DialogueNodeMetadata,
  type NewDialogueNodeMetadata
} from '../schema'

type AppDb = ReturnType<typeof drizzle>

export class DialogueNodeMetadataRepository {
  constructor(private db: AppDb) {}

  list(dialogue: string): DialogueNodeMetadata[] {
    return this.db
      .select()
      .from(dialogueNodeMetadata)
      .where(eq(dialogueNodeMetadata.dialogue, dialogue))
      .all() as DialogueNodeMetadata[]
  }

  listByDialogues(dialogues: string[], speaker?: string): DialogueNodeMetadata[] {
    const unique = [...new Set(dialogues)]
    if (unique.length === 0) return []
    const rows: DialogueNodeMetadata[] = []
    for (let offset = 0; offset < unique.length; offset += 500) {
      const chunk = unique.slice(offset, offset + 500)
      const query = this.db
        .select()
        .from(dialogueNodeMetadata)
        .where(inArray(dialogueNodeMetadata.dialogue, chunk))
      const result = query.all() as DialogueNodeMetadata[]
      rows.push(...(speaker ? result.filter((row) => row.speaker === speaker) : result))
    }
    return rows
  }

  listSpeakers(): string[] {
    const rows = this.db
      .select({ speaker: dialogueNodeMetadata.speaker })
      .from(dialogueNodeMetadata)
      .all() as Array<{ speaker: string | null }>
    return [...new Set(rows.map((row) => row.speaker).filter((speaker): speaker is string => Boolean(speaker)))]
  }

  upsertMany(rows: NewDialogueNodeMetadata[]): void {
    if (rows.length === 0) return
    this.db.transaction((tx) => {
      for (let offset = 0; offset < rows.length; offset += 500) {
        tx
          .insert(dialogueNodeMetadata)
          .values(rows.slice(offset, offset + 500))
          .onConflictDoNothing({ target: [dialogueNodeMetadata.dialogue, dialogueNodeMetadata.nodeId] })
          .run()
      }
    })
  }
}
