import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CHUNK_HALF } from '@wildshard/engine/core/config';
import { Noise2D } from '@wildshard/engine/core/noise';
import { Rng } from '@wildshard/engine/core/rng';
import { modelContext, type ModelContext, type ModelDef, type ModelPart, type Placement } from '@wildshard/engine/models/model';
import { place, type Placed } from '@wildshard/engine/models/place';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';

/**
 * A sea floor's reef as rows (SHARD-PLATFORM M3, look-family rows): where the water is shallow enough, noise-clustered
 * reefs of one kind, beds of another and a scatter of a third (`scatterReefBed`, from the shard's numbers), welded into ONE
 * flat-shaded mesh (one draw call) from the shard's models in scatter order, from one rng stream, each kind placed
 * `drawnInto` that mesh (`ReefBed.build`); and a school of fish placed instanced over the densest reef, swum round a
 * lissajous loop every frame. Nothing collides. Nothing here knows a shard: its numbers are a row in its `data/`, its
 * models, material, depth and clear ground are its own.
 *
 *   const bed = new ReefBed(sky, models).build(scatterReefBed(row, ground, seed, count, avoid));
 *   scene.add(bed.mesh);
 *   game.onUpdate((dt) => bed.update(dt));
 */

/** One copy's numbers: size, turn about +Y and which tint (0‥1). */
export interface ReefBedParams { readonly s: number; readonly rot: number; readonly v: number }
/** One scattered copy: its kind (the row's names) and where. */
export interface ReefBedSpec { kind: string; x: number; z: number; s: number; rot: number; v: number }
/** The school's centre, radius and count. */
export interface ReefSchool { x: number; z: number; y: number; r: number; n: number }
/** A scatter: its copies and the school over the densest reef. */
export interface ReefBedLayout { items: ReefBedSpec[]; school?: ReefSchool | undefined }

/** One noise field: its seed (added to the shard's), frequency, octaves and x offset. */
export interface ReefNoiseRow { readonly seed: number; readonly freq: number; readonly octaves: number; readonly offset: number }

/** The scatter's numbers as data. */
export interface ReefBedRow {
  /** the scatter's rng salt (xor the shard's seed), tries per copy and the margin kept from the chunk's edge (m) */
  readonly salt: number;
  readonly tries: number;
  readonly margin: number;
  /** water depth range (m) and the ground's least normal y (sampled `normalReach` m wide) */
  readonly depth: readonly [number, number];
  readonly normalReach: number;
  readonly minNy: number;
  readonly reefNoise: ReefNoiseRow;
  readonly bedNoise: ReefNoiseRow;
  /** the reef kind: where the reef noise is over `above` and the roll under `roll`, kept with p = (noise − above) × gain +
   *  base, `spacing` m apart, sized `scale` × (1 + max(0, noise) × grow) */
  readonly reef: { readonly kind: string; readonly above: number; readonly roll: number; readonly gain: number; readonly base: number; readonly spacing: number; readonly scale: readonly [number, number]; readonly grow: number };
  /** the bed kind: likewise on the bed noise, sized `scale` × (from + min(1, depth / full) × grow) */
  readonly bed: { readonly kind: string; readonly above: number; readonly roll: number; readonly gain: number; readonly base: number; readonly spacing: number; readonly scale: readonly [number, number]; readonly from: number; readonly full: number; readonly grow: number };
  /** the scattered kind: a roll past the bed's, kept with p = `chance` */
  readonly scatter: { readonly kind: string; readonly chance: number; readonly spacing: number; readonly scale: readonly [number, number] };
  /** the school: over the reef copy with the most reef copies within `radius`, at depth share `depthShare` (at most
   *  `maxDepth` m down), swimming a loop of radius `r`, `n` fish */
  readonly school: { readonly radius: number; readonly depthShare: number; readonly maxDepth: number; readonly r: number; readonly n: number };
  /** the weld's and the school's rng seeds */
  readonly buildSeed: number;
  readonly schoolSeed: number;
  /** the weld mesh's name and its kinds' piece ids (`<piecePrefix><kind>`); the school's mesh name and piece id */
  readonly mesh: string;
  readonly piecePrefix: string;
  readonly fishMesh: string;
  readonly fishPiece: string;
}

