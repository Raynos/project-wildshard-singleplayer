import { Euler, Matrix4, Quaternion, Vector3, type EulerOrder, BufferAttribute, BufferGeometry } from 'three';
import type { RigAnimCtx } from '@wildshard/engine/entities/species/registry';
import { buildFarProxy, edgeLeanDrop, type FarEdgeLean, type FarGrid, type FarLookRuntime, type FarLookSource, type FarPart, type FarProxyMesh } from '../grid/farProxy';

const UNIT_SCALE = [1, 1, 1] as const;
const ORDERS = new Set<EulerOrder>(['XYZ', 'YXZ', 'ZXY', 'ZYX', 'YZX', 'XZY']);

/** Ordered collision joints only: parent precedes child, -1 attaches to the supplied world frame. */
export interface CollisionJoint {
  readonly parent: number;
  readonly position: readonly [number, number, number];
  /** Defaults to YXZ, preserving existing collision recipes. */
  readonly order?: EulerOrder;
  /** The rest joint scale, unit scale when omitted. */
  readonly scale?: readonly [number, number, number];
}

/** Absolute local transform from a trusted numeric rig; Euler order can change when the pose sets it. */
export interface CollisionTransform {
  readonly position: Readonly<{ x: number; y: number; z: number }>;
  readonly rotation: Readonly<{ x: number; y: number; z: number; order: EulerOrder }>;
  readonly scale: Readonly<{ x: number; y: number; z: number }>;
}
const finiteVector = (value: Readonly<{ x: number; y: number; z: number }>): boolean =>
  Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z);

/** Collision-only FK. It never constructs a scene node, skeleton, vertex buffer or skinned mesh. */
export class CollisionPose {
  private readonly joints: readonly CollisionJoint[];
  private readonly local: Matrix4[];
  private readonly world: Matrix4[];
  private readonly rotation = new Euler(0, 0, 0, 'YXZ');
  private readonly quaternion = new Quaternion();
  private readonly position = new Vector3();
  private readonly scale = new Vector3(1, 1, 1);
  private readonly centre = new Vector3();
  private readonly axis = new Vector3();
  private readonly up = new Vector3();

  constructor(joints: readonly CollisionJoint[]) {
    if (joints.length === 0 || joints.length > 32 || joints.some((joint, i) =>
      !Number.isInteger(joint.parent) || joint.parent < -1 || joint.parent >= i
      || !joint.position.every(Number.isFinite) || (joint.order !== undefined && !ORDERS.has(joint.order))
      || (joint.scale !== undefined && !joint.scale.every(Number.isFinite)))) {
      throw new RangeError('Invalid collision joint chain');
    }
    this.joints = joints;
    this.local = joints.map(joint => {
      const matrix = new Matrix4().makeTranslation(...joint.position);
      return joint.scale === undefined ? matrix : matrix.scale(this.scale.set(...joint.scale));
    });
    this.world = joints.map(() => new Matrix4());
  }

  /** Offset from the baked rest translation; omitted order/scale preserve the shipping YXZ/unit recipe. */
  set(index: number, offset: readonly [number, number, number], angles: readonly [number, number, number], scale?: readonly [number, number, number]): void {
    const joint = this.joints[index], matrix = this.local[index];
    if (joint === undefined || matrix === undefined || !offset.every(Number.isFinite)
      || !angles.every(Number.isFinite) || (scale !== undefined && !scale.every(Number.isFinite))) throw new RangeError('Invalid collision joint pose');
    this.position.set(joint.position[0] + offset[0], joint.position[1] + offset[1], joint.position[2] + offset[2]);
    this.quaternion.setFromEuler(this.rotation.set(...angles, joint.order ?? 'YXZ'));
    this.scale.set(...(scale ?? joint.scale ?? UNIT_SCALE));
    matrix.compose(this.position, this.quaternion, this.scale);
  }

  /** Apply an absolute local transform without subtracting/re-adding its rest translation. Does not publish worlds. */
  setLocal(index: number, transform: CollisionTransform): void {
    const matrix = this.local[index], { position, rotation, scale } = transform;
    if (matrix === undefined || !finiteVector(position) || !finiteVector(rotation) || !finiteVector(scale)
      || !ORDERS.has(rotation.order)) throw new RangeError('Invalid collision joint pose');
    this.position.set(position.x, position.y, position.z);
    this.quaternion.setFromEuler(this.rotation.set(rotation.x, rotation.y, rotation.z, rotation.order));
    this.scale.set(scale.x, scale.y, scale.z);
    matrix.compose(this.position, this.quaternion, this.scale);
  }

