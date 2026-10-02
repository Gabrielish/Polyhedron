export type GameProfileId = 'bg3' | 'dos1' | 'dos2'

export interface GameProfile {
  id: GameProfileId
  name: string
  description: string
  extensions: string[]
}

export const GAME_PROFILES: GameProfile[] = [
  {
    id: 'bg3',
    name: "Baldur's Gate 3",
    description: 'BG3 localization XML, PAK, and ZIP files.',
    extensions: ['xml', 'pak', 'zip']
  },
  {
    id: 'dos1',
    name: 'Divinity: Original Sin',
    description: 'Divinity localization XML files.',
    extensions: ['xml']
  },
  {
    id: 'dos2',
    name: 'Divinity: Original Sin 2',
    description: 'Divinity localization XML files.',
    extensions: ['xml']
  }
]

export const DEFAULT_GAME_PROFILE: GameProfileId = 'bg3'

export function getGameProfile(id: GameProfileId): GameProfile {
  return GAME_PROFILES.find((profile) => profile.id === id) ?? GAME_PROFILES[0]
}
