import { packedPayloadIdentity } from './packedPayloadIdentity';
import { PracticeContactStateSchema, validatePracticeContact, initialPracticeContacts, advancePracticeContacts,
  solvePracticeContacts, samplePracticeContactFrames, releasePracticeContacts, practiceContactClearance,
  type PracticeContactState, type PracticeContactSurface, type PracticeFootContactRecipe } from './practiceFootContact';
import { Euler, Matrix4, Quaternion, Vector3, type EulerOrder, BufferAttribute, BufferGeometry } from 'three';
import * as poseSchema from 'valibot';
import type { AnimalSim, AnimalAppliedHit, AnimalHitPublication } from '@wildshard/engine/entities/AnimalSim';
import type { NativeCorpseOwner, NativeCorpseHandoff } from '@wildshard/engine/entities/nativeCorpseOwner';
import type { CorpseRootEndpoint } from '@wildshard/engine/physics/nativeRigidCorpse';
import type { NumericCorpseJoint } from '@wildshard/engine/physics/rigidCorpse';
import { FIXED_STEP } from '@wildshard/engine/core/fixedStep';
import { AnimalPoseLaw, type AnimalPoseRecipe } from '@wildshard/engine/entities/animalPose';
import { applyAnimalRoot, QuadrupedRigPose, type AnimalRigContext, type AnimalRigJoint, type AnimalPoseTransition } from '@wildshard/engine/entities/animalRig';
import { practicePoseTransition } from './practicePoseContract';
import type { RigAnimCtx } from '@wildshard/engine/entities/species/registry';
import { buildFarProxy, edgeLeanDrop, type FarEdgeLean, type FarGrid, type FarLookRuntime, type FarLookSource, type FarPart, type FarProxyMesh } from '../grid/farProxy';

const swingValues = (values: readonly number[], size: number): boolean => values.length === size && values.every(Number.isFinite);
const swingWindow = (w: readonly [number, number]): boolean => swingValues(w, 2) && w[0] >= 0 && w[1] <= 1 && w[0] < w[1];
const swingEase = (phase: number, w: readonly [number, number]): number => { const t = Math.max(0, Math.min(1, (phase - w[0]) / (w[1] - w[0]))); return t * t * (3 - 2 * t); };
/** Bounded smooth wind, impact and recovery windows; each channel is [rest, wind, impact]. */
export interface CreatureSwingSpec<K extends string> {
  readonly wind: readonly [number, number]; readonly cut: readonly [number, number]; readonly recover: readonly [number, number];
  readonly channels: Readonly<Record<K, readonly [number, number, number]>>;
}
/** Sample a layered strike into caller-owned scratch. Preflight is quiet; no clock, state or random draw is owned. */
export function sampleCreatureSwing<K extends string>(phase: number, spec: CreatureSwingSpec<K>, output: Record<K, number>): void {
  if (!Number.isFinite(phase) || !swingWindow(spec.wind) || !swingWindow(spec.cut) || !swingWindow(spec.recover)) throw new RangeError('Invalid creature swing window');
  let count = 0;
  for (const key in spec.channels) {
    if (Object.hasOwn(spec.channels, key)) {
      if (!Object.hasOwn(output, key) || key === '__proto__' || key === 'prototype' || key === 'constructor'
        || ++count > 32 || !swingValues(spec.channels[key], 3)) throw new RangeError('Invalid creature swing channel');
    } else throw new RangeError('Inherited creature swing channel');
  }
  if (count === 0) throw new RangeError('Empty creature swing');
  const wind = swingEase(phase, spec.wind), cut = swingEase(phase, spec.cut), recover = swingEase(phase, spec.recover), hold = 1 - recover;
  for (const key in spec.channels) {
    if (Object.hasOwn(spec.channels, key)) {
      const [rest, raised, impact] = spec.channels[key];
      const lift = (1 - wind) * rest + wind * raised;
      output[key] = phase < 0 ? rest : ((1 - cut) * lift + cut * impact) * hold + rest * recover;
    }
  }
}

/** Numeric biped stride coefficients; omitted rest/brace terms use the ordinary weighted stance. */
export interface CreatureStrideProfile {
  readonly hip: number; readonly knee: number; readonly spread: number;
  readonly hipBrace?: number; readonly hipRest?: number;
  readonly kneeBrace?: number; readonly kneeRest?: number; readonly kneeFold?: number; readonly footRest?: number;
}
/** Pose six borrowed leg joints from a caller-owned gait/death frame. All inputs and joints preflight before writes. */
export function poseCreatureStride(bones: Readonly<Record<string, AnimalRigJoint>>, phase: number, moving: number,
  brace: number, kneel: number, topple: number, profile: CreatureStrideProfile, bend = 0): void {
  const hipBrace = profile.hipBrace ?? .1, hipRest = profile.hipRest ?? .1;
  const kneeBrace = profile.kneeBrace ?? .15, kneeRest = profile.kneeRest ?? .12, kneeFold = profile.kneeFold ?? 1.9, footRest = profile.footRest ?? .1;
  if (!Number.isFinite(phase) || !Number.isFinite(moving) || !Number.isFinite(brace) || !Number.isFinite(kneel) || !Number.isFinite(topple) || !Number.isFinite(bend)
    || !Number.isFinite(profile.hip) || !Number.isFinite(profile.knee) || !Number.isFinite(profile.spread)
    || !Number.isFinite(hipBrace) || !Number.isFinite(hipRest) || !Number.isFinite(kneeBrace) || !Number.isFinite(kneeRest) || !Number.isFinite(kneeFold) || !Number.isFinite(footRest)) throw new RangeError('Invalid creature stride frame');
  const lh = bones['legL_hip'], lk = bones['legL_knee'], lf = bones['legL_foot'];
  const rh = bones['legR_hip'], rk = bones['legR_knee'], rf = bones['legR_foot'];
  if (lh === undefined || lk === undefined || lf === undefined || rh === undefined || rk === undefined || rf === undefined) throw new Error('Missing creature stride joint');
  for (let side = 0; side < 2; side++) {
    const left = side === 0, sx = left ? 1 : -1, swing = Math.sin(phase + (left ? 0 : Math.PI));
    const hip = left ? lh : rh, knee = left ? lk : rk, foot = left ? lf : rf;
    hip.rotation.set(-profile.hip * swing * moving - hipBrace * brace - hipRest + .15 * kneel - .4 * topple - bend * .5, 0, sx * profile.spread);
    knee.rotation.set((profile.knee + .4 * Math.max(0, swing)) * moving + kneeBrace * brace + kneeRest + kneeFold * kneel + bend, 0, 0);
    foot.rotation.set(-.15 * swing * moving - footRest - bend * .5, 0, 0);
  }
}

/**
 * Step caller-owned rise/rising/sinking/init memory and return its eased lift.
 * Flags advance up then down and clear at their original endpoints. Explicit direction leaves flags caller-owned.
 * Optional floor easing uses the existing floor/floorS fields; no clock or save envelope is installed.
 */
export function stepCreatureLift(actor: Pick<AnimalSim, 'mem' | 'yOffset'>, dt: number,
  riseTime: number, sinkTime: number, under: number, floorEase?: number, direction?: 'up' | 'down' | 'hold'): number {
  switch (direction) {
    case undefined: case 'up': case 'down': case 'hold': break;
    default: throw new RangeError('Invalid creature lift direction');
  }
  const m = actor.mem, progress = m['rise'], rising = m['rising'], sinking = m['sinking'], initialized = m['init'];
  const floor = floorEase === undefined ? 0 : m['floor'] ?? 0, previousFloor = m['floorS'] ?? floor;
  if (!Number.isFinite(dt) || dt < 0 || !Number.isFinite(riseTime) || riseTime <= 0 || !Number.isFinite(sinkTime) || sinkTime <= 0 || !Number.isFinite(under)
    || (floorEase !== undefined && (!Number.isFinite(floorEase) || floorEase < 0 || !Number.isFinite(floor) || !Number.isFinite(previousFloor)))
    || (progress !== undefined && !Number.isFinite(progress)) || (rising !== undefined && !Number.isFinite(rising))
    || (sinking !== undefined && !Number.isFinite(sinking)) || (initialized !== undefined && !Number.isFinite(initialized))) throw new RangeError('Invalid creature lift frame');
  if (direction === 'up' || (direction === undefined && rising)) {
    m['rise'] = Math.min(1, (m['rise'] ?? 0) + dt / riseTime);
    if (direction === undefined && m['rise'] >= 1) m['rising'] = 0;
  }
  if (direction === 'down' || (direction === undefined && sinking)) {
    m['rise'] = Math.max(0, (m['rise'] ?? 0) - dt / sinkTime);
    if (direction === undefined && m['rise'] <= 0) m['sinking'] = 0;
  }
  const t = Math.min(1, Math.max(0, initialized ? m['rise'] ?? 0 : 0)), up = t * t * (3 - 2 * t);
  const top = floorEase === undefined ? 0 : previousFloor + (floor - previousFloor) * Math.min(1, dt * floorEase);
  if (floorEase !== undefined) m['floorS'] = top;
  actor.yOffset = (1 - up) * (top + under) + up * top;
  return up;
}

