const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve(__dirname, '..')
const publicRoot = path.join(root, 'pwa/public')
for (const page of ['privacy', 'terms']) {
  const file = path.join(publicRoot, page, 'index.html')
  const html = fs.readFileSync(file, 'utf8')
  assert.match(html, /<html lang="en">/)
  assert.equal((html.match(/<h1[ >]/g) || []).length, 1)
  assert.ok(!/<h1>[\s\S]*?\.\s*<\/span><\/h1>/.test(html), 'Page title must not end in a full stop')
  assert.match(html, new RegExp(`https://gabrielish.github.io/Polyhedron/${page}/`))
  assert.match(html, /gabrielbundea1@gmail\.com/)
  assert.match(html, /October 6, 2026/)
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const link = match[1]
    if (/^(https?:|mailto:)/.test(link)) continue
    if (link.startsWith('#')) {
      assert.ok(html.includes(`id="${link.slice(1)}"`), `Missing section ${link}`)
    } else {
      const target = path.resolve(path.dirname(file), link)
      assert.ok(fs.existsSync(target), `Missing local asset ${link}`)
    }
  }
}
const privacy = fs.readFileSync(path.join(publicRoot, 'privacy/index.html'), 'utf8')
assert.match(privacy, /auth\/drive\.file/)
assert.match(privacy, /auth\/drive<\/code>/)
assert.match(privacy, /Limited Use/)
for (const file of ['LandingPage.tsx', 'App.tsx']) {
  const source = fs.readFileSync(path.join(root, 'pwa/src', file), 'utf8')
  assert.ok(source.includes('BASE_URL}privacy/'))
  assert.ok(source.includes('BASE_URL}terms/'))
}
console.log('PASS: public legal pages, local links, navigation anchors, Google data disclosures and site/companion links')

if (process.argv.includes('--visual')) {
  const { app, BrowserWindow } = require('electron')
  app.on('window-all-closed', () => {})
  const os = require('node:os')
  app.disableHardwareAcceleration()
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'polyhedron-legal-preview-'))
  app.setPath('userData', temp)
  app.whenReady().then(async () => {
    for (const page of ['privacy', 'terms']) {
      for (const [label, width, height] of [['desktop', 1200, 900], ['mobile', 390, 844]]) {
        const win = new BrowserWindow({ show: false, width, height, webPreferences: { offscreen: true, backgroundThrottling: false } })
        await win.loadFile(path.join(publicRoot, page, 'index.html'))
        await win.webContents.executeJavaScript('document.fonts.ready.then(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true)))))')
        const layout = await win.webContents.executeJavaScript(`({overflow:document.documentElement.scrollWidth>innerWidth,background:getComputedStyle(document.body).backgroundColor,accent:getComputedStyle(document.querySelector('h1 span')).color,logo:document.querySelector('.brand img').naturalWidth})`)
        assert.equal(layout.overflow, false, `${page} ${label} overflows`)
        assert.equal(layout.background, 'rgb(8, 8, 8)')
        assert.equal(layout.accent, 'rgb(167, 241, 117)')
        assert.ok(layout.logo > 0)
        assert.equal(await win.webContents.executeJavaScript(`getComputedStyle(document.querySelector('.hero'),'::before').content`), 'none')
        assert.ok(await win.webContents.executeJavaScript(`getComputedStyle(document.body).backgroundImage.includes('radial-gradient')`))
        const screenshot = path.join(temp, `${page}-${label}.png`)
        fs.writeFileSync(screenshot, (await win.webContents.capturePage()).toPNG())
        console.log(`Preview: ${screenshot}`)
        win.destroy()
      }
    }
    console.log('PASS: desktop/mobile layouts, no horizontal overflow, matching site palette and loaded logo')
    app.quit()
  }).catch(error => { console.error(error); app.exit(1) })
}
