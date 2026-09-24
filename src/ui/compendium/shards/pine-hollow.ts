/**
 * Pine Hollow's compendium: the hunter's journal (board B4 = A: a leather book, one species per page, pencil-sketch
 * plates, a red TAKEN stamp, SEEN / TAKEN / BEST / RARITY, tabs BEASTS / ELITES / PLACES / TROPHIES) and the trophy wall
 * in the ranger's cabin (board B4 wall = C: mounts for what you have taken, chalk outlines for what is left).
 *
 * The animals match the species registry's real variants (src/entities/species/{deer,boar,elk,bear}.ts). The elites are
 * variants today (the Ghost stag, Old Ironhide, Old Blackpaw, the Imperial bull), so they can already be taken; when
 * the elite system (PH-C3) lands their `match` moves to the elite's own kind. The Antler King answers to kind
 * 'antler-king', which nothing spawns yet: its page stays "???" until the boss (PH-C2) registers that kind.
 * The places are the 18 Explore POIs of layout v2 (src/chunks/pineHollowLayout.ts).
 *
 * Sketches: art/pine-hollow/round-6-journal-sketches/ (codex image_gen), shipped as public/assets/pine-hollow/journal/
 * <id>.webp (+ <id>-sil.webp, the silhouette an unknown page shows; chalk.webp, the wall's outline atlas).
 */
import { PINE_HOLLOW_POIS } from '../../../chunks/pineHollowLayout';
import type { CompendiumSkin, EntryDef, EntryStats, ShardCompendium, TrophySlot } from '../types';

export const PINE_HOLLOW_ID = 'chunk://local/pine-hollow';
export const JOURNAL_ART = '/assets/pine-hollow/journal';
const sketch = (id: string): string => `${JOURNAL_ART}/${id}.webp`;

type Beast = Omit<EntryDef, 'tab' | 'plate'> & { model?: { id: string; variant?: string } };
const beast = (b: Beast, tab: 'beasts' | 'elites'): EntryDef => {
  const { model, ...rest } = b;
  return { ...rest, tab, plate: { sketch: sketch(b.id), ...(model ? { model } : {}) } };
};

const BEASTS: EntryDef[] = ([
  { id: 'red-deer', kind: 'species', name: 'Red Deer', subtitle: 'Cervus elaphus', rarity: 'common', massKg: 110, match: { kind: 'deer', variants: ['hind', 'stag', 'big-stag'] }, model: { id: 'deer', variant: 'stag' },
    hint: 'Hinds graze the Hollow at dawn.', notes: 'Grazes the Hollow in small herds. Heads up, freezes, then bolts: take the shot in the freeze. The great stags carry a rack like a hat stand.' },
  { id: 'white-deer', kind: 'variant', name: 'White Deer', subtitle: 'Leucistic red deer', rarity: 'uncommon', massKg: 110, match: { kind: 'deer', variants: ['white-hind', 'white-stag'] }, model: { id: 'deer', variant: 'white-stag' },
    hint: 'Something pale moves among the hinds.', notes: 'Not an albino: the eyes are dark. Stands out in the pines like a lamp, and knows it. Rarely runs alone.' },
  { id: 'piebald', kind: 'variant', name: 'Piebald Hind', subtitle: 'Red deer, pied', rarity: 'rare', massKg: 105, match: { kind: 'deer', variants: ['piebald'] }, model: { id: 'deer', variant: 'piebald' },
    hint: 'A patched coat, glimpsed once.', notes: 'White patches over the red, no two alike. The old hunters called her luck. The old hunters said a lot of things.' },
  { id: 'boar', kind: 'species', name: 'Wild Boar', subtitle: 'Sus scrofa', rarity: 'common', massKg: 80, match: { kind: 'boar', variants: ['boar', 'sow', 'big'] }, model: { id: 'boar', variant: 'boar' },
    hint: 'Rooted-up ground all over the Hollow.', notes: 'Roots, grunts, charges. Does not freeze like a deer: it comes at you. Step aside and put one behind the shoulder.' },
  { id: 'black-boar', kind: 'variant', name: 'Black Boar', subtitle: 'Sus scrofa, melanistic', rarity: 'uncommon', massKg: 90, match: { kind: 'boar', variants: ['black'] }, model: { id: 'boar', variant: 'black' },
    hint: 'A dark shape in the undergrowth.', notes: 'Coal-black and long in the tusk. Hard to see at dusk, easy to hear.' },
  { id: 'scarback', kind: 'variant', name: 'Scarback', subtitle: 'An old boar', rarity: 'rare', massKg: 85, match: { kind: 'boar', variants: ['scarback'] }, model: { id: 'boar', variant: 'scarback' },
    hint: 'Bolts in the bark, none in the boar.', notes: 'Every scar on his back is somebody\'s story. Takes a lot of hitting and holds a grudge.' },
  { id: 'elk', kind: 'species', name: 'Elk', subtitle: 'Cervus canadensis', rarity: 'common', massKg: 250, match: { kind: 'elk', variants: ['cow', 'bull', 'big-bull'] }, model: { id: 'elk', variant: 'bull' },
    hint: 'A bugle from the old-growth at dusk.', notes: 'Moves as a herd: spook one, lose them all. Thick hide: body shots do less. The bulls bugle at dusk.' },
  { id: 'pale-elk', kind: 'variant', name: 'Pale Elk', subtitle: 'Cervus canadensis, pale', rarity: 'rare', massKg: 250, match: { kind: 'elk', variants: ['pale'] }, model: { id: 'elk', variant: 'pale' },
    hint: 'A cream-coloured cow in the herd.', notes: 'Cream from nose to tail. The herd keeps her in the middle.' },
  { id: 'black-bear', kind: 'species', name: 'Black Bear', subtitle: 'Ursus americanus', rarity: 'common', massKg: 60, match: { kind: 'bear', variants: ['black', 'black-blaze'] }, model: { id: 'bear', variant: 'black' },
    hint: 'Claw marks on the pines near the Den.', notes: 'Lives in the Den. Curious, then cross. Do not run: it is faster than you and it enjoys it.' },
  { id: 'brown-bear', kind: 'species', name: 'Brown Bear', subtitle: 'Ursus arctos', rarity: 'uncommon', massKg: 60, match: { kind: 'bear', variants: ['brown'] }, model: { id: 'bear', variant: 'brown' },
    hint: 'Tracks too big for a black bear.', notes: 'The shoulder hump is all muscle. Stands up to look at you, which is the polite part.' },
  { id: 'grizzled-sow', kind: 'variant', name: 'Grizzled Sow', subtitle: 'An old brown bear', rarity: 'rare', massKg: 60, match: { kind: 'bear', variants: ['brown-old'] }, model: { id: 'bear', variant: 'brown-old' },
    hint: 'Silver hair snagged on the Den\'s rocks.', notes: 'Silver-tipped and the size of a woodshed. Has outlived three rangers. Aim for a fourth.' },
] satisfies Beast[]).map((b) => beast(b, 'beasts'));

