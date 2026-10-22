import { IslandLibrary } from '@wildshard/game/models/islandLibrary';
import type { FixedGeometryGroups } from '../../src/shards/driftwood-isle/runtime/productSections.generated.d.ts';

/** G586: Driftwood's Blender island library, declared as data on the game's island library host: its 90 fixed draws
 *  (custom/fixedLayouts), their groups, the figure catalogue and the collection cards, loaded once. */
export const ISLAND = new IslandLibrary<FixedGeometryGroups>({ product: 'driftwood-isle', draws: { section: 'custom/fixedLayouts', field: 'fixedDraws' },
  groups: 'models/fixed-geometry.json', figures: 'people/catalogue.json', collections: { chime: 'chime', trophyPlaques: 'trophyPlaques', trophyDrop: 'trophyDrop' } });
export const { figures: FIGURES, collections: COLLECTIONS, draw: fixedDraw, load: loadFixedGeometry, groups: fixedGeometryGroups, loaded: fixedDrawLibrary } = ISLAND;
/** Every slot's template has completed its intake. */
export function fixedGeometryReady(): boolean { return ISLAND.ready; }
