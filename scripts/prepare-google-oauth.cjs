// Desktop OAuth client metadata is a public app identity, not a user's login.
// Only this allowlisted shape may enter the installer; never copy token files.
const fs = require('node:fs')
const path = require('node:path')

function publicDesktopCredentials(input) {
  const value = input?.installed
  if (!value || typeof value.client_id !== 'string' || !value.client_id.endsWith('.apps.googleusercontent.com') ||
      typeof value.client_secret !== 'string' || !value.client_secret) {
    throw new Error('Provide Google OAuth credentials of type Desktop app, not a web client or token file.')
  }
  return { installed: { client_id: value.client_id, client_secret: value.client_secret, redirect_uris: ['http://localhost'] } }
}

function prepare() {
  const root = path.resolve(__dirname, '..')
  const local = path.join(root, 'tools/google-drive/google-drive-credentials.json')
  const fromIndex = process.argv.indexOf('--from')
  const source = fromIndex >= 0 ? process.argv[fromIndex + 1] : process.env.POLYHEDRON_GOOGLE_OAUTH_FILE || local
  const target = path.join(root, 'build/google-drive/google-drive-credentials.json')
  let config
  if (source && fs.existsSync(source)) {
    config = publicDesktopCredentials(JSON.parse(fs.readFileSync(source, 'utf8')))
    if (fromIndex >= 0) {
      fs.mkdirSync(path.dirname(local), { recursive: true })
      fs.writeFileSync(local, JSON.stringify(config, null, 2))
    }
  } else {
    config = { installed: { client_id: '', client_secret: '', redirect_uris: ['http://localhost'] } }
    console.warn('Google Drive is unconfigured: provide POLYHEDRON_GOOGLE_OAUTH_FILE to enable desktop sign-in for releases.')
  }
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, JSON.stringify(config, null, 2))
  console.log('Prepared allowlisted desktop OAuth client metadata (no user tokens).')
}

module.exports = { publicDesktopCredentials }
if (require.main === module) prepare()
