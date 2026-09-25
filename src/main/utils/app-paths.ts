import path from 'node:path'
import { app } from 'electron'

export const DATABASE_FILE = 'polyhedron.db'
export const WORKSPACE_EXTENSION = 'pws'
export const WORKSPACE_FILE_NAME = 'polyhedron-workspace.pws'

export function databasePath(root = app.getPath('userData')): string {
  return path.join(root, DATABASE_FILE)
}

export function projectDataPath(root = app.getPath('userData')): string {
  return root
}

export function projectPath(...segments: string[]): string {
  return path.join(projectDataPath(), ...segments)
}
