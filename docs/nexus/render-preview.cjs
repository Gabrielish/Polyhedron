const fs = require('node:fs/promises')
const path = require('node:path')
const { app, BrowserWindow } = require('electron')

const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')

async function run() {
  const source = await fs.readFile(path.join(__dirname, 'Polyhedron-Nexus-BBCode.txt'), 'utf8')
  const tokens = /\[(\/?)(size|color|b|center|url|img|list|\*|line)(?:=([^\]]+))?\]/g
  const stack = []
  let output = '', cursor = 0
  const tags = { size: 'span', color: 'span', b: 'strong', center: 'div', url: 'a', list: 'ul', '*': 'li' }
  for (const match of source.matchAll(tokens)) {
    if (match.index < cursor) continue
    output += escape(source.slice(cursor, match.index)).replaceAll('\n', '<br>\n')
    const [, closing, tag, value] = match
    cursor = match.index + match[0].length
    if (tag === 'line') { output += '<hr>'; continue }
    if (tag === 'img') {
      const end = source.indexOf('[/img]', cursor)
      if (end < 0) throw Error('Unclosed image')
      const url = source.slice(cursor, end).trim()
      const header = url === 'POLYHEDRON_HEADER_IMAGE_URL'
      output += `<img src="${escape(header ? 'Polyhedron-header.png' : url)}" alt="${header ? 'Polyhedron — Every word. In your world.' : url.includes('showcase') ? 'Polyhedron application screenshot' : 'Support the project'}" class="${header ? 'brand-header' : url.includes('showcase') ? 'showcase' : 'badge'}">`
      cursor = end + 6
      continue
    }
    if (closing) {
      const open = stack.pop()
      if (!open || open.tag !== tag) throw Error(`Mismatched BBCode: ${match[0]}`)
      output += `</${open.html}>`
      continue
    }
    const html = tag === 'list' && value === '1' ? 'ol' : tags[tag]
    stack.push({ tag, html })
    const attributes = tag === 'center' ? ' class="center"'
      : tag === 'color' ? ` style="color:${escape(value)}"`
      : tag === 'size' ? ` class="size-${escape(value)}"`
      : tag === 'url' ? ` href="${escape(value)}"`
      : ''
    output += `<${html}${attributes}>`
  }
  output += escape(source.slice(cursor)).replaceAll('\n', '<br>\n')
  if (stack.length) throw Error('Unclosed BBCode tags')
  // BBCode blank lines are useful in the editor; suppress their HTML equivalents
  // between list containers/items so the preview does not double their spacing.
  output = output.replace(/(<(?:ul|ol|li)>)(?:<br>\s*)+/g, '$1').replace(/(<\/li>)(?:<br>\s*)+/g, '$1')
  const htmlPath = path.join(__dirname, 'Polyhedron-preview.html')
  await fs.writeFile(htmlPath, `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Polyhedron — description preview</title><style>
    :root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#101010;color:#d4d4d8;font:16px/1.65 system-ui,-apple-system,Segoe UI,sans-serif}main{max-width:1080px;margin:0 auto;padding:64px 44px 80px}a{color:#a7f175;text-decoration:none}a:hover{text-decoration:underline}.center{text-align:center}.size-6{font-size:46px;letter-spacing:.08em;font-weight:700}.size-4{font-size:22px;letter-spacing:.02em}strong{font-weight:650}.showcase{display:block;width:100%;height:auto;margin:28px auto;border:1px solid #303030;border-radius:16px}.badge{display:inline-block;height:32px;max-width:100%;margin:5px}hr{border:0;height:1px;background:#303030;margin:32px 0}ul,ol{text-align:left;margin:12px 0 20px;padding-left:26px}li{margin:7px 0}li::marker{color:#a7f175}@media(max-width:600px){main{padding:36px 20px}.size-6{font-size:32px}.size-4{font-size:19px}}
    body{background:#29292e}.size-5{font-size:28px}.brand-header{display:block;width:min(100%,720px);height:auto;margin:0 auto}
    </style></head><body><main>${output}</main></body></html>`)
  console.log('PASS: BBCode tag nesting and list structure are balanced')
  await app.whenReady()
  const win = new BrowserWindow({ show: false, width: 1200, height: 1500, webPreferences: { backgroundThrottling: false } })
  await win.loadFile(htmlPath)
  const images = await win.webContents.executeJavaScript(`Promise.all([...document.images].map(i=>i.complete?Promise.resolve({url:i.src,ok:i.naturalWidth>0}):new Promise(resolve=>{i.onload=()=>resolve({url:i.src,ok:true});i.onerror=()=>resolve({url:i.src,ok:false})})))`)
  console.log(JSON.stringify(images))
  const overflow = await win.webContents.executeJavaScript('document.documentElement.scrollWidth>innerWidth')
  if (overflow || images.some(image => !image.ok)) throw Error('Preview overflow or failed image')
  await fs.writeFile(path.join(__dirname, 'Polyhedron-preview.png'), (await win.webContents.capturePage()).toPNG())
  console.log('PASS: preview images load and no horizontal overflow')
  win.destroy()
  app.quit()
}
run().catch(error => { console.error(error); app.exit(1) })
