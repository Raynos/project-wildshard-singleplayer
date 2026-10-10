/**
 * The beaver pool's two water meshes laid out (E322 F-L6; G285: an offline bake). Build-time only:
 * `src/shards/pine-hollow/generators/bake-pine-beaver-pool.mjs` runs `bakeBeaverPool` over Pine Hollow's baked terrain (the page's own grid) and
 * writes both meshes' blocks to `../data/beaverPool.json`; the page builds the meshes from them (../world/beaverPool.ts)
 * and never runs this. test/shards/pine-hollow/beaver-pool-bake.test.ts is the stale gate.
 *
 *   · `still`: the pool's surface on the pond surface's own grid (../world/pond.ts `pondGrid`) over exactly the cells the
 *     pond leaves out, in the pool's reach and not always above its water, with the ground under each vertex (the page
 *     re-lays each vertex at the draining level against it).
 *   · `trickle`: a narrow running ribbon down the bed's channel, riffle to sluice, a few cm over the bed.
 */
import { smoothstep } from '@wildshard/engine/core/noise';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { pondGrid } from '../world/pond';
import { BEAVER_POOL, CREEK, CREEK_WATER, creekBedAt, creekSpan, inBeaverPool, type XZ } from '../layout';
import type { PoolRows } from '../world/beaverPool';

/** the trickle's across-channel offsets (m) and its depth code there (0 at the edges: they fade into the mud) */
const TRICKLE_ACROSS = [-0.9, -0.45, 0, 0.45, 0.9];
const TRICKLE_DEPTH = [0, 0.07, 0.11, 0.07, 0];

/** a block as the page's Float32 attribute will hold it (f32-exact numbers) */
const f32 = (a: readonly number[]): number[] => a.map((v) => Math.fround(v));

/** the creek's polyline point and unit direction at arc length `s` */
function creekAt(s: number): { x: number; z: number; tx: number; tz: number } {
  let acc = 0;
  for (let i = 0; i + 1 < CREEK.length; i++) {
    const a: XZ | undefined = CREEK[i], b: XZ | undefined = CREEK[i + 1];
    if (!a || !b) continue;
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (s <= acc + l || i + 2 === CREEK.length) {
      const u = l > 0 ? (s - acc) / l : 0;
      return { x: a[0] + (b[0] - a[0]) * u, z: a[1] + (b[1] - a[1]) * u, tx: (b[0] - a[0]) / (l || 1), tz: (b[1] - a[1]) / (l || 1) };
    }
    acc += l;
  }
  return { x: 0, z: 0, tx: 0, tz: 1 };
}

/** the pool's cells on the pond surface's grid: those whose centre is in the pool's reach and not always above the water */
function still(): PoolRows['still'] {
  const { cell, x0, z0 } = pondGrid(), P = BEAVER_POOL, { dam } = creekSpan();
  // the reach's bounding box, from the creek's line ± 12 m
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let s = P.riffle; s <= dam; s += 1) {
    const c = creekAt(s);
    minX = Math.min(minX, c.x - 12); maxX = Math.max(maxX, c.x + 12); minZ = Math.min(minZ, c.z - 12); maxZ = Math.max(maxZ, c.z + 12);
  }
  const i0 = Math.floor((minX - x0) / cell), i1 = Math.ceil((maxX - x0) / cell);
  const j0 = Math.floor((minZ - z0) / cell), j1 = Math.ceil((maxZ - z0) / cell);
  const cols = i1 - i0 + 1;
  const vid = new Map<number, number>(), pos: number[] = [], uv: number[] = [], aw: number[] = [], ground: number[] = [], idx: number[] = [];
  const vert = (i: number, j: number): number => {
    const key = (j - j0) * cols + (i - i0);
    const had = vid.get(key);
    if (had !== undefined) return had;
    const x = x0 + i * cell, z = z0 + j * cell, h = heightAt(x, z), k = ground.length;
    pos.push(x, P.full, z); uv.push(x, z); aw.push(P.full - h, 0, 0, 2.4);   // still, peaty like the pond: 2.4 / m
    ground.push(h);
    vid.set(key, k);
    return k;
  };
  for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) {
    if (!inBeaverPool(x0 + (i + 0.5) * cell, z0 + (j + 0.5) * cell)) continue;
    const hs = [heightAt(x0 + i * cell, z0 + j * cell), heightAt(x0 + (i + 1) * cell, z0 + j * cell), heightAt(x0 + i * cell, z0 + (j + 1) * cell), heightAt(x0 + (i + 1) * cell, z0 + (j + 1) * cell)];
    if (hs.every((h) => h > P.full + 0.45)) continue;                    // under the bank at every level: never seen
    const a = vert(i, j), b = vert(i + 1, j), c = vert(i, j + 1), d = vert(i + 1, j + 1);
    idx.push(a, c, b, b, c, d);                                           // wound as the pond's
  }
  return { position: f32(pos), uv: f32(uv), aWater: f32(aw), ground: f32(ground), index: idx };
}

/** the trickle: the channel's line from the riffle's crest to under the dam, a few cm over the bed, tumbling off the riffle */
function trickle(): PoolRows['trickle'] {
  const P = BEAVER_POOL, { dam } = creekSpan(), end = dam - CREEK_WATER.lead + 0.4, speed = 0.45;
  const pos: number[] = [], uv: number[] = [], aw: number[] = [], idx: number[] = [];
  let rows = 0;
  for (let s = P.riffle - 0.6; s <= end + 1e-6; s += 0.5) {
    const c = creekAt(s), lx = -c.tz, lz = c.tx;
    const foam = 0.12 + 0.4 * (1 - smoothstep(P.riffle, P.riffle + 2.5, s)) * smoothstep(P.riffle - 0.6, P.riffle, s);
    TRICKLE_ACROSS.forEach((o, k) => {
      const x = c.x + lx * o, z = c.z + lz * o, h = heightAt(x, z);
      pos.push(x, Math.max(h + 0.04, creekBedAt(s) + 0.04), z);
      uv.push(o, s / speed);                                              // travel time: the ripples ride the flow
      aw.push(TRICKLE_DEPTH[k] ?? 0, 1, foam, 2.0);                       // running, tea-brown like the creek
    });
    rows++;
  }
  const cols = TRICKLE_ACROSS.length;
  for (let r = 0; r + 1 < rows; r++) for (let c = 0; c + 1 < cols; c++) {
    const a = r * cols + c, b = a + 1, d = a + cols, e = d + 1;
    idx.push(a, b, d, b, e, d);
  }
  return { position: f32(pos), uv: f32(uv), aWater: f32(aw), index: idx };
}

/** The bake: both meshes' blocks over the page's ground. */
export function bakeBeaverPool(): PoolRows { return { still: still(), trickle: trickle() }; }
