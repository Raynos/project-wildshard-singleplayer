import * as THREE from 'three';
import { diagnosticNow } from '@wildshard/engine/core/clock';
import { TIER } from '@wildshard/engine/core/tier';
import type { GraphLiteral } from '@wildshard/format/materialGraph';
import { CellWindow, instanceTier, type InstanceArrays, type InstanceTier } from '@wildshard/sdk/looks/streamedInstances';


/**
 * A ground cover streamed round the viewer as rows (SHARD-PLATFORM M3, look-family rows): instanced low-poly plants, one
 * InstancedMesh per kind (one draw each, no shadow casting), refilled from square cells round the viewer whenever it has
 * moved `refill` m. Each cell's plants are baked at build (generators/coverCells.ts: where a plant stands, its kind,
 * scale, tint and the ground under it) and decoded from that file once per cell as the window caches it, then the ones
 * that can show from here are copied into the instance buffers — no per-frame allocation. The plants wear the shard's material graphs (its look.materials), which bend them and fade each one by its
 * distance to the camera; the cover sets their params (a kind's reach, far reach, mode and keep once, the viewer's
 * position, the slope reach and the far set's grow-in every frame).
 *
 * - No ring, no pop: each kind has a reach [near, far] (m, camera to plant, in 3D): every plant inside `near` stands, and
 *   past it each one has its own edge in [near + grow, far] (drawn from its yaw, which the shader reads back from the
 *   matrix). The refill copies only plants that can reach their edge before the next refill (their edge + `refill`), so
 *   nothing is ever inserted part-grown.
 * - A far tier: a kind may have a far model and its own [farNear, farFar] edge; past its near edge a plant hands over to
 *   it. The far set is rebuilt every `farRefill` m by a job that runs a slice of cells per frame (`farBudgetMs`) into the
 *   back buffers, with `farSlack` m of room, so neither the refill nor new cells hitch a frame.
 * - Slope reach: plants on sloping ground keep their reach × up to `slopeReach.up`, fading out as the camera climbs.
 * - No upload stalls: each tier of each kind is the SDK's twin-mesh `InstanceTier` (looks/streamedInstances, beside the
 *   `CellWindow` that caches the cells): the next set uploads a slice a frame (`uploadBytes` for the whole cover) and
 *   swaps in one frame when it is all on the GPU. The near set starts `nearLag` m early and must swap within
 *   `nearLag` m of travel (else the rest uploads that frame).
 *
 * Nothing here knows a shard: its numbers and kinds are rows in its `data/`, its graphs its look's, its plants a baked
 * file.
 *
 *   setCoverLooks({ materials, setParam, follow });   // the compiled graphs, before the world builds
 *   const cover = new StreamedCover({ row, geometry, cells, heightAt }).build();
 *   scene.add(cover.group);
 *   game.onUpdate((dt) => cover.update(dt, player.position));
 */

/** The cover's compiled graphs by look.materials id, their param setter and their toon look's once-a-frame follow. */
export interface CoverLooks {
  readonly materials: ReadonlyMap<string, THREE.Material>;
  readonly setParam: (id: string, name: string, value: GraphLiteral) => void;
  readonly follow: () => void;
}
let lent: CoverLooks | null = null;
/** Lend the cover its compiled graphs (the shard's runtime, before its world builds). */
export function setCoverLooks(looks: CoverLooks): void { lent = looks; }

interface PerTier { readonly phone: number; readonly desktop: number }
type Span = readonly [number, number];
/** what the cover reads off its row (data/coverLook.ts GROUND_COVER; its plants are baked into the cells) */
export interface StreamedCoverRow {
  readonly cell: number; readonly refill: number; readonly cacheMin: number; readonly growShare: number;
  readonly farRefill: number; readonly farSlack: number; readonly farIn: number; readonly eyeSlack: number;
  readonly uploadBytes: number; readonly nearLag: number; readonly look: string; readonly meshPrefix: string;
  readonly reachK: PerTier; readonly capK: PerTier; readonly farBudgetMs: PerTier;
  readonly slopeReach: { readonly up: number; readonly lo: number; readonly hi: number; readonly fadeFrom: number; readonly fadeTo: number };
  readonly kinds: readonly {
    readonly name: string; readonly geometry: string; readonly cap: number; readonly reach: Span; readonly scale: Span;
    readonly far?: { readonly geometry: string; readonly reach: Span; readonly cap: number; readonly keep: number };
  }[];
}

