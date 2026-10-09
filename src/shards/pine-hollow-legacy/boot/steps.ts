/** Loading nouns and unchanged shared weights for Pine's authored world. */
export const PINE_STEPS = {
  sky: { label: 'Sky · dawn to moonlight', weight: 1 },
  terrain: { label: 'Terrain · boreal ground', weight: 2 },
  cards: { label: 'Tree species · pine · fir · birch', weight: 1 },
  forest: { label: 'Forest · pines · old-growth giants', weight: 2 },
  edge: { label: 'Pond · creek · waterfall · far country', weight: 1 },
  grass: { label: 'Grass · ferns · bilberry', weight: 2 },
  cabins: { label: 'Cabins · hamlet · lookout · crags · cave', weight: 2 },
  props: { label: 'Rocks · logs', weight: 1 },
  animals: { label: 'Herds · deer · boar · elk · bears', weight: 1 },
  weapon: { label: 'Crossbow · lever-action · longbow', weight: 1 },
  audio: { label: 'Audio · score · forest sound', weight: 3 },
} as const;

export const PINE_BYTES = {
  sky: 'sky keys · dawn to moonlight',
  trees: 'tree species · bark · needles',
  cabins: 'cabin timber · stone · props',
  props: 'landmarks · crags · creatures',
  music: 'score · day · night · the King · dawn',
  sfx: 'forest beds · rain · calls · barks',
} as const;