/** The ground the scatter reads. */
export interface ReefGround {
  /** the water surface's height */
  readonly level: number;
  readonly heightAt: (x: number, z: number) => number;
  /** the ground's normal y at (x, z), sampled `reach` m wide */
  readonly normalY: (x: number, z: number, reach: number) => number;
  /** whether a copy may stand at (x, z) (inside the chunk, off the shard's own keep-clear ground) */
  readonly clear: (x: number, z: number) => boolean;
}

/** The reef's rule: copies where the water is `depth` deep on gentle slopes, `avoid` kept clear; the school over the densest reef. */
export function scatterReefBed(row: ReefBedRow, ground: ReefGround, seed: number, count: number, avoid: readonly { x: number; z: number; r: number }[] = []): ReefBedLayout {
  const rng = new Rng(seed ^ row.salt), reefN = new Noise2D(seed + row.reefNoise.seed), bedN = new Noise2D(seed + row.bedNoise.seed);
  const level = ground.level, m = row.margin, R = row.reef, B = row.bed, S = row.scatter;
  const items: ReefBedSpec[] = [];
  let tries = 0;
  const ok = (x: number, z: number, minD: number) => {
    if (!ground.clear(x, z)) return false;
    if (avoid.some((a) => Math.hypot(a.x - x, a.z - z) < a.r)) return false;
    return !items.some((p) => Math.hypot(p.x - x, p.z - z) < minD);
  };
  while (items.length < count && tries++ < count * row.tries) {
    const x = rng.range(-CHUNK_HALF + m, CHUNK_HALF - m), z = rng.range(-CHUNK_HALF + m, CHUNK_HALF - m);
    const d = level - ground.heightAt(x, z);
    if (d < row.depth[0] || d > row.depth[1]) continue;
    const ny = ground.normalY(x, z, row.normalReach);
    if (ny < row.minNy) continue;
    const rn = row.reefNoise, bn = row.bedNoise;
    const r = reefN.fbm(x * rn.freq + rn.offset, z * rn.freq, rn.octaves), b = bedN.fbm(x * bn.freq + bn.offset, z * bn.freq, bn.octaves);
    const roll = rng.next();
    if (r > R.above && roll < R.roll) {
      // a reef: denser toward the reef's heart
      if (rng.next() > (r - R.above) * R.gain + R.base) continue;
      if (!ok(x, z, R.spacing)) continue;
      items.push({ kind: R.kind, x, z, s: rng.range(R.scale[0], R.scale[1]) * (1 + Math.max(0, r) * R.grow), rot: rng.range(0, Math.PI * 2), v: rng.next() });
    } else if (b > B.above && roll < B.roll) {
      if (rng.next() > (b - B.above) * B.gain + B.base) continue;
      if (!ok(x, z, B.spacing)) continue;
      items.push({ kind: B.kind, x, z, s: rng.range(B.scale[0], B.scale[1]) * (B.from + Math.min(1, d / B.full) * B.grow), rot: rng.range(0, Math.PI * 2), v: rng.next() });
    } else if (roll >= B.roll && rng.next() < S.chance) {
      if (!ok(x, z, S.spacing)) continue;
      items.push({ kind: S.kind, x, z, s: rng.range(S.scale[0], S.scale[1]), rot: rng.range(0, Math.PI * 2), v: rng.next() });
    }
  }
  // the fish school: over the densest reef patch placed, at mid-depth
  const sc = row.school;
  let best: ReefBedSpec | undefined, bestN = -1;
  for (const p of items) {
    if (p.kind !== R.kind) continue;
    let n = 0; for (const q of items) if (q.kind === R.kind && Math.hypot(q.x - p.x, q.z - p.z) < sc.radius) n++;
    if (n > bestN) { bestN = n; best = p; }
  }
  const school = best ? { x: best.x, z: best.z, y: level - Math.min(sc.maxDepth, (level - ground.heightAt(best.x, best.z)) * sc.depthShare), r: sc.r, n: sc.n } : undefined;
  return { items, school };
}

