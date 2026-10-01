/**
 * Per-copy culling and LOD for placed models (E306 / E315): the one implementation of what Culling.ts's
 * CulledInstances / CulledBatch, Nine Dragon's InstanceCuller and the crowd's LOD buckets each did by hand.
 *
 * Every culler works only when the view changed (the camera's view-projection compared with the last one) and
 * allocates nothing while it runs: its matrices, bounds and counts are typed arrays made once, at `place` time.
 *   · InstancedCull — per copy: range, angular size, padded frustum; its LOD level by distance; its matrix copied into
 *     that level's shared instance buffer (one buffer per variant and level, shared by the level's parts)
 *   · CelledCopiesCull — `cells`: the same buffers filled a cell of copies at a time (the forest floor's ~22 000)
 *   · BatchedCull   — the same decisions on a BatchedMesh: visibility and geometry id per copy, set only on change
 *   · CellCull      — merged cells: a whole cell's level (or nothing) by its distance
 *   · SetCull       — `lodBy: 'set'`: every copy at the level of the copy nearest the eye (one draw per level; three
 *     culls each level's mesh as a whole, per camera)
 *   · WeldCull      — a weld's bands (./weld.ts, E347): tagged objects shown (or casting) by their copy's or unit's
 *     distance, and the instanced copies each unit hosts rewritten when the unit crosses its detail band
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
  /**
   * instanced: the copies bucketed once into `size`-metre squares by their placement point (`CelledCopiesCull`: Pine
   * Hollow's forest floor, ~22 000 copies in ~250 cells). A view tests each cell's sphere — its ground square, its copies'
   * height span, `pad` metres of a copy's own reach — for range and frustum, then writes the passing cells' copies that are
   * within `far` themselves, in cell order. Distances on the ground; `keepNear` / `minAngular` / `radiusBias` don't apply.
   */
  readonly cells?: { readonly size: number; readonly pad: number };
  /**
   * the shard's own visibility test in place of the frustum / `keepNear` / `minAngular` one: copy i at distance² d2 (on
   * the ground when `flat`) is drawn when it says so. It reads the shard's view as it last changed — Pine Hollow's forest
   * keeps a tree out of view while its long low-sun shadow can still fall into view (E94). `far` and the LODs still apply
   */
  readonly test?: (i: number, d2: number) => boolean;
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
  /** squared start of each level's dissolve band (`ModelLod.fade`): from there the level before it is drawn with it; ∞ without one */
  private readonly fade2: Float64Array;
  private readonly test: ((i: number, d2: number) => boolean) | null;
  /** the distance² of the copy the last `level` call chose for (`also` and a part's `until` read it) */
  d2 = 0;
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
  /** `origins`: x, y, z per copy to measure from (`from: 'origin'`), else the bounds' centres; `fades`: each level's `fade` */
  constructor(from: readonly number[], o: CullOptions, private readonly bounds: Float32Array | Float64Array, private readonly origins: Float32Array | Float64Array | null = null, fades: readonly number[] = []) {
    this.fade2 = Float64Array.from(from, (d, l) => { const f = fades[l] ?? 0; return l > 0 && f > 0 ? (d - f) * (d - f) : Number.POSITIVE_INFINITY; });
    this.test = o.test ?? null;
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
    this.d2 = d2;
    if (this.bias === 0 && d2 > this.far2) return -1;
    if (this.test !== null) { if (!this.test(i, d2)) return -1; }
    else if (this.frustum && d2 > this.keep2) {
      if (this.ang2 > 0 && r * r < this.ang2 * d2) return -1;
      this.sphere.center.set(x, y, z); this.sphere.radius = r;
      if (!view.frustum.intersectsSphere(this.sphere)) return -1;
    }
    return this.levelAt(d2, r);
  }
  /** the next level when the last copy chosen stands in its dissolve band (drawn with level `l`), else -1 */
  also(l: number): number {
    const n = l + 1;
    return this.bias === 0 && n < this.fade2.length && this.d2 >= (this.fade2[n] ?? Number.POSITIVE_INFINITY) ? n : -1;
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
  /** metres: its parts' `until` — a copy is written only while nearer (a detail band inside the level) */
  readonly until?: number;
}