/** What the cover needs. */
export interface StreamedCoverOptions {
  readonly row: StreamedCoverRow;
  /** the kinds' geometries by the rows' keys */
  readonly geometry: Readonly<Record<string, THREE.BufferGeometry>>;
  /** the baked cells (generators/coverCells.ts) */
  readonly cells: Uint8Array;
  /** the ground height under the viewer (the slope reach fades out over it) */
  readonly heightAt: (x: number, z: number) => number;
}

/** Measurements for the pop-in / stutter scripts (`group.userData.stats`). */
export interface StreamedCoverStats {
  nearRefillMs: number; farJobMs: number; farJobFrames: number; farCells: number; farCount: number; cellsBuilt: number;
  gridMs: number; nearRefills: number; farSwaps: number; uploadBytes: number;
}

/** shader modes: a near plant that just shrinks away / hands over to its far model; a far model */
const MODE_NEAR = 0, MODE_HANDOVER = 1, MODE_FAR = 2;
/** floats per cached candidate: x y z yaw scale · tint rgb · ground normal xyz, cover side (aNrm) · ground rgb (aGround) ·
 *  cover rgb top (aCover) */
const STRIDE = 19;
/** the baked file's header (u32s) and bytes per plant (generators/coverCells.ts) */
const MAGIC = 0x43435357, VERSION = 1, HEAD = 9, PLANT = 22, TAU = Math.PI * 2, EMPTY = new Float32Array(0);

/** the baked file: its cells' rect (cell coordinates), kinds, tinted kinds (a bit each) and each (cell, kind)'s first byte */
interface CellFile { readonly view: DataView; readonly x0: number; readonly z0: number; readonly w: number; readonly h: number; readonly nk: number; readonly tinted: number; readonly starts: Uint32Array }

function readCells(bytes: Uint8Array, cell: number): CellFile {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), u = (i: number): number => (bytes.byteLength >= HEAD * 4 ? view.getUint32(i * 4, true) : 0);
  if (u(0) !== MAGIC || u(1) !== VERSION || u(2) !== cell) throw new Error('StreamedCover: the baked cells are missing or another version (rebuild them)');
  const w = u(5), h = u(6), nk = u(7), n = w * h * nk, starts = new Uint32Array(n + 1);
  starts[0] = (HEAD * 4 + n * 2 + 3) & ~3;
  for (let i = 0; i < Math.min(n, 1048576); i++) starts[i + 1] = (starts[i] ?? 0) + view.getUint16(HEAD * 4 + i * 2, true) * PLANT;
  if (starts[n] !== bytes.byteLength) throw new Error('StreamedCover: the baked cells are corrupt (rebuild them)');
  return { view, x0: u(3) - 2 ** 15, z0: u(4) - 2 ** 15, w, h, nk, tinted: u(8), starts };
}

/** the cover's per-instance attributes: the ground's colour, the cover's (rgb, top) and the ground normal + cover side */
const ATTRS = [{ name: 'aGround', size: 3 }, { name: 'aCover', size: 4 }, { name: 'aNrm', size: 4 }] as const;

interface FarTier {
  set: InstanceTier;
  cap: number;
  /** (farNear, farFar, grow) m: the far model keeps to its own edge in [farNear + grow, farFar] */
  reach: THREE.Vector3;
  keep: number;
}

interface Kind {
  set: InstanceTier;
  cap: number;
  far: FarTier | null;
  /** (near, far, grow) m */
  reach: THREE.Vector3;
  scale: readonly [number, number];
}