const ELITES: EntryDef[] = ([
  { id: 'ironhide', kind: 'elite', name: 'Old Ironhide', subtitle: 'Terror of the Hollow', rarity: 'legendary', massKg: 80, match: { kind: 'boar', variants: ['ironhide'] }, model: { id: 'boar', variant: 'ironhide' },
    hint: 'Snapped saplings, one tusk-mark deeper than the rest.', notes: 'A boar the size of a cart, a hide like a stove. Bolts bounce. He charges, and he does not stop charging.' },
  { id: 'ghost-stag', kind: 'elite', name: 'The Ghost Stag', subtitle: 'The pale one', rarity: 'legendary', massKg: 110, match: { kind: 'deer', variants: ['ghost'] }, model: { id: 'deer', variant: 'ghost' },
    hint: 'Hoofprints that end in the middle of the path.', notes: 'White as frost, there and gone. It fades, and it comes back behind you. Some say it leads somewhere.' },
  { id: 'blackpaw', kind: 'elite', name: 'Old Blackpaw', subtitle: 'The Den\'s landlord', rarity: 'legendary', massKg: 60, match: { kind: 'bear', variants: ['black-old'] }, model: { id: 'bear', variant: 'black-old' },
    hint: 'One pawprint, bigger than the other three.', notes: 'Grey at the muzzle, one paw like a shovel. Roars you still, then comes out of the cave mouth.' },
  { id: 'imperial-bull', kind: 'elite', name: 'The Imperial Bull', subtitle: 'Seven by seven', rarity: 'legendary', massKg: 250, match: { kind: 'elk', variants: ['imperial'] }, model: { id: 'elk', variant: 'imperial' },
    hint: 'A bugle that shakes the needles off the pines.', notes: 'The biggest rack in the shard. At dusk his bugle calls rival bulls in, so you are never fighting just him.' },
  { id: 'antler-king', kind: 'boss', name: 'The Antler King', subtitle: 'The Bark Warden', rarity: 'legendary', match: { kind: 'antler-king' },
    hint: 'Antlers of light walk the old-growth at night.', notes: 'Bark for a hide, a skull for a face, lanterns in its antlers. The Hollow\'s lanterns went dark the night it woke.' },
] satisfies Beast[]).map((b) => beast(b, 'elites'));

/** a line per place — the journal's own words; the POI table (layout v2) owns the names and positions */
const PLACE_NOTES: Record<string, string> = {
  gate: 'Where the road from the valley comes in. Everyone\'s first page.',
  crossroads: 'Every path in the shard meets here. The signpost is mostly honest.',
  'cabin-1': 'The ranger\'s home, and the trophy wall. There is room on it.',
  'cabin-2': 'West of the crossroads, whatever the old maps say.',
  'cabin-3': 'At the ridge\'s foot on the way to the Den. Bear country from here on.',
  zipline: 'Where the line from the fire lookout comes down. Knees bent.',
  lookout: 'The whole Hollow from up here. The zipline is the fast way down.',
  pond: 'Still water under the ridge. There is an islet out there.',
  waterfall: 'The creek\'s head, spilling off the ridge into the pond.',
  islet: 'You can\'t walk here. Somebody left a canoe.',
  dam: 'Beavers hold the pond back. Take the dam out and see what drains.',
  bridge: 'The east road crosses the creek here.',
  den: 'A bowl of rock in the north-west corner. The bears\' part of town.',
  cave: 'Old Blackpaw\'s front door. Knock loudly. Or don\'t.',
  clearing: 'A ring of standing stones in the old-growth. The trees keep their distance.',
  hamlet: 'The mill, the lodge, the trader. The only neighbours for miles.',
  lodge: 'The hunting lodge: the contract board is by the door.',
  mill: 'The wheel turns on the creek. The miller has an errand, he always does.',
};

