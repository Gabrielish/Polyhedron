const {app,BrowserWindow}=require('electron')
const fs=require('node:fs/promises')
const path=require('node:path')
async function run(){
  await app.whenReady()
  const win=new BrowserWindow({show:false,width:800,height:500})
  await win.loadURL('data:text/html,<html data-theme="liquid-glass"><body><div class="app-content-shell"><main><button id="normal">Translated</button><div id="xml" class="translation-special-filter">XML</div><div id="pl" class="translation-special-filter">PL</div></main></div></body></html>')
  await win.webContents.insertCSS(await fs.readFile(path.join(__dirname,'../src/renderer/src/assets/main.css'),'utf8'))
  await win.webContents.insertCSS('html{--poly-accent-rgb:140 82 255} #normal,#xml,#pl{display:block;width:180px;height:40px;margin:15px;border-width:1px;border-style:solid;}')
  win.webContents.debugger.attach('1.3')
  await win.webContents.debugger.sendCommand('DOM.enable')
  await win.webContents.debugger.sendCommand('CSS.enable')
  const {root}=await win.webContents.debugger.sendCommand('DOM.getDocument')
  let baseline
  for(const id of ['normal','xml','pl']){
    const {nodeId}=await win.webContents.debugger.sendCommand('DOM.querySelector',{nodeId:root.nodeId,selector:'#'+id})
    await win.webContents.debugger.sendCommand('CSS.forcePseudoState',{nodeId,forcedPseudoClasses:['hover']})
    await new Promise(resolve=>setTimeout(resolve,250))
    const style=await win.webContents.executeJavaScript(`(()=>{const s=getComputedStyle(document.getElementById('${id}'));return [s.backgroundColor,s.borderTopColor,s.color,s.boxShadow]})()`)
    if(id==='normal')baseline=style
    else if(JSON.stringify(style)!==JSON.stringify(baseline))throw new Error(id+' differs: '+JSON.stringify({baseline,style}))
    console.log('PASS: '+id+' '+JSON.stringify(style))
  }
  await win.webContents.executeJavaScript(`document.documentElement.style.setProperty('--color-amber-500','#8C52FF');document.documentElement.style.setProperty('--color-amber-400','#AF86FF');document.querySelector('main').insertAdjacentHTML('beforeend',${JSON.stringify(['bg-amber-500/5','bg-amber-500/10','bg-amber-500/12','bg-amber-500/15','bg-amber-500/20','bg-amber-400/5','bg-amber-400/10'].map((cls,i)=>`<button id="selected${i}" class="${cls}">Selected</button>`).join(''))})`)
  await win.webContents.insertCSS('button[id^="selected"]{background-color:var(--selected-accent-surface)}')
  for(let i=0;i<7;i++){
    const before=await win.webContents.executeJavaScript(`getComputedStyle(document.getElementById('selected${i}')).backgroundColor`)
    const {nodeId}=await win.webContents.debugger.sendCommand('DOM.querySelector',{nodeId:root.nodeId,selector:'#selected'+i})
    await win.webContents.debugger.sendCommand('CSS.forcePseudoState',{nodeId,forcedPseudoClasses:['hover']})
    await new Promise(resolve=>setTimeout(resolve,250))
    const after=await win.webContents.executeJavaScript(`(()=>{const s=getComputedStyle(document.getElementById('selected${i}'));return {bg:s.backgroundColor,shadow:s.boxShadow}})()`)
    // Chromium may serialize equivalent hex-derived colors in different color spaces.
    const same=await win.webContents.executeJavaScript(`(()=>{const canvas=document.createElement('canvas'),c=canvas.getContext('2d');const rgba=color=>{c.clearRect(0,0,1,1);c.fillStyle=color;c.fillRect(0,0,1,1);return Array.from(c.getImageData(0,0,1,1).data)};return JSON.stringify(rgba(${JSON.stringify(before)}))===JSON.stringify(rgba(${JSON.stringify(after.bg)}))})()`)
    if(!same || after.shadow==='none')throw new Error('selected'+i+' hover mismatch '+JSON.stringify({before,after}))
    console.log('PASS: selected'+i+' preserves tint and glow')
  }
  win.destroy();app.quit()
}
run().catch(error=>{console.error(error);app.exit(1)})
