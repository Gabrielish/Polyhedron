import { useEffect, useState } from 'react'
import { useTheme, type AppIconStyle } from '@/context/ThemeContext'
import dragonSvg from '@/assets/dungeons-dragons.svg?raw'

const dragonPath = dragonSvg.match(/<path\b[^>]*\bd="([^"]+)"/)?.[1]

export function AppIconStyleControl(): React.JSX.Element {
  const { accent, accentForeground, appIconStyle, setAppIconStyle } = useTheme()
  const dragonForeground = accentForeground === 'black' ? '#101010' : '#FFFFFF'
  const [dark, setDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const isMac = navigator.platform.toLowerCase().includes('mac')
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (): void => setDark(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])
  return (
    <div className="min-w-0">
      <p className="text-sm font-medium text-neutral-200">App icon</p>
      <p className="mt-1 text-xs text-neutral-500">Accent background or dragon.</p>
      <div className="mt-3 flex min-h-10 items-center gap-3" role="group" aria-label="Dock and taskbar icon style">
        {(['accent-background', 'accent-dragon'] as AppIconStyle[]).map((style) => {
          const inverted = style === 'accent-dragon'
          const label = inverted ? 'Accent dragon · system background (dark on Windows)' : `Accent background · ${accentForeground === 'black' ? 'dark' : 'white'} dragon`
          return (
            <button
              key={style}
              type="button"
              title={label}
              aria-label={label}
              aria-pressed={appIconStyle === style}
              onClick={() => setAppIconStyle(style)}
              style={{ borderRadius: '50%', backgroundColor: inverted ? isMac && !dark ? '#F4F1ED' : '#101010' : accent }}
              className={`flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center border transition-[transform,border-color] hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-400 ${
                appIconStyle === style
                  ? 'border-white ring-2 ring-neutral-200 ring-offset-4 ring-offset-[#101010]'
                  : 'border-neutral-500'
              }`}
            >
              <svg aria-hidden="true" viewBox="0 0 12.21 10.26" className="h-5 w-5">
                <path d={dragonPath} fill={inverted ? accent : dragonForeground} />
              </svg>
            </button>
          )
        })}
      </div>
    </div>
  )
}
