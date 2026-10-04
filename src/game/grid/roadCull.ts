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
import { BufferAttribute, type BufferGeometry, type Camera, DoubleSide, DynamicDrawUsage, Frustum, InstancedMesh, type Material, Matrix4, Mesh, type Object3D, Sphere, Vector3 } from 'three';

/** One bin: its sphere (in the mesh's local frame) and its run of the sorted source index. */
interface CullBin { readonly sphere: Sphere; readonly start: number; readonly count: number }
/** A culled mesh's bins and its full, bin-sorted index (kept on the CPU to rebuild the drawn range from). */
export interface CullPlan { readonly source: Uint32Array; readonly bins: readonly CullBin[] }

const BIN_DIVISOR = 2;
/** The bin a point falls in: squares of `pitch / BIN_DIVISOR` (half a pitch), centred on multiples of it (junctions, segment middles, cell middles). */
export function cullBin(x: number, z: number, pitch: number): string { const s = pitch / BIN_DIVISOR; return `${String(Math.round(x / s))},${String(Math.round(z / s))}`; }

/**
 * Split (for drawing only) every triangle that crosses a bin edge, so each bin's sphere stays inside its square: the
 * generator's adaptive lattice lays flat road runs as triangles a whole segment long. A new vertex sits on the cut edge with
 * every attribute interpolated linearly, so the drawn surface, its colours, normals and uvs are exactly the old ones. The
 * collider is the generator's own mesh and never sees this.
 */
