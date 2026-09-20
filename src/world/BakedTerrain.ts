/**
 * Baked terrain (docs/plans/LOAD-PERF.md §P2.1): `scripts/bake-chunk.mjs` evaluates the chunk's
 * pure terrain functions at build time onto the terrain mesh's vertex grid and writes
 * public/assets/baked/<slug>/terrain.bin (format in the script). At launch this module fetches it
 * (counted by the boot plan under the `terrain` byte source) and swaps Heightfield's `heightAt` /
 * `normalAt` / `splatAt` for bilinear lookups over that grid — the terrain mesh, the forest, the
 * grass, the props, the herds and the player then read ~200 k samples from memory instead of
 * evaluating fbm/ridged noise for each (phone: terrain 838 ms, most of it here).
 *
 * The lookups are exact at the mesh vertices and the mesh's own bilinear surface between them,
 * which is what the player sees. A missing, foreign or stale file (its landscape fingerprint —
 * `landscapeHash` in src/chunks/terrain.ts, stored in the header — must equal the live def's) leaves
 * the analytic functions in place (a warning, never a failure).
 */
import { _installBakedTerrain } from './Heightfield';
import { getActiveChunk } from '../chunks/registry';
import { landscapeHash } from '../chunks/terrain';
import { PUBLIC_BYTES } from '../boot/bytes.generated';
import type { ChunkTerrain } from '../chunks/ChunkDef';

export interface BakedGrid { res: number; size: number; seed: number; /** fingerprint of the def's heightAt the bake was made from (0 = legacy, unhashed) */ landscapeHash: number; heights: Float32Array; splat: Uint8Array }

export const bakedTerrainUrl = (slug: string): string | null => {
  const url = `/assets/baked/${slug}/terrain.bin`;
  return url in PUBLIC_BYTES ? url : null;
};

export function parseBakedTerrain(buf: ArrayBuffer): BakedGrid | null {
  const dv = new DataView(buf);
  if (buf.byteLength < 24 || dv.getUint8(0) !== 0x57 || dv.getUint8(1) !== 0x53 || dv.getUint8(2) !== 0x54 || dv.getUint8(3) !== 0x52) return null;
  if (dv.getUint32(4, true) !== 1) return null;
  const res = dv.getUint32(8, true), size = dv.getFloat32(12, true), seed = dv.getUint32(16, true), hash = dv.getUint32(20, true);
  const n = res * res;
  if (buf.byteLength !== 24 + n * 8) return null;
  return { res, size, seed, landscapeHash: hash, heights: new Float32Array(buf, 24, n), splat: new Uint8Array(buf, 24 + n * 4, n * 4) };
}

/** Bilinear samplers over the grid, in the ChunkTerrain shapes. */
export function bakedSamplers(g: BakedGrid): Pick<ChunkTerrain, 'heightAt' | 'normalAt' | 'splatAt'> {
  const { res, size, heights, splat } = g;
  const half = size / 2, inv = (res - 1) / size, last = res - 2;
  const cell = (v: number): [number, number] => {
    const u = Math.min(res - 1, Math.max(0, (v + half) * inv));
    const i = Math.min(last, Math.floor(u));
    return [i, u - i];
  };
  const heightAt = (x: number, z: number): number => {
    const [ix, fx] = cell(x), [iz, fz] = cell(z);
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
    const i00 = (iz * res + ix) * 4, i10 = i00 + 4, i01 = i00 + res * 4, i11 = i01 + 4;
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

let installedFor: string | null = null;

/** Fetch the active chunk's bake and install it; resolves either way. Idempotent per chunk. */
export async function loadBakedTerrain(): Promise<boolean> {
  const def = getActiveChunk();
  if (installedFor === def.slug) return true;
  const url = bakedTerrainUrl(def.slug);
  if (!url || new URLSearchParams(location.search).has('nobake')) return false; // ?nobake=1: A/B against the analytic field
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status}`);
    const grid = parseBakedTerrain(await res.arrayBuffer());
    if (!grid || grid.seed !== (def.seed >>> 0)) throw new Error('bad header / seed');
    // the bake must come from THIS def's landscape: a stale file (service-worker cache, a def edited since the last
    // bake) fingerprints differently and is refused — the analytic field stays in place
    if (grid.landscapeHash !== 0) {
      const live = landscapeHash(def.terrain, grid.size);
      if (live !== grid.landscapeHash) throw new Error(`stale: landscape ${grid.landscapeHash.toString(16)} ≠ live ${live.toString(16)}`);
    } else console.info(`[baked] ${def.slug}: legacy bake without a landscape fingerprint — accepted unchecked`);
    if (getActiveChunk() !== def) return false;
    _installBakedTerrain(bakedSamplers(grid));
    installedFor = def.slug;
    return true;
  } catch (e) {
    console.warn(`[baked] terrain for ${def.slug} not used (${(e as Error).message}); computing at launch`);
    return false;
  }
}
