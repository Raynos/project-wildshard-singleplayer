import type { Material } from 'three';
import type { LookStrategy } from '@wildshard/engine/render/look';
import { paintedLookFromRow, parsePaintedLookRow } from '@wildshard/engine/render/dataLook';
import { loadPaintedTexture } from '@wildshard/game/plugin/geometry';
import { CubeSkirt } from '../runtime/looks/bakedGround';
import { sceneScalar } from '@wildshard/game/shardfile/sceneInputs';
import rows from '../data/paintedLook.generated.json' with { type: 'json' };
import skirtRows from '../data/skirt.json' with { type: 'json' };

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
 * Signal Dunes' look: its two painted strips on the dome, the key, fill, fog and haze riding the quest's declared dusk field
 * on its curves, the clock held. The ground is the manifest's declared key, which the platform's required-ground loader
 * (`installProductGround`) reads from the shard's product; the look only holds the skirt, which the plugin dresses in
 * the lent sand. The ground material reads the emitter pool input directly.
 */
export function signalDunesLook(): LookStrategy {
  return paintedLookFromRow(parsePaintedLookRow(rows.look), { load: loadPaintedTexture, state: sceneScalar('sunscar-dunes', 'dusk'),
    terrain: {
      build: async (terrain, field, scope) => {
        await SKIRT.load(terrain.group, { url: rows.sand.skirt, rows: skirtRows, fault: '[sunscar-dunes] the baked dune skirt did not load:' }, scope);
        await field.ready();
      },
    } });
}
