/**
 * Nalati's models on the model contract (E306 / E315 M3; the contract is src/engine/models/model.ts): how a Nalati model is
 * built, drawn and placed.
 *
 * A Nalati place — a camp, the kurgan field, the watchtower's hill — is ONE painted mesh: every model standing in it is
 * added to one PaintKit (./paint.ts), coloured per vertex in WORLD space (the brush strokes run across neighbouring
 * parts, a lichen top follows the world's up), and the whole place is AO-baked and contact-shaded against the terrain
 * together — a place costs one draw per material however many models stand in it. Its generated models (the TRELLIS /
 * Hunyuan3D-2 GLBs) are one InstancedMesh per model per place, added when the file has loaded. That is the look and
 * the budget the shard was tuned with, so the models keep it:
 *
 *   export const stone = defineModel<P>({ id: 'nalati-grasslands/…', …, build: painted(paintStone, { seed }) });
 *     `paintStone(kit, at, p, c)` paints ONE copy into a kit at a world placement `at`, drawing from the kit's rng in
 *     the order the old builder did (so the move is bit-identical), and returns what it made in world space (`Made`:
 *     its legacy boxes, its colliders, its floor). The Explorer's specimen paints one copy on a kit of its own and
 *     moves it to the origin; a model `fitted` to the ground under it (the bridge finds its ends from the terrain) is
 *     painted at its first real placement for that.
 *   export const tower = defineModel<P>({ …, build: generated({ id, name: 'watchtower', look, pose, collide }) });
 *     a GLB model: the specimen is the loaded file; `pose` turns a copy's placement into the instance's, `collide`
 *     is what it collides with, world space; `lod`, `castShadow` as the place drew it.
 *
 * and a place puts its models through a `NalatiSet`, in the old builder's order:
 *   const set = new NalatiSet(kit, c);
 *   set.paint(stone, { x, y, z, yaw }, params);     // painted into the kit now; the copy recorded
 *   set.instance(tower, { x, y, z, rot }, params);  // instanced when its GLB lands (the place's group)
 *   set.moving(rider, starts);                      // copies the place draws and moves itself: counted, boxed
 *   const mesh = kit.mesh(sky, { ground });  set.flush(group, sky);
 *   set.register({ ctx, object: mesh, group, registry })   // one `place` per model (drawnInto), in order
 * `placeSet` then names the place (src/engine/models/sets.ts; NalatiPOIs' `SETS`). A place's models' colliders come out in the
 * old builder's order (a model's boxes, then its real-geometry colliders; models in the order first put), so the
 * physics world and the navmesh bake see exactly what they did.
 */
