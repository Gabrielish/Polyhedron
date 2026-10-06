// Full-app smoke test with an isolated profile; never reads the user's database.
const { app, BrowserWindow, session } = require('electron')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const assert = require('node:assert/strict')
const root = path.resolve(__dirname, '..')
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'polyhedron-security-startup-'))
app.setPath('userData', profile)
app.getAppPath = () => root
BrowserWindow.prototype.show = function () {}
process.loadEnvFile = () => {}
delete process.env.ELECTRON_RENDERER_URL
const timeout = setTimeout(() => { console.error('FAIL: startup timed out'); app.exit(1) }, 30000)
app.whenReady().then(() => {
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (_details, callback) => callback({ cancel: true }))
})
app.on('browser-window-created', (_event, window) => {
  window.webContents.on('preload-error', (_event, _path, error) => { console.error(error); app.exit(1) })
  window.webContents.once('did-finish-load', async () => {
    try {
      const result = await window.webContents.executeJavaScript(`(async()=>{
        await Promise.all([window.api.language.getAll(),window.api.mod.getAll()]);
        await window.api.config.set({key:'gemini_key',value:'FAKE_STARTUP_KEY'});
        const config=await window.api.config.getAll();
        return {key:config.gemini_key,hasUi:document.getElementById('root').children.length>0,node:typeof require};
      })()`)
      assert.equal(result.key, '__POLYHEDRON_SECRET_SAVED__')
      assert.equal(result.hasUi, true)
      assert.equal(result.node, 'undefined')
      assert.equal(window.webContents.getLastWebPreferences().sandbox, true)
      await new Promise(resolve => setTimeout(resolve, 1500))
      console.log('PASS: full application starts with fresh profile, renders UI and encrypts/masks saved keys in sandbox')
      clearTimeout(timeout)
      app.quit()
    } catch (error) { console.error(error); app.exit(1) }
  })
})
require('../out/main/application.js')
