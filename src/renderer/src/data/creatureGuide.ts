export interface CreatureGuideEntry {
  id: string
  name: string
  wikiUrl: string
  imageUrl?: string
  description?: string
  translation?: string
  parent?: string
  group?: string
}

export interface CreatureGuideType extends CreatureGuideEntry {
  children: CreatureGuideEntry[]
}

const wikiImage = (path: string, size = 150) =>
  `https://bg3.wiki/w/images/thumb/${path}/${size}px-${path.split('/').pop()}.webp`

const creatureImages: Record<string, string> = {
  Alioramus: 'https://bg3.wiki/w/images/thumb/6/61/Chult_Alioramus_Model.png/640px-Chult_Alioramus_Model.png.webp',
  Badger: 'https://bg3.wiki/w/images/thumb/e/e5/Badger_Model.png/800px-Badger_Model.png.webp',
  Bat: 'https://bg3.wiki/w/images/thumb/a/ad/Bat.png/800px-Bat.png.webp',
  Bird: 'https://bg3.wiki/w/images/thumb/e/e2/Topaz_%28Blue_Jay%29.jpg/800px-Topaz_%28Blue_Jay%29.jpg.webp',
  Boar: 'https://bg3.wiki/w/images/thumb/0/06/Verres_Model.png/800px-Verres_Model.png.webp',
  Crab: 'https://bg3.wiki/w/images/thumb/6/63/Crab.png/800px-Crab.png.webp',
  'Displacer Beast': 'https://bg3.wiki/w/images/thumb/a/aa/Displacer_Beast_Model.png/800px-Displacer_Beast_Model.png.webp',
  Frog: 'https://bg3.wiki/w/images/thumb/5/51/Addled_Frog.png/800px-Addled_Frog.png.webp',
  'Giant Eagle': 'https://bg3.wiki/w/images/thumb/b/b6/Giant_Eagle.png/640px-Giant_Eagle.png.webp',
  Rat: 'https://bg3.wiki/w/images/thumb/d/df/Skittle.png/1200px-Skittle.png.webp',
  Raven: 'https://bg3.wiki/w/images/thumb/a/ad/Corvus_Model.png/800px-Corvus_Model.png.webp',
  Spider: 'https://bg3.wiki/w/images/thumb/2/23/Larger_Giant_Spider.PNG/1200px-Larger_Giant_Spider.PNG.webp',
  Wolf: 'https://bg3.wiki/w/images/thumb/c/cc/D%27hak_Model.png/800px-D%27hak_Model.png.webp',
  Hyena: 'https://bg3.wiki/wiki/Special:FilePath/Hyena_Model.png',
  Bear: 'https://bg3.wiki/wiki/Special:FilePath/Bear_Model.png',
  'Animated Armour': 'https://bg3.wiki/wiki/Special:FilePath/Animated_Armour_Model.png',
  'Earth Elemental': 'https://bg3.wiki/wiki/Special:FilePath/Earth_Elemental_Art.png',
  'Mud Elemental': 'https://bg3.wiki/wiki/Special:FilePath/Mud_Elemental_Model.png',
  'Lava Elemental': 'https://bg3.wiki/wiki/Special:FilePath/Lava_Elemental_Model.png',
  Owlbear: 'https://bg3.wiki/w/images/thumb/6/60/Owlbear_Mum.webp/1200px-Owlbear_Mum.webp',
  'Deep Rothé': 'https://bg3.wiki/w/images/thumb/a/ad/Deep_Rothe.png/640px-Deep_Rothe.png.webp',
  Dilophosaurus: 'https://bg3.wiki/w/images/thumb/9/9c/Dilophosaurus_Model.png/1200px-Dilophosaurus_Model.png.webp',
  Deva: 'https://bg3.wiki/w/images/thumb/c/c9/Deva_Model.png/800px-Deva_Model.png.webp',
  'The Emperor': 'https://bg3.wiki/w/images/thumb/9/96/The_Emperor.png/800px-The_Emperor.png.webp',
  Succubus: 'https://bg3.wiki/w/images/thumb/e/e8/Haarlep_Tight_%28Female%29.png/640px-Haarlep_Tight_%28Female%29.png.webp',
  Incubus: 'https://bg3.wiki/w/images/thumb/8/89/Portrait_Haarlep.png/150px-Portrait_Haarlep.png.webp',
  Hollyphant: 'https://bg3.wiki/w/images/thumb/7/76/Valeria_Model.png/800px-Valeria_Model.png.webp',
  'Steel Watcher': 'https://bg3.wiki/w/images/thumb/7/7a/Disable_the_Steel_Watch_Quest.jpg/1200px-Disable_the_Steel_Watch_Quest.jpg.webp',
  'Red Dragon': 'https://bg3.wiki/w/images/thumb/8/8b/Red_Dragon_Model.png/800px-Red_Dragon_Model.png.webp',
  Ansur: 'https://bg3.wiki/w/images/thumb/b/b5/Ansur.png/640px-Ansur.png.webp',
  'Air Elemental': 'https://bg3.wiki/w/images/thumb/7/70/Air_Elemental_Art.png/800px-Air_Elemental_Art.png.webp',
  'Fire Elemental': 'https://bg3.wiki/w/images/thumb/1/12/Fire_Elemental_Art.png/800px-Fire_Elemental_Art.png.webp',
  'Water Elemental': 'https://bg3.wiki/w/images/thumb/b/b4/Water_Elemental_Art.png/640px-Water_Elemental_Art.png.webp',
  Mephit: 'https://bg3.wiki/w/images/thumb/9/98/Magma_Mephit_Model.png/800px-Magma_Mephit_Model.png.webp',
  Dryad: 'https://bg3.wiki/w/images/thumb/6/62/Ellie-porfyridou-dryx-04.jpg/1200px-Ellie-porfyridou-dryx-04.jpg.webp',
  'Auntie Ethel': 'https://bg3.wiki/w/images/thumb/2/23/Auntie_Ethel_Human.png/800px-Auntie_Ethel_Human.png.webp',
  Pixie: 'https://bg3.wiki/w/images/thumb/2/27/Dolly_Thrice_Bell_Quest.jpg/1200px-Dolly_Thrice_Bell_Quest.jpg.webp',
  'He Who Was': 'https://bg3.wiki/w/images/thumb/2/28/He_Who_Was.webp/800px-He_Who_Was.webp',
  Orthon: 'https://bg3.wiki/w/images/thumb/1/14/Yurgir.png/800px-Yurgir.png.webp',
  Yurgir: 'https://bg3.wiki/w/images/thumb/1/14/Yurgir.png/800px-Yurgir.png.webp',
  'Lump the Enlightened': 'https://bg3.wiki/w/images/thumb/a/a1/Lump_the_Enlightened.jpg/800px-Lump_the_Enlightened.jpg.webp',
  Githyanki: 'https://bg3.wiki/w/images/thumb/5/5d/Githyanki_Default_Portrait.png/800px-Githyanki_Default_Portrait.png.webp',
  Drow: 'https://bg3.wiki/w/images/thumb/f/ff/Lolthfemale.jpg/640px-Lolthfemale.jpg.webp',
  Duergar: 'https://bg3.wiki/w/images/thumb/6/61/Goldfemale.jpg/640px-Goldfemale.jpg.webp',
  Goblin: 'https://bg3.wiki/w/images/thumb/4/4e/Goblin-face.png/1200px-Goblin-face.png.webp',
  'Half-Orc': 'https://bg3.wiki/w/images/thumb/0/0c/Half-Orc_Male.webp/640px-Half-Orc_Male.webp',
  Human: 'https://bg3.wiki/w/images/thumb/9/99/Human_Default_Portrait.png/800px-Human_Default_Portrait.png.webp',
  Tiefling: 'https://bg3.wiki/w/images/thumb/7/70/Asmodeus_Tiefling_Default_Portrait.png/800px-Asmodeus_Tiefling_Default_Portrait.png.webp',
  Zhentarim: 'https://bg3.wiki/w/images/thumb/9/98/Zhentarim.webp/1200px-Zhentarim.webp',
  Bulette: 'https://bg3.wiki/w/images/thumb/e/e6/Bulette.jpg/800px-Bulette.jpg.webp',
  Harpy: 'https://bg3.wiki/w/images/thumb/3/3e/Harpy-thumbnail.jpg/640px-Harpy-thumbnail.jpg.webp',
  'Phase Spider': 'https://bg3.wiki/w/images/thumb/1/17/Phase_Spider.jpg/800px-Phase_Spider.jpg.webp',
  Worg: 'https://bg3.wiki/w/images/thumb/8/83/Worg_Model.png/800px-Worg_Model.png.webp',
  'Ochre Jelly': 'https://bg3.wiki/w/images/thumb/0/0f/Ochre_Jelly_Model.png/800px-Ochre_Jelly_Model.png.webp',
  Myconid: 'https://bg3.wiki/w/images/thumb/5/58/Myconids_Cheering_Quest.jpg/1200px-Myconids_Cheering_Quest.jpg.webp',
  Ghoul: 'https://bg3.wiki/w/images/thumb/1/1f/Ghoul_Model.png/640px-Ghoul_Model.png.webp',
  Vampire: 'https://bg3.wiki/w/images/thumb/e/ec/Cazador_Smile.png/800px-Cazador_Smile.png.webp'
}