/**
 * The instance buffers of a place call, grouped per (variant, level): `groups[v * levels + l]` are variant v's level l's
 * sinks (usually one; a part with an `until` has its own). Filled copy by copy, then committed once per choice.
 */
class Sinks {
  private readonly flat: InstancedSink[] = [];
  /** group g's sinks are `flat[first[g] … first[g + 1])` */
  private readonly first: Uint32Array;
  private readonly counts: Int32Array;
  private readonly until2: Float64Array;
  /** each sink's upload ranges, reused (only the drawn prefix of a buffer goes to the GPU; nothing allocated per update) */
  private readonly ranges: readonly { matrix: { start: number; count: number }; color: { start: number; count: number } }[];
  constructor(groups: readonly (readonly InstancedSink[])[], private readonly matrices: Float32Array, private readonly colors: Float32Array | null) {
    this.first = new Uint32Array(groups.length + 1);
    groups.forEach((g, k) => { this.first[k] = this.flat.length; this.flat.push(...g); });
    this.first[groups.length] = this.flat.length;
    this.counts = new Int32Array(this.flat.length);
    this.until2 = Float64Array.from(this.flat, (x) => (x.until === undefined ? Number.POSITIVE_INFINITY : x.until * x.until));
    this.ranges = this.flat.map(() => ({ matrix: { start: 0, count: 0 }, color: { start: 0, count: 0 } }));
  }
  reset(): void { this.counts.fill(0); }
  /** copy i, at distance² d2, into group g's sinks */
  put(i: number, g: number, d2: number): void {
    const m = this.matrices, c = this.colors;
    for (let s = this.first[g] ?? 0; s < (this.first[g + 1] ?? 0); s++) {
      if (d2 >= (this.until2[s] ?? Number.POSITIVE_INFINITY)) continue;
      const sink = this.flat[s];
      if (!sink) continue;
      const n = this.counts[s] ?? 0, dst = sink.matrix.array as Float32Array;
      for (let j = 0, a = i * 16, d = n * 16; j < 16; j++) dst[d + j] = m[a + j] ?? 0;
      if (c && sink.color) { const cd = sink.color.array as Float32Array; cd[n * 3] = c[i * 3] ?? 1; cd[n * 3 + 1] = c[i * 3 + 1] ?? 1; cd[n * 3 + 2] = c[i * 3 + 2] ?? 1; }
      this.counts[s] = n + 1;
    }
  }
  commit(): void {
    for (let s = 0; s < this.flat.length; s++) {
      const sink = this.flat[s];
      if (!sink) continue;
      const n = this.counts[s] ?? 0;
      for (const mesh of sink.meshes) { mesh.count = n; mesh.visible = n > 0; }
      if (n === 0) continue;
      const r = this.ranges[s];
      if (r) { r.matrix.count = n * 16; upload(sink.matrix, r.matrix); if (sink.color) { r.color.count = n * 3; upload(sink.color, r.color); } }
    }
  }
}

/** the view a culler reads: the camera's (re-chosen when it changed, or moved past `step`) or one handed in */
const viewFor = (o: CullOptions): View => new View(o.frustum === false ? o.step ?? 0 : 0);

export class InstancedCull {
  private readonly view: View;
  private readonly chooser: Chooser;
  private readonly sinks: Sinks;
  /**
   * `groups[v * levels + l]` are variant v's level l's sinks (empty: a level that draws nothing); `variantOf[i]` copy i's
   * variant; `matrices` 16 floats per copy; `colors` 3 per copy or null; `bounds` x, y, z, r per copy (world); `origins`
   * x, y, z per copy (`from: 'origin'`); `fades` each level's dissolve band (a copy in it is drawn at both levels)
   */
  constructor(
    groups: readonly (readonly InstancedSink[])[], private readonly levels: number, private readonly variantOf: Uint16Array,
    matrices: Float32Array, colors: Float32Array | null, bounds: Float32Array, from: readonly number[], o: CullOptions,
    origins: Float32Array | Float64Array | null = null, fades: readonly number[] = [],
  ) {
    this.view = viewFor(o);
    this.chooser = new Chooser(from, o, bounds, origins, fades);
    this.sinks = new Sinks(groups, matrices, colors);
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
    const ch = this.chooser, sinks = this.sinks;
    sinks.reset();
    for (let i = 0; i < this.variantOf.length; i++) {
      const l = ch.level(i, this.view);
      if (l < 0) continue;
      const base = (this.variantOf[i] ?? 0) * this.levels, a = ch.also(l);
      sinks.put(i, base + l, ch.d2);
      if (a >= 0) sinks.put(i, base + a, ch.d2);
    }
    sinks.commit();
  }
}