/** The reef's models: one per kind, the weld's material (with its sway clock) and the school's fish and tints. */
export interface ReefBedModels<P extends ReefBedParams> {
  readonly kinds: Readonly<Record<string, ModelDef<P>>>;
  readonly material: (ctx: ModelContext) => { material: THREE.Material; uniforms: { uTime: THREE.IUniform<number> } };
  readonly fish: ModelDef<Record<string, never>>;
  readonly fishColours: readonly number[];
}

const isParts = (b: readonly ModelPart[] | THREE.Object3D): b is readonly ModelPart[] => Array.isArray(b);
const isInstanced = (o: THREE.Object3D): o is THREE.InstancedMesh => o instanceof THREE.InstancedMesh;

/** A welded reef and its school (see the module comment). */
export class ReefBed<P extends ReefBedParams> {
  /** its placements (the named places' sets read them) */
  readonly placed: Placed[] = [];
  private weld: THREE.Mesh | null = null;
  /** the school, when the layout has one */
  fish?: THREE.InstancedMesh;
  /** copies welded and their triangles */
  count = 0; tris = 0;
  private readonly sky: Sky;
  private readonly row: ReefBedRow;
  private readonly models: ReefBedModels<P>;
  private readonly params: (spec: ReefBedSpec) => P;
  /** the reef's sway clock (its material's) */
  private uniforms: { uTime: THREE.IUniform<number> } | null = null;
  private school?: ReefSchool & { seeds: Float32Array };
  private readonly tmp = { m: new THREE.Matrix4(), p: new THREE.Vector3(), q: new THREE.Quaternion(), e: new THREE.Euler(), s: new THREE.Vector3(), f: new THREE.Vector3() };

  /** The weld (after `build`). */
  get mesh(): THREE.Mesh {
    if (this.weld === null) throw new Error('[reefBed] not built');
    return this.weld;
  }

  /** The sky, the row, the models and how a scattered copy becomes its model's params. */
  constructor(sky: Sky, row: ReefBedRow, models: ReefBedModels<P>, params: (spec: ReefBedSpec) => P) {
    this.sky = sky; this.row = row; this.models = models; this.params = params;
  }

  /** Welds every copy in scatter order (one rng stream across the kinds), places each kind drawnInto it, builds the school. */
  build(layout: ReefBedLayout | ReefBedSpec[], heightAt: (x: number, z: number) => number): this {
    const specs = Array.isArray(layout) ? layout : layout.items;
    const ctx = modelContext(this.sky), row = this.row;
    const rng = new Rng(row.buildSeed);
    const parts: THREE.BufferGeometry[] = [];
    const kinds = new Map<string, { pls: Placement<P>[]; boxes: number[] }>();
    const box = new THREE.Box3();
    for (const p of specs) {
      const def = this.models.kinds[p.kind];
      if (def === undefined) continue;
      const y = heightAt(p.x, p.z), params = this.params(p);
      const built = def.build(ctx, params, rng), part = isParts(built) ? built[0] : undefined;
      if (!part) continue;
      const g = part.geometry.translate(p.x, y, p.z);
      parts.push(g);
      g.computeBoundingBox();
      box.copy(g.boundingBox ?? box);
      let k = kinds.get(p.kind);
      if (!k) { k = { pls: [], boxes: [] }; kinds.set(p.kind, k); }
      k.pls.push({ x: p.x, y, z: p.z, params });
      k.boxes.push(box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z);
      this.count++;
    }
    const geo = mergeGeometries(parts, false);
    geo.computeBoundingSphere();
    this.tris = geo.getAttribute('position').count / 3;
    const { material, uniforms } = this.models.material(ctx);
    this.uniforms = uniforms;
    const mesh = new THREE.Mesh(geo, material);
    this.weld = mesh;
    mesh.castShadow = false; mesh.receiveShadow = true;
    mesh.name = row.mesh;
    for (const [kind, k] of kinds) {
      const def = this.models.kinds[kind];
      if (def !== undefined) this.placed.push(place(def, k.pls, { ctx, draw: 'merged', drawnInto: { object: mesh, boxes: Float32Array.from(k.boxes) }, piece: { id: `${row.piecePrefix}${kind}` } }));
    }
    if (!Array.isArray(layout) && layout.school) this.buildSchool(ctx, layout.school);
    return this;
  }

