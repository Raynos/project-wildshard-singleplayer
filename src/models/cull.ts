/**
 * Per-copy culling and LOD for placed models (E306 / E315): the one implementation of what Culling.ts's
 * CulledInstances / CulledBatch, Nine Dragon's InstanceCuller and the crowd's LOD buckets each did by hand.
 *
 * Every culler works only when the view changed (the camera's view-projection compared with the last one) and
 * allocates nothing while it runs: its matrices, bounds and counts are typed arrays made once, at `place` time.
 *   · InstancedCull — per copy: range, angular size, padded frustum; its LOD level by distance; its matrix copied into
 *     that level's shared instance buffer (one buffer per variant and level, shared by the level's parts)
 *   · BatchedCull   — the same decisions on a BatchedMesh: visibility and geometry id per copy, set only on change
 *   · CellCull      — merged cells: a whole cell's level (or nothing) by its distance
 *   · SetCull       — `lodBy: 'set'`: every copy at the level of the copy nearest the eye (one draw per level; three
 *     culls each level's mesh as a whole, per camera)
 *
 * What a shard's hand-rolled culler did differently is data on the call (M2, Pine Hollow), never a branch here:
 * `view` (its own padded frustum and eye, e.g. the forest's), `frustum: false` (range and LOD only; three culls per
 * camera), `flat` (distances on the ground), `from: 'origin'` (measured from the placement, not the bounds' centre),
 * `radiusBias` (a big copy switches later), `step` (re-chosen only once the eye moved that far), `bounds: 'sphere'`.
 */
import * as THREE from 'three';

/** when copies are dropped (all optional: none = only the frustum and the LODs) */
export interface CullOptions {
  /** metres: no copy is drawn past it */
  readonly far?: number;
  /** metres: copies this near are always drawn, in view or not (their shadows fall into view) */
  readonly keepNear?: number;
  /** radians: a copy smaller than this on screen (radius / distance) is not drawn */
  readonly minAngular?: number;
  /**
   * A view the shard hands in instead of the camera: it calls back with its frustum (padded, say) and eye whenever it
   * changed — Pine Hollow's forest (`Forest.onViewChange`) drives its props' copies this way. Default: the camera, once a
   * frame through `cullPlaced`.
   */
  readonly view?: CullView;
  /** false: no per-copy frustum test, range and LOD only — three culls each batched instance (or the whole instanced set) per camera, shadow cameras included */
  readonly frustum?: boolean;
  /** distances on the ground (x, z), not in 3D */
  readonly flat?: boolean;
  /** where a copy's distance is measured from: its bounds' centre (default) or its placement's point */
  readonly from?: 'bounds' | 'origin';
  /** a copy's distance less this fraction of its bounding radius (the crags' 0.5: a big copy keeps its detail longer) */
  readonly radiusBias?: number;
  /** with `frustum: false`: the copies are re-chosen only once the eye has moved more than this (metres) */
  readonly step?: number;
  /** 'set': every copy takes the level of the copy nearest the eye (a set switches together: one draw per level) */
  readonly lodBy?: 'copy' | 'set';
  /** a copy's bounding sphere: around its world box (default) or its parts' own bounding sphere, posed (`'sphere'`) */
  readonly bounds?: 'box' | 'sphere';
}

/** a view that tells its cullers when it changed (`CullOptions.view`) */
export interface CullView {
  onViewChange: (fn: (frustum: THREE.Frustum, eye: THREE.Vector3) => void) => void;
}

/** the view a culler last worked for; `changed` is true (and it updates) when the camera moved */
class View {
  readonly frustum = new THREE.Frustum();
  readonly eye = new THREE.Vector3();
  private readonly pv = new THREE.Matrix4();
  private readonly last = new THREE.Matrix4();
  private readonly inv = new THREE.Matrix4();
  private primed = false;
  private readonly lastEye = new THREE.Vector3();
  /** `step` > 0: only a move of the eye past it counts (a culler with no frustum test ignores turning) */
  constructor(private readonly step = 0) {}
  changed(camera: THREE.Camera): boolean {
    camera.updateMatrixWorld();
    if (this.step > 0) {
      this.eye.setFromMatrixPosition(camera.matrixWorld);
      if (this.primed && this.eye.distanceToSquared(this.lastEye) <= this.step * this.step) return false;
      this.primed = true;
      this.lastEye.copy(this.eye);
      return true;
    }
    this.inv.copy(camera.matrixWorld).invert();
    this.pv.multiplyMatrices(camera.projectionMatrix, this.inv);
    if (this.primed && this.pv.equals(this.last)) return false;
    this.primed = true;
    this.last.copy(this.pv);
    this.frustum.setFromProjectionMatrix(this.pv);
    this.eye.setFromMatrixPosition(camera.matrixWorld);
    return true;
  }
  /** a view handed in (`CullOptions.view`) */
  use(frustum: THREE.Frustum, eye: THREE.Vector3): void {
    this.frustum.copy(frustum);
    this.eye.copy(eye);
  }
}

