/**
 * Nalati's look strategy (E357 S3.2, 07 §6.2; 01 §13.1): the painterly look, declared as the manifest's `render`, as rows.
 *   compose         'replace' (G600 L1, game/looks/postGraphLook): the whole chain — the scene pass → bloom (desktop) → the
 *                   grade graph (generators/postChain.ts); the composer's MSAA is the manifest's `msaa` tier knob (phone 2,
 *                   desktop 4); the same grade is its grid cell's whole colour chain
 *   fog, terrainPainter, grass, sky (G600 L1, game/looks/paintedWorld): the cloud shadows then the panorama fog, slot 300
 *                   (the 256 × 1 azimuth LUT un-graded at build time, re-tinted by the hour / weather
 *                   as the dome is), the painted ground, the GPU blade rings + shader flowers, no engine cloud layer or
 *                   planet (the panorama dome is the sky); all shaded by the static capture, from the boot rows
 * The panorama dome, the day keys and the per-frame look are wired by `wireLookV2` (index.ts) over the same parts.
 */
import type { LookStrategy } from '@wildshard/engine/render/look';
import { postGraphLookOf } from '@wildshard/game/looks/postGraphLook';
import { paintedWorld } from '@wildshard/game/looks/paintedWorld';
import paintedTextures from '../boot/paintedTextures.generated.json' with { type: 'json' };
import specimenData from '../boot/specimens.generated.json' with { type: 'json' };
import captureRows from '../boot/staticCapture.generated.json' with { type: 'json' };
import grassRows from '../boot/grass.generated.json' with { type: 'json' };
import metadata from '../bootMetadata.generated.json' with { type: 'json' };

export const shardRender = (): LookStrategy => ({
  ...postGraphLookOf('nalati-grasslands', metadata.postChain.postGraph),
  ...paintedWorld('nalati-grasslands', { fog: { ...paintedTextures.fog, haze: [0.2, 0.21, 0.26], order: 300, lut: metadata.postChain.fogLut }, air: paintedTextures.air,
    ground: 'ground' in paintedTextures ? paintedTextures.ground : null, tiles: specimenData.materials, capture: captureRows,
    grass: { rows: grassRows, cards: paintedTextures.cards } }).look,
});
