const { app, BrowserWindow } = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')

async function run() {
  await app.whenReady()
  const win = new BrowserWindow({ show: false, width: 800, height: 600 })
  await win.loadURL('data:text/html,<html data-theme="liquid-glass"><body><div class="app-content-shell"><main id="fixture"></main></div></body></html>')
  const source = await fs.readFile(path.join(__dirname, '../src/renderer/src/assets/main.css'), 'utf8')
  await win.webContents.insertCSS(source.slice(source.indexOf('/* Match Translate SAVE'), source.indexOf('/* Glossary mobile stacked rows')))
  await win.webContents.executeJavaScript(`document.getElementById('fixture').innerHTML = ${JSON.stringify(
    ['bg-amber-500', 'bg-amber-500/90', 'accent-solid-button', 'accent-solid-control', 'bg-amber-500 settings-button-preview'].map((cls, i) => `<button id="b${i}" class="${cls}" style="display:block;width:180px;height:40px;margin:10px;box-shadow:0 0 20px red">Action</button>`).join('') + '<button id="switch" role="switch" class="bg-amber-500" style="display:block;width:180px;height:40px">Switch</button><button id="disabled" disabled class="bg-amber-500" style="display:block;width:180px;height:40px">Disabled</button>'
  )}`)
  for (const id of ['b0', 'b1', 'b2', 'b3', 'b4', 'switch', 'disabled']) {
    const point = await win.webContents.executeJavaScript(`(()=>{const r=document.getElementById('${id}').getBoundingClientRect();return {x:Math.round(r.left+20),y:Math.round(r.top+20)}})()`)
    win.webContents.sendInputEvent({ type: 'mouseMove', ...point })
    win.webContents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, ...point })
    await new Promise(resolve => setTimeout(resolve, 100))
    const state = await win.webContents.executeJavaScript(`(()=>{const b=document.getElementById('${id}'),s=getComputedStyle(b);return {transform:s.transform,shadow:s.boxShadow}})()`)
    const expected = id.startsWith('b') ? 'matrix(1, 0, 0, 1, 0, 1)' : 'none'
    if (state.transform !== expected) throw new Error(id + ': ' + JSON.stringify(state))
    if (id === 'disabled' && state.shadow !== 'none') throw new Error('Disabled button has glow')
    win.webContents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, ...point })
    console.log('PASS: ' + id)
  }
  win.destroy()
  app.quit()
}
run().catch(error => { console.error(error); app.exit(1) })
