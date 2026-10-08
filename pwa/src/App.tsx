import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { ArrowRight, Cloud, Download, Languages, GitBranch, Swords, Upload, CircleCheck, CircleAlert, LoaderCircle, FolderOpen } from 'lucide-react'
import { TranslateTab } from './components/TranslateTab'
import { WandSparkles } from 'lucide-react'
import { WorkspaceErrorBoundary } from './components/WorkspaceErrorBoundary'
import { downloadWorkspaceSync, uploadWorkspaceSync } from './sync/googleDrive'
import { beginDriveConnection, pendingDriveConnection, prepareDriveConnection } from './sync/driveConnection'
import { emptyDocument, type WorkspaceSyncDocument } from './sync/workspaceSync'
import dragonSvg from '../../src/renderer/src/assets/dungeons-dragons.svg?raw'

const tabs = [{ name: 'Translate', icon: Languages }, { name: 'Dialogue Nodes', icon: GitBranch }, { name: 'Game Data', icon: Swords }, { name: 'Spells', icon: WandSparkles }] as const
type Tab = (typeof tabs)[number]['name']
const dragonPath = dragonSvg.match(/<path\b[^>]*\bd="([^"]+)"/)?.[1]
const DialogueNodesTab = lazy(() => import('./components/DialogueNodesTab').then(module => ({ default: module.DialogueNodesTab })))
const GameDataTab = lazy(() => import('./components/GameDataTab').then(module => ({ default: module.GameDataTab })))
const SpellsTab = lazy(() => import('./components/SpellsTab').then(module => ({ default: module.SpellsTab })))

export function App(): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('Translate')
  const [visited, setVisited] = useState<Set<Tab>>(new Set(['Translate']))
  const [project, setProject] = useState('')
  const [document, setDocument] = useState<WorkspaceSyncDocument>(emptyDocument)
  const [driveToken, setDriveToken] = useState<string | null>(null)
  const [busy, setBusy] = useState<'connecting' | 'downloading' | 'saving' | null>(null)
  const [syncMessage, setSyncMessage] = useState('')
  const [error, setError] = useState(false)
  const [importSignal, setImportSignal] = useState(0)
  const hasWorkspace = document.sessions.length > 0
  const sessionId = document.sessions.find(item => item.id === project)?.id ?? document.sessions[0]?.id
  function selectTab(next: Tab): void { setTab(next); setVisited(current => current.has(next) ? current : new Set([...current, next])) }
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

  return <div className="companion-page">
    <header className="lp-header companion-header"><a className="lp-brand" href="#app" aria-label="Polyhedron companion" onClick={event => { event.preventDefault(); window.scrollTo({ top: 0, behavior: 'auto' }) }}>
      <svg aria-hidden="true" viewBox="0 0 12.21 10.26"><path fill="currentColor" d={dragonPath} /></svg>
      <span>Polyhedron</span>
    </a><span className="brand-platform">Web companion</span><a className="lp-nav-connect companion-back" href="#top"><span className="companion-back-desktop">Back to website</span><span className="companion-back-mobile">Website</span><ArrowRight size={15} aria-hidden="true" /></a></header>
    <main className="app-shell companion-shell">
    <section className="companion-workspace-bar" aria-label="Google Drive workspace">
      <div className="companion-workspace-mark" aria-hidden="true"><Cloud size={27} /></div>
      <div className="companion-workspace-copy"><h1>{hasWorkspace ? 'Your workspace' : 'Open a workspace'}</h1><p>{hasWorkspace ? 'Continue editing and save your changes to Google Drive.' : 'Download from Google Drive or import a .pws workspace or sync JSON file.'}</p><span className="companion-connection"><Cloud size={13} aria-hidden="true" />{busy === 'connecting' ? 'Connecting…' : driveToken ? 'Google Drive connected' : 'Google sign-in only needed for Drive'}</span>
      </div>
      <div className="companion-workspace-actions">
        <button type="button" className="primary-button" disabled={busy !== null} onClick={() => void download()}>{busy === 'connecting' || busy === 'downloading' ? <LoaderCircle size={16} className="companion-spin" /> : <Download size={16} />}{busy === 'connecting' ? 'Connecting…' : busy === 'downloading' ? 'Downloading…' : 'Download workspace'}</button>
        {hasWorkspace ? <button type="button" className="secondary-button" disabled={busy !== null} onClick={() => void upload()}>{busy === 'saving' ? <LoaderCircle size={16} className="companion-spin" /> : <Upload size={16} />}{busy === 'saving' ? 'Saving…' : 'Save to Drive'}</button> : <button type="button" className="secondary-button" disabled={busy !== null} onClick={() => { setTab('Translate'); setImportSignal(value => value + 1) }}><FolderOpen size={16} />Import file</button>}
      </div>
    </section>
    {!driveToken && <aside className="companion-drive-notice" aria-label="Google Drive availability"><CircleAlert size={16} aria-hidden="true" /><p><strong>Google Drive access is temporarily limited.</strong> Google verification is in progress, so sign-in is currently available only to approved test users. In the meantime, use Import file to open a .pws workspace or sync JSON file without signing in.</p></aside>}
    {syncMessage && <div className="companion-feedback" aria-live="polite"><p className={error ? 'sync-status companion-error' : 'sync-status'} role={error ? 'alert' : 'status'}>{error ? <CircleAlert size={16} /> : busy ? <LoaderCircle size={16} className="companion-spin" /> : <CircleCheck size={16} />}{syncMessage}</p></div>}
    <nav className="tabs" aria-label="Companion tabs">{tabs.map(item => <button key={item.name} type="button" aria-pressed={tab === item.name} className={tab === item.name ? 'tab active' : 'tab'} onClick={() => selectTab(item.name)}><item.icon size={16} />{item.name}</button>)}</nav>
    {hasWorkspace && <div className="companion-project"><FolderOpen size={15} /><label htmlFor="workspace-project">Project</label><select id="workspace-project" value={sessionId} onChange={event => setProject(event.target.value)}>{document.sessions.map(item => <option key={item.id} value={item.id}>{item.modName}</option>)}</select></div>}
    {missingSources > 0 && <p className="sync-status companion-source-warning" role="status"><CircleAlert size={16} />This older sync file is missing source text for {missingSources.toLocaleString()} {missingSources === 1 ? 'string' : 'strings'}. Translations are kept. Upload your workspace again from an updated desktop app to restore the source text.</p>}
    {tabs.filter(item => visited.has(item.name)).map(item => <div key={item.name} hidden={tab !== item.name || (!hasWorkspace && item.name !== 'Spells')}><WorkspaceErrorBoundary key={document.sessions.map(session => session.id).join('|')} onReset={() => { setDocument(emptyDocument()); report('Workspace view reset. Your cloud file has not been changed.') }}><Suspense fallback={<p className="companion-inline-status" role="status">Loading tab…</p>}>{item.name === 'Translate' ? <TranslateTab document={document} sessionId={sessionId} onDocumentChange={setDocument} importSignal={importSignal} onImportMessage={report} /> : item.name === 'Dialogue Nodes' ? <DialogueNodesTab document={document} sessionId={sessionId} onDocumentChange={setDocument} /> : item.name === 'Spells' ? <SpellsTab document={document} sessionId={sessionId} onDocumentChange={setDocument} /> : <GameDataTab document={document} sessionId={sessionId} onDocumentChange={setDocument} />}</Suspense></WorkspaceErrorBoundary></div>)}
    </main>
  </div>
}
