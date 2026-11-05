import { useState } from 'react'
import { cn } from '@/lib/utils'

const COPYABLE_CHARACTERS = [
  ...['ă', 'â', 'î', 'ș', 'ț', 'Ă', 'Â', 'Î', 'Ș', 'Ț'].map((character) => ({
    character,
    label: `Copy ${character}`
  })),
  { character: '–', label: 'En Dash' },
  { character: '—', label: 'Em Dash' }
]

interface RomanianDiacriticsProps {
  className?: string
}

export function RomanianDiacritics({ className }: RomanianDiacriticsProps): React.JSX.Element {
  const [copiedCharacter, setCopiedCharacter] = useState<string | null>(null)

  const copyCharacter = (character: string) => {
    void navigator.clipboard?.writeText(character)
    setCopiedCharacter(character)
    window.setTimeout(
      () => setCopiedCharacter((current) => (current === character ? null : current)),
      900
    )
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)} aria-label="Romanian diacritics">
      {COPYABLE_CHARACTERS.map(({ character, label }) => (
        <button
          key={character}
          type="button"
          onClick={() => copyCharacter(character)}
          aria-label={label}
          className={cn(
            'inline-flex h-7 min-w-7 cursor-copy items-center justify-center rounded-md border px-1.5 font-mono text-sm transition-colors',
            copiedCharacter === character
              ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-300'
              : 'border-[#34343e] bg-[#0f1013] text-neutral-200 hover:border-amber-500/60 hover:text-white'
          )}
        >
          <span className={character === '—' ? 'inline-block scale-x-[1.45]' : undefined}>
            {character}
          </span>
        </button>
      ))}
    </div>
  )
}
