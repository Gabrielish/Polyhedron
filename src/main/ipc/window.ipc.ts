import { app, BrowserWindow, ipcMain, Notification } from 'electron'
import { currentNotificationIcon } from '../services/app-icon.service'


export function registerWindowHandlers(getWindow: () => BrowserWindow | null, refreshAppIcon?: () => Promise<void>): void {
  ipcMain.handle('window:refreshAppIcon', async () => {
    if (process.platform !== 'win32') throw new Error('Taskbar icon refresh is only available on Windows.')
    if (!refreshAppIcon) throw new Error('Taskbar icon refresh is unavailable.')
    await refreshAppIcon()
  })
  ipcMain.handle('window:minimize', () => {
    getWindow()?.minimize()
  })

  ipcMain.handle('window:maximize', () => {
    const win = getWindow()
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })

  ipcMain.handle('window:close', () => {
    getWindow()?.close()
  })

  ipcMain.handle('window:relaunch', async () => {
    // Persist the latest selected artwork before the replacement process reads it.
    if (process.platform === 'win32' && refreshAppIcon) await refreshAppIcon()
    app.relaunch({ execPath: process.execPath, args: process.argv.slice(1) })
    setTimeout(() => app.exit(0), 250)
  })

  ipcMain.handle('window:isMaximized', () => {
    return getWindow()?.isMaximized() ?? false
  })

  ipcMain.handle(
    'window:notifySyncComplete',
    (
      _event,
      payload: { direction: 'upload' | 'download'; translated: number; total: number }
    ) => {
      const win = getWindow()
      if (!win || win.isFocused()) return

      const direction = payload.direction === 'upload' ? 'Upload' : 'Download'
      const action = payload.direction === 'upload' ? 'uploaded to' : 'downloaded from'
      const body = `${payload.translated.toLocaleString()} of ${payload.total.toLocaleString()} translations ${action} Google Drive.`

      if (Notification.isSupported()) {
        new Notification({
          title: `Polyhedron · ${direction} complete`,
          body,
          // macOS uses this as the content image, Windows as the toast image.
          // Neither replaces the system-managed application identity badge.
          icon: currentNotificationIcon(win),
          sound: process.platform === 'darwin' ? 'Glass' : undefined
        }).show()
      }

      if (process.platform === 'darwin') {
        app.dock?.bounce('critical')
      } else if (process.platform === 'win32') {
        win.flashFrame(true)
        setTimeout(() => win.flashFrame(false), 4500)
      }
    }
  )

}

export function setupWindowEvents(win: BrowserWindow): void {
  win.on('maximize', () => win.webContents.send('window:maximizeChange', true))
  win.on('unmaximize', () => win.webContents.send('window:maximizeChange', false))
}
