// Tests the real compiled main process, sandboxed preload and React renderer.
// Preview mode is isolated and never installs files or changes Windows registry.
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')
process.argv.push('--installer-preview', '--installer-smoke')
require('../out/main/index.js')
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
async function run() {
  let win
  for (let attempt = 0; attempt < 200; attempt++) {
    win = BrowserWindow.getAllWindows()[0]
    if (win && !win.webContents.isLoading() && await win.webContents.executeJavaScript('!!document.querySelector("input")').catch(() => false)) break
    await wait(100)
  }
  if (!win) throw new Error('Installer window did not initialize')
  const evaluate = code => win.webContents.executeJavaScript(code, true)
  const check = async (name, code) => {
    if (!await evaluate(code)) throw new Error(name)
    console.log('PASS: ' + name)
  }
  await wait(300)
  await check('isolated narrow bridge, no normal application API', '!!window.installer && !window.api')
  await check('ready state and version shown once', 'document.body.textContent.includes("Welcome to Polyhedron") && document.querySelectorAll("footer span").length === 1')
  await check('compact layout without overflow', 'document.documentElement.scrollWidth === innerWidth && document.documentElement.scrollHeight === innerHeight')
  await check('real app accent and surface', 'getComputedStyle(document.querySelector(".app-panel-surface")).backgroundColor === "rgb(16, 16, 16)" && getComputedStyle(document.querySelector("footer button:last-child")).backgroundColor === "rgb(167, 241, 117)"')
  await check('invalid destination rejected', 'window.installer.install("C:\\\\").then(()=>false,()=>true)')
  const output = path.resolve(__dirname, '../dist/installer-ui-preview')
  await fs.mkdir(output, {recursive:true})
  const capture = async name => fs.writeFile(path.join(output, name + '.png'), (await win.webContents.capturePage()).toPNG())
  await capture('ready')
  await evaluate('window.installer.install("C:\\\\Users\\\\You\\\\AppData\\\\Local\\\\Programs\\\\Polyhedron")')
  await wait(500)
  await check('installing disables close and repeated install', 'document.querySelector("button[aria-label=Close]").disabled && document.querySelector("footer button:last-child").disabled')
  await check('single forward progress animation on dark track', '!!document.querySelector(".bg-amber-500") && getComputedStyle(document.querySelector(".bg-neutral-800")).backgroundColor !== "rgb(255, 255, 255)"')
  await check('repeated install rejected', 'window.installer.install("C:\\\\Users\\\\You\\\\AppData\\\\Local\\\\Programs\\\\Polyhedron").then(()=>false,()=>true)')
  await capture('installing')
  await wait(2400)
  await check('completion enables launch', 'document.body.textContent.includes("Successfully installed") && document.querySelector("footer button:last-child").textContent.includes("Open Polyhedron") && !document.querySelector("footer button:last-child").disabled')
  await capture('done')
  console.log('Screenshots: ' + output)
  await evaluate('window.installer.close()')
}
run().catch(error => { console.error(error); app.exit(1) })
