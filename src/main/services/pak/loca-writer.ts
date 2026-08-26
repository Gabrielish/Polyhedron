import fs from 'node:fs'
import path from 'node:path'
import { decodeEntities } from '../xml-entities.service'

export interface LocaEntry {
  key: string
  version: number | string
  text: string
}

const LOCA_SIGNATURE = 0x41434f4c
const LOCA_HEADER_SIZE = 12
const LOCA_ENTRY_SIZE = 70 // 64-byte key + uint16 version + uint32 text length

/** Write the BG3 LOCA binary format used by LSLib's LocaWriter. */
export function writeLoca(entries: LocaEntry[], outputPath: string): void {
  const table = Buffer.alloc(entries.length * LOCA_ENTRY_SIZE)
  const textBuffers = entries.map((entry, index) => {
    const key = Buffer.from(entry.key, 'utf8')
    if (key.length > 64) throw new Error(`Localization UID is longer than 64 bytes: ${entry.key}`)
    key.copy(table, index * LOCA_ENTRY_SIZE)
    table.writeUInt16LE(Number(entry.version) || 1, index * LOCA_ENTRY_SIZE + 64)

    const text = Buffer.from(decodeEntities(entry.text), 'utf8')
    const lengthOffset = index * LOCA_ENTRY_SIZE + 66
    table.writeUInt32LE(text.length + 1, lengthOffset)
    return Buffer.concat([text, Buffer.from([0])])
  })

  const header = Buffer.alloc(LOCA_HEADER_SIZE)
  header.writeUInt32LE(LOCA_SIGNATURE, 0)
  header.writeUInt32LE(entries.length, 4)
  header.writeUInt32LE(LOCA_HEADER_SIZE + table.length, 8)

  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, Buffer.concat([header, table, ...textBuffers]))
}
