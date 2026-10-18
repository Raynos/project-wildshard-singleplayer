import type { LookStrategy } from '@wildshard/engine/render/look';
import { paintedLookFromRow, parsePaintedLookRow } from '@wildshard/engine/render/dataLook';
import { loadPaintedTexture } from '@wildshard/game/plugin/geometry';
import { sceneScalar } from '@wildshard/game/shardfile/sceneInputs';
import rows from '../data/paintedLook.generated.json' with { type: 'json' };

/**
 * "Last Light" (docs/design/sunscar-dunes/style-bible.md) on the engine's painted look (G406, one painted look for Sky
 * Reach and Signal Dunes; its row data/lastLight.ts SIGNAL_DUSK_LOOK): a low warm key ~9° up with the afterglow behind the
 * tower (E399: the mockups win over the old "never in the player's face" rule), so the dune faces turned to the camera
 * fall into cool shade, the crests catch the light and the ripples graze; the crests run diagonally across the view
 * (`data/duneField.ts` wind).
 */

/**
 * Signal Dunes' look: its two painted strips on the dome, the key, fill, fog and haze riding the quest's declared dusk field
 * on its curves, the clock held. The ground is the manifest's declared key, which the platform's required-ground loader
 * (`installProductGround`) reads from the shard's product. Z2 builds the skirt in the same sand material as the tiles.
 * The ground material reads the emitter pool input directly.
 */
export function signalDunesLook(): LookStrategy {
  return paintedLookFromRow(parsePaintedLookRow(rows.look), { load: loadPaintedTexture, state: sceneScalar('sunscar-dunes', 'dusk'),
    terrain: { build: async (_terrain, field) => { await field.ready(); } } });
}
