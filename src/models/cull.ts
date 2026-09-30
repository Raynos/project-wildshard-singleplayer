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
}

/** the view a culler last worked for; `changed` is true (and it updates) when the camera moved */
class View {
  readonly frustum = new THREE.Frustum();
  readonly eye = new THREE.Vector3();
  private readonly pv = new THREE.Matrix4();
  private readonly last = new THREE.Matrix4();
  private readonly inv = new THREE.Matrix4();
  private primed = false;
  changed(camera: THREE.Camera): boolean {
    camera.updateMatrixWorld();
    this.inv.copy(camera.matrixWorld).invert();
    this.pv.multiplyMatrices(camera.projectionMatrix, this.inv);
    if (this.primed && this.pv.equals(this.last)) return false;
    this.primed = true;
    this.last.copy(this.pv);
    this.frustum.setFromProjectionMatrix(this.pv);
    this.eye.setFromMatrixPosition(camera.matrixWorld);
    return true;
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
  constructor(from: readonly number[], o: CullOptions, private readonly bounds: Float32Array) {
    this.from2 = Float32Array.from(from, (d) => d * d);
    this.far2 = o.far === undefined ? Number.POSITIVE_INFINITY : o.far * o.far;
    this.keep2 = (o.keepNear ?? 0) ** 2;
    this.ang2 = (o.minAngular ?? 0) ** 2;
  }
  level(i: number, view: View): number {
    const b = this.bounds, x = b[i * 4] ?? 0, y = b[i * 4 + 1] ?? 0, z = b[i * 4 + 2] ?? 0, r = b[i * 4 + 3] ?? 0;
    const dx = x - view.eye.x, dy = y - view.eye.y, dz = z - view.eye.z, d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > this.far2) return -1;
    if (d2 > this.keep2) {
      if (this.ang2 > 0 && r * r < this.ang2 * d2) return -1;
      this.sphere.center.set(x, y, z); this.sphere.radius = r;
      if (!view.frustum.intersectsSphere(this.sphere)) return -1;
    }
    let l = this.from2.length - 1;
    while (l > 0 && d2 < (this.from2[l] ?? 0)) l--;
    return l;
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

export class InstancedCull {
  private readonly view = new View();
  private readonly chooser: Chooser;
  private readonly counts: Int32Array;
  /**
   * `sinks[v * levels + l]` is variant v's level l (null: a level that draws nothing); `variantOf[i]` copy i's variant;
   * `matrices` 16 floats per copy; `colors` 3 per copy or null; `bounds` x, y, z, r per copy (world)
   */
  constructor(
    private readonly sinks: readonly (InstancedSink | null)[], private readonly levels: number, private readonly variantOf: Uint16Array,
    private readonly matrices: Float32Array, private readonly colors: Float32Array | null, bounds: Float32Array, from: readonly number[], o: CullOptions,
  ) {
    this.chooser = new Chooser(from, o, bounds);
    this.counts = new Int32Array(sinks.length);
    this.ranges = sinks.map(() => ({ matrix: { start: 0, count: 0 }, color: { start: 0, count: 0 } }));
  }

  /** each sink's upload ranges, reused (only the drawn prefix of a buffer goes to the GPU; nothing allocated per update) */
  private readonly ranges: readonly { matrix: { start: number; count: number }; color: { start: number; count: number } }[];

  update(camera: THREE.Camera): void {
    if (!this.view.changed(camera)) return;
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
  private readonly view = new View();
  private readonly chooser: Chooser;
  /** the level each slot draws now (-1: hidden), so only changes touch the batch */
  private readonly shown: Int8Array;
  /** `slots` are grouped per copy: copy i owns slots [start[i], start[i + 1]) */
  constructor(private readonly slots: readonly BatchedSlot[], private readonly start: Uint32Array, bounds: Float32Array, from: readonly number[], o: CullOptions) {
    this.chooser = new Chooser(from, o, bounds);
    this.shown = new Int8Array(slots.length).fill(-2);
  }

  update(camera: THREE.Camera): void {
    if (!this.view.changed(camera)) return;
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
  private readonly view = new View();
  private readonly shown: Int8Array;
  private readonly from2: Float32Array;
  private readonly far2: number;
  /** `cells[c]` = its levels (null: that level draws nothing); `centres` x, y, z per cell */
  constructor(private readonly cells: readonly (readonly (THREE.Object3D | null)[])[], private readonly centres: Float32Array, from: readonly number[], o: CullOptions) {
    this.shown = new Int8Array(cells.length).fill(-2);
    this.from2 = Float32Array.from(from, (d) => d * d);
    this.far2 = o.far === undefined ? Number.POSITIVE_INFINITY : o.far * o.far;
  }

  update(camera: THREE.Camera): void {
    if (!this.view.changed(camera)) return;
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