import * as THREE from 'three';
import { PaintKit, v3, poiMaterial, texturedMaterial, type ColorLike, type FinishOpts, type Painter, type PaintOpts } from './paint';
import { Flutter } from './Flutter';
import { boxDescs, highest, type Box } from './solid';
import { instanceModel, loadNalatiModel, MODEL_SIZE, MODEL_TRIS, placementMatrix, type ModelLod, type ModelLook, type ModelPlacement, type NalatiModelName } from './modelView';
import type { Rng } from '@wildshard/engine/core/rng';
import type { ModelBuild, ModelContext, ModelDef, ModelPart, Placement } from '@wildshard/engine/models/model';
import { place, type Draw, type Placed } from '@wildshard/engine/models/place';
import type { ColliderDesc, WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import type { NalatiTexName } from '../look/nalatiTextures';
import { NO_PLUMES, type Ground, type Platform, type Plumes } from './types';

/** what a painted model paints into: a place's kit (its one rng stream) */
export interface Kit {
  readonly rng: Rng;
  add: (g: THREE.BufferGeometry, col: ColorLike | Painter, o?: PaintOpts) => void;
}

/** where one copy stands, world space; `yaw` about +y (for a building: the way its door faces, 0 = −z) */
export interface PaintAt { readonly x: number; readonly y: number; readonly z: number; readonly yaw: number }

/** what a painter is handed besides the kit: the ground under it, and the place's shared cloth and smoke (effects) */
export interface PaintCtx {
  readonly ground: Ground;
  readonly flutter: Flutter;
  readonly smoke: Plumes;
}

/** what one copy made, world space: its boxes (data for the weather / the dressing's keep-out; a `ghost` one is data
 *  only), its colliders as real geometry, its walkable top (placement only) */
export interface Made {
  readonly boxes?: readonly Box[];
  readonly descs?: readonly ColliderDesc[];
  readonly floor?: Platform;
}

/** paints one copy of a model into `kit` at `at` */
export type Paint<P, O extends Made = Made> = (kit: Kit, at: PaintAt, p: P, c: PaintCtx) => O;

export interface PaintSpec {
  /** the specimen's kit seed (its rng stream: the shape of a per-copy random model) */
  readonly seed: number;
  /** the finish its place gives it (aoH …; the ground is the place's) */
  readonly finish?: Omit<FinishOpts, 'ground'>;
  /** fitted to the ground under it: the specimen is painted at its first real placement, on the real terrain */
  readonly fitted?: boolean;
  /** the kit's textured layers it paints into (the timber grain, the felt) */
  readonly layers?: readonly NalatiTexName[];
}

type Build<P> = (ctx: ModelContext, p: P, rng: Rng) => ModelBuild;
interface PaintedBuild<P> { (ctx: ModelContext, p: P, rng: Rng): ModelBuild; readonly paint: Paint<P>; readonly spec: PaintSpec }
interface GeneratedBuild<P> { (ctx: ModelContext, p: P, rng: Rng): ModelBuild; readonly gen: GeneratedSpec<P> }
const isPainted = <P>(b: Build<P>): b is PaintedBuild<P> => 'paint' in b;
const isGenerated = <P>(b: Build<P>): b is GeneratedBuild<P> => 'gen' in b;

/** the first copy each fitted model painted (its specimen is painted there) */
const firsts = new WeakMap<object, { at: PaintAt; p: object }>();
const ORIGIN: PaintAt = { x: 0, y: 0, z: 0, yaw: 0 };

/** a painted specimen's geometry: one copy on a kit of its own, moved to the origin, each with its textured layer (null:
 *  the POI material) — `painted`'s build without its materials (the places bake's specimens, generators/places.ts) */
function specimenParts<P extends object>(paint: Paint<P>, spec: PaintSpec, build: object, p: P): { geometry: THREE.BufferGeometry; layer: NalatiTexName | null }[] {
  const first = spec.fitted === true ? firsts.get(build) : undefined;
  const at = first?.at ?? ORIGIN;
  const params: P = first ? { ...p, ...first.p } : p;
  const ground: Ground = first ? (x, z) => heightAt(x, z) : () => at.y;
  const kit = new PaintKit(spec.seed);
  paint(kit, at, params, { ground, flutter: new Flutter(), smoke: NO_PLUMES });
  const o: FinishOpts = { ...spec.finish, ground };
  const parts: { geometry: THREE.BufferGeometry; layer: NalatiTexName | null }[] = [];
  const move = (g: THREE.BufferGeometry): THREE.BufferGeometry => { g.translate(-at.x, -at.y, -at.z); g.computeBoundingSphere(); g.computeBoundingBox(); return g; };
  if (!kit.empty) parts.push({ geometry: move(kit.finish(o)), layer: null });
  for (const name of spec.layers ?? []) {
    const g = kit.finishTextured(o, name);
    if (g) parts.push({ geometry: move(g), layer: name });
  }
  return parts;
}

/** a painted model's `build`: its specimen, one copy on a kit of its own, moved to the origin */
export function painted<P extends object>(paint: Paint<P>, spec: PaintSpec): PaintedBuild<P> {
  const build = (ctx: ModelContext, p: P): ModelPart[] => specimenParts(paint, spec, build, p)
    .map(({ geometry, layer }) => ({ geometry, material: layer === null ? poiMaterial(ctx.sky) : texturedMaterial(ctx.sky, layer), castShadow: true, receiveShadow: true }));
  return Object.assign(build, { paint, spec });
}

/** a painted model's specimen geometry for `p` (its build's parts without materials); refuses any other model */
export function paintedSpecimen<P extends object>(def: ModelDef<P>, p: P): { geometry: THREE.BufferGeometry; layer: NalatiTexName | null }[] {
  const b = def.build;
  if (!isPainted(b)) throw new Error(`paintedSpecimen: ${def.id} is not a painted model`);
  return specimenParts(b.paint, b.spec, b, p);
}

export interface GeneratedSpec<P> {
  /** the model's id: the Explorer's card re-frames when the file lands */
  readonly id: string;
  readonly name: NalatiModelName;
  readonly look?: ModelLook;
  /** which of the file's LODs (the herds draw the far one) */
  readonly lod?: ModelLod;
  /** its instances cast shadows (default true) */
  readonly castShadow?: boolean;
  /** the instance's placement from a copy's (default: the same point, turned `rot`) */
  readonly pose?: (at: ModelPlacement, p: P) => ModelPlacement;
  /** what a copy collides with, world space, from its placement */
  readonly collide?: (at: ModelPlacement, p: P) => Made;
}

/** tell the Explorer a model's specimen has filled in (it re-frames the card) */
export function modelReady(id: string): void {
  if ('document' in globalThis) document.dispatchEvent(new CustomEvent('ws:model-ready', { detail: { id } }));
}

/** a generated (GLB) model's `build`: its specimen is the loaded file (filled in when it lands) */
export function generated<P extends object>(spec: GeneratedSpec<P>): GeneratedBuild<P> {
  const build = (ctx: ModelContext): THREE.Object3D => {
    const g = new THREE.Group();
    loadNalatiModel(ctx.sky, spec.name, spec.look, spec.lod).then((m) => {
      const mesh = new THREE.Mesh(m.geometry, m.material);
      mesh.castShadow = true; mesh.receiveShadow = true;
      g.add(mesh);
      modelReady(spec.id);
      return m;
    }).catch((e: unknown) => { console.warn(`[nalati] model ${spec.name} failed`, e); });
    return g;
  };
  return Object.assign(build, { gen: spec });
}

const _box = new THREE.Box3(), _part = new THREE.Box3(), _pt = new THREE.Vector3();

/** one model's copies in a set as data: where they stand, their boxes, what they made (the places bake writes these rows,
 *  generators/places.ts; the page places them back, ./placeBake.ts) */
export interface MemberData {
  readonly draw: Draw;
  /** true: its copies are painted into the set's kit (its mesh), false: the set's generated instances (its group) */
  readonly inKit: boolean;
  /** where each copy stands (its params stay with what it made: `place` draws nothing, and has no own-space colliders to pose) */
  readonly placements: Omit<Placement<object>, 'params'>[];
  readonly boxes: number[];
  /** its copies' boxes as colliders, then their real-geometry ones (the old builders' order: boxes first) */
  readonly solid: ColliderDesc[];
  readonly descs: ColliderDesc[];
  readonly floors: Platform[];
}

/** a set's generated models' instances of one model: their look and placements */
export interface InstanceData { readonly look: ModelLook; readonly castShadow: boolean; readonly placements: ModelPlacement[] }

/** one model's copies in a set, and how they are placed */
interface Member extends MemberData {
  place: (o: SetRegister, object: THREE.Object3D) => Placed;
}

/** place one model's copies (`drawnInto` the set's mesh or group): what NalatiSet.register does per model */
export function placeMember<P extends object>(def: ModelDef<P>, m: MemberData, o: SetRegister, object: THREE.Object3D): Placed {
  const floor = m.floors.length === 0 ? undefined : m.floors.length === 1 ? m.floors[0] : highest(m.floors);
  return place<P>(def, m.placements, {
    ctx: o.ctx, draw: m.draw, ...(o.registry === undefined ? {} : { registry: o.registry }),
    drawnInto: { object, boxes: Float32Array.from(m.boxes), colliders: [...m.solid, ...m.descs] },
    piece: { solidFloor: true, ...(floor === undefined ? {} : { floor }), ...(o.split === undefined ? {} : { split: o.split }) },
  });
}

/** instance a set's generated models into `group` as their files land: one InstancedMesh per model (a failed load draws
 *  nothing and logs once; its colliders were registered already) */
export function flushInstances(instances: Iterable<readonly [NalatiModelName, InstanceData]>, group: THREE.Object3D, sky: Sky): void {
  for (const [name, l] of instances) {
    if (l.placements.length === 0) continue;
    loadNalatiModel(sky, name, l.look).then((m) => { group.add(instanceModel(m, l.placements, { castShadow: l.castShadow })); return m; })
      .catch((e: unknown) => { console.warn(`[nalati] model ${name} failed`, e); });
  }
}

/** a set's generated models' triangles (the POI's perf report) */
export function instanceTris(instances: Iterable<readonly [NalatiModelName, InstanceData]>): number {
  let n = 0;
  for (const [name, l] of instances) n += MODEL_TRIS[name] * l.placements.length;
  return n;
}

export interface SetRegister {
  readonly ctx: ModelContext;
  readonly registry?: WorldRegistry | null;
  /** the set's painted mesh (its painted models' tap target) */
  readonly object: THREE.Object3D;
  /** where its generated models' instances land (default: `object`) */
  readonly group?: THREE.Object3D;
  /** register each model's colliders `every` at a time, a task apart (the phone's per-task collider budget: `Placed.registered`) */
  readonly split?: { readonly every: number; readonly yieldTask: () => Promise<void> };
}

/**
 * A Nalati place's models, painted into its kit and instanced into its group in the old builder's order, then placed
 * (`register`): one `place` per model, `drawnInto` the place's mesh.
 */
export class NalatiSet {
  /** the kit the painters paint into: the place's own, each part's world box tracked for its copy */
  readonly kit: Kit;
  private readonly members = new Map<string, Member>();
  /** the generated models' instances, per model, in the order they were first put */
  private readonly instances = new Map<NalatiModelName, InstanceData>();
  private tracking = false;
  /** every box every copy made, in order (the POI's `colliders` data) */
  readonly boxes: Box[] = [];

  /** the kit the painters paint into now (`into` moves it: a dressing prop is a kit of its own, finished on its own) */
  private current: PaintKit | null;

  /** `paintKit`: the place's kit (null: a place of generated models only, or one whose props each bring a kit: `into`) */
  constructor(paintKit: PaintKit | null, readonly c: PaintCtx) {
    this.current = paintKit;
    let none: PaintKit | null = null;
    const self = (): PaintKit | null => this.current;
    this.kit = {
      get rng() { return (self() ?? (none ??= new PaintKit(0))).rng; },
      add: (g, col, o) => {
        const k = self();
        if (!k) throw new Error('NalatiSet: this place has no kit to paint into');
        if (this.tracking) {
          const pos = g.getAttribute('position');
          _part.makeEmpty();
          for (let i = 0; i < pos.count; i++) _part.expandByPoint(_pt.set(pos.getX(i), pos.getY(i), pos.getZ(i)));
          if (o?.matrix) _part.applyMatrix4(o.matrix);
          _box.union(_part);
        }
        k.add(g, col, o);
      },
    };
  }

  /** paint into `kit` from now on (its rng is the painters' stream): each dressing prop is a kit of its own */
  into(kit: PaintKit): this { this.current = kit; return this; }

  private member<P extends object>(def: ModelDef<P>, draw: Draw, inKit: boolean): Member {
    let m = this.members.get(def.id);
    if (!m) {
      const mm: Member = {
        draw, inKit, placements: [], boxes: [], solid: [], descs: [], floors: [],
        place: (o, object) => placeMember(def, mm, o, object),
      };
      this.members.set(def.id, mm);
      m = mm;
    }
    return m;
  }

  private record(m: Member, pl: Omit<Placement<object>, 'params'>, box: THREE.Box3, made: Made): void {
    m.placements.push(pl);
    m.boxes.push(box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z);
    const boxes = made.boxes ?? [];
    this.boxes.push(...boxes);
    m.solid.push(...boxDescs(boxes));
    m.descs.push(...(made.descs ?? []));
    if (made.floor) m.floors.push(made.floor);
  }

  /** paint one copy of a painted model into the place's kit, now; returns what it made */
  paint<P extends object>(def: ModelDef<P>, at: PaintAt, p: NoInfer<P>): Made {
    const b = def.build;
    if (!isPainted(b)) throw new Error(`NalatiSet.paint: ${def.id} is not a painted model`);
    _box.makeEmpty();
    this.tracking = true;
    let made: Made;
    try { made = b.paint(this.kit, at, p, this.c); } finally { this.tracking = false; }
    if (b.spec.fitted === true && !firsts.has(b)) firsts.set(b, { at, p });
    this.record(this.member(def, 'merged', true), { x: at.x, y: at.y, z: at.z, yaw: at.yaw }, _box, made);
    return made;
  }

  /** one copy of a generated model, instanced with the place's others of it when its GLB lands; returns what it collides with */
  instance<P extends object>(def: ModelDef<P>, at: ModelPlacement, p: NoInfer<P>): Made {
    const b = def.build;
    if (!isGenerated(b)) throw new Error(`NalatiSet.instance: ${def.id} is not a generated model`);
    const pose = b.gen.pose?.(at, p) ?? at;
    let list = this.instances.get(b.gen.name);
    if (!list) { list = { look: b.gen.look ?? {}, castShadow: b.gen.castShadow ?? true, placements: [] }; this.instances.set(b.gen.name, list); }
    list.placements.push(pose);
    const made = b.gen.collide?.(at, p) ?? {};
    this.record(this.member(def, 'instanced', false), this.generatedCopy(b.gen.name, pose), _box, made);
    return made;
  }

  /**
   * Copies of a generated model the place draws and moves itself (the kokpar's galloping riders, the grazing herds):
   * counted and boxed where they start; nothing collides.
   */
  moving<P extends object>(def: ModelDef<P>, at: readonly ModelPlacement[]): void {
    const b = def.build;
    if (!isGenerated(b)) throw new Error(`NalatiSet.moving: ${def.id} is not a generated model`);
    const m = this.member(def, 'instanced', false);
    for (const pose of at) this.record(m, this.generatedCopy(b.gen.name, pose), _box, {});
  }

  /** a generated copy's placement, and its world box into `_box` (the file's measured size, before it has loaded) */
  private generatedCopy(name: NalatiModelName, pose: ModelPlacement): Omit<Placement<object>, 'params'> {
    const matrix = placementMatrix(pose);
    generatedBounds(name, _box).applyMatrix4(matrix);
    return { x: pose.x, y: pose.y, z: pose.z, matrix };
  }

  /** the generated models' triangles (the POI's perf report) */
  tris(): number { return instanceTris(this.instances); }

  /** instance the generated models into `group` as their files land (`flushInstances`) */
  flush(group: THREE.Object3D, sky: Sky): void { flushInstances(this.instances, group, sky); }

  /** the set as data, in order: each model's copies (by model id) and the generated instances (the places bake) */
  rows(): { readonly members: readonly (readonly [string, MemberData])[]; readonly instances: readonly (readonly [NalatiModelName, InstanceData])[] } {
    return { members: [...this.members.entries()], instances: [...this.instances.entries()] };
  }

  /** place every model of the set, in the order they were first put (so the physics sees the old builder's colliders
   *  in the old order); what each call registered */
  register(o: SetRegister): Placed[] {
    return [...this.members.values()].map((m) => m.place(o, m.inKit ? o.object : o.group ?? o.object));
  }
}

/** Exact numeric floor profile recorded by the static painter. */
export interface CragLedgeFloor { readonly heading?: readonly [number, number]; readonly kind: 'ledge'; readonly x: number; readonly z: number; readonly cs: number; readonly sn: number; readonly hw: number; readonly hd: number; readonly top: number }
export function cragLedgeFloor(row: CragLedgeFloor): Platform & { readonly row: CragLedgeFloor } {
  const { x, z, hw, hd, top, heading } = row;
  const yaw = heading === undefined ? 0 : Math.atan2(heading[0], heading[1]);
  const cs = heading === undefined ? row.cs : Math.cos(yaw), sn = heading === undefined ? row.sn : Math.sin(yaw);
  const floor: Platform = (qx, qz) => { const dx = qx - x, dz = qz - z, lx = dx * cs - dz * sn, lz = dx * sn + dz * cs; return Math.abs(lx) <= hw && Math.abs(lz) <= hd ? top : undefined; };
  return Object.assign(floor, { row });
}

/** Exact porch/cave floor profile, in the original painter's local frame. */
export interface LeopardCaveFloor { readonly kind: 'cave'; readonly x: number; readonly z: number; readonly cs: number; readonly sn: number; readonly mouthW: number; readonly depth: number; readonly porchY: number }
export function leopardCaveFloor(row: LeopardCaveFloor): Platform & { readonly row: LeopardCaveFloor } {
  const { x, z, cs, sn, mouthW, depth, porchY } = row;
  const floor: Platform = (qx, qz) => { const dx = qx - x, dz = qz - z, lx = dx * cs - dz * sn, lz = dx * sn + dz * cs; return Math.abs(lx) <= 3.0 && lz <= 2.1 && lz >= -1.95 ? porchY : Math.abs(lx) <= mouthW / 2 && lz > 2.1 && lz < 2.1 + depth ? porchY : undefined; };
  return Object.assign(floor, { row });
}

/** The authored hood and passage/step profile; collider rows remain independent. */
export interface KurganEntranceFloor { readonly kind: 'entrance'; readonly x: number; readonly z: number; readonly fx: number; readonly fz: number; readonly cw: number; readonly len: number; readonly lintelY: number; readonly dep: number; readonly floorY: number; readonly nSteps: number; readonly rise: number }
export function kurganEntranceFloor(row: KurganEntranceFloor): Platform & { readonly row: KurganEntranceFloor } {
  const { x: px, z: pz, fx, fz, cw, len, lintelY, dep, floorY, nSteps, rise } = row;
  return Object.assign(highest([
    (x, z) => {
      const dx = x - px, dz = z - pz, lz = -(dx * fx + dz * fz), lx = dx * fz - dz * fx;
      if (lz < 0.4 || lz > len - 0.2 || Math.abs(lx) > cw / 2 + 1.1) return undefined;
      const t = lz / len;
      return lintelY + 1.05 - t * 1.2 + Math.sin(Math.PI * t) * 0.25 - (1 - Math.cos((lx / ((cw + 3.6) / 2)) * 1.35)) * 1.6;
    },
    (x, z) => {
      const dx = x - px, dz = z - pz, lz = -(dx * fx + dz * fz), lx = dx * fz - dz * fx;
      if (Math.abs(lx) > cw / 2) return undefined;
      if (lz >= -0.15 && lz <= dep) return floorY;
      if (lz < -0.15 && lz > -0.2 - (nSteps + 0.5) * 0.5) { const i = Math.ceil((-0.2 - lz) / 0.5 - 0.5); return floorY - (rise * Math.max(1, i)) / (nSteps + 1); }
      return undefined;
    },
  ]), { row });
}

export type FieldstoneLook = 'kurgan' | 'rubble';

export interface FieldstoneParams {
  /** radius, metres */
  readonly s: number;
  /** height over width */
  readonly squash: number;
  /** how lumpy */
  readonly rough: number;
  /** how far its centre sits over the ground, × its radius (negative: sunk) */
  readonly lift: number;
  /** its stone and lichen */
  readonly look: FieldstoneLook;
}


export interface Board {
  readonly text: string;
  /** the way the arrow points (world yaw of the direction, atan2(dx, dz)) */
  readonly dir: number;
}

export interface SignpostParams { readonly boards: readonly Board[] }

/** one board's plank: its centre, its yaw (local +x = the pointing way), its width */
export interface BoardSpot { readonly p: THREE.Vector3; readonly yaw: number; readonly w: number }

/** where a signpost at (x, gy, z) hangs its boards, top down */
export function boardSpots(x: number, z: number, gy: number, boards: readonly Board[]): BoardSpot[] {
  const H = 1.9 + boards.length * 0.36;
  return boards.map((b, i) => {
    const y = gy + H - 0.3 - i * 0.36, w = 1.45;
    const yaw = b.dir - Math.PI / 2;                                       // M's local +x → world (sin dir, cos dir)
    const cx = x + Math.sin(b.dir) * (w / 2 + 0.05), cz = z + Math.cos(b.dir) * (w / 2 + 0.05);
    return { p: v3(cx, y, cz), yaw, w };
  });
}


/** Native model bounds used by both authored collision recipes and live placement boxes. */
export function generatedBounds(name: NalatiModelName, box = new THREE.Box3()): THREE.Box3 {
  const [w, h, d] = MODEL_SIZE[name];
  box.min.set(-w / 2, 0, -d / 2); box.max.set(w / 2, h, d / 2);
  return box;
}

/** Generated model data; its existing loader supplies the Explorer view. */
export function generatedModel<P extends object>(def: Omit<ModelDef<P>, 'build'>, spec: GeneratedSpec<P>): ModelDef<P> {
  return { ...def, build: generated(spec) };
}
