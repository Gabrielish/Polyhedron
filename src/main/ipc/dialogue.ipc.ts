import { BrowserWindow, ipcMain } from 'electron'

const DIALOGUE_SITE = 'https://bg3.game-script.com/files/'

function safeDialogueName(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_% .-]+$/.test(value)) {
    throw new Error('Invalid dialogue name')
  }
  return value
}

export function registerDialogueHandlers(getParentWindow: () => BrowserWindow | null): void {
  ipcMain.handle('dialogue:open', (_event, dialogueName: unknown) => {
    const dialogue = safeDialogueName(dialogueName)
    const window = new BrowserWindow({
      width: 1400,
      height: 900,
      title: `BG3 Dialogue - ${dialogue}`,
      autoHideMenuBar: true,
      parent: getParentWindow() ?? undefined,
      webPreferences: {
        contextIsolation: true,
        sandbox: true
      }
    })

    window.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('https://bg3.game-script.com/')) return { action: 'allow' }
      return { action: 'deny' }
    })
    void window.loadURL(`${DIALOGUE_SITE}${encodeURIComponent(dialogue)}`)
  })
}