  /** Resolve once after posing; the caller supplies its existing world frame, including terrain tilt and scale. */
  solve(frame: Matrix4): void {
    for (let i = 0; i < this.joints.length; i++) {
      const joint = this.joints[i], local = this.local[i], world = this.world[i];
      if (joint === undefined || local === undefined || world === undefined) throw new Error('Missing collision joint');
      const parent = joint.parent === -1 ? frame : this.world[joint.parent];
      if (parent === undefined) throw new Error('Missing collision parent');
      world.multiplyMatrices(parent, local);
    }
  }

  /** A collision anchor in joint-local units, resolved into the supplied frame. */
  point(index: number, at: readonly [number, number, number], out: Vector3): Vector3 {
    return out.set(...at).applyMatrix4(this.matrix(index));
  }

  /** Shipping scaled x/z capsules pitch toward y. Upright y capsules follow y directly, as the view does. */
  capsule(index: number, at: readonly [number, number, number], axis: 'x' | 'y' | 'z', pitch: number, halfLength: number,
    rear: Vector3, front: Vector3): void {
    const matrix = this.matrix(index), elements = matrix.elements;
    this.centre.set(...at).applyMatrix4(matrix);
    if (axis === 'x') this.axis.set(elements[0], elements[1], elements[2]);
    else if (axis === 'y') this.axis.set(elements[4], elements[5], elements[6]);
    else this.axis.set(elements[8], elements[9], elements[10]);
    if (axis !== 'y') this.axis.multiplyScalar(Math.cos(pitch)).addScaledVector(this.up.set(elements[4], elements[5], elements[6]), Math.sin(pitch));
    rear.copy(this.centre).addScaledVector(this.axis, -halfLength);
    front.copy(this.centre).addScaledVector(this.axis, halfLength);
  }

  private matrix(index: number): Matrix4 {
    const matrix = this.world[index];
    if (matrix === undefined) throw new RangeError('Missing collision joint');
    return matrix;
  }
}

/**
 * Declarative species clips (SHARD-PLATFORM M3): a custom rig's procedural animation as rows instead of a hand-written
 * `animate` function. Each row drives one channel of one bone; each frame its first case whose condition holds sets the
 * channel to the sum of its terms, and each term is the product of its factors, evaluated left to right. That order is
 * the contract: a row written in the same order as the arithmetic it replaces reproduces it bit for bit (signed zeroes
 * included: a term whose condition fails adds +0, it never drops out of the sum).
 *
 * A row with `bind` starts its sum from the bone's bind value (read on the first frame and kept in the animal's `mem`
 * under that key), so a body can sink, rear or collapse from wherever its rig put it.
 */

/** The clocks a factor can read: the animal's time (s) or its gait phase (0..1, advanced from the ground speed). */
export type ClipClock = 't' | 'phase';

/** When a case or a term applies. Every key present must hold. */
export interface ClipWhen {
  /** true: only while alive; false: only once dead. */
  readonly alive?: boolean;
  /** Only while an attack plays (`attack ≥ 0`). */
  readonly attacking?: boolean;
  /** Only while `deathT` is above this (the collapse has begun). */
  readonly deathAbove?: number;
  /** A `mem` number (absent reads 0) compared with `above` (>) and / or `atLeast` (≥). */
  readonly mem?: { readonly key: string; readonly above?: number; readonly atLeast?: number };
}

/** One factor of a term. A bare number is a constant. */
export type ClipFactor =
  | number
  /** `sin(clock × rate + offset)`, or its magnitude with `abs`. */
  | { readonly wave: ClipClock; readonly rate: number; readonly offset?: number; readonly abs?: boolean }
  /** The clock itself (a spin: `t` × a rate factor). */
  | { readonly clock: ClipClock }
  /** A number the species' brain keeps in `mem` (absent reads 0). */
  | { readonly mem: string }
  /** The attack's progress 0..1, × `rate` and capped at `max` when given (pair it with a term `when: { attacking: true }`). */
  | { readonly attack: true; readonly rate?: number; readonly max?: number }
  /** A gait weight: `min(1, |speed| / full)`, × (`speed > run` ? `fast` : `slow`) when `run` is given. One value. */
  | { readonly gait: number; readonly run?: number; readonly fast?: number; readonly slow?: number }
  /** The death collapse, `deathT` clamped to 0..1. */
  | { readonly death: true }
  /** 1 while alive, 0 once dead. */
  | { readonly living: true };

