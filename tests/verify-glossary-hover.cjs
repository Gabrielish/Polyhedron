const { app, BrowserWindow } = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')

async function run() {
  app.setPath('userData', await fs.mkdtemp(path.join(os.tmpdir(),'polyhedron-glossary-test-')))
  await app.whenReady()
  const assets = path.resolve(__dirname,'../out/renderer/assets')
  const files = await fs.readdir(assets)
  const css = await fs.readFile(path.join(assets,files.find(name=>name.endsWith('.css'))),'utf8')
  const win = new BrowserWindow({show:false,width:800,height:600,webPreferences:{backgroundThrottling:false}})
  const fixture = `<html data-theme="liquid-glass"><head><style>${css}</style></head><body>
    <div style="padding:80px;font:20px Arial;color:white">
      The <span id="term" class="term-glossary-mark group/term relative inline text-neutral-100">Watcher
        <span class="bulk-status-menu term-glossary-tooltip absolute opacity-0 group-hover/term:opacity-100">
          <span style="display:block">GLOSSARY</span><button id="copy">Străjer</button>
        </span>
      </span>'s Guide
    </div></body></html>`
  await win.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(fixture))
  const evaluate = source=>win.webContents.executeJavaScript(source,true)
  const check = async (name, expression)=>{
    if (!await evaluate(expression)) throw new Error(name)
    console.log('PASS: '+name)
  }
  await check('hidden popup cannot receive hover', `(() => {
    const popup=document.querySelector('.term-glossary-tooltip');
    const rect=popup.getBoundingClientRect();
    const hit=document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2);
    return getComputedStyle(popup).visibility==='hidden' && getComputedStyle(popup).pointerEvents==='none' && !hit?.closest('.term-glossary-tooltip');
  })()`)
  win.webContents.debugger.attach('1.3')
  await win.webContents.debugger.sendCommand('DOM.enable')
  await win.webContents.debugger.sendCommand('CSS.enable')
  const {root} = await win.webContents.debugger.sendCommand('DOM.getDocument')
  const {nodeId} = await win.webContents.debugger.sendCommand('DOM.querySelector',{nodeId:root.nodeId,selector:'#term'})
  await win.webContents.debugger.sendCommand('CSS.forcePseudoState',{nodeId,forcedPseudoClasses:['hover']})
  await check('hover over marked term opens popup and preserves copy interaction', `(() => {
    const popup=document.querySelector('.term-glossary-tooltip');
    const rect=popup.getBoundingClientRect();
    const hit=document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2);
    return getComputedStyle(popup).visibility==='visible' && getComputedStyle(popup).pointerEvents==='auto' && !!hit?.closest('.term-glossary-tooltip');
  })()`)
  await win.webContents.debugger.sendCommand('CSS.forcePseudoState',{nodeId,forcedPseudoClasses:[]})
  await check('leaving term hides popup hit area again', `getComputedStyle(document.querySelector('.term-glossary-tooltip')).visibility==='hidden'`)
  for (const color of ['rgb(170, 220, 120)','rgb(240, 110, 100)','rgb(130, 180, 250)']) {
    await evaluate(`document.documentElement.style.setProperty('--color-amber-400',${JSON.stringify(color)})`)
    await check('dotted underline follows '+color, `getComputedStyle(document.getElementById('term')).textDecorationColor===${JSON.stringify(color)}`)
  }
  win.webContents.debugger.detach()
  win.destroy()
  app.exit(0)
}
run().catch(error=>{console.error(error.stack);app.exit(1)})
