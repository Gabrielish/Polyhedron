const { app, BrowserWindow } = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')

async function run() {
  const base = path.join(__dirname, '../src/renderer/src')
  const loading = await fs.readFile(path.join(base, 'features/translate/components/TranslateIdleScreen.tsx'), 'utf8')
  const shell = await fs.readFile(path.join(base, 'components/shared/ModalShell.tsx'), 'utf8')
  const loadingClass = loading.match(/\{isLoading && \(\s*<div className="([^"]+)"/)[1]
  const modalClass = shell.match(/className="(app-modal-overlay[^"]+)"/)[1]
  if (!loadingClass.includes('app-modal-overlay')) throw new Error('Loading must share modal backdrop')
  await app.whenReady()
  const win = new BrowserWindow({ show: false })
  await win.loadURL('data:text/html,' + encodeURIComponent(`<html data-theme="liquid-glass"><body><div id="loading" class="${loadingClass}"></div><div id="modal" class="${modalClass}"></div></body></html>`))
  await win.webContents.insertCSS(await fs.readFile(path.join(base, 'assets/main.css'), 'utf8'))
  const result = await win.webContents.executeJavaScript(`['loading','modal'].map(id=>{const s=getComputedStyle(document.getElementById(id));return [s.backgroundColor,s.backdropFilter]})`)
  if (JSON.stringify(result[0]) !== JSON.stringify(result[1]) || result[0][0] !== 'rgba(0, 0, 0, 0.6)' || result[0][1] !== 'blur(4px)') throw new Error(JSON.stringify(result))
  console.log('PASS: project loading uses exactly the modal backdrop: neutral black 60%, blur 4px')
  win.destroy()
  app.quit()
}
run().catch(error => { console.error(error); app.exit(1) })
