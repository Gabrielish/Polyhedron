import { useEffect, useMemo, useState } from 'react'
import { Cloud, Download, Languages, GitBranch, Swords, Upload, CircleCheck, CircleAlert, LoaderCircle, FolderOpen } from 'lucide-react'
import { TranslateTab } from './components/TranslateTab'
import { DialogueNodesTab } from './components/DialogueNodesTab'
import { GameDataTab } from './components/GameDataTab'
import { WorkspaceErrorBoundary } from './components/WorkspaceErrorBoundary'
import { downloadWorkspaceSync, uploadWorkspaceSync } from './sync/googleDrive'
import { beginDriveConnection, pendingDriveConnection, prepareDriveConnection } from './sync/driveConnection'
import { emptyDocument, type WorkspaceSyncDocument } from './sync/workspaceSync'
import dragonSvg from '../../src/renderer/src/assets/dungeons-dragons.svg?raw'

const tabs = [{ name: 'Translate', icon: Languages }, { name: 'Dialogue Nodes', icon: GitBranch }, { name: 'Game Data', icon: Swords }] as const
type Tab = (typeof tabs)[number]['name']
const dragonPath = dragonSvg.match(/<path\b[^>]*\bd="([^"]+)"/)?.[1]

export function App(): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('Translate')
  const [document, setDocument] = useState<WorkspaceSyncDocument>(emptyDocument)
  const [driveToken, setDriveToken] = useState<string | null>(null)
  const [busy, setBusy] = useState<'connecting' | 'downloading' | 'saving' | null>(null)
  const [syncMessage, setSyncMessage] = useState('')
  const [error, setError] = useState(false)
  const [importSignal, setImportSignal] = useState(0)
  const hasWorkspace = document.sessions.length > 0
  const missingSources = useMemo(() => document.sessions.reduce((count, session) => count + session.entries.filter(entry => entry.sourceMissing).length, 0), [document])
  function report(message: string, failed = false): void { setSyncMessage(message); setError(failed) }
  useEffect(() => {
    void prepareDriveConnection().catch(() => {})
    const connection = pendingDriveConnection()
    if (!connection) return
    let active = true
    setBusy('connecting')
    void connection.then(token => {
      if (active) { setDriveToken(token); report('Google Drive connected. You can download your workspace.') }
    }).catch(reason => {
      if (active) report(reason instanceof Error ? reason.message : 'Google authorization failed.', true)
    }).finally(() => { if (active) setBusy(null) })
    return () => { active = false }
  }, [])

  async function connectDrive(): Promise<string> {
    const token = driveToken ?? await beginDriveConnection()
    setDriveToken(token)
    return token
  }
  async function download(): Promise<void> {
    if (busy) return
    setBusy('downloading'); report('Downloading your workspace…')
    try {
      const next = await downloadWorkspaceSync(await connectDrive())
      setDocument(next)
      report('Workspace downloaded from Google Drive.')
    } catch (reason) { report(reason instanceof Error ? reason.message : 'Google Drive download failed.', true) }
    finally { setBusy(null) }
  }
  async function upload(): Promise<void> {
    if (busy || !hasWorkspace) return
    setBusy('saving'); report('Saving your workspace…')
    try { await uploadWorkspaceSync(await connectDrive(), document); report('Workspace saved to Google Drive.') }
    catch (reason) { report(reason instanceof Error ? reason.message : 'Google Drive upload failed.', true) }
    finally { setBusy(null) }
  }

  return <main className="app-shell companion-shell">
    <header className="app-header"><a className="brand-lockup" href="#top" aria-label="Polyhedron home">
      <svg aria-hidden="true" className="brand-dragon" viewBox="0 0 12.21 10.26"><path fill="currentColor" d={dragonPath} /></svg>
      <span className="brand-name">Polyhedron</span><span className="brand-platform">Web companion</span>
    </a><a className="companion-back" href="#top">Back to website <span aria-hidden="true">↗</span></a></header>
    <section className="companion-intro"><p className="eyebrow">YOUR WORKSPACE, WITHIN REACH</p><h1>Your workspace.</h1><p>Download from Google Drive, continue translating, and save your changes back.</p></section>
    <section className="companion-drive" aria-label="Google Drive workspace"><div className="companion-drive-icon"><Cloud size={25} /></div><div className="companion-drive-copy"><h2>Google Drive</h2><p>{busy === 'connecting' ? 'Connecting your account…' : driveToken ? 'Connected · Your workspace is ready to download.' : 'Sign in when you download your synced workspace.'}</p></div><div className="companion-drive-actions"><button type="button" className="primary-button" disabled={busy !== null} onClick={() => void download()}>{busy === 'connecting' || busy === 'downloading' ? <LoaderCircle size={16} className="companion-spin" /> : <Download size={16} />}{busy === 'connecting' ? 'Connecting…' : busy === 'downloading' ? 'Downloading…' : 'Download workspace'}</button>{hasWorkspace && <button type="button" className="secondary-button" disabled={busy !== null} onClick={() => void upload()}>{busy === 'saving' ? <LoaderCircle size={16} className="companion-spin" /> : <Upload size={16} />}{busy === 'saving' ? 'Saving…' : 'Save to Drive'}</button>}</div></section>
    <div className="companion-feedback" aria-live="polite">{syncMessage && <p className={error ? 'sync-status companion-error' : 'sync-status'} role={error ? 'alert' : 'status'}>{error ? <CircleAlert size={16} /> : busy ? <LoaderCircle size={16} className="companion-spin" /> : <CircleCheck size={16} />}{syncMessage}</p>}</div>
    <nav className="tabs" aria-label="Companion tabs">{tabs.map(item => <button key={item.name} type="button" className={tab === item.name ? 'tab active' : 'tab'} onClick={() => setTab(item.name)}><item.icon size={16} />{item.name}</button>)}</nav>
    {!hasWorkspace && <div className="companion-empty"><FolderOpen size={22} /><div><h2>No workspace loaded</h2><p>Download your synced workspace above, or import a workspace-sync.json exported from the desktop app.</p></div><button type="button" className="secondary-button" disabled={busy !== null} onClick={() => { setTab('Translate'); setImportSignal(value => value + 1) }}>Import file</button></div>}
    {missingSources > 0 && <p className="sync-status companion-source-warning" role="status"><CircleAlert size={16} />This older sync file is missing source text for {missingSources.toLocaleString()} {missingSources === 1 ? 'string' : 'strings'}. Translations are kept. Upload your workspace again from an updated desktop app to restore the source text.</p>}
    <WorkspaceErrorBoundary key={`${tab}:${document.generatedAt}`} onReset={() => { setDocument(emptyDocument()); report('Workspace view reset. Your cloud file has not been changed.') }}><div hidden={!hasWorkspace}>{tab === 'Translate' ? <TranslateTab document={document} onDocumentChange={setDocument} importSignal={importSignal} /> : tab === 'Dialogue Nodes' ? <DialogueNodesTab document={document} onDocumentChange={setDocument} /> : <GameDataTab document={document} onDocumentChange={setDocument} />}</div></WorkspaceErrorBoundary>
  </main>
}
