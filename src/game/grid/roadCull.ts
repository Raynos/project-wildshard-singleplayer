/**
 * The road system's per-view budget (SHARD-PLATFORM SF17b, §3.2 road targets, G101): ≤ 60k triangles drawn and ≤ 8 draws in
 * any view, shadow draws included, while the collider keeps full resolution.
 *
 * Every road material is ONE mesh for the whole platform, so a view costs one draw per material whatever it sees. Its index
 * buffer is sorted into spatial bins (squares of half a pitch, centred on the junctions and the segment middles), each with
 * a bounding sphere over its own triangles. Before the mesh draws, the bins inside the camera's frustum are copied into the
 * front of a dynamic index buffer and the draw range shrinks to them: one ordinary indexed draw of only what the view can
 * see. No multi-draw and no BatchedMesh (E271 / E272): it is a plain `drawElements` with an index range uploaded with
 * `bufferSubData`, and only when the visible set changes. A triangle is drawn whenever its bin's sphere meets the frustum
 * and the sphere bounds the triangle, so nothing in view is ever culled.
 *
 * Pure three.js (no DOM), so Node tests pin the per-view numbers.
 */
import { CHUNK_HALF } from '@wildshard/engine/core/config';
import { gpuOnlyAttributes, gpuOnlyTexture } from '@wildshard/engine/core/gpuOnly';
import { BufferAttribute, type BufferGeometry, type Camera, DoubleSide, DynamicDrawUsage, Frustum, InstancedMesh, type Material, Matrix4, Mesh, type Object3D, Sphere, type Texture, Vector3 } from 'three';
import type { PlatformRenderBytePlan } from './renderResidency';

/** Drain ordered road construction without yielding (the synchronous/native callers). */
export function finishRoadSteps<T>(steps: Generator<void, T>): T {
  for (;;) { const next = steps.next(); if (next.done === true) return next.value; }
}

/** One bin: its sphere (in the mesh's local frame) and its run of the sorted source index. */
interface CullBin { readonly sphere: Sphere; readonly start: number; readonly count: number; readonly levels: readonly { readonly start: number; readonly count: number }[] }
/** A culled mesh's bins and its full, bin-sorted index (kept on the CPU to rebuild the drawn range from); past each LOD
 *  tier's distance a bin draws that tier's coarse run. */
export interface CullPlan { readonly source: Uint32Array; readonly bins: readonly CullBin[]; readonly lod: readonly number[] }
/** A far-bin LOD tier: past `distance` metres a bin draws a copy clustered on a `cell`-metre lattice. */
export interface CullLod { readonly distance: number; readonly cell: number }
/** The deck's far LOD tiers, nearest first (render only; the collider is the generator's full mesh). */
export const ROAD_LOD: readonly CullLod[] = [{ distance: 150, cell: 4 }, { distance: 450, cell: 12 }];

const BIN_DIVISOR = 2;
/** A cell edge's distance from its cell centre (the seam's outer row meets the shard's own ground there). */
const CELL_EDGE = CHUNK_HALF;
/** The bin a point falls in: squares of `pitch / BIN_DIVISOR` (half a pitch), centred on multiples of it (junctions, segment middles, cell middles). */
export function cullBin(x: number, z: number, pitch: number): string { const s = pitch / BIN_DIVISOR; return `${String(Math.round(x / s))},${String(Math.round(z / s))}`; }

/**
 * Split (for drawing only) every triangle that crosses a bin edge, so each bin's sphere stays inside its square: the
 * generator's adaptive lattice lays flat road runs as triangles a whole segment long. A new vertex sits on the cut edge with
 * every attribute interpolated linearly, so the drawn surface, its colours, normals and uvs are exactly the old ones. The
 * collider is the generator's own mesh and never sees this.
 */
export function clipToBins(geometry: BufferGeometry, pitch: number): void { finishRoadSteps(clipToBinsSteps(geometry, pitch)); }