/** Shared copy-selection maths: which level (or -1: not drawn) copy i takes from this view. */
class Chooser {
  private readonly sphere = new THREE.Sphere();
  private readonly far2: number;
  private readonly keep2: number;
  private readonly ang2: number;
  /** squared start distance of each level (level 0 starts at 0) */
  private readonly from2: Float32Array;
  /** `radiusBias`: the levels' start distances and the range, compared with the biased distance itself */
  private readonly from: Float64Array;
  private readonly far: number;
  private readonly flat: boolean;
  private readonly bias: number;
  private readonly frustum: boolean;
  /** `origins`: x, y, z per copy to measure from (`from: 'origin'`), else the bounds' centres */
  constructor(from: readonly number[], o: CullOptions, private readonly bounds: Float32Array, private readonly origins: Float32Array | null = null) {
    this.from2 = Float32Array.from(from, (d) => d * d);
    this.from = Float64Array.from(from);
    this.far = o.far ?? Number.POSITIVE_INFINITY;
    this.far2 = o.far === undefined ? Number.POSITIVE_INFINITY : o.far * o.far;
    this.keep2 = (o.keepNear ?? 0) ** 2;
    this.ang2 = (o.minAngular ?? 0) ** 2;
    this.flat = o.flat === true;
    this.bias = o.radiusBias ?? 0;
    this.frustum = o.frustum !== false;
  }
  /** copy i's distance² from the eye (on the ground when `flat`) */
  dist2(i: number, eye: THREE.Vector3): number {
    const c = this.origins ?? this.bounds, k = this.origins ? 3 : 4;
    const dx = (c[i * k] ?? 0) - eye.x, dy = this.flat ? 0 : (c[i * k + 1] ?? 0) - eye.y, dz = (c[i * k + 2] ?? 0) - eye.z;
    return dx * dx + dy * dy + dz * dz;
  }
  /** the level at a distance² (the copy's own radius for `radiusBias`); -1 past the range */
  levelAt(d2: number, r: number): number {
    if (this.bias !== 0) {
      const d = Math.sqrt(d2) - r * this.bias;
      if (d > this.far) return -1;
      let l = this.from.length - 1;
      while (l > 0 && d < (this.from[l] ?? 0)) l--;
      return l;
    }
    if (d2 > this.far2) return -1;
    let l = this.from2.length - 1;
    while (l > 0 && d2 < (this.from2[l] ?? 0)) l--;
    return l;
  }
  level(i: number, view: View): number {
    const b = this.bounds, x = b[i * 4] ?? 0, y = b[i * 4 + 1] ?? 0, z = b[i * 4 + 2] ?? 0, r = b[i * 4 + 3] ?? 0;
    const d2 = this.dist2(i, view.eye);
    if (this.bias === 0 && d2 > this.far2) return -1;
    if (this.frustum && d2 > this.keep2) {
      if (this.ang2 > 0 && r * r < this.ang2 * d2) return -1;
      this.sphere.center.set(x, y, z); this.sphere.radius = r;
      if (!view.frustum.intersectsSphere(this.sphere)) return -1;
    }
    return this.levelAt(d2, r);
  }
}

/** mark a buffer's drawn prefix for upload with a reused range object (three clears `updateRanges` after the upload) */
function upload(a: THREE.InstancedBufferAttribute, range: { start: number; count: number }): void {
  if (!a.updateRanges.includes(range)) a.updateRanges.push(range);
  a.needsUpdate = true;
}

/** one variant's one level: the instance buffer its parts share, and those parts */
export interface InstancedSink {
  readonly matrix: THREE.InstancedBufferAttribute;
  readonly color: THREE.InstancedBufferAttribute | null;
  readonly meshes: readonly THREE.InstancedMesh[];
}