export function clipToBins(geometry: BufferGeometry, pitch: number): void {
  const index = geometry.getIndex(), names = Object.keys(geometry.attributes);
  if (index === null || index.count === 0) return;
  const attrs = names.map((name) => geometry.getAttribute(name)), sizes = attrs.map((a) => a.itemSize), stride = sizes.reduce((a, b) => a + b, 0);
  const s = pitch / BIN_DIVISOR, count = attrs[0]?.count ?? 0, extra: number[] = [], out: number[] = [];
  const read = (n: number): Float64Array => {
    const v = new Float64Array(stride); let o = 0;
    attrs.forEach((a, k) => { for (let c = 0; c < (sizes[k] ?? 0); c++) v[o + c] = a.array[n * (sizes[k] ?? 0) + c] ?? 0; o += sizes[k] ?? 0; });
    return v;
  };
  const at = names.indexOf('position'), px = at === -1 ? 0 : sizes.slice(0, at).reduce((a, b) => a + b, 0);
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
  for (let t = 0; t < index.count / 3; t++) {
    const tri: V[] = [0, 1, 2].map((c) => { const n = index.getX(t * 3 + c); return { n, v: read(n) }; });
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
  if (extra.length === 0) return;
  const total = count + extra.length / stride;
  let o = 0;
  names.forEach((name, k) => {
    const a = attrs[k], size = sizes[k] ?? 0; if (a === undefined) return;
    const array = new Float32Array(total * size);
    for (let i = 0; i < count * size; i++) array[i] = a.array[i] ?? 0;
    for (let n = 0; n < extra.length / stride; n++) for (let c = 0; c < size; c++) array[(count + n) * size + c] = extra[n * stride + o + c] ?? 0;
    geometry.setAttribute(name, new BufferAttribute(array, size)); o += size;
  });
  geometry.setIndex(new BufferAttribute(Uint32Array.from(out), 1));
}

/** Sort a geometry's triangles into bins by centroid; returns the sorted index and each bin's sphere and range. */
export function cullPlan(geometry: BufferGeometry, pitch: number): CullPlan {
  const index = geometry.getIndex(), position = geometry.getAttribute('position');
  if (index === null) throw new Error('A culled road mesh needs an index');
  const triangles = index.count / 3, byBin = new Map<string, number[]>();
  for (let t = 0; t < triangles; t++) {
    let x = 0, z = 0;
    for (let c = 0; c < 3; c++) { const n = index.getX(t * 3 + c); x += position.getX(n); z += position.getZ(n); }
    const key = cullBin(x / 3, z / 3, pitch), list = byBin.get(key);
    if (list === undefined) byBin.set(key, [t]); else list.push(t);
  }
  const source = new Uint32Array(index.count), bins: CullBin[] = [], point = new Vector3();
  let at = 0;
  for (const key of [...byBin.keys()].sort()) {
    const list = byBin.get(key) ?? [], start = at, points: Vector3[] = [];
    for (const t of list) for (let c = 0; c < 3; c++) {
      const n = index.getX(t * 3 + c); source[at++] = n;
      points.push(point.fromBufferAttribute(position, n).clone());
    }
    bins.push({ sphere: new Sphere().setFromPoints(points), start, count: at - start });
  }
  return { source, bins };
}

/** The view's frustum in world space. */
function frustumOf(camera: Camera, out: Frustum, scratch: Matrix4): Frustum {
  camera.updateMatrixWorld();
  return out.setFromProjectionMatrix(scratch.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
}

/** The bins of a plan a camera sees (world spheres through the mesh's matrix). */
function visibleBins(plan: CullPlan, matrixWorld: Matrix4, frustum: Frustum, sphere: Sphere): number[] {
  const out: number[] = [];
  plan.bins.forEach((bin, k) => { if (frustum.intersectsSphere(sphere.copy(bin.sphere).applyMatrix4(matrixWorld))) out.push(k); });
  return out;
}

/** A culled mesh's live readout. */
export interface CullState { readonly bins: number; readonly visible: number; readonly triangles: number; readonly rebuilds: number }

/**
 * Cull a road mesh by bins before every draw. `main` names the view camera (other cameras, a reflection or a probe, draw
 * the main camera's last set rather than thrash the index); without one every camera culls. Returns the readout.
 */
export function cullRoadMesh(mesh: Mesh, pitch: number, main?: () => Camera | undefined): { plan: CullPlan; state: () => CullState } {
  const geometry = mesh.geometry;
  clipToBins(geometry, pitch);
  const plan = cullPlan(geometry, pitch);
  const drawn = new BufferAttribute(new Uint32Array(plan.source.length), 1).setUsage(DynamicDrawUsage);
  drawn.array.set(plan.source);
  geometry.setIndex(drawn); geometry.setDrawRange(0, plan.source.length);
  mesh.frustumCulled = false;
  const frustum = new Frustum(), matrix = new Matrix4(), sphere = new Sphere();
  let key = '', triangles = plan.source.length / 3, visible = plan.bins.length, rebuilds = 0;
  mesh.onBeforeRender = (_renderer, _scene, camera) => {
    const view = main?.();
    if (view !== undefined && camera !== view) return;
    const bins = visibleBins(plan, mesh.matrixWorld, frustumOf(camera, frustum, matrix), sphere), next = bins.join(',');
    if (next === key) return;
    key = next; rebuilds++;
    let at = 0;
    for (const k of bins) { const bin = plan.bins[k]; if (bin === undefined) continue; drawn.array.set(plan.source.subarray(bin.start, bin.start + bin.count), at); at += bin.count; }
    drawn.clearUpdateRanges();
    if (at > 0) { drawn.addUpdateRange(0, at); drawn.needsUpdate = true; }
    geometry.setDrawRange(0, at);
    triangles = at / 3; visible = bins.length;
  };
  return { plan, state: () => ({ bins: plan.bins.length, visible, triangles, rebuilds }) };
}

/** The road system's cost in one view: draws (shadow draws included) and triangles, as the renderer would issue them. */
export interface RoadViewCost { readonly draws: number; readonly triangles: number; readonly shadowDraws: number; readonly byMesh: Readonly<Record<string, { draws: number; triangles: number }>> }
/** The resident cost: unique triangles uploaded and the triangles instancing expands to. */
export interface RoadResident { readonly triangles: number; readonly instanced: number; readonly meshes: number; readonly bins: number; readonly widestBin: number }

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
      const bins = visibleBins(plan, o.matrixWorld, frustum, sphere);
      t = bins.reduce((sum, k) => sum + (plan.bins[k]?.count ?? 0), 0) / 3; d = t > 0 ? 1 : 0;
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
  let triangles = 0, instanced = 0, meshes = 0, bins = 0, widestBin = 0;
  for (const plan of plans.values()) for (const bin of plan.bins) { bins++; widestBin = Math.max(widestBin, Math.round(bin.sphere.radius)); }
  for (const root of roots) root.traverse((o) => {
    if (!isMesh(o)) return;
    const geometry: BufferGeometry = o.geometry, plan = plans.get(o);
    const n = plan !== undefined ? plan.source.length / 3 : trianglesOf(geometry, 0, Infinity);
    meshes++; triangles += n; instanced += o instanceof InstancedMesh ? n * o.count : n;
  });
  return { triangles, instanced, meshes, bins, widestBin };
}
