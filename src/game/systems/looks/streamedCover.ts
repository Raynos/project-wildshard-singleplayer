import * as THREE from 'three';
import { diagnosticNow } from '@wildshard/engine/core/clock';
import { Rng } from '@wildshard/engine/core/rng';
import { TIER } from '@wildshard/engine/core/tier';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { attachFogUniforms } from '@wildshard/engine/world/Atmosphere';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { windUniforms } from '@wildshard/engine/world/wind';
import { editShader, type ShaderEditRow } from './shaderEdits';
import { ShaderFamily } from './shaderFamily';

/**
 * A ground cover streamed round the viewer as rows (SHARD-PLATFORM M3, look-family rows): instanced low-poly plants, one
 * InstancedMesh per kind (one draw each, no shadow casting), refilled from square cells round the viewer whenever it has
 * moved `refill` m. Each cell's candidates are generated once (deterministic, from the cell's hash) through the shard's
 * hooks and cached, then the ones that can show from here are copied into the instance buffers — no per-frame
 * allocation. The shard's vertex edits bend the plants and fade each one by its distance to the camera.
 *
 * - No ring, no pop: each kind has a reach [near, far] (m, camera to plant, in 3D): every plant inside `near` stands, and
 *   past it each one has its own edge in [near + grow, far] (drawn from its yaw, which the shader reads back from the
 *   matrix). The refill copies only plants that can reach their edge before the next refill (their edge + `refill`), so
 *   nothing is ever inserted part-grown.
 * - A far tier: a kind may have a far model and its own [farNear, farFar] edge; past its near edge a plant hands over to
 *   it. The far set is rebuilt every `farRefill` m by a job that runs a slice of cells per frame (`farBudgetMs`) into the
 *   back buffers, with `farSlack` m of room, so neither the refill nor new cells hitch a frame.
 * - Slope reach: plants on sloping ground keep their reach × up to `slopeReach.up`, fading out as the camera climbs.
 * - No upload stalls: each tier of each kind is two InstancedMeshes (`CoverTier`): the front one is drawn, the next set is
 *   written into the back one, which uploads only what was written, a slice a frame (`uploadBytes` for the whole cover),
 *   and the two swap in one frame when it is all on the GPU. The near set starts `nearLag` m early and must swap within
 *   `nearLag` m of travel (else the rest uploads that frame).
 *
 * Nothing here knows a shard: its numbers, kinds and GLSL are rows in its `data/`; where a plant may stand, how dense
 * each kind is there, its tint and the ground it stands on are the shard's hooks.
 *
 *   const cover = new StreamedCover({ sky, row, geometry, hooks, heightAt }).build();
 *   scene.add(cover.group);
 *   game.onUpdate((dt) => cover.update(dt, player.position));
 */

/** A kind's far tier as data: its model's geometry key, [farNear, farFar] m, its instance cap and the share kept. */
export interface StreamedCoverFarRow {
  readonly geometry: string;
  readonly reach: readonly [number, number];
  readonly cap: number;
  /** the share of the kind's plants that get a far model (drawn by a hash of the yaw) */
  readonly keep: number;
}

/** One kind as data: its name, geometry key, instance cap (phone, before `capK`), reach, scale range and far tier. */
export interface StreamedCoverKindRow {
  readonly name: string;
  readonly geometry: string;
  readonly cap: number;
  /** (near, far) m: full density inside near, thinning to none at far */
  readonly reach: readonly [number, number];
  readonly scale: readonly [number, number];
  readonly far?: StreamedCoverFarRow;
}