/** One term of a sum: a constant, or the product of its factors (only when `when` holds; else +0). */
export type ClipTerm = number | { readonly when?: ClipWhen; readonly of: readonly ClipFactor[] };

/** One case of a row: the first whose `when` holds sets the channel to the sum of `sum` (an empty sum is 0). */
export interface ClipCase { readonly when?: ClipWhen; readonly sum: readonly ClipTerm[] }

/** The bone channels a row can drive. `scale` sets all three axes. */
export type ClipChannel = 'rotation.x' | 'rotation.y' | 'rotation.z' | 'position.x' | 'position.y' | 'position.z' | 'scale';

/** One row: a bone's channel and its cases, in priority order. When no case holds the channel keeps its value. */
export interface ClipRow {
  readonly bone: string;
  readonly channel: ClipChannel;
  /** The `mem` key that keeps the bone's bind value; the sum then starts from it. */
  readonly bind?: string;
  readonly cases: readonly ClipCase[];
}

/** A species' clips: its rows, played in order every frame. */
export type SpeciesClips = readonly ClipRow[];

/** What a clip reads from the frame: a subset of the engine's rig animation context. */
export type ClipCtx = Pick<RigAnimCtx, 'bones' | 't' | 'phase' | 'speed' | 'alive' | 'deathT' | 'attack' | 'mem'>;

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

function holds(when: ClipWhen | undefined, c: ClipCtx): boolean {
  if (when === undefined) return true;
  if (when.alive !== undefined && when.alive !== c.alive) return false;
  if (when.attacking === true && !(c.attack >= 0)) return false;
  if (when.deathAbove !== undefined && !(c.deathT > when.deathAbove)) return false;
  const m = when.mem;
  if (m !== undefined) {
    const v = c.mem[m.key] ?? 0;
    if (m.above !== undefined && !(v > m.above)) return false;
    if (m.atLeast !== undefined && !(v >= m.atLeast)) return false;
  }
  return true;
}

function factor(f: ClipFactor, c: ClipCtx): number {
  if (typeof f === 'number') return f;
  if ('wave' in f) {
    const x = (f.wave === 't' ? c.t : c.phase) * f.rate, s = Math.sin(f.offset === undefined ? x : x + f.offset);
    return f.abs === true ? Math.abs(s) : s;
  }
  if ('clock' in f) return f.clock === 't' ? c.t : c.phase;
  if ('mem' in f) return c.mem[f.mem] ?? 0;
  if ('attack' in f) { const a = f.rate === undefined ? c.attack : c.attack * f.rate; return f.max === undefined ? a : Math.min(f.max, a); }
  if ('gait' in f) {
    const w = Math.min(1, Math.abs(c.speed) / f.gait);
    return f.run === undefined ? w : w * (c.speed > f.run ? f.fast ?? 1 : f.slow ?? 1);
  }
  if ('death' in f) return clamp01(c.deathT);
  return c.alive ? 1 : 0;
}

function term(t: ClipTerm, c: ClipCtx): number {
  if (typeof t === 'number') return t;
  if (!holds(t.when, c)) return 0;
  const of = t.of, first = of[0];
  let v = first === undefined ? 0 : factor(first, c);
  for (let i = 1; i < of.length; i++) { const f = of[i]; if (f !== undefined) v *= factor(f, c); }
  return v;
}

/** The value a row's case sets: `base` (when bound) plus each term, left to right. */
function total(sum: readonly ClipTerm[], base: number | undefined, c: ClipCtx): number {
  let v = base, i = 0;
  if (v === undefined) { const first = sum[0]; v = first === undefined ? 0 : term(first, c); i = 1; }
  for (; i < sum.length; i++) { const t = sum[i]; if (t !== undefined) v += term(t, c); }
  return v;
}

type Axis = 'x' | 'y' | 'z';
/** Where each channel writes: the transform it sets and its axis (`null`: all three). */
const TARGET: Readonly<Record<ClipChannel, readonly ['rotation' | 'position' | 'scale', Axis | null]>> = {
  'rotation.x': ['rotation', 'x'], 'rotation.y': ['rotation', 'y'], 'rotation.z': ['rotation', 'z'],
  'position.x': ['position', 'x'], 'position.y': ['position', 'y'], 'position.z': ['position', 'z'], scale: ['scale', null],
};