/** the view a culler reads: the camera's (re-chosen when it changed, or moved past `step`) or one handed in */
const viewFor = (o: CullOptions): View => new View(o.frustum === false ? o.step ?? 0 : 0);

export class InstancedCull {
  private readonly view: View;
  private readonly chooser: Chooser;
  private readonly counts: Int32Array;
  /**
   * `sinks[v * levels + l]` is variant v's level l (null: a level that draws nothing); `variantOf[i]` copy i's variant;
   * `matrices` 16 floats per copy; `colors` 3 per copy or null; `bounds` x, y, z, r per copy (world); `origins` x, y, z
   * per copy (`from: 'origin'`)
   */
  constructor(
    private readonly sinks: readonly (InstancedSink | null)[], private readonly levels: number, private readonly variantOf: Uint16Array,
    private readonly matrices: Float32Array, private readonly colors: Float32Array | null, bounds: Float32Array, from: readonly number[], o: CullOptions,
    origins: Float32Array | null = null,
  ) {
    this.view = viewFor(o);
    this.chooser = new Chooser(from, o, bounds, origins);
    this.counts = new Int32Array(sinks.length);
    this.ranges = sinks.map(() => ({ matrix: { start: 0, count: 0 }, color: { start: 0, count: 0 } }));
  }

  /** each sink's upload ranges, reused (only the drawn prefix of a buffer goes to the GPU; nothing allocated per update) */
  private readonly ranges: readonly { matrix: { start: number; count: number }; color: { start: number; count: number } }[];

  update(camera: THREE.Camera): void {
    if (this.view.changed(camera)) this.choose();
  }

  /** a view handed in (`CullOptions.view`) */
  updateWith(frustum: THREE.Frustum, eye: THREE.Vector3): void {
    this.view.use(frustum, eye);
    this.choose();
  }

  private choose(): void {
    const counts = this.counts, m = this.matrices, c = this.colors;
    counts.fill(0);
    for (let i = 0; i < this.variantOf.length; i++) {
      const l = this.chooser.level(i, this.view);
      if (l < 0) continue;
      const k = (this.variantOf[i] ?? 0) * this.levels + l, sink = this.sinks[k];
      if (!sink) continue;
      const n = counts[k] ?? 0, dst = sink.matrix.array as Float32Array;
      for (let j = 0, s = i * 16, d = n * 16; j < 16; j++) dst[d + j] = m[s + j] ?? 0;
      if (c && sink.color) { const cd = sink.color.array as Float32Array; cd[n * 3] = c[i * 3] ?? 1; cd[n * 3 + 1] = c[i * 3 + 1] ?? 1; cd[n * 3 + 2] = c[i * 3 + 2] ?? 1; }
      counts[k] = n + 1;
    }
    for (let k = 0; k < this.sinks.length; k++) {
      const sink = this.sinks[k];
      if (!sink) continue;
      const n = counts[k] ?? 0;
      for (const mesh of sink.meshes) { mesh.count = n; mesh.visible = n > 0; }
      if (n === 0) continue;
      const r = this.ranges[k];
      if (r) { r.matrix.count = n * 16; upload(sink.matrix, r.matrix); if (sink.color) { r.color.count = n * 3; upload(sink.color, r.color); } }
    }
  }
}

/** a copy's instance in one BatchedMesh, and the geometry id each of its levels draws (-1: none at that level) */
export interface BatchedSlot {
  readonly mesh: THREE.BatchedMesh;
  readonly instance: number;
  /** per level: the geometry id, -1 when this material draws nothing at that level */
  readonly geometry: Int32Array;
}

export class BatchedCull {
  private readonly view: View;
  private readonly chooser: Chooser;
  /** the level each slot draws now (-1: hidden), so only changes touch the batch */
  private readonly shown: Int8Array;
  /** `slots` are grouped per copy: copy i owns slots [start[i], start[i + 1]) */
  constructor(private readonly slots: readonly BatchedSlot[], private readonly start: Uint32Array, bounds: Float32Array, from: readonly number[], o: CullOptions, origins: Float32Array | null = null) {
    this.view = viewFor(o);
    this.chooser = new Chooser(from, o, bounds, origins);
    this.shown = new Int8Array(slots.length).fill(-2);
  }

  update(camera: THREE.Camera): void {
    if (this.view.changed(camera)) this.choose();
  }

  /** a view handed in (`CullOptions.view`) */
  updateWith(frustum: THREE.Frustum, eye: THREE.Vector3): void {
    this.view.use(frustum, eye);
    this.choose();
  }

