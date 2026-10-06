import { ipcMain, type BrowserWindow, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'

export function installIpcSecurity(getWindow: () => BrowserWindow | null): void {
  const validate = (event: IpcMainInvokeEvent | IpcMainEvent): void => {
    const window = getWindow()
    if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) {
      throw new Error('Untrusted IPC sender')
    }
  }
  const handle = ipcMain.handle.bind(ipcMain)
  ipcMain.handle = (channel, listener) => handle(channel, (event, ...args) => {
    validate(event)
    return listener(event, ...args)
  })
  const on = ipcMain.on.bind(ipcMain)
  ipcMain.on = (channel, listener) => on(channel, (event, ...args) => {
    try { validate(event) } catch { return }
    listener(event, ...args)
  })
}

export function isAllowedExternalUrl(value: string): boolean {
  try { return ['https:', 'http:', 'mailto:'].includes(new URL(value).protocol) } catch { return false }
}

export function isAllowedReferenceUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && ['bg3.wiki', 'bg3.game-script.com'].includes(url.hostname)
  } catch { return false }
}
