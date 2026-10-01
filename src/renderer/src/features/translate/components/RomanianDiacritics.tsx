import { useState } from 'react'
import { cn } from '@/lib/utils'

const ROMANIAN_DIACRITICS = ['ă', 'â', 'î', 'ș', 'ț', 'Ă', 'Â', 'Î', 'Ș', 'Ț']

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
      {ROMANIAN_DIACRITICS.map((character) => (
        <button
          key={character}
          type="button"
          onClick={() => copyCharacter(character)}
          title={`Copy ${character}`}
          aria-label={`Copy Romanian character ${character}`}
          className={cn(
            'inline-flex h-7 min-w-7 cursor-copy items-center justify-center rounded-md border px-1.5 font-mono text-sm transition-colors',
            copiedCharacter === character
              ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-300'
              : 'border-[#34343e] bg-[#0f1013] text-neutral-200 hover:border-amber-500/60 hover:text-white'
          )}
        >
          {character}
        </button>
      ))}
    </div>
  )
}
