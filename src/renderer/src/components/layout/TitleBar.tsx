import { Maximize2, Minimize2, Minus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import { CloudSyncMenu } from './CloudSyncMenu'

function PolyhedronLogo() {
  return (
    <svg
      viewBox="0 0 13 12"
      width="21"
      height="21"
      fill="none"
      stroke="none"
    >
      <path fill="#ED1C24" d="M3.921 2.217C4.859 1.297 6.122.742 7.988.838c2.944.152 4.358 2.096 4.358 4.193 0 1.011-.536 2.363-1.276 3.323-.045-.044-.083-.087-.13-.131a21.28 21.28 0 00-.49-.436c-.484-.421-1.03-.905-1.397-1.426.807-1.413.346-3.414-1.359-3.414-.998 0-1.83.88-1.759 2.047-.26.552-.387 1.352-.337 2.062-.489-.295-.901-.618-1.095-1.067l-.626-1.445-.493 1.492a2.515 2.515 0 00-.088 1.135l-.01-.001a3.27 3.27 0 01-.555-1.57c-.18-1.908.764-2.964 1.19-3.383z" />
    </svg>
  )
}

type AppRegionStyle = React.CSSProperties & { WebkitAppRegion?: string }

const DRAG: AppRegionStyle = { WebkitAppRegion: 'drag' }
const NO_DRAG: AppRegionStyle = { WebkitAppRegion: 'no-drag' }

export function TitleBar(): React.JSX.Element {
  const [isMaximized, setIsMaximized] = useState(false)
  const { t } = useAppTranslation('common')

  useEffect(() => {
    window.api.window.isMaximized().then(setIsMaximized)
    return window.api.window.onMaximizeChange(setIsMaximized)
  }, [])

  return (
    <div
      style={DRAG}
      onDoubleClick={() => window.api.window.maximize()}
      className="flex h-9 w-full shrink-0 items-center border-b border-[#1f2329] bg-[#0f1114] select-none"
    >
      <div className="flex-1" />

      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 pointer-events-none">
        <div
          className="flex h-6 w-6 shrink-0 items-center justify-center"
        >
          <PolyhedronLogo />
        </div>
        <span className="text-[13px] font-bold tracking-[0.06em] text-neutral-300" style={{ fontFamily: 'Breathe Fire III, sans-serif' }}>
          Polyhedron
        </span>
      </div>

      <div style={NO_DRAG} className="flex h-full items-center">
        <CloudSyncMenu />
        <button
          title={t('window.minimize')}
          onClick={() => window.api.window.minimize()}
          className="h-9 w-11 flex items-center justify-center text-neutral-500 hover:bg-white/5 hover:text-neutral-200 transition-colors"
        >
          <Minus size={13} />
        </button>

        <button
          title={t(isMaximized ? 'window.restore' : 'window.maximize')}
          onClick={() => window.api.window.maximize()}
          className="h-9 w-11 flex items-center justify-center text-neutral-500 hover:bg-white/5 hover:text-neutral-200 transition-colors"
        >
          {isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>

        <button
          title={t('window.close')}
          onClick={() => window.api.window.close()}
          className="h-9 w-11 flex items-center justify-center text-neutral-500 hover:bg-red-500 hover:text-white transition-colors"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  )
}