/**
 * `cells`: instanced copies bucketed into squares once (what Culling.ts's CelledInstances did for the forest floor); a
 * view change tests the cells, then copies the passing cells' copies (by their own range) into their variant's and
 * level's buffer. Cells keep the order their first copy came in; a cell's copies keep placement order.
 */
export class CelledCopiesCull {
  private readonly view: View;
  private readonly sphere = new THREE.Sphere();
  private readonly sinks: Sinks;
  /** per cell: centre x, y, z, radius (float64: the sphere tests as the old culler made them) */
  private readonly cells: Float64Array;
  /** cell c's copies are `order[start[c] … start[c + 1])` */
  private readonly start: Uint32Array;
  private readonly order: Uint32Array;
  private readonly far: number;
  private readonly from2: Float32Array;
  /** `origins`: each copy's placement point (x, y, z), float32 */
  constructor(
    groups: readonly (readonly InstancedSink[])[], private readonly levels: number, private readonly variantOf: Uint16Array,
    matrices: Float32Array, colors: Float32Array | null, private readonly origins: Float32Array,
    from: readonly number[], o: CullOptions & { readonly cells: { readonly size: number; readonly pad: number } },
  ) {
    this.view = viewFor(o);
    this.sinks = new Sinks(groups, matrices, colors);
    this.far = o.far ?? Number.POSITIVE_INFINITY;
    this.from2 = Float32Array.from(from, (d) => d * d);
    const { size, pad } = o.cells, n = origins.length / 3;
    const buckets = new Map<string, number[]>();
    for (let i = 0; i < n; i++) {
      const k = `${Math.floor((origins[i * 3] ?? 0) / size)},${Math.floor((origins[i * 3 + 2] ?? 0) / size)}`;
      let b = buckets.get(k);
      if (!b) buckets.set(k, (b = []));
      b.push(i);
    }
    this.cells = new Float64Array(buckets.size * 4);
    this.start = new Uint32Array(buckets.size + 1);
    this.order = new Uint32Array(n);
    let c = 0, at = 0;
    for (const [k, idx] of buckets) {
      const [ix = 0, iz = 0] = k.split(',').map(Number);
      let ymin = Number.POSITIVE_INFINITY, ymax = Number.NEGATIVE_INFINITY;
      for (const i of idx) { const y = origins[i * 3 + 1] ?? 0; if (y < ymin) ymin = y; if (y > ymax) ymax = y; }
      this.cells.set([(ix + 0.5) * size, (ymin + ymax) * 0.5, (iz + 0.5) * size, Math.hypot(size * 0.5, (ymax - ymin) * 0.5, size * 0.5) + pad], c * 4);
      this.start[c] = at;
      for (const i of idx) this.order[at++] = i;
      c++;
    }
    this.start[c] = at;
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
    const sinks = this.sinks, p = this.origins, e = this.view.eye;
    const far = this.far, max2 = far * far, cells = this.cells, from2 = this.from2;
    sinks.reset();
    for (let c = 0; c + 1 < this.start.length; c++) {
      const cx = cells[c * 4] ?? 0, cz = cells[c * 4 + 2] ?? 0, r = cells[c * 4 + 3] ?? 0;
      const dx = cx - e.x, dz = cz - e.z;
      if (dx * dx + dz * dz > (far + r) * (far + r)) continue;
      this.sphere.center.set(cx, cells[c * 4 + 1] ?? 0, cz); this.sphere.radius = r;
      if (!this.view.frustum.intersectsSphere(this.sphere)) continue;
      for (let j = this.start[c] ?? 0; j < (this.start[c + 1] ?? 0); j++) {
        const i = this.order[j] ?? 0;
        const ex = (p[i * 3] ?? 0) - e.x, ez = (p[i * 3 + 2] ?? 0) - e.z, d2 = ex * ex + ez * ez;
        if (d2 > max2) continue;
        let l = from2.length - 1;
        while (l > 0 && d2 < (from2[l] ?? 0)) l--;
        sinks.put(i, (this.variantOf[i] ?? 0) * this.levels + l, d2);
      }
    }
    sinks.commit();
  }
}

