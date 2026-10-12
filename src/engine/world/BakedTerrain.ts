import { bakedSamplers as sampleBakedTerrain } from '@wildshard/format/bakedTerrainSampling';
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
import { bakedTerrainSource, installDeclaredBakedTerrain } from './bakedTerrainField';

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

/** Existing runtime sampler is the identical defining format function. */
export const bakedSamplers: (g: BakedGrid) => Pick<TerrainField, 'heightAt' | 'normalAt' | 'splatAt'> = sampleBakedTerrain;

const installed = new WeakMap<HeightfieldBinding, { placement: BakedPlacement | null }>();

/** The active chunk's undergrowth decision log from its installed bake, if it has one (src/shards/pine-hollow/world/undergrowth.ts). */
export function bakedUndergrowth(binding: HeightfieldBinding = captureHeightfield()): BakedPlacement | null {
  return installed.get(binding)?.placement ?? null;
}

/** Install original native samples and their placement decisions into one selected binding without fetching or rebuilding. */
export function installBakedGrid(grid: BakedGrid, binding: HeightfieldBinding = captureHeightfield()): void {
  if (grid.seed !== ((binding.level.seed ?? SEED) >>> 0)) throw new Error('Baked terrain seed differs from selected level');
  installDeclaredBakedTerrain(binding.base, grid);
  binding.install(bakedSamplers(grid));
  installed.set(binding, { placement: grid.undergrowth });
}

/** Fetch the active chunk's bake and install it; resolves either way. Idempotent per chunk. */
export async function loadBakedTerrain(binding: HeightfieldBinding = captureHeightfield()): Promise<boolean> {
  const levelId = binding.level.id, seed = binding.level.seed ?? SEED;
  if (installed.has(binding)) return true;
  const required = bakedTerrainSource(binding.base);
  if (required !== null && required.seed !== (seed >>> 0)) throw new Error('Declared baked terrain seed differs from selected level');
  const url = required?.url ?? bakedTerrainUrl(levelBakedId(binding.level));
  if (!url || (required === null && new URLSearchParams(location.search).has('nobake'))) return false; // ?nobake=1: A/B against the analytic field
  try {
    if (required !== null && !(url in publicBytes())) throw new Error('Required terrain is absent from the boot byte catalogue');
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status}`);
    const grid = parseBakedTerrain(await res.arrayBuffer());
    if (!grid || grid.seed !== (seed >>> 0)) throw new Error('bad header / seed');
    installBakedGrid(grid, binding);
    return true;
  } catch (e) {
    if (required !== null) throw e;
    console.warn(`[baked] terrain for ${levelId} not used (${e instanceof Error ? e.message : String(e)}); computing at launch`);
    return false;
  }
}