/** The cover's numbers, material settings, patch and GLSL as data. */
export interface StreamedCoverRow {
  /** cell size, refill travel (m), candidates per cell, the least cells cached */
  readonly cell: number;
  readonly refill: number;
  readonly candidates: number;
  readonly cacheMin: number;
  /** the desktop's reach and instance caps over the phone's */
  readonly reachK: { readonly phone: number; readonly desktop: number };
  readonly capK: { readonly phone: number; readonly desktop: number };
  /** the share of (far − near) a plant grows over */
  readonly growShare: number;
  /** the far set's rebuild travel, slack (m) and per-frame budget (ms) */
  readonly farRefill: number;
  readonly farSlack: number;
  readonly farBudgetMs: { readonly phone: number; readonly desktop: number };
  /** s a far set that lands somewhere new takes to grow in */
  readonly farIn: number;
  /** the viewer is the player's feet; the camera is up to this much over them */
  readonly eyeSlack: number;
  /** bytes the whole cover uploads a frame, and how early the near set starts (m) */
  readonly uploadBytes: number;
  readonly nearLag: number;
  /** m a plant's base sits under the ground it stands on */
  readonly sink: number;
  /** plants on sloping ground keep reach × up to `up` (slope `lo` … `hi`), fading out `fadeFrom` … `fadeTo` m over the ground */
  readonly slopeReach: { readonly up: number; readonly lo: number; readonly hi: number; readonly fadeFrom: number; readonly fadeTo: number };
  readonly material: { readonly flatShading: boolean; readonly roughness: number; readonly metalness: number; readonly doubleSided: boolean };
  /** the patch's id and program key; the meshes are named `<meshPrefix><kind>` and `<meshPrefix><kind>-far` */
  readonly patchId: string;
  readonly patchKey: string;
  readonly meshPrefix: string;
  readonly kinds: readonly StreamedCoverKindRow[];
  /** the edits of the plants' program; `@{reachUp}`, `@{slopeLo}`, `@{slopeHi}` splice the slope reach (3 decimals),
   *  any other `@{name}` the caller's `glsl` */
  readonly edits: readonly ShaderEditRow[];
}

/** A candidate point's site, as the shard's `site` hook fills it (the shard's own fields beside these). */
export interface CoverSite {
  /** the ground's height over the cover's datum (the shard's: e.g. over the sea) and its slope (1 − normal y) */
  h: number;
  slope: number;
  nx: number;
  ny: number;
  nz: number;
}

/** What a plant stands on, as the shard's `ground` hook fills it: its height, the ground's colour and the cover's. */
export interface CoverGround {
  y: number;
  r: number;
  g: number;
  b: number;
  /** the cover grid's side, colour (jittered) and top at the plant */
  side: number;
  cr: number;
  cg: number;
  cb: number;
  top: number;
}

/** The shard's placement rules. */
export interface StreamedCoverHooks<S extends CoverSite> {
  /** a new site to fill */
  readonly newSite: () => S;
  /** a candidate point (x, z): fill `site` and return true, or false to place nothing there */
  readonly site: (x: number, z: number, site: S) => boolean;
  /** kind `kind`'s (row index) instances per candidate × 2 at a site */
  readonly density: (kind: number, site: S) => number;
  /** whether kind `kind` (row index) has a per-instance tint (its meshes then carry instance colours) */
  readonly tinted: (kind: number) => boolean;
  /** kind `kind`'s per-instance tint (multiplies the vertex colours), drawn from `rng`, into `out` (a tinted kind only) */
  readonly tint: (kind: number, site: S, rng: Rng, out: THREE.Color) => void;
  /** the plant at (x, z) on that site: its ground height, colour and cover */
  readonly ground: (x: number, z: number, site: S, out: CoverGround) => void;
}

/** What the cover needs. */
export interface StreamedCoverOptions<S extends CoverSite> {
  readonly sky: Sky;
  readonly row: StreamedCoverRow;
  /** the kinds' geometries by the rows' keys */
  readonly geometry: Readonly<Record<string, THREE.BufferGeometry>>;
  readonly hooks: StreamedCoverHooks<S>;
  /** the ground height under the viewer (the slope reach fades out over it) */
  readonly heightAt: (x: number, z: number) => number;
  /** the cells' seed */
  readonly seed: number;
  /** what the edits' other `@{name}` splices */
  readonly glsl?: Readonly<Record<string, string>>;
}

/** Measurements for the pop-in / stutter scripts (`group.userData.stats`). */
export interface StreamedCoverStats {
  nearRefillMs: number; farJobMs: number; farJobFrames: number; farCells: number; farCount: number; cellsBuilt: number;
  gridMs: number; nearRefills: number; farSwaps: number; uploadBytes: number;
}

/** shader modes: a near plant that just shrinks away / hands over to its far model; a far model */
const MODE_NEAR = 0, MODE_HANDOVER = 1, MODE_FAR = 2;
/** floats per cached candidate: x y z yaw scale · tint rgb · ground rgb · ground normal xyz · cover side · cover rgb top */
const STRIDE = 19;

