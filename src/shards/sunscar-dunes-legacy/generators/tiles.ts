import { buildTerrain } from '@wildshard/engine/world/terrainField';
import { bakeTerrain, type BakedTerrain } from '@wildshard/sdk/bake/terrain';
import { SEED, TRAIL } from '../data/layout';
import { duneHeight } from '../world/dunes';
import { SIGNAL_DUNES_MINIMAP } from '../look/minimap';

/** The lattice step of the 257² bake (500 m / 256). */
const STEP = 500 / 256;
const linear = (c: number): number => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const unit = (c: number): number => Math.max(0, Math.min(1, Number.isFinite(c) ? c : 0));

/** The manifest's own dune field (entry roads and graded trails included): the ground every Signal bake reads. */
export const signalDunesField = (): ReturnType<typeof buildTerrain> => buildTerrain(SEED, { landscape: duneHeight, trails: TRAIL, cabinSites: [] });

/**
 * SHARD-PLATFORM M3 (G227, "the shardfile is the bake"): Signal Dunes' code-built heightfield compiled into the shardfile's
 * 62.5 m terrain tiles (64 L0 + 16 L1 and the 257² critical collider; `@wildshard/sdk/bake/terrain`). The heights are the
 * manifest's own field (`buildTerrain(SEED, { landscape: duneHeight, trails: TRAIL })`, entry roads and graded trails
 * included), so the tiles, the collider and the edge rows read exactly the ground the runtime builds today. The vertex
 * colours are the map palette's ground ramp in linear (the colours the grid's legacy edge reader painted the seams in,
 * progress/shard-platform/sf50/edges.mjs). The family is the manifest's `kitLook` (`pbr`), a platform default only: the
 * runtime binds the tiles (`runtime.binds: ['terrain']`) and draws them in its own sand; the data client draws none of them. Run by `scripts/bake-hybrid-tiles.mjs`.
 */
export function signalDunesTiles(): BakedTerrain {
  const field = signalDunesField();
  const rgb: [number, number, number] = [0, 0, 0];
  const baked = bakeTerrain({ heightAt: field.heightAt, family: 'pbr', colourAt: (x, z, h) => {
    const slope = Math.min(1, Math.hypot(field.heightAt(x + STEP, z) - field.heightAt(x - STEP, z), field.heightAt(x, z + STEP) - field.heightAt(x, z - STEP)) / (2 * STEP) / 2);
    SIGNAL_DUNES_MINIMAP.ground(x, z, h, slope, 0, rgb);
    const scale = Math.max(...rgb) > 1 ? 255 : 1;
    return [unit(linear(rgb[0] / scale)), unit(linear(rgb[1] / scale)), unit(linear(rgb[2] / scale))];
  } });
  // the product's canonical order (buildProject sorts tiles by lod, x, z and files by hash), so the declaration is the product
  baked.tiles.sort((a, b) => a.lod - b.lod || a.x - b.x || a.z - b.z); baked.files.sort((a, b) => a.hash.localeCompare(b.hash));
  return baked;
}
