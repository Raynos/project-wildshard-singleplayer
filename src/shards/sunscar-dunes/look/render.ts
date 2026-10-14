import { Vector3, type Material } from 'three';
import type { LookStrategy } from '@wildshard/engine/render/look';
import { paintedLook } from '@wildshard/engine/render/dataLook';
import { DayCycle } from '@wildshard/engine/world/dayCycle';
import { setGroundPools } from '@wildshard/engine/render/families/ground';
import { loadPaintedTexture } from '@wildshard/game/plugin/geometry';
import { CubeSkirt } from '../runtime/looks/bakedGround';
import { DUSK } from './dusk';
import { SIGNAL_DUSK_LOOK as row } from '../data/lastLight';
import { SAND_FILES } from '../data/sand';
import skirtRows from '../data/skirt.json' with { type: 'json' };
import { FIRE_LIGHTS } from '../world/fireFx';

/**
 * "Last Light" (docs/design/sunscar-dunes/style-bible.md) on the engine's painted look (G406, one painted look for Sky
 * Reach and Signal Dunes; its row data/lastLight.ts SIGNAL_DUSK_LOOK): a low warm key ~9° up with the afterglow behind the
 * tower (E399: the mockups win over the old "never in the player's face" rule), so the dune faces turned to the camera
 * fall into cool shade, the crests catch the light and the ripples graze; the crests run diagonally across the view
 * (`data/duneField.ts` wind).
 */

/** The sand the data client lends (G345: its tiles drawn in the look's sand; null until the runtime's world stage reads it). */
export const SAND: { material: Material | null } = { material: null };
/** The skirt (baked, `generators/skirt.ts`), held so the plugin can cut it back to a grid cell's cube (G99). */
export const SKIRT = new CubeSkirt();

/**
 * Signal Dunes' look: its two painted strips on the dome, the key, fill, fog and haze riding the quest's dusk (look/dusk.ts)
 * on its curves, the clock held. The ground is the manifest's declared key, which the platform's required-ground loader
 * (`installProductGround`) reads from the shard's product; the look only holds the skirt, which the plugin dresses in
 * the lent sand, and feeds the burning fires' light pools to that sand each frame.
 */
export function signalDunesLook(): LookStrategy {
  return paintedLook({ sky: { strips: row.sky, load: loadPaintedTexture }, fog: row.fog, clock: () => new DayCycle(row.clock), hold: true,
    sun: { dir: new Vector3(...row.key.dir).normalize(), colour: row.key.color, intensity: row.key.intensity },
    state: { value: DUSK, deep: row.key.deep, curves: row.curves },
    terrain: {
      build: async (terrain, field, scope) => {
        await SKIRT.load(terrain.group, { url: SAND_FILES.skirt, rows: skirtRows, fault: '[sunscar-dunes] the baked dune skirt did not load:' }, scope);
        await field.ready();
      },
      update: () => { if (SAND.material !== null) setGroundPools(SAND.material, FIRE_LIGHTS.value); },
    } });
}
