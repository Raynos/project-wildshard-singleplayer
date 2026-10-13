import { bakedSamplers } from '@wildshard/format/bakedTerrainSampling';
import drape from '../data/drapeGround.generated.json' with { type: 'json' };

/**
 * The ground the fire and lamp pools drape over (generators/manifestGround.ts `signalDrapeGround`): the original 256²
 * Float32 lattice's exact samples in blocks round the caravan and the braziers, read with the native bilinear law, so each
 * pool sits on the sand exactly as it always has. Asking outside a block is a build fault, never a guess.
 */
export function drapeGroundAt(): (x: number, z: number) => number {
  const { res, size } = drape, heights = new Float32Array(res * res), covered = new Uint8Array(res * res);
  for (const p of drape.patches) for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) {
    const at = (p.j0 + j) * res + p.i0 + i;
    heights[at] = p.heights[j * p.w + i] ?? 0; covered[at] = 1;
  }
  const { heightAt } = bakedSamplers({ res, size, seed: 0, landscapeHash: 0, heights, splat: new Uint8Array(0), undergrowth: null });
  const inv = (res - 1) / size, last = res - 2;
  return (x, z) => {
    const ix = Math.min(last, Math.floor(Math.min(res - 1, Math.max(0, (x + size / 2) * inv)))), iz = Math.min(last, Math.floor(Math.min(res - 1, Math.max(0, (z + size / 2) * inv))));
    const i = iz * res + ix;
    if (covered[i] !== 1 || covered[i + 1] !== 1 || covered[i + res] !== 1 || covered[i + res + 1] !== 1) throw new Error(`Signal pool drape asked the ground outside its blocks at ${String(x)}, ${String(z)}`);
    return heightAt(x, z);
  };
}
