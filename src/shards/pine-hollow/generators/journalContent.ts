import * as LAYOUT from './layout';
import { JOURNAL_ANIMALS, JOURNAL_PLACE_NOTES } from './journalPages';
import { PINE_HOLLOW_TROPHIES, RANGER_WALL } from './trophyWall';

const PLACE_SKETCHES: Readonly<Record<string, string>> = {
  gate: '/assets/pine-hollow/journal/place-gate.webp', crossroads: '/assets/pine-hollow/journal/place-crossroads.webp',
  'cabin-1': '/assets/pine-hollow/journal/place-cabin-1.webp', 'cabin-2': '/assets/pine-hollow/journal/place-cabin-2.webp',
  'cabin-3': '/assets/pine-hollow/journal/place-cabin-3.webp', zipline: '/assets/pine-hollow/journal/place-zipline.webp',
  lookout: '/assets/pine-hollow/journal/place-lookout.webp', pond: '/assets/pine-hollow/journal/place-pond.webp',
  waterfall: '/assets/pine-hollow/journal/place-waterfall.webp', islet: '/assets/pine-hollow/journal/place-islet.webp',
  dam: '/assets/pine-hollow/journal/place-dam.webp', bridge: '/assets/pine-hollow/journal/place-bridge.webp',
  den: '/assets/pine-hollow/journal/place-den.webp', cave: '/assets/pine-hollow/journal/place-cave.webp',
  clearing: '/assets/pine-hollow/journal/place-clearing.webp', hamlet: '/assets/pine-hollow/journal/place-hamlet.webp',
  lodge: '/assets/pine-hollow/journal/place-lodge.webp', mill: '/assets/pine-hollow/journal/place-mill.webp',
};
function placeSketch(id: string): string {
  const url = PLACE_SKETCHES[id];
  if (url === undefined) throw new Error(`Missing authored journal sketch ${id}`);
  return url;
}
/** Author-only assembly. The immutable output holds every entry, match, display rule and wall coordinate. */
export const JOURNAL: { readonly kind: "journal"; readonly id: "pine.journal"; readonly chunkId: "chunk://local/pine-hollow"; readonly className: "journal"; readonly title: "Hunter's Journal"; readonly tabs: readonly [{ readonly id: "beasts"; readonly label: "Beasts"; }, { readonly id: "elites"; readonly label: "Elites"; }, { readonly id: "places"; readonly label: "Places"; }, { readonly id: "trophies"; readonly label: "Trophies"; }]; readonly trophyTab: "trophies"; readonly stamp: { readonly place: "Visited"; readonly default: "Taken"; }; readonly icons: readonly [{ readonly entryKind: "boss"; readonly icon: "antlers"; }, { readonly entryKind: "elite"; readonly matchKind: "deer"; readonly icon: "ghost"; }, { readonly entryKind: "elite"; readonly matchKind: "boar"; readonly icon: "ironhide"; }, ...{ matchKind: "elk" | "deer" | "boar" | "bear"; icon: "elk" | "deer" | "boar" | "bear"; }[]]; readonly stats: { readonly place: readonly [{ readonly label: "Visits"; readonly value: "seen"; }, { readonly label: "Status"; readonly value: "status"; readonly fallback: "Heard of"; readonly words: { readonly unknown: "???"; readonly seen: "Visited"; }; }]; readonly default: readonly [{ readonly label: "Seen"; readonly value: "seen"; }, { readonly label: "Taken"; readonly value: "taken"; }, { readonly label: "Best"; readonly value: "best"; readonly suffix: " kg"; readonly fallback: "—"; }, { readonly label: "Rarity"; readonly value: "rarity"; readonly fallback: "???"; readonly words: { readonly common: "Common"; readonly uncommon: "Uncommon"; readonly rare: "Rare"; readonly legendary: "Legendary"; }; }]; }; readonly chalk: { readonly atlas: `${typeof art}/chalk.webp`; readonly cells: { readonly stag: { readonly x: 0; readonly y: 0; readonly w: 0.2; readonly h: 1; }; readonly elk: { readonly x: 0.2; readonly y: 0; readonly w: 0.2; readonly h: 1; }; readonly boar: { readonly x: 0.4; readonly y: 0; readonly w: 0.2; readonly h: 1; }; readonly bear: { readonly x: 0.6; readonly y: 0; readonly w: 0.2; readonly h: 1; }; readonly king: { readonly x: 0.8; readonly y: 0; readonly w: 0.2; readonly h: 1; }; }; }; readonly entries: readonly [...typeof JOURNAL_ANIMALS, ...{ id: string; kind: string; tab: string; name: string; notes: string; place: { x: number; z: number; r: number; }; plate: { sketch: string; }; }[]]; readonly trophies: readonly [{ readonly entry: "ghost-stag"; readonly outline: "stag"; readonly mount: { readonly kind: "deer"; readonly variant: "ghost"; }; readonly title: "Ghostbuster"; }, { readonly entry: "antler-king"; readonly outline: "king"; readonly title: "Regicide, Technically"; }, { readonly entry: "imperial-bull"; readonly outline: "elk"; readonly mount: { readonly kind: "elk"; readonly variant: "imperial"; }; readonly title: "His Royal Lowness"; }, { readonly entry: "ironhide"; readonly outline: "boar"; readonly mount: { readonly kind: "boar"; readonly variant: "ironhide"; }; readonly title: "Ironhide's Retirement Plan"; }, { readonly entry: "scarback"; readonly outline: "boar"; readonly mount: { readonly kind: "boar"; readonly variant: "scarback"; }; readonly title: "Scar Tissue Collector"; }, { readonly entry: "grizzled-sow"; readonly outline: "bear"; readonly mount: { readonly kind: "bear"; readonly variant: "brown-old"; }; readonly title: "Grin and Bear It"; }, { readonly entry: "blackpaw"; readonly outline: "bear"; readonly mount: { readonly kind: "bear"; readonly variant: "black-old"; }; readonly title: "Paws for Thought"; }]; readonly wall: { cabin: number; at: [number, number, number]; yaw: number; width: number; rows: readonly [3, 4]; rowY: readonly [1.98, 1.12]; }; } = {
  kind: 'journal', id: 'pine.journal', chunkId: 'chunk://local/pine-hollow', className: 'journal', title: "Hunter's Journal",
  tabs: [{ id: 'beasts', label: 'Beasts' }, { id: 'elites', label: 'Elites' }, { id: 'places', label: 'Places' }, { id: 'trophies', label: 'Trophies' }],
  trophyTab: 'trophies', stamp: { place: 'Visited', default: 'Taken' },
  icons: [{ entryKind: 'boss', icon: 'antlers' }, { entryKind: 'elite', matchKind: 'deer', icon: 'ghost' },
    { entryKind: 'elite', matchKind: 'boar', icon: 'ironhide' },
    ...(['deer', 'boar', 'elk', 'bear'] as const).map(kind => ({ matchKind: kind, icon: kind }))],
  stats: {
    place: [{ label: 'Visits', value: 'seen' }, { label: 'Status', value: 'status', fallback: 'Heard of', words: { unknown: '???', seen: 'Visited' } }],
    default: [{ label: 'Seen', value: 'seen' }, { label: 'Taken', value: 'taken' }, { label: 'Best', value: 'best', suffix: ' kg', fallback: '—' },
      { label: 'Rarity', value: 'rarity', fallback: '???', words: { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', legendary: 'Legendary' } }],
  },
  chalk: { atlas: '/assets/pine-hollow/journal/chalk.webp', cells: {
    stag: { x: 0, y: 0, w: 0.2, h: 1 }, elk: { x: 0.2, y: 0, w: 0.2, h: 1 }, boar: { x: 0.4, y: 0, w: 0.2, h: 1 },
    bear: { x: 0.6, y: 0, w: 0.2, h: 1 }, king: { x: 0.8, y: 0, w: 0.2, h: 1 },
  } },
  entries: [...JOURNAL_ANIMALS, ...LAYOUT.PINE_HOLLOW_POIS.map(place => ({
    id: place.id, kind: 'place', tab: 'places', name: place.name, notes: JOURNAL_PLACE_NOTES[place.id] ?? '',
    place: { x: place.x, z: place.z, r: place.r }, plate: { sketch: placeSketch(place.id) },
  }))], trophies: PINE_HOLLOW_TROPHIES, wall: RANGER_WALL,
} as const;