/**
 * One tier (near or far) of one kind: two InstancedMeshes on twin geometries (the model's attributes shared, the
 * per-instance ones each their own). The front one is drawn; `begin` starts the next set in the back one, which is kept
 * visible at count 0 while it fills — so three uploads what `upload` marked (only the written instances) and draws none of
 * it — and `swap` shows it in one frame.
 */
export class CoverTier {
  /** the two meshes */
  readonly meshes: readonly [THREE.InstancedMesh, THREE.InstancedMesh];
  /** per-instance bytes */
  readonly bytesPer: number;
  private front = 0;
  /** instances written into the back mesh */
  n = 0;
  private up = 0;
  /** each mesh has been drawn once, i.e. three has created its GPU buffers (a whole-cap bufferData): until then a mesh
   *  that leaves the front stays visible at count 0, so that happens in the boot's first frames, not mid-run */
  private readonly drawn = [false, false];
  /** The tier's two meshes and per-instance bytes. */
  constructor(meshes: readonly [THREE.InstancedMesh, THREE.InstancedMesh], bytesPer: number) {
    this.meshes = meshes;
    this.bytesPer = bytesPer;
    meshes.forEach((m, i) => { m.onBeforeRender = () => { this.drawn[i] = true; }; });
  }
  /** The mesh drawn. */
  get shown(): THREE.InstancedMesh { return this.meshes[this.front] ?? this.meshes[0]; }
  /** The mesh the next set is written into. */
  get back(): THREE.InstancedMesh { return this.meshes[1 - this.front] ?? this.meshes[1]; }
  /** The back mesh's per-instance arrays, to write the next set into. */
  arrays(): { mat: Float32Array; col: Float32Array | null; gnd: Float32Array; cov: Float32Array; nrm: Float32Array } {
    const b = this.back, g = b.geometry;
    const f = (a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): Float32Array => (a.array instanceof Float32Array ? a.array : new Float32Array(0));
    const col = b.instanceColor;
    return { mat: f(b.instanceMatrix), col: col ? f(col) : null, gnd: f(g.getAttribute('aGround')), cov: f(g.getAttribute('aCover')), nrm: f(g.getAttribute('aNrm')) };
  }
  /** Start the next set in the back mesh. */
  begin(): void { this.n = 0; this.up = 0; const b = this.back; b.count = 0; b.visible = true; }
  /** Everything written is marked for upload. */
  get uploaded(): boolean { return this.up >= this.n; }
  /** Mark up to `bytes` more of what was written for upload (Infinity: all of it); returns the bytes marked. */
  upload(bytes: number): number {
    const k = Math.min(this.n - this.up, Math.floor(bytes / this.bytesPer));
    if (k <= 0) return 0;
    const b = this.back, g = b.geometry;
    for (const a of [b.instanceMatrix, b.instanceColor, g.getAttribute('aGround'), g.getAttribute('aCover'), g.getAttribute('aNrm')]) {
      if (!(a instanceof THREE.BufferAttribute)) continue;
      a.addUpdateRange(this.up * a.itemSize, k * a.itemSize); a.needsUpdate = true;
    }
    this.up += k;
    return k * this.bytesPer;
  }
  /** Show the back set (it must be uploaded) and retire the front one. */
  swap(): void {
    const b = this.back, f = this.shown;
    b.count = this.n; f.count = 0; f.visible = !(this.drawn[this.front] ?? false);
    this.front = 1 - this.front;
  }
}

interface FarTier {
  set: CoverTier;
  cap: number;
  /** (farNear, farFar, grow) m: the far model keeps to its own edge in [farNear + grow, farFar] */
  reach: THREE.Vector3;
  keep: number;
}

interface Kind {
  set: CoverTier;
  cap: number;
  far: FarTier | null;
  /** (near, far, grow) m */
  reach: THREE.Vector3;
  scale: readonly [number, number];
}

