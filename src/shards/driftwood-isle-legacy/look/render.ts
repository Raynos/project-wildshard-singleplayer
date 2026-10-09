/**
 * Driftwood's look strategy (E357 S4.3, 08 §6.3 B; 01 §13.1): the toon look the engine used to branch on
 * (`style === 'toon'` in Game.ts, Sky.ts, Terrain.ts, Atmosphere.ts and stylize.ts), declared as the manifest's `render`.
 *   compose         'extend': the engine's clean L5 chain (E88, the user's Look Lab pick: no volumetrics, grain or
 *                   fringe; faint rays, the learned LUT last) in the colour pass. The phone's FXAA and no god rays are
 *                   the manifest's tier knobs (E189)
 *   lighting        the toon light model (toon.ts, D1), patched in before anything compiles
 *   fog             the colour-ramp fog (toon.ts, L3), slot 200; the toon uniforms ride every fogged material
 *   fogControl      Explore's overhead map switches the ramp haze off for its shot
 *   shadows         the phone's three split cascades (E123 / E147), tent filter (E138), stepped-sun crossfade (E147 / E153),
 *                   16-bit maps (E174), the deck-acne biases
 *   backdrop        the stylized dome and the day / night clock (backdrop.ts; the keys in dayKeys.ts)
 *   terrainPainter  the faceted ground coloured by height and slope (terrainPainter.ts)
 */
import type { LookStrategy } from '@wildshard/engine/render/look';
import { STYLIZED_BACKDROP } from './backdrop';
import { LOWPOLY_TERRAIN } from './terrainPainter';
import { installRampFog, installToonLighting, resumeRampFog, suspendRampFog } from './toon';

/** the island's shadow rig: a low sun (golden hour, dawn) grazes the flat decks, so more normal bias, or the planks speckle */
const DRIFTWOOD_SHADOWS: LookStrategy['shadows'] = { rig: 'phoneSplits', filter: 'tent', fade: true, normalBias: 0.14, radius: 0.6, texelBias: 'phone', depth16: 'phone' };

export const shardRender = (): LookStrategy => ({
  mode: 'extend',
  chain: 'clean',
  compose: (c) => ({ chain: c.engineChain('clean') }),
  lighting: { install: installToonLighting },
  fog: { order: 200, install: installRampFog },
  fogControl: { suspend: suspendRampFog, resume: resumeRampFog },
  shadows: DRIFTWOOD_SHADOWS,
  backdrop: STYLIZED_BACKDROP,
  terrainPainter: LOWPOLY_TERRAIN,
});