/** Plays one frame of `clips` on the frame's bones (a bone the rig lacks is skipped). Allocates nothing. */
export function playClips(clips: SpeciesClips, c: ClipCtx): void {
  for (const row of clips) {
    const bone = c.bones[row.bone];
    if (bone === undefined) continue;
    let chosen: ClipCase | undefined;
    for (const k of row.cases) if (holds(k.when, c)) { chosen = k; break; }
    if (chosen === undefined) continue;
    const [group, axis] = TARGET[row.channel];
    let base: number | undefined;
    if (row.bind !== undefined) {
      const bound = c.mem[row.bind] ?? (axis === null ? bone.scale.x : bone[group === 'rotation' ? 'rotation' : 'position'][axis]);
      c.mem[row.bind] = bound; base = bound;
    }
    const v = total(chosen.sum, base, c);
    if (axis === null) bone.scale.setScalar(v);
    else if (group === 'rotation') bone.rotation[axis] = v;
    else bone.position[axis] = v;
  }
}

/** A species' `animate` from its clip rows. */
export const clipAnimate = (clips: SpeciesClips): ((ctx: ClipCtx) => void) => (ctx) => { playClips(clips, ctx); };

/**
 * G348 (Jake: the near and far placeholders are generic for any shard the MMO loads): the one placeholder mesh the bakes
 * build, for the SDK build (`wildshard build`, `@wildshard/sdk/bake/placeholders`) and the repo's bake runners alike.
 * A far proxy and a near placeholder are the same single-draw shape (4 × 4 regions in TEXCOORD_0.x, skirts, the cell's
 * cliff face, the shard's look in vertex colours); the near one is denser, carries the shard's own world as parts and
 * reduces its ground by geometric error. Node-safe; nothing here knows a shard.
 */
/** A height grid as `terrain.bin` or a shardfile terrain collider holds it (res² heights over size metres, 4 splat bytes per vertex). */
export type PlaceholderGrid = FarGrid;
/** A shard's far look (its palette by height, slope and splat; its haze, cliff and grade), authored in its folder. */
export type PlaceholderLook = FarLookSource;
/** What the runtime reads beside the mesh (`far.json` / `near.json`'s `look`). */
export type PlaceholderLookRuntime = FarLookRuntime;
/** A model merged into the placeholder: cell-local metres and linear RGB per vertex, indexed. */
export type PlaceholderPart = FarPart;

/**
 * The placeholder geometry: the grid in the look, plus parts, refused over `cap` triangles (default the far cap).
 * `reduce` reduces each region's ground lattice (the near placeholder's geometric-error ground); `lean` leans the near
 * ground back from the cell border (G342 round 5).
 */
export function placeholderGeometry(grid: PlaceholderGrid, look: PlaceholderLook, parts: readonly PlaceholderPart[] = [], cap?: number,
  reduce?: (positions: Float32Array, index: Uint32Array, attributes: Float32Array) => Uint32Array, lean?: PlaceholderLean): BufferGeometry {
  return farProxyGeometry(buildFarProxy(grid, look, parts, cap, reduce, lean));
}

/** A placeholder's edge lean (G342 round 5) and how far it lowers the ground at a point (what a placed copy sinks by). */
export type PlaceholderLean = FarEdgeLean;
export function placeholderLeanDrop(grid: PlaceholderGrid, lean: PlaceholderLean): (x: number, z: number) => number { return edgeLeanDrop(grid, lean); }

/** The far mesh as geometry (region in uv.x, cliff in uv.y), kept here rather than beside the far material
 *  (`grid/farView.ts`) so a Node build's closure reaches no renderer module (the native sim loader refuses one). */
function farProxyGeometry(mesh: FarProxyMesh): BufferGeometry {
  const uv = new Float32Array(mesh.region.length * 2); mesh.region.forEach((r, i) => { uv[i * 2] = r; uv[i * 2 + 1] = mesh.cliff[i] ?? 0; });
  return new BufferGeometry().setAttribute('position', new BufferAttribute(mesh.positions, 3)).setAttribute('normal', new BufferAttribute(mesh.normals, 3))
    .setAttribute('color', new BufferAttribute(mesh.colours, 3)).setAttribute('uv', new BufferAttribute(uv, 2)).setIndex(new BufferAttribute(mesh.index, 1));
}
