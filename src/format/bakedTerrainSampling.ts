import type { BakedGrid } from './bakedTerrainBytes';

/** Native height, normal and four-channel splat queries, without a renderer or active binding. */
export interface BakedTerrainSamplers {
  /** Bilinear height on the original Float32 lattice, before the host's datum shift. */
  heightAt: (x: number, z: number) => number;
  /** Original central-difference unit normal, with the shipping 0.6 metre default. */
  normalAt: (x: number, z: number, eps?: number) => [number, number, number];
  /** Original bilinear splat weights, normalized only when their sum is positive. */
  splatAt: (x: number, z: number) => [number, number, number, number];
}

// A uniform lattice needs only its original four components. Never change a partial or varying lattice.
function sampledSplat(res: number, splat: Uint8Array): { samples: Uint8Array; uniform: boolean } {
  if (!Number.isInteger(res) || res < 2 || splat.length !== res * res * 4) return { samples: splat, uniform: false };
  for (let i = 4; i < splat.length; i++) if (splat[i] !== splat[i % 4]) return { samples: splat, uniform: false };
  return { samples: Uint8Array.from(splat.subarray(0, 4)), uniform: true };
}

/** The defining native sampling law, shared by authoring and every engine terrain binding.
 * Keep operation order, boundary clamping and fallback reads identical to the original runtime. */
export function bakedSamplers(g: BakedGrid): BakedTerrainSamplers {
  const { res, size, heights } = g;
  const { samples: splat, uniform } = sampledSplat(res, g.splat);
  const half = size / 2, inv = (res - 1) / size, last = res - 2;
  const cell = (v: number): [number, number] => {
    const u = Math.min(res - 1, Math.max(0, (v + half) * inv));
    const i = Math.min(last, Math.floor(u));
    return [i, u - i];
  };
  const heightAt = (x: number, z: number): number => {
    // cell() inlined: its [index, fraction] tuples were two arrays per call, and every system asks this (E186)
    const ux = Math.min(res - 1, Math.max(0, (x + half) * inv)), uz = Math.min(res - 1, Math.max(0, (z + half) * inv));
    const ix = Math.min(last, Math.floor(ux)), iz = Math.min(last, Math.floor(uz)), fx = ux - ix, fz = uz - iz;
    const i = iz * res + ix;
    const h00 = heights[i] ?? 0, h10 = heights[i + 1] ?? 0, h01 = heights[i + res] ?? 0, h11 = heights[i + res + 1] ?? 0;
    const a = h00 + (h10 - h00) * fx;
    const b = h01 + (h11 - h01) * fx;
    return a + (b - a) * fz;
  };
  const normalAt = (x: number, z: number, eps = 0.6): [number, number, number] => {
    const hl = heightAt(x - eps, z), hr = heightAt(x + eps, z);
    const hd = heightAt(x, z - eps), hu = heightAt(x, z + eps);
    const nx = hl - hr, nz = hd - hu, ny = 2 * eps;
    const l = Math.hypot(nx, ny, nz);
    return [nx / l, ny / l, nz / l];
  };
  const splatAt = (x: number, z: number): [number, number, number, number] => {
    const [ix, fx] = cell(x), [iz, fz] = cell(z);
    let i00 = (iz * res + ix) * 4, i10 = i00 + 4, i01 = i00 + res * 4, i11 = i01 + 4;
    // Keep NaN's original undefined-index fallback; finite/clamped corners read the same four proven-uniform bytes.
    if (uniform && Number.isFinite(i00)) i00 = i10 = i01 = i11 = 0;
    const out: [number, number, number, number] = [0, 0, 0, 0];
    let sum = 0;
    for (let c = 0; c < 4; c++) {
      const s00 = splat[i00 + c] ?? 0, s10 = splat[i10 + c] ?? 0, s01 = splat[i01 + c] ?? 0, s11 = splat[i11 + c] ?? 0;
      const a = s00 + (s10 - s00) * fx;
      const b = s01 + (s11 - s01) * fx;
      const w = a + (b - a) * fz;
      out[c] = w; sum += w;
    }
    if (sum > 0) { out[0] /= sum; out[1] /= sum; out[2] /= sum; out[3] /= sum; }
    return out;
  };
  return { heightAt, normalAt, splatAt };
}
