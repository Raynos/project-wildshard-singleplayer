import * as terrainBytes from '@wildshard/format/bakedTerrainBytes';
/**
 * Baked terrain (project/archive/2026-09-22-load-perf.md §P2.1): `scripts/bake-chunk.mjs` evaluates the chunk's
 * pure terrain functions at build time onto the terrain mesh's vertex grid and writes
 * public/assets/baked/<slug>/terrain.bin (format in the script). At launch this module fetches it
 * (counted by the boot plan under the `terrain` byte source) and swaps Heightfield's `heightAt` /
 * `normalAt` / `splatAt` for bilinear lookups over that grid — the terrain mesh, the forest, the
 * grass, the props, the herds and the player then read ~200 k samples from memory instead of
 * evaluating fbm/ridged noise for each (phone: terrain 838 ms, most of it here).
 *
 * The lookups are exact at the mesh vertices and the mesh's own bilinear surface between them,
 * which is what the player sees. The build checks the full bake's bytes before committing. A missing
 * or malformed file leaves the analytic functions in place (a warning, never a failure).
 */
import { publicBytes } from '../boot/tables';
import { captureHeightfield, type HeightfieldBinding } from './Heightfield';
import { SEED } from '../core/config';
import type { TerrainField } from '../level/data';
import { levelBakedId } from '../level/spec';

/** Existing runtime grid type is defined by the pure byte reader. */
export type BakedGrid = terrainBytes.BakedGrid;
/** Existing runtime placement type is defined by the pure byte reader. */
export type BakedPlacement = terrainBytes.BakedPlacement;
/** Existing runtime parser is the identical defining format function. */
export const parseBakedTerrain = terrainBytes.parseBakedTerrain;

export const bakedTerrainUrl = (slug: string): string | null => {
  const url = `/assets/baked/${slug}/terrain.bin`;
  return url in publicBytes() ? url : null;
};

/** Bilinear samplers over the grid, in the TerrainField shapes. */
export function bakedSamplers(g: BakedGrid): Pick<TerrainField, 'heightAt' | 'normalAt' | 'splatAt'> {
  const { res, size, heights, splat } = g;
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

const installed = new WeakMap<HeightfieldBinding, { placement: BakedPlacement | null }>();

/** The active chunk's undergrowth decision log from its installed bake, if it has one (src/shards/pine-hollow/world/undergrowth.ts). */
export function bakedUndergrowth(binding: HeightfieldBinding = captureHeightfield()): BakedPlacement | null {
  return installed.get(binding)?.placement ?? null;
}

/** Install original native samples and their placement decisions into one selected binding without fetching or rebuilding. */
export function installBakedGrid(grid: BakedGrid, binding: HeightfieldBinding = captureHeightfield()): void {
  if (grid.seed !== ((binding.level.seed ?? SEED) >>> 0)) throw new Error('Baked terrain seed differs from selected level');
  binding.install(bakedSamplers(grid));
  installed.set(binding, { placement: grid.undergrowth });
}

/** Fetch the active chunk's bake and install it; resolves either way. Idempotent per chunk. */
export async function loadBakedTerrain(binding: HeightfieldBinding = captureHeightfield()): Promise<boolean> {
  const levelId = binding.level.id, seed = binding.level.seed ?? SEED;
  if (installed.has(binding)) return true;
  const url = bakedTerrainUrl(levelBakedId(binding.level));
  if (!url || new URLSearchParams(location.search).has('nobake')) return false; // ?nobake=1: A/B against the analytic field
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status}`);
    const grid = parseBakedTerrain(await res.arrayBuffer());
    if (!grid || grid.seed !== (seed >>> 0)) throw new Error('bad header / seed');
    installBakedGrid(grid, binding);
    return true;
  } catch (e) {
    console.warn(`[baked] terrain for ${levelId} not used (${e instanceof Error ? e.message : String(e)}); computing at launch`);
    return false;
  }
}