/** a copy's instance in one BatchedMesh, and the geometry id each of its levels draws (-1: none at that level) */
export interface BatchedSlot {
  readonly mesh: THREE.BatchedMesh;
  readonly instance: number;
  /** per level: the geometry id, -1 when this material draws nothing at that level */
  readonly geometry: Int32Array;
  /** per level: the squared `until` of what it draws there (∞: none), or null when no level has one */
  readonly until2: Float64Array | null;
}

export class BatchedCull {
  private readonly view: View;
  private readonly chooser: Chooser;
  /** the level each slot draws now (-1: hidden), so only changes touch the batch */
  private readonly shown: Int8Array;
  /** `slots` are grouped per copy: copy i owns slots [start[i], start[i + 1]); `fades` each level's dissolve band */
  constructor(private readonly slots: readonly BatchedSlot[], private readonly start: Uint32Array, bounds: Float32Array, from: readonly number[], o: CullOptions,
    origins: Float32Array | Float64Array | null = null, fades: readonly number[] = []) {
    this.view = viewFor(o);
    this.chooser = new Chooser(from, o, bounds, origins, fades);
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

  /** what a slot draws at level l for a copy at distance² d2: its geometry id, or -1 (none there, or past its `until`) */
  private static at(slot: BatchedSlot, l: number, d2: number): number {
    const g = slot.geometry[l] ?? -1;
    return g >= 0 && slot.until2 !== null && d2 >= (slot.until2[l] ?? Number.POSITIVE_INFINITY) ? -1 : g;
  }

  private choose(): void {
    const ch = this.chooser;
    for (let i = 0; i + 1 < this.start.length; i++) {
      const l = ch.level(i, this.view), a = l < 0 ? -1 : ch.also(l), d2 = ch.d2;
      for (let k = this.start[i] ?? 0; k < (this.start[i + 1] ?? 0); k++) {
        const slot = this.slots[k];
        if (!slot) continue;
        // its level's geometry; in a dissolve band, the next level's when it has none at this one (the forest's impostor)
        let g = l < 0 ? -1 : BatchedCull.at(slot, l, d2);
        if (g < 0 && a >= 0) g = BatchedCull.at(slot, a, d2);
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
  constructor(private readonly levels: readonly (readonly THREE.Object3D[])[], private readonly n: number, bounds: Float32Array, from: readonly number[], o: CullOptions, origins: Float32Array | Float64Array | null = null) {
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

/**
 * `draw: 'single'`: the parts of a copy tagged `userData.until` (metres) are drawn only while the camera is nearer than
 * that to the copy's origin — a building's detail set (its iron, cloth and glass) and its far set, dropped with distance
 * as Pine Hollow's cabins and landmarks did by hand. Checked when the view changed; only a crossing touches `visible`.
 */
export class UntilCull {
  private readonly view = new View();
  private readonly shown: Int8Array;
  /** `parts[k]` is shown while the eye is within `until[k]` of copy `copyOf[k]`, whose origin is `origins[3 × copy …]` */
  constructor(private readonly parts: readonly THREE.Object3D[], private readonly until: Float32Array, private readonly copyOf: Uint32Array, private readonly origins: Float32Array) {
    this.shown = new Int8Array(parts.length).fill(-1);
  }

  update(camera: THREE.Camera): void {
    if (!this.view.changed(camera)) return;
    const e = this.view.eye, o = this.origins;
    for (let k = 0; k < this.parts.length; k++) {
      const c = this.copyOf[k] ?? 0, u = this.until[k] ?? 0;
      const dx = (o[c * 3] ?? 0) - e.x, dy = (o[c * 3 + 1] ?? 0) - e.y, dz = (o[c * 3 + 2] ?? 0) - e.z;
      const on = dx * dx + dy * dy + dz * dz < u * u ? 1 : 0;
      if (this.shown[k] === on) continue;
      this.shown[k] = on;
      const part = this.parts[k];
      if (part) part.visible = on === 1;
    }
  }
}

/** instanced copies drawn by their host (./weld.ts: the props a weld's buildings set about) */
export interface HostedSet {
  /** one mesh per part, with room for every copy; three culls each by its bounding sphere, remade on every refresh */
  readonly meshes: readonly THREE.InstancedMesh[];
  /** the copies per host, in placement order: the host's unit (an index into the culler's units) and their matrices (16 floats each) */
  readonly lists: readonly { readonly unit: number; readonly matrices: Float32Array }[];
}

/**
 * A weld's bands (./weld.ts, E347): each tagged object drawn only while the eye is within its `until` of its origin (its
 * copy's root, or its unit's root for the unit's meshes), or casting only from its `castFrom`; and each unit's detail band,
 * which the copies its copies host follow — their meshes rewritten (every host within the band, in order) when a unit
 * crosses it. Checked when the view changed; only a crossing touches an object or a mesh.
 */
export class WeldCull {
  private readonly view = new View();
  private readonly shown: Int8Array;
  private readonly unitOn: Int8Array;
  private readonly hosted: { set: HostedSet; dirty: boolean }[] = [];
  private pending = false;
  /**
   * `objects[k]` is shown while the eye is within √`reach2[k]` of origin `at[k]` (`cast[k]` 1: casts a shadow only from that
   * far instead); `origins` x, y, z per origin; unit u's origin is `units[u]` and its detail band √`detail2[u]`
   */
  constructor(
    private readonly objects: readonly THREE.Object3D[], private readonly reach2: Float64Array, private readonly cast: Uint8Array,
    private readonly at: Uint32Array, private readonly origins: Float64Array, private readonly units: Uint32Array, private readonly detail2: Float64Array,
  ) {
    this.shown = new Int8Array(objects.length).fill(-1);
    this.unitOn = new Int8Array(units.length).fill(-1);
  }

  /** copies hosted by this weld's units: drawn from the next update on (as the units' bands stand then) */
  host(set: HostedSet): void { this.hosted.push({ set, dirty: true }); this.pending = true; }

  private d2(origin: number): number {
    const o = this.origins, e = this.view.eye;
    const dx = (o[origin * 3] ?? 0) - e.x, dy = (o[origin * 3 + 1] ?? 0) - e.y, dz = (o[origin * 3 + 2] ?? 0) - e.z;
    return dx * dx + dy * dy + dz * dz;
  }

  update(camera: THREE.Camera): void {
    const changed = this.view.changed(camera);
    if (!changed && !this.pending) return;
    this.pending = false;
    for (let k = 0; k < this.objects.length; k++) {
      const d2 = this.d2(this.at[k] ?? 0), within = d2 < (this.reach2[k] ?? 0);
      const on = (this.cast[k] === 1 ? !within : within) ? 1 : 0;
      if (this.shown[k] === on) continue;
      this.shown[k] = on;
      const o = this.objects[k];
      if (!o) continue;
      if (this.cast[k] === 1) o.castShadow = on === 1; else o.visible = on === 1;
    }
    let flipped = false;
    for (let u = 0; u < this.units.length; u++) {
      const on = this.d2(this.units[u] ?? 0) < (this.detail2[u] ?? 0) ? 1 : 0;
      if (this.unitOn[u] !== on) { this.unitOn[u] = on; flipped = true; }
    }
    for (const h of this.hosted) {
      if (!flipped && !h.dirty) continue;
      h.dirty = false;
      for (const im of h.set.meshes) {
        const dst = im.instanceMatrix.array as Float32Array;
        let n = 0;
        for (const l of h.set.lists) if (this.unitOn[l.unit] === 1) { dst.set(l.matrices, n * 16); n += l.matrices.length / 16; }
        im.count = n; im.visible = n > 0;
        if (n === 0) continue;
        im.instanceMatrix.needsUpdate = true;
        im.computeBoundingSphere();
      }
    }
  }
}
