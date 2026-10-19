// The instance culler (SHARD-PLATFORM M3): per-instance culling for world-wide instanced batches. A batch spread over a
// whole level (one InstancedMesh per kit piece across every building, the lanterns, the dressing) has a bounding sphere of
// hundreds of metres, so three's per-object frustum test never drops it and every frame would submit every instance. The
// culler keeps a master copy of each batch's instances and, when the camera has moved or turned enough, packs the
// instances whose bounding sphere meets a widened view frustum (and lies within the batch's `far`) to the front of the
// batch's buffers and sets its `count`. No draw is added; an empty batch is hidden.
//
// `addFar` is a per-mesh draw distance: a mesh drawn only while the camera is within `far` m of its bounding box.
//
// The widened frustum (MARGIN° more field on every side) and the re-cull thresholds (TURN°, MOVE m) are set so the
// camera can turn / walk between two culls without an instance at the frame's edge missing. It culls for one camera.
//
// A re-cull runs every few frames while the player walks or looks round: the frustum's planes are read into plain numbers
// once per cull; runs of GROUP consecutive instances are tested as one sphere first (wholly in view or wholly out: no
// per-instance test); the kept instances are copied in consecutive runs, one block copy each; and only what changed since
// the batch's last cull is copied and uploaded (an unchanged batch costs nothing). The packing is exactly the
// per-instance one's: pixel-identical.
//
// Distance LODs: a batch can carry coarser copies of its piece, each from a distance (`add(mesh, far, lods)`): an
// instance in view is packed into the copy for its distance from the eye instead of the batch (one draw more per copy in
// use). The copies share the batch's material and masters. Batches placed through `place` (engine models/place) arrive as
// handed levels: the batch with every copy written, and a mesh per distance LOD, which `add` takes as its coarser copies.
import { Box3, type BufferAttribute, Frustum, InstancedBufferAttribute, type InstancedMesh, Matrix4, type Mesh, PerspectiveCamera, Sphere, Vector3 } from 'three';

/** extra field of view per side (degrees) */
const MARGIN = 7;
/** consecutive instances tested as one sphere before their own */
const GROUP = 32;
/** the group test's margin (m): a group counts as wholly in / out only with this to spare (float rounding) */
const EPS = 1e-3;
/** re-cull when the camera turns more than this (degrees) … */
const TURN = 3.5;
/** … or moves more than this (m) */
const MOVE = 1;

interface Packed { attr: InstancedBufferAttribute; master: Float32Array; size: number }

/** a distance LOD: a coarser copy of the batch's piece (a mesh with room for every instance, its own buffers), drawn
 *  for the instances `from` m or more from the eye */
export interface InstanceLevel { mesh: InstancedMesh; from: number }

/** one draw the batch packs into: the batch itself (level 0) or a coarser copy; its instanced attributes parallel the
 *  batch's masters; the instances its last pack held (master indices, in packing order) and how many (-1 = never) */
interface Out { mesh: InstancedMesh; from: number; attrs: InstancedBufferAttribute[]; idx: Int32Array; k: number }

interface Entry {
  mesh: InstancedMesh;
  n: number;
  /** the batch (level 0) and its coarser copies, nearest first */
  outs: Out[];
  /** world-space bounding spheres of the instances: x, y, z, r */
  spheres: Float32Array;
  /** one sphere round each GROUP consecutive instances' spheres: x, y, z, r */
  groups: Float64Array;
  matrices: Float32Array;
  colors: Float32Array | null;
  attrs: Packed[];
  far: number;
}

/** a mesh drawn only within `far` m of the camera (from its bounding box) */
interface FarEntry { mesh: Mesh; box: Box3; far: number }

function isInstanced(a: unknown): a is InstancedBufferAttribute {
  return typeof a === 'object' && a !== null && 'isInstancedBufferAttribute' in a && a.isInstancedBufferAttribute === true;
}

/** Culls an instanced mesh's instances against the camera and distance bands, measured from the caller's frame. */
export class InstanceCuller {
  private readonly list: Entry[] = [];
  private readonly fars: FarEntry[] = [];
  private readonly probe = new PerspectiveCamera();
  private readonly frustum = new Frustum();
  private readonly pv = new Matrix4();
  private readonly sphere = new Sphere();
  private readonly lastPos = new Vector3(Number.POSITIVE_INFINITY, 0, 0);
  private readonly lastDir = new Vector3();
  private readonly pos = new Vector3();
  private readonly dir = new Vector3();
  private lastFov = 0;
  private lastAspect = 0;
  /** the frustum's six planes as (nx, ny, nz, constant) */
  private readonly pc = new Float64Array(24);
  /** this cull's kept indices per level for the batch being packed (grown to the largest batch) */
  private scratch: Int32Array[] = [new Int32Array(0)];

