import { useState } from 'react'
import { TranslateTab } from './components/TranslateTab'
import { downloadWorkspaceSync, requestDriveAccessToken, uploadWorkspaceSync } from './sync/googleDrive'
import { emptyDocument, type WorkspaceSyncDocument } from './sync/workspaceSync'

const tabs = ['Translate', 'Dialogue Nodes', 'Game Data'] as const
type Tab = (typeof tabs)[number]
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

export function App(): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('Translate')
  const [syncOpen, setSyncOpen] = useState(false)
  const [importSignal, setImportSignal] = useState(0)
  const [document, setDocument] = useState<WorkspaceSyncDocument>(emptyDocument)
  const [driveToken, setDriveToken] = useState<string | null>(null)
  const [syncMessage, setSyncMessage] = useState('')
  const isConnected = driveToken !== null

  async function connectDrive(autoDownload = true): Promise<string | null> {
    if (!googleClientId) {
      setSyncMessage('Set VITE_GOOGLE_CLIENT_ID before connecting Google Drive.')
      return null
    }
    try {
      const token = await requestDriveAccessToken(googleClientId)
      setDriveToken(token)
      if (autoDownload) {
        try {
          const nextDocument = await downloadWorkspaceSync(token)
          setDocument(nextDocument)
          setSyncMessage('Google Drive connected. Workspace downloaded automatically.')
        } catch (error) {
          const detail = error instanceof Error ? error.message : 'Workspace download failed.'
          setSyncMessage(`Google Drive connected, but automatic download failed: ${detail}`)
        }
      } else {
        setSyncMessage('Google Drive connected.')
      }
      return token
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : 'Google Drive authorization failed.')
      return null
    }
  }

  async function upload(): Promise<void> {
    const token = driveToken ?? await connectDrive(false)
    if (!token) return
    if (document.sessions.length === 0) {
      setSyncMessage('Import or load a workspace before uploading.')
      return
    }
    try {
      await uploadWorkspaceSync(token, document)
      setSyncMessage('Workspace uploaded to Google Drive.')
      setSyncOpen(false)
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : 'Google Drive upload failed.')
    }
  }

  async function download(): Promise<void> {
    const token = driveToken ?? await connectDrive(false)
    if (!token) return
    try {
      const nextDocument = await downloadWorkspaceSync(token)
      setDocument(nextDocument)
      setSyncMessage('Workspace downloaded from Google Drive.')
      setSyncOpen(false)
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : 'Google Drive download failed.')
    }
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-lockup">
          <svg aria-hidden="true" className="brand-dragon" viewBox="0 0 12.21 10.26" xmlns="http://www.w3.org/2000/svg">
            <path fill="currentColor" d="M12.19,6.21c-.09.23-.43.6-.76.68.05-.37-.27-.58-.5-.64.15-.71-.15-1.58-1.2-2.55-.89-.84-2.56-2-2.49-3.48-.26.31-.44,1.24-.2,1.79.73.83,2.26,1.71,2.66,3.09-.68-1.61-3.97-2.88-3.83-5.1-.41.42-.66,1.97-.33,2.8.63.36,1.17.98,1.26,1.53-.41-.89-1.72-1.28-2.68-1.96-.41-.3-.76-.64-.96-1.1-.19.55-.08,1.24.24,1.7,0,0-.61-.23-1.84-.18.34.14,1.23.88,1.11,1.31h.01c-.12.44-1.84.94-2.68,1.75,1.24-.24,1.87-.04,2.07.46.14.35-.03.85-.14,1.43.3-.32,1.12-.89,1.95-1.26.33-.14.65-.26.95-.31-.2-.06-.65-.15-.94-.17-.07-.02-.13-.02-.18-.02.06-.07.12-.13.19-.18.83-.73,2.32-.95,3.17-.74-.6-.03-1.78.27-2.25.64.38.06.76.15,1.12.27-.56.21-1.27.84-1.51,1.52.74-.49,2.2-.36,2.43.65.1.45-.08.87-.28,1.13-.1.14-.22.24-.31.27.2.04.73-.02.93-.11-.07.28-.53.75-.8.83.71,0,1.71-.4,2.07-1.01.03-.05.06-.1.08-.15,0,0-.46.15-.67-.06-.19-.18.04-.91.08-1.05-.07.07-.32.33-.52.14-.25-.24.09-1.04.23-1.23-.24-.1-.92-.17-1.21-.14.84-.3,2.73-.45,2.93-.1.16.29-.24.86-.24.86.33-.02,1.29-.01,1.63.38.34.41.14.93.14.93.76-.34,1.43-1.51,1.27-2.62ZM8.4,4.89c.85.3,1.1,1.08,1.1,1.08-.71,0-.94-.52-1.1-1.08Z" />
          </svg>
          <span className="brand-name">Polyhedron</span>
          <span className="brand-platform">Mobile</span>
        </div>
        <div className="sync-menu-wrap">
          <button className="sync-button" type="button" aria-expanded={syncOpen} onClick={() => setSyncOpen((value) => !value)}>{isConnected ? 'Google Drive connected' : 'Sync workspace'}</button>
          {syncOpen && <div className="sync-menu" role="menu">
            <button type="button" onClick={() => { setImportSignal((value) => value + 1); setSyncOpen(false) }}>Import sync file</button>
            {!isConnected && <button type="button" onClick={() => void connectDrive()}>Connect Google Drive</button>}
            <button type="button" disabled={!isConnected && !googleClientId} onClick={() => void upload()}>Upload workspace</button>
            <button type="button" disabled={!isConnected && !googleClientId} onClick={() => void download()}>Download workspace</button>
          </div>}
          {syncMessage && <p className="sync-status" role="status" aria-live="polite">{syncMessage}</p>}
        </div>
      </header>
      <nav className="tabs" aria-label="Companion tabs">
        {tabs.map((item) => <button key={item} type="button" className={tab === item ? 'tab active' : 'tab'} onClick={() => setTab(item)}>{item}</button>)}
      </nav>
      {tab === 'Translate' ? <TranslateTab document={document} onDocumentChange={setDocument} importSignal={importSignal} /> : <section className="placeholder-card">
        <p className="eyebrow">{tab}</p>
        <h2>Companion foundation ready</h2>
        <p>The shared workspace sync contract is in place. The next step connects this tab to the desktop workspace data.</p>
      </section>}
    </main>
  )
}
