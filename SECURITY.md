# Security and Google Drive setup

Polyhedron stores saved provider API keys and Google refresh tokens using Electron
safeStorage (the operating system's credential encryption). The renderer receives
only a saved-key indicator. This does not protect against malware already running
as the same OS user, and is not a guarantee that the application is vulnerability-free.

Workspace exports, including Drive backups, remove sensitive configuration rows
and compact the exported database. Imports preserve the receiving computer's own
credentials. Old exports/backups created before this change are not retroactively
sanitized: do not share them; rotate any credentials in an export already shared.

## Google OAuth for distributed builds

Create an OAuth client of type **Desktop app** in Google Cloud and enable the
Google Drive API. Polyhedron requests only `https://www.googleapis.com/auth/drive.file`.
Authentication opens the system browser and uses PKCE, a random checked state,
and a callback bound only to `127.0.0.1`.

Prepare client metadata before building:

```powershell
node scripts/prepare-google-oauth.cjs --from C:/path/to/desktop-client.json
npm run build:win
```

The preparation script copies only desktop client metadata. The installed-app
client identity is distributed with the application; personal access/refresh
tokens and provider API keys must never be included. Each user signs into their
own Google account. Keep the prepared credential files out of Git.

In Google Auth Platform > Audience, **Testing** limits access to listed test users
and authorizations for Drive expire after seven days. For public distribution,
change to **In production** and follow any verification requirements shown by
Google. Publishing status is controlled in Google Cloud, not in application code.

## Checks

After building the application:

```powershell
npm run typecheck
# Ensure ELECTRON_RUN_AS_NODE is not set when running Electron tests.
npm run test:security
npm run test:security:startup
# Read-only package audit; optionally supply --profile C:/path/to/local/profile.
electron tests/verify-release-security.cjs dist/security-check/win-unpacked
```

The tests use temporary databases and fake credentials, OS encryption, a real
loopback callback, and the built sandboxed preload. They do not authorize a real
Google account. Before release, test Connect, upload/download, restart and
Disconnect with a separate Google account on a clean installation. Inspect the
final distribution for unintended user files; an old installer does not gain
these protections without being rebuilt.
