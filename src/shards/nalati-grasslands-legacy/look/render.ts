/**
 * Nalati's look strategy (E357 S3.2, 07 §6.2; 01 §13.1): the painterly look the engine used to branch on
 * (`style === 'painterly'` in Game.ts, Terrain.ts and Grass.ts), declared as the manifest's `render`.
 *   compose         'replace': the whole chain — RenderPass → bloom (desktop) + the one grade (grade.ts `lookV2Passes`);
 *                   the composer's MSAA is the manifest's `msaa` tier knob (phone 2, desktop 4)
 *   engineKnobs     that chain as an engine chain's knobs, for a page shell drawing its grid cell (SF63)
 *   fog             the painted air (air.ts), then the panorama-coloured fog (fog.ts), slot 300, after the engine fog
 *   terrainPainter  the painted ground (terrainPainter.ts)
 *   grass           the GPU blade rings + shader flowers (grass.ts `GrassV2`)
 *   sky             no engine cloud layer or planet; the cloud shadows' field + drift (air.ts `NALATI_SKY`)
 * The panorama dome, the day keys and the per-frame look are still wired by `wireLookV2` (index.ts) until 07 §6.2 step 6.
 */
import type { LookStrategy } from '@wildshard/engine/render/look';
import { installPaintedAir, NALATI_SKY } from './air';
import { installLookV2Fog } from './fog';
import { lookV2EngineKnobs, lookV2Passes } from './grade';
import { GrassV2 } from './grass';
import { NALATI_TERRAIN_PAINTER } from './terrainPainter';

export const shardRender = (): LookStrategy => ({
  mode: 'replace',
  compose: (c) => ({ chain: lookV2Passes(c) }),
  engineKnobs: lookV2EngineKnobs,
  fog: { order: 300, install: () => { installPaintedAir(); installLookV2Fog(); } },
  terrainPainter: NALATI_TERRAIN_PAINTER,
  grass: { build: (sky, forest) => new GrassV2(sky, forest).build() },
  sky: NALATI_SKY,
});
