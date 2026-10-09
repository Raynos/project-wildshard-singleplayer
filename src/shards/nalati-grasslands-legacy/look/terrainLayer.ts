/**
 * Nalati's painted terrain as the painterly family's painted-terrain layer (SHARD-PLATFORM G227): the catalogue entry
 * (`look.materials`) the shardfile's tiled terrain names. Today's terrain knobs (bands 0.5, rim 0, shade 0.85) and
 * `terrainSurface.ts`'s numbers as the layer's data (`PaintedTerrainSchema`, engine/render/families/params.ts; the Node
 * test parses it and checks it against today's uniforms). Its texture references are the painted layers' names here;
 * the bake swaps them for the admitted KTX2 hashes. The tiles carry the per-vertex `_SURF` / `_RDIR` / `_ZONE` channels
 * (`buildPainterlyGeometry`'s surf / rdir / zone).
 */
import { SNOW_LINE, GLACIER } from '../layout';
import { TEX_METRES, TEX_MEAN } from './nalatiTextures';

/** Nalati's terrain surface as a painterly family entry with the painted-terrain layer (plain data). */
export const NALATI_TERRAIN_SURFACE = {
  family: 'painterly', bands: 0.5, rim: 0, shade: 0.85,
  terrain: {
    maps: { base: 'meadow', track: 'path', gravel: 'gravel', rock: 'rock', snow: 'snow' },
    metres: { base: TEX_METRES.meadow, track: TEX_METRES.path, gravel: TEX_METRES.gravel, rock: TEX_METRES.rock, snow: TEX_METRES.snow },
    means: { base: [...TEX_MEAN.meadow], rock: [...TEX_MEAN.rock] },
    snow: { line: SNOW_LINE, high: [44, 84] },
    wet: [-9.2, -9.9],
    ice: { from: [GLACIER.x0, GLACIER.z0], to: [GLACIER.x1, GLACIER.z1], half: GLACIER.half },
  },
} as const;
