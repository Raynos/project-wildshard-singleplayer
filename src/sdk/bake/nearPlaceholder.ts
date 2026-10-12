import { MeshoptSimplifier } from 'meshoptimizer/simplifier';

/**
 * G342's near-placeholder producer: a shard's drawn static world (its own authored build, harvested in Node by
 * `scripts/bake/near-placeholder.mjs`) reduced to a low-LOD, render-only set of parts inside a triangle budget. Each
 * prototype is welded and simplified once, then placed at every instance; the copies are grouped by the 125 m region
 * (x + 4z, the render rings' numbering) their origin stands in, so a region refined by L1 / L0 tiles hides exactly its
 * own props. Tiny dressing (under `minSize` metres) is dropped: from a neighbour's road it is sub-pixel. No colliders.
 */
export interface NearPrototype {
  readonly name: string;
  /** model-space positions and linear RGB, per vertex */
  readonly positions: Float32Array; readonly colours: Float32Array; readonly index: Uint32Array;
  /** column-major 4 × 4 cell-local matrices, one per placed copy */
  readonly transforms: readonly (readonly number[])[];
}
/** One region's merged copies: cell-local metres, linear RGB, indexed (the far proxy's part shape). */
export interface NearPart { readonly positions: Float32Array; readonly colours: Float32Array; readonly index: Uint32Array }
/**
 * How `nearPlaceholderParts` reduces a shard's harvested world: the cell-wide content triangle budget the prototypes
 * share (each is simplified by one common ratio, bisected to fit), the cell half-size that clips copies leaving the cell,
 * the smallest copy worth keeping from a neighbour's road, and the floor a kept prototype is never simplified below.
 */
export interface NearPlaceholderOptions {
  /** content triangle budget for the whole cell */
  readonly triangles: number;
  /** cell half-size (m); copies that leave the cell are dropped */
  readonly half: number;
  /** smallest copy (bounding-box diagonal, m) worth keeping */
  readonly minSize?: number;
  /** fewest triangles a kept prototype is simplified to */
  readonly minTriangles?: number;
}
/**
 * What a near-placeholder reduction kept and dropped, for the bake's `--report`: each kept prototype with its placed
 * copies and its triangles after / before simplification, each dropped one with why (malformed, a two-triangle card,
 * every copy too small, or outside the cell), and the content triangles the parts carry in all.
 */
export interface NearPlaceholderReport { readonly kept: { name: string; copies: number; triangles: number; source: number }[]; readonly dropped: { name: string; why: string }[]; readonly triangles: number }

const REGIONS = 4;

function weld(p: NearPrototype): { positions: Float32Array; colours: Float32Array; index: Uint32Array } {
  const key = new Map<string, number>(), pos: number[] = [], sum: number[] = [], count: number[] = [], slot = new Uint32Array(p.positions.length / 3);
  for (let v = 0; v < slot.length; v++) {
    const x = p.positions[v * 3] ?? 0, y = p.positions[v * 3 + 1] ?? 0, z = p.positions[v * 3 + 2] ?? 0, k = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
    let s = key.get(k);
    if (s === undefined) { s = count.length; key.set(k, s); pos.push(x, y, z); sum.push(0, 0, 0); count.push(0); }
    slot[v] = s; sum[s * 3] = (sum[s * 3] ?? 0) + (p.colours[v * 3] ?? 0); sum[s * 3 + 1] = (sum[s * 3 + 1] ?? 0) + (p.colours[v * 3 + 1] ?? 0);
    sum[s * 3 + 2] = (sum[s * 3 + 2] ?? 0) + (p.colours[v * 3 + 2] ?? 0); count[s] = (count[s] ?? 0) + 1;
  }
  const index = Uint32Array.from(p.index, i => slot[i] ?? 0);
  return { positions: Float32Array.from(pos), colours: Float32Array.from(sum, (c, i) => c / (count[Math.floor(i / 3)] ?? 1)), index };
}

function simplify(mesh: { positions: Float32Array; index: Uint32Array }, triangles: number): Uint32Array {
  if (mesh.index.length / 3 <= triangles) return mesh.index;
  // no pruning: a palm's fronds and a tree's needles are small loose pieces, and they are its silhouette
  const target = triangles * 3, [kept] = MeshoptSimplifier.simplify(mesh.index, mesh.positions, 3, target, 1);
  if (kept.length <= target * 1.15 && kept.length > 0) return kept;
  const [sloppy] = MeshoptSimplifier.simplifySloppy(mesh.index, mesh.positions, 3, null, target, 1);
  return sloppy.length > 0 ? sloppy : kept.length > 0 ? kept : mesh.index;
}

