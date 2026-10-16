import type { LookStrategy } from '@wildshard/engine/render/look';
import { keyedSkyBackdrop } from '../runtime/looks/keyedSky';
import { PINE_KEYED_DAY } from './dayKeys';
import { pineMemoryTrim } from '../runtime/debug/options';
import { SKY_LOOKS } from '../data/skyLook';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';

/** Pine Hollow's look: the engine's chain under its keyed day / night sky (data/sky.ts), its graphs from the Hollow's built
 *  output (the game hands the product in: ShardManifest.render); the memory trim packs the keys. */
export function shardRender(product: ShardProduct): LookStrategy {
  return { compose: () => ({}), backdrop: keyedSkyBackdrop(PINE_KEYED_DAY, pineMemoryTrim, { source: product.shardfile, ...SKY_LOOKS }) };
}
