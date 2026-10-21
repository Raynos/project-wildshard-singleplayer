/**
 * Nalati's look strategy (E357 S3.2, 07 §6.2; 01 §13.1): the painterly look the engine used to branch on
 * (`style === 'painterly'` in Game.ts, Terrain.ts and Grass.ts), declared as the manifest's `render`.
 *   compose         'replace': the whole chain — RenderPass → bloom (desktop) + the one grade (grade.ts `lookV2Passes`);
 *                   the composer's MSAA is the manifest's `msaa` tier knob (phone 2, desktop 4)
 *   engineKnobs     that chain as an engine chain's knobs, for a page shell drawing its grid cell (SF63)
 *   fog             the cloud shadows (game/looks/paintedLook `paintedAir`), then the panorama fog, slot 300: every fogged
 *                   material fades into the painted haze straight behind it, the 256 × 1 azimuth LUT (panoramaData.ts,
 *                   un-graded at build time) re-tinted by the hour / weather as the dome is; both rows are the boot rows
 *   terrainPainter  the painted ground (game/looks/painterlyLook `paintedGroundPainter`, the boot rows)
 *   grass           the GPU blade rings + shader flowers (grass.ts `GrassV2`)
 *   sky             no engine cloud layer or planet (the panorama dome is the sky); the cloud shadows' field + drift
 * The panorama dome, the day keys and the per-frame look are still wired by `wireLookV2` (index.ts) until 07 §6.2 step 6.
 */
import * as THREE from 'three';
import type { LookStrategy } from '@wildshard/engine/render/look';
import { headingTexture } from '@wildshard/engine/render/dataLook';
import { ColourRampFog, panoramaTint } from '@wildshard/engine/world/Atmosphere';
import { paintedAir } from '@wildshard/game/looks/paintedLook';
import { paintedGroundPainter } from '@wildshard/game/looks/painterlyLook';
import { lookV2EngineKnobs, lookV2Passes } from './grade';
import { createGrass } from './field';
import { bakeUniforms } from './capture';
import paintedTextures from '../boot/paintedTextures.generated.json' with { type: 'json' };
import specimenData from '../boot/specimens.generated.json' with { type: 'json' };
import metadata from '../bootMetadata.generated.json' with { type: 'json' };

/** the painted ground (game/looks/painterlyLook): the boot rows over the specimen tiles, shaded by the static bake */
const GROUND = paintedGroundPainter('nalati-grasslands', 'ground' in paintedTextures ? paintedTextures.ground : null, specimenData.materials, bakeUniforms);

/** the fog LUT: scene-linear, half float, RepeatWrapping on the azimuth (index.ts hands it to the dome and the cloud sea) */
export const fogLut = headingTexture({ samples: metadata.postChain.fogLut, stride: 3, half: true, name: 'nalati-fog-lut' });
/** the painting's live re-grade (the hour and the weather), shared by the dome, the cloud sea and this fog; the painted sky's
 *  `tint` rows (generators/weatherChannels.ts) write it each frame */
export const tint = panoramaTint;
const { start, end, aerial, edge } = paintedTextures.fog, haze = [0.2, 0.21, 0.26] as const;
const FOG = new ColourRampFog({ start, end, near: haze, zenith: haze, panorama: { lut: { value: fogLut },
  aerial: { value: new THREE.Vector4().fromArray(aerial) }, edge: { value: new THREE.Vector4().fromArray(edge) }, tint } }).model(300);
const AIR = paintedAir(paintedTextures.air);

export const shardRender = (): LookStrategy => ({
  mode: 'replace',
  compose: (c) => ({ chain: lookV2Passes(c) }),
  engineKnobs: lookV2EngineKnobs,
  fog: { ...FOG, install: () => { AIR.install(); FOG.install(); } },
  terrainPainter: GROUND,
  grass: { build: (sky, forest) => createGrass(sky, forest) },
  sky: AIR.sky,
});