/** Native angular response; input/output wrapping and a speed cap are independent policies. */
export interface NpcFacingProfile {
  readonly rate: number;
  readonly maxSpeed?: number;
  readonly wrapTarget?: boolean;
  readonly wrapOutput?: boolean;
}
/** Advance one caller-owned yaw using its existing frame; acceptance and body placement stay native. */
export function stepNpcFacing(current: number, target: number, profile: NpcFacingProfile, dt: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(target) || !Number.isFinite(dt) || dt < 0 || !Number.isFinite(profile.rate) || profile.rate < 0
    || profile.maxSpeed !== undefined && (!Number.isFinite(profile.maxSpeed) || profile.maxSpeed < 0)) throw new RangeError('Invalid NPC facing frame');
  const wanted = profile.wrapTarget === true ? Math.atan2(Math.sin(target), Math.cos(target)) : target;
  const delta = wanted - current;
  let step = Math.atan2(Math.sin(delta), Math.cos(delta)) * (1 - Math.exp(-profile.rate * dt));
  if (profile.maxSpeed !== undefined) step = Math.max(-profile.maxSpeed * dt, Math.min(profile.maxSpeed * dt, step));
  const next = current + step;
  return profile.wrapOutput === true ? Math.atan2(Math.sin(next), Math.cos(next)) : next;
}
/** Caller-owned transient attention; it does not replace an NPC's reading or save owner. */
export interface NpcHeadFocusState { headYaw: number; headPitch: number; glanceT: number; glanceYaw: number; glancePitch: number }
/** Numeric focus, idle cadence and response laws for an already-owned head pivot. */
export interface NpcHeadFocusProfile {
  readonly range: number; readonly yawLimit: number; readonly pitchLimit?: number; readonly pitchScale: number;
  readonly eyeHeight: number; readonly minimumDistance: number; readonly response: 'linear' | 'exponential'; readonly rate: number;
  readonly clampAfterOffset: boolean;
  readonly idle: {
    readonly cadence: { readonly kind: 'sine' | 'cycle'; readonly base: number; readonly frequency: number; readonly span: number; readonly strict?: boolean };
    readonly yaw: readonly [number, number]; readonly yawWeight?: number;
    readonly pitch: number | { readonly frequency: number; readonly threshold: number; readonly above: number; readonly below: number };
  };
}
/** Numeric target observations; gesture overrides do not transfer gesture/reading ownership. */
export interface NpcHeadFocusInput {
  distance: number; relativeYaw: number; playerY: number; headY: number;
  focused?: boolean; overrideYaw?: number | undefined; overridePitch?: number | undefined; offsetYaw?: number; offsetPitch?: number;
}
/** Step one head without allocations, renderer access or random draws. Idle clocks advance only when idle is selected. */
export function stepNpcHeadFocus(state: NpcHeadFocusState, profile: NpcHeadFocusProfile, input: NpcHeadFocusInput, dt: number, time: number): void {
  if (!Number.isFinite(dt) || dt < 0 || !Number.isFinite(time)) throw new RangeError('Invalid NPC focus clock');
  let yaw: number, pitch: number;
  if (input.overrideYaw !== undefined && input.overridePitch !== undefined) { yaw = input.overrideYaw; pitch = input.overridePitch; }
  else if (input.focused ?? input.distance < profile.range) {
    yaw = Math.max(-profile.yawLimit, Math.min(profile.yawLimit, Math.atan2(Math.sin(input.relativeYaw), Math.cos(input.relativeYaw))));
    pitch = -Math.atan2(input.playerY + profile.eyeHeight - input.headY, Math.max(profile.minimumDistance, input.distance));
    if (profile.pitchLimit !== undefined) pitch = Math.max(-profile.pitchLimit, Math.min(profile.pitchLimit, pitch));
    pitch *= profile.pitchScale;
    yaw += input.offsetYaw ?? 0; pitch += input.offsetPitch ?? 0;
  } else {
    state.glanceT -= dt;
    const idle = profile.idle, cadence = idle.cadence;
    if (cadence.strict === true ? state.glanceT < 0 : state.glanceT <= 0) {
      state.glanceT = cadence.base + (cadence.kind === 'sine' ? (Math.sin(time * cadence.frequency) + 1) * cadence.span : (time * cadence.frequency) % cadence.span);
      state.glanceYaw = Math.sin(time * idle.yaw[0]) * idle.yaw[1];
      state.glancePitch = typeof idle.pitch === 'number' ? idle.pitch : Math.sin(time * idle.pitch.frequency) > idle.pitch.threshold ? idle.pitch.above : idle.pitch.below;
    }
    yaw = state.glanceYaw * (idle.yawWeight ?? 1); pitch = state.glancePitch;
  }
  if (profile.clampAfterOffset) yaw = Math.max(-profile.yawLimit, Math.min(profile.yawLimit, yaw));
  const response = profile.response === 'linear' ? Math.min(1, dt * profile.rate) : 1 - Math.exp(-profile.rate * dt);
  state.headYaw += (yaw - state.headYaw) * response; state.headPitch += (pitch - state.headPitch) * response;
}

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

  /** Resolve once after posing; the caller supplies its existing world frame, including terrain tilt and scale.
   * `through` stops after that joint (parent-first), so its descendants keep their previously solved worlds. */
  solve(frame: Matrix4, through = this.joints.length - 1): void {
    for (let i = 0; i < this.joints.length; i++) {
      if (i > through) break;
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
  /** Sum in authored order, cap with max then min, then divide (never multiply by a reciprocal). */
  | { readonly bounded: readonly ClipTerm[]; readonly min?: number; readonly max?: number; readonly divide?: number }
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
export type ClipRow = {
  readonly bone: string;
  readonly channel: ClipChannel;
  /** The `mem` key that keeps the bone's bind value; the sum then starts from it. */
  readonly bind?: string;
  readonly cases: readonly ClipCase[];
} | {
  /** Ordered scratch channel; later rows observe its newly eased value even when a rig bone is absent. */
  readonly mem: string;
  /** old + (target - old) * min(1, dt * ease), with an absent old value read as zero. */
  readonly ease: number;
  readonly cases: readonly ClipCase[];
};

/** A species' clips: its rows, played in order every frame. */
export type SpeciesClips = readonly ClipRow[];

/** What a clip reads from the frame: a subset of the engine's rig animation context. */
export type ClipCtx = Pick<RigAnimCtx, 't' | 'phase' | 'speed' | 'alive' | 'deathT' | 'attack' | 'mem'> & Partial<Pick<RigAnimCtx, 'dt'>> & {
  /** Existing bone, mesh or group pivots; clips write only their local transforms. */
  bones: Record<string, AnimalRigJoint>;
};

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
  if ('bounded' in f) {
    if ((f.min !== undefined && !Number.isFinite(f.min)) || (f.max !== undefined && !Number.isFinite(f.max))
      || (f.min !== undefined && f.max !== undefined && f.min > f.max)
      || (f.divide !== undefined && (!Number.isFinite(f.divide) || f.divide === 0))) throw new RangeError('Invalid bounded clip factor');
    let value = total(f.bounded, undefined, c);
    if (f.max !== undefined) value = Math.min(f.max, value);
    if (f.min !== undefined) value = Math.max(f.min, value);
    return f.divide === undefined ? value : value / f.divide;
  }
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
    if ('mem' in row) {
      if (c.dt === undefined || !Number.isFinite(c.dt) || c.dt < 0 || !Number.isFinite(row.ease) || row.ease < 0)
        throw new RangeError('Eased clip memory requires a finite nonnegative frame and rate');
      for (const k of row.cases) if (holds(k.when, c)) {
        const old = c.mem[row.mem] ?? 0, target = total(k.sum, undefined, c);
        c.mem[row.mem] = old + (target - old) * Math.min(1, c.dt * row.ease); break;
      }
      continue;
    }
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

/** Actual local rest chain and modifiers read from the browser's instantiated model, not invented collision bones. */
export interface NativeCreaturePoseRecipe {
  readonly joints: readonly { readonly name: string; readonly parent: number; readonly position: readonly [number, number, number]; readonly order: EulerOrder; readonly scale: readonly [number, number, number] }[];
  readonly custom: boolean;
  readonly gait?: AnimalPoseRecipe['gait'];
  readonly pose?: AnimalPoseRecipe['pose'];
  /** Disable death-leg splay for an authored quadruped overlay. */
  readonly deathSplay?: boolean;
  readonly rootFlinch?: 'engine' | 'authored-pose';
  /** Explicit bounded practice subset. Requires an admitted numeric transition declaration. */
  readonly practice?: true;
}
/** Renderer-free numeric pose with separate current locals and previous rendered contact publication. */
const nativePoses = new WeakMap<AnimalSim, NativeCreaturePose>();
/** Query the existing built-in pose of a retained actor; never installs a rig. */
export function nativeCreaturePose(actor: AnimalSim): NativeCreaturePose {
  const pose = nativePoses.get(actor); if (pose === undefined) throw new Error('Missing native creature pose'); return pose;
}
export class NativeCreaturePose {
  private static readonly ORIGIN = [0, 0, 0] as const;
  private static readonly u32 = poseSchema.pipe(poseSchema.number(), poseSchema.integer(), poseSchema.minValue(0), poseSchema.maxValue(0xffffffff));
  private static readonly bits = poseSchema.pipe(poseSchema.array(NativeCreaturePose.u32), poseSchema.maxLength(704));
  private static readonly Saved = poseSchema.strictObject({ version: poseSchema.literal(1), recipe: poseSchema.string(), scalar: poseSchema.string(), breath: poseSchema.pipe(poseSchema.number(), poseSchema.finite(), poseSchema.minValue(0)),
    local: NativeCreaturePose.bits, published: NativeCreaturePose.bits, frame: NativeCreaturePose.bits, leg: NativeCreaturePose.bits, wasAlive: poseSchema.boolean() });
  private static readonly finite = poseSchema.pipe(poseSchema.number(), poseSchema.finite());
  private static readonly History = poseSchema.strictObject({
    ordinal: poseSchema.pipe(poseSchema.number(), poseSchema.safeInteger(), poseSchema.minValue(0)),
    kind: poseSchema.picklist([0, 1, 2]), elapsed: poseSchema.pipe(NativeCreaturePose.finite, poseSchema.minValue(0)),
    entry: NativeCreaturePose.bits, previous: NativeCreaturePose.bits,
    root: NativeCreaturePose.bits, previousRoot: NativeCreaturePose.bits,
    motion: NativeCreaturePose.bits, anchor: NativeCreaturePose.bits, time: NativeCreaturePose.finite,
  });
  private static readonly PracticeSaved = poseSchema.strictObject({ ...NativeCreaturePose.Saved.entries,
    version: poseSchema.literal(2), history: NativeCreaturePose.History,
    contact: poseSchema.exactOptional(poseSchema.strictObject({ current: PracticeContactStateSchema, previous: PracticeContactStateSchema })) });
  private static readonly triple = poseSchema.tuple([NativeCreaturePose.finite, NativeCreaturePose.finite, NativeCreaturePose.finite]);
  private static readonly transform = poseSchema.strictObject({ p: NativeCreaturePose.triple, r: NativeCreaturePose.triple,
    order: poseSchema.picklist(['XYZ', 'YXZ', 'ZXY', 'ZYX', 'YZX', 'XZY']), s: NativeCreaturePose.triple });
  private static readonly Legacy = poseSchema.strictObject({ pose: poseSchema.string(),
    breath: poseSchema.exactOptional(poseSchema.pipe(NativeCreaturePose.finite, poseSchema.minValue(0))),
    root: poseSchema.exactOptional(NativeCreaturePose.transform),
    bones: poseSchema.exactOptional(poseSchema.pipe(poseSchema.array(poseSchema.tuple([poseSchema.string(), NativeCreaturePose.transform])), poseSchema.maxLength(32))) });
  private static readonly ORDERS: readonly EulerOrder[] = ['XYZ', 'YXZ', 'ZXY', 'ZYX', 'YZX', 'XZY'];
  private static encoded(scalars: readonly number[]): number[] {
    const out: number[] = [], data = new DataView(new ArrayBuffer(8));
    if (scalars.length > 352) throw new Error('Invalid native creature pose continuation');
    for (let i = 0; i < 352; i++) { const value = scalars[i]; if (value === undefined) break; if (!Number.isFinite(value)) throw new Error('Invalid native creature pose continuation'); data.setFloat64(0, value); out.push(data.getUint32(0), data.getUint32(4)); }
    return out;
  }
  private static decoded(words: readonly number[], size: number): number[] {
    if (words.length !== size * 2) throw new Error('Incompatible native creature pose continuation');
    const out: number[] = [], data = new DataView(new ArrayBuffer(8));
    for (let i = 0; i < 352; i++) {
      if (i * 2 >= words.length) break;
      const high = words[i * 2], low = words[i * 2 + 1]; if (high === undefined || low === undefined) throw new Error('Invalid native creature pose continuation');
      data.setUint32(0, high); data.setUint32(4, low); const value = data.getFloat64(0); if (!Number.isFinite(value)) throw new Error('Invalid native creature pose continuation'); out.push(value);
    }
    return out;
  }
  private static readonly joint = (): AnimalRigJoint => ({ position: new Vector3(), rotation: new Euler(), scale: new Vector3(1, 1, 1) });
  private static readonly values = (j: AnimalRigJoint): number[] => [j.position.x, j.position.y, j.position.z, j.rotation.x, j.rotation.y, j.rotation.z, NativeCreaturePose.ORDERS.indexOf(j.rotation.order), j.scale.x, j.scale.y, j.scale.z];
  private static read(j: AnimalRigJoint, data: readonly number[], start: number): void {
    const [x, y, z, rx, ry, rz, index, sx, sy, sz] = data.slice(start, start + 10), order = index === undefined ? undefined : NativeCreaturePose.ORDERS[index];
    if (x === undefined || y === undefined || z === undefined || rx === undefined || ry === undefined || rz === undefined || sx === undefined || sy === undefined || sz === undefined || order === undefined) throw new Error('Invalid native creature pose continuation');
    j.position.set(x, y, z); j.rotation.set(rx, ry, rz, order); j.scale.set(sx, sy, sz);
  }

  readonly entityId: string;
  readonly bones: Record<string, AnimalRigJoint> = {};
  readonly law: AnimalPoseLaw;
  private readonly joints: readonly AnimalRigJoint[];
  private readonly root = NativeCreaturePose.joint();
  private readonly published: Float64Array;
  private readonly publishedFrame = new Float64Array(16);
  private readonly frame = new Matrix4();
  private readonly quaternion = new Quaternion();
  private fk: CollisionPose;
  private readonly head: number;
  private readonly body: number;
  private readonly fore: number;
  private readonly legAbd = new Float32Array(4);
  private readonly quad: QuadrupedRigPose | null;
  /** Borrowed numeric frame for overlays inside the existing body-step callback. */
  readonly context: AnimalRigContext;
  private wasAlive = true;
  private corpse: NativeCorpseOwner | undefined;
  private readonly physicalPrevious = new Quaternion();
  private readonly physicalCurrent = new Quaternion();
  private physicalRoot = false;
  private physicalFrozen = false;
  private pendingCorpse: { joints: AnimalRigJoint[]; law: AnimalPoseLaw; context: AnimalRigContext; time: number; elapsed: number } | undefined;
  /** Bind only the concrete host-owned resource manager, never an authored resource callback. */
  bindCorpse(owner: NativeCorpseOwner): void {
    if (this.corpse !== undefined || this.history === undefined || !this.recipe.custom || owner.actor !== this.actor)
      throw new Error('Invalid native corpse pose binding');
    this.corpse = owner;
  }
  /** Quiet detached rigid local inputs. No FK, evaluator, clock or publication is advanced. */
  corpseJoints(joints: readonly AnimalRigJoint[] = this.joints): NumericCorpseJoint[] {
    return joints.map((joint, index) => {
      const row = this.recipe.joints[index]; if (row === undefined) throw new Error('Missing native corpse joint');
      const q = new Quaternion().setFromEuler(joint.rotation);
      return { name: row.name, parent: row.parent, position: { x: joint.position.x, y: joint.position.y, z: joint.position.z },
        rotation: { x: q.x, y: q.y, z: q.z, w: q.w }, scale: { x: joint.scale.x, y: joint.scale.y, z: joint.scale.z } };
    });
  }
  /** Prepare the next dead local/scalar step off live actor state. One numeric evaluation, committed in post. */
  prepareCorpseStep(dt: number, time: number): { joints: NumericCorpseJoint[]; complete: boolean } {
    const h = this.history;
    if (h === undefined || !this.physicalRoot || this.actor.alive || this.pendingCorpse !== undefined
      || dt !== FIXED_STEP || !Number.isFinite(time) || time <= h.time) throw new Error('Invalid native corpse pose step');
    const law = new AnimalPoseLaw(this.law.recipe); law.copyFrom(this.law); this.actor.readPoseInputs(law, false); law.advance(dt, time, true);
    const bones: Record<string, AnimalRigJoint> = {};
    const joints = this.joints.map((source, index) => {
      const row = this.recipe.joints[index]; if (row === undefined) throw new Error('Missing native corpse joint');
      const joint = NativeCreaturePose.joint(); joint.position.copy(source.position); joint.rotation.copy(source.rotation); joint.scale.copy(source.scale);
      bones[row.name] = joint; return joint;
    });
    const elapsed = h.elapsed + dt, context: AnimalRigContext = { ...this.context, bones,
      transition: this.transitionObservation({ ...h, elapsed }) };
    this.refreshPracticeContext(dt, time, context);
    context.deathT = law.input.deathT; context.flinch = law.input.flinch; context.phase = law.phase;
    context.brace = law.input.brace * law.input.brace * (3 - 2 * law.input.brace); context.lookWeight = law.lookAmt;
    this.animate?.(context);
    // Full numeric FK validation occurs before any collider or live pose state changes.
    const fk = new CollisionPose(this.recipe.joints); joints.forEach((joint, index) => { fk.setLocal(index, joint); }); fk.solve(this.frame);
    this.pendingCorpse = { joints, law, context, time, elapsed };
    return { joints: this.corpseJoints(joints), complete: law.input.deathT >= 1 };
  }
  cancelCorpseStep(): void { this.pendingCorpse = undefined; }
  /** Publish the actual physical root even after a refused pre step, retaining the last accepted locals. */
  publishCorpseRoot(endpoint: CorpseRootEndpoint, prepared: boolean, frozen: boolean): void {
    const h = this.history, pending = prepared ? this.pendingCorpse : undefined;
    if (h === undefined || !this.physicalRoot || prepared && pending === undefined) throw new Error('Missing native corpse pose step');
    const sources = pending?.joints ?? this.joints, fk = new CollisionPose(this.recipe.joints);
    const published = new Float64Array(this.published.length), q = new Quaternion().copy(endpoint.rotation);
    sources.forEach((joint, index) => { fk.setLocal(index, joint); published.set(NativeCreaturePose.values(joint), index * 10); });
    const position = new Vector3().copy(endpoint.position), frame = new Matrix4().compose(position, q, this.root.scale);
    fk.solve(frame);
    h.previous.set(this.published); h.previousRoot.set(h.root); this.physicalPrevious.copy(this.physicalCurrent);
    if (pending !== undefined) {
      this.joints.forEach((joint, index) => { const source = pending.joints[index]; if (source !== undefined) {
        joint.position.copy(source.position); joint.rotation.copy(source.rotation); joint.scale.copy(source.scale);
      } });
      this.law.copyFrom(pending.law); this.actor.commitPose(this.law); this.wasAlive = false;
      h.time = pending.time; h.elapsed = pending.elapsed;
      const c = this.context, next = pending.context;
      c.dt = next.dt; c.t = next.t; c.speed = next.speed; c.strafe = next.strafe; c.phase = next.phase;
      c.state = next.state; c.alive = next.alive; c.deathT = next.deathT; c.flinch = next.flinch;
      c.brace = next.brace; c.attack = next.attack; c.lookWeight = next.lookWeight; c.yaw = next.yaw; c.mem = next.mem;
    }
    const dx = endpoint.position.x - (h.anchor[0] ?? 0), dy = endpoint.position.y - (h.anchor[1] ?? 0), dz = endpoint.position.z - (h.anchor[2] ?? 0);
    const distance = Math.hypot(dx, dy, dz); h.motion.set([dx, dy, dz, distance, (h.motion[4] ?? 0) + distance, 0]);
    h.anchor.set([endpoint.position.x, endpoint.position.y, endpoint.position.z, this.actor.yaw]);
    this.root.position.copy(endpoint.position); this.physicalCurrent.copy(endpoint.rotation); this.root.rotation.setFromQuaternion(this.physicalCurrent);
    this.published.set(published); this.publishedFrame.set(frame.elements); this.frame.copy(frame); this.fk = fk;
    h.root.set(NativeCreaturePose.values(this.root)); this.pendingCorpse = undefined;
    this.physicalFrozen = frozen;
    if (frozen) {
      h.previous.set(this.published); h.previousRoot.set(h.root); this.physicalPrevious.copy(this.physicalCurrent);
    }
  }

  private readonly contactRecipe: PracticeFootContactRecipe | undefined;
  private readonly contactSurface: PracticeContactSurface | undefined;
  private contact: PracticeContactState | undefined;
  private previousContact: PracticeContactState | undefined;
  private solvedContact: Record<string, { rotation: { x: number; y: number; z: number } }> = {};
  /** Detached diagnostic read. Released/failed is never evidence of source admission. */
  contactDiagnostic(): Readonly<{ current: PracticeContactState; previous: PracticeContactState }> | undefined {
    return this.contact === undefined || this.previousContact === undefined ? undefined
      : structuredClone({ current: this.contact, previous: this.previousContact });
  }
  private contactSolution(root: AnimalRigJoint, state: PracticeContactState, previous = state, alpha = 1) {
    if (this.contactRecipe === undefined || this.contactSurface === undefined) throw new Error('Missing contact declaration');
    return solvePracticeContacts(this.contactRecipe, this.recipe.joints, root, this.contactSurface,
      samplePracticeContactFrames(this.contactRecipe, previous, state, alpha));
  }
  private stageContactSolution(): void {
    if (this.contact === undefined) return;
    const solution = this.contactSolution(this.root, this.contact, this.previousContact);
    if (solution.failures.length > 0) this.contact = releasePracticeContacts(this.contact, [...this.contact.failures, ...solution.failures]);
    // Unreachable poses retain finite last transforms and explicitly fail. No root correction or fake recovery.
    const valid = this.contact.failures.length === 0;
    for (const name of this.contactRecipe?.feet.flatMap(foot => foot.joints) ?? []) {
      const rotation = valid ? solution.rotations[name] : undefined, joint = this.bones[name];
      if (joint === undefined) throw new Error('Missing contact joint');
      this.solvedContact[name] = { rotation: { x: rotation?.[0] ?? joint.rotation.x,
        y: rotation?.[1] ?? joint.rotation.y, z: rotation?.[2] ?? joint.rotation.z } };
    }
  }
  private checkContactClearance(): void {
    if (this.contact === undefined || this.contactRecipe === undefined || this.contactSurface === undefined) return;
    const failures = practiceContactClearance(this.contactRecipe, this.recipe.joints, this.root, this.bones, this.contactSurface);
    if (failures.length > 0) this.contact = releasePracticeContacts(this.contact, [...this.contact.failures, ...failures]);
  }
  /** Preflight before any actor/motor mutation; a fresh placement never reconstructs a mid-stride continuation. */
  prepareContactPlacement(at: Readonly<{ x: number; y: number; z: number }>, yaw: number): PracticeContactState | undefined {
    if (this.contactRecipe === undefined || this.contactSurface === undefined) return undefined;
    const root = NativeCreaturePose.joint(); root.position.copy(at); root.rotation.set(0, yaw, 0, 'YXZ'); root.scale.setScalar(this.actor.scale);
    const state = initialPracticeContacts(this.contactRecipe, root, this.contactSurface), solution = this.contactSolution(root, state);
    if (solution.failures.length > 0) throw new Error(`Invalid contact placement: ${solution.failures.join('; ')}`);
    const bones = Object.fromEntries(Object.entries(this.bones).map(([name, joint]) => {
      const copy = NativeCreaturePose.joint(); copy.position.copy(joint.position); copy.rotation.copy(joint.rotation); copy.scale.copy(joint.scale);
      const rotation = solution.rotations[name]; if (rotation !== undefined) copy.rotation.set(...rotation, 'XYZ');
      return [name, copy];
    }));
    if (practiceContactClearance(this.contactRecipe, this.recipe.joints, root, bones, this.contactSurface).length > 0)
      throw new Error('Invalid contact placement source clearance');
    return state;
  }
  private readonly identity: string;
  private readonly quadClock;
  private readonly actor: AnimalSim;
  private readonly recipe: NativeCreaturePoseRecipe;
  private readonly animate: ((context: AnimalRigContext) => void) | undefined;
  private readonly history: {
    ordinal: number; kind: 0 | 1 | 2; elapsed: number; time: number;
    entry: Float64Array; previous: Float64Array; root: Float64Array; previousRoot: Float64Array;
    anchor: Float64Array; motion: Float64Array;
  } | undefined;
  private readonly renderPrevious = NativeCreaturePose.joint();
  private readonly renderCurrent = NativeCreaturePose.joint();
  private readonly renderQuaternion = new Quaternion();
  private readonly poseSample = { attackT: -1, attackDur: 1, groundY: 0, tiltRollT: 0,
    stunT: 0, flinch: 0, flinchRoll: 0, flinchPitch: 0, brace: 0, deathSide: 1, deathT: -1 };
  /** Initial numeric selection, before the first tick. Unlike advance(0), this never runs the scalar law. */
  initializePractice(): void {
    const h = this.history;
    if (h?.time !== 0 || h.ordinal !== 0) throw new Error('Invalid practice pose initialization');
    if (this.contactRecipe !== undefined && this.contactSurface !== undefined) {
      this.contact = initialPracticeContacts(this.contactRecipe, this.root, this.contactSurface);
      this.previousContact = structuredClone(this.contact); this.stageContactSolution();
    }
    this.refreshPracticeContext(0, 0); this.animate?.(this.context); this.checkContactClearance();
    if ((this.contact?.failures.length ?? 0) > 0) throw new Error(`Contact initialization refused: ${this.contact?.failures.join('; ')}`);
    this.publish();
    if (this.contact !== undefined) this.previousContact = structuredClone(this.contact);
    h.entry.set(this.published); h.previous.set(this.published); h.previousRoot.set(h.root);
  }
  constructor(actor: AnimalSim, recipe: NativeCreaturePoseRecipe, animate?: (context: AnimalRigContext) => void, contactSurface?: PracticeContactSurface) {
    this.actor = actor; this.recipe = recipe; this.animate = animate;
    if (recipe.custom !== (animate !== undefined)) throw new Error('Incompatible native creature custom pose');
    const transition = practicePoseTransition(animate);
    this.contactRecipe = transition?.contact; this.contactSurface = contactSurface;
    if (this.contactRecipe !== undefined) {
      if (contactSurface === undefined) throw new Error('Contact requires trusted finite Arena surface');
      if (packedPayloadIdentity(actor.dims) !== this.contactRecipe.source) throw new Error('Contact source identity differs from actual packed payload');
      validatePracticeContact(this.contactRecipe, recipe.joints);
      const hulls = actor.dims.rigidCorpse?.parts.map(part => ({ joint: part.bone, points: part.points }));
      if (JSON.stringify(hulls) !== JSON.stringify(this.contactRecipe.geometry)) throw new Error('Contact geometry identity differs from actual source');
    }
    if ((recipe.practice === true) !== (transition !== undefined)
      || transition !== undefined && (!recipe.custom || transition.joints.length !== recipe.joints.length
        || transition.joints.some((name, index) => recipe.joints[index]?.name !== name)))
      throw new Error('Incompatible native practice pose declaration');
    this.identity = JSON.stringify({ id: actor.entityId, kind: actor.kind, variant: actor.variant, dims: actor.dims, recipe, ...(this.contactRecipe === undefined ? {} : { contact: this.contactRecipe }) });
    this.entityId = actor.entityId;
    this.fk = new CollisionPose(recipe.joints);
    this.joints = recipe.joints.map(row => {
      if (row.name.length === 0 || this.bones[row.name] !== undefined) throw new Error('Invalid native creature pose joint');
      const j = NativeCreaturePose.joint(); j.position.set(...row.position); j.rotation.order = row.order; j.scale.set(...row.scale); this.bones[row.name] = j; return j;
    });
    this.head = recipe.joints.findIndex(row => row.name === 'head'); this.body = recipe.joints.findIndex(row => row.name === 'body');
    this.fore = actor.dims.fore === undefined ? -1 : recipe.joints.findIndex(row => row.name === actor.dims.fore?.bone);
    if (this.head < 0 || this.body < 0 || (actor.dims.fore !== undefined && this.fore < 0)) throw new Error('Missing native creature volume joint');
    this.law = new AnimalPoseLaw({ dims: actor.dims, custom: recipe.custom, ...(recipe.gait === undefined ? {} : { gait: recipe.gait }), ...(recipe.pose === undefined ? {} : { pose: recipe.pose }) });
    this.quad = recipe.custom ? null : new QuadrupedRigPose(this.bones);
    this.context = { bones: this.bones, dims: actor.dims, dt: 0, t: 0, seed: actor.seed, scale: actor.scale, speed: 0, strafe: 0, phase: 0, state: 'idle', alive: true,
      deathT: -1, flinch: 0, brace: 0, attack: -1, lookTarget: actor.lookTarget, lookWeight: 0, position: actor.position, yaw: 0, mem: actor.mem, animal: actor };
    this.quadClock = { bodyY: actor.dims.bodyY, alive: true, deathT: -1, deathSide: 1, speed: 0, legAbd: this.legAbd };
    this.published = new Float64Array(this.joints.length * 10);
    if (recipe.practice === true) this.history = {
      ordinal: 0, kind: 0, elapsed: 0, time: 0,
      entry: new Float64Array(this.published.length), previous: new Float64Array(this.published.length),
      root: new Float64Array(10), previousRoot: new Float64Array(10),
      anchor: new Float64Array([actor.position.x, actor.position.y, actor.position.z, actor.yaw]), motion: new Float64Array(6),
    };
    // Factory bind matrices exist before an actor's first rendered placement; no body, clocks or RNG run here.
    this.publish(); this.root.scale.setScalar(actor.scale);
    // AnimalView.place changes root locals immediately; its bind matrices remain cached until the first scene publication.
    this.root.position.copy(actor.position); this.root.rotation.y = actor.yaw;
    if (this.history !== undefined) {
      this.publish(); this.history.entry.set(this.published); this.history.previous.set(this.published);
      this.history.previousRoot.set(this.history.root);
      Object.defineProperty(this.context, 'transition', { get: () => this.transitionObservation() });
    }
    nativePoses.set(actor, this);
  }
  /** Body animation phase only; contacts keep the previous publication until publish(). */
  advance(dt: number, t: number, near: boolean): void {
    if (this.contactRecipe !== undefined && (dt !== FIXED_STEP || !near)) throw new Error('Contact requires exactly one nearby fixed tick');
    if (this.history !== undefined) {
      if (!Number.isFinite(dt) || dt <= 0 || !Number.isFinite(t)) throw new Error('Practice pose advances only on positive owner ticks');
      const h = this.history, a = this.actor;
      h.previous.set(this.published); h.previousRoot.set(h.root);
      const dx = a.position.x - (h.anchor[0] ?? 0), dy = a.position.y - (h.anchor[1] ?? 0), dz = a.position.z - (h.anchor[2] ?? 0);
      const heading = a.yaw - (h.anchor[3] ?? 0), distance = Math.hypot(dx, dy, dz);
      h.motion.set([dx, dy, dz, distance, (h.motion[4] ?? 0) + distance, Math.atan2(Math.sin(heading), Math.cos(heading))]);
      h.anchor.set([a.position.x, a.position.y, a.position.z, a.yaw]);
      if (h.kind !== 0) h.elapsed += dt;
      h.time = t;
    }
    const a = this.actor; a.advancePose(this.law, dt, t, near);
    const i = this.law.input;
    if (this.contactRecipe !== undefined && this.contact !== undefined && this.contactSurface !== undefined && a.alive) {
      const previousRoot = NativeCreaturePose.joint(); previousRoot.position.copy(this.root.position);
      previousRoot.rotation.copy(this.root.rotation); previousRoot.scale.copy(this.root.scale);
      applyAnimalRoot(this.root, a.position, a.yaw, this.law.tiltPitch, this.law.tiltRoll, this.recipe.custom, a.alive,
        i.flinch, i.flinchPitch, i.flinchRoll, this.recipe.rootFlinch); this.root.scale.setScalar(a.scale);
      this.previousContact = structuredClone(this.contact);
      this.contact = advancePracticeContacts(this.contactRecipe, this.contact, previousRoot, this.root, this.contactSurface);
      this.stageContactSolution();
    }
    if (this.recipe.deathSplay !== false && this.wasAlive && !a.alive) for (let l = 0; l < 4; l++) this.legAbd[l] = ((l % 2 === 0) === (i.deathSide < 0)) ? .35 : .25;
    this.wasAlive = a.alive;
    if (near) {
      if (this.quad !== null) {
        const c = this.quadClock; c.alive = a.alive; c.deathT = i.deathT; c.deathSide = i.deathSide; c.speed = a.speed;
        this.quad.apply(this.law.pose, dt, c);
      }
      {
        const c = this.context; c.dt = dt; c.t = t; c.speed = a.speed; c.strafe = a.strafe; c.phase = this.law.phase; c.state = a.state; c.alive = a.alive;
        c.deathT = i.deathT; c.flinch = i.flinch; c.brace = i.brace * i.brace * (3 - 2 * i.brace); c.attack = a.attackPhase; c.lookWeight = this.law.lookAmt; c.yaw = a.yaw; c.mem = a.mem;
        this.animate?.(c);
      }
    }
    applyAnimalRoot(this.root, a.position, a.yaw, this.law.tiltPitch, this.law.tiltRoll, this.recipe.custom, a.alive, i.flinch, i.flinchPitch, i.flinchRoll, this.recipe.rootFlinch);
    this.root.scale.setScalar(a.scale);
    if (a.alive) this.checkContactClearance();
  }
  /** The native decision owner chooses the same terrain cadence as the page; no publication. */
  sampleTerrain(): void { this.actor.samplePoseTerrain(this.law); }
  /** Explicit render-equivalent boundary after body contacts and equipment queries. Allocates nothing. A staged
   * `through` joint publishes only that joint's parent chain (a forced getter's read); its descendants keep their last
   * publication until the next full one, and a continuation saved between the two re-solves them approximately. */
  publish(through?: string): void {
    if (this.history !== undefined && through !== undefined) throw new Error('Practice pose publishes complete endpoints only');
    const last = through === undefined ? this.joints.length - 1 : this.recipe.joints.findIndex(row => row.name === through);
    if (last === -1) throw new Error('Missing native creature publish joint');
    for (let n = 0; n < 32; n++) {
      if (n > last) break;
      const j = this.joints[n]; if (j === undefined) throw new Error('Missing native creature pose joint'); this.fk.setLocal(n, j);
      const p = n * 10; this.published[p] = j.position.x; this.published[p + 1] = j.position.y; this.published[p + 2] = j.position.z;
      this.published[p + 3] = j.rotation.x; this.published[p + 4] = j.rotation.y; this.published[p + 5] = j.rotation.z; this.published[p + 6] = NativeCreaturePose.ORDERS.indexOf(j.rotation.order);
      this.published[p + 7] = j.scale.x; this.published[p + 8] = j.scale.y; this.published[p + 9] = j.scale.z;
    }
    this.frame.compose(this.root.position, this.physicalRoot ? this.physicalCurrent : this.quaternion.setFromEuler(this.root.rotation), this.root.scale); this.publishedFrame.set(this.frame.elements); this.fk.solve(this.frame, last);
    this.history?.root.set(NativeCreaturePose.values(this.root));
  }
  /** Prepare a prospective hit entirely off the live joints/history/context. The same admitted numeric
   * evaluator runs once, before damage commits; refusal cannot consume HP, an ordinal or a publication.
   * The returned trusted operation only copies the validated endpoint, never evaluates or advances. */
  prepareAppliedHit(hit: AnimalAppliedHit): AnimalHitPublication | undefined {
    const h = this.history;
    if (h === undefined) return undefined;
    if (this.corpse !== undefined && (hit.amount < 0 || ![hit.amount, hit.hp, hit.lastHitT, hit.deathT,
      hit.deathSide, hit.desiredSpeed, hit.flinch, hit.flinchRoll, hit.flinchPitch,
      hit.point.x, hit.point.y, hit.point.z, hit.direction.x, hit.direction.y, hit.direction.z].every(Number.isFinite)))
      throw new Error('Invalid native contact');
    if (h.ordinal >= Number.MAX_SAFE_INTEGER) throw new Error('Practice hit ordinal exhausted');
    const ordinal = h.ordinal + 1, kind = hit.alive ? 1 : 2, entry = this.published.slice();
    const bones: Record<string, AnimalRigJoint> = {};
    const joints = this.joints.map((source, index) => {
      const name = this.recipe.joints[index]?.name;
      if (name === undefined) throw new Error('Missing native creature pose joint');
      const joint = NativeCreaturePose.joint();
      joint.position.copy(source.position); joint.rotation.copy(source.rotation); joint.scale.copy(source.scale);
      bones[name] = joint; return joint;
    });
    const context: AnimalRigContext = { ...this.context, bones,
      transition: this.transitionObservation({ ...h, ordinal, kind, elapsed: 0, entry }) };
    this.refreshPracticeContext(0, h.time, context);
    context.alive = hit.alive; context.state = hit.state; context.deathT = hit.deathT; context.flinch = hit.flinch;
    if (!hit.alive) context.attack = -1;
    this.animate?.(context);
    // Contact lanes are direct copies; a zero-time hit cannot advance, blend or replace their endpoint.
    let nextContact = this.contact === undefined ? undefined : hit.alive ? structuredClone(this.contact)
      : releasePracticeContacts(this.contact, ['lethal handoff']);
    if (hit.alive && nextContact !== undefined && this.contactRecipe !== undefined && this.contactSurface !== undefined) {
      const failures = practiceContactClearance(this.contactRecipe, this.recipe.joints, this.root, bones, this.contactSurface);
      if (failures.length > 0) nextContact = releasePracticeContacts(nextContact, [...nextContact.failures, ...failures]);
    }
    const fk = new CollisionPose(this.recipe.joints), published = new Float64Array(this.published.length);
    joints.forEach((joint, index) => { fk.setLocal(index, joint); published.set(NativeCreaturePose.values(joint), index * 10); });
    const frame = new Matrix4().compose(this.root.position, new Quaternion().setFromEuler(this.root.rotation), this.root.scale);
    fk.solve(frame);
    let handoff: NativeCorpseHandoff | undefined;
    const rootJoint = NativeCreaturePose.joint(); rootJoint.position.copy(this.root.position); rootJoint.rotation.copy(this.root.rotation); rootJoint.scale.copy(this.root.scale);
    let physical: CorpseRootEndpoint | undefined;
    if (!hit.alive && this.corpse !== undefined) {
      handoff = this.corpse.prepare(hit, { position: this.root.position, rotation: new Quaternion().setFromEuler(this.root.rotation),
        joints: this.corpseJoints(joints), velocity: { x: (h.motion[0] ?? 0) / FIXED_STEP, y: (h.motion[1] ?? 0) / FIXED_STEP, z: (h.motion[2] ?? 0) / FIXED_STEP } });
      try {
        physical = handoff.root; rootJoint.position.copy(physical.position); const q = new Quaternion().copy(physical.rotation);
        rootJoint.rotation.setFromQuaternion(q); frame.compose(rootJoint.position, q, rootJoint.scale); fk.solve(frame);
      } catch (error) { handoff.abort(); throw error; }
    }
    const root = NativeCreaturePose.values(rootJoint);
    return { ...(handoff === undefined ? {} : { handoff }), commit: () => {
      // No user code, validation or clock lies beyond this point. All storage and joints are owner-created.
      this.joints.forEach((joint, index) => {
        const source = joints[index];
        if (source !== undefined) { joint.position.copy(source.position); joint.rotation.copy(source.rotation); joint.scale.copy(source.scale); }
      });
      this.published.set(published); this.publishedFrame.set(frame.elements); this.frame.copy(frame); this.fk = fk;
      if (physical !== undefined) {
        this.physicalRoot = true; this.physicalCurrent.copy(physical.rotation); this.physicalPrevious.copy(physical.rotation);
        this.root.position.copy(rootJoint.position); this.root.rotation.copy(rootJoint.rotation);
      }
      if (nextContact !== undefined) { this.contact = nextContact; this.previousContact = structuredClone(nextContact); }
      h.entry.set(entry); h.ordinal = ordinal; h.kind = kind; h.elapsed = 0; h.root.set(root);
      const c = this.context;
      c.dt = context.dt; c.t = context.t; c.speed = context.speed; c.strafe = context.strafe; c.phase = context.phase;
      c.state = context.state; c.alive = context.alive; c.deathT = context.deathT; c.flinch = context.flinch;
      c.brace = context.brace; c.attack = context.attack; c.lookWeight = context.lookWeight; c.yaw = context.yaw; c.mem = context.mem;
      // An event endpoint is visible immediately even at interpolation alpha zero.
      h.previous.set(published); h.previousRoot.set(root);
    } };
  }
  private refreshPracticeContext(dt: number, time: number, c = this.context): void {
    const a = this.actor, i = { ...this.poseSample }; a.samplePose(i);
    c.dt = dt; c.t = time; c.speed = a.speed; c.strafe = a.strafe; c.phase = this.law.phase; c.state = a.state; c.alive = a.alive;
    c.deathT = a.poseDeathTime;
    c.flinch = i.flinch; c.brace = i.brace * i.brace * (3 - 2 * i.brace); c.attack = a.alive ? a.attackPhase : -1;
    c.lookWeight = this.law.lookAmt; c.yaw = a.yaw; c.mem = a.mem;
  }
  private transitionObservation(h = this.history): AnimalPoseTransition {
    if (h === undefined) throw new Error('Missing native practice pose owner');
    const entry: Record<string, AnimalPoseTransition['entry'][string]> = {};
    this.recipe.joints.forEach((row, index) => {
      const p = index * 10, axis = (offset: number) => Object.freeze({
        x: h.entry[p + offset] ?? 0, y: h.entry[p + offset + 1] ?? 0, z: h.entry[p + offset + 2] ?? 0,
      });
      entry[row.name] = Object.freeze({ position: axis(0), rotation: axis(3), scale: axis(7) });
    });
    return Object.freeze({ ...(this.contactRecipe === undefined ? {} : { solved: structuredClone(this.solvedContact) }), ordinal: h.ordinal, kind: h.kind, elapsed: h.elapsed, entry: Object.freeze(entry),
      displacement: Object.freeze({ x: h.motion[0] ?? 0, y: h.motion[1] ?? 0, z: h.motion[2] ?? 0,
        distance: h.motion[3] ?? 0, total: h.motion[4] ?? 0, heading: h.motion[5] ?? 0 }) });
  }
  /** Explicit diagnostic placement/re-entry boundary, never inferred from a large distance threshold. */
  get placementAllowed(): boolean { return this.history !== undefined && !this.physicalRoot; }
  resetMotionAnchor(contactPlacement?: PracticeContactState): void {
    const h = this.history; if (h === undefined || this.physicalRoot) throw new Error('Missing living native practice pose owner');
    const a = this.actor;
    if (this.contactRecipe !== undefined) {
      const placement = contactPlacement ?? this.prepareContactPlacement(a.position, a.yaw);
      this.contact = placement; this.previousContact = placement === undefined ? undefined : structuredClone(placement);
    }
    h.anchor.set([a.position.x, a.position.y, a.position.z, a.yaw]); h.motion.fill(0);
    this.root.position.copy(a.position); this.root.rotation.y = a.yaw; this.root.scale.setScalar(a.scale);
    if (this.contact !== undefined) this.root.rotation.set(0, a.yaw, 0, 'YXZ');
    if (this.contact !== undefined) {
      this.stageContactSolution();
      for (const [name, value] of Object.entries(this.solvedContact)) this.bones[name]?.rotation.set(value.rotation.x, value.rotation.y, value.rotation.z, 'XYZ');
      this.checkContactClearance();
    }
    this.publish(); h.previous.set(this.published); h.previousRoot.set(h.root);
  }
  /** Quiet presentation from published endpoints; opt-in contacts re-solve detached joints. Collision queries remain on current native FK. */
  copyPublished(root: AnimalRigJoint, bones: Readonly<Record<string, AnimalRigJoint>>, alpha: number): void {
    const h = this.history;
    if (h === undefined || !Number.isFinite(alpha) || alpha < 0 || alpha > 1
      || this.recipe.joints.some(row => bones[row.name] === undefined)) throw new Error('Invalid native practice pose consumer');
    // The frozen endpoint is exact, not another Euler/quaternion interpolation.
    const blend = this.physicalFrozen ? 1 : alpha;
    const copy = (target: AnimalRigJoint, previous: Float64Array, current: Float64Array, start: number): void => {
      const from = this.renderPrevious, to = this.renderCurrent;
      NativeCreaturePose.read(from, Array.from(previous.subarray(start, start + 10)), 0);
      NativeCreaturePose.read(to, Array.from(current.subarray(start, start + 10)), 0);
      if (blend === 1) { target.position.copy(to.position); target.rotation.copy(to.rotation); target.scale.copy(to.scale); return; }
      if (blend === 0) { target.position.copy(from.position); target.rotation.copy(from.rotation); target.scale.copy(from.scale); return; }
      target.position.lerpVectors(from.position, to.position, blend); target.scale.lerpVectors(from.scale, to.scale, blend);
      this.quaternion.setFromEuler(from.rotation); this.renderQuaternion.setFromEuler(to.rotation);
      target.rotation.setFromQuaternion(this.quaternion.slerp(this.renderQuaternion, blend), to.rotation.order);
    };
    this.recipe.joints.forEach((row, index) => { const joint = bones[row.name]; if (joint !== undefined) copy(joint, h.previous, this.published, index * 10); });
    copy(root, h.previousRoot, h.root, 0);
    if (!this.physicalRoot && blend > 0 && blend < 1 && this.contact !== undefined && this.previousContact !== undefined
      && this.contactRecipe !== undefined && this.contact.failures.length === 0) {
      const solution = this.contactSolution(root, this.contact, this.previousContact, blend);
      if (solution.failures.length > 0) throw new Error(`Contact presentation refused: ${solution.failures.join('; ')}`);
      for (const [name, rotation] of Object.entries(solution.rotations)) bones[name]?.rotation.set(...rotation, 'XYZ');
      if (this.contactSurface !== undefined && practiceContactClearance(this.contactRecipe, this.recipe.joints, root, bones, this.contactSurface).length > 0)
        throw new Error('Contact presentation source clearance refused');
    }
    if (this.physicalRoot) {
      this.renderQuaternion.copy(blend === 1 ? this.physicalCurrent : this.physicalPrevious);
      if (blend > 0 && blend < 1) this.renderQuaternion.slerp(this.physicalCurrent, blend);
      if (root.quaternion === undefined) root.rotation.setFromQuaternion(this.renderQuaternion);
      else root.quaternion.copy(this.renderQuaternion);
    }
  }
  /** An extra contact point on any recipe joint (a weak point, an anchor), read from the last publication. */
  jointPoint(name: string, at: readonly [number, number, number], out: Vector3): Vector3 {
    const index = this.recipe.joints.findIndex(row => row.name === name);
    if (index === -1) throw new Error('Missing native creature query joint');
    return this.fk.point(index, at, out);
  }
  headWorld(out: Vector3): void { this.fk.point(this.head, this.actor.dims.headAt ?? NativeCreaturePose.ORIGIN, out); }
  bodyCapsule(rear: Vector3, front: Vector3): void {
    const d = this.actor.dims; this.fk.capsule(this.body, d.capsuleAxis === 'y' ? NativeCreaturePose.ORIGIN : d.bodyAt ?? NativeCreaturePose.ORIGIN, d.capsuleAxis ?? 'z', d.capsuleAxis === 'y' ? 0 : d.bodyPitch ?? 0, d.bodyHalfLen, rear, front);
  }
  foreCapsule(rear: Vector3, front: Vector3): boolean {
    const f = this.actor.dims.fore; if (f === undefined) return false; this.fk.capsule(this.fore, f.at, 'x', 0, f.halfLen, rear, front); return true;
  }
  /** Native format retains distinct contact publication. Local format preserves an older fully published
   * quadruped envelope byte-for-byte; only callers that publish every local before saving may select it. */
  snapshot(format: 'native' | 'local' = 'native'): string {
    if (format === 'local' && this.history !== undefined) throw new Error('Practice transition requires native continuation');
    if (format === 'local') {
      const transform = (joint: AnimalRigJoint) => ({ p: joint.position.toArray(),
        r: [joint.rotation.x, joint.rotation.y, joint.rotation.z], order: joint.rotation.order, s: joint.scale.toArray() });
      return JSON.stringify({ pose: this.law.snapshot(), breath: this.quad?.snapshot() ?? 0, root: transform(this.root),
        bones: this.joints.map((joint, index) => [this.recipe.joints[index]?.name, transform(joint)]) });
    }
    const h = this.history;
    return JSON.stringify({ version: h === undefined ? 1 : this.corpse === undefined ? 2 : 3, recipe: this.identity, scalar: this.law.snapshot(), breath: this.quad?.snapshot() ?? 0,
      local: NativeCreaturePose.encoded([...this.joints.flatMap(NativeCreaturePose.values), ...NativeCreaturePose.values(this.root)]), published: NativeCreaturePose.encoded(Array.from(this.published)), frame: NativeCreaturePose.encoded(Array.from(this.publishedFrame)), leg: NativeCreaturePose.encoded(Array.from(this.legAbd)), wasAlive: this.wasAlive,
      ...(h === undefined ? {} : { history: { ordinal: h.ordinal, kind: h.kind, elapsed: h.elapsed, time: h.time,
        entry: NativeCreaturePose.encoded(Array.from(h.entry)), previous: NativeCreaturePose.encoded(Array.from(h.previous)),
        root: NativeCreaturePose.encoded(Array.from(h.root)), previousRoot: NativeCreaturePose.encoded(Array.from(h.previousRoot)),
        motion: NativeCreaturePose.encoded(Array.from(h.motion)), anchor: NativeCreaturePose.encoded(Array.from(h.anchor)) } }),
      ...(this.contact === undefined || this.previousContact === undefined ? {} : { contact: { current: this.contact, previous: this.previousContact } }),
      ...(this.corpse === undefined ? {} : { physical: { active: this.physicalRoot, frozen: this.physicalFrozen,
        previous: this.physicalPrevious.toArray(), current: this.physicalCurrent.toArray(), owner: this.corpse.diagnostic() } }) });
  }
  /** Convert a scalar-only legacy clock or its complete named joint/root envelope. Preflight is quiet;
   * complete transforms retain frozen far-LOD joints exactly, while scalar-only callers republish from the actor. */
  adopt(input: unknown): void {
    if (this.history !== undefined) throw new Error('Practice transition requires native continuation');
    const state = poseSchema.parse(NativeCreaturePose.Legacy, typeof input === 'string' ? { pose: input } : input);
    if (state.bones !== undefined && (state.bones.length !== this.joints.length
      || state.bones.some(([name], index) => name !== this.recipe.joints[index]?.name))
      || (this.quad === null && (state.breath ?? 0) !== 0)) throw new Error('Incompatible legacy native pose');
    new AnimalPoseLaw(this.law.recipe).restore(state.pose);
    this.law.restore(state.pose); this.wasAlive = this.actor.alive; this.quad?.restore(state.breath ?? 0);
    const apply = (joint: AnimalRigJoint, row: poseSchema.InferOutput<typeof NativeCreaturePose.transform>): void => {
      joint.position.fromArray(row.p); joint.rotation.set(...row.r, row.order); joint.scale.fromArray(row.s);
    };
    state.bones?.forEach(([, row], index) => { const joint = this.joints[index]; if (joint !== undefined) apply(joint, row); });
    if (state.root !== undefined) apply(this.root, state.root);
    else {
      const a = this.actor, i = this.law.input;
      applyAnimalRoot(this.root, a.position, a.yaw, this.law.tiltPitch, this.law.tiltRoll, this.recipe.custom, a.alive, i.flinch, i.flinchPitch, i.flinchRoll);
    }
    this.publish();
  }
  /** Strict bounded atomic restore. No posing, terrain, body, contact, RNG or publications of current locals. */
  restore(value: string): void {
    if (this.corpse !== undefined) throw new Error('Physical native pose-only restoration is unsupported');
    if (value.length > 65536) throw new Error('Invalid native creature pose continuation');
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed === 'object' && parsed !== null && !Object.hasOwn(parsed, 'version')) { this.adopt(parsed); return; }
    const state = this.history === undefined ? poseSchema.parse(NativeCreaturePose.Saved, parsed) : poseSchema.parse(NativeCreaturePose.PracticeSaved, parsed);
    if (state.recipe !== this.identity) throw new Error('Incompatible native creature pose continuation');
    const savedHistory = 'history' in state ? state.history : undefined;
    const history = savedHistory === undefined ? undefined : {
      entry: NativeCreaturePose.decoded(savedHistory.entry, this.published.length), previous: NativeCreaturePose.decoded(savedHistory.previous, this.published.length),
      root: NativeCreaturePose.decoded(savedHistory.root, 10), previousRoot: NativeCreaturePose.decoded(savedHistory.previousRoot, 10),
      motion: NativeCreaturePose.decoded(savedHistory.motion, 6), anchor: NativeCreaturePose.decoded(savedHistory.anchor, 4),
    };
    const local = NativeCreaturePose.decoded(state.local, (this.joints.length + 1) * 10), published = NativeCreaturePose.decoded(state.published, this.published.length), frame = NativeCreaturePose.decoded(state.frame, 16), leg = NativeCreaturePose.decoded(state.leg, 4);
    const orders = [...local.filter((_n, i) => i % 10 === 6), ...published.filter((_n, i) => i % 10 === 6),
      ...history === undefined ? [] : [...history.entry, ...history.previous, ...history.root, ...history.previousRoot].filter((_n, i) => i % 10 === 6)];
    if (orders.some(order => !Number.isInteger(order) || NativeCreaturePose.ORDERS[order] === undefined) || (this.quad === null && state.breath !== 0)) throw new Error('Invalid native creature pose continuation');
    const contact = 'contact' in state ? state.contact : undefined;
    if ((this.contactRecipe === undefined) !== (contact === undefined)) throw new Error('Incompatible contact continuation');
    if (contact !== undefined) {
      for (const endpoint of [contact.current, contact.previous]) {
        if (endpoint.source !== this.contactRecipe?.source || endpoint.surface !== this.contactSurface?.id
          || endpoint.revision !== this.contactSurface.revision || !this.contactSurface.active
          || endpoint.feet.filter(foot => foot.mode === 'swing').length > 1
          || endpoint.feet.some(foot => foot.elapsed > (this.contactRecipe?.swingTicks ?? 0)
            || (foot.mode === 'swing' && (foot.elapsed === 0 || foot.elapsed === this.contactRecipe?.swingTicks))
            || (foot.mode === 'stance' && foot.elapsed !== 0 && foot.elapsed !== this.contactRecipe?.swingTicks)
            || (foot.mode === 'released' && endpoint.failures.length === 0))) throw new Error('Incompatible contact continuation');
      }
      const scale = local[this.joints.length * 10 + 7];
      if (scale === undefined || this.contactRecipe === undefined || scale < this.contactRecipe.minScale || scale > this.contactRecipe.maxScale
        || scale !== local[this.joints.length * 10 + 8] || scale !== local[this.joints.length * 10 + 9]) throw new Error('Invalid contact restore scale');
      for (const endpoint of [contact.current, contact.previous]) for (const [index, foot] of endpoint.feet.entries()) {
        const spec = this.contactRecipe.feet[index]; if (spec === undefined || this.contactSurface === undefined) throw new Error('Missing contact restore foot');
        const expectedY = this.contactSurface.y + spec.nominal[1] * scale;
        if ([foot.plant, foot.start, foot.target].some(endpointFrame => {
          if (Math.abs(endpointFrame.position[1] - expectedY) > 1e-10) return true;
          const surface = this.contactSurface;
          if (surface === undefined) return true;
          const c = Math.cos(endpointFrame.yaw), s = Math.sin(endpointFrame.yaw);
          return spec.sole.some(p => {
            const x = endpointFrame.position[0] + scale * (c * p[0] + s * p[2]);
            const z = endpointFrame.position[2] + scale * (-s * p[0] + c * p[2]);
            return x <= surface.minX || x >= surface.maxX || z <= surface.minZ || z >= surface.maxZ;
          });
        })
          || (foot.mode === 'stance' && foot.elapsed === this.contactRecipe.swingTicks && JSON.stringify(foot.plant) !== JSON.stringify(foot.target))
          || (endpoint.failures.length > 0 && foot.mode !== 'released')) throw new Error('Invalid contact restore frame');
      }
      if (contact.previous.tick > contact.current.tick || contact.current.tick - contact.previous.tick > 1) throw new Error('Invalid contact interval');
    }
    const validation = new AnimalPoseLaw(this.law.recipe); validation.restore(state.scalar);
    this.law.restore(state.scalar); this.quad?.restore(state.breath); this.wasAlive = state.wasAlive; this.legAbd.set(leg);
    if (contact !== undefined) { this.contact = structuredClone(contact.current); this.previousContact = structuredClone(contact.previous); }
    this.published.set(published); this.publishedFrame.set(frame); this.frame.fromArray(frame);
    const probe = NativeCreaturePose.joint();
    for (let n = 0; n < 32; n++) { if (n >= this.joints.length) break; NativeCreaturePose.read(probe, published, n * 10); this.fk.setLocal(n, probe); }
    this.fk.solve(this.frame);
    this.joints.forEach((j, n) => { NativeCreaturePose.read(j, local, n * 10); }); NativeCreaturePose.read(this.root, local, this.joints.length * 10);
    if (this.history !== undefined && history !== undefined && savedHistory !== undefined) {
      Object.assign(this.history, { ordinal: savedHistory.ordinal, kind: savedHistory.kind, elapsed: savedHistory.elapsed, time: savedHistory.time });
      for (const key of ['entry', 'previous', 'root', 'previousRoot', 'motion', 'anchor'] as const) this.history[key].set(history[key]);
      for (const name of this.contactRecipe?.feet.flatMap(foot => foot.joints) ?? []) {
        const joint = this.bones[name]; if (joint !== undefined) this.solvedContact[name] = { rotation: { x: joint.rotation.x, y: joint.rotation.y, z: joint.rotation.z } };
      }
      this.refreshPracticeContext(0, savedHistory.time);
    }
  }
}

/** One-time native spawn attachment, after the trusted roster has admitted its actual baked recipe. */
export function attachNativeCreaturePose(actor: AnimalSim, recipe: NativeCreaturePoseRecipe, animate?: (context: AnimalRigContext) => void): {
  readonly pose: NativeCreaturePose; readonly body: AnimalSim & { hidden: boolean; sampleTerrain: () => void };
} {
  const pose = new NativeCreaturePose(actor, recipe, animate);
  actor.bindVolumes(pose);
  return { pose, body: Object.assign(actor, { hidden: false, sampleTerrain: (): void => { pose.sampleTerrain(); } }) };
}

/**
 * Bounded native pose ownership for an existing creature roster. Recipe rows retain last-match order;
 * attachment, retirement and publication happen only when the caller's roster asks. No clock or save owner is added.
 * Callers keep their saved envelope and use the borrowed poses' quiet snapshot/restore methods unchanged.
 */
export function createNativeCreaturePoses(rows: readonly { readonly kind: string; readonly variant: string; readonly pose: NativeCreaturePoseRecipe }[],
  limit: number, animations: ReadonlyMap<string, (context: AnimalRigContext) => void> = new Map()): {
    readonly binding: {
      readonly preflight: (body: { readonly kind: string; readonly variant: string }) => void;
      readonly attach: (actor: AnimalSim, body: { readonly id: string; readonly kind: string; readonly variant: string }) => ReturnType<typeof attachNativeCreaturePose>['body'];
    };
    readonly get: (id: string) => NativeCreaturePose | undefined;
    readonly delete: (id: string) => void;
    readonly publish: (at: (index: number) => string | null | undefined) => void;
  } {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1024 || rows.length > 4096) throw new RangeError('Invalid native pose roster bound');
  const recipes = new Map<string, Map<string, NativeCreaturePoseRecipe>>(), poses = new Map<string, NativeCreaturePose>();
  for (const row of rows) {
    let group = recipes.get(row.kind);
    if (group === undefined) { group = new Map(); recipes.set(row.kind, group); }
    group.set(row.variant, row.pose);
  }
  const recipe = (body: { readonly kind: string; readonly variant: string }): NativeCreaturePoseRecipe => {
    const value = recipes.get(body.kind)?.get(body.variant);
    if (value === undefined) throw new Error('Missing native creature pose recipe');
    return value;
  };
  return {
    binding: { preflight: body => { recipe(body); }, attach: (actor, body) => {
      if (!poses.has(body.id) && poses.size >= limit) throw new RangeError('Native pose roster exceeds its bound');
      const attached = attachNativeCreaturePose(actor, recipe(body), animations.get(body.kind));
      poses.set(body.id, attached.pose); return attached.body;
    } },
    get: id => poses.get(id), delete: id => { poses.delete(id); },
    publish: at => { for (let i = 0; i < limit; i++) { const id = at(i); if (id !== null && id !== undefined) poses.get(id)?.publish(); } },
  };
}