const category = (
  id: string,
  name: string,
  children: Array<[string, string, string?]>,
  imageUrl?: string,
  wikiName = name
): CreatureGuideType => ({
  id,
  name,
  wikiUrl: `https://bg3.wiki/wiki/${wikiName.replace(/ /g, '_')}`,
  imageUrl,
  children: children.map(([entryId, entryName, group]) => ({
    id: entryId,
    name: entryName,
    wikiUrl:
      entryName === 'Succubus' || entryName === 'Incubus'
        ? 'https://bg3.wiki/wiki/Succubus_%26_Incubus'
        : `https://bg3.wiki/wiki/${entryName.replace(/ /g, '_')}`,
    imageUrl: creatureImages[entryName],
    parent: id,
    group
  }))
})

export const creatureGuideTypes: CreatureGuideType[] = [
  {
    id: 'aberration',
    name: 'Aberration',
    wikiUrl: 'https://bg3.wiki/wiki/Aberration',
    imageUrl: wikiImage('2/20/Spectator_Model.png', 300),
    description: 'Warped, alien beings that have come to Faerûn from beyond the multiverse.',
    children: [
      {
        id: 'spectator',
        name: 'Spectator',
        wikiUrl: 'https://bg3.wiki/wiki/Spectator',
        imageUrl: wikiImage('c/c7/Portrait_Spectator.png'),
        description: 'Aggressive and greedy aberrations related to beholders.',
        parent: 'aberration'
      },
      {
        id: 'cloaker',
        name: 'Cloaker',
        wikiUrl: 'https://bg3.wiki/wiki/Cloaker',
        imageUrl: wikiImage('1/14/Portrait_Cloaker.png'),
        description: 'Dark, leathery creatures that lurk in caves and hunt isolated prey.',
        parent: 'aberration'
      },
      {
        id: 'phasm',
        name: 'Phasm',
        wikiUrl: 'https://bg3.wiki/wiki/Phasm',
        imageUrl: wikiImage('b/b1/Portrait_Phasm.png'),
        description: 'Amorphous shapechangers that can take the shape of almost any creature.',
        parent: 'aberration'
      },
      {
        id: 'phantasm',
        name: 'Phantasm',
        wikiUrl: 'https://bg3.wiki/wiki/Phantasm',
        parent: 'aberration'
      },
      {
        id: 'mind-flayer',
        name: 'Mind Flayer',
        wikiUrl: 'https://bg3.wiki/wiki/Mind_Flayer',
        imageUrl: wikiImage('3/30/Portrait_Mind_Flayer.png'),
        description: 'Psionic tyrants and interdimensional voyagers that feed on brains.',
        parent: 'aberration'
      },
      {
        id: 'illithid-arcanist',
        name: 'Illithid Arcanist',
        wikiUrl: 'https://bg3.wiki/wiki/Illithid_Arcanist',
        imageUrl: wikiImage('a/ac/Portrait_Illithid_Arcanist.png', 100),
        parent: 'aberration'
      },
      {
        id: 'omeluum',
        name: 'Omeluum',
        wikiUrl: 'https://bg3.wiki/wiki/Omeluum',
        imageUrl: wikiImage('7/7b/Portrait_Omeluum.png', 100),
        parent: 'aberration'
      },
      {
        id: 'the-emperor',
        name: 'The Emperor',
        wikiUrl: 'https://bg3.wiki/wiki/The_Emperor',
        imageUrl: wikiImage('2/2f/Edward-vanderghote-emperor.webp', 100),
        parent: 'aberration'
      },
      {
        id: 'intellect-devourer',
        name: 'Intellect Devourer',
        wikiUrl: 'https://bg3.wiki/wiki/Intellect_Devourer',
        imageUrl: wikiImage('7/7f/Portrait_Intellect_Devourer.png', 100),
        parent: 'aberration',
        group: 'Other'
      },
      {
        id: 'netherbrain',
        name: 'Netherbrain',
        wikiUrl: 'https://bg3.wiki/wiki/Netherbrain',
        imageUrl: wikiImage('b/b2/Portrait_The_Netherbrain.png', 100),
        parent: 'aberration',
        group: 'Other'
      },
      ...[
        ['countermeasure', 'Countermeasure'],
        ['flaming-fist-marcus', 'Flaming Fist Marcus'],
        ['intellect-glutton', 'Intellect Glutton'],
        ['mind-flayer-tadpole', 'Mind Flayer Tadpole'],
        ['spectral-flumph', 'Spectral Flumph'],
        ['tentacle', 'Tentacle'],
        ['us', 'Us'],
        ['rage-queller', 'Rage Queller', 'Countermeasure variants'],
        ['snapping-of-strings', 'The Snapping of Strings', 'Countermeasure variants'],
        ['blasphemous-acolyte', 'Blasphemous Acolyte', 'Countermeasure variants'],
        ['unnatural-blot', 'Unnatural Blot', 'Countermeasure variants'],
        ['breaker-of-war', 'Breaker of War', 'Countermeasure variants'],
        ['way-of-the-profane-ki', 'Way of the Profane Ki', 'Countermeasure variants'],
        ['oathless-wretch', 'Oathless Wretch', 'Countermeasure variants'],
        ['darkening-hunt', 'The Darkening Hunt', 'Countermeasure variants'],
        ['assassins-folly', "Assassin's Folly", 'Countermeasure variants'],
        ['metamage-persecutor', 'Metamage Persecutor', 'Countermeasure variants'],
        ['pactsplitter', 'Pactsplitter', 'Countermeasure variants'],
        ['spellplague', 'Spellplague', 'Countermeasure variants']
      ].map(([id, name, group]) => ({
        id,
        name,
        wikiUrl: `https://bg3.wiki/wiki/${name.replace(/ /g, '_')}`,
        parent: 'aberration',
        group: group ?? 'Other'
      }))
    ]
  },
  category('beast', 'Beast', [
    ['alioramus', 'Alioramus'], ['badger', 'Badger'], ['bat', 'Bat'], ['bird', 'Bird'],
    ['boar', 'Boar'], ['crab', 'Crab'], ['displacer-beast', 'Displacer Beast'],
    ['frog', 'Frog'], ['giant-eagle', 'Giant Eagle'], ['hyena', 'Hyena'], ['rat', 'Rat'],
    ['raven', 'Raven'], ['spider', 'Spider'], ['wolf', 'Wolf'], ['owlbear', 'Owlbear'],
    ['deep-rothe', 'Deep Rothé'], ['dilophosaurus', 'Dilophosaurus'], ['bear', 'Bear'],
    ['cat', 'Cat'], ['dog', 'Dog'], ['ox', 'Ox'], ['rabbit', 'Rabbit'], ['sheep', 'Sheep'],
    ['squirrel', 'Squirrel'], ['dire-wolf', 'Dire Wolf'], ['dire-raven', 'Dire Raven'],
    ['rat-bat', 'Rat Bat', 'Other']
  ], 'https://bg3.wiki/w/images/thumb/c/cc/D%27hak_Model.png/800px-D%27hak_Model.png.webp'),
  category('celestial', 'Celestial', [
    ['deva', 'Deva'], ['solar', 'Solar'], ['hollyphant', 'Hollyphant'], ['pegasus', 'Pegasus']
  ], 'https://bg3.wiki/w/images/thumb/c/c9/Deva_Model.png/800px-Deva_Model.png.webp'),
  category('construct', 'Construct', [
    ['adamantine-golem', 'Adamantine Golem'], ['animated-armour', 'Animated Armour'],
    ['arcane-turret', 'Arcane Turret'], ['automaton', 'Automaton'], ['flesh-golem', 'Flesh Golem'],
    ['steel-watcher', 'Steel Watcher'], ['scrying-eye', 'Scrying Eye'], ['hellfire-engine', 'Hellfire Engine'],
    ['clay-golem', 'Clay Golem'], ['gargoyle', 'Gargoyle'],
    ['arcane-cannon', 'Arcane Cannon', 'Other'], ['guardian-of-faith', 'Guardian of Faith', 'Other'],
    ['manifestation-of-tyranny', 'Manifestation of Tyranny', 'Other']
  ], 'https://bg3.wiki/w/images/thumb/7/7a/Disable_the_Steel_Watch_Quest.jpg/1200px-Disable_the_Steel_Watch_Quest.jpg.webp'),
  category('dragon', 'Dragon', [
    ['red-dragon', 'Red Dragon'], ['bronze-dragon', 'Bronze Dragon'], ['ansur', 'Ansur'],
    ['undead-dragon', 'Undead Dragon'], ['the-dragon', 'The Dragon'], ['copper-dragon', 'Copper Dragon'],
    ['dragon-other', 'Moonlight Sliver', 'Other']
  ], 'https://bg3.wiki/w/images/thumb/8/8b/Red_Dragon_Model.png/800px-Red_Dragon_Model.png.webp'),
  category('elemental', 'Elemental', [
    ['azer', 'Azer'], ['air-elemental', 'Air Elemental'], ['earth-elemental', 'Earth Elemental'],
    ['fire-elemental', 'Fire Elemental'], ['water-elemental', 'Water Elemental'], ['mephit', 'Mephit'],
    ['grease-mephit', 'Grease Mephit'], ['ice-mephit', 'Ice Mephit'], ['magma-mephit', 'Magma Mephit'],
    ['mud-mephit', 'Mud Mephit'], ['mud-elemental', 'Mud Elemental'], ['lava-elemental', 'Lava Elemental'],
    ['air-myrmidon', 'Air Myrmidon'], ['earth-myrmidon', 'Earth Myrmidon'],
    ['fire-myrmidon', 'Fire Myrmidon'], ['water-myrmidon', 'Water Myrmidon'], ['djinni', 'Djinni'],
    ['flaming-sphere', 'Flaming Sphere'], ['hell-sphere', 'Hell Sphere'],
    ['elemental-other', 'Grease Elemental', 'Other']
  ], 'https://bg3.wiki/w/images/thumb/7/70/Air_Elemental_Art.png/800px-Air_Elemental_Art.png.webp'),
  category('fey', 'Fey', [
    ['blink-dog', 'Blink Dog'], ['dryad', 'Dryad'], ['ethel', 'Auntie Ethel'], ['hag', 'Hag'],
    ['korred', 'Korred'], ['meenlock', 'Meenlock'], ['pixie', 'Pixie'], ['redcap', 'Redcap'],
    ['he-who-was', 'He Who Was'], ['bitey-buddy', 'Bitey Buddy', 'Other'], ['booaal', 'BOOOAL', 'Other']
  ], 'https://bg3.wiki/w/images/thumb/8/8e/Dolly_Thrice_Model.png/800px-Dolly_Thrice_Model.png.webp'),
  category('fiend', 'Fiend', [
    ['cambion', 'Cambion'], ['devil', 'Devil'], ['imp', 'Imp'], ['lemure', 'Lemure'],
    ['mephistopheles', 'Mephistopheles'], ['orthon', 'Orthon'], ['rakshasa', 'Rakshasa'],
    ['yugir', 'Yurgir'], ['gnoll-flind', 'Gnoll Flind'], ['hellsboar', 'Hellsboar'],
    ['merregon', 'Merregon'], ['succubus', 'Succubus'], ['incubus', 'Incubus'], ['quasit', 'Quasit'],
    ['fiend-other', 'Raphael', 'Other']
  ], 'https://bg3.wiki/w/images/thumb/1/14/Yurgir.png/800px-Yurgir.png.webp'),
  category('giant', 'Giant', [
    ['ettin', 'Ettin'], ['giant', 'Giant'], ['hill-giant', 'Hill Giant'],
    ['cloud-giant', 'Cloud Giant'], ['ogre', 'Ogre'], ['lump', 'Lump the Enlightened'],
    ['giant-other', 'Giant Skeleton', 'Other']
  ], 'https://bg3.wiki/w/images/thumb/2/2c/Lump_Model.png/800px-Lump_Model.png.webp', 'Giant_(creature_type)'),
  category('humanoid', 'Humanoid', [
    ['githyanki', 'Githyanki'], ['drow', 'Drow'], ['duergar', 'Duergar'], ['goblin', 'Goblin'],
    ['bugbear', 'Bugbear'], ['gnoll', 'Gnoll'], ['hobgoblin', 'Hobgoblin'], ['kobold', 'Kobold'],
    ['kuo-toa', 'Kuo-toa'], ['meazel', 'Meazel'], ['shadar-kai', 'Shadar-kai'], ['werewolf', 'Werewolf'],
    ['half-orc', 'Half-Orc'], ['human', 'Human'], ['tiefling', 'Tiefling'], ['zhentarim', 'Zhentarim'],
    ['aasimar', 'Aasimar', 'Other'], ['changeling', 'Changeling', 'Other'], ['sahuagin', 'Sahuagin', 'Other']
  ], 'https://bg3.wiki/w/images/thumb/5/5d/Githyanki_Default_Portrait.png/800px-Githyanki_Default_Portrait.png.webp'),
  category('monstrosity', 'Monstrosity', [
    ['bulette', 'Bulette'], ['chuul', 'Chuul'], ['doppelganger', 'Doppelganger'], ['drider', 'Drider'],
    ['ettercap', 'Ettercap'], ['gremishka', 'Gremishka'], ['harpy', 'Harpy'], ['hook-horror', 'Hook Horror'],
    ['minotaur', 'Minotaur'], ['owlbear', 'Owlbear'], ['phase-spider', 'Phase Spider'],
    ['shadow-mastiff', 'Shadow Mastiff'], ['tressym', 'Tressym'], ['worg', 'Worg'], ['yuan-ti', 'Yuan-ti'],
    ['mimic', 'Mimic', 'Other'], ['slayer', 'Slayer', 'Other']
  ], 'https://bg3.wiki/w/images/thumb/e/e6/Bulette.jpg/800px-Bulette.jpg.webp'),
  category('ooze', 'Ooze', [
    ['fetid-ooze', 'Fetid Ooze'], ['greaseball', 'Greaseball'], ['gelatinous-cube', 'Gelatinous Cube'],
    ['ochre-jelly', 'Ochre Jelly'], ['slime', 'Slime'], ['black-pudding', 'Black Pudding'], ['zlorb', 'Zlorb'],
    ['ooze-other', 'Strange Ox', 'Other']
  ], 'https://bg3.wiki/w/images/thumb/0/0f/Ochre_Jelly_Model.png/800px-Ochre_Jelly_Model.png.webp'),
  category('plant', 'Plant', [
    ['blight', 'Blight'], ['myconid', 'Myconid'], ['needle-blight', 'Needle Blight'],
    ['vine-blight', 'Vine Blight'], ['shadow-cursed-needle-blight', 'Shadow-Cursed Needle Blight'],
    ['shadow-cursed-vine-blight', 'Shadow-Cursed Vine Blight'], ['wood-woad', 'Wood Woad'],
    ['shambling-mound', 'Shambling Mound'], ['shadow-cursed-shambling-mound', 'Shadow-Cursed Shambling Mound'],
    ['giant-shadow-creeper', 'Giant Shadow Creeper'], ['grasping-vine', 'Grasping Vine'], ['shadow-creeper', 'Shadow Creeper'],
    ['plant-other', 'Sovereign Spaw', 'Other'], ['glut', 'Sovereign Glut', 'Other']
  ], 'https://bg3.wiki/w/images/thumb/5/58/Myconids_Cheering_Quest.jpg/1200px-Myconids_Cheering_Quest.jpg.webp'),
  category('undead', 'Undead', [
    ['conjured-spectre', 'Conjured Spectre'], ['crawling-claw', 'Crawling Claw'],
    ['dark-justiciar', 'Dark Justiciar'], ['death-knight', 'Death Knight'], ['flying-ghoul', 'Flying Ghoul'],
    ['ghast', 'Ghast'], ['ghost', 'Ghost'], ['ghoul', 'Ghoul'], ['grim-visage', 'Grim Visage'],
    ['mummy', 'Mummy'], ['mummy-lord', 'Mummy Lord'], ['shadow', 'Shadow'], ['skeleton', 'Skeleton'],
    ['undead-dragon', 'Undead Dragon'], ['vampire', 'Vampire'], ['vampire-spawn', 'Vampire Spawn'],
    ['wight', 'Wight'], ['wraith', 'Wraith'], ['zombie', 'Zombie'], ['carrion-crawler', 'Carrion Crawler'],
    ['undead-other', 'Tormented Soul', 'Other'], ['vengeful-soul', 'Vengeful Soul', 'Other'],
    ['tribunal-ghost', 'Tribunal Ghost', 'Other']
  ], 'https://bg3.wiki/w/images/thumb/7/7b/Luna-wullaert-zom-02.jpg/1200px-Luna-wullaert-zom-02.jpg.webp')
]
