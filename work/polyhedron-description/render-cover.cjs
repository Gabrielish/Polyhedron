const { app, BrowserWindow } = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')

app.commandLine.appendSwitch('force-device-scale-factor', '1')

async function run() {
  const root = path.resolve(__dirname, '../..')
  const source = await fs.readFile(path.join(root, 'src/renderer/src/components/layout/TitleBar.tsx'), 'utf8')
  const dragon = source.match(/<path fill="currentColor" d="([^"]+)"/)[1]
  const font = (await fs.readFile(path.join(root, 'src/renderer/src/assets/fonts/BreatheFireIII.otf'))).toString('base64')
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face{font-family:Brand;src:url(data:font/otf;base64,${font}) format('opentype')}
    *{box-sizing:border-box}html,body{margin:0;width:1300px;height:372px;overflow:hidden}
    body{position:relative;background:#101010;color:#e5e5e5;font-family:Segoe UI,Arial,sans-serif}
    .backdrop{position:absolute;inset:0;background:radial-gradient(ellipse 290px 150px at 29% 26%,#a7f1750d,transparent 85%),radial-gradient(ellipse at 50% 0%,#252627,transparent 72%),#101010}
    .brand{position:absolute;top:30px;left:0;width:100%;display:flex;align-items:center;justify-content:center;gap:24px}
    .dragon{width:115px;height:98px;color:#A7F175;filter:drop-shadow(0 0 18px #a7f17530)}
    .wordmark{font:104px/1.14 Brand;color:#eeeeec;letter-spacing:.025em}
    .tagline{position:absolute;top:171px;width:100%;text-align:center;font-size:22px;letter-spacing:.035em;color:#A7F175}
    .fade{position:absolute;inset:205px 0 0;background:linear-gradient(transparent,#101010dd)}
    .overlay{display:none;position:absolute;inset:215px 0 0;background:linear-gradient(transparent,#000c);padding:21px 32px;color:white}
    .overlay small{color:#c8a166;font-size:12px}.overlay h1{font-size:32px;font-weight:500;margin:10px 0 20px}
    .controls{display:flex;justify-content:space-between;font-size:13px;color:#c9c9c9}.controls span:last-child{padding:8px 16px;border:1px solid #c99c59;border-radius:4px}
    .manage{display:none;position:absolute;top:22px;right:22px;padding:10px 14px;border-radius:4px;background:#c39450;color:white;font-weight:600}
    .preview .overlay,.preview .manage{display:block}
    </style></head><body><div class="backdrop"></div>
    <div class="brand"><svg class="dragon" viewBox="0 0 12.21 10.26" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="${dragon}"/></svg><span class="wordmark">Polyhedron</span></div>
    <div class="tagline">Every word. In your world.</div><div class="fade"></div>
    <div class="manage">Manage ⌄</div><div class="overlay"><small>Games / Baldur’s Gate 3 / Mods / Utilities / Polyhedron</small><h1>Polyhedron - Translation Tool</h1><div class="controls"><span>Endorsements &nbsp;&nbsp; Unique DLs &nbsp;&nbsp; Total DLs &nbsp;&nbsp; Version</span><span>Download: &nbsp; Manual</span></div></div>
    </body></html>`
  await fs.writeFile(path.join(__dirname, 'Polyhedron-cover-preview.html'), html.replace(/<body>/, '<body class="preview">'))
  await app.whenReady()
  const win = new BrowserWindow({ show: false, width: 1300, height: 372, webPreferences: { backgroundThrottling: false } })
  win.setContentSize(1300, 372)
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  await win.webContents.executeJavaScript('document.fonts.ready')
  const bounds = await win.webContents.executeJavaScript(`(()=>{const brand=document.querySelector('.brand').getBoundingClientRect(),tag=document.querySelector('.tagline').getBoundingClientRect();return {font:document.fonts.check('104px Brand'),brandBottom:brand.bottom,tagBottom:tag.bottom,width:innerWidth,height:innerHeight}})()`)
  if (!bounds.font || bounds.tagBottom > 205 || bounds.width !== 1300 || bounds.height !== 372) throw Error(JSON.stringify(bounds))
  const cover = await win.webContents.capturePage()
  if (cover.getSize().width !== 1300 || cover.getSize().height !== 372) throw Error('Incorrect output dimensions')
  await fs.writeFile(path.join(__dirname, 'Polyhedron-cover-1300x372.png'), cover.toPNG())
  await win.webContents.executeJavaScript('document.body.classList.add("preview")')
  await fs.writeFile(path.join(__dirname, 'Polyhedron-cover-safe-area-preview.png'), (await win.webContents.capturePage()).toPNG())
  console.log('PASS: 1300×372 cover; original logo and tagline stay above the simulated Nexus overlay.')
  win.destroy()
  app.quit()
}
run().catch(error => { console.error(error); app.exit(1) })