  /** the last cull: instances in the batches, instances kept, triangles kept */
  readonly stats = { instances: 0, kept: 0, tris: 0, culls: 0 };

  /** is this batch taken over? */
  has(mesh: InstancedMesh): boolean { return this.list.some((e) => e.mesh === mesh); }

  /**
   * take over a batch: `far` (m) drops instances whose sphere lies wholly beyond it from the camera; `lods` are coarser
   * copies of its piece by distance (meshes beside the batch, in the same space)
   */
  add(mesh: InstancedMesh, far = Number.POSITIVE_INFINITY, lods: readonly InstanceLevel[] = []): void {
    const n = mesh.count;
    if (n === 0) return;
    const g = mesh.geometry;
    if (g.boundingSphere === null) g.computeBoundingSphere();
    const gs = g.boundingSphere ?? new Sphere();
    mesh.updateWorldMatrix(true, false);
    const spheres = new Float32Array(n * 4);
    const m = new Matrix4();
    for (let i = 0; i < n; i++) {
      mesh.getMatrixAt(i, m);
      m.premultiply(mesh.matrixWorld);
      this.sphere.copy(gs).applyMatrix4(m);
      spheres.set([this.sphere.center.x, this.sphere.center.y, this.sphere.center.z, this.sphere.radius], i * 4);
    }
    const attrs: Packed[] = [];
    for (const a of Object.values(g.attributes)) {
      if (!isInstanced(a) || !(a.array instanceof Float32Array)) continue;
      attrs.push({ attr: a, master: a.array.slice(), size: a.itemSize });
    }
    const colors = mesh.instanceColor !== null && mesh.instanceColor.array instanceof Float32Array ? mesh.instanceColor.array.slice() : null;
    const matrices = mesh.instanceMatrix.array instanceof Float32Array ? mesh.instanceMatrix.array.slice() : new Float32Array(mesh.instanceMatrix.array);
    // the whole-batch sphere stays (conservative): three's own test then only drops a batch wholly out of view
    mesh.computeBoundingSphere();
    const groups = new Float64Array(Math.ceil(n / GROUP) * 4);
    for (let g0 = 0; g0 < n; g0 += GROUP) {
      const g1 = Math.min(n, g0 + GROUP);
      let x = 0, y = 0, z = 0;
      for (let i = g0; i < g1; i++) { x += spheres[i * 4] ?? 0; y += spheres[i * 4 + 1] ?? 0; z += spheres[i * 4 + 2] ?? 0; }
      x /= g1 - g0; y /= g1 - g0; z /= g1 - g0;
      let r = 0;
      for (let i = g0; i < g1; i++) r = Math.max(r, Math.hypot((spheres[i * 4] ?? 0) - x, (spheres[i * 4 + 1] ?? 0) - y, (spheres[i * 4 + 2] ?? 0) - z) + (spheres[i * 4 + 3] ?? 0));
      groups.set([x, y, z, r], (g0 / GROUP) * 4);
    }
    const outs: Out[] = [{ mesh, from: 0, attrs: attrs.map((a) => a.attr), idx: new Int32Array(n), k: -1 }];
    const names = attrs.map((a) => Object.entries(g.attributes).find(([, v]) => v === a.attr)?.[0] ?? '');
    for (const [li, l] of [...lods].sort((a, b) => a.from - b.from).entries()) {
      // the copy: the level's mesh with instanced attributes of its own (the batch's layout), the batch's material
      const lm = l.mesh;
      const la = attrs.map((a, ai) => {
        const at = new InstancedBufferAttribute(new Float32Array(a.master.length), a.size);
        lm.geometry.setAttribute(names[ai] ?? '', at);
        return at;
      });
      lm.material = mesh.material;
      lm.name = `${mesh.name}:lod${li + 1}`;
      lm.renderOrder = mesh.renderOrder;
      lm.frustumCulled = mesh.frustumCulled;
      if (colors !== null && lm.instanceColor === null) lm.instanceColor = new InstancedBufferAttribute(new Float32Array(colors.length), 3);
      lm.boundingSphere = mesh.boundingSphere?.clone() ?? null;
      lm.count = 0;
      lm.visible = false;
      outs.push({ mesh: lm, from: l.from, attrs: la, idx: new Int32Array(n), k: -1 });
    }
    this.list.push({ mesh, n, outs, spheres, groups, matrices, colors, attrs, far });
    while (this.scratch.length < outs.length) this.scratch.push(new Int32Array(0));
    for (let i = 0; i < outs.length; i++) if ((this.scratch[i]?.length ?? 0) < n) this.scratch[i] = new Int32Array(n);
  }

