const { app, BrowserWindow } = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')
const { createRequire } = require('node:module')
async function run() {
  const raised = ['1f2329','181b1f','1c1f24','181c21','20242a','1d2127','2a2f37','242830','273238']
  const panels = ['131518','0f1114','141416','0f1013','11151b','101115','15161b','111216','121318','101214','10151a']
  const inset = ['0c0d0f','0a0a0c']
  const tokens = [...raised,...panels,...inset].map(hex => `bg-[#${hex}]`)
  const cssPath = path.join(__dirname,'../src/renderer/src/assets/main.css')
  const {compile} = createRequire(require.resolve('@tailwindcss/vite'))('@tailwindcss/node')
  const compiler = await compile(await fs.readFile(cssPath,'utf8'),{base:path.dirname(cssPath),onDependency:()=>{}})
  const manage = await fs.readFile(path.join(__dirname,'../src/renderer/src/pages/ManageModsPage.tsx'),'utf8')
  const avatar = manage.match(/<span\s+className="([^"]*bg-\[#1f2329\][^"]*)"/)[1]
  const hoverTokens = ['hover:bg-[#1f2329]','hover:bg-[#181b1f]','hover:bg-[#1c1f24]']
  await app.whenReady()
  const win = new BrowserWindow({show:false})
  await win.loadURL('data:text/html,'+encodeURIComponent(`<html data-theme="liquid-glass"><body><div class="app-content-shell"><main>${tokens.map((token,i)=>`<span id="b${i}" class="${token}">Surface</span>`).join('')}<span id="avatar" class="${avatar}">B</span>${hoverTokens.map((token,i)=>`<button id="h${i}" class="${token}">Hover</button>`).join('')}<span id="semantic" class="bg-blue-500">Translated</span><span id="skeleton" class="app-skeleton-block bg-[#20242a]">Loading</span></main></div></body></html>`))
  await win.webContents.insertCSS(compiler.build([...tokens,...hoverTokens,'bg-blue-500',...avatar.split(' ')]))
  await win.webContents.insertCSS('button{transition:none!important}')
  const colors = await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('[id^="b"]')).map(e=>getComputedStyle(e).backgroundColor)`)
  const expected = [...raised.map(()=> 'rgb(24, 24, 24)'),...panels.map(()=> 'rgb(16, 16, 16)'),...inset.map(()=> 'rgb(9, 9, 9)')]
  if (JSON.stringify(colors)!==JSON.stringify(expected)) throw new Error(JSON.stringify(colors))
  const avatarColor = await win.webContents.executeJavaScript(`getComputedStyle(document.getElementById('avatar')).backgroundColor`)
  if (avatarColor!=='rgb(24, 24, 24)') throw new Error('Project avatar still blue')
  win.webContents.debugger.attach('1.3');await win.webContents.debugger.sendCommand('DOM.enable');await win.webContents.debugger.sendCommand('CSS.enable')
  const {root}=await win.webContents.debugger.sendCommand('DOM.getDocument')
  for (let i=0;i<hoverTokens.length;i++) {
    const {nodeId}=await win.webContents.debugger.sendCommand('DOM.querySelector',{nodeId:root.nodeId,selector:'#h'+i})
    await win.webContents.debugger.sendCommand('CSS.forcePseudoState',{nodeId,forcedPseudoClasses:['hover']})
    const state=await win.webContents.executeJavaScript(`(()=>{const s=getComputedStyle(document.getElementById('h${i}'));return [s.backgroundColor,s.boxShadow]})()`)
    if(state[0]!=='rgb(24, 24, 24)' || state[1]==='none') throw new Error('Neutral hover/glow changed: '+JSON.stringify(state))
  }
  const preserved=await win.webContents.executeJavaScript(`getComputedStyle(document.getElementById('semantic')).backgroundColor!=='rgb(24, 24, 24)' && getComputedStyle(document.getElementById('skeleton')).backgroundColor!=='rgb(24, 24, 24)'`)
  if(!preserved) throw new Error('Semantic status or themed skeleton overridden')
  console.log('PASS: 22 legacy surfaces and project avatar are neutral; hover glow, semantic blue and themed skeletons preserved')
  win.destroy();app.quit()
}
run().catch(error=>{console.error(error);app.exit(1)})
