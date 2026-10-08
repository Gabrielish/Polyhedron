import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowDownAZ, ArrowDownUp, ArrowDownWideNarrow, ArrowRight, ArrowRightToLine, BookOpen, CaseSensitive, Check, ChevronRight, Cloud, Code2 as Github, Download, Equal, FileCode2, FolderSync, GitBranch, Hash, Highlighter, Languages, ListChecks, Menu, Monitor, Replace, Search, ShieldCheck, Smartphone, Sparkles, SquareDashed, Swords, WandSparkles, WholeWord, X } from 'lucide-react'
import dragonSvg from '../../src/renderer/src/assets/dungeons-dragons.svg?raw'
import { beginDriveConnection, prepareDriveConnection } from './sync/driveConnection'
import { Apple, Clock3, Coffee, Heart, Lightbulb, MessageSquare, Terminal } from 'lucide-react'
import { releaseDownloads, virusTotalReport, windowsReportUrl } from './releaseDownloads'
import './landing.css'

const repo = 'https://github.com/Gabrielish/Polyhedron'
const ideaUrl = `${repo}/issues/new?title=${encodeURIComponent('Suggestion: ')}&body=${encodeURIComponent('## What would you like to improve?\n\n\n## How would this help your translation workflow?\n\n')}`
const asset = (name: string) => `${import.meta.env.BASE_URL}showcase/${name}.png`
const dragonPath = dragonSvg.match(/<path\b[^>]*\bd="([^"]+)"/)?.[1]
function Dragon({ className = '' }: { className?: string }): React.JSX.Element {
  return <svg className={className} aria-hidden="true" viewBox="0 0 12.21 10.26"><path d={dragonPath} fill="currentColor" /></svg>
}

const workspaces = [
  { name: 'Translate', icon: Languages, image: 'translate', title: 'Two languages. One clear view.', description: 'Source and translation side by side. Keep XML tags visible, switch gender variants, and move through untranslated or review-ready strings without losing your place.', details: ['Side-by-side & stacked views', 'Default, female & neutral variants', 'Review status & translation history'] },
  { name: 'Consistency', icon: ListChecks, image: 'consistency', title: 'One phrase. Consistent wording.', description: 'Compare repeated source strings and their translations in one place. Spot differences, inspect their context, and choose the wording that fits.', details: ['Grouped repeated strings', 'Translation variants & occurrence counts', 'Context & suggested wording'] },
  { name: 'Dialogue Nodes', icon: GitBranch, image: 'dialogues', title: 'Translate the conversation, not just the line.', description: 'Follow speakers, nodes and dialogue context. Read the source alongside your translation, with reference views close at hand.', details: ['Dialogue navigation', 'Speaker & status filters', 'Context-aware editing'] },
  { name: 'Game Data', icon: Swords, image: 'game-data', title: 'Names and descriptions, together.', description: 'Explore game entries, compare titles and descriptions, and jump back to the translation editor. Integrated references help you understand what a string belongs to.', details: ['Searchable game entries', 'Linked source & translation', 'Reference views'] },
  { name: 'Spells', icon: WandSparkles, image: 'spells', title: 'See the detail behind every ability.', description: 'Browse spells, actions and abilities as cards or a list. Keep related variations, conditions and translation status within reach.', details: ['Cards & list views', 'Variants & conditions', 'Translation progress'] },
  { name: 'Workspace', icon: FolderSync, image: 'workspace', title: 'Your work, ready to move.', description: 'Import or export a portable workspace, export your current translation, and keep project and mod tools together. Game-specific installation options are available where supported.', details: ['Portable .pws backups', 'XML, PAK & ZIP exports', 'Project & mod tools'] },
  { name: 'Term Glossary', icon: BookOpen, image: 'glossary', title: 'Keep your terminology close.', description: 'Build a glossary of preferred translations. Terms appear as dotted underlines in the source text, keeping your chosen wording within reach while you edit.', details: ['Source terms & preferred translations', 'Searchable glossary', 'In-editor term highlights'] }
] as const