const apply = (m: readonly number[], x: number, y: number, z: number): [number, number, number] => [
  (m[0] ?? 0) * x + (m[4] ?? 0) * y + (m[8] ?? 0) * z + (m[12] ?? 0),
  (m[1] ?? 0) * x + (m[5] ?? 0) * y + (m[9] ?? 0) * z + (m[13] ?? 0),
  (m[2] ?? 0) * x + (m[6] ?? 0) * y + (m[10] ?? 0) * z + (m[14] ?? 0)];

/** Reduce harvested prototypes to region-grouped parts inside the budget. Deterministic for the same input order. */
export async function nearPlaceholderParts(prototypes: readonly NearPrototype[], options: NearPlaceholderOptions): Promise<{ parts: NearPart[]; report: NearPlaceholderReport }> {
  await MeshoptSimplifier.ready;
  const { half } = options, minSize = options.minSize ?? 1.2, minTriangles = options.minTriangles ?? 6;
  if (!Number.isFinite(options.triangles) || options.triangles <= 0 || !Number.isFinite(half) || half <= 0) throw new RangeError('Invalid near-placeholder budget');
  const dropped: { name: string; why: string }[] = [];
  const live: { name: string; mesh: ReturnType<typeof weld>; copies: (readonly number[])[]; source: number }[] = [];
  for (const p of prototypes) {
    if (p.positions.length % 3 !== 0 || p.colours.length !== p.positions.length || p.index.length % 3 !== 0 || p.index.length === 0) { dropped.push({ name: p.name, why: 'malformed' }); continue; }
    // a two-triangle card is a sprite (a decal, an impostor, a light shaft): untextured it draws as a grey slab
    if (p.index.length <= 6) { dropped.push({ name: p.name, why: 'card' }); continue; }
    const copies: (readonly number[])[] = [];
    let small = 0;
    for (const m of p.transforms) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (let v = 0; v < p.positions.length; v += 3) {
        const [x, y, z] = apply(m, p.positions[v] ?? 0, p.positions[v + 1] ?? 0, p.positions[v + 2] ?? 0);
        minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
      }
      if (!Number.isFinite(minX) || minX < -half || maxX > half || minZ < -half || maxZ > half) continue;
      if (Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) < minSize) { small++; continue; }
      copies.push(m);
    }
    if (copies.length === 0) { dropped.push({ name: p.name, why: small > 0 ? 'small' : 'outside' }); continue; }
    live.push({ name: p.name, mesh: weld(p), copies, source: p.index.length / 3 });
  }
  // one scale for every prototype's share of its own triangles, bisected to the budget
  const total = (s: number): number => live.reduce((sum, l) => sum + Math.min(l.source, Math.max(minTriangles, Math.floor(l.source * s))) * l.copies.length, 0);
  let lo = 0, hi = 1;
  if (total(1) > options.triangles) { for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; if (total(mid) <= options.triangles) lo = mid; else hi = mid; } } else lo = 1;
  const regions = Array.from({ length: REGIONS * REGIONS }, () => ({ positions: [] as number[], colours: [] as number[], index: [] as number[] }));
  const kept: NearPlaceholderReport['kept'] = [];
  let triangles = 0;
  const size = (2 * half) / REGIONS, cell = (u: number): number => Math.min(REGIONS - 1, Math.max(0, Math.floor((u + half) / size)));
  for (const l of live) {
    const want = Math.min(l.source, Math.max(minTriangles, Math.floor(l.source * lo)));
    const index = simplify(l.mesh, want), used = new Map<number, number>(), order: number[] = [];
    for (const i of index) if (!used.has(i)) { used.set(i, order.length); order.push(i); }
    const local = Uint32Array.from(index, i => used.get(i) ?? 0);
    for (const m of l.copies) {
      const region = regions[cell(m[12] ?? 0) + cell(m[14] ?? 0) * REGIONS];
      if (region === undefined) continue;
      const base = region.positions.length / 3;
      for (const i of order) {
        const [x, y, z] = apply(m, l.mesh.positions[i * 3] ?? 0, l.mesh.positions[i * 3 + 1] ?? 0, l.mesh.positions[i * 3 + 2] ?? 0);
        region.positions.push(Math.min(half, Math.max(-half, x)), y, Math.min(half, Math.max(-half, z)));
        region.colours.push(l.mesh.colours[i * 3] ?? 0, l.mesh.colours[i * 3 + 1] ?? 0, l.mesh.colours[i * 3 + 2] ?? 0);
      }
      for (const i of local) region.index.push(base + i);
    }
    triangles += (local.length / 3) * l.copies.length;
    kept.push({ name: l.name, copies: l.copies.length, triangles: local.length / 3, source: l.source });
  }
  const parts = regions.filter(r => r.index.length > 0).map(r => ({ positions: Float32Array.from(r.positions), colours: Float32Array.from(r.colours), index: Uint32Array.from(r.index) }));
  return { parts, report: { kept, dropped, triangles } };
}
