// Live development-preview regression; no application or installer build.
const { app, BrowserWindow } = require('electron')
const assert = require('node:assert/strict')
const base = process.env.POLYHEDRON_PREVIEW_URL || 'http://127.0.0.1:5174/Polyhedron/'
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show:false, width:1200, height:800, webPreferences:{ contextIsolation:true, nodeIntegration:false } })
  const evaluate = code => win.webContents.executeJavaScript(code)
  async function atAnchor(id) {
    for (let attempt = 0; attempt < 100; attempt++) {
      const aligned = await evaluate(`(() => { const target=document.getElementById(${JSON.stringify(id)}); if(!target) return false; const top=target.getBoundingClientRect().top; return scrollY>100 && top>=0 && top<=110; })()`)
      if (aligned) return
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    throw new Error(`Anchor ${id} did not align: ` + JSON.stringify(await evaluate(`({hash:location.hash,scroll:scrollY,top:document.getElementById(${JSON.stringify(id)})?.getBoundingClientRect().top})`)))
  }
  try {
    for (const [width,height] of [[1200,800],[390,844]]) {
      win.setContentSize(width,height)
      await win.loadURL(base+'#download')
      await atAnchor('download')
      await evaluate('location.hash="#tools"; undefined')
      await atAnchor('tools')
      await evaluate('location.hash="#app"; undefined')
      for (let n=0;n<100;n++) {
        if(await evaluate('!!document.querySelector(".companion-page")')) break
        await new Promise(resolve=>setTimeout(resolve,100))
      }
      assert.ok(await evaluate('!!document.querySelector(".companion-page")'))
      await evaluate('location.hash="#download"; undefined')
      await atAnchor('download')
      console.log(`PASS: ${width}px direct download link, section navigation, companion return`)
    }
  } finally { win.destroy(); app.quit() }
}).catch(error=>{console.error(error);app.exit(1)})
