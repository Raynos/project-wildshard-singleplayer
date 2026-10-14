import { DUSK } from './dusk';
import type { Material } from 'three';
import type { LookStrategy } from '@wildshard/engine/render/look';
import { CubeSkirt } from '../runtime/looks/bakedGround';
import { duskLook } from '../runtime/looks/duskLook';
import { SIGNAL_DUSK_LOOK } from '../data/lastLight';
import { SAND_FILES } from '../data/sand';
import skirtRows from '../data/skirt.json' with { type: 'json' };
import { FIRE_LIGHTS } from '../world/fireFx';

/**
 * "Last Light" (docs/design/sunscar-dunes/style-bible.md) on the platform's dusk look (`@wildshard/sdk/looks/duskLook`,
 * its row data/lastLight.ts SIGNAL_DUSK_LOOK): a low warm key ~9° up with the afterglow behind the tower (E399: the
 * mockups win over the old "never in the player's face" rule), so the dune faces turned to the camera fall into cool shade,
 * the crests catch the light and the ripples graze; the crests run diagonally across the view (`data/duneField.ts` wind).
 */

/** The sand the data client lends (G345: its tiles drawn in the look's sand; null until the runtime's world stage reads it). */
export const SAND: { material: Material | null } = { material: null };
/** The skirt (baked, `generators/skirt.ts`), held so the plugin can cut it back to a grid cell's cube (G99). */
export const SKIRT = new CubeSkirt();

/**
 * Signal Dunes' look: the dusk look over the quest's dusk (look/dusk.ts) and the fires' light pools on the lent sand. Its
 * ground is the manifest's declared key, which the platform's required-ground loader (`installProductGround`) reads from
 * the shard's product, so the look binds none of its own.
 */
export function signalDunesLook(): LookStrategy {
  return duskLook(SIGNAL_DUSK_LOOK, { dusk: DUSK, fires: FIRE_LIGHTS, sand: SAND, ground: () => Promise.resolve(), skirt: SKIRT,
    skirtPack: { url: SAND_FILES.skirt, rows: skirtRows, fault: '[sunscar-dunes] the baked dune skirt did not load:' } });
}
