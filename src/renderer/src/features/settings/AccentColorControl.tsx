import { Plus } from 'lucide-react'
import { Fragment, useEffect, useState } from 'react'
import { useTheme } from '@/context/ThemeContext'

export function AccentColorControl(): React.JSX.Element {
  const { accent, setAccent, accentFavorites, setAccentFavorites } = useTheme()
  const [draft, setDraft] = useState(accent)
  const [selected, setSelected] = useState<number | null>(null)
  const matchingDefault = accentFavorites.slice(0, 3).findIndex(color => color?.toUpperCase() === accent.toUpperCase())
  const highlighted = selected !== null && selected >= 3 && accentFavorites[selected]?.toUpperCase() === accent.toUpperCase()
    ? selected
    : matchingDefault >= 0 ? matchingDefault : null

  useEffect(() => { setDraft(accent) }, [accent])

  const changeColor = (value: string) => {
    const next = value.toUpperCase()
    setDraft(next)
    if (!/^#[0-9A-F]{6}$/.test(next)) return
    setAccent(next)
    if (selected !== null && selected >= 3) {
      setAccentFavorites(accentFavorites.map((color, index) => index === selected ? next : color))
    } else {
      setSelected(null)
    }
  }

  return (
    <>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="relative w-36 shrink-0">
        <input
          id="accent-color" type="text" value={draft} maxLength={7} placeholder="#8C52FF"
          onChange={event => changeColor(event.target.value)}
          className="settings-accent-input h-10 w-full min-w-0 rounded-md border border-neutral-800 bg-[#0f1114] pl-3 pr-12 font-mono text-sm text-neutral-200 placeholder-neutral-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 focus:outline-none"
        />
        <input
          aria-label="Pick accent color" type="color"
          value={/^#[0-9A-F]{6}$/.test(draft) ? draft : accent}
          onChange={event => changeColor(event.target.value)}
          className="absolute right-2 top-1 h-8 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
        />
        </div>
      <div className="flex shrink-0 items-center gap-3 py-1" role="group" aria-label="Favorite accent colors">
        {accentFavorites.map((color, index) => (
          <Fragment key={index}>
          {index === 3 && <span aria-hidden="true" className="mx-1 h-6 border-l border-neutral-700/70" />}
          <button
            type="button" aria-pressed={highlighted === index}
            aria-label={color ? `Favorite color ${index + 1}: ${color}` : `Save current color to favorite ${index + 1}`}
            onContextMenu={(event) => {
              event.preventDefault()
              if (index < 3) return
              setAccentFavorites(accentFavorites.map((item, slot) => slot === index ? null : item))
              if (selected === index) setSelected(null)
            }}
            onClick={() => {
              setSelected(index)
              if (color) { setDraft(color); setAccent(color) }
              else setAccentFavorites(accentFavorites.map((item, slot) => slot === index ? accent : item))
            }}
            style={{ borderRadius: '50%', ...(color ? { backgroundColor: color } : {}) }}
            className={`flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-[transform,border-color] hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-400 ${
              highlighted === index ? 'border-white ring-2 ring-neutral-200 ring-offset-4 ring-offset-[#101010]' :
                color ? 'border-white/20' : 'border-dashed border-neutral-600 text-neutral-500 hover:border-neutral-300'
            }`}
          >{!color && <Plus size={14} />}</button>
          </Fragment>
        ))}
      </div>
      </div>
      {draft && !/^#[0-9A-F]{6}$/.test(draft) && (
        <p className="mt-2 text-xs text-red-300">Enter a six-digit HEX value, for example #ED1C24.</p>
      )}
    </>
  )
}
