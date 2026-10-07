const {app, BrowserWindow} = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')

async function run() {
  await app.whenReady()
  const win = new BrowserWindow({show:false,width:900,height:600})
  const tabs = ['translate','consistency','dialogue','game-data']
  const html = tabs.map(tab => `<section class="${tab === 'translate' ? 'translation-search-bar' : ''}">
    <div class="text-search-input-shell">${['case','word'].map(kind =>
      `<button id="${tab}-${kind}" class="translation-toolbar-toggle">${kind}</button>`).join('')}</div>
  </section>`).join('')
  await win.loadURL('data:text/html,'+encodeURIComponent(`<html data-theme="liquid-glass"><body>
    <div class="app-content-shell"><main>${html}</main></div></body></html>`))
  await win.webContents.insertCSS(await fs.readFile(path.join(__dirname,'../src/renderer/src/assets/main.css'),'utf8'))
  await win.webContents.insertCSS('button{width:24px;height:24px;border:0;color:#525252;transition:none!important}')
  await win.webContents.executeJavaScript(`document.documentElement.style.setProperty('--color-amber-400','#A7F175');document.documentElement.style.setProperty('--poly-accent-rgb','167 241 117')`)
  win.webContents.debugger.attach('1.3')
  await win.webContents.debugger.sendCommand('DOM.enable')
  await win.webContents.debugger.sendCommand('CSS.enable')
  const {root} = await win.webContents.debugger.sendCommand('DOM.getDocument')
  for (const state of ['hover','focus-visible']) {
    let baseline
    for (const tab of tabs) for (const kind of ['case','word']) {
      const id = `${tab}-${kind}`
      const {nodeId} = await win.webContents.debugger.sendCommand('DOM.querySelector',{nodeId:root.nodeId,selector:'#'+id})
      await win.webContents.debugger.sendCommand('CSS.forcePseudoState',{nodeId,forcedPseudoClasses:[state]})
      await new Promise(resolve=>setTimeout(resolve,180))
      const style = await win.webContents.executeJavaScript(`(()=>{const s=getComputedStyle(document.getElementById('${id}'));return [s.backgroundColor,s.backgroundImage,s.boxShadow,s.color]})()`)
      baseline ??= style
      if (JSON.stringify(style)!==JSON.stringify(baseline)) throw new Error(id+' differs: '+JSON.stringify(style))
      if (style[0]!=='rgba(0, 0, 0, 0)' || style[1]!=='none' || style[2]!=='none' || style[3]!=='rgb(167, 241, 117)')
        throw new Error(id+' has unexpected '+state+': '+JSON.stringify(style))
      await win.webContents.debugger.sendCommand('CSS.forcePseudoState',{nodeId,forcedPseudoClasses:[]})
    }
    console.log('PASS: Match case / Whole word '+state+' matches Translate in all three tabs')
  }
  win.destroy()
  app.quit()
}
run().catch(error=>{console.error(error);app.exit(1)})
