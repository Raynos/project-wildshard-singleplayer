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
/** Trail polylines (xz). The first four enter at the edge midpoints. */
export let TRAILS: ChunkTerrain['trails'] = T.trails;
export let CABIN_SITES: ChunkTerrain['cabinSites'] = T.cabinSites;
/** The chunk's pond (r = 0 when it has none — check `hasPond()`). */
export let POND: PondDef = T.pond ?? NO_POND;

export function hasPond(): boolean { return T.pond !== null; }

onActiveChunkChange((def) => {
  T = def.terrain;
  heightAt = T.heightAt; normalAt = T.normalAt; splatAt = T.splatAt;
  trailDistance = T.trailDistance; cabinMask = T.cabinMask; pondMask = T.pondMask; waterLevel = T.waterLevel;
  TRAILS = T.trails; CABIN_SITES = T.cabinSites; POND = T.pond ?? NO_POND;
});

export function inChunk(x: number, z: number, margin = 0) {
  return Math.abs(x) <= CHUNK_HALF - margin && Math.abs(z) <= CHUNK_HALF - margin;
}