/** the phone's or the desktop's value of a row's pair */
const forTier = (pair: { readonly phone: number; readonly desktop: number }): number => (TIER === 'desktop' ? pair.desktop : pair.phone);
const ss = (e0: number, e1: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

/** cached plant `i` of `v` into instance `n` of a tier's back arrays (the far model is its near one's size) */
function writePlant(A: InstanceArrays, n: number, v: Float32Array, i: number): void {
  const yaw = v[i + 3] ?? 0, s = v[i + 4] ?? 1, c = Math.cos(yaw) * s, sn = Math.sin(yaw) * s, m = A.matrix, o = n * 16;
  const [gnd, cov, nrm] = A.attrs, col = A.colour;
  // a turn about +y, scaled: what Matrix4.compose writes, without the quaternion
  m[o] = c; m[o + 1] = 0; m[o + 2] = -sn; m[o + 3] = 0;
  m[o + 4] = 0; m[o + 5] = s; m[o + 6] = 0; m[o + 7] = 0;
  m[o + 8] = sn; m[o + 9] = 0; m[o + 10] = c; m[o + 11] = 0;
  m[o + 12] = v[i] ?? 0; m[o + 13] = v[i + 1] ?? 0; m[o + 14] = v[i + 2] ?? 0; m[o + 15] = 1;
  if (col) { col[n * 3] = v[i + 5] ?? 1; col[n * 3 + 1] = v[i + 6] ?? 1; col[n * 3 + 2] = v[i + 7] ?? 1; }
  gnd?.set(v.subarray(i + 12, i + 15), n * 3); nrm?.set(v.subarray(i + 8, i + 12), n * 4); cov?.set(v.subarray(i + 15, i + 19), n * 4);
}

/** A ground cover streamed round the viewer (see the module comment). */
export class StreamedCover {
  /** the cover's meshes (the shard may add its own) */
  readonly group = new THREE.Group();
  /** measurements (also `group.userData.stats`) */
  readonly stats: StreamedCoverStats = { nearRefillMs: 0, farJobMs: 0, farJobFrames: 0, farCells: 0, farCount: 0, cellsBuilt: 0, gridMs: 0, nearRefills: 0, farSwaps: 0, uploadBytes: 0 };
  private readonly o: StreamedCoverOptions;
  private readonly file: CellFile;
  private readonly row: StreamedCoverRow;
  private readonly farBudgetMs: number;
  private readonly kinds: Kind[] = [];
  private readonly cells: CellWindow<Float32Array[]>;
  private readonly last = new THREE.Vector3(1e9, 0, 1e9);
  private readonly uniforms = { uPlayer: { value: new THREE.Vector3() }, uReachUp: { value: 1 } };
  /** the graphs it draws in (their ids) and their setter; the viewer's position as a param */
  private looks: CoverLooks | null = null;
  private readonly ids: string[] = [];
  private readonly player = [0, 0, 0];
  /** the furthest any plant shows + a refill's travel: the cell window's radius */
  private rMax = 0;
  /** the far tier's rebuild: a job stepped within the budget a frame; where the shown / the next set were built from */
  private farJob: Generator<undefined, undefined, undefined> | null = null;
  private readonly farLast = new THREE.Vector3(1e9, 0, 1e9);
  private readonly farJobAt = new THREE.Vector3();
  private rFar = 0;
  /** 0 → 1 over `farIn` s when a far set lands somewhere new (boot, a teleport), so it grows in instead of appearing */
  private readonly farIn = { value: 1 };
  /** a near set is in the back meshes, uploading; the far job has written its whole set (it uploads until swapped) */
  private nearPending = false;
  private farWritten = false;

  /** The cover's rows, geometries and baked cells. */
  constructor(options: StreamedCoverOptions) {
    this.o = options;
    this.row = options.row;
    this.file = readCells(options.cells, options.row.cell);
    this.farBudgetMs = forTier(this.row.farBudgetMs);
    this.cells = new CellWindow(this.row.cell, (cx, cz) => this.generate(cx, cz));
  }

  /** A cached candidate's reach factor at the strength the camera's height allows, at the most it can grow to before the
   *  next refill (`travel` m of climb or dive at most: the strength follows the height). */
  private reachMax(v: Float32Array, i: number, strength: number, travel: number): number {
    const sr = this.row.slopeReach;
    const s = strength >= 1 ? 1 : Math.min(1, strength + travel / (sr.fadeTo - sr.fadeFrom));
    return 1 + s * (sr.up - 1) * ss(sr.lo, sr.hi, 1 - (v[i + 9] ?? 1));
  }

  /** Builds every kind's meshes in its lent graphs (one program for all of them) into `group`. */
  build(): this {
    const row = this.row, K = forTier(row.reachK), capK = forTier(row.capK), sr = row.slopeReach, looks = lent;
    if (looks === null) throw new Error('StreamedCover: no graphs lent (setCoverLooks before the world builds)');
    this.looks = looks;
    const material = (id: string, reach: THREE.Vector3, far: THREE.Vector3, mode: number, keep = 1): THREE.Material => {
      const mat = looks.materials.get(id);
      if (mat === undefined) throw new Error(`StreamedCover: look.materials lacks ${id}`);
      looks.setParam(id, 'reach', reach.toArray()); looks.setParam(id, 'farReach', far.toArray()); looks.setParam(id, 'mode', mode); looks.setParam(id, 'keep', keep);
      this.ids.push(id);
      return mat;
    };
    const geometry = (key: string): THREE.BufferGeometry => {
      const g = this.o.geometry[key];
      if (g === undefined) throw new Error(`StreamedCover: no geometry ${key}`);
      return g;
    };
    for (let ki = 0; ki < Math.min(row.kinds.length, 32); ki++) {
      const k = row.kinds[ki];
      if (k === undefined) continue;
      const cap = Math.round(k.cap * capK), [near, far] = k.reach, hasTint = (this.file.tinted & (1 << ki)) !== 0;
      const reach = new THREE.Vector3(near * K, far * K, (far - near) * K * row.growShare);
      this.rMax = Math.max(this.rMax, reach.y * sr.up + row.refill + row.eyeSlack); // sized for the slope reach
      let farTier: FarTier | null = null;
      const farSpan = new THREE.Vector3(0, 0, 1);
      if (k.far !== undefined) {
        const f = k.far, [fn, ff] = f.reach, fcap = Math.round(f.cap * f.keep * capK);
        farSpan.set(fn * K, ff * K, (ff - fn) * K * row.growShare);
        this.rFar = Math.max(this.rFar, farSpan.y * sr.up + row.farSlack + row.eyeSlack);
        farTier = { set: instanceTier(this.group, `${row.meshPrefix}${k.name}-far`, geometry(f.geometry), material(`${row.look}-${k.name}-far`, reach, farSpan, MODE_FAR), fcap, ATTRS, { coloured: hasTint }), cap: fcap, reach: farSpan, keep: f.keep };
      }
      const set = instanceTier(this.group, `${row.meshPrefix}${k.name}`, geometry(k.geometry), material(`${row.look}-${k.name}`, reach, farSpan, farTier ? MODE_HANDOVER : MODE_NEAR, farTier ? farTier.keep : 1), cap, ATTRS, { coloured: hasTint });
      this.kinds.push({ set, cap, far: farTier, reach, scale: k.scale });
    }
    const span = Math.ceil((2 * Math.max(this.rMax, this.rFar)) / row.cell) + 1;
    this.cells.cacheMax = Math.max(row.cacheMin, Math.round(span * span * 1.4));
    this.group.userData['stats'] = this.stats;
    return this;
  }

  /** a cell's plants per kind (STRIDE floats each), decoded once from the baked file (the window caches them) */
  private generate(cx: number, cz: number): Float32Array[] {
    const f = this.file, d = f.view, CELL = this.row.cell, i = cx - f.x0, k = cz - f.z0, out: Float32Array[] = [];
    this.kinds.forEach((kind, ki) => {
      const c = (k * f.w + i) * f.nk + ki, a = f.starts[c] ?? 0, b = f.starts[c + 1] ?? 0, [s0, s1] = kind.scale;
      if (i < 0 || k < 0 || i >= f.w || k >= f.h || ki >= f.nk) { out.push(EMPTY); return; }
      const count = (b - a) / PLANT, v = new Float32Array(count * STRIDE);
      for (let e = 0; e < Math.min(count, 65535); e++) {
        const o = a + e * PLANT, p = e * STRIDE;
        const nx = d.getInt8(o + 12) / 127, nz = d.getInt8(o + 13) / 127;
        v[p] = cx * CELL - 0.5 + (d.getUint16(o, true) / 65535) * (CELL + 1); v[p + 1] = (d.getUint16(o + 4, true) / 65535) * 128 - 16;
        v[p + 2] = cz * CELL - 0.5 + (d.getUint16(o + 2, true) / 65535) * (CELL + 1); v[p + 3] = (d.getUint16(o + 6, true) / 65535) * TAU;
        v[p + 4] = s0 + (d.getUint8(o + 8) / 255) * (s1 - s0);
        for (let j = 0; j < 3; j++) v[p + 5 + j] = (d.getUint8(o + 9 + j) / 255) * 2;
        v[p + 8] = nx; v[p + 9] = Math.sqrt(Math.max(0, 1 - nx * nx - nz * nz)); v[p + 10] = nz;
        for (let j = 0; j < 8; j++) v[p + 11 + j] = d.getUint8(o + 14 + j) / 255;
      }
      out.push(v);
    });
    return out;
  }

  /** copy every cached plant that can show before the next refill (its edge + `refill`) into its kind's back buffers
   *  (`update` uploads and swaps them) */
  private refill(px: number, py: number, pz: number): void {
    const t0 = diagnosticNow(), row = this.row;
    for (const k of this.kinds) k.set.begin();
    const arrs = this.kinds.map((k) => k.set.arrays());
    const up = this.uniforms.uReachUp.value, slack = row.refill + row.eyeSlack;
    // nearest cells first: a kind that runs into its cap then drops its furthest (thinnest) plants, not a corner
    for (const [cx, cz] of this.cells.within(px, pz, this.rMax)) {
      const data = this.cells.get(cx, cz);
      this.kinds.forEach((k, ki) => {
        const v = data[ki], A = arrs[ki], near = k.reach.x, far = k.reach.y, grow = k.reach.z;
        if (v === undefined || A === undefined) return;
        for (let i = 0; i < v.length && k.set.n < k.cap; i += STRIDE) {
          // this plant's edge (the shader's): yaw / 2π; round the wrap (the GPU's atan may land either side) to the far end
          const d2 = ((v[i] ?? 0) - px) ** 2 + ((v[i + 1] ?? 0) - py) ** 2 + ((v[i + 2] ?? 0) - pz) ** 2, rk = this.reachMax(v, i, up, slack);
          const h = (v[i + 3] ?? 0) / TAU, edge = (h < 0.005 || h > 0.995 ? far : near + grow + (far - near - grow) * h) * rk, lim = edge + slack;
          if (d2 <= lim * lim) writePlant(A, k.set.n++, v, i);
        }
      });
    }
    this.stats.nearRefillMs = diagnosticNow() - t0;
  }

  /**
   * The far tier's rebuild, a slice of cells per step (nearest first): every plant whose far model can show before the
   * next rebuild lands — past its near edge less `farSlack`, inside its far edge plus `farSlack` — into the back meshes
   * (`update` uploads what it wrote a slice a frame and swaps them in once the job is done and it is all uploaded).
   * A cap cuts the furthest (thinnest) first.
   */
  private *farRefill(px: number, py: number, pz: number): Generator<undefined, undefined, undefined> {
    const row = this.row, cellsAt = this.cells.within(px, pz, this.rFar);
    for (const k of this.kinds) k.far?.set.begin();
    const arrs = this.kinds.map((k) => k.far?.set.arrays() ?? null);
    const slack = row.farSlack + row.eyeSlack, up = this.uniforms.uReachUp.value;
    for (const [cx, cz] of cellsAt) {
      if (!this.cells.has(cx, cz)) { this.cells.get(cx, cz); this.stats.cellsBuilt++; yield undefined; } // a new cell is its own slice
      const data = this.cells.get(cx, cz);
      this.kinds.forEach((k, ki) => {
        const f = k.far, v = data[ki];
        if (f === null || v === undefined) return;
        const near = k.reach.x, grow = k.reach.z, far = k.reach.y, fNear = f.reach.x, fFar = f.reach.y, fGrow = f.reach.z;
        const st = arrs[ki], keep = f.keep;
        if (!st) return;
        for (let i = 0; i < v.length && f.set.n < f.cap; i += STRIDE) {
          const h = (v[i + 3] ?? 0) / TAU, wrap = h < 0.005 || h > 0.995;
          if (keep < 1 && ((h * 97.13) % 1) >= keep) continue;           // not one of the kind's far plants
          const d2 = ((v[i] ?? 0) - px) ** 2 + ((v[i + 1] ?? 0) - py) ** 2 + ((v[i + 2] ?? 0) - pz) ** 2, rk = this.reachMax(v, i, up, row.farSlack);
          const edge = (wrap ? near + grow : near + grow + (far - near - grow) * h) * rk, fEdge = (wrap ? fFar : fNear + fGrow + (fFar - fNear - fGrow) * h) * rk;
          // the lower bound takes the plant's reach at 1× (the camera may climb and the strength fall before the next rebuild)
          const lo = Math.max(0, (edge / rk) - grow - slack), hi = fEdge + slack;
          if (d2 <= hi * hi && d2 >= lo * lo) writePlant(st, f.set.n++, v, i);
        }
      });
      yield undefined;
    }
    this.stats.farCells = cellsAt.length;
    return undefined;
  }

  /** the far set is written and on the GPU — show it */
  private farSwap(): void {
    let total = 0;
    for (const k of this.kinds) if (k.far) { k.far.set.swap(); total += k.far.set.n; }
    this.stats.farCount = total; this.stats.farSwaps++;
    // a set that lands somewhere new — the first one, a jump further than the window (teleports) — grows in instead of
    // appearing; flying, however fast, the sets overlap and simply follow
    if (this.farLast.distanceToSquared(this.farJobAt) > this.rFar * this.rFar) this.farIn.value = 0;
    this.farLast.copy(this.farJobAt);
    this.farWritten = false;
  }

  /** Steps the cover: the near refill and the far job, their uploads and swaps, then the graphs' params. */
  update(dt: number, viewer: THREE.Vector3): void { this.step(dt, viewer); this.pushParams(); }

  private step(dt: number, viewer: THREE.Vector3): void {
    const row = this.row, REFILL_M = row.refill, NEAR_LAG = row.nearLag, FAR_SLACK = row.farSlack, sr = row.slopeReach;
    this.uniforms.uPlayer.value.copy(viewer);
    // full strength on foot (the viewer is the player's feet), none from high up
    this.uniforms.uReachUp.value = 1 - ss(sr.fadeFrom, sr.fadeTo, viewer.y - this.o.heightAt(viewer.x, viewer.z));
    // in 3D: a flying camera climbs and dives, and the reach is measured from the camera. The next near set is built
    // NEAR_LAG m early and uploads a slice a frame; it must be shown before the viewer is REFILL_M from where the shown one
    // was built, so it swaps by NEAR_LAG m of travel whatever is left (`last` = where the newest set was built).
    let budget = row.uploadBytes, used = 0;
    const moved = this.last.distanceToSquared(viewer), jump = moved > REFILL_M * REFILL_M;
    if (jump || (!this.nearPending && moved > (REFILL_M - NEAR_LAG) ** 2)) {
      this.last.copy(viewer);
      this.refill(viewer.x, viewer.y, viewer.z);
      this.nearPending = true;
      if (jump) budget = Infinity; // the first frame, a teleport, a reset: all of it, this frame
    }
    if (this.nearPending) {
      if (this.last.distanceToSquared(viewer) > NEAR_LAG * NEAR_LAG) budget = Infinity; // its deadline
      let done = true;
      for (const k of this.kinds) { const b = k.set.upload(budget - used); used += b; if (!k.set.uploaded) done = false; }
      if (done) { for (const k of this.kinds) k.set.swap(); this.nearPending = false; this.stats.nearRefills++; }
    }
    if (this.rFar === 0) { this.stats.uploadBytes += used; return; }
    this.farIn.value = Math.min(1, this.farIn.value + dt / row.farIn);
    // the far tier: start a rebuild every farRefill m and step it within the budget (a job always finishes: flying
    // fast, the next one starts from where the camera is by then); what it wrote uploads within what the near set left of
    // uploadBytes (all of it once the viewer is FAR_SLACK / 2 from where it started), and it swaps in once all is up
    if (this.farJob === null && !this.farWritten && this.farLast.distanceToSquared(viewer) > row.farRefill * row.farRefill) {
      this.farJobAt.copy(viewer);
      this.farJob = this.farRefill(viewer.x, viewer.y, viewer.z);
      this.stats.farJobMs = 0; this.stats.farJobFrames = 0;
    }
    if (this.farJob !== null) {
      const t0 = diagnosticNow();
      this.stats.farJobFrames++;
      while (diagnosticNow() - t0 < this.farBudgetMs) if (this.farJob.next().done === true) { this.farJob = null; this.farWritten = true; break; }
      this.stats.farJobMs += diagnosticNow() - t0;
    }
    if (this.farJob !== null || this.farWritten) {
      // what the near set left of this frame's bytes (a near deadline took them all), or all of it past the far deadline
      let left = Number.isFinite(budget) ? Math.max(0, budget - used) : Math.max(0, row.uploadBytes - used);
      if (this.farJobAt.distanceToSquared(viewer) > (FAR_SLACK / 2) ** 2) left = Infinity;
      let done = this.farWritten;
      for (const k of this.kinds) if (k.far) { const b = k.far.set.upload(left); left -= b; used += b; if (!k.far.set.uploaded) done = false; }
      if (done) this.farSwap();
    }
    this.stats.uploadBytes += used;
  }

  /** the per-frame params into every graph: the viewer, the slope reach's strength, the far set's grow-in; the toon follow */
  private pushParams(): void {
    const looks = this.looks, p = this.player, v = this.uniforms.uPlayer.value;
    if (looks === null) return;
    p[0] = v.x; p[1] = v.y; p[2] = v.z;
    for (let i = 0; i < Math.min(this.ids.length, 32); i++) {
      const id = this.ids[i];
      if (id !== undefined) { looks.setParam(id, 'player', p); looks.setParam(id, 'reachUp', this.uniforms.uReachUp.value); looks.setParam(id, 'farIn', this.farIn.value); }
    }
    looks.follow();
  }
}
