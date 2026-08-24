import { Maximize2, Minimize2, Minus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import { CloudSyncMenu } from './CloudSyncMenu'
import dragonLogo from '@/assets/dungeons-dragons.svg'

type AppRegionStyle = React.CSSProperties & { WebkitAppRegion?: string }

const DRAG: AppRegionStyle = { WebkitAppRegion: 'drag' }
const NO_DRAG: AppRegionStyle = { WebkitAppRegion: 'no-drag' }

export function TitleBar(): React.JSX.Element {
  const [isMaximized, setIsMaximized] = useState(false)
  const [appVersion, setAppVersion] = useState('')
  const { t } = useAppTranslation('common')

  useEffect(() => {
    window.api.app.getVersion().then(setAppVersion).catch(() => undefined)
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
          <img src={dragonLogo} alt="" aria-hidden="true" className="h-[22px] w-[25px] object-contain" />
        </div>
        <span className="text-[13px] font-bold tracking-[0.06em] text-neutral-300" style={{ fontFamily: 'Breathe Fire III, sans-serif' }}>
          Polyhedron
        </span>
        <span className="text-[9px] font-normal tracking-normal text-neutral-600">
          {appVersion ? `v${appVersion}` : 'v—'}
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
