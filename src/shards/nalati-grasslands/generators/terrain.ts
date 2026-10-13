import { bakeQueryTerrain, readNativeTerrain, type BakedQueryTerrain } from '@wildshard/sdk/bake/terrain';

/**
 * G384: Nalati's original 256² WSTR lattice (public/assets/baked/nalati-grasslands/terrain.bin, header + heights + splat and
 * no placement tail) as the shardfile's query-only terrain, re-encoded without resampling (`bakeQueryTerrain`: no render
 * tiles, the native bilinear law at its 0.6 m normal epsilon, no datum). The trusted runtime keeps rendering and collision.
 */
export function nalatiQueryTerrain(bytes: Uint8Array): BakedQueryTerrain {
  const source = readNativeTerrain(bytes);
  if (source.grid.undergrowth !== null || bytes.length !== 24 + source.grid.res ** 2 * 8) throw new Error('Nalati query terrain must be the bare WSTR lattice');
  return bakeQueryTerrain(source);
}
