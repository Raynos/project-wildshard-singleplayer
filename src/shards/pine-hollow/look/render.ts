import type { LookStrategy } from '@wildshard/engine/render/look';
import { keyedSkyBackdrop } from '@wildshard/game/looks/keyedSky';
import { pineMemoryTrim } from '../runtime/debug/options';
import { SKY_LOOKS } from '../data/skyLook';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';

/** Pine Hollow's look: the engine's chain under its keyed day / night sky (data/sky.json), its graphs from the Hollow's built
 *  output (the game hands the product in: ShardManifest.render); the memory trim packs the keys. */
export function shardRender(product: ShardProduct): LookStrategy {
  return { compose: () => ({}), backdrop: keyedSkyBackdrop(product.section('look/keyed-sky'), { packKeys: pineMemoryTrim(), smallEnv: pineMemoryTrim(), channels: 'pine.sky' }, { product, ...SKY_LOOKS }) };
}
