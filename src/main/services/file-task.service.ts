import path from 'node:path'
import { Worker } from 'node:worker_threads'

export type FileTask =
  | { kind: 'save-session'; filePath: string; entries: unknown[] }
  | { kind: 'load-session'; filePath: string }
  | { kind: 'zip'; sourceDir: string; outputPath: string }
  | { kind: 'extract'; inputPath: string; destinationDir: string }

export function runFileTask<T = void>(task: FileTask): Promise<T> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'file-task.worker.js'), { workerData: task })
    let received = false
    worker.once('message', (value: T) => {
      received = true
      resolve(value)
    })
    worker.once('error', reject)
    worker.once('exit', (code) => {
      if (!received) reject(new Error(`File task exited without a result (code ${code})`))
    })
  })
}
