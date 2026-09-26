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
import { Box3, type BufferAttribute, Frustum, type InstancedBufferAttribute, type InstancedMesh, Matrix4, type Mesh, PerspectiveCamera, Sphere, Vector3 } from 'three';

/** extra field of view per side (degrees) */
const MARGIN = 7;
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
    this.list.push({ mesh, n, spheres, matrices, colors, attrs, far });
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
    const planes = this.frustum.planes;
    const cx = this.pos.x, cy = this.pos.y, cz = this.pos.z;
    let instances = 0, kept = 0, tris = 0;
    for (const e of this.list) {
      const { mesh, spheres, matrices, colors, attrs, far } = e;
      const dst = mesh.instanceMatrix.array;
      const cdst = mesh.instanceColor?.array ?? null;
      let k = 0;
      for (let i = 0; i < e.n; i++) {
        const x = spheres[i * 4] ?? 0, y = spheres[i * 4 + 1] ?? 0, z = spheres[i * 4 + 2] ?? 0, r = spheres[i * 4 + 3] ?? 0;
        const dx = x - cx, dy = y - cy, dz = z - cz, d2 = dx * dx + dy * dy + dz * dz;
        if (far !== Number.POSITIVE_INFINITY && d2 > (far + r) * (far + r)) continue;
        let inside = true;
        for (const pl of planes) {
          if (pl.normal.x * x + pl.normal.y * y + pl.normal.z * z + pl.constant < -r) { inside = false; break; }
        }
        if (!inside) continue;
        // (always from the master: the buffer's front holds the last cull's packing)
        copy(matrices, i * 16, dst, k * 16, 16);
        if (colors !== null && cdst !== null) copy(colors, i * 3, cdst, k * 3, 3);
        for (const a of attrs) copy(a.master, i * a.size, a.attr.array, k * a.size, a.size);
        k++;
      }
      tris += pack(mesh, k, attrs);
      instances += e.n;
      kept += k;
    }
    for (const f of this.fars) f.mesh.visible = f.box.distanceToPoint(this.pos) <= f.far;
    this.stats.instances = instances;
    this.stats.kept = kept;
    this.stats.tris = Math.round(tris);
    this.stats.culls++;
  }
}

/** n floats from src[so] to dst[do] */
function copy(src: Float32Array, so: number, dst: Record<number, number>, to: number, n: number): void {
  for (let j = 0; j < n; j++) dst[to + j] = src[so + j] ?? 0;
}

/** a batch's packed count: set it, upload the front, hide it when empty; its triangles */
function pack(mesh: InstancedMesh, k: number, attrs: readonly Packed[]): number {
  mesh.count = k;
  mesh.visible = k > 0;
  upload(mesh.instanceMatrix, k * 16);
  if (mesh.instanceColor !== null) upload(mesh.instanceColor, k * 3);
  for (const a of attrs) upload(a.attr, k * a.size);
  const g = mesh.geometry;
  return (k * (g.index !== null ? g.index.count : g.getAttribute('position').count)) / 3;
}

/** upload only the packed front of an attribute */
function upload(a: BufferAttribute | InstancedBufferAttribute, n: number): void {
  a.clearUpdateRanges();
  if (n === 0) return;
  a.addUpdateRange(0, n);
  a.needsUpdate = true;
}