/** The same attribute interpolation and index order, yielding between bounded triangle/copy batches. */
export function* clipToBinsSteps(geometry: BufferGeometry, pitch: number): Generator<void> {
  const index = geometry.getIndex(), names = Object.keys(geometry.attributes);
  if (index === null || index.count === 0) return;
  const attrs = names.map((name) => geometry.getAttribute(name)), sizes = attrs.map((a) => a.itemSize), stride = sizes.reduce((a, b) => a + b, 0);
  const count = attrs[0]?.count ?? 0;
  const read = (n: number): Float64Array => {
    const v = new Float64Array(stride); let o = 0;
    attrs.forEach((a, k) => { for (let c = 0; c < (sizes[k] ?? 0); c++) v[o + c] = a.array[n * (sizes[k] ?? 0) + c] ?? 0; o += sizes[k] ?? 0; });
    return v;
  };
  const at = names.indexOf('position'), px = at === -1 ? 0 : sizes.slice(0, at).reduce((a, b) => a + b, 0);
  const { extra, out } = yield* clipCore(index.count / 3, (i) => index.getX(i), count, stride, px, read, pitch);
  if (extra.length === 0) return;
  const total = count + extra.length / stride;
  let o = 0;
  for (const [k, name] of names.entries()) {
    const a = attrs[k], size = sizes[k] ?? 0; if (a === undefined) continue;
    const array = new Float32Array(total * size);
    for (let i = 0; i < count * size; i++) { if (i % 4096 === 0) yield; array[i] = a.array[i] ?? 0; }
    for (let n = 0; n < extra.length / stride; n++) { if (n % 256 === 0) yield; for (let c = 0; c < size; c++) array[(count + n) * size + c] = extra[n * stride + o + c] ?? 0; }
    geometry.setAttribute(name, new BufferAttribute(array, size)); o += size;
  }
  geometry.setIndex(new BufferAttribute(Uint32Array.from(out), 1));
}

/**
 * The clip's arithmetic, shared by `clipToBins` and the byte plan (`cullCounts`): each triangle cut along the bin lines on
 * x then z, a new vertex interpolating all `stride` values linearly (position at `px`). A plan that reads only positions
 * gets exactly the builder's positions, new vertices and triangles: every value interpolates on its own.
 */
function* clipCore(triangles: number, indexAt: (i: number) => number, count: number, stride: number, px: number, read: (n: number) => Float64Array, pitch: number): Generator<void, { extra: number[]; out: number[] }> {
  const s = pitch / BIN_DIVISOR, extra: number[] = [], out: number[] = [];
  const add = (v: Float64Array): number => { for (const x of v) extra.push(x); return count + extra.length / stride - 1; };
  interface V { n: number; v: Float64Array }
  /** Split a convex polygon by the line axis = c into its below and above parts (new vertices interpolated). */
  const split = (poly: readonly V[], axis: number, c: number): [V[], V[]] => {
    const lo: V[] = [], hi: V[] = [];
    poly.forEach((a, i) => {
      const b = poly[(i + 1) % poly.length]; if (b === undefined) return;
      const da = (a.v[px + axis] ?? 0) - c, db = (b.v[px + axis] ?? 0) - c;
      (da < 0 ? lo : hi).push(a);
      if ((da < 0) !== (db < 0)) {
        const t = da / (da - db), v = new Float64Array(stride);
        for (let k = 0; k < stride; k++) v[k] = (a.v[k] ?? 0) + ((b.v[k] ?? 0) - (a.v[k] ?? 0)) * t;
        v[px + axis] = c; const m = { n: add(v), v }; lo.push(m); hi.push(m);
      }
    });
    return [lo, hi];
  };
  for (let t = 0; t < triangles; t++) {
    if (t % 256 === 0) yield;
    const tri: V[] = [0, 1, 2].map((c) => { const n = indexAt(t * 3 + c); return { n, v: read(n) }; });
    let polys: V[][] = [tri];
    for (const axis of [0, 2]) {
      const next: V[][] = [];
      for (let poly of polys) {
        const values = poly.map((p) => p.v[px + axis] ?? 0), lo = Math.min(...values), hi = Math.max(...values);
        for (let k = Math.ceil(lo / s - 0.5); (k + 0.5) * s < hi; k++) {
          const c = (k + 0.5) * s; if (c <= lo) continue;
          const [below, above] = split(poly, axis, c);
          if (below.length >= 3) next.push(below);
          poly = above;
        }
        if (poly.length >= 3) next.push(poly);
      }
      polys = next;
    }
    for (const poly of polys) for (let k = 1; k + 1 < poly.length; k++) out.push(poly[0]?.n ?? 0, poly[k]?.n ?? 0, poly[k + 1]?.n ?? 0);
  }
  return { extra, out };
}

