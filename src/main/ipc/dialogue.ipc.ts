import fs from 'node:fs'
import path from 'node:path'
import { BrowserWindow, ipcMain } from 'electron'
import type { RepositoryRegistry } from '../database/repositories/registry'
import type { NewDialogueNodeMetadata } from '../database/schema'

const DIALOGUE_SITE = 'https://bg3.game-script.com/files/'
const DIALOGUE_API = 'https://bg3.game-script.com/api/graphql'

type CachedDialogueNode = {
  id?: string
  textContent?: string | null
  constructor?: string | null
  nextNodes?: Array<{ id?: string }>
  speaker?: { name?: string | null; displayName?: string | null; internalName?: string | null }
}

type DialogueMetadata = { speaker?: string; category?: string }

let dialogueCache: Record<string, CachedDialogueNode[]> | null | undefined
let dialogueDatabaseHydration: Promise<void> | null = null

function loadDialogueCache(): Record<string, CachedDialogueNode[]> | null {
  if (dialogueCache !== undefined) return dialogueCache
  const candidates = [
    path.join(process.cwd(), 'data', 'dialogue-metadata-cache.json'),
    path.join(process.resourcesPath, 'dialogue-metadata-cache.json')
  ]
  for (const filename of candidates) {
    try {
      if (!fs.existsSync(filename)) continue
      dialogueCache = JSON.parse(fs.readFileSync(filename, 'utf8')) as Record<
        string,
        CachedDialogueNode[]
      >
      return dialogueCache
    } catch {
      // Try the next location; an unavailable cache can still use the API fallback.
    }
  }
  dialogueCache = null
  return null
}

function decodeNodeId(value: string | undefined): string {
  if (!value) return ''
  try {
    const decoded = Buffer.from(value, 'base64').toString('utf8')
    return decoded.startsWith('DialogueNode:') ? decoded.slice('DialogueNode:'.length) : decoded
  } catch {
    return value
  }
}

const categoryLabels: Record<string, string> = {
  TagGreeting: 'Greeting',
  TagQuestion: 'Question',
  TagAnswer: 'Answer',
  TagCinematic: 'Cinematic',
  ActiveRoll: 'Roll',
  PassiveRoll: 'Passive Roll',
  RollResult: 'Roll Result',
  Jump: 'Jump',
  Alias: 'Alias',
  FallThrough: 'Fallthrough',
  Pop: 'Pop',
  NestedDialog: 'Nested',
  'Nested Dialog': 'Nested',
  Trade: 'Trade',
  VisualState: 'Visual State'
}

function metadataFromCache(
  filename: string,
  requestedSpeaker?: string
): Record<string, DialogueMetadata> | null {
  const nodes = loadDialogueCache()?.[filename]
  if (!nodes) return null
  const result: Record<string, DialogueMetadata> = {}
  nodes.forEach((item, index) => {
    const speaker = item.speaker?.displayName || item.speaker?.name || item.speaker?.internalName
    const category = item.constructor ? categoryLabels[item.constructor] : undefined
    if (requestedSpeaker && speaker !== requestedSpeaker) return
    if (!speaker && !category) return
    const metadata = { ...(speaker ? { speaker } : {}), ...(category ? { category } : {}) }
    result[`__ordered:${index}`] = metadata
    const nodeId = decodeNodeId(item.id)
    if (nodeId) result[nodeId] = metadata
  })
  return result
}

function cacheRows(): NewDialogueNodeMetadata[] {
  const rows: NewDialogueNodeMetadata[] = []
  for (const [dialogue, nodes] of Object.entries(loadDialogueCache() ?? {})) {
    for (const item of nodes) {
      const nodeId = decodeNodeId(item.id)
      if (!nodeId) continue
      const speaker = item.speaker?.displayName || item.speaker?.name || item.speaker?.internalName
      rows.push({
        dialogue,
        nodeId,
        textContent: item.textContent ?? null,
        speaker: speaker ?? null,
        constructor: item.constructor ?? null,
        category: item.constructor ? categoryLabels[item.constructor] ?? null : null,
        nextNodeIds: JSON.stringify((item.nextNodes ?? []).map((next) => decodeNodeId(next.id)).filter(Boolean))
      })
    }
  }
  return rows
}

