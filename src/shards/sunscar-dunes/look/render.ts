import { DUSK } from './dusk';
import type { LookStrategy } from '@wildshard/engine/render/look';
import { CubeSkirt, TintedTileGround } from '../runtime/looks/bakedGround';
import { duskLook, loadDuskSandMaps, type DuskSandMaps } from '../runtime/looks/duskLook';
import { SPAWN } from '../data/layout';
import { SIGNAL_DUSK_LOOK } from '../data/lastLight';
import { SAND_FILES, SAND_MAPS } from '../data/sand';
import sandMeans from '../data/sand.json' with { type: 'json' };
import skirtRows from '../data/skirt.json' with { type: 'json' };
import { DUNE_FIELD } from '../data/duneField';
import { FIRE_LIGHTS } from '../world/fireFx';
import source from '../shard.config';

/**
 * "Last Light" (docs/design/sunscar-dunes/style-bible.md) on the platform's dusk look (`@wildshard/sdk/looks/duskLook`,
 * its row data/lastLight.ts SIGNAL_DUSK_LOOK): a low warm key ~9° up with the afterglow behind the tower (E399: the
 * mockups win over the old "never in the player's face" rule), so the dune faces turned to the camera fall into cool shade,
 * the crests catch the light and the ripples graze; the crests run diagonally across the view (`data/duneField.ts` wind).
 */

/**
 * The sand's three baked maps (SF72, `generators/sand.ts` → `scripts/bake-signal-sand.mjs`, uploaded from data/sand.ts
 * SAND_MAPS): the dune-shadow map (R1, E407 row 3), the trail mask (round 2) and the grain tile (loop 2), its means from
 * data/sand.json (round 17). A map that fails to load is a page fault: the sand draws without it.
 */
export const loadSandMaps = (): Promise<DuskSandMaps> => loadDuskSandMaps(SAND_MAPS, sandMeans, '[sunscar-dunes] the baked sand map did not load:');
/** The sand's tiles (G227 M3; the only ground since Jake's G266), their fine ring following the player past 8 m. */
export const SAND_TILES = new TintedTileGround({ source, x: SPAWN.x, z: SPAWN.z, follow: 8, name: 'Signal Dunes', tag: 'sunscar-dunes' });
/** The skirt (baked, `generators/skirt.ts`), held so the plugin can cut it back to a grid cell's cube (G99). */
export const SKIRT = new CubeSkirt();

/** Signal Dunes' look: the dusk look over the quest's dusk (look/dusk.ts), the fires' light pools and the analytic dune field. */
export function signalDunesLook(): LookStrategy {
  return duskLook(SIGNAL_DUSK_LOOK, { dusk: DUSK, fires: FIRE_LIGHTS, wind: DUNE_FIELD.wind, maps: loadSandMaps, tiles: SAND_TILES, skirt: SKIRT,
    skirtPack: { url: SAND_FILES.skirt, rows: skirtRows, fault: '[sunscar-dunes] the baked dune skirt did not load:' } });
}
