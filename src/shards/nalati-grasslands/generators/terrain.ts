import { bakeQueryTerrain, readNativeTerrain, type BakedQueryTerrain } from '@wildshard/sdk/bake/terrain';
import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';

const LATTICE = '/assets/baked/nalati-grasslands/terrain.bin';

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

/** GR6: the query terrain at build time (the retired nalati-terrain job's bytes): the lattice through the build cache, its
 *  charged files registered as owned assets under the same content hashes. */
export async function nalatiQueryTerrainProgram(ctx: Pick<ProjectGenerationContext, 'cached' | 'asset'>): Promise<Omit<BakedQueryTerrain, 'assets'>> {
  const read = await ctx.cached({ id: 'query-terrain', inputs: [LATTICE] }, inputs => {
    const bytes = inputs.get(LATTICE);
    if (bytes === undefined || bytes.length === 0) throw new Error('Missing Nalati query lattice');
    return new Map([['lattice.bin', bytes]]);
  });
  const bytes = read.get('lattice.bin');
  if (bytes === undefined) throw new Error('Missing Nalati query lattice');
  const { assets, ...query } = nalatiQueryTerrain(bytes);
  for (const [hash, file] of assets) if (ctx.asset(file) !== hash) throw new Error('Nalati query terrain identity differs');
  return query;
}