function ensureDialogueMetadataDatabase(repos: RepositoryRegistry): Promise<void> {
  if (!dialogueDatabaseHydration) {
    dialogueDatabaseHydration = Promise.resolve().then(() => {
      const rows = cacheRows()
      repos.dialogueNodeMetadata.upsertMany(rows)
    })
  }
  return dialogueDatabaseHydration
}

function safeDialogueName(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_% .-]+$/.test(value)) {
    throw new Error('Invalid dialogue name')
  }
  return value
}

export function registerDialogueHandlers(
  getParentWindow: () => BrowserWindow | null,
  repos: RepositoryRegistry
): void {
  ipcMain.handle('dialogue:allSpeakers', async () => {
    await ensureDialogueMetadataDatabase(repos)
    const persisted = repos.dialogueNodeMetadata.listSpeakers()
    if (persisted.length > 0) return persisted
    const response = await fetch(DIALOGUE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: '{ speakers { displayName name internalName } }'
      })
    })
    if (!response.ok) throw new Error(`Speaker list lookup failed (${response.status})`)
    const payload = (await response.json()) as {
      data?: {
        speakers?: Array<{
          displayName?: string | null
          name?: string | null
          internalName?: string | null
        }>
      }
    }
    return [
      ...new Set(
        (payload.data?.speakers ?? [])
          .map((speaker) => speaker.displayName || speaker.name || speaker.internalName)
          .filter((speaker): speaker is string => Boolean(speaker))
      )
    ]
  })

  ipcMain.handle('dialogue:speakers', async (_event, dialogueName: unknown) => {
    const filename = safeDialogueName(dialogueName)
    await ensureDialogueMetadataDatabase(repos)
    const cached = repos.dialogueNodeMetadata.list(filename)
    if (cached.length > 0) {
      const result: Record<string, { speaker?: string; category?: string }> = {}
      cached.forEach((node, index) => {
        const metadata = {
          ...(node.speaker ? { speaker: node.speaker } : {}),
          ...(node.category ? { category: node.category } : {})
        }
        result[node.nodeId] = metadata
        result[`__ordered:${index}`] = metadata
      })
      return result
    }
    const downloaded = metadataFromCache(filename)
    if (downloaded) return downloaded
    const response = await fetch(DIALOGUE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query:
          'query GetFileNodeMetadata($filename: String!) { fileByFilename(filename: $filename) { nodes { id textContent constructor nextNodes { id } speaker { name displayName internalName } } } }',
        variables: { filename }
      })
    })
    if (!response.ok) throw new Error(`Speaker lookup failed (${response.status})`)
    const payload = (await response.json()) as {
      data?: {
        fileByFilename?: {
          nodes?: Array<{
            id?: string
            textContent?: string | null
            constructor?: string | null
            nextNodes?: Array<{ id?: string }>
            speaker?: {
              name?: string | null
              displayName?: string | null
              internalName?: string | null
            }
          }>
        }
      }
    }
    const speakers: Record<string, { speaker?: string; category?: string }> = {}
    const metadataRows: NewDialogueNodeMetadata[] = []
    let orderedIndex = 0
    for (const item of payload.data?.fileByFilename?.nodes ?? []) {
      if (!item.id) continue
      const nodeId = decodeNodeId(item.id)
      const name = item.speaker?.displayName || item.speaker?.name || item.speaker?.internalName
      const category = item.constructor ? categoryLabels[item.constructor] : undefined
      if (name || category) {
        speakers[`__ordered:${orderedIndex}`] = { ...(name ? { speaker: name } : {}), ...(category ? { category } : {}) }
        if (nodeId) speakers[nodeId] = { ...(name ? { speaker: name } : {}), ...(category ? { category } : {}) }
      }
      orderedIndex += 1
      if (nodeId) {
        metadataRows.push({
          dialogue: filename,
          nodeId,
          textContent: item.textContent ?? null,
          speaker: name ?? null,
          constructor: item.constructor ?? null,
          category: category ?? null,
          nextNodeIds: JSON.stringify(
            (item.nextNodes ?? [])
              .map((next) => next.id)
              .filter((id): id is string => Boolean(id))
              .map((id) => {
                const decodedNext = Buffer.from(id, 'base64').toString('utf8')
                return decodedNext.startsWith('DialogueNode:')
                  ? decodedNext.slice('DialogueNode:'.length)
                  : decodedNext
              })
          )
        })
      }
    }
    repos.dialogueNodeMetadata.upsertMany(metadataRows)
    return speakers
  })

  ipcMain.handle('dialogue:speakersBatch', async (_event, payload: unknown) => {
    const dialogueNames =
      payload && typeof payload === 'object' && 'dialogueNames' in payload
        ? (payload as { dialogueNames: unknown; speaker?: unknown }).dialogueNames
        : payload
    const requestedSpeaker =
      payload && typeof payload === 'object' && 'speaker' in payload
        ? (payload as { speaker?: unknown }).speaker
        : undefined
    if (!Array.isArray(dialogueNames)) throw new Error('Invalid dialogue names')
    const speaker = typeof requestedSpeaker === 'string' ? requestedSpeaker : undefined
    await ensureDialogueMetadataDatabase(repos)
    const rows = repos.dialogueNodeMetadata.listByDialogues(
      dialogueNames.map((value) => safeDialogueName(value)),
      speaker
    )
    const result: Record<string, Record<string, DialogueMetadata>> = {}
    if (rows.length > 0 || loadDialogueCache()) {
      for (const row of rows) {
        const metadata = {
          ...(row.speaker ? { speaker: row.speaker } : {}),
          ...(row.category ? { category: row.category } : {})
        }
        const entry = (result[row.dialogue] ??= {})
        entry[row.nodeId] = metadata
      }
      return result
    }
    for (const value of dialogueNames) {
      const filename = safeDialogueName(value)
      const cachedRows = repos.dialogueNodeMetadata.list(filename)
      if (cachedRows.length > 0) {
        const metadata: Record<string, DialogueMetadata> = {}
        cachedRows.forEach((node, index) => {
          const value = {
            ...(node.speaker ? { speaker: node.speaker } : {}),
            ...(node.category ? { category: node.category } : {})
          }
          metadata[node.nodeId] = value
          metadata[`__ordered:${index}`] = value
        })
        const filtered = speaker
          ? Object.fromEntries(
              Object.entries(metadata).filter(([, value]) => value.speaker === speaker)
            )
          : metadata
        if (!speaker || Object.keys(filtered).length > 0) result[filename] = filtered
        continue
      }
      const metadata = metadataFromCache(filename, speaker)
      if (!metadata) continue
      if (Object.keys(metadata).length > 0) result[filename] = metadata
    }
    return result
  })

  ipcMain.handle('dialogue:open', (_event, dialogueName: unknown) => {
    const dialogue = safeDialogueName(dialogueName)
    const window = new BrowserWindow({
      width: 1400,
      height: 900,
      title: `BG3 Dialogue - ${dialogue}`,
      autoHideMenuBar: true,
      parent: getParentWindow() ?? undefined,
      webPreferences: {
        contextIsolation: true,
        sandbox: true
      }
    })

    window.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('https://bg3.game-script.com/')) return { action: 'allow' }
      return { action: 'deny' }
    })
    void window.loadURL(`${DIALOGUE_SITE}${encodeURIComponent(dialogue)}`)
  })
}
