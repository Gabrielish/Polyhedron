// Read Chromium's LevelDB files without opening/locking/mutating the app profile.
// Export only the Creature Guide image key, never account/project settings.
// Usage: node scripts/export-creature-images.cjs <Local Storage/leveldb> [--export]
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
function integer(bytes, state) {
  let value = 0; let shift = 0
  for (let count = 0; count < 10; count++) { assert(state.offset < bytes.length); const byte = bytes[state.offset++]; value += (byte & 127) * 2 ** shift; if (!(byte & 128)) return value; shift += 7 }
  throw new Error('Invalid LevelDB varint')
}
function unsnappy(bytes) {
  const state = { offset:0 }; const output = Buffer.alloc(integer(bytes,state)); let position = 0
  while (state.offset < bytes.length) {
    const tag = bytes[state.offset++]; let length; let distance
    if ((tag & 3) === 0) {
      length = tag >> 2
      if (length < 60) length++
      else { const count = length - 59; length = 0; for (let i = 0; i < count; i++) length += bytes[state.offset++] * 2 ** (i * 8); length++ }
      assert(state.offset + length <= bytes.length && position + length <= output.length)
      bytes.copy(output,position,state.offset,state.offset + length); state.offset += length; position += length
    } else {
      if ((tag & 3) === 1) { length = 4 + ((tag >> 2) & 7); distance = ((tag & 224) << 3) + bytes[state.offset++] }
      else if ((tag & 3) === 2) { length = 1 + (tag >> 2); distance = bytes.readUInt16LE(state.offset); state.offset += 2 }
      else { length = 1 + (tag >> 2); distance = bytes.readUInt32LE(state.offset); state.offset += 4 }
      assert(distance > 0 && distance <= position && position + length <= output.length)
      for (let i = 0; i < length; i++) { output[position] = output[position - distance]; position++ }
    }
  }
  assert.equal(position,output.length); return output
}
function blockEntries(bytes) {
  const end = bytes.length - 4 - bytes.readUInt32LE(bytes.length - 4) * 4
  const state = { offset:0 }; let key = Buffer.alloc(0); const entries = []
  while (state.offset < end) {
    const shared = integer(bytes,state); const added = integer(bytes,state); const size = integer(bytes,state)
    assert(shared <= key.length && state.offset + added + size <= end)
    key = Buffer.concat([key.subarray(0,shared),bytes.subarray(state.offset,state.offset + added)])
    state.offset += added; const value = bytes.subarray(state.offset,state.offset + size); state.offset += size; entries.push({key,value})
  }
  return entries
}
function tableEntries(bytes) {
  assert(bytes.length >= 48 && bytes.readBigUInt64LE(bytes.length - 8) === 0xdb4775248b80fb57n,'Invalid SST file')
  const footer = { offset:bytes.length - 48 }
  integer(bytes,footer); integer(bytes,footer) // metaindex handle
  const read = state => {
    const offset = integer(bytes,state); const length = integer(bytes,state)
    const content = bytes.subarray(offset,offset + length); const compression = bytes[offset + length]
    assert(compression === 0 || compression === 1,'Unsupported compression')
    return compression === 1 ? unsnappy(content) : content
  }
  const index = blockEntries(read(footer)); const result = []
  for (const entry of index) {
    // Block handles are encoded in the index value, not in the table bytes.
    const state = { offset:0 }; const offset = integer(entry.value,state); const length = integer(entry.value,state)
    const raw = bytes.subarray(offset,offset + length)
    const block = bytes[offset + length] === 1 ? unsnappy(raw) : raw
    for (const item of blockEntries(block)) result.push({ ...item, sequence:item.key.readBigUInt64LE(item.key.length - 8) >> 8n, deleted:item.key[item.key.length - 8] === 0, key:item.key.subarray(0,-8) })
  }
  return result
}
function logEntries(bytes) {
  const records = []; let fragments = []
  for (let base = 0; base < bytes.length; base += 32768) {
    let offset = base
    while (offset + 7 <= Math.min(base + 32768,bytes.length)) {
      const size = bytes.readUInt16LE(offset + 4); const type = bytes[offset + 6]; offset += 7
      if (!size || offset + size > Math.min(base + 32768,bytes.length)) break
      const piece = bytes.subarray(offset,offset + size); offset += size
      if (type === 1) records.push(piece)
      else if (type === 2) fragments = [piece]
      else if (type === 3) fragments.push(piece)
      else if (type === 4) { fragments.push(piece); records.push(Buffer.concat(fragments)); fragments = [] }
    }
  }
  const entries = []
  for (const record of records) {
    const sequence = record.readBigUInt64LE(0); const count = record.readUInt32LE(8); const state = { offset:12 }
    for (let i = 0; i < count; i++) {
      const type = record[state.offset++]; const keySize = integer(record,state); const key = record.subarray(state.offset,state.offset + keySize); state.offset += keySize
      const size = type === 1 ? integer(record,state) : 0; const value = record.subarray(state.offset,state.offset + size); state.offset += size
      entries.push({key,value,sequence:sequence + BigInt(i),deleted:type === 0})
    }
  }
  return entries
}
function readImages(directory) {
  let newest = null
  for (const filename of fs.readdirSync(directory)) {
    if (!/^\d+\.(?:ldb|log)$/.test(filename)) continue
    const bytes = fs.readFileSync(path.join(directory,filename))
    const entries = filename.endsWith('.ldb') ? tableEntries(bytes) : logEntries(bytes)
    for (const entry of entries) if (entry.key.toString('latin1').endsWith('\x01polyhedron-creature-images') && (!newest || entry.sequence > newest.sequence)) newest = entry
  }
  if (!newest || newest.deleted) throw new Error('No saved Creature Guide image collection found in this profile.')
  const text = newest.value.subarray(1).toString(newest.value[0] === 0 ? 'utf16le' : 'latin1')
  const images = JSON.parse(text); assert(images && typeof images === 'object' && !Array.isArray(images))
  return images
}
if (require.main === module) {
  const directory = process.argv[2]; assert(directory,'Pass the exact Chromium local storage LevelDB directory')
  const images = readImages(directory)
  const output = path.resolve(__dirname,'../src/renderer/src/assets/creatures')
  const exported = []
  for (const [id,source] of Object.entries(images)) {
    assert(/^[a-z0-9-]+$/.test(id),'Invalid creature ID')
    const match = typeof source === 'string' && source.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/)
    assert(match,'Only locally saved image data is exported')
    const bytes = Buffer.from(match[2],'base64'); const extension = match[1] === 'jpeg' ? 'jpg' : match[1]
    assert(bytes.length > 12 && bytes.length < 5 * 1024 * 1024)
    if (process.argv.includes('--export')) { fs.mkdirSync(output,{recursive:true}); fs.writeFileSync(path.join(output,id + '.' + extension),bytes) }
    exported.push({id,format:extension,bytes:bytes.length})
  }
  console.log(JSON.stringify({count:exported.length,images:exported},null,2))
}
module.exports = { readImages, unsnappy, blockEntries }