/** Sort a geometry's triangles into bins by centroid; returns the sorted index and each bin's sphere and range. */
export function cullPlan(geometry: BufferGeometry, pitch: number, lod: readonly CullLod[] = []): CullPlan { return finishRoadSteps(cullPlanSteps(geometry, pitch, lod)); }

/** Sort the identical bin/LOD runs with pauses inside triangle batches; no partial plan is published. */
export function* cullPlanSteps(geometry: BufferGeometry, pitch: number, lod: readonly CullLod[] = []): Generator<void, CullPlan> {
  const index = geometry.getIndex(), position = geometry.getAttribute('position');
  if (index === null) throw new Error('A culled road mesh needs an index');
  const triangles = index.count / 3, byBin = new Map<string, number[]>();
  for (let t = 0; t < triangles; t++) {
    if (t % 256 === 0) yield;
    let x = 0, z = 0;
    for (let c = 0; c < 3; c++) { const n = index.getX(t * 3 + c); x += position.getX(n); z += position.getZ(n); }
    const key = cullBin(x / 3, z / 3, pitch), list = byBin.get(key);
    if (list === undefined) byBin.set(key, [t]); else list.push(t);
  }
  const out: number[] = [], bins: CullBin[] = [], point = new Vector3();
  const clusters = lod.map((tier) => clusterer(geometry, pitch, tier.cell));
  for (const key of [...byBin.keys()].sort()) {
    const list = byBin.get(key) ?? [], start = out.length, points: Vector3[] = [];
    for (const [i, t] of list.entries()) {
      if (i % 256 === 0) yield;
      for (let c = 0; c < 3; c++) {
        const n = index.getX(t * 3 + c); out.push(n);
        points.push(point.fromBufferAttribute(position, n).clone());
      }
    }
    const count = out.length - start, levels: { start: number; count: number }[] = [];
    for (const cluster of clusters) {
      const from = out.length;
      for (const [i, t] of list.entries()) {
        if (i % 256 === 0) yield;
        const a = cluster(index.getX(t * 3)), b = cluster(index.getX(t * 3 + 1)), c = cluster(index.getX(t * 3 + 2));
        if (a !== b && b !== c && a !== c) out.push(a, b, c);
      }
      levels.push({ start: from, count: out.length - from });
    }
    bins.push({ sphere: new Sphere().setFromPoints(points), start, count, levels });
  }
  return { source: Uint32Array.from(out), bins, lod: lod.map((tier) => tier.distance) };
}

/**
 * Vertex clustering for a far LOD tier: each vertex maps to the first vertex of its `cell`-metre lattice box that wears the
 * same material (grain layer + unlit flag). Vertices on a bin edge or a cell edge (where the seam meets the shard's own
 * ground) stay themselves, so a coarse bin meets its fine neighbour and the shard's terrain without a crack.
 */
function clusterer(geometry: BufferGeometry, pitch: number, cell: number): (n: number) => number {
  const position = geometry.getAttribute('position'), grain = geometry.hasAttribute('grainUv') ? geometry.getAttribute('grainUv') : undefined;
  const first = new Map<string, number>(), memo = new Int32Array(position.count).fill(-1);
  return (n: number): number => {
    const known = memo[n] ?? -1; if (known >= 0) return known;
    const key = lodKey(position.getX(n), position.getY(n), position.getZ(n), grain?.getZ(n) ?? 0, grain?.getW(n) ?? 0, pitch, cell);
    let rep = n;
    if (key !== null) { const seen = first.get(key); if (seen === undefined) first.set(key, n); else rep = seen; }
    memo[n] = rep; return rep;
  };
}

