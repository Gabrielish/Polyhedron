export type SpeakerGender = 'male' | 'female'

export interface SpeakerMetadata {
  name: string
  gender: SpeakerGender
}

// These are the named speakers used by BG3's dialogue files. We only return a
// badge when a dialogue identifier points to one unambiguous named speaker.
const SPEAKERS: Array<[RegExp, SpeakerMetadata]> = [
  [/shadowheart/i, { name: 'Shadowheart', gender: 'female' }],
  [/shadow.?heart/i, { name: 'Shadowheart', gender: 'female' }],
  [/lae.?zel/i, { name: "Lae'zel", gender: 'female' }],
  [/karlach/i, { name: 'Karlach', gender: 'female' }],
  [/minthara/i, { name: 'Minthara', gender: 'female' }],
  [/jaheira/i, { name: 'Jaheira', gender: 'female' }],
  [/isobel/i, { name: 'Isobel', gender: 'female' }],
  [/alfira/i, { name: 'Alfira', gender: 'female' }],
  [/arabella/i, { name: 'Arabella', gender: 'female' }],
  [/aylin/i, { name: 'Aylin', gender: 'female' }],
  [/auntie.?ethel/i, { name: 'Auntie Ethel', gender: 'female' }],
  [/bex/i, { name: 'Bex', gender: 'female' }],
  [/florrick/i, { name: 'Florrick', gender: 'female' }],
  [/kagha/i, { name: 'Kagha', gender: 'female' }],
  [/lakrissa/i, { name: 'Lakrissa', gender: 'female' }],
  [/mayrina/i, { name: 'Mayrina', gender: 'female' }],
  [/nine.?fingers/i, { name: 'Nine-Fingers', gender: 'female' }],
  [/sazza/i, { name: 'Sazza', gender: 'female' }],
  [/thulla/i, { name: 'Thulla', gender: 'female' }],
  [/valeria/i, { name: 'Valeria', gender: 'female' }],
  [/z.?rell/i, { name: "Z'rell", gender: 'female' }],
  [/barcus/i, { name: 'Barcus', gender: 'male' }],
  [/bernard/i, { name: 'Bernard', gender: 'male' }],
  [/blurg/i, { name: 'Blurg', gender: 'male' }],
  [/cazador/i, { name: 'Cazador', gender: 'male' }],
  [/dammon/i, { name: 'Dammon', gender: 'male' }],
  [/elminster/i, { name: 'Elminster', gender: 'male' }],
  [/nere/i, { name: 'Nere', gender: 'male' }],
  [/omeluum/i, { name: 'Omeluum', gender: 'male' }],
  [/rolan/i, { name: 'Rolan', gender: 'male' }],
  [/rugan/i, { name: 'Rugan', gender: 'male' }],
  [/volo/i, { name: 'Volo', gender: 'male' }],
  [/wulbren/i, { name: 'Wulbren', gender: 'male' }],
  [/zevlor/i, { name: 'Zevlor', gender: 'male' }],
  [/mizora/i, { name: 'Mizora', gender: 'female' }],
  [/viconia/i, { name: 'Viconia', gender: 'female' }],
  [/orin/i, { name: 'Orin', gender: 'female' }],
  [/astarion/i, { name: 'Astarion', gender: 'male' }],
  [/gale/i, { name: 'Gale', gender: 'male' }],
  [/wyll/i, { name: 'Wyll', gender: 'male' }],
  [/halsin/i, { name: 'Halsin', gender: 'male' }],
  [/minsc/i, { name: 'Minsc', gender: 'male' }],
  [/raphael/i, { name: 'Raphael', gender: 'male' }],
  [/gortash/i, { name: 'Gortash', gender: 'male' }],
  [/ketheric/i, { name: 'Ketheric', gender: 'male' }],
  [/withers/i, { name: 'Withers', gender: 'male' }],
  [/volo/i, { name: 'Volo', gender: 'male' }]
]

export function getKnownSpeakers(): SpeakerMetadata[] {
  return [...new Map(SPEAKERS.map(([, speaker]) => [speaker.name, speaker])).values()]
}

export function getSpeakerForDialogue(dialogue: string): SpeakerMetadata | null {
  const matches = SPEAKERS.filter(([pattern]) => {
    // A name embedded in e.g. `ProtectedAstarion` identifies the subject of a
    // reaction, not necessarily the speaker. Only accept delimited dialogue
    // identifier tokens (`ORI_Astarion_...`, `Astarion_InParty`, etc.).
    const token = new RegExp(`(?:^|[_-])${pattern.source}(?=$|[_-])`, 'i')
    return token.test(dialogue)
  }).map(([, speaker]) => speaker)
  const unique = [...new Map(matches.map((speaker) => [speaker.name, speaker])).values()]
  return unique.length === 1 ? unique[0] : null
}
