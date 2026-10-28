import { hashImmutableBytes } from '../../src/sdk/immutable';
import type * as CurrentTerrain from '../../src/shards/nalati-grasslands/generators/terrainRecipe';

type Source = Pick<typeof CurrentTerrain, 'TERRAIN' | 'groundColor' | 'surfaceAt' | 'edgeBermAt'>;
/** Complete original 65x65 cell observation, including both normal epsilons and all masks/paint. */
export function observeTerrain(source: Source): { values: number; bytes: Uint8Array; sha256: string } {
  const { TERRAIN, groundColor, surfaceAt, edgeBermAt } = source;
  const values: number[] = [], out: [number, number, number] = [0, 0, 0];
  for (let z = -250; z <= 250; z += 500 / 64) for (let x = -250; x <= 250; x += 500 / 64) {
    const h = TERRAIN.heightAt(x, z), n = TERRAIN.normalAt(x, z), slope = 1 - n[1];
    values.push(h, ...n, ...TERRAIN.normalAt(x, z, 1), ...TERRAIN.splatAt(x, z),
      TERRAIN.trailDistance(x, z), TERRAIN.cabinMask(x, z), TERRAIN.pondMask(x, z), TERRAIN.waterLevel(),
      ...groundColor(x, z, h, slope, TERRAIN, out), ...surfaceAt(x, z, h, slope), edgeBermAt(x, z));
  }
  const bytes = new Uint8Array(Float64Array.from(values).buffer);
  return { values: values.length, bytes, sha256: hashImmutableBytes(bytes) };
}