const tools = [
  { name: 'Search scope', icon: Search, description: 'Choose Everything, Source or Target to search both languages, only the source text, or only translations.' },
  { name: 'Match case', icon: CaseSensitive, description: 'Make searches case-sensitive so uppercase and lowercase letters are treated differently.' },
  { name: 'Whole word', icon: WholeWord, description: 'Match complete words instead of finding the same letters inside longer words.' },
  { name: 'Exact match', icon: Equal, description: 'Find a complete matching string instead of every line that contains the same words.' },
  { name: 'Starts with', icon: ArrowRightToLine, description: 'Narrow the list to strings beginning with your search text.' },
  { name: 'Repeated strings', icon: ArrowDownUp, description: 'Cycle repeated-string sorting to bring recurring text together and make consistency checks easier.' },
  { name: 'String length', icon: ArrowDownWideNarrow, description: 'Sort by length to surface the shortest or longest strings first.' },
  { name: 'Edge spaces', icon: SquareDashed, description: 'Inspect leading and trailing whitespace before it becomes a formatting problem.' },
  { name: 'Content IDs', icon: Hash, description: 'Reveal content IDs when you need to identify or reference a particular string.' },
  { name: 'Match highlighting', icon: Highlighter, description: 'Underline or select search matches so you can spot the relevant text immediately.' },
  { name: 'Translation suggestions', icon: Sparkles, description: 'Bring up translation suggestions to compare existing wording as you work.' },
  { name: 'Find and replace', icon: Replace, description: 'Enter the text to find and its replacement. Replace the first match or all matches, with dedicated undo and redo controls for replacement edits.' }
] as const

const extraQuestions = [
  ['Which games does Polyhedron support?', 'You can create translation projects for Baldur’s Gate 3, Divinity: Original Sin and Divinity: Original Sin 2. Select the game when setting up your project. The reference views shown on this website demonstrate a Baldur’s Gate 3 workspace.'],
  ['Does downloading Polyhedron translate my game?', 'No. The download is a translation editor, not a finished language pack. You create or import a project, edit the translations, then export the result from Workspace to use with your game.'],
  ['Can I work without a Google account?', 'Yes. Local desktop editing and workspace file import/export do not require Google sign-in. Connect your Google account only if you want to transfer a workspace through Google Drive.'],
  ['Do I need AI or paid translation services?', 'No. You can edit every translation manually. The optional provider tools use your own credentials where required; API keys and provider credits are not included with Polyhedron. Any service charges are separate from the application.'],
  ['What should I save as a backup?', 'In the desktop Workspace tab, export a .pws file to keep a portable copy of your translation workspace. Keep another copy outside the application, even if you use Google Drive. Before installing a translation, also back up any original game files you plan to replace.'],
  ['Which desktop platforms are available?', 'Windows has an x64 setup installer. macOS has a DMG for Apple Silicon Macs, not a native Intel build. The Linux version is coming soon and does not have a download yet.']
] as const

