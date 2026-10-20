/**
 * Nalati's look strategy (E357 S3.2, 07 §6.2; 01 §13.1): the painterly look the engine used to branch on
 * (`style === 'painterly'` in Game.ts, Terrain.ts and Grass.ts), declared as the manifest's `render`.
 *   compose         'replace': the whole chain — RenderPass → bloom (desktop) + the one grade (grade.ts `lookV2Passes`);
 *                   the composer's MSAA is the manifest's `msaa` tier knob (phone 2, desktop 4)
 *   engineKnobs     that chain as an engine chain's knobs, for a page shell drawing its grid cell (SF63)
 *   fog             the cloud shadows (game/looks/paintedLook `paintedAir`), then the panorama fog (fog.ts), slot 300
 *   terrainPainter  the painted ground (game/looks/painterlyLook `paintedGroundPainter`, the boot rows)
 *   grass           the GPU blade rings + shader flowers (grass.ts `GrassV2`)
 *   sky             no engine cloud layer or planet (the panorama dome is the sky); the cloud shadows' field + drift
 * The panorama dome, the day keys and the per-frame look are still wired by `wireLookV2` (index.ts) until 07 §6.2 step 6.
 */
import type { LookStrategy } from '@wildshard/engine/render/look';
import { paintedAir } from '@wildshard/game/looks/paintedLook';
import { paintedGroundPainter } from '@wildshard/game/looks/painterlyLook';
import { paintedFog } from './fog';
import { lookV2EngineKnobs, lookV2Passes } from './grade';
import { createGrass } from './field';
import { bakeUniforms } from './capture';
import paintedTextures from '../boot/paintedTextures.generated.json' with { type: 'json' };
import specimenData from '../boot/specimens.generated.json' with { type: 'json' };

/** the painted ground (game/looks/painterlyLook): the boot rows over the specimen tiles, shaded by the static bake */
const GROUND = paintedGroundPainter('nalati-grasslands', 'ground' in paintedTextures ? paintedTextures.ground : null, specimenData.materials, bakeUniforms);

const FOG = paintedFog.model(300);
/** soft cloud shadows: a 520 m tile, cover past 0.53 (± 0.06) takes 0.66 of the sun, drifting at 1.6 × the wind + 2 m/s */
const AIR = paintedAir({ tile: 520, threshold: 0.53, strength: 0.66, softness: 0.06, drift: [1.6, 2] });

export const shardRender = (): LookStrategy => ({
  mode: 'replace',
  compose: (c) => ({ chain: lookV2Passes(c) }),
  engineKnobs: lookV2EngineKnobs,
  fog: { ...FOG, install: () => { AIR.install(); FOG.install(); } },
  terrainPainter: GROUND,
  grass: { build: (sky, forest) => createGrass(sky, forest) },
  sky: AIR.sky,
});
