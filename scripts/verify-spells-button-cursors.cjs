const { app, BrowserWindow } = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')

async function run() {
  await app.whenReady()
  const win = new BrowserWindow({ show: false })
  await win.loadURL('data:text/html,' + encodeURIComponent(`
    <html data-theme="liquid-glass"><body><main class="spells-page">
      <article class="spell-card">
        <button id="count">4</button><button id="navigate">Open</button>
        <button id="edit">Edit</button><button id="status">Verified</button>
        <button id="disabled" disabled>Disabled</button>
        <button id="aria-disabled" aria-disabled="true">Unavailable</button>
        <button id="unavailable" class="cursor-not-allowed">Unavailable</button>
      </article>
    </main><button id="outside">Outside</button></body></html>`))
  await win.webContents.insertCSS(await fs.readFile(
    path.join(__dirname, '../src/renderer/src/assets/main.css'), 'utf8'))
  const cursors = await win.webContents.executeJavaScript(`
    Object.fromEntries(Array.from(document.querySelectorAll('button'),
      button => [button.id, getComputedStyle(button).cursor]))`)
  for (const id of ['count', 'navigate', 'edit', 'status']) {
    if (cursors[id] !== 'pointer') throw new Error(id + ': ' + cursors[id])
  }
  for (const id of ['disabled', 'aria-disabled', 'unavailable']) {
    if (cursors[id] !== 'not-allowed') throw new Error(id + ': ' + cursors[id])
  }
  if (cursors.outside !== 'pointer') throw new Error('Global button cursor missing')
  console.log('PASS: active card and global buttons use pointer; disabled buttons use not-allowed')
  win.destroy()
  app.quit()
}
run().catch(error => { console.error(error); app.exit(1) })
