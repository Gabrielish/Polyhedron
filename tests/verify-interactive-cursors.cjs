const {app, BrowserWindow} = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')

async function run() {
  await app.whenReady()
  const win = new BrowserWindow({show:false})
  const roles = ['button','switch','checkbox','radio','tab','option','menuitem','menuitemcheckbox','menuitemradio']
  const types = ['button','submit','reset','checkbox','radio','range','color','file']
  const texts = ['text','search','email','password','url','tel','number']
  const controls = `<button id="button">Button</button><a id="link" href="#">Link</a>
    <select id="select"><option>Dropdown</option></select><details><summary id="summary">Expand</summary></details>
    ${roles.map(role=>`<span id="role-${role}" role="${role}">${role}</span>`).join('')}
    ${types.map(type=>`<input id="input-${type}" type="${type}">`).join('')}
    <label id="label" for="input-checkbox">Checkbox label</label>
    <label id="nested-label"><input type="radio">Radio label</label>
    <button id="disabled" disabled>Disabled</button><select id="disabled-select" disabled></select>
    <button id="aria-disabled" aria-disabled="true">Disabled</button>
    <button id="unavailable" class="cursor-not-allowed">Unavailable</button>
    <fieldset disabled><button id="fieldset-button">Disabled</button></fieldset>
    <div aria-disabled="true"><button id="disabled-parent-button">Disabled</button></div>
    <label id="disabled-label"><input type="checkbox" disabled>Disabled</label>
    ${texts.map(type=>`<input id="text-${type}" type="${type}">`).join('')}
    <textarea id="textarea"></textarea><input id="no-type"><div id="editor" contenteditable="true">Edit</div>
    <div id="plain">Plain text</div><div id="backdrop">Modal backdrop</div>`
  await win.loadURL('data:text/html,' + encodeURIComponent(`<html data-theme="liquid-glass"><body><div class="app-content-shell"><main>${controls}</main></div><button id="portal">Portal button</button></body></html>`))
  await win.webContents.insertCSS(await fs.readFile(path.join(__dirname,'../src/renderer/src/assets/main.css'),'utf8'))
  const cursors = await win.webContents.executeJavaScript(`Object.fromEntries(Array.from(document.querySelectorAll('[id]'),el=>[el.id,getComputedStyle(el).cursor]))`)
  const assertCursor = (ids, expected) => {
    for (const id of ids) if (cursors[id] !== expected) throw new Error(id+': '+cursors[id]+' instead of '+expected)
  }
  assertCursor(['button','link','select','summary','label','nested-label','portal',...roles.map(role=>'role-'+role),...types.map(type=>'input-'+type)],'pointer')
  assertCursor(['disabled','disabled-select','aria-disabled','unavailable','fieldset-button','disabled-parent-button','disabled-label'],'not-allowed')
  assertCursor(['textarea','no-type','editor',...texts.map(type=>'text-'+type)],'text')
  for (const id of ['plain','backdrop']) if (cursors[id] === 'pointer') throw new Error('Noninteractive '+id+' looks clickable')
  console.log('PASS: buttons, links, dropdowns, toggles, input controls, labels and portal controls use pointer')
  console.log('PASS: disabled controls retain not-allowed; editors retain text; noninteractive surfaces unchanged')
  win.destroy()
  app.quit()
}
run().catch(error=>{console.error(error);app.exit(1)})
