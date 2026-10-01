import fs from 'node:fs'

export interface LocaEntry {
  key: string
  version: number
  text: string
}

const LOCA_SIGNATURE = 0x41434f4c
const HEADER_SIZE = 12
const ENTRY_SIZE = 70

/** Read the binary LOCA format used by Baldur's Gate 3. */
export function readLoca(filePath: string): LocaEntry[] {
  const buffer = fs.readFileSync(filePath)
  if (buffer.length < HEADER_SIZE || buffer.readUInt32LE(0) !== LOCA_SIGNATURE) {
    throw new Error(`Invalid LOCA file: ${filePath}`)
  }
  const count = buffer.readUInt32LE(4)
  const tableOffset = buffer.readUInt32LE(8)
  if (tableOffset < HEADER_SIZE || tableOffset + count * ENTRY_SIZE > buffer.length) {
    throw new Error(`Invalid LOCA table: ${filePath}`)
  }
  const textOffset = tableOffset + count * ENTRY_SIZE
  const entries: LocaEntry[] = []
  let cursor = textOffset
  for (let index = 0; index < count; index += 1) {
    const rowOffset = tableOffset + index * ENTRY_SIZE
    const key = buffer.subarray(rowOffset, rowOffset + 64).toString('utf8').split('\0', 1)[0]
    const version = buffer.readUInt16LE(rowOffset + 64)
    const length = buffer.readUInt32LE(rowOffset + 66)
    if (length === 0 || cursor + length > buffer.length) break
    const rawText = buffer.subarray(cursor, cursor + length)
    cursor += length
    if (!key) continue
    const nul = rawText.indexOf(0)
    const text = rawText.subarray(0, nul >= 0 ? nul : rawText.length).toString('utf8')
    entries.push({ key, version, text })
  }
  return entries
}
