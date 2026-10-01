/**
 * Driftwood's look strategy (E357 S4.3, 08 §6.3 B; 01 §13.1): the toon look the engine used to branch on
 * (`style === 'toon'` in Game.ts, Sky.ts and Terrain.ts), declared as the manifest's `render`.
 *   compose   'extend': the engine's clean L5 chain (E88, the user's Look Lab pick: no volumetrics, grain or fringe; faint
 *             rays, the learned LUT last) in the colour pass. The phone's FXAA and no god rays are the manifest's
 *             tier knobs (E189)
 *   terrainPainter  the faceted ground coloured by height and slope (terrainPainter.ts)
 */
import type { LookStrategy } from '#engine';
import { LOWPOLY_TERRAIN } from './terrainPainter';

export const shardRender = (): LookStrategy => ({
  mode: 'extend',
  compose: (c) => ({ chain: c.engineChain('clean') }),
  terrainPainter: LOWPOLY_TERRAIN,
});
