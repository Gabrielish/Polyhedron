const { app, BrowserWindow } = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')

async function run() {
  await app.whenReady()
  const win = new BrowserWindow({ show: false, width: 900, height: 600 })
  const surface = 'rounded-xl border border-neutral-800/80 bg-[#141416]'
  await win.loadURL('data:text/html,' + encodeURIComponent(`
    <html data-theme="liquid-glass"><body><div class="app-content-shell"><main>
      <div class="settings-page-shell"><div id="settings" class="${surface}">Settings</div></div>
      <div class="spells-page"><article id="spell" class="spell-card ${surface}">Spell
        <div class="spell-icon-frame relative h-14 w-14 bg-[#0c0d0f]">Icon</div>
        <div class="spell-icon-frame h-7 w-7 bg-[#0c0d0f]">Variant icon</div>
      </article>
      <article id="complete" class="spell-card spell-card-complete ${surface}">Complete</article></div>
    </main></div></body></html>`))
  await win.webContents.insertCSS(`
    .rounded-xl {border-radius:12px}
    .border {border-width:1px;border-style:solid}
    [class~="border-neutral-800/80"] {border-color:rgb(38 38 38 / .8)}
    [class~="bg-[#141416]"] {background-color:#141416}
  `)
  await win.webContents.insertCSS(await fs.readFile(
    path.join(__dirname, '../src/renderer/src/assets/main.css'), 'utf8'))
  const read = () => win.webContents.executeJavaScript(`
    Object.fromEntries(['settings','spell','complete'].map(id => {
      const s=getComputedStyle(document.getElementById(id));
      return [id,[s.backgroundColor,s.backgroundImage,s.borderTopColor,
        s.borderRadius,s.boxShadow,s.backdropFilter]];
    }))`)
  const check = styles => {
    if (JSON.stringify(styles.settings)!==JSON.stringify(styles.spell))
      throw new Error(JSON.stringify(styles))
    if (styles.complete[2]!=='rgb(52, 211, 153)') throw new Error('Missing completion border')
  }
  check(await read())
  const frames = await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.spell-icon-frame'),el=>{const s=getComputedStyle(el);return [s.backgroundColor,s.borderTopColor]})`)
  if (frames.some(s=>s[0]!=='rgb(9, 9, 9)' || s[1]!=='rgb(41, 41, 41)'))
    throw new Error('Icon frames are not neutral black: '+JSON.stringify(frames))
  console.log('PASS: main and variant icon frames have neutral black background and border')
  win.webContents.debugger.attach('1.3')
  await win.webContents.debugger.sendCommand('DOM.enable')
  await win.webContents.debugger.sendCommand('CSS.enable')
  const {root}=await win.webContents.debugger.sendCommand('DOM.getDocument')
  for (const id of ['settings','spell','complete']) {
    const {nodeId}=await win.webContents.debugger.sendCommand('DOM.querySelector',
      {nodeId:root.nodeId,selector:'#'+id})
    await win.webContents.debugger.sendCommand('CSS.forcePseudoState',
      {nodeId,forcedPseudoClasses:['hover']})
  }
  check(await read())
  console.log('PASS: Settings and Spells surfaces match at rest and hover; completion border preserved')
  win.destroy()
  app.quit()
}
run().catch(error => { console.error(error); app.exit(1) })
