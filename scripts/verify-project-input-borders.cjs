const {app, BrowserWindow} = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')

async function run() {
  await app.whenReady()
  const win = new BrowserWindow({show:false})
  await win.loadURL('data:text/html,'+encodeURIComponent(`<html data-theme="liquid-glass"><body><div class="app-content-shell"><main>
    <input id="search" class="project-search-input border-[#1f2329] bg-[#0f1114]">
    <input id="name" class="project-name-input border-[#1f2329] bg-[#0f1114]">
    </main></div></body></html>`))
  await win.webContents.insertCSS(await fs.readFile(path.join(__dirname,'../src/renderer/src/assets/main.css'),'utf8'))
  win.webContents.debugger.attach('1.3')
  await win.webContents.debugger.sendCommand('DOM.enable')
  await win.webContents.debugger.sendCommand('CSS.enable')
  const {root} = await win.webContents.debugger.sendCommand('DOM.getDocument')
  for (const id of ['search','name']) {
    const {nodeId} = await win.webContents.debugger.sendCommand('DOM.querySelector',{nodeId:root.nodeId,selector:'#'+id})
    let baseline
    for (const state of [[],['hover'],['hover','active'],['hover','focus'],['focus','focus-visible']]) {
      await win.webContents.debugger.sendCommand('CSS.forcePseudoState',{nodeId,forcedPseudoClasses:state})
      const style = await win.webContents.executeJavaScript(`(()=>{const s=getComputedStyle(document.getElementById('${id}'));return [s.borderTopColor,s.boxShadow,s.outlineWidth]})()`)
      baseline ??= style
      if (JSON.stringify(style)!==JSON.stringify(baseline) || style[0]!=='rgb(41, 41, 41)' || style[1]!=='none')
        throw new Error(id+' changes on '+state+': '+JSON.stringify(style))
    }
    console.log('PASS: '+id+' neutral border stays unchanged on hover, press and focus; no accent ring')
  }
  win.destroy()
  app.quit()
}
run().catch(error=>{console.error(error);app.exit(1)})
