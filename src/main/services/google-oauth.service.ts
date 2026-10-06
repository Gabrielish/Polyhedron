import crypto from 'node:crypto'
import http from 'node:http'
import { shell } from 'electron'
import { google } from 'googleapis'

export async function authenticateDesktopGoogle(clientId: string, clientSecret: string, scope: string) {
  const auth = new google.auth.OAuth2(clientId, clientSecret)
  const { codeVerifier, codeChallenge } = await auth.generateCodeVerifierAsync()
  const state = crypto.randomBytes(32).toString('hex')
  return new Promise<typeof auth>((resolve, reject) => {
    let settled = false
    let exchanging = false
    let redirectUri = ''
    const finish = (error?: Error): void => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      server.close()
      if (error) reject(error)
      else resolve(auth)
    }
    const server = http.createServer(async (request, response) => {
      response.setHeader('Cache-Control', 'no-store')
      response.setHeader('Content-Type', 'text/plain; charset=utf-8')
      response.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'")
      const url = new URL(request.url ?? '/', 'http://127.0.0.1')
      if (request.method !== 'GET' || url.pathname !== '/oauth2callback') {
        response.writeHead(404); response.end('Not found'); return
      }
      const receivedState = url.searchParams.get('state') ?? ''
      const receivedBytes = Buffer.from(receivedState)
      const expectedBytes = Buffer.from(state)
      if (receivedBytes.length !== expectedBytes.length || !crypto.timingSafeEqual(receivedBytes, expectedBytes)) {
        response.writeHead(400); response.end('Invalid authorization state.'); return
      }
      if (exchanging || settled) { response.writeHead(409); response.end('Already handled.'); return }
      exchanging = true
      if (url.searchParams.has('error')) {
        response.end('Sign-in was cancelled. You can close this tab.')
        finish(new Error('Google sign-in was cancelled.'))
        return
      }
      const code = url.searchParams.get('code')
      if (!code) {
        response.writeHead(400); response.end('Missing authorization code.')
        finish(new Error('Google did not return an authorization code.'))
        return
      }
      try {
        const { tokens } = await auth.getToken({ code, codeVerifier, redirect_uri: redirectUri })
        if (!tokens.refresh_token) throw new Error('No refresh token')
        auth.setCredentials(tokens)
        response.end('Polyhedron is connected. You can close this tab and return to the application.')
        finish()
      } catch {
        response.writeHead(400); response.end('Sign-in failed. Please try again from Polyhedron.')
        finish(new Error('Google sign-in failed. Check the OAuth app configuration and try connecting again.'))
      }
    })
    const timeout = setTimeout(() => finish(new Error('Google sign-in timed out. Please try again.')), 180000)
    server.on('error', () => finish(new Error('Could not start the local Google sign-in callback.')))
    // Explicitly bind loopback; the callback must never listen on the LAN.
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') { finish(new Error('Invalid OAuth callback address')); return }
      redirectUri = `http://127.0.0.1:${address.port}/oauth2callback`
      const url = auth.generateAuthUrl({
        redirect_uri: redirectUri,
        access_type: 'offline',
        scope: [scope],
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256' as NonNullable<Parameters<typeof auth.generateAuthUrl>[0]>['code_challenge_method'],
        prompt: 'consent select_account'
      })
      void shell.openExternal(url).catch(() => finish(new Error('Could not open your browser for Google sign-in.')))
    })
  })
}