const PLACES: EntryDef[] = PINE_HOLLOW_POIS.map((p): EntryDef => ({
  id: p.id, kind: 'place', tab: 'places', name: p.name, notes: PLACE_NOTES[p.id] ?? '', place: { x: p.x, z: p.z, r: p.r },
  plate: { sketch: sketch(`place-${p.id}`) },
}));

/** the wall, top row first (the antlered heads need the width), then the bottom row */
export const PINE_HOLLOW_TROPHIES: TrophySlot[] = [
  { entry: 'ghost-stag', outline: 'stag', mount: { kind: 'deer', variant: 'ghost' }, title: 'Ghostbuster' },
  { entry: 'antler-king', outline: 'king', title: 'Regicide, Technically' },
  { entry: 'imperial-bull', outline: 'elk', mount: { kind: 'elk', variant: 'imperial' }, title: 'His Royal Lowness' },
  { entry: 'ironhide', outline: 'boar', mount: { kind: 'boar', variant: 'ironhide' }, title: 'Ironhide\'s Retirement Plan' },
  { entry: 'scarback', outline: 'boar', mount: { kind: 'boar', variant: 'scarback' }, title: 'Scar Tissue Collector' },
  { entry: 'grizzled-sow', outline: 'bear', mount: { kind: 'bear', variant: 'brown-old' }, title: 'Grin and Bear It' },
  { entry: 'blackpaw', outline: 'bear', mount: { kind: 'bear', variant: 'black-old' }, title: 'Paws for Thought' },
];

const RARITY_WORD: Record<string, string> = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', legendary: 'Legendary' };

export const JOURNAL_SKIN: CompendiumSkin = {
  className: 'journal',
  title: 'Hunter\'s Journal',
  tabs: [{ id: 'beasts', label: 'Beasts' }, { id: 'elites', label: 'Elites' }, { id: 'places', label: 'Places' }, { id: 'trophies', label: 'Trophies' }],
  trophyTab: 'trophies',
  stamp: (e) => (e.kind === 'place' ? 'Visited' : 'Taken'),
  stats: (e: EntryDef, s: EntryStats) => {
    const known = s.state !== 'unknown';
    if (e.kind === 'place') {
      return [
        { label: 'Visits', value: String(s.seen) },
        { label: 'Status', value: s.state === 'seen' ? 'Visited' : known ? 'Heard of' : '???' },
      ];
    }
    return [
      { label: 'Seen', value: String(s.seen) },
      { label: 'Taken', value: String(s.taken) },
      { label: 'Best', value: s.best > 0 ? `${s.best} kg` : '—' },
      { label: 'Rarity', value: known && e.rarity ? (RARITY_WORD[e.rarity] ?? e.rarity) : '???' },
    ];
  },
  chalk: {
    atlas: `${JOURNAL_ART}/chalk.webp`,
    // five square cells in one row (scripts: the atlas is packed 5 × 512 px wide, 512 px tall)
    cells: {
      stag: { x: 0, y: 0, w: 0.2, h: 1 }, elk: { x: 0.2, y: 0, w: 0.2, h: 1 }, boar: { x: 0.4, y: 0, w: 0.2, h: 1 },
      bear: { x: 0.6, y: 0, w: 0.2, h: 1 }, king: { x: 0.8, y: 0, w: 0.2, h: 1 },
    },
  },
};

/**
 * The ranger's cabin (cabin 1: W 5 × L 7, chimney at −Z, door on +X). The wall is the back wall's inner face (x = −W/2 +
 * 2·LOG_R, the log crests) between the hearth corner and the window at z = +0.6: z ∈ [−3.2, −0.2]. Turned +90° so the
 * wall's +z is the cabin's +X (into the room) and its +x the viewer's right (−Z). FLOOR = 0.22 (Cabin.ts).
 */
const RANGER_WALL = { cabin: 0, at: [-2.27, 0.22, -1.7] as [number, number, number], yaw: Math.PI / 2, width: 3.0, rows: [3, 4], rowY: [1.98, 1.12] };

/** registered by src/ui/compendium/install.ts */
export const PINE_HOLLOW_COMPENDIUM: ShardCompendium = { chunkId: PINE_HOLLOW_ID, skin: JOURNAL_SKIN, entries: [...BEASTS, ...ELITES, ...PLACES], trophies: PINE_HOLLOW_TROPHIES, wall: RANGER_WALL };
