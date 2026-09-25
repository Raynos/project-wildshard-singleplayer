// The chunk's terrain shape. Pure functions so the same field drives the mesh,
// player collision, tree placement and grass.
//
// Since the multi-shard refactor the actual field lives in the active ChunkDef
// (src/chunks/*.ts, compiled by src/chunks/terrain.ts); this module re-exports it under the
// names every consumer already imports. The exports are live `let` bindings resolved once here
// and again on setActiveChunk() — no per-call lookup, so heightAt() stays as cheap as before.
import { CHUNK_HALF } from '../core/config';
import { getActiveChunk, onActiveChunkChange } from '../chunks/registry';
import type { ChunkTerrain, PondDef } from '../chunks/ChunkDef';
import { shardSlot } from '../core/shardState';

const NO_POND: PondDef = { x: 0, z: 0, r: 0 };

let T: ChunkTerrain = getActiveChunk().terrain;

/** surface height, metres */
export let heightAt: ChunkTerrain['heightAt'] = T.heightAt;
/** unit surface normal by central differences */
export let normalAt: ChunkTerrain['normalAt'] = T.normalAt;
/** splat weights for the four ground layers of the active chunk */
export let splatAt: ChunkTerrain['splatAt'] = T.splatAt;
/** distance to the nearest trail centreline */
export let trailDistance: ChunkTerrain['trailDistance'] = T.trailDistance;
/** 0 off the cabin pads → 1 on them */
export let cabinMask: ChunkTerrain['cabinMask'] = T.cabinMask;
/** 0 outside the pond basin → 1 at its centre */
export let pondMask: ChunkTerrain['pondMask'] = T.pondMask;
/** still-water surface height (far below the terrain when the chunk has no pond) */
export let waterLevel: ChunkTerrain['waterLevel'] = T.waterLevel;
const noStream = (): number | null => null;
/** running water's surface at (x, z) (Pine Hollow's creek), or null off it */
export let streamAt: NonNullable<ChunkTerrain['streamAt']> = T.streamAt ?? noStream;
/** Trail polylines (xz). The first four enter at the edge midpoints. */
export let TRAILS: ChunkTerrain['trails'] = T.trails;
export let CABIN_SITES: ChunkTerrain['cabinSites'] = T.cabinSites;
/** The chunk's pond (r = 0 when it has none — check `hasPond()`). */
export let POND: PondDef = T.pond ?? NO_POND;

export function hasPond(): boolean { return T.pond !== null; }

onActiveChunkChange((def) => {
  T = def.terrain;
  heightAt = T.heightAt; normalAt = T.normalAt; splatAt = T.splatAt;
  trailDistance = T.trailDistance; cabinMask = T.cabinMask; pondMask = T.pondMask; waterLevel = T.waterLevel; streamAt = T.streamAt ?? noStream;
  TRAILS = T.trails; CABIN_SITES = T.cabinSites; POND = T.pond ?? NO_POND;
});

/**
 * The baked grid (src/world/BakedTerrain.ts, public/assets/baked/<slug>/terrain.bin) replaces the
 * analytic field with lookups over the terrain mesh's own vertices — the same numbers the mesh is
 * built from, so collision and planting sit exactly on the rendered surface. setActiveChunk()
 * rebinds the analytic functions again (the next chunk's bake is installed when it loads).
 */
export function _installBakedTerrain(baked: Pick<ChunkTerrain, 'heightAt' | 'normalAt' | 'splatAt'>): void {
  heightAt = baked.heightAt; normalAt = baked.normalAt; splatAt = baked.splatAt;
}

export function inChunk(x: number, z: number, margin = 0): boolean {
  return Math.abs(x) <= CHUNK_HALF - margin && Math.abs(z) <= CHUNK_HALF - margin;
}

// E155 (src/core/shardState.ts): the running shard's terrain — its def's samplers, or its installed bake (setActiveChunk
// rebinds the def's; the shard host then puts the running shard's own set back, bake included)
shardSlot('heightfield', () => ({ T, heightAt, normalAt, splatAt, trailDistance, cabinMask, pondMask, waterLevel, streamAt, TRAILS, CABIN_SITES, POND }),
  (s) => { ({ T, heightAt, normalAt, splatAt, trailDistance, cabinMask, pondMask, waterLevel, streamAt, TRAILS, CABIN_SITES, POND } = s); });
