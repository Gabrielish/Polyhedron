export interface InstallerStatus {
  state: 'ready' | 'installing' | 'done' | 'error'
  target: string
  version: string
  error?: string
  preview: boolean
}
export interface InstallerAPI {
  status(): Promise<InstallerStatus>
  browse(): Promise<string | null>
  install(target: string): Promise<void>
  launch(): Promise<void>
  close(): Promise<void>
  minimize(): Promise<void>
}
