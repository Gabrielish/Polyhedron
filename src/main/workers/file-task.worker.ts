import fs from 'node:fs'
import path from 'node:path'
import { parentPort, workerData } from 'node:worker_threads'
import AdmZip from 'adm-zip'
import type { FileTask } from '../services/file-task.service'

const task = workerData as FileTask
let result: unknown = null
if (task.kind === 'save-session') {
  fs.mkdirSync(path.dirname(task.filePath), { recursive: true })
  const temporaryPath = `${task.filePath}.pending`
  try {
    fs.writeFileSync(temporaryPath, JSON.stringify({ version: 1, entries: task.entries }), 'utf8')
    fs.renameSync(temporaryPath, task.filePath)
  } finally {
    if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath)
  }
} else if (task.kind === 'load-session') {
  try {
    const parsed = JSON.parse(fs.readFileSync(task.filePath, 'utf8'))
    result = Array.isArray(parsed.entries) ? parsed.entries : null
  } catch {
    result = null
  }
} else if (task.kind === 'zip') {
  const zip = new AdmZip()
  zip.addLocalFolder(task.sourceDir)
  zip.writeZip(task.outputPath)
} else {
  new AdmZip(task.inputPath).extractAllTo(task.destinationDir, true)
}
parentPort!.postMessage(result)
