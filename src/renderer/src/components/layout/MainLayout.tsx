import { Outlet } from 'react-router-dom'
import { useLocation } from 'react-router-dom'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useTranslationSession } from '@/context/TranslationSession'
import { SessionSaveButton } from '@/features/translate/components/SessionSaveButton'
import { CloudSyncMenu } from './CloudSyncMenu'
import { TitleBar } from './TitleBar'
import { Sidebar } from './Sidebar'

export function MainLayout(): React.JSX.Element {
  useKeyboardShortcuts()
  const location = useLocation()
  const session = useTranslationSession()
  const isMacOS = navigator.platform.toLowerCase().includes('mac')

  return (
    <div className="flex h-screen w-screen bg-neutral-950">
      <Sidebar />
      <div className="app-content-shell relative ml-14 flex min-w-0 flex-1 flex-col">
        <TitleBar />
        <div className={`pointer-events-none absolute top-1 z-[200] ${isMacOS ? 'right-2' : 'right-[150px]'}`}>
          <div className="pointer-events-auto">
            <CloudSyncMenu />
          </div>
        </div>
        <main className="relative icosa-scroll flex min-h-0 flex-1 flex-col overflow-y-auto">
          <Outlet />
          {location.pathname === '/game-interface' && session.phase === 'loaded' && (
            <div className="pointer-events-none absolute top-3 right-5 z-30">
              <div className="pointer-events-auto">
                <SessionSaveButton session={session} />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
