import * as THREE from 'three';
import { modelContext, type ModelContext, type ModelDef, type Placement } from '@wildshard/engine/models/model';
import { place, type Placed } from '@wildshard/engine/models/place';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { AmbientFlock } from '@wildshard/engine/ai/ambientFlock';
import type { AmbientFlockData } from '@wildshard/format/ambientLife';

/**
 * A sea floor's reef as rows (SHARD-PLATFORM M3, look-family rows; W2 C2 baked its scatter): a baked layout of reefs, beds
 * and a scatter (generators/reefScatter.ts, data/reefLayout.generated.json) welded into ONE flat-shaded mesh (one draw
 * call; the weld is baked too), each kind placed `drawnInto` that mesh (`ReefBed.build`); and a school of fish placed
 * instanced over the densest reef, swum on an ambient flock's wheel (the row's `swim`, centred on the baked school). Nothing collides. Nothing here knows a shard:
 * its numbers are a row in its `data/`, its models, material and layout are its own.
 *
 *   const bed = new ReefBed(sky, row, models, params).build(layout, heightAt, batch);
 *   scene.add(bed.mesh);
 *   game.onUpdate((dt) => bed.tick(dt));
 */

/** One copy's numbers: size, turn about +Y and which tint (0..1). */
export interface ReefBedParams { readonly s: number; readonly rot: number; readonly v: number }
/** One baked copy: its kind (the row's names) and where. */
export interface ReefBedSpec { readonly kind: string; readonly x: number; readonly z: number; readonly s: number; readonly rot: number; readonly v: number }
/** The baked school: centre, depth, radius, count and each fish's tint. */
export interface ReefSchool { readonly x: number; readonly z: number; readonly y: number; readonly r: number; readonly n: number; readonly fish: readonly { readonly colour: number }[] }
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
/** what the bed reads off its row (data/seabedLook.ts SEABED; the scatter is baked): the weld's and the school's names, and
 *  the school's swim (an ambient flock row whose wheel the baked school centres) */
export interface ReefBedRow { readonly mesh: string; readonly piecePrefix: string; readonly fishMesh: string; readonly fishPiece: string; readonly swim: AmbientFlockData }

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
  private swim?: AmbientFlock;
  private readonly centre = { x: 0, y: 0, z: 0 };
  private readonly tmp = { m: new THREE.Matrix4(), p: new THREE.Vector3(), q: new THREE.Quaternion(), e: new THREE.Euler(), s: new THREE.Vector3() };

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

  /** the school: the fish placed instanced (their baked colours per copy), swum on the row's wheel over the reef */
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
    const swim = this.row.swim, wheel = swim.wheeling;
    if (wheel === null) throw new Error('[reefBed] a school swims on a wheel');
    this.centre.x = s.x; this.centre.y = s.y; this.centre.z = s.z;
    this.swim = new AmbientFlock({ ...swim, count: s.n, wheeling: { ...wheel, centre: { x: s.x, z: s.z }, radius: s.r, altitude: [s.y, s.y] } });
    this.tick(0);
  }

  /** The sway clock and the school's poses (the model faces -z: the flock's heading turned round). */
  tick(dt: number): void {
    const clock = this.uniforms;
    if (clock) clock.uTime.value += dt;
    this.step?.();
    const swim = this.swim, mesh = this.fish;
    if (!swim || !mesh) return;
    swim.update(dt, this.centre);
    const { m, p, q, e, s: sc } = this.tmp;
    for (let i = 0; i < 64; i++) { // a school is at most 64 fish (buildSchool)
      const fish = swim.birds[i];
      if (fish === undefined) break;
      e.set(fish.pitch, fish.yaw + Math.PI, fish.roll, 'YXZ');
      q.setFromEuler(e); p.set(fish.x, fish.y, fish.z); sc.setScalar(0.65 + fish.scale * 0.6);
      mesh.setMatrixAt(i, m.compose(p, q, sc));
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
}
