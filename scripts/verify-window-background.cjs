const { app, BrowserWindow } = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')

async function run() {
  const root = path.resolve(__dirname, '..')
  const source = await fs.readFile(path.join(root, 'src/main/index.ts'), 'utf8')
  const backgroundColor = source.match(/new BrowserWindow\(\{[\s\S]*?backgroundColor:\s*'([^']+)'/)?.[1]
  if (backgroundColor !== '#101010') throw new Error('Missing native dark fallback')
  const html = (await fs.readFile(path.join(root, 'src/renderer/index.html'), 'utf8')).replace(/<script[\s\S]*?<\/script>/g, '')
  await app.whenReady()
  const win = new BrowserWindow({ show: false, backgroundColor, width: 400, height: 300 })
  if (win.getBackgroundColor() !== '#101010') throw new Error('Native window fallback is not dark')
  await win.loadURL('data:text/html,' + encodeURIComponent(html))
  const colors = await win.webContents.executeJavaScript(`['html','body'].map(s=>getComputedStyle(document.querySelector(s)).backgroundColor)`)
  if (colors.some(color => color !== 'rgb(16, 16, 16)')) throw new Error('Pre-stylesheet document is not dark: ' + JSON.stringify(colors))
  const image = await win.webContents.capturePage()
  const bitmap = image.toBitmap(), x = Math.floor(image.getSize().width / 2), y = Math.floor(image.getSize().height / 2)
  const offset = (y * image.getSize().width + x) * 4
  if (![0, 1, 2].every(channel => bitmap[offset + channel] === 16)) throw new Error('First paint has a light background')
  // Stall only this disposable renderer, never the user's application.
  const blocked = win.webContents.executeJavaScript(`(()=>{const end=performance.now()+1000;while(performance.now()<end){};return true})()`)
  if (win.getBackgroundColor() !== '#101010') throw new Error('Native fallback changed during renderer stall')
  await blocked
  console.log('PASS: native window background and pre-stylesheet first paint are #101010; fallback remains dark during an isolated renderer stall (Windows ghost window not simulated)')
  win.destroy(); app.quit()
}
run().catch(error => { console.error(error); app.exit(1) })