  /** the school: the fish placed instanced (their colours per copy), swum round a lissajous loop over the reef */
  private buildSchool(ctx: ModelContext, s: ReefSchool): void {
    const rng = new Rng(this.row.schoolSeed), colours = this.models.fishColours;
    const n = s.n, seeds = new Float32Array(n * 3), pls: Placement<Record<string, never>>[] = [];
    for (let i = 0; i < n; i++) {
      const cc = colours[Math.floor(rng.next() * colours.length)];
      if (cc === undefined) throw new Error('[reefBed] fish tint index out of range');
      pls.push({ x: s.x, y: s.y, z: s.z, color: cc });
      seeds[i * 3] = rng.range(0, Math.PI * 2); seeds[i * 3 + 1] = rng.range(0.6, 1); seeds[i * 3 + 2] = rng.range(-1, 1);
    }
    const placed = place(this.models.fish, pls, { ctx, draw: 'instanced', piece: { id: this.row.fishPiece } });
    this.placed.push(placed);
    const mesh = placed.object;
    if (!isInstanced(mesh)) return;
    // they swim: posed every frame (update), never culled as a set
    mesh.frustumCulled = false;
    mesh.name = this.row.fishMesh;
    this.fish = mesh;
    this.school = { ...s, seeds };
    this.update(0);
  }

  /** The sway clock and the school's poses. */
  update(dt: number): void {
    const clock = this.uniforms;
    if (clock) clock.uTime.value += dt;
    const s = this.school, mesh = this.fish;
    if (!s || !mesh) return;
    const t = (clock?.uTime.value ?? 0) * 0.35, { m, p, q, e, s: sc, f } = this.tmp;
    for (let i = 0; i < s.n; i++) {
      const ph = s.seeds[i * 3] ?? 0, spd = s.seeds[i * 3 + 1] ?? 0, off = s.seeds[i * 3 + 2] ?? 0;
      const u = t * spd + ph;
      // lissajous loop around the school centre, each fish on its own offset ring; a little bob
      const x = s.x + Math.sin(u) * s.r * (1 + off * 0.25) + Math.cos(u * 2.3 + ph) * 0.6;
      const z = s.z + Math.sin(u * 0.5 + 1.2) * s.r * 0.8 + Math.sin(u * 1.7 + ph) * 0.5;
      const y = s.y + Math.sin(u * 1.3 + ph) * 0.5 + off * 0.4;
      // heading = the path tangent (finite difference)
      const du = 0.05;
      f.set(Math.sin(u + du) * s.r * (1 + off * 0.25) + Math.cos((u + du) * 2.3 + ph) * 0.6 - (x - s.x), Math.sin((u + du) * 1.3 + ph) * 0.5 + off * 0.4 - (y - s.y), Math.sin((u + du) * 0.5 + 1.2) * s.r * 0.8 + Math.sin((u + du) * 1.7 + ph) * 0.5 - (z - s.z));
      const yaw = Math.atan2(-f.x, -f.z), pitch = Math.atan2(f.y, Math.hypot(f.x, f.z));
      e.set(pitch, yaw, Math.sin(u * 9 + ph) * 0.15, 'YXZ');
      q.setFromEuler(e); p.set(x, y, z); sc.setScalar(0.8 + spd * 0.5);
      mesh.setMatrixAt(i, m.compose(p, q, sc));
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
}