/** A vertex's LOD lattice box and material; null on a bin edge or a cell edge (it stays itself). */
function lodKey(x: number, y: number, z: number, layer: number, unlit: number, pitch: number, cell: number): string | null {
  const s = pitch / BIN_DIVISOR;
  const onLine = (v: number): boolean => {
    const bin = Math.abs(v / s - Math.round(v / s)); if (Math.abs(bin - 0.5) * s < 1e-3) return true; // a bin edge
    const local = Math.abs(v - Math.round(v / pitch) * pitch); return Math.abs(local - CELL_EDGE) < 1e-3; // a cell edge
  };
  if (onLine(x) || onLine(z)) return null;
  return `${String(Math.floor(x / cell))},${String(Math.floor(y / cell))},${String(Math.floor(z / cell))},${String(layer)},${String(unlit)}`;
}

/** How the road builders cull a mesh (`cullRoadMesh` at `pitch`, the view camera) and where each mesh's plan is kept. */
export interface RoadCuller { readonly pitch: number; readonly camera?: () => Camera | undefined; readonly plans: Map<Mesh, CullPlan> }
/** Cull `mesh` per view (with the deck's far `lod`), keeping its plan for the budget readouts. */
export function cullInto(culler: RoadCuller, mesh: Mesh, lod: readonly CullLod[] = []): void { finishRoadSteps(cullIntoSteps(culler, mesh, lod)); }

/** Complete clipping and sorting before installing the live view hook and publishing its plan. */
export function* cullIntoSteps(culler: RoadCuller, mesh: Mesh, lod: readonly CullLod[] = []): Generator<void> {
  yield* clipToBinsSteps(mesh.geometry, culler.pitch);
  const plan = yield* cullPlanSteps(mesh.geometry, culler.pitch, lod);
  attachRoadCull(mesh, plan, culler.camera);
  culler.plans.set(mesh, plan);
}

/**
 * A run of triangles as a road geometry will hold them, read without building it: `position(k)` is component k (vertex
 * k / 3) exactly as the geometry's Float32 array will store it, `indices` local to the run, and the run's one material
 * (`roadSolid.ts`: a part never mixes layers, so the deck's far LOD key needs one layer per run).
 */
export interface CullSource { readonly vertices: number; readonly position: (k: number) => number; readonly indices: ArrayLike<number>; readonly layer?: number; readonly unlit?: number }
/** What `cullRoadMesh` will hold: the geometry's vertices before and after `clipToBins`, and the sorted source's length. */
export interface CullCounts { readonly vertices: number; readonly clipped: number; readonly source: number }

/**
 * G144's preflight for a culled mesh: the vertex and index counts `clipToBins` and `cullPlan` will produce, from the same
 * clip arithmetic (`clipCore`, positions only) and the same LOD key, without allocating the geometry. Far LOD: a bin keeps a
 * clipped triangle at a tier iff its three vertices cluster to three different representatives, i.e. no two of them share
 * a lattice key (a vertex on a line keeps itself), so the count is independent of bin order.
 */
export function cullCounts(sources: readonly CullSource[], pitch: number, lod: readonly CullLod[] = []): CullCounts { return finishRoadSteps(cullCountsSteps(sources, pitch, lod)); }

