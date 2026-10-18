import * as THREE from 'three';
import type { Flutter } from './Flutter';
import type { Box } from './solid';
import { instanceModel, loadNalatiModel, MODEL_SIZE, MODEL_TRIS, placementMatrix, type ModelLod, type ModelLook, type ModelPlacement, type NalatiModelName } from './modelView';
import type { Rng } from '@wildshard/engine/core/rng';
import type { ModelBuild, ModelContext, ModelDef, Placement } from '@wildshard/engine/models/model';
import { place, type Draw, type Placed } from '@wildshard/engine/models/place';
import { boxDesc, type ColliderDesc, type WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import type { Ground, Platform, Plumes } from './types';


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

interface Made { readonly boxes?: readonly Box[]; readonly descs?: readonly ColliderDesc[]; readonly floor?: Platform }
interface PaintCtx { readonly ground: Ground; readonly flutter: Flutter; readonly smoke: Plumes }
type Build<P> = (ctx: ModelContext, p: P, rng: Rng) => ModelBuild;
interface GeneratedBuild<P> { (ctx: ModelContext, p: P, rng: Rng): ModelBuild; readonly gen: GeneratedSpec<P> }
const isGenerated = <P>(b: Build<P>): b is GeneratedBuild<P> => 'gen' in b;
const _box = new THREE.Box3();

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

/** Placement-only authored floors; all solid construction is baked. */
function highest(floors: readonly Platform[]): Platform {
  return (x, z) => {
    let best: number | undefined;
    for (const floor of floors) { const value = floor(x, z); if (value !== undefined && (best === undefined || value > best)) best = value; }
    return best;
  };
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
 * Native placement of prepared instances and moving copies, in the original order.
 * Static kit composition and specimen painting live in generators/places.ts.
 */
export class NalatiSet {
  private readonly members = new Map<string, Member>();
  /** the generated models' instances, per model, in the order they were first put */
  private readonly instances = new Map<NalatiModelName, InstanceData>();
  /** every box every copy made, in order (the POI's `colliders` data) */
  readonly boxes: Box[] = [];

  constructor(_paintKit: null, readonly c: PaintCtx) {}

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
    m.solid.push(...boxes.filter(shape => shape.ghost !== true).map(shape => boxDesc(shape, shape.surface)));
    m.descs.push(...(made.descs ?? []));
    if (made.floor) m.floors.push(made.floor);
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

/** Native model bounds used by both authored collision recipes and live placement boxes. */
export function generatedBounds(name: NalatiModelName, box = new THREE.Box3()): THREE.Box3 {
  const [w, h, d] = MODEL_SIZE[name];
  box.min.set(-w / 2, 0, -d / 2); box.max.set(w / 2, h, d / 2);
  return box;
}
