import { contextBridge, ipcRenderer } from 'electron'
import type { InstallerAPI } from './installer-types'
const api: InstallerAPI = {
  status: () => ipcRenderer.invoke('installer:status'),
  browse: () => ipcRenderer.invoke('installer:browse'),
  install: (target) => ipcRenderer.invoke('installer:install', target),
  launch: () => ipcRenderer.invoke('installer:launch'),
  close: () => ipcRenderer.invoke('installer:close'),
  minimize: () => ipcRenderer.invoke('installer:minimize')
}
contextBridge.exposeInMainWorld('installer', api)
