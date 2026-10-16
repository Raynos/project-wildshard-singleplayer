import * as THREE from 'three';
import { modelContext, type ModelContext, type ModelDef, type Placement } from '@wildshard/engine/models/model';
import { place, type Placed } from '@wildshard/engine/models/place';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import type { ReefBedRow } from './rows';

/**
 * A sea floor's reef as rows (SHARD-PLATFORM M3, look-family rows; W2 C2 baked its scatter): a baked layout of reefs, beds
 * and a scatter (generators/reefScatter.ts, data/reefLayout.generated.json) welded into ONE flat-shaded mesh (one draw
 * call; the weld is baked too), each kind placed `drawnInto` that mesh (`ReefBed.build`); and a school of fish placed
 * instanced over the densest reef, swum round a lissajous loop every frame. Nothing collides. Nothing here knows a shard:
 * its numbers are a row in its `data/`, its models, material and layout are its own.
 *
 *   const bed = new ReefBed(sky, row, models, params).build(layout, heightAt, batch);
 *   scene.add(bed.mesh);
 *   game.onUpdate((dt) => bed.update(dt));
 */

/** One copy's numbers: size, turn about +Y and which tint (0..1). */
export interface ReefBedParams { readonly s: number; readonly rot: number; readonly v: number }
/** One baked copy: its kind (the row's names) and where. */
export interface ReefBedSpec { readonly kind: string; readonly x: number; readonly z: number; readonly s: number; readonly rot: number; readonly v: number }
/** The baked school: centre, radius, count and each fish's tint and swim seeds. */
export interface ReefSchool {
  readonly x: number; readonly z: number; readonly y: number; readonly r: number; readonly n: number;
  readonly fish: readonly { readonly colour: number; readonly ph: number; readonly spd: number; readonly off: number }[];
}
/** A baked layout: its copies and the school over the densest reef. */
export interface ReefBedLayout { readonly items: readonly ReefBedSpec[]; readonly school: ReefSchool | null }

/** The reef's models: one per kind, the weld's material (with its sway clock) and the school's fish. */
export interface ReefBedModels<P extends ReefBedParams> {
  readonly kinds: Readonly<Record<string, ModelDef<P>>>;
  readonly material: (ctx: ModelContext) => { material: THREE.Material; uniforms: { uTime: THREE.IUniform<number> }; update?: () => void };
  readonly fish: ModelDef<Record<string, never>>;
}

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
  /** the material's own once-a-frame step, when it has one */
  private step: (() => void) | null = null;
  private school?: ReefSchool;
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

  /** Places each kind of the baked layout drawnInto the baked weld, in scatter order, and builds the school. */
  build(layout: ReefBedLayout, heightAt: (x: number, z: number) => number, batch: {geometry: THREE.BufferGeometry; boxes: Float32Array}): this {
    const specs = layout.items;
    const ctx = modelContext(this.sky), row = this.row;
    if (specs.length > 512 || batch.boxes.length !== specs.length * 6) throw new Error('Reef batch differs from its authored scatter');
    const kinds = new Map<string, { pls: Placement<P>[]; boxes: number[] }>();
    // The owned transport admits at most 512 copies; preserve that bound during registration.
    for (let index = 0; index < 512; index++) {
      if (index === specs.length) break;
      const p = specs[index];
      if (p === undefined) throw new Error('Missing authored reef copy');
      const def = this.models.kinds[p.kind];
      if (def === undefined) throw new Error('Unknown authored reef kind');
      const y = heightAt(p.x, p.z), params = this.params(p);
      let k = kinds.get(p.kind);
      if (!k) { k = { pls: [], boxes: [] }; kinds.set(p.kind, k); }
      k.pls.push({ x: p.x, y, z: p.z, params });
      k.boxes.push(...batch.boxes.subarray(index * 6, (index + 1) * 6));
      this.count++;
    }
    const geo = batch.geometry;
    geo.computeBoundingSphere();
    this.tris = geo.getAttribute('position').count / 3;
    const { material, uniforms, update } = this.models.material(ctx);
    this.uniforms = uniforms; this.step = update ?? null;
    const mesh = new THREE.Mesh(geo, material);
    this.weld = mesh;
    mesh.castShadow = false; mesh.receiveShadow = true;
    mesh.name = row.mesh;
    for (const [kind, k] of kinds) {
      const def = this.models.kinds[kind];
      if (def !== undefined) this.placed.push(place(def, k.pls, { ctx, draw: 'merged', drawnInto: { object: mesh, boxes: Float32Array.from(k.boxes) }, piece: { id: `${row.piecePrefix}${kind}` } }));
    }
    if (layout.school !== null) this.buildSchool(ctx, layout.school);
    return this;
  }

  /** the school: the fish placed instanced (their baked colours per copy), swum round a lissajous loop over the reef */
  private buildSchool(ctx: ModelContext, s: ReefSchool): void {
    if (s.fish.length !== s.n || s.n > 64) throw new Error('[reefBed] a school is its baked fish, at most 64');
    const pls: Placement<Record<string, never>>[] = s.fish.map((f) => ({ x: s.x, y: s.y, z: s.z, color: f.colour }));
    const placed = place(this.models.fish, pls, { ctx, draw: 'instanced', piece: { id: this.row.fishPiece } });
    this.placed.push(placed);
    const mesh = placed.object;
    if (!isInstanced(mesh)) return;
    // they swim: posed every frame (update), never culled as a set
    mesh.frustumCulled = false;
    mesh.name = this.row.fishMesh;
    this.fish = mesh;
    this.school = s;
    this.update(0);
  }

  /** The sway clock and the school's poses. */
  update(dt: number): void {
    const clock = this.uniforms;
    if (clock) clock.uTime.value += dt;
    this.step?.();
    const s = this.school, mesh = this.fish;
    if (!s || !mesh) return;
    const t = (clock?.uTime.value ?? 0) * 0.35, { m, p, q, e, s: sc, f } = this.tmp;
    for (let i = 0; i < 64; i++) { // a school is at most 64 fish (buildSchool)
      const fish = s.fish[i];
      if (fish === undefined) break;
      const { ph, spd, off } = fish;
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
