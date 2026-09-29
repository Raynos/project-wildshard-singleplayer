// Per-instance culling for the fragment's world-wide instanced batches (P0-5c, the phone budget): the facade dressing
// (one InstancedMesh per kit piece across every tower), the paper lanterns and the instanced dressing each span the whole
// fragment (bounding spheres of 200–300 m), so three's per-object frustum test never drops them and every frame
// submitted all ~35 k instances (~1.5 M triangles) whatever the camera saw. The culler keeps a master copy of each
// batch's instances and, when the camera has moved or turned enough, packs the instances whose bounding sphere meets a
// widened view frustum (and lies within the batch's `far`, for the clutter the facade shader shrinks to nothing past
// 85 m) to the front of the batch's buffers and sets its `count`. No draw is added; an empty batch is hidden. (The crowd
// culls itself, with its distance LOD: crowd.ts `Crowd`, dome B's.)
//
// `addFar` is the per-region draw distance for the domes' kits (ctx.ts `Ctx.far`): a kit drawn only while the camera is
// within `far` m of its bounding box — the Well's deep bands and the stair's far end are invisible from most views.
//
// The widened frustum (MARGIN° more field on every side) and the re-cull thresholds (TURN°, MOVE m) are set so the
// camera can turn / walk between two culls without an instance at the frame's edge missing. Nothing else renders the
// world from another camera (the wet-ground reflection is screen-space, there are no shadow maps), so the main camera
// is the only one to cull for.
//
// (E283, the phone's CPU) a re-cull runs every few frames while the player walks or looks round, over ~35 k instances: the
// frustum's planes are read into plain numbers once per cull; runs of GROUP consecutive instances are tested as one sphere
// first (wholly in view or wholly out: no per-instance test, the same answer for each of them); the kept instances are
// copied in consecutive runs, one block copy each; and only what changed since the batch's last cull is copied and
// uploaded (the kept instances it shares with the last cull, from the front, are already in place; an unchanged batch
// costs nothing). The packing is exactly the per-instance one's: pixel-identical.
import { Box3, type BufferAttribute, Frustum, type InstancedBufferAttribute, type InstancedMesh, Matrix4, type Mesh, PerspectiveCamera, Sphere, Vector3 } from 'three';

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

interface Entry {
  mesh: InstancedMesh;
  n: number;
  /** world-space bounding spheres of the instances: x, y, z, r */
  spheres: Float32Array;
  /** one sphere round each GROUP consecutive instances' spheres: x, y, z, r */
  groups: Float64Array;
  matrices: Float32Array;
  colors: Float32Array | null;
  attrs: Packed[];
  far: number;
  /** the instances the last cull kept (master indices, in packing order) and how many; -1 = never packed */
  idx: Int32Array;
  k: number;
}

/** a mesh drawn only within `far` m of the camera (from its bounding box) */
interface FarEntry { mesh: Mesh; box: Box3; far: number }

function isInstanced(a: unknown): a is InstancedBufferAttribute {
  return typeof a === 'object' && a !== null && 'isInstancedBufferAttribute' in a && a.isInstancedBufferAttribute === true;
}

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
  /** this cull's kept indices for the batch being packed (grown to the largest batch) */
  private scratch = new Int32Array(0);
  /** the last cull: instances in the batches, instances kept, triangles kept */
  readonly stats = { instances: 0, kept: 0, tris: 0, culls: 0 };

  /** take over a batch: `far` (m) drops instances whose sphere lies wholly beyond it from the camera */
  add(mesh: InstancedMesh, far = Number.POSITIVE_INFINITY): void {
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
    this.list.push({ mesh, n, spheres, groups, matrices, colors, attrs, far, idx: new Int32Array(n), k: -1 });
    if (this.scratch.length < n) this.scratch = new Int32Array(n);
  }

  /** draw a whole mesh (a dome's kit) only while the camera is within `far` m of its bounding box */
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
    const keep = this.scratch;
    let instances = 0, kept = 0, tris = 0;
    for (const e of this.list) {
      const { mesh, spheres, groups, matrices, colors, attrs, far } = e;
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
      // the same instances as the batch's last cull up to `same`: the buffer's front already holds them there (all of them:
      // nothing to copy or upload)
      let same = 0;
      const lim = Math.min(k, e.k);
      while (same < lim && keep[same] === e.idx[same]) same++;
      if (same === k && k === e.k) { tris += triangles(mesh, k); continue; }
      const dst = mesh.instanceMatrix.array;
      const cdst = mesh.instanceColor?.array ?? null;
      // (always from the master: the buffer's front holds the last cull's packing) in runs of consecutive instances — the
      // kept ones mostly come in long runs (a street's worth of one facade piece), each run one block copy
      for (let j = same; j < k;) {
        const i = keep[j] ?? 0;
        let len = 1;
        while (j + len < k && keep[j + len] === i + len) len++;
        dst.set(matrices.subarray(i * 16, (i + len) * 16), j * 16);
        if (colors !== null && cdst !== null) cdst.set(colors.subarray(i * 3, (i + len) * 3), j * 3);
        for (const a of attrs) a.attr.array.set(a.master.subarray(i * a.size, (i + len) * a.size), j * a.size);
        j += len;
      }
      e.idx.set(keep.subarray(same, k), same);
      e.k = k;
      tris += pack(mesh, k, same, attrs);
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

/** a batch's packed count: set it, upload what changed of the front (instances p … k), hide it when empty; its triangles */
function pack(mesh: InstancedMesh, k: number, p: number, attrs: readonly Packed[]): number {
  mesh.count = k;
  mesh.visible = k > 0;
  upload(mesh.instanceMatrix, p * 16, (k - p) * 16);
  if (mesh.instanceColor !== null) upload(mesh.instanceColor, p * 3, (k - p) * 3);
  for (const a of attrs) upload(a.attr, p * a.size, (k - p) * a.size);
  return triangles(mesh, k);
}

/** upload n floats of an attribute from `from` (added to any range not yet uploaded: two culls before a draw keep both) */
function upload(a: BufferAttribute | InstancedBufferAttribute, from: number, n: number): void {
  if (n <= 0) return;
  a.addUpdateRange(from, n);
  a.needsUpdate = true;
}