export function LandingPage(): React.JSX.Element {
  useEffect(() => { void prepareDriveConnection().catch(() => {}) }, [])
  const [menu, setMenu] = useState(false)
  const [moreQuestions, setMoreQuestions] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  const [workspace, setWorkspace] = useState(0)
  const [tool, setTool] = useState(0)
  const [zoom, setZoom] = useState(false)
  const zoomClose = useRef<HTMLButtonElement>(null)
  const zoomTrigger = useRef<HTMLButtonElement>(null)
  const [release, setRelease] = useState<ReturnType<typeof releaseDownloads> | null>(null)
  const windowsReport = windowsReportUrl
  const macReport = virusTotalReport(release?.mac)
  const current = workspaces[workspace]
  const SelectedIcon = tools[tool].icon
  useEffect(() => {
    document.title = 'Polyhedron — A workspace for game translation'
    const abort = new AbortController()
    const timeout = setTimeout(() => abort.abort(), 8000)
    void fetch('https://api.github.com/repos/Gabrielish/Polyhedron/releases/latest', { signal: abort.signal }).then(response => {
      if (!response.ok) throw new Error('Release unavailable')
      return response.json() as Promise<Parameters<typeof releaseDownloads>[0]>
    }).then(data => {
      setRelease(releaseDownloads(data))
    }).catch(() => {}).finally(() => clearTimeout(timeout))
    return () => { abort.abort(); clearTimeout(timeout) }
  }, [])
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (zoom) { setZoom(false); zoomTrigger.current?.focus() }
      else if (menu) { setMenu(false); menuButton.current?.focus() }
    }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [menu, zoom])
  useEffect(() => {
    if (!zoom) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    zoomClose.current?.focus()
    return () => { document.body.style.overflow = previous }
  }, [zoom])
  const closeZoom = () => { setZoom(false); zoomTrigger.current?.focus() }
  const nav = [['Workspace', '#workspace'], ['Tools', '#tools'], ['Download', '#download'], ['Feedback', '#feedback']] as const
  return <div className="landing" id="top" onClick={event => {
    const link = event.target instanceof Element ? event.target.closest('a[href="#app"]') : null
    if (link && /connect/i.test(link.textContent ?? '') && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      // The workspace displays failures, including a missing OAuth client ID.
      void beginDriveConnection().catch(() => {})
    }
  }}>
    <a className="lp-skip" href="#main">Skip to content</a>
    <header className="lp-header">
      <a href="#top" className="lp-brand" aria-label="Polyhedron home"><Dragon /><span>Polyhedron</span></a>
      <nav className={`lp-nav ${menu ? 'is-open' : ''}`} id="site-navigation" aria-label="Main navigation">
        {nav.map(([label, href]) => <a key={label} href={href} onClick={() => setMenu(false)}>{label}</a>)}
        <a href={repo} target="_blank" rel="noopener noreferrer" className="lp-github" aria-label="Polyhedron on GitHub"><Github size={18} /></a>
      </nav>
      <a className="lp-nav-connect" href="#app">Connect <ArrowRight size={15} /></a>
      <button className="lp-menu" ref={menuButton} aria-label={menu ? 'Close menu' : 'Open menu'} aria-expanded={menu} aria-controls="site-navigation" onClick={() => setMenu(value => !value)}>{menu ? <X size={22} /> : <Menu size={22} />}</button>
    </header>
    <main id="main">
      <section className="lp-hero lp-wrap" aria-labelledby="hero-heading">
        <div className="lp-hero-glow" aria-hidden="true" />
        <div className="lp-hero-copy">
        <p className="lp-eyebrow"><span /> BUILT FOR GAME TRANSLATION</p>
        <h1 id="hero-heading">Every word.<br /><em>In your world.</em></h1>
        <p className="lp-hero-description">Meet Polyhedron. A focused workspace for translating games — with the context, clarity and control every line deserves.</p>
        <div className="lp-actions"><a className="lp-button lp-primary" href="#app"><Cloud size={18} />Connect<ArrowRight size={17} /></a><a className="lp-button lp-secondary" href="#download"><Download size={18} />Download</a></div>
        <div className="lp-platforms"><span><Monitor size={14} /> Windows & macOS</span><span><Smartphone size={14} /> Web companion</span><span><Github size={14} /> Open development</span></div>
        </div>
        <div className="lp-hero-preview"><img src={asset('translate')} width={1920} height={1170} alt="Polyhedron desktop translation editor, with English source text, Romanian translations, search tools and review actions" fetchPriority="high" /></div>
        <a className="lp-scroll-link" href="#workspace">A closer look <ArrowDown size={15} /></a>
      </section>
      <section className="lp-section lp-wrap" id="workspace" aria-labelledby="workspace-heading">
        <div className="lp-section-heading"><div><p className="lp-eyebrow">01 / YOUR WORKSPACE</p><h2 id="workspace-heading">More context.<br /><span>Better translations.</span></h2></div><p>One workspace, different perspectives. Move from individual strings to dialogue and game references without starting over.</p></div>
        <div className="lp-tabs" role="tablist" aria-label="Desktop workspaces">
          {workspaces.map((item, index) => <button key={item.name} role="tab" id={`workspace-tab-${index}`} aria-controls="workspace-panel" aria-selected={workspace === index} tabIndex={workspace === index ? 0 : -1} onClick={() => setWorkspace(index)} onKeyDown={event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
            event.preventDefault()
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? workspaces.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + workspaces.length) % workspaces.length
            setWorkspace(next); document.getElementById(`workspace-tab-${next}`)?.focus()
          }}><item.icon size={17} />{item.name}</button>)}
        </div>
        <div className="lp-workspace-panel" role="tabpanel" id="workspace-panel" aria-labelledby={`workspace-tab-${workspace}`}>
          <button className="lp-image-button" ref={zoomTrigger} onClick={() => setZoom(true)} aria-label={`Enlarge ${current.name} screenshot`}><img src={asset(current.image)} width={1920} height={1170} loading="lazy" alt={`Polyhedron ${current.name} desktop interface`} /><span>View full size <ChevronRight size={14} /></span></button>
          <div className="lp-workspace-copy"><p className="lp-eyebrow">{current.name.toUpperCase()}</p><h3>{current.title}</h3><p>{current.description}</p><ul>{current.details.map(detail => <li key={detail}><Check size={15} />{detail}</li>)}</ul></div>
        </div>
        <p className="lp-image-note">Actual desktop screenshots. Baldur’s Gate 3 shown as an example; reference tools vary by game.</p>
      </section>
      <section className="lp-section lp-tools-section" id="tools" aria-labelledby="tools-heading"><div className="lp-wrap">
        <div className="lp-section-heading"><div><p className="lp-eyebrow">02 / SMALL TOOLS, BIG DIFFERENCE</p><h2 id="tools-heading">Find the right line.<br /><span>Make every edit count.</span></h2></div><p>Search options, precision tools, and find and replace keep your edits focused. This interactive guide explains the desktop controls — select one to see what it does.</p></div>
        <div className="lp-tool-demo">
          <div className="lp-demo-search" role="group" aria-label="Explore search options"><button className="lp-search-scope" aria-label="Search scope" aria-pressed={tool === 0} onClick={() => setTool(0)}><Search size={15} />Everything</button><span>Search strings…</span><div className="lp-search-options">{tools.slice(1, 3).map((item, index) => <button key={item.name} aria-label={item.name} aria-pressed={tool === index + 1} onClick={() => setTool(index + 1)}><item.icon size={17} /></button>)}</div></div>
          <div className="lp-tool-buttons" role="group" aria-label="Explore Translate tools">{tools.slice(3, 11).map((item, index) => <button key={item.name} aria-label={item.name} aria-pressed={tool === index + 3} onClick={() => setTool(index + 3)}><item.icon size={20} /></button>)}</div>
          <div className="lp-demo-replace"><span>Find</span><ArrowRight size={15} /><span>Replace</span><button aria-label="Find and replace" aria-pressed={tool === 11} onClick={() => setTool(11)}><Replace size={17} />Find and replace</button></div>
        </div>
        <div className="lp-tool-explanation" aria-live="polite"><div className="lp-tool-number">{String(tool + 1).padStart(2, '0')}<span>/ {String(tools.length).padStart(2, '0')}</span></div><SelectedIcon size={25} /><div><h3>{tools[tool].name}</h3><p>{tools[tool].description}</p></div></div>
        <div className="lp-feature-grid">
          <article><FileCode2 /><h3>Keep the structure.</h3><p>XML tags, placeholders and content IDs stay visible while you translate. Find and replace helps with careful, repeatable edits.</p></article>
          <article><ShieldCheck /><h3>Review with confidence.</h3><p>Mark strings for review, track verification and revisit translation history. Progress is more than a single counter.</p></article>
          <article><Sparkles /><h3>Assistance, on your terms.</h3><p>Use configured AI providers, similarity examples and a term glossary to inform your wording. You stay in control of the final translation.</p></article>
        </div>
      </div></section>
      <section className="lp-section lp-wrap" id="download" aria-labelledby="download-heading">
        <div className="lp-section-heading lp-download-heading">
          <div><p className="lp-eyebrow">03 / MAKE IT YOUR WORKSPACE</p><h2 id="download-heading">Ready for your<br /><span>next translation?</span></h2></div>
          <p>Polyhedron is a desktop application built with Electron, React and TypeScript. Translate games with context, precision tools and local SQLite storage for your projects.</p>
        </div>
        <div className="lp-download-grid">
          <a href={release?.windows?.url ?? `${repo}/releases`} className="lp-download-card"><div className="lp-download-top"><span className="lp-platform-icon"><Monitor size={27} /></span><span className="lp-platform-badge">DESKTOP</span></div><h3>Windows</h3><p>x64 · Setup installer</p><span className="lp-download-action">Download for Windows <Download size={17} /></span></a>
          <a href={release?.mac?.url ?? `${repo}/releases`} className="lp-download-card"><div className="lp-download-top"><span className="lp-platform-icon"><Apple size={27} /></span><span className="lp-platform-badge">DESKTOP</span></div><h3>macOS</h3><p>Apple Silicon · DMG</p><span className="lp-download-action">Download for macOS <Download size={17} /></span></a>
          <article className="lp-download-card lp-download-coming"><div className="lp-download-top"><span className="lp-platform-icon"><Terminal size={27} /></span><span className="lp-platform-badge">COMING SOON</span></div><h3>Linux</h3><p>Desktop app · Coming soon</p><span className="lp-download-action">Coming soon <Clock3 size={17} aria-hidden="true" /></span></article>
        </div>
        <div className="lp-download-note lp-release-note">{release && <span className="lp-release">Latest release · {release.version}</span>}<p>Desktop downloads are hosted on GitHub Releases. No release available? <a href={`${repo}/releases`}>Check the release page.</a></p></div>
        <p className="lp-download-note lp-scan-note">
          {windowsReport && <a className="lp-scan-button" href={windowsReport} target="_blank" rel="noopener noreferrer"><ShieldCheck size={16} aria-hidden="true" />Windows · VirusTotal<ArrowRight size={14} aria-hidden="true" /></a>}
          {macReport && <a className="lp-scan-button" href={macReport} target="_blank" rel="noopener noreferrer"><ShieldCheck size={16} aria-hidden="true" />macOS · VirusTotal<ArrowRight size={14} aria-hidden="true" /></a>}
        </p>
      </section>
      <section className="lp-wrap lp-support" id="support" aria-labelledby="support-heading">
        <div className="lp-support-mark" aria-hidden="true"><Heart size={27} /></div>
        <div className="lp-support-copy"><p className="lp-eyebrow">A LITTLE SUPPORT GOES A LONG WAY</p><h2 id="support-heading">Support the project.</h2><p>If Polyhedron helps your translations, you can support my work through Patreon or buy me a coffee on Ko-fi. Entirely optional, always appreciated.</p></div>
        <div className="lp-support-actions"><a className="lp-button lp-primary" href="https://www.patreon.com/cw/Gabrielish" target="_blank" rel="noopener noreferrer"><Heart size={17} />Patreon<ArrowRight size={16} /></a><a className="lp-button lp-secondary" href="https://ko-fi.com/gabrielish" target="_blank" rel="noopener noreferrer"><Coffee size={17} />Buy me a coffee<ArrowRight size={16} /></a></div>
      </section>
      <section className="lp-wrap lp-support lp-feedback" id="feedback" aria-labelledby="feedback-heading">
        <div className="lp-support-mark" aria-hidden="true"><Lightbulb size={27} /></div>
        <div className="lp-support-copy">
          <p className="lp-eyebrow">BUILT WITH YOUR FEEDBACK</p>
          <h2 id="feedback-heading">Help shape what’s next.</h2>
          <p>Have an idea to improve Polyhedron? Share a feature request, suggest a better workflow, or tell me what could work better. Your feedback helps guide the next improvements.</p>
          <small className="lp-feedback-note">Opens GitHub · A GitHub account is required. Submitted feedback is public.</small>
        </div>
        <div className="lp-support-actions">
          <a className="lp-button lp-primary" href={ideaUrl} target="_blank" rel="noopener noreferrer"><MessageSquare size={17} />Share an idea<ArrowRight size={16} /></a>
          <a className="lp-button lp-secondary" href={`${repo}/issues/new`} target="_blank" rel="noopener noreferrer"><Github size={17} />Report an issue<ArrowRight size={16} /></a>
        </div>
      </section>
      <section className="lp-wrap lp-faq" aria-label="Questions">
        <h2>A few things to know.</h2>
        <p className="lp-faq-intro">A practical guide to getting started, choosing a platform and keeping your work safe.</p>
        <details><summary>What happens when I click Connect?</summary><p>Connect asks you to sign in with Google and opens the browser companion. You can then download a workspace you previously uploaded to Google Drive from Polyhedron. If you prefer not to use Drive, you can open the companion and import an exported workspace file instead. Simply visiting this website does not give it access to your Drive.</p></details>
        <details><summary>What can I do in the browser, and when do I need desktop?</summary><p>The browser companion includes Translate, Dialogue Nodes and Game Data, so you can continue editing a workspace away from the desktop app. Use desktop for the full set of tools, including mod extraction and packaging, project exports and Spells. You can transfer work using Google Drive or an exported workspace file.</p></details>
        <details><summary>Why are some reference tools different between games?</summary><p>The reference tools use data for the game selected in your project. Dialogue context, game entries and ability references depend on the available game data; choosing another game does not guarantee the same reference views. The screenshots here show Baldur’s Gate 3, including BG3 Wiki and Dialogue Explorer references.</p></details>
        <div id="extra-questions" hidden={!moreQuestions}>
          {extraQuestions.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}
        </div>
        <button className="lp-faq-toggle" type="button" aria-expanded={moreQuestions} aria-controls="extra-questions" onClick={() => setMoreQuestions(value => !value)}>
          {moreQuestions ? 'Show less' : 'Show more'}<ArrowDown size={16} aria-hidden="true" />
        </button>
      </section>
    </main>
    <footer className="lp-footer lp-wrap"><div><a href="#top" className="lp-brand"><Dragon /><span>Polyhedron</span></a><p>A little more context. A better choice of words.</p></div><div><a href={`${import.meta.env.BASE_URL}privacy/`}>Privacy Policy</a><a href={`${import.meta.env.BASE_URL}terms/`}>Terms of Service</a><a href={repo} target="_blank" rel="noopener noreferrer">GitHub <Github size={15} /></a><a href="#feedback">Feedback <ArrowRight size={15} /></a></div><p className="lp-credits">An independent project by Gabrielish. Game names, artwork and reference content belong to their respective owners. Reference views shown: <a href="https://bg3.wiki/">bg3.wiki</a> and <a href="https://bg3.game-script.com/">BG3 Dialogue Explorer</a>.</p></footer>
    {zoom && <div className="lp-lightbox" role="dialog" aria-modal="true" aria-label={`${current.name} screenshot`} onClick={event => { if (event.target === event.currentTarget) closeZoom() }}><button ref={zoomClose} onClick={closeZoom} onKeyDown={event => { if (event.key === 'Tab') event.preventDefault() }} aria-label="Close screenshot"><X size={24} /></button><img src={asset(current.image)} alt={`Full-size Polyhedron ${current.name} screenshot`} /></div>}
  </div>
}
