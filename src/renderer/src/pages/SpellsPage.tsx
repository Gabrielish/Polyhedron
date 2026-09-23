import { ArrowRight, ExternalLink, Search, Sparkles, WandSparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import spellsData from '@/data/spells.json'
import { useTranslationSession } from '@/context/TranslationSession'
import { getReferenceCatalog } from '@/data/gameReference'

type Spell = (typeof spellsData)[number]
const levelLabel = (level: Spell['level']): string => {
  if (level === 0) return 'Cantrips'
  if (level === 'npc') return 'Special NPC Spells'
  if (level === 'item') return 'Special Item Spells'
  return `Level ${level} spells`
}

const normalize = (value: string): string => value
  .replace(/<[^>]*>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLocaleLowerCase()

export function SpellsPage(): React.JSX.Element {
  const navigate = useNavigate()
  const session = useTranslationSession()
  const [query, setQuery] = useState('')
  const [level, setLevel] = useState<'all' | string>('all')

  const matchingEntries = useMemo(() => {
    const bySource = new Map<string, typeof session.entries>()
    for (const entry of session.entries) {
      const key = normalize(entry.source)
      if (!key) continue
      const current = bySource.get(key) ?? []
      current.push(entry)
      bySource.set(key, current)
    }
    return bySource
  }, [session.entries])

  const referenceByName = useMemo(() => new Map(getReferenceCatalog('Spell').map((entry) => [normalize(entry.name), entry])), [])

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    return spellsData.filter((spell) => {
      if (level !== 'all' && String(spell.level) !== level) return false
      const description = referenceByName.get(normalize(spell.name))?.description ?? spell.description
      return !needle || spell.name.toLocaleLowerCase().includes(needle) || description.toLocaleLowerCase().includes(needle)
    })
  }, [level, query, referenceByName])

  const grouped = useMemo(() => {
    const groups = new Map<string, Spell[]>()
    for (const spell of filtered) {
      const key = String(spell.level)
      const list = groups.get(key) ?? []
      list.push(spell)
      groups.set(key, list)
    }
    return [...groups.entries()]
  }, [filtered])

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0c0d0f] text-neutral-200">
      <header className="app-page-header flex shrink-0 flex-wrap items-center gap-3 border-b border-[#1f2329] bg-[#0f1114] px-6 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300"><WandSparkles size={19} /></div>
        <div>
          <h1 className="text-base font-semibold text-neutral-100">Spells</h1>
          <p className="text-xs text-neutral-500">Game Data spell reference · {spellsData.length} unique entries · view only</p>
        </div>
        <a href="https://bg3.wiki/wiki/List_of_all_spells" target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-[#2a2f37] px-2.5 py-1.5 text-xs text-neutral-400 hover:border-amber-500/40 hover:text-amber-200"><ExternalLink size={13} /> BG3 Wiki</a>
      </header>
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[#1f2329] bg-[#0c0d0f] px-5 py-3">
        <label className="relative min-w-56 flex-1 sm:max-w-sm"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search spells..." className="h-8 w-full rounded-md border border-[#2a2f37] bg-[#131518] pl-8 pr-3 text-xs text-neutral-200 outline-none focus:border-amber-500/60" /></label>
        <select value={level} onChange={(event) => setLevel(event.target.value)} className="h-8 rounded-md border border-[#2a2f37] bg-[#131518] px-2.5 text-xs text-neutral-300 outline-none focus:border-amber-500/60">
          <option value="all">All levels</option><option value="0">Cantrips</option><option value="1">Level 1</option><option value="2">Level 2</option><option value="3">Level 3</option><option value="4">Level 4</option><option value="5">Level 5</option><option value="6">Level 6</option><option value="9">Level 9</option><option value="npc">Special NPC</option><option value="item">Special item</option>
        </select>
        <span className="text-[11px] text-neutral-600">{filtered.length} shown</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto max-w-6xl space-y-7">
          {grouped.map(([group, spells]) => (
            <section key={group}>
              <div className="mb-3 flex items-center gap-3"><h2 className="text-sm font-semibold text-amber-200">{levelLabel(spells[0].level)}</h2><span className="rounded-full border border-amber-500/20 bg-amber-500/8 px-2 py-0.5 font-mono text-[10px] text-amber-300">{spells.length}</span><div className="h-px flex-1 bg-[#1f2329]" /></div>
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {spells.map((spell) => {
                  const reference = referenceByName.get(normalize(spell.name))
                  const description = reference?.description ?? spell.description
                  const nameMatches = matchingEntries.get(normalize(spell.name)) ?? []
                  const descriptionMatches = matchingEntries.get(normalize(description)) ?? []
                  const translatedName = nameMatches.find((entry) => entry.target.trim())?.target ?? ''
                  const translatedDescription = descriptionMatches.find((entry) => entry.target.trim())?.target ?? ''
                  const isTranslated = translatedName.trim() !== '' && translatedDescription.trim() !== ''
                  const matches = nameMatches.length
                  return (
                    <article key={spell.id} className={`group relative rounded-xl border p-3 transition-colors ${isTranslated ? 'border-emerald-500/55 bg-emerald-500/5 hover:border-emerald-400/70' : 'border-[#252a31] bg-[#131518] hover:border-amber-500/35'}`}>
                      <div className="flex gap-3">
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-amber-500/25 bg-[#0c0d0f]">
                          {spell.icon ? <img src={spell.icon} alt="" loading="lazy" className="h-full w-full object-cover" /> : <Sparkles className="m-4 text-amber-300" size={24} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="group/spell relative">
                              <h3 className="cursor-help text-sm font-semibold text-neutral-100 underline decoration-dotted decoration-neutral-600 underline-offset-4">{spell.name}</h3>
                              <div className="pointer-events-none invisible absolute bottom-full left-0 z-20 mb-2 w-80 rounded-lg border border-amber-500/35 bg-[#171a1f] p-3 opacity-0 shadow-2xl transition-opacity group-hover/spell:visible group-hover/spell:opacity-100">
                                <div className="mb-1 text-xs font-semibold text-emerald-300">{translatedName || 'Romanian name not translated yet'}</div>
                                <div className="text-[11px] leading-4 text-neutral-300">{description || 'No English description available.'}</div>
                                {translatedDescription && <div className="mt-2 border-t border-[#2a2f37] pt-2 text-[11px] leading-4 text-emerald-200">{translatedDescription}</div>}
                                {spell.variants.length > 0 && <div className="mt-2 border-t border-[#2a2f37] pt-2 text-[10px] text-amber-200">Variants: {spell.variants.join(', ')}</div>}
                              </div>
                            </div>
                            <span className="shrink-0 rounded border border-[#2a2f37] px-1.5 py-0.5 text-[10px] text-neutral-500">{matches ? `${matches} match${matches === 1 ? '' : 'es'}` : 'not linked'}</span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs leading-4 text-neutral-400">{description || 'No English description available.'}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#1f2329] pt-2"><span className={`text-[10px] ${isTranslated ? 'text-emerald-300' : 'text-neutral-600'}`}>{isTranslated ? 'Name + description translated' : 'Translation incomplete'}</span><button type="button" onClick={() => navigate(`/game-data?spell=${encodeURIComponent(spell.name)}`)} className="inline-flex items-center gap-1 rounded-md border border-[#2a2f37] px-2 py-1 text-[10px] text-neutral-400 hover:border-amber-500/45 hover:text-amber-200">Open in Game Data <ArrowRight size={11} /></button></div>
                    </article>
                  )
                })}
              </div>
            </section>
          ))}
          {filtered.length === 0 && <div className="py-20 text-center text-sm text-neutral-500">No spells match this search.</div>}
          <p className="pb-4 text-center text-[10px] text-neutral-600">Spell list and icon artwork sourced from <a className="text-amber-400 hover:underline" href="https://bg3.wiki/wiki/List_of_all_spells" target="_blank" rel="noreferrer">bg3.wiki</a>.</p>
        </div>
      </div>
    </div>
  )
}
