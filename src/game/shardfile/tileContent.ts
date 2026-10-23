/**
 * Per-tile content (tile streaming T3, G652): what a resident world builds and keeps by its 62.5 m L0 tiles (the lattice of
 * `tileOrder.ts`), so a world draws and collides only the tiles around the player. Content is bucketed by position at
 * admission, never rebaked: a placement's copies by their pose, an instanced part's instances by their matrix, a node by
 * the centre of its bounds.
 *
 *   const buckets = bucketByTile(poses, pose => pose);              // tile key -> the copies' indices, in input order
 *   const ranges = tileRanges(matrices, 16, 12, 14);                 // instances sorted by tile, each tile's [start, count]
 *   const count = compactResident(ranges, ring(tileOf(x, z), 2), matrices, mesh.instanceMatrix.array, 16);
 *   mesh.count = count;                                               // one draw per part, only the resident tiles' copies
 *
 * A tile's key is `j * 8 + i` (row j along z, column i along x). Pure arithmetic: no three.js, no DOM.
 */
import type { Scope } from '@wildshard/engine/app/scope';
import { TILES_PER_SIDE, TILE_SIZE, tileOf, type CellTile } from './tileOrder';

/**
 * One installed world element by tile (the port the tile streamer drives, T4): the tiles it holds content in, and `attach`,
 * which builds one tile's content (its draws and colliders) under that tile's scope; the scope's end takes it away.
 */
export interface TileContent {
  readonly id: string;
  readonly tiles: () => ReadonlySet<number>;
  readonly attach: (tile: number, scope: Scope) => Promise<void>;
  /** the tile's colliders alone, when the element can register them apart from its draws (the collider ring, D2 B) */
  readonly attachColliders?: (tile: number, scope: Scope) => Promise<void>;
}

const TILES = TILES_PER_SIDE * TILES_PER_SIDE;
const HALF = (TILES_PER_SIDE * TILE_SIZE) / 2;

/** A tile's key (0 ... 63). */
export function tileKey(tile: CellTile): number { return tile.j * TILES_PER_SIDE + tile.i; }
/** The tile of a key. */
export function keyTile(key: number): CellTile {
  if (!Number.isInteger(key) || key < 0 || key >= TILES) throw new RangeError('Not a tile key');
  return { i: key % TILES_PER_SIDE, j: Math.floor(key / TILES_PER_SIDE) };
}

/** Bucket items by the tile of their cell-local position: tile key to the items' indices, in input order. */
export function bucketByTile<T>(items: readonly T[], at: (item: T) => { readonly x: number; readonly z: number }): Map<number, number[]> {
  const buckets = new Map<number, number[]>();
  items.forEach((item, index) => {
    const { x, z } = at(item), key = tileKey(tileOf(x, z)), list = buckets.get(key);
    if (list === undefined) buckets.set(key, [index]); else list.push(index);
  });
  return buckets;
}

/** Instances sorted by tile: `order[k]` is the source index of the k-th sorted instance; tile t owns `start[t]` ... `start[t] + count[t]`. */
export interface TileRanges { readonly order: Uint32Array; readonly start: Int32Array; readonly count: Int32Array }
/**
 * Sort `values` (one instance per `stride` floats, its cell-local x and z at `xAt` and `zAt`: a column-major matrix has
 * them at 12 and 14) by tile, keeping each tile's instances in their source order.
 */
export function tileRanges(values: ArrayLike<number>, stride: number, xAt: number, zAt: number): TileRanges {
  if (!Number.isInteger(stride) || stride < 1 || values.length % stride !== 0 || xAt >= stride || zAt >= stride) throw new RangeError('Instance stride differs');
  const n = values.length / stride, keys = new Int32Array(n), count = new Int32Array(TILES), start = new Int32Array(TILES);
  for (let k = 0; k < n; k++) {
    const key = tileKey(tileOf(values[k * stride + xAt] ?? 0, values[k * stride + zAt] ?? 0));
    keys[k] = key; count[key] = (count[key] ?? 0) + 1;
  }
  for (let t = 1; t < TILES; t++) start[t] = (start[t - 1] ?? 0) + (count[t - 1] ?? 0);
  const order = new Uint32Array(n), next = Int32Array.from(start);
  for (let k = 0; k < n; k++) { const key = keys[k] ?? 0, at = next[key] ?? 0; order[at] = k; next[key] = at + 1; }
  return { order, start, count };
}

/**
 * Write the resident tiles' instances (`itemSize` floats each, read from `source` in its own order) to the front of
 * `target`, tile by tile in key order; returns how many were written (the instanced draw's count).
 */
export function compactResident(ranges: TileRanges, resident: ReadonlySet<number>, source: ArrayLike<number>, target: { [index: number]: number; readonly length: number }, itemSize: number): number {
  let written = 0;
  for (let t = 0; t < TILES; t++) {
    if (!resident.has(t)) continue;
    const from = ranges.start[t] ?? 0, n = ranges.count[t] ?? 0;
    for (let k = from; k < from + n; k++) {
      const index = ranges.order[k] ?? 0;
      if ((written + 1) * itemSize > target.length) throw new RangeError('Resident instances exceed the target');
      for (let c = 0; c < itemSize; c++) target[written * itemSize + c] = source[index * itemSize + c] ?? 0;
      written++;
    }
  }
  return written;
}