/** Exact pre-allocation counts, with the same clipping arithmetic yielded in bounded batches. */
export function* cullCountsSteps(sources: readonly CullSource[], pitch: number, lod: readonly CullLod[] = []): Generator<void, CullCounts> {
  let vertices = 0, clipped = 0, source = 0;
  for (const run of sources) {
    const read = (n: number): Float64Array => Float64Array.of(run.position(n * 3), run.position(n * 3 + 1), run.position(n * 3 + 2));
    const { extra, out } = yield* clipCore(run.indices.length / 3, (i) => run.indices[i] ?? 0, run.vertices, 3, 0, read, pitch);
    vertices += run.vertices; clipped += run.vertices + extra.length / 3; source += out.length;
    const at = (n: number, c: number): number => (n < run.vertices ? run.position(n * 3 + c) : Math.fround(extra[(n - run.vertices) * 3 + c] ?? 0));
    for (const tier of lod) {
      const keys = new Map<number, string | null>();
      const key = (n: number): string | null => { let k = keys.get(n); if (k === undefined) { k = lodKey(at(n, 0), at(n, 1), at(n, 2), run.layer ?? 0, run.unlit ?? 0, pitch, tier.cell); keys.set(n, k); } return k; };
      const same = (a: number, b: number): boolean => a === b || (key(a) !== null && key(a) === key(b));
      for (let i = 0; i < out.length; i += 3) {
        if (i % 768 === 0) yield;
        const a = out[i] ?? 0, b = out[i + 1] ?? 0, c = out[i + 2] ?? 0;
        if (!same(a, b) && !same(b, c) && !same(a, c)) source += 3;
      }
    }
  }
  return { vertices, clipped, source };
}

/** Retained bytes: JS (typed arrays kept on the CPU) and GPU (buffers and every mip level). */
export interface RenderBytes { readonly jsBytes: number; readonly gpuBytes: number }
/**
 * The retained bytes of a road mesh of `floats` Float32 values per vertex and a Uint32 index: culled, its clipped vertex
 * buffers (CPU + GPU), the dynamic drawn index (CPU + GPU, the source's length) and the sorted source (CPU only); unculled,
 * its vertex buffers and index as built. `gpuOnly` (an admitted mesh, `gpuOnlyRoad`): the vertex buffers hold no CPU copy
 * once uploaded, so only the indices count on the JS side.
 */
export function meshBytes(sources: readonly CullSource[], floats: number, cull?: { readonly pitch: number; readonly lod?: readonly CullLod[] }, gpuOnly = false): RenderBytes { return finishRoadSteps(meshBytesSteps(sources, floats, cull, gpuOnly)); }

/** Yielded byte planning remains exact and completes before an allocation can be admitted. */
export function* meshBytesSteps(sources: readonly CullSource[], floats: number, cull?: { readonly pitch: number; readonly lod?: readonly CullLod[] }, gpuOnly = false): Generator<void, RenderBytes> {
  if (cull === undefined) {
    let vertices = 0, indices = 0;
    for (const run of sources) { vertices += run.vertices; indices += run.indices.length; }
    const vertexBytes = vertices * floats * 4, indexBytes = indices * 4;
    return { jsBytes: (gpuOnly ? 0 : vertexBytes) + indexBytes, gpuBytes: vertexBytes + indexBytes };
  }
  const counts = yield* cullCountsSteps(sources, cull.pitch, cull.lod);
  const vertexBytes = counts.clipped * floats * 4, indexBytes = counts.source * 4;
  return { jsBytes: (gpuOnly ? 0 : vertexBytes) + 2 * indexBytes, gpuBytes: vertexBytes + indexBytes };
}

/**
 * G144: an admitted road mesh keeps no CPU copy of what only the GPU reads. Every static vertex attribute (position too: the
 * cull reads its bins and sorted source, never the vertices, and nothing raycasts the road) and each texture's source (a
 * canvas painted once, the grain array) go the moment they upload; the dynamic drawn index and the cull's sorted source
 * stay. Call it right after `cullInto`, before the first draw. A lost context reloads the page (`markGpuOnly`).
 */
export function gpuOnlyRoad(mesh: Mesh, textures: readonly Texture[]): void {
  gpuOnlyAttributes(mesh.geometry, 'grid.road', []);
  for (const t of textures) gpuOnlyTexture(t, 'grid.road');
}
/** Sum retained bytes into one admission plan. */
export function bytePlan(id: string, ...parts: readonly RenderBytes[]): PlatformRenderBytePlan {
  return { id, jsBytes: parts.reduce((sum, p) => sum + p.jsBytes, 0), gpuBytes: parts.reduce((sum, p) => sum + p.gpuBytes, 0) };
}

