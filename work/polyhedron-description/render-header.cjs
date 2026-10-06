const { app, BrowserWindow } = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')

async function run() {
  const root = path.resolve(__dirname, '../..')
  const titleBar = await fs.readFile(path.join(root, 'src/renderer/src/components/layout/TitleBar.tsx'), 'utf8')
  const dragonPath = titleBar.match(/<path fill="currentColor" d="([^"]+)"/)[1]
  const font = (await fs.readFile(path.join(root, 'src/renderer/src/assets/fonts/BreatheFireIII.otf'))).toString('base64')
  const html = `<!doctype html><html><head><style>
    @font-face{font-family:Brand;src:url(data:font/otf;base64,${font}) format('opentype');font-display:block}
    *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;background:#29292e;color:#d4d4d8}
    body{display:flex;align-items:center;justify-content:center;font-family:Segoe UI,Arial,sans-serif}
    main{text-align:center}.brand{display:flex;align-items:center;justify-content:center;gap:20px}
    svg{width:82px;height:70px;color:#A7F175;filter:drop-shadow(0 0 11px #a7f17550)}
    .name{font:70px Brand;color:#e5e5e5;letter-spacing:.04em;line-height:1.15}
    </style></head><body><main><div class="brand"><svg viewBox="0 0 12.21 10.26" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="${dragonPath}"/></svg><span class="name">Polyhedron</span></div></main></body></html>`
  await app.whenReady()
  const win = new BrowserWindow({ show: false, width: 720, height: 150, webPreferences: { backgroundThrottling: false } })
  win.setContentSize(720, 150)
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  await win.webContents.executeJavaScript('document.fonts.ready')
  const ready = await win.webContents.executeJavaScript('document.fonts.check("70px Brand") && document.documentElement.scrollWidth === innerWidth')
  if (!ready) throw Error('Brand font failed or header overflows')
  await fs.writeFile(path.join(__dirname, 'Polyhedron-header.png'), (await win.webContents.capturePage()).toPNG())
  console.log('Header rendered from the actual title-bar SVG and Breathe Fire III font.')
  win.destroy()
  app.quit()
}
run().catch(error => { console.error(error); app.exit(1) })