/** The tiles within `radius` tiles (Chebyshev) of `centre`, clipped to the cell; radius 8 or more is the whole cell. */
export function ring(centre: CellTile, radius: number): Set<number> {
  if (!Number.isInteger(radius) || radius < 0) throw new RangeError('A ring radius is a whole number of tiles');
  const keys = new Set<number>();
  for (let j = Math.max(0, centre.j - radius); j <= Math.min(TILES_PER_SIDE - 1, centre.j + radius); j++)
    for (let i = Math.max(0, centre.i - radius); i <= Math.min(TILES_PER_SIDE - 1, centre.i + radius); i++) keys.add(tileKey({ i, j }));
  return keys;
}

/**
 * The tile the rings centre on as the player moves: it changes only once the player is `hysteresis` metres inside
 * another tile, so walking along a tile edge never flips the resident set back and forth.
 */
export function followTile(current: CellTile | null, x: number, z: number, hysteresis = 4): CellTile {
  const next = tileOf(x, z);
  if (current === null || (next.i === current.i && next.j === current.j)) return next;
  const left = -HALF + next.i * TILE_SIZE, bottom = -HALF + next.j * TILE_SIZE;
  const inside = Math.min(x - left, left + TILE_SIZE - x, z - bottom, bottom + TILE_SIZE - z);
  // a step across the cell's own edge (a clamped point) always moves
  const clamped = Math.abs(x) >= HALF || Math.abs(z) >= HALF;
  return inside >= hysteresis || clamped ? next : current;
}

/** The tiles a square footprint (`x`, `z` ± `reach` metres) touches, clipped to the cell. */
export function tilesTouching(x: number, z: number, reach: number): number[] {
  const lo = tileOf(x - reach, z - reach), hi = tileOf(x + reach, z + reach), keys: number[] = [];
  for (let j = lo.j; j <= hi.j; j++) for (let i = lo.i; i <= hi.i; i++) keys.push(tileKey({ i, j }));
  return keys;
}

/** What a collider row needs for its footprint: its point and its shape's extents (`ColliderDesc`, structurally). */
type ColliderFootprint =
  | { readonly kind: 'box'; readonly x: number; readonly z: number; readonly hx: number; readonly hy: number; readonly hz: number }
  | { readonly kind: 'capsule'; readonly x: number; readonly z: number; readonly halfHeight: number; readonly radius: number }
  | { readonly kind: 'ball'; readonly x: number; readonly z: number; readonly radius: number }
  | { readonly kind: 'hull'; readonly x: number; readonly z: number; readonly points: ArrayLike<number> }
  | { readonly kind: 'trimesh'; readonly x: number; readonly z: number; readonly vertices: ArrayLike<number> }
  | { readonly kind: 'treads'; readonly from: { readonly x: number; readonly y: number; readonly z: number }; readonly to: { readonly x: number; readonly y: number; readonly z: number }; readonly width: number };

const reachOf = (points: ArrayLike<number>): number => {
  let reach = 0;
  for (let k = 0; k + 2 < points.length; k += 3) reach = Math.max(reach, Math.hypot(points[k] ?? 0, points[k + 2] ?? 0));
  return reach;
};
/**
 * Tile streaming T3 (the collider ring): every tile a collider's footprint reaches (conservatively: its point ± its largest
 * horizontal extent, any rotation), so a collider straddling a tile edge stands in each tile it reaches: a ring never has a
 * gap at its edge. Pure.
 */
export function colliderTileKeys(row: ColliderFootprint): number[] {
  if (row.kind === 'box') return tilesTouching(row.x, row.z, Math.hypot(row.hx, row.hy, row.hz));
  if (row.kind === 'capsule') return tilesTouching(row.x, row.z, row.radius + row.halfHeight);
  if (row.kind === 'ball') return tilesTouching(row.x, row.z, row.radius);
  if (row.kind === 'hull') return tilesTouching(row.x, row.z, reachOf(row.points));
  if (row.kind === 'trimesh') return tilesTouching(row.x, row.z, reachOf(row.vertices));
  const { from, to } = row;
  return tilesTouching((from.x + to.x) / 2, (from.z + to.z) / 2, Math.hypot(to.x - from.x, to.z - from.z) / 2 + row.width / 2);
}

/**
 * One build per tile shared by every hold on it (tile streaming T3: a tile's draws for the render ring and its colliders for
 * the collider ring come from one build of its copies): the first hold builds under its own child of `owner`, each hold
 * ends with its scope, and the build is disposed when the last hold ends.
 */
export class SharedTileBuilds<T> {
  private readonly builds = new Map<number, { readonly scope: Scope; readonly built: Promise<T>; holds: number }>();
  constructor(private readonly owner: Scope, private readonly build: (tile: number, scope: Scope) => Promise<T>) {}
  /** The tiles built now (tests read them). */
  get tiles(): ReadonlySet<number> { return new Set(this.builds.keys()); }
  hold(tile: number, scope: Scope): Promise<T> {
    let entry = this.builds.get(tile);
    if (entry === undefined) {
      const child = this.owner.child(`tile.build.${String(tile)}`);
      entry = { scope: child, built: this.build(tile, child), holds: 0 };
      this.builds.set(tile, entry);
    }
    const held = entry;
    held.holds++;
    scope.onDispose(() => {
      held.holds--;
      if (held.holds > 0 || this.builds.get(tile) !== held) return;
      this.builds.delete(tile); held.scope.dispose();
    });
    return held.built;
  }
}
