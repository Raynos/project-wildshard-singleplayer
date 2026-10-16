/**
 * Driftwood's look strategy (E357 S4.3, 08 §6.3 B; 01 §13.1): the toon look the engine used to branch on
 * (`style === 'toon'` in Game.ts, Sky.ts, Terrain.ts, Atmosphere.ts and stylize.ts), declared as the manifest's `render`.
 *   compose         'extend': the engine's clean L5 chain (E88, the user's Look Lab pick: no volumetrics, grain or
 *                   fringe; faint rays, the learned LUT last) in the colour pass. The phone's FXAA and no god rays are
 *                   the manifest's tier knobs (E189)
 *   fog             the engine's colour-ramp fog (toon.ts, L3), slot 200, classic and graph materials alike
 *   fogControl      Explore's overhead map switches the ramp haze off for its shot
 *   shadows         the phone's three split cascades (E123 / E147), tent filter (E138), stepped-sun crossfade (E147 / E153),
 *                   16-bit maps (E174), the deck-acne biases
 *   backdrop        the stylized dome and the day / night clock (backdrop.ts; the keys in dayKeys.ts)
 *   prepareWorld    the ground's graph toon materials, compiled and lent before it builds (terrainPainter.ts)
 *   terrainPainter  the faceted ground coloured by height and slope (terrainPainter.ts)
 */
import type { LookStrategy } from '@wildshard/engine/render/look';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';
import { stylizedBackdrop } from './backdrop';
import { LOWPOLY_TERRAIN, prepareGround } from './terrainPainter';
import { rampFog } from './toon';

/** the island's shadow rig: a low sun (golden hour, dawn) grazes the flat decks, so more normal bias, or the planks speckle */
const DRIFTWOOD_SHADOWS: LookStrategy['shadows'] = { rig: 'phoneSplits', filter: 'tent', fade: true, normalBias: 0.14, radius: 0.6, texelBias: 'phone', depth16: 'phone' };

/** The look over the island's built output (the game hands the product in: ShardManifest.render). */
export const shardRender = (product: ShardProduct): LookStrategy => ({
  mode: 'extend',
  chain: 'clean',
  compose: (c) => ({ chain: c.engineChain('clean') }),
  fog: rampFog.model(200),
  fogControl: rampFog.control,
  shadows: DRIFTWOOD_SHADOWS,
  backdrop: stylizedBackdrop(product),
  prepareWorld: prepareGround(product),
  terrainPainter: LOWPOLY_TERRAIN,
});