const ss = (e0: number, e1: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

/** A ground cover streamed round the viewer (see the module comment). */
export class StreamedCover<S extends CoverSite> {
  /** the cover's meshes (the shard may add its own) */
  readonly group = new THREE.Group();
  /** measurements (also `group.userData.stats`) */
  readonly stats: StreamedCoverStats = { nearRefillMs: 0, farJobMs: 0, farJobFrames: 0, farCells: 0, farCount: 0, cellsBuilt: 0, gridMs: 0, nearRefills: 0, farSwaps: 0, uploadBytes: 0 };
  private readonly o: StreamedCoverOptions<S>;
  private readonly row: StreamedCoverRow;
  private readonly reachK: number;
  private readonly capK: number;
  private readonly farBudgetMs: number;
  private readonly kinds: Kind[] = [];
  private readonly cells = new Map<string, Float32Array[]>();
  private readonly last = new THREE.Vector3(1e9, 0, 1e9);
  private readonly uniforms = { uPlayer: { value: new THREE.Vector3() }, uReachUp: { value: 1 } };
  /** the furthest any plant shows + a refill's travel: the cell window's radius */
  private rMax = 0;
  private cacheMax = 96;
  private readonly tint = new THREE.Color();
  private readonly ground: CoverGround = { y: 0, r: 0, g: 0, b: 0, side: 0, cr: 0, cg: 0, cb: 0, top: 0 };
  private readonly site: S;
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
  /** per kind, a candidate cell's plants as they are generated */
  private readonly scratch: Float32Array[] = [];
  private readonly cellLens: number[] = [];

  /** The cover's rows, geometries, hooks and sky. */
  constructor(options: StreamedCoverOptions<S>) {
    this.o = options;
    this.row = options.row;
    const desktop = TIER === 'desktop';
    this.reachK = desktop ? this.row.reachK.desktop : this.row.reachK.phone;
    this.capK = desktop ? this.row.capK.desktop : this.row.capK.phone;
    this.farBudgetMs = desktop ? this.row.farBudgetMs.desktop : this.row.farBudgetMs.phone;
    this.site = options.hooks.newSite();
  }

  /** A cached candidate's reach factor at the strength the camera's height allows, at the most it can grow to before the
   *  next refill (`travel` m of climb or dive at most: the strength follows the height). */
  private reachMax(v: Float32Array, i: number, strength: number, travel: number): number {
    const sr = this.row.slopeReach;
    const s = strength >= 1 ? 1 : Math.min(1, strength + travel / (sr.fadeTo - sr.fadeFrom));
    return 1 + s * (sr.up - 1) * ss(sr.lo, sr.hi, 1 - (v[i + 12] ?? 1));
  }

  /** Builds every kind's meshes and materials (one program for all of them) into `group`. */
  build(): this {
    const row = this.row, K = this.reachK, ms = row.material, sr = row.slopeReach;
    const material = (reach: THREE.Vector3, far: THREE.Vector3, mode: number, keep = 1): THREE.MeshStandardMaterial => {
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: ms.flatShading, roughness: ms.roughness, metalness: ms.metalness, side: ms.doubleSided ? THREE.DoubleSide : THREE.FrontSide });
      this.patch(mat, reach, far, mode, keep);
      this.o.sky.setupMaterial(mat);
      return mat;
    };
    const geometry = (key: string): THREE.BufferGeometry => {
      const g = this.o.geometry[key];
      if (g === undefined) throw new Error(`StreamedCover: no geometry ${key}`);
      return g;
    };
    for (const [ki, k] of row.kinds.entries()) {
      const cap = Math.round(k.cap * this.capK), [near, far] = k.reach, hasTint = this.o.hooks.tinted(ki);
      const reach = new THREE.Vector3(near * K, far * K, (far - near) * K * row.growShare);
      this.rMax = Math.max(this.rMax, reach.y * sr.up + row.refill + row.eyeSlack); // sized for the slope reach
      let farTier: FarTier | null = null;
      const farSpan = new THREE.Vector3(0, 0, 1);
      if (k.far !== undefined) {
        const f = k.far, [fn, ff] = f.reach, fcap = Math.round(f.cap * f.keep * this.capK);
        farSpan.set(fn * K, ff * K, (ff - fn) * K * row.growShare);
        this.rFar = Math.max(this.rFar, farSpan.y * sr.up + row.farSlack + row.eyeSlack);
        farTier = { set: this.instanced(`${row.meshPrefix}${k.name}-far`, geometry(f.geometry), material(reach, farSpan, MODE_FAR), fcap, hasTint), cap: fcap, reach: farSpan, keep: f.keep };
      }
      const set = this.instanced(`${row.meshPrefix}${k.name}`, geometry(k.geometry), material(reach, farSpan, farTier ? MODE_HANDOVER : MODE_NEAR, farTier ? farTier.keep : 1), cap, hasTint);
      this.kinds.push({ set, cap, far: farTier, reach, scale: k.scale });
    }
    const span = Math.ceil((2 * Math.max(this.rMax, this.rFar)) / row.cell) + 1;
    this.cacheMax = Math.max(row.cacheMin, Math.round(span * span * 1.4));
    this.group.userData['stats'] = this.stats;
    return this;
  }

  /** two meshes, the second on a twin of the model (its attributes shared: one GPU copy) — see CoverTier */
  private instanced(name: string, g: THREE.BufferGeometry, mat: THREE.Material, cap: number, tinted: boolean): CoverTier {
    const twin = new THREE.BufferGeometry();
    for (const [k, a] of Object.entries(g.attributes)) twin.setAttribute(k, a);
    twin.setIndex(g.getIndex());
    for (const gr of g.groups) twin.addGroup(gr.start, gr.count, gr.materialIndex);
    twin.setDrawRange(g.drawRange.start, g.drawRange.count);
    const make = (mg: THREE.BufferGeometry): THREE.InstancedMesh => {
      const mesh = new THREE.InstancedMesh(mg, mat, cap);
      mesh.name = name;
      mesh.count = 0;
      mesh.frustumCulled = false;                           // the window moves with the player; one sphere per refill would do too
      mesh.castShadow = false; mesh.receiveShadow = true;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      if (tinted) { mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); mesh.instanceColor.setUsage(THREE.DynamicDrawUsage); }
      for (const [attr, w] of [['aGround', 3], ['aCover', 4], ['aNrm', 4]] as const) { const a = new THREE.InstancedBufferAttribute(new Float32Array(cap * w), w); a.setUsage(THREE.DynamicDrawUsage); mg.setAttribute(attr, a); }
      // both start visible (at count 0, drawing nothing) so the boot's first frames create both meshes' GPU buffers; the
      // back one is hidden again at the first swap
      this.group.add(mesh);
      return mesh;
    };
    return new CoverTier([make(g), make(twin)], 4 * (16 + (tinted ? 3 : 0) + 3 + 4 + 4));
  }

  /** Drop every cached cell and refill both tiers next update (the shard's placement rules changed). */
  reset(): void {
    this.cells.clear();
    this.last.set(1e9, 0, 1e9); this.farLast.set(1e9, 0, 1e9);
  }

  /** a cell's candidates per kind (STRIDE floats each) — generated once, then cached */
  private cell(cx: number, cz: number): Float32Array[] {
    const key = `${cx},${cz}`;
    const hit = this.cells.get(key);
    if (hit) return hit;
    const row = this.row, CELL = row.cell, hooks = this.o.hooks, site = this.site, gd = this.ground;
    const rng = new Rng(this.o.seed ^ Math.imul(cx + 1013, 73856093) ^ Math.imul(cz + 2027, 19349663));
    // one candidate set per cell, the site read once per point, then a density lottery per kind
    const n = row.candidates;
    // written into per-kind scratch (a kind takes at most one plant per candidate), then one exact copy per kind
    const kinds = this.kinds, nk = kinds.length, len = this.cellLens;
    while (this.scratch.length < nk) this.scratch.push(new Float32Array(n * STRIDE));
    len.length = nk; len.fill(0);
    for (let i = 0; i < n; i++) {
      const x = (cx + rng.next()) * CELL, z = (cz + rng.next()) * CELL;
      if (!hooks.site(x, z, site)) continue;
      const { nx, ny, nz } = site;
      for (let ki = 0; ki < nk; ki++) {
        const k = kinds[ki], out = this.scratch[ki];
        if (k === undefined || out === undefined) continue;
        const d = hooks.density(ki, site);
        if (rng.next() * 2 > d) continue;
        const jx = x + rng.range(-0.3, 0.3), jz = z + rng.range(-0.3, 0.3), sc = rng.range(k.scale[0], k.scale[1]);
        if (hooks.tinted(ki)) hooks.tint(ki, site, rng, this.tint); else this.tint.setRGB(1, 1, 1);
        const yaw = rng.range(0, Math.PI * 2);
        hooks.ground(jx, jz, site, gd);
        const o = len[ki] ?? 0;
        out[o] = jx; out[o + 1] = gd.y - row.sink; out[o + 2] = jz; out[o + 3] = yaw; out[o + 4] = sc;
        out[o + 5] = this.tint.r; out[o + 6] = this.tint.g; out[o + 7] = this.tint.b;
        out[o + 8] = gd.r; out[o + 9] = gd.g; out[o + 10] = gd.b;
        out[o + 11] = nx; out[o + 12] = ny; out[o + 13] = nz;
        out[o + 14] = gd.side; out[o + 15] = gd.cr; out[o + 16] = gd.cg; out[o + 17] = gd.cb; out[o + 18] = gd.top;
        len[ki] = o + STRIDE;
      }
    }
    const out: Float32Array[] = [];
    for (let ki = 0; ki < nk; ki++) out.push((this.scratch[ki] ?? new Float32Array(0)).slice(0, len[ki] ?? 0));
    if (this.cells.size > this.cacheMax) { const first = this.cells.keys().next().value; if (first !== undefined) this.cells.delete(first); }
    this.cells.set(key, out);
    return out;
  }

  /** copy every cached plant that can show before the next refill (its edge + `refill`) into its kind's back buffers
   *  (`update` uploads and swaps them) */
  private refill(px: number, py: number, pz: number): void {
    const t0 = diagnosticNow(), row = this.row, CELL = row.cell;
    for (const k of this.kinds) k.set.begin();
    const arrs = this.kinds.map((k) => k.set.arrays());
    const R = this.rMax, c0x = Math.floor((px - R) / CELL), c1x = Math.floor((px + R) / CELL), c0z = Math.floor((pz - R) / CELL), c1z = Math.floor((pz + R) / CELL);
    const counts = this.kinds.map(() => 0);
    const TAU = Math.PI * 2, up = this.uniforms.uReachUp.value;
    // nearest cells first: a kind that runs into its cap then drops its furthest (thinnest) plants, not a corner
    const order: [number, number, number][] = [];
    for (let cz = c0z; cz <= c1z; cz++) for (let cx = c0x; cx <= c1x; cx++) {
      const dx = Math.max(0, cx * CELL - px, px - (cx + 1) * CELL), dz = Math.max(0, cz * CELL - pz, pz - (cz + 1) * CELL);
      if (dx * dx + dz * dz <= R * R) order.push([cx, cz, dx * dx + dz * dz]);
    }
    order.sort((a, b) => a[2] - b[2]);
    for (const [cx, cz] of order) {
      const data = this.cell(cx, cz);
      this.kinds.forEach((k, ki) => {
        const v = data[ki];
        if (v === undefined) return;
        const near = k.reach.x, far = k.reach.y, grow = k.reach.z, slack = row.refill + row.eyeSlack;
        const A = arrs[ki];
        if (A === undefined) return;
        const { mat, col, gnd, cov, nrm } = A;
        let n = counts[ki] ?? 0;
        for (let i = 0; i < v.length && n < k.cap; i += STRIDE) {
          const x = v[i] ?? 0, y = v[i + 1] ?? 0, z = v[i + 2] ?? 0, yaw = v[i + 3] ?? 0;
          // this plant's edge (the shader's): yaw / 2π; round the wrap (the GPU's atan may land either side) to the far end
          const d2 = (x - px) ** 2 + (y - py) ** 2 + (z - pz) ** 2, rk = this.reachMax(v, i, up, row.refill + row.eyeSlack);
          const h = yaw / TAU, edge = (h < 0.005 || h > 0.995 ? far : near + grow + (far - near - grow) * h) * rk, lim = edge + slack;
          if (d2 > lim * lim) continue;
          const s = v[i + 4] ?? 1, c = Math.cos(yaw) * s, sn = Math.sin(yaw) * s, o = n * 16;
          // a turn about +y, scaled: what Matrix4.compose writes, without the quaternion
          mat[o] = c; mat[o + 1] = 0; mat[o + 2] = -sn; mat[o + 3] = 0;
          mat[o + 4] = 0; mat[o + 5] = s; mat[o + 6] = 0; mat[o + 7] = 0;
          mat[o + 8] = sn; mat[o + 9] = 0; mat[o + 10] = c; mat[o + 11] = 0;
          mat[o + 12] = x; mat[o + 13] = y; mat[o + 14] = z; mat[o + 15] = 1;
          if (col) { col[n * 3] = v[i + 5] ?? 1; col[n * 3 + 1] = v[i + 6] ?? 1; col[n * 3 + 2] = v[i + 7] ?? 1; }
          gnd[n * 3] = v[i + 8] ?? 0; gnd[n * 3 + 1] = v[i + 9] ?? 0; gnd[n * 3 + 2] = v[i + 10] ?? 0;
          nrm.set(v.subarray(i + 11, i + 15), n * 4); cov.set(v.subarray(i + 15, i + 19), n * 4);
          n++;
        }
        counts[ki] = n;
      });
    }
    this.kinds.forEach((k, ki) => { k.set.n = counts[ki] ?? 0; });
    this.stats.nearRefillMs = diagnosticNow() - t0;
  }

  /**
   * The far tier's rebuild, a slice of cells per step (nearest first): every plant whose far model can show before the
   * next rebuild lands — past its near edge less `farSlack`, inside its far edge plus `farSlack` — into the back meshes
   * (`update` uploads what it wrote a slice a frame and swaps them in once the job is done and it is all uploaded).
   * A cap cuts the furthest (thinnest) first.
   */
  private *farRefill(px: number, py: number, pz: number): Generator<undefined, undefined, undefined> {
    const row = this.row, CELL = row.cell;
    const R = this.rFar, c0x = Math.floor((px - R) / CELL), c1x = Math.floor((px + R) / CELL), c0z = Math.floor((pz - R) / CELL), c1z = Math.floor((pz + R) / CELL);
    const cellsAt: [number, number, number][] = [];
    for (let cz = c0z; cz <= c1z; cz++) for (let cx = c0x; cx <= c1x; cx++) {
      const dx = Math.max(0, cx * CELL - px, px - (cx + 1) * CELL), dz = Math.max(0, cz * CELL - pz, pz - (cz + 1) * CELL);
      if (dx * dx + dz * dz <= R * R) cellsAt.push([cx, cz, dx * dx + dz * dz]);
    }
    cellsAt.sort((a, b) => a[2] - b[2]);
    for (const k of this.kinds) k.far?.set.begin();
    const arrs = this.kinds.map((k) => k.far?.set.arrays() ?? null);
    const TAU = Math.PI * 2, slack = row.farSlack + row.eyeSlack, up = this.uniforms.uReachUp.value;
    for (const [cx, cz] of cellsAt) {
      if (!this.cells.has(`${cx},${cz}`)) { this.cell(cx, cz); this.stats.cellsBuilt++; yield undefined; } // a new cell is its own slice
      const data = this.cell(cx, cz);
      this.kinds.forEach((k, ki) => {
        const f = k.far, v = data[ki];
        if (f === null || v === undefined) return;
        const near = k.reach.x, grow = k.reach.z, far = k.reach.y, fNear = f.reach.x, fFar = f.reach.y, fGrow = f.reach.z;
        const st = arrs[ki], keep = f.keep;
        if (!st) return;
        let n = f.set.n;
        for (let i = 0; i < v.length && n < f.cap; i += STRIDE) {
          const x = v[i] ?? 0, y = v[i + 1] ?? 0, z = v[i + 2] ?? 0, yaw = v[i + 3] ?? 0;
          const h = yaw / TAU, wrap = h < 0.005 || h > 0.995;
          if (keep < 1 && ((h * 97.13) % 1) >= keep) continue;           // not one of the kind's far plants
          const d2 = (x - px) ** 2 + (y - py) ** 2 + (z - pz) ** 2, rk = this.reachMax(v, i, up, row.farSlack);
          const edge = (wrap ? near + grow : near + grow + (far - near - grow) * h) * rk, fEdge = (wrap ? fFar : fNear + fGrow + (fFar - fNear - fGrow) * h) * rk;
          // the lower bound takes the plant's reach at 1× (the camera may climb and the strength fall before the next rebuild)
          const lo = Math.max(0, (edge / rk) - grow - slack), hi = fEdge + slack;
          if (d2 > hi * hi || d2 < lo * lo) continue;
          // the far model is its near one's size
          const s = v[i + 4] ?? 1, c = Math.cos(yaw) * s, sn = Math.sin(yaw) * s, o = n * 16, m = st.mat;
          m[o] = c; m[o + 1] = 0; m[o + 2] = -sn; m[o + 3] = 0;
          m[o + 4] = 0; m[o + 5] = s; m[o + 6] = 0; m[o + 7] = 0;
          m[o + 8] = sn; m[o + 9] = 0; m[o + 10] = c; m[o + 11] = 0;
          m[o + 12] = x; m[o + 13] = y; m[o + 14] = z; m[o + 15] = 1;
          if (st.col) { st.col[n * 3] = v[i + 5] ?? 1; st.col[n * 3 + 1] = v[i + 6] ?? 1; st.col[n * 3 + 2] = v[i + 7] ?? 1; }
          st.gnd[n * 3] = v[i + 8] ?? 0; st.gnd[n * 3 + 1] = v[i + 9] ?? 0; st.gnd[n * 3 + 2] = v[i + 10] ?? 0;
          st.nrm.set(v.subarray(i + 11, i + 15), n * 4); st.cov.set(v.subarray(i + 15, i + 19), n * 4);
          n++;
        }
        f.set.n = n;
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

  /** Steps the cover: the viewer uniform, the near refill and the far job, their uploads and swaps. */
  update(dt: number, viewer: THREE.Vector3): void {
    const row = this.row, REFILL_M = row.refill, NEAR_LAG = row.nearLag, FAR_SLACK = row.farSlack, sr = row.slopeReach;
    this.uniforms.uPlayer.value.copy(viewer);
    // full strength on foot (the viewer is the player's feet), none from high up
    this.uniforms.uReachUp.value = 1 - ss(sr.fadeFrom, sr.fadeTo, viewer.y - this.o.heightAt(viewer.x, viewer.z));
    // in 3D: a flying camera climbs and dives, and the reach is measured from the camera. The next near set is built
    // NEAR_LAG m early and uploads a slice a frame; it must be shown before the viewer is REFILL_M from where the shown one
    // was built, so it swaps by NEAR_LAG m of travel whatever is left (`last` = where the newest set was built).
    let budget = row.uploadBytes, used = 0;
    const moved = this.last.distanceToSquared(viewer);
    if (moved > REFILL_M * REFILL_M) {
      // the first frame, a teleport, a reset: all of it, this frame
      this.last.copy(viewer);
      this.refill(viewer.x, viewer.y, viewer.z);
      this.nearPending = true;
      budget = Infinity;
    } else if (!this.nearPending && moved > (REFILL_M - NEAR_LAG) ** 2) {
      this.last.copy(viewer);
      this.refill(viewer.x, viewer.y, viewer.z);
      this.nearPending = true;
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

  /** the row's edits on one material: its reach, far reach, mode and keep as uniforms (the shared ones beside them) */
  private patch(mat: THREE.MeshStandardMaterial, reach: THREE.Vector3, far: THREE.Vector3, mode: number, keep: number): void {
    const u = this.uniforms, uReach = { value: reach }, uFarSpan = { value: far }, uMode = { value: mode }, uFarIn = this.farIn, uKeep = { value: keep };
    const sr = this.row.slopeReach, family = new ShaderFamily({}, {});
    const splices = { ...this.o.glsl, reachUp: (sr.up - 1).toFixed(3), slopeLo: sr.lo.toFixed(3), slopeHi: sr.hi.toFixed(3) };
    const edits = this.row.edits.map((e) => (typeof e.put === 'string' ? { ...e, put: family.glsl(e.put, splices) } : e));
    patchShader(mat, this.row.patchId, PATCH_ORDER.material, (sh) => {
      attachFogUniforms(sh);
      sh.uniforms['uPlayer'] = u.uPlayer; sh.uniforms['uTime'] = windUniforms.uWindTime; sh.uniforms['uWind'] = windUniforms.uGust; sh.uniforms['uReach'] = uReach;
      sh.uniforms['uFarReach'] = uFarSpan; sh.uniforms['uMode'] = uMode; sh.uniforms['uFarIn'] = uFarIn;
      sh.uniforms['uReachUp'] = u.uReachUp; sh.uniforms['uKeep'] = uKeep;
      editShader(sh, edits);
    }, { mode: 'replace', key: this.row.patchKey });
  }
}