  /** draw a whole mesh (a region's kit) only while the camera is within `far` m of its bounding box */
  addFar(mesh: Mesh, far: number): void {
    mesh.updateWorldMatrix(true, false);
    const box = new Box3().setFromObject(mesh);
    this.fars.push({ mesh, box, far });
  }

  /** re-cull if the camera moved / turned past the thresholds since the last cull (or its projection changed) */
  update(camera: PerspectiveCamera): void {
    camera.updateMatrixWorld();
    camera.getWorldPosition(this.pos);
    camera.getWorldDirection(this.dir);
    const turned = this.dir.dot(this.lastDir) < Math.cos((TURN * Math.PI) / 180);
    const moved = this.pos.distanceToSquared(this.lastPos) > MOVE * MOVE;
    if (!turned && !moved && camera.fov === this.lastFov && camera.aspect === this.lastAspect) return;
    this.lastPos.copy(this.pos);
    this.lastDir.copy(this.dir);
    this.lastFov = camera.fov;
    this.lastAspect = camera.aspect;
    this.cull(camera);
  }

  private cull(camera: PerspectiveCamera): void {
    const p = this.probe;
    p.fov = Math.min(170, camera.fov + 2 * MARGIN);
    // widen across as much as up: keep the horizontal half-angle + MARGIN too
    const hx = Math.atan(Math.tan((camera.fov * Math.PI) / 360) * camera.aspect) + (MARGIN * Math.PI) / 180;
    p.aspect = Math.tan(Math.min(hx, 1.5)) / Math.tan((p.fov * Math.PI) / 360);
    p.near = camera.near;
    p.far = camera.far;
    p.updateProjectionMatrix();
    this.pv.multiplyMatrices(p.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.pv);
    const P = this.pc;
    this.frustum.planes.forEach((pl, j) => { P[j * 4] = pl.normal.x; P[j * 4 + 1] = pl.normal.y; P[j * 4 + 2] = pl.normal.z; P[j * 4 + 3] = pl.constant; });
    const cx = this.pos.x, cy = this.pos.y, cz = this.pos.z;
    const keep = this.scratch[0] ?? new Int32Array(0);
    let instances = 0, kept = 0, tris = 0;
    for (const e of this.list) {
      const { spheres, groups, far } = e;
      const hasFar = far !== Number.POSITIVE_INFINITY;
      let k = 0;
      for (let g0 = 0; g0 < e.n; g0 += GROUP) {
        const g1 = Math.min(e.n, g0 + GROUP), q = (g0 / GROUP) * 4;
        const gx = groups[q] ?? 0, gy = groups[q + 1] ?? 0, gz = groups[q + 2] ?? 0, gr = groups[q + 3] ?? 0;
        // the group's sphere wholly out of view (or past `far`): none of its instances is; wholly in: all of them are
        let whole = true;
        if (hasFar) {
          const d = Math.hypot(gx - cx, gy - cy, gz - cz);
          if (d - gr > far + EPS) continue;
          if (d + gr > far - EPS) whole = false;
        }
        let out = false;
        for (let j = 0; j < 24; j += 4) {
          const s = (P[j] ?? 0) * gx + (P[j + 1] ?? 0) * gy + (P[j + 2] ?? 0) * gz + (P[j + 3] ?? 0);
          if (s < -gr - EPS) { out = true; break; }
          if (s < gr + EPS) whole = false;
        }
        if (out) continue;
        if (whole) { for (let i = g0; i < g1; i++) keep[k++] = i; continue; }
        for (let i = g0; i < g1; i++) {
          const x = spheres[i * 4] ?? 0, y = spheres[i * 4 + 1] ?? 0, z = spheres[i * 4 + 2] ?? 0, r = spheres[i * 4 + 3] ?? 0;
          if (hasFar) {
            const dx = x - cx, dy = y - cy, dz = z - cz;
            if (dx * dx + dy * dy + dz * dz > (far + r) * (far + r)) continue;
          }
          let inside = true;
          for (let j = 0; j < 24; j += 4) {
            if ((P[j] ?? 0) * x + (P[j + 1] ?? 0) * y + (P[j + 2] ?? 0) * z + (P[j + 3] ?? 0) < -r) { inside = false; break; }
          }
          if (inside) keep[k++] = i;
        }
      }
      instances += e.n;
      kept += k;
      if (e.outs.length === 1) { tris += packOut(e, 0, keep, k); continue; }
      // (the distance LODs) deal the kept instances out by their distance from the eye, keeping their order
      const counts: number[] = e.outs.map(() => 0);
      for (let j = 0; j < k; j++) {
        const i = keep[j] ?? 0;
        const dx = (spheres[i * 4] ?? 0) - cx, dy = (spheres[i * 4 + 1] ?? 0) - cy, dz = (spheres[i * 4 + 2] ?? 0) - cz;
        const d2 = dx * dx + dy * dy + dz * dz;
        let l = e.outs.length - 1;
        while (l > 0 && d2 < (e.outs[l]?.from ?? 0) ** 2) l--;
        const list = this.scratch[l];
        if (list === undefined) continue;
        list[counts[l] ?? 0] = i;
        counts[l] = (counts[l] ?? 0) + 1;
      }
      for (let l = 0; l < e.outs.length; l++) tris += packOut(e, l, this.scratch[l] ?? keep, counts[l] ?? 0);
    }
    for (const f of this.fars) f.mesh.visible = f.box.distanceToPoint(this.pos) <= f.far;
    this.stats.instances = instances;
    this.stats.kept = kept;
    this.stats.tris = Math.round(tris);
    this.stats.culls++;
  }
}

