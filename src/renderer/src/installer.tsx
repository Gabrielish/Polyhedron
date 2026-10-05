import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Check, Download, FolderOpen, Minus, X, ArrowRight, ShieldCheck } from 'lucide-react'
import { PolyhedronMark } from './components/shared/PolyhedronMark'
import { ProgressBar } from './components/shared/ProgressBar'
import { btnBase, btnPrimary, btnGhostIcon } from './features/translate/components/styles'
import { applyTheme } from './context/ThemeContext'
import type { InstallerAPI, InstallerStatus } from '../../preload/installer-types'
import './assets/main.css'
import './installer.css'

declare global { interface Window { installer: InstallerAPI } }
applyTheme('liquid-glass', '#A7F175', 'black')

function Installer(): React.JSX.Element {
  const [status, setStatus] = useState<InstallerStatus | null>(null)
  const [target, setTarget] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [visualProgress, setVisualProgress] = useState(0)
  useEffect(() => {
    let active = true
    const poll = (): void => { void window.installer.status().then((next) => {
      if (!active) return
      setStatus(next)
      setTarget((previous) => previous || next.target)
    }).catch(() => { if (active) setError('Unable to contact Setup. Please open the installer again.') }) }
    poll()
    const timer = setInterval(poll, 300)
    return () => { active = false; clearInterval(timer) }
  }, [])
  useEffect(() => {
    if (status?.state === 'done') { setVisualProgress(100); return }
    if (status?.state !== 'installing') { setVisualProgress(0); return }
    const started = performance.now()
    const timer = window.setInterval(() => {
      // Cosmetic, single-pass animation. Only NSIS can confirm completion and
      // enable opening the app, even if the animation has reached its end.
      const elapsed = performance.now() - started
      setVisualProgress(Math.min(100, (elapsed / 27000) * 100))
    }, 50)
    return () => window.clearInterval(timer)
  }, [status?.state])
  const installing = status?.state === 'installing'
  const done = status?.state === 'done'
  const failed = status?.state === 'error'
  const run = async (action: () => Promise<void>): Promise<void> => {
    setBusy(true); setError('')
    try { await action() } catch (cause) { setError(cause instanceof Error ? cause.message.replace(/^Error invoking remote method '[^']+': Error: /, '') : String(cause)) }
    finally { setBusy(false) }
  }
  return <div className="setup-shell flex h-screen flex-col text-neutral-200">
    <header className="setup-title flex h-10 shrink-0 items-center justify-between border-b border-neutral-800 px-4">
      <div className="flex items-center gap-2 text-xs text-neutral-400"><PolyhedronMark className="h-4 w-4 text-amber-500"/>Polyhedron Setup</div>
      <div className="setup-no-drag flex gap-1">
        <button className={btnGhostIcon} aria-label="Minimize" onClick={() => void window.installer.minimize()}><Minus size={14}/></button>
        <button className={btnGhostIcon} disabled={installing} aria-label="Close" onClick={() => void window.installer.close()}><X size={14}/></button>
      </div>
    </header>
    <main className="flex min-h-0 flex-1 flex-col gap-5 px-7 py-6">
      <div className="flex items-center gap-4">
        <div className="app-panel-surface flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-neutral-800"><PolyhedronMark className="h-11 w-11 text-amber-500"/></div>
        <div><h1 className="text-xl font-semibold tracking-tight">{done ? 'Ready to translate' : failed ? 'Installation interrupted' : installing ? 'Installing Polyhedron' : 'Welcome to Polyhedron'}</h1>
          <p className="mt-1 text-sm text-neutral-400">{done ? 'Polyhedron is installed and ready to open.' : installing ? 'Setting up your translation workspace.' : 'Your workspace for game translations.'}</p></div>
      </div>
      <section className="app-panel-surface flex-1 overflow-hidden rounded-xl border border-neutral-800">
        <div className="flex items-center gap-2 border-b border-neutral-800 px-5 py-3 text-sm font-medium"><FolderOpen size={16} className="text-amber-500"/>{done ? 'Installation complete' : installing ? 'Installation progress' : 'Installation folder'}</div>
        <div className="space-y-4 p-5">
          {installing ? <>
            <div className="flex items-center justify-between text-sm"><span>Installing application files</span><span className="text-neutral-500">Please wait</span></div>
            <ProgressBar current={visualProgress} total={100} showCounts={false} showPercentage={false} tone="accent"/>
            <p className="text-xs leading-relaxed text-neutral-500">Your existing projects and settings are kept. You can close Setup once installation is complete.</p>
          </> : done ? <>
            <div className="flex items-center gap-2 text-sm"><Check size={18} className="text-amber-500"/>Successfully installed</div>
            <p className="break-all text-xs text-neutral-400">{status?.target}</p>
          </> : <>
            <p className="text-xs text-neutral-400">Install for your Windows account. Choose where to keep the application.</p>
            <div className="flex items-center gap-2">
              <input aria-label="Installation folder" value={target} disabled={busy || failed || !status} onChange={(event) => setTarget(event.target.value)} className="settings-default-input h-[30px] min-w-0 flex-1 rounded-md border border-neutral-800 bg-[#0f1114] px-3 text-xs text-neutral-200 outline-none transition-all focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20"/>
              <button className={btnBase} disabled={busy || failed || !status} onClick={() => void run(async () => { const folder = await window.installer.browse(); if (folder) setTarget(folder) })}><FolderOpen size={14}/>Browse</button>
            </div>
            <div className="flex items-center gap-2 text-xs text-neutral-500"><ShieldCheck size={15}/>Existing projects and settings are preserved.</div>
          </>}
          {(error || status?.error || failed) && <p role="alert" className="text-xs text-red-400">{error || status?.error || 'Setup could not complete. Close it and run the installer again.'}</p>}
        </div>
      </section>
    </main>
    <footer className="flex h-16 shrink-0 items-center justify-between border-t border-neutral-800 px-7">
      <span className="text-xs text-neutral-500">Polyhedron {status?.version ?? ''}{status?.preview ? ' · Preview' : ''}</span>
      <div className="flex gap-2">
        <button className={btnBase} disabled={installing || busy} onClick={() => void window.installer.close()}>{done || failed ? 'Close' : 'Cancel'}</button>
        {!failed && <button className={btnPrimary} disabled={installing || busy || !status} onClick={() => void run(() => done ? window.installer.launch() : window.installer.install(target))}>{done ? <ArrowRight size={14}/> : <Download size={14}/>} {done ? 'Open Polyhedron' : installing ? 'Installing…' : 'Install'}</button>}
      </div>
    </footer>
  </div>
}
createRoot(document.getElementById('root')!).render(<Installer/> )
