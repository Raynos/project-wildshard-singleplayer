import type { BufferGeometry } from 'three';
import { buildFarProxy, type FarGrid, type FarLookRuntime, type FarLookSource, type FarPart } from '../grid/farProxy';
import { farProxyGeometry } from '../grid/farView';

/**
 * G348 (Jake: the near and far placeholders are generic for any shard the MMO loads): the one placeholder mesh the bakes
 * build, for the SDK build (`wildshard build`, `@wildshard/sdk/bake/placeholders`) and the repo's bake runners alike.
 * A far proxy and a near placeholder are the same single-draw shape (4 × 4 regions in TEXCOORD_0.x, skirts, the cell's
 * cliff face, the shard's look in vertex colours); the near one is denser, carries the shard's own world as parts and
 * reduces its ground by geometric error. Node-safe; nothing here knows a shard.
 */
/** A height grid as `terrain.bin` or a shardfile terrain collider holds it (res² heights over size metres, 4 splat bytes per vertex). */
export type PlaceholderGrid = FarGrid;
/** A shard's far look (its palette by height, slope and splat; its haze, cliff and grade), authored in its folder. */
export type PlaceholderLook = FarLookSource;
/** What the runtime reads beside the mesh (`far.json` / `near.json`'s `look`). */
export type PlaceholderLookRuntime = FarLookRuntime;
/** A model merged into the placeholder: cell-local metres and linear RGB per vertex, indexed. */
export type PlaceholderPart = FarPart;

/**
 * The placeholder geometry: the grid in the look, plus parts, refused over `cap` triangles (default the far cap).
 * `reduce` reduces each region's ground lattice (the near placeholder's geometric-error ground).
 */
export function placeholderGeometry(grid: PlaceholderGrid, look: PlaceholderLook, parts: readonly PlaceholderPart[] = [], cap?: number,
  reduce?: (positions: Float32Array, index: Uint32Array) => Uint32Array): BufferGeometry {
  return farProxyGeometry(buildFarProxy(grid, look, parts, cap, reduce));
}
