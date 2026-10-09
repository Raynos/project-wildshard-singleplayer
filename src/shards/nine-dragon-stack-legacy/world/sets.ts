// The fragment's named places as Sets (E306 / E315 second pass, M12: every named place in ../places.ts is a Set, shown by
// the sets explorer M7 between single models and the whole world): a Set is a named group of placed models
// (src/engine/models/sets.ts `placeSet`) and owns no geometry; the place's welded ground (its kits' fabric) stays world. The
// models the fragment draws into its kits are placed once per kit (world/inKit.ts), and each region builds into kits of
// its own name, so a place's Set is what its kits carry:
//   Lantern Square   the square cluster's kit ('paifang': the gate, the banyan with its shrine and stele, the two
//                    stalls, the balustrade's lotus buds, the mahjong tables, the scooters, the masts' hooks) and the
//                    balustrade's carved panels and its guardian lions
//   the Night Market its booths, parasol tables and pavilions (world/squareProps.ts)
//   the stair-street the stair's kits ('stair-…': its paifang, the landings' planters, its dragon hooks) and the lions
//                    on the street's balustrade down to the Well
//   the Well rim     the rim's kits ('well-rim', 'well-r': its tea stools, its hooks, the rim galleries' laundry) and the
//                    lions on the rim's balustrade
//   the crossings    the crossings' kits ('well-c-…': the gate bridge's paifang, the decks' dragon hooks)
//   the galleries    every other Well kit (the run north's and the lower Well's galleries: their laundry) and the wall
//                    kit's gallery plants there
import type { Placed } from '@wildshard/engine/models/place';
import { placeSet } from '@wildshard/engine/models/sets';
import type { InKitPlaced } from './inKit';

const FILE = 'src/shards/nine-dragon-stack/world/sets.ts';

interface Region {
  readonly id: string;
  readonly name: string;
  /** the named place (../places.ts) */
  readonly place: string;
  /** which kits' models are its members */
  readonly kit: (name: string) => boolean;
  /** which other placed groups join it */
  readonly extra: 'square' | 'stair' | 'rim' | 'well' | null;
}

const RIM = new Set(['well-rim', 'well-r']);
const REGIONS: readonly Region[] = [
  { id: 'nine-dragon-stack/lantern-square', name: 'Lantern Square', place: 'nine-dragon-stack/lantern-square', kit: (n) => n === 'paifang', extra: 'square' },
  { id: 'nine-dragon-stack/stair-street', name: 'The stair-street', place: 'nine-dragon-stack/stair-street', kit: (n) => n.startsWith('stair-'), extra: 'stair' },
  { id: 'nine-dragon-stack/well-rim', name: 'The Well rim', place: 'nine-dragon-stack/well-rim', kit: (n) => RIM.has(n), extra: 'rim' },
  { id: 'nine-dragon-stack/crossings', name: 'The Well\'s crossings', place: 'nine-dragon-stack/crossings', kit: (n) => n.startsWith('well-c-'), extra: null },
  { id: 'nine-dragon-stack/well-galleries', name: 'The Well\'s galleries', place: 'nine-dragon-stack/well-galleries', kit: (n) => n.startsWith('well-') && !RIM.has(n) && !n.startsWith('well-c-'), extra: 'well' },
];

/**
 * Register the fragment's places as Sets: the kits' models, plus the square's instanced sets (its balustrade panels;
 * the night market is its own place, squareProps.ts), the guardian lions where each stands and the wall kit's pieces in
 * the Well (`wellKit`)
 */
export function placeRegionSets(inKit: readonly InKitPlaced[], extra: { readonly square: readonly Placed[]; readonly stair: readonly Placed[]; readonly rim: readonly Placed[]; readonly well: readonly Placed[] }): void {
  for (const r of REGIONS) {
    const members = [...inKit.filter((g) => r.kit(g.kit)).map((g) => g.placed), ...(r.extra === null ? [] : extra[r.extra])];
    if (members.length > 0) placeSet({ id: r.id, name: r.name, file: FILE, place: r.place, members });
  }
}
