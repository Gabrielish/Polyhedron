import { Maximize2, Minimize2, Minus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAppTranslation } from '@/i18n/useAppTranslation'

type AppRegionStyle = React.CSSProperties & { WebkitAppRegion?: string }

const DRAG: AppRegionStyle = { WebkitAppRegion: 'drag' }
const NO_DRAG: AppRegionStyle = { WebkitAppRegion: 'no-drag' }

export function TitleBar(): React.JSX.Element {
  const [isMaximized, setIsMaximized] = useState(false)
  const [appVersion, setAppVersion] = useState('')
  const isMacOS = navigator.platform.toLowerCase().includes('mac')
  const { t } = useAppTranslation('common')

  useEffect(() => {
    window.api.app.getVersion().then(setAppVersion).catch(() => undefined)
    window.api.window.isMaximized().then(setIsMaximized)
    return window.api.window.onMaximizeChange(setIsMaximized)
  }, [])

  return (
    <div
      style={NO_DRAG}
      onDoubleClick={() => window.api.window.maximize()}
      className="flex h-9 w-full shrink-0 items-center border-b border-[#1f2329] bg-[#0f1114] select-none"
    >
      <div style={DRAG} className="flex-1" />

      <div style={DRAG} className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
        <div
          className="flex h-6 w-6 shrink-0 items-center justify-center"
        >
          <svg aria-hidden="true" className="titlebar-dragon h-[22px] w-[25px] shrink-0" viewBox="0 0 12.21 10.26" xmlns="http://www.w3.org/2000/svg">
            <path fill="currentColor" d="M12.19,6.21c-.09.23-.43.6-.76.68.05-.37-.27-.58-.5-.64.15-.71-.15-1.58-1.2-2.55-.89-.84-2.56-2-2.49-3.48-.26.31-.44,1.24-.2,1.79.73.83,2.26,1.71,2.66,3.09-.68-1.61-3.97-2.88-3.83-5.1-.41.42-.66,1.97-.33,2.8.63.36,1.17.98,1.26,1.53-.41-.89-1.72-1.28-2.68-1.96-.41-.3-.76-.64-.96-1.1-.19.55-.08,1.24.24,1.7,0,0-.61-.23-1.84-.18.34.14,1.23.88,1.11,1.31h.01c-.12.44-1.84.94-2.68,1.75,1.24-.24,1.87-.04,2.07.46.14.35-.03.85-.14,1.43.3-.32,1.12-.89,1.95-1.26.33-.14.65-.26.95-.31-.2-.06-.65-.15-.94-.17-.07-.02-.13-.02-.18-.02.06-.07.12-.13.19-.18.83-.73,2.32-.95,3.17-.74-.6-.03-1.78.27-2.25.64.38.06.76.15,1.12.27-.56.21-1.27.84-1.51,1.52.74-.49,2.2-.36,2.43.65.1.45-.08.87-.28,1.13-.1.14-.22.24-.31.27.2.04.73-.02.93-.11-.07.28-.53.75-.8.83.71,0,1.71-.4,2.07-1.01.03-.05.06-.1.08-.15,0,0-.46.15-.67-.06-.19-.18.04-.91.08-1.05-.07.07-.32.33-.52.14-.25-.24.09-1.04.23-1.23-.24-.1-.92-.17-1.21-.14.84-.3,2.73-.45,2.93-.1.16.29-.24.86-.24.86.33-.02,1.29-.01,1.63.38.34.41.14.93.14.93.76-.34,1.43-1.51,1.27-2.62ZM8.4,4.89c.85.3,1.1,1.08,1.1,1.08-.71,0-.94-.52-1.1-1.08Z" />
          </svg>
        </div>
        <span className="text-[15px] font-bold tracking-[0.06em] text-neutral-300" style={{ fontFamily: 'Breathe Fire III, sans-serif' }}>
          Polyhedron
        </span>
        <span className="text-[9px] font-normal tracking-normal text-neutral-600">
          {appVersion ? `v${appVersion}` : 'v—'}
        </span>
      </div>

      <div style={NO_DRAG} className="relative z-[100] flex h-full items-center pointer-events-auto">
        {!isMacOS && <>
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
        </>}
      </div>
    </div>
  )
}