/** k instances' triangles */
function triangles(mesh: InstancedMesh, k: number): number {
  const g = mesh.geometry;
  return (k * (g.index !== null ? g.index.count : g.getAttribute('position').count)) / 3;
}

/**
 * pack the first k of `keep` (master indices) into the batch's draw `l`: the instances it shares with its last pack, from
 * the front, are already in place; the rest is copied from the masters in runs of consecutive instances (one block copy
 * each: a street's worth of one piece) and only that is uploaded; its count set, hidden when empty. Its triangles
 */
function packOut(e: Entry, l: number, keep: Int32Array, k: number): number {
  const out = e.outs[l];
  if (out === undefined) return 0;
  const mesh = out.mesh;
  let same = 0;
  const lim = Math.min(k, out.k);
  while (same < lim && keep[same] === out.idx[same]) same++;
  if (same === k && k === out.k) return triangles(mesh, k);
  const dst = mesh.instanceMatrix.array;
  const cdst = mesh.instanceColor?.array ?? null;
  for (let j = same; j < k;) {
    const i = keep[j] ?? 0;
    let len = 1;
    while (j + len < k && keep[j + len] === i + len) len++;
    dst.set(e.matrices.subarray(i * 16, (i + len) * 16), j * 16);
    if (e.colors !== null && cdst !== null) cdst.set(e.colors.subarray(i * 3, (i + len) * 3), j * 3);
    e.attrs.forEach((a, ai) => { out.attrs[ai]?.array.set(a.master.subarray(i * a.size, (i + len) * a.size), j * a.size); });
    j += len;
  }
  out.idx.set(keep.subarray(same, k), same);
  out.k = k;
  mesh.count = k;
  mesh.visible = k > 0;
  upload(mesh.instanceMatrix, same * 16, (k - same) * 16);
  if (mesh.instanceColor !== null) upload(mesh.instanceColor, same * 3, (k - same) * 3);
  e.attrs.forEach((a, ai) => { const at = out.attrs[ai]; if (at !== undefined) upload(at, same * a.size, (k - same) * a.size); });
  return triangles(mesh, k);
}

/** upload n floats of an attribute from `from` (added to any range not yet uploaded: two culls before a draw keep both) */
function upload(a: BufferAttribute | InstancedBufferAttribute, from: number, n: number): void {
  if (n <= 0) return;
  a.addUpdateRange(from, n);
  a.needsUpdate = true;
}
