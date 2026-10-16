/**
 * Pine Hollow's compendium: the hunter's journal (board B4 = A: a leather book, one species per page, pencil-sketch
 * plates, a red TAKEN stamp, SEEN / TAKEN / BEST / RARITY, tabs BEASTS / ELITES / PLACES / TROPHIES) and the trophy wall
 * in the ranger's cabin (board B4 wall = C: mounts for what you have taken, chalk outlines for what is left).
 *
 * The animals match the species registry's real variants (src/engine/entities/species/{deer,boar,elk,bear}.ts). The elites are
 * variants (the Ghost stag, Old Ironhide, Old Blackpaw, the Imperial bull) and stay so: the elite system (PH-C3,
 * src/shards/pine-hollow/combat/elites.ts) places the same kind + variant at a lair, so these `match`es are the elites. The Antler King
 * answers to kind 'antler-king', which the boss (PH-C2, src/shards/pine-hollow/combat/antlerKing.ts) registers and spawns.
 * The places are the 18 Explore POIs of layout v2 (src/shards/pine-hollow/data/layout.ts).
 *
 * Sketches: art/pine-hollow/round-6-journal-sketches/ (codex image_gen), shipped as public/assets/pine-hollow/journal/
 * <id>.webp (+ <id>-sil.webp, the silhouette an unknown page shows; chalk.webp, the wall's outline atlas).
 */
import { PINE_HOLLOW_POIS } from './data/layout';
import { JOURNAL_ANIMALS, JOURNAL_PLACE_NOTES } from './data/journal';
import { PINE_HOLLOW_TROPHIES, RANGER_WALL } from './data/trophyWall';
import type { CompendiumSkin, EntryDef, EntryStats, ShardCompendium } from '@wildshard/game/compendium/types';

export const PINE_HOLLOW_ID = 'chunk://local/pine-hollow';
export const JOURNAL_ART = '/assets/pine-hollow/journal';
const sketch = (id: string): string => `${JOURNAL_ART}/${id}.webp`;

const PLACES: EntryDef[] = PINE_HOLLOW_POIS.map((p): EntryDef => ({
  id: p.id, kind: 'place', tab: 'places', name: p.name, notes: JOURNAL_PLACE_NOTES[p.id] ?? '', place: { x: p.x, z: p.z, r: p.r },
  plate: { sketch: sketch(`place-${p.id}`) },
}));


const RARITY_WORD: Record<string, string> = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', legendary: 'Legendary' };

export const JOURNAL_SKIN: CompendiumSkin = {
  className: 'journal',
  title: 'Hunter\'s Journal',
  tabs: [{ id: 'beasts', label: 'Beasts' }, { id: 'elites', label: 'Elites' }, { id: 'places', label: 'Places' }, { id: 'trophies', label: 'Trophies' }],
  trophyTab: 'trophies',
  stamp: (e) => (e.kind === 'place' ? 'Visited' : 'Taken'),
  // the FINDS stickers: each beast its own glyph, the elites and the King theirs (the game draws a pin / dot otherwise)
  icon: (e) => {
    const kind = e.match?.kind ?? '';
    if (e.kind === 'boss') return 'antlers';
    if (e.kind === 'elite' && kind === 'deer') return 'ghost';
    if (e.kind === 'elite' && kind === 'boar') return 'ironhide';
    return kind === 'deer' || kind === 'boar' || kind === 'elk' || kind === 'bear' ? kind : undefined;
  },
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


/** registered by src/game/compendium/install.ts */
export const PINE_HOLLOW_COMPENDIUM: ShardCompendium = { chunkId: PINE_HOLLOW_ID, skin: JOURNAL_SKIN, entries: [...JOURNAL_ANIMALS, ...PLACES], trophies: PINE_HOLLOW_TROPHIES, wall: RANGER_WALL };
