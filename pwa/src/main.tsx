import { lazy, StrictMode, Suspense, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { LandingPage } from './LandingPage'
import './styles.css'

const Companion = lazy(() => import('./App').then(module => ({ default: module.App })))
function Site(): React.JSX.Element {
  const [companion, setCompanion] = useState(window.location.hash === '#app')
  useEffect(() => {
    const update = () => setCompanion(window.location.hash === '#app')
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])
  useEffect(() => {
    if (companion) { document.title = 'Polyhedron Companion'; window.scrollTo(0, 0) }
  }, [companion])
  return companion ? <Suspense fallback={<p className="app-shell">Opening your workspace…</p>}><Companion /></Suspense> : <LandingPage />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Site />
  </StrictMode>
)