/** The view's frustum in world space. */
function frustumOf(camera: Camera, out: Frustum, scratch: Matrix4): Frustum {
  camera.updateMatrixWorld();
  return out.setFromProjectionMatrix(scratch.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
}

/** The runs of a plan a camera draws: per bin in the frustum its fine run, or its coarse run past the LOD distance. */
function visibleRuns(plan: CullPlan, matrixWorld: Matrix4, frustum: Frustum, sphere: Sphere, eye: Vector3): { start: number; count: number; id: number }[] {
  const out: { start: number; count: number; id: number }[] = [];
  plan.bins.forEach((bin, k) => {
    if (!frustum.intersectsSphere(sphere.copy(bin.sphere).applyMatrix4(matrixWorld))) return;
    const d = sphere.distanceToPoint(eye);
    let level = 0; while (level < plan.lod.length && d > (plan.lod[level] ?? Infinity)) level++;
    const run = level === 0 ? bin : bin.levels[level - 1] ?? bin;
    out.push({ start: run.start, count: run.count, id: k * 4 + level });
  });
  return out;
}

/** A culled mesh's live readout. */
export interface CullState { readonly bins: number; readonly visible: number; readonly triangles: number; readonly rebuilds: number }

/**
 * Cull a road mesh by bins before every draw. `main` names the view camera (other cameras, a reflection or a probe, draw
 * the main camera's last set rather than thrash the index); without one every camera culls. Returns the readout.
 */
export function cullRoadMesh(mesh: Mesh, pitch: number, main?: () => Camera | undefined, lod: readonly CullLod[] = []): { plan: CullPlan; state: () => CullState } {
  const geometry = mesh.geometry;
  clipToBins(geometry, pitch);
  const plan = cullPlan(geometry, pitch, lod);
  return attachRoadCull(mesh, plan, main);
}

function attachRoadCull(mesh: Mesh, plan: CullPlan, main?: () => Camera | undefined): { plan: CullPlan; state: () => CullState } {
  const geometry = mesh.geometry;
  const drawn = new BufferAttribute(new Uint32Array(plan.source.length), 1).setUsage(DynamicDrawUsage);
  let fine = 0; // until the first culled draw: every bin's fine run
  for (const bin of plan.bins) { drawn.array.set(plan.source.subarray(bin.start, bin.start + bin.count), fine); fine += bin.count; }
  geometry.setIndex(drawn); geometry.setDrawRange(0, fine);
  mesh.frustumCulled = false;
  const frustum = new Frustum(), matrix = new Matrix4(), sphere = new Sphere(), eye = new Vector3();
  let key = '', triangles = fine / 3, visible = plan.bins.length, rebuilds = 0;
  mesh.onBeforeRender = (_renderer, _scene, camera) => {
    const view = main?.();
    if (view !== undefined && camera !== view) return;
    const runs = visibleRuns(plan, mesh.matrixWorld, frustumOf(camera, frustum, matrix), sphere, eye.setFromMatrixPosition(camera.matrixWorld)), next = runs.map((r) => r.id).join(',');
    if (next === key) return;
    key = next; rebuilds++;
    let at = 0;
    for (const run of runs) { drawn.array.set(plan.source.subarray(run.start, run.start + run.count), at); at += run.count; }
    drawn.clearUpdateRanges();
    if (at > 0) { drawn.addUpdateRange(0, at); drawn.needsUpdate = true; }
    geometry.setDrawRange(0, at);
    triangles = at / 3; visible = runs.length;
  };
  return { plan, state: () => ({ bins: plan.bins.length, visible, triangles, rebuilds }) };
}

/** The road system's cost in one view: draws (shadow draws included) and triangles, as the renderer would issue them. */
export interface RoadViewCost { readonly draws: number; readonly triangles: number; readonly shadowDraws: number; readonly byMesh: Readonly<Record<string, { draws: number; triangles: number }>> }
/** The resident cost: unique triangles uploaded, the triangles instancing expands to, and the far-LOD index copies (they
 *  reuse the full mesh's vertices: index bytes only). */
export interface RoadResident { readonly triangles: number; readonly instanced: number; readonly meshes: number; readonly bins: number; readonly widestBin: number; readonly lodTriangles: number }

const isMesh = (o: Object3D): o is Mesh => o instanceof Mesh;
const trianglesOf = (geometry: BufferGeometry, start: number, count: number): number => {
  const total = geometry.getIndex()?.count ?? geometry.getAttribute('position').count;
  return Math.max(0, Math.min(total, start + count) - Math.max(0, start)) / 3;
};

/**
 * Count what a camera draws of the road system: a culled mesh's visible bins (evaluated here exactly as its pre-draw hook
 * does), any other mesh by three's own test (its bounding sphere, unless `frustumCulled` is off), one draw per geometry
 * group, instances multiplying triangles, and a second draw for each caster (the shadow pass).
 */
export function roadViewCost(roots: readonly Object3D[], camera: Camera, plans: ReadonlyMap<Mesh, CullPlan> = new Map()): RoadViewCost {
  const frustum = frustumOf(camera, new Frustum(), new Matrix4()), sphere = new Sphere(), byMesh: Record<string, { draws: number; triangles: number }> = {};
  let draws = 0, triangles = 0, shadowDraws = 0;
  for (const root of roots) root.traverseVisible((o) => {
    if (!isMesh(o)) return;
    o.updateMatrixWorld();
    const geometry: BufferGeometry = o.geometry, plan = plans.get(o);
    let d = 0, t = 0;
    if (plan !== undefined) {
      const runs = visibleRuns(plan, o.matrixWorld, frustum, sphere, new Vector3().setFromMatrixPosition(camera.matrixWorld));
      t = runs.reduce((sum, r) => sum + r.count, 0) / 3; d = t > 0 ? 1 : 0;
    } else {
      if (geometry.boundingSphere === null) geometry.computeBoundingSphere();
      const bound = geometry.boundingSphere;
      const seen = !o.frustumCulled || bound === null || frustum.intersectsSphere(sphere.copy(bound).applyMatrix4(o.matrixWorld));
      if (seen) {
        const groups = Array.isArray(o.material) && geometry.groups.length > 0 ? geometry.groups : [{ start: geometry.drawRange.start, count: geometry.drawRange.count }];
        for (const g of groups) { const n = trianglesOf(geometry, g.start, g.count); if (n > 0) { d++; t += n; } }
        if (o instanceof InstancedMesh) t *= o.count;
      }
    }
    // three draws a transparent double-sided material twice (back faces, then front) unless it is forced single-pass
    const passes = (Array.isArray(o.material) ? o.material : [o.material]).some((m: Material) => m.transparent && m.side === DoubleSide && !m.forceSinglePass) ? 2 : 1;
    d *= passes; t *= passes;
    if (o.castShadow && d > 0) { shadowDraws += d; t *= 2; }
    if (d === 0) return;
    draws += d; triangles += t;
    const entry = byMesh[o.name] ?? { draws: 0, triangles: 0 };
    entry.draws += d; entry.triangles += t; byMesh[o.name] = entry;
  });
  return { draws: draws + shadowDraws, triangles, shadowDraws, byMesh };
}

/** Count the road system's resident triangles (unique) and what instancing expands them to. */
export function roadResident(roots: readonly Object3D[], plans: ReadonlyMap<Mesh, CullPlan> = new Map()): RoadResident {
  let triangles = 0, instanced = 0, meshes = 0, bins = 0, widestBin = 0, lodTriangles = 0;
  for (const plan of plans.values()) for (const bin of plan.bins) { bins++; widestBin = Math.max(widestBin, Math.round(bin.sphere.radius)); for (const l of bin.levels) lodTriangles += l.count / 3; }
  for (const root of roots) root.traverse((o) => {
    if (!isMesh(o)) return;
    const geometry: BufferGeometry = o.geometry, plan = plans.get(o);
    const n = plan !== undefined ? plan.bins.reduce((sum, b) => sum + b.count, 0) / 3 : trianglesOf(geometry, 0, Infinity);
    meshes++; triangles += n; instanced += o instanceof InstancedMesh ? n * o.count : n;
  });
  return { triangles, instanced, meshes, bins, widestBin, lodTriangles };
}