  private choose(): void {
    for (let i = 0; i + 1 < this.start.length; i++) {
      const l = this.chooser.level(i, this.view);
      for (let k = this.start[i] ?? 0; k < (this.start[i + 1] ?? 0); k++) {
        const slot = this.slots[k];
        if (!slot) continue;
        const g = l < 0 ? -1 : slot.geometry[l] ?? -1;
        if (this.shown[k] === g) continue;
        if (g < 0) slot.mesh.setVisibleAt(slot.instance, false);
        else { slot.mesh.setGeometryIdAt(slot.instance, g); slot.mesh.setVisibleAt(slot.instance, true); }
        this.shown[k] = g;
      }
    }
  }
}

/** merged cells: each cell's level objects; the nearest level whose distance the cell's centre has passed is shown */
export class CellCull {
  private readonly view: View;
  private readonly shown: Int8Array;
  private readonly from2: Float32Array;
  private readonly far2: number;
  /** `cells[c]` = its levels (null: that level draws nothing); `centres` x, y, z per cell */
  constructor(private readonly cells: readonly (readonly (THREE.Object3D | null)[])[], private readonly centres: Float32Array, from: readonly number[], o: CullOptions) {
    this.view = viewFor(o);
    this.shown = new Int8Array(cells.length).fill(-2);
    this.from2 = Float32Array.from(from, (d) => d * d);
    this.far2 = o.far === undefined ? Number.POSITIVE_INFINITY : o.far * o.far;
  }

  update(camera: THREE.Camera): void {
    if (this.view.changed(camera)) this.choose();
  }

  /** a view handed in (`CullOptions.view`) */
  updateWith(frustum: THREE.Frustum, eye: THREE.Vector3): void {
    this.view.use(frustum, eye);
    this.choose();
  }

  private choose(): void {
    const e = this.view.eye;
    for (let c = 0; c < this.cells.length; c++) {
      const dx = (this.centres[c * 3] ?? 0) - e.x, dy = (this.centres[c * 3 + 1] ?? 0) - e.y, dz = (this.centres[c * 3 + 2] ?? 0) - e.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      let l = -1;
      if (d2 <= this.far2) { l = this.from2.length - 1; while (l > 0 && d2 < (this.from2[l] ?? 0)) l--; }
      if (this.shown[c] === l) continue;
      this.shown[c] = l;
      const levels = this.cells[c] ?? [];
      for (let k = 0; k < levels.length; k++) { const o = levels[k]; if (o) o.visible = k === l; }
    }
  }
}

/**
 * `lodBy: 'set'`: every copy of a place call at the level of the copy nearest the eye — each (variant, level)'s mesh
 * holds all its copies (written once) and is shown or hidden as a whole, and three culls it per camera by its bounds.
 * One draw per level, as a hand-rolled set LOD (Pine Hollow's TRELLIS hero props) did it.
 */
export class SetCull {
  private readonly view: View;
  private readonly chooser: Chooser;
  private shown = -2;
  /** `levels[l]` = the meshes of level l (every variant's); `bounds` x, y, z, r per copy; `origins` x, y, z per copy (`from: 'origin'`) */
  constructor(private readonly levels: readonly (readonly THREE.Object3D[])[], private readonly n: number, bounds: Float32Array, from: readonly number[], o: CullOptions, origins: Float32Array | null = null) {
    this.view = viewFor(o);
    this.chooser = new Chooser(from, o, bounds, origins);
    this.show(0); // as built: the full model, until the first view says otherwise
  }

  update(camera: THREE.Camera): void {
    if (this.view.changed(camera)) this.choose();
  }

  /** a view handed in (`CullOptions.view`) */
  updateWith(frustum: THREE.Frustum, eye: THREE.Vector3): void {
    this.view.use(frustum, eye);
    this.choose();
  }

  private choose(): void {
    let best = Number.POSITIVE_INFINITY, at = -1;
    for (let i = 0; i < this.n; i++) { const d2 = this.chooser.dist2(i, this.view.eye); if (d2 < best) { best = d2; at = i; } }
    this.show(at < 0 ? -1 : this.chooser.levelAt(best, 0));
  }

  private show(l: number): void {
    if (l === this.shown) return;
    this.shown = l;
    this.levels.forEach((meshes, k) => { for (const m of meshes) m.visible = k === l; });
  }
}
