import * as THREE from 'three';
import { smoothstep } from '@wildshard/engine/core/noise';

/**
 * The limb rig (SHARD-PLATFORM M3): a custom four-legged rig posed from one scalar record, so its clips can blend before
 * one IK pass plants the feet. A shard names its skeleton (a spine of root → hips → tail and root → chest → neck → head,
 * four limbs of upper → middle → lower → foot) in a `LimbRigSpec`; this system measures the rest off the bones
 * (`limbRest`), solves a pose onto them (`applyLimbPose`: the spine by FK, each limb by two-bone IK in its own rest bend
 * plane, so the rest pose solves to itself and a knee never flips) and plays clips written as rows (`playPoseClip`).
 *
 * A clip is data: named values (`lets`, evaluated in order), then the channels it sets (`set`), each an expression tree of
 * numbers, names and calls (`PoseExpr`). The evaluation follows the tree exactly, left to right, so a clip written in the
 * same order as the arithmetic it replaces reproduces it bit for bit (Antler King: test/shards/pine-hollow/king-clips.test.ts).
 */

/** The pose's scalar channels: offsets from the rest (the hull's stance). Angles in radians: pitch + = nose down (three's
 *  +x), yaw + = to its left, roll + = its right side down. */
export const LIMB_POSE_KEYS = ['rootY', 'rootZ', 'rootPitch', 'rootRoll', 'rootYaw', 'hipsPitch', 'chestPitch', 'chestYaw', 'chestRoll', 'neckPitch', 'neckYaw', 'headPitch', 'headYaw', 'headRoll', 'tailPitch', 'tailYaw'] as const;
export type LimbPoseKey = typeof LIMB_POSE_KEYS[number];

/** One pose: the spine's scalars and, per limb (the spec's order), the foot's model-space offset from its rest spot and
 *  its toe pitch (`feet[limb * 4 + 0..3]` = dx dy dz toe). */
export type LimbPose = Record<LimbPoseKey, number> & { feet: Float32Array };

export function newLimbPose(): LimbPose {
  return { rootY: 0, rootZ: 0, rootPitch: 0, rootRoll: 0, rootYaw: 0, hipsPitch: 0, chestPitch: 0, chestYaw: 0, chestRoll: 0, neckPitch: 0, neckYaw: 0, headPitch: 0, headYaw: 0, headRoll: 0, tailPitch: 0, tailYaw: 0, feet: new Float32Array(16) };
}
/** Every channel back to the rest. */
export function zeroLimbPose(p: LimbPose): LimbPose { for (const k of LIMB_POSE_KEYS) p[k] = 0; p.feet.fill(0); return p; }
/** `into += p × w`, every channel (nothing when `w` is 0). */
export function addLimbPose(into: LimbPose, p: LimbPose, w: number): void {
  if (w === 0) return;
  for (const k of LIMB_POSE_KEYS) into[k] += p[k] * w;
  for (let i = 0; i < 16; i++) into.feet[i] = (into.feet[i] ?? 0) + (p.feet[i] ?? 0) * w;
}
/** `p × keep`, every channel (a clip taking the body over). */
export function scaleLimbPose(p: LimbPose, keep: number): void {
  for (const key of LIMB_POSE_KEYS) p[key] *= keep;
  for (let i = 0; i < 16; i++) p.feet[i] = (p.feet[i] ?? 0) * keep;
}

/** A shard's limb rig: its bone names and proportions. */
export interface LimbRigSpec {
  /** the spine: the root (the body, moved and turned by the root channels) and the bones the spine channels turn */
  readonly spine: { readonly root: string; readonly hips: string; readonly tail: string; readonly chest: string; readonly neck: string; readonly head: string };
  /** the hips counter-turn against the root: hips pitch − rootPitch × [0], roll −rootRoll × [1] */
  readonly hipsCounter: readonly [number, number];
  /** the four limbs, upper → middle → lower → foot (the order of `LimbPose.feet`) */
  readonly limbs: readonly (readonly [string, string, string, string])[];
  /** the two bones whose mean rest height is the body's size unit H (at least `minHeight`) */
  readonly heightFrom: readonly [string, string];
  readonly minHeight: number;
  /** the walk's and the charge's stride, × H */
  readonly walkStride: number;
  readonly chargeStride: number;
}

/** The rig's rest, readable without bones (a bake or a headless host keeps it). */
export interface LimbPoseRest {
  at: Readonly<Record<string, Readonly<{ x: number; y: number; z: number }>>>;
  rootPos: Readonly<{ x: number; y: number; z: number }>;
  /** the size unit and the strides it gives, model units */
  H: number; walkStride: number; chargeStride: number;
}

export interface LimbRest extends LimbPoseRest {
  bones: Record<string, THREE.Bone>;
  names: string[];
  /** model-space rest position per bone name */
  at: Record<string, THREE.Vector3>;
  rootPos: THREE.Vector3;
  H: number; walkStride: number; chargeStride: number;
  /** each limb's rest bend plane (unit normal, model space) and the side of it its middle joint sits on (±1) */
  plane: THREE.Vector3[]; bend: number[];
}
const rests = new WeakMap<THREE.Bone, LimbRest>();
const isBone = (o: THREE.Object3D | null): o is THREE.Bone => o !== null && (o as Partial<THREE.Bone>).isBone === true;

/** The rig's rest, read once off its bones (their local positions are the rest offsets; rest rotations are identity). */
export function limbRest(spec: LimbRigSpec, bones: Record<string, THREE.Bone>): LimbRest {
  const body = bones[spec.spine.root];
  if (!body) throw new Error(`limb rig: no ${spec.spine.root} bone`);
  const hit = rests.get(body);
  if (hit) return hit;
  const at: Record<string, THREE.Vector3> = {};
  const names = Object.keys(bones);
  const world = (b: THREE.Bone): THREE.Vector3 => {
    const w = at[b.name];
    if (w) return w;
    const p = isBone(b.parent) ? world(b.parent).clone().add(b.position) : b.position.clone();
    at[b.name] = p;
    return p;
  };
  for (const n of names) { const b = bones[n]; if (b) world(b); }
  const P = (n: string): THREE.Vector3 => at[n] ?? new THREE.Vector3();
  const H = Math.max(spec.minHeight, (P(spec.heightFrom[0]).y + P(spec.heightFrom[1]).y) / 2);
  const plane: THREE.Vector3[] = [], bend: number[] = [];
  for (const [a, b, c] of spec.limbs) {
    const A = P(a), B = P(b), C = P(c);
    const n = new THREE.Vector3().crossVectors(new THREE.Vector3().subVectors(B, A), new THREE.Vector3().subVectors(C, B));
    // a near-straight limb has no plane of its own: the side axis, bent forward (+z) like a knee
    if (n.length() < 1e-4 * A.distanceTo(C) ** 2) n.set(1, 0, 0); else n.normalize();
    const u = new THREE.Vector3().subVectors(C, A).normalize();
    const off = new THREE.Vector3().subVectors(B, A).addScaledVector(u, -new THREE.Vector3().subVectors(B, A).dot(u));
    const w = new THREE.Vector3().crossVectors(n, u);
    plane.push(n); bend.push(off.lengthSq() < 1e-10 ? -1 : Math.sign(off.dot(w)) || 1);
  }
  const r: LimbRest = { bones, names, at, rootPos: body.position.clone(), H, walkStride: spec.walkStride * H, chargeStride: spec.chargeStride * H, plane, bend };
  rests.set(body, r);
  return r;
}

// ─────────────────────────────── the solve: FK + two-bone IK ───────────────────────────────

const clamp = THREE.MathUtils.clamp;
const _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _wq: Record<string, THREE.Quaternion> = {};
const _wp: Record<string, THREE.Vector3> = {};
const wq = (n: string): THREE.Quaternion => (_wq[n] ??= new THREE.Quaternion());
const wp = (n: string): THREE.Vector3 => (_wp[n] ??= new THREE.Vector3());
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _t = new THREE.Vector3(), _u = new THREE.Vector3(), _n = new THREE.Vector3(), _w = new THREE.Vector3(), _x = new THREE.Vector3();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _qi = new THREE.Quaternion(), _m = new THREE.Matrix4(), _m0 = new THREE.Matrix4();

/** set bone `n`'s local rotation from euler angles and record its model-space transform (the parent's first) */
function fk(r: LimbRest, n: string, x: number, y: number, z: number): void {
  const b = r.bones[n];
  if (!b) return;
  _e.set(x, y, z, 'YXZ');
  b.quaternion.setFromEuler(_e);
  record(r, n);
}
function record(r: LimbRest, n: string): void {
  const b = r.bones[n];
  if (!b) return;
  const par = isBone(b.parent) ? b.parent.name : null;
  if (par === null) { wq(n).copy(b.quaternion); wp(n).copy(b.position); return; }
  wq(n).copy(wq(par)).multiply(b.quaternion);
  wp(n).copy(b.position).applyQuaternion(wq(par)).add(wp(par));
}
/** a rotation taking frame (u0, n0) onto (u1, n1) (unit, orthogonal pairs) */
function frameRot(u0: THREE.Vector3, n0: THREE.Vector3, u1: THREE.Vector3, n1: THREE.Vector3, out: THREE.Quaternion): THREE.Quaternion {
  _x.crossVectors(u0, n0); _m0.makeBasis(u0, n0, _x);
  _x.crossVectors(u1, n1); _m.makeBasis(u1, n1, _x);
  _m.multiply(_m0.transpose());
  return out.setFromRotationMatrix(_m);
}

/**
 * Pose the skeleton: the spine by FK, each limb by two-bone IK onto its foot's target (rest spot + the pose's offset,
 * model space): the upper and middle bones solve, the lower keeps the ground's orientation (turned by the toe pitch).
 * The bend plane is the parent's side axis, and each limb bends the way its rest bends, so a knee never flips.
 */
export function applyLimbPose(spec: LimbRigSpec, r: LimbRest, p: LimbPose): void {
  const s = spec.spine, body = r.bones[s.root];
  if (!body) return;
  body.position.set(r.rootPos.x, r.rootPos.y + p.rootY, r.rootPos.z + p.rootZ);
  fk(r, s.root, p.rootPitch, p.rootYaw, p.rootRoll);
  fk(r, s.hips, p.hipsPitch - p.rootPitch * spec.hipsCounter[0], 0, -p.rootRoll * spec.hipsCounter[1]);
  fk(r, s.tail, p.tailPitch, p.tailYaw, 0);
  fk(r, s.chest, p.chestPitch, p.chestYaw, p.chestRoll);
  fk(r, s.neck, p.neckPitch, p.neckYaw, 0);
  fk(r, s.head, p.headPitch, p.headYaw, p.headRoll);
  for (let l = 0; l < spec.limbs.length; l++) {
    const chain = spec.limbs[l];
    if (!chain) continue;
    const [na, nb, nc, nd] = chain;
    const A = r.at[na], B = r.at[nb], C = r.at[nc], D = r.at[nd];
    const ba = r.bones[na], bb = r.bones[nb], bc = r.bones[nc], bd = r.bones[nd];
    if (!A || !B || !C || !D || !ba || !bb || !bc || !bd) continue;
    const par = isBone(ba.parent) ? ba.parent.name : s.root;
    // the upper joint where the spine left it
    _a.copy(ba.position).applyQuaternion(wq(par)).add(wp(par));
    // the target: the foot's rest + offset; the lower bone (C → D) turned by the toe pitch about the side axis
    const f = p.feet;
    _q1.setFromAxisAngle(_x.set(1, 0, 0), f[l * 4 + 3] ?? 0);
    _c.subVectors(C, D).applyQuaternion(_q1);
    _t.set(D.x + (f[l * 4] ?? 0), D.y + (f[l * 4 + 1] ?? 0), D.z + (f[l * 4 + 2] ?? 0)).add(_c);   // where the middle joint's child (C) must be
    const l1 = A.distanceTo(B), l2 = B.distanceTo(C);
    _u.subVectors(_t, _a);
    let d = _u.length();
    if (d < 1e-6) { _u.set(0, -1, 0); d = 1e-6; } else _u.multiplyScalar(1 / d);
    d = clamp(d, Math.abs(l1 - l2) + 1e-4, l1 + l2 - 1e-4);
    // the bend plane's normal: the limb's rest plane turned with the parent, square to the reach
    const n0 = r.plane[l] ?? _x.set(1, 0, 0);
    _n.copy(n0).applyQuaternion(wq(par));
    _n.addScaledVector(_u, -_n.dot(_u)).normalize();
    const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - along * along));
    // the middle joint on the side of the plane it sits on at rest
    _w.crossVectors(_n, _u).multiplyScalar(r.bend[l] ?? 1);
    _b.copy(_a).addScaledVector(_u, along).addScaledVector(_w, h);                   // the middle joint
    _t.copy(_a).addScaledVector(_u, d);                                                 // C, reachable
    // the rest frame of the upper bone: its direction and the same side normal at rest (the parent unturned)
    const u0 = new THREE.Vector3().subVectors(B, A).normalize(), r0 = n0.clone().addScaledVector(u0, -n0.dot(u0)).normalize();
    const u1 = new THREE.Vector3().subVectors(_b, _a).normalize(), n1 = _n.clone().addScaledVector(u1, -_n.dot(u1)).normalize();
    frameRot(u0, r0, u1, n1, _q2);                                                      // the upper bone's model-space rotation
    ba.quaternion.copy(_qi.copy(wq(par)).invert()).multiply(_q2);
    record(r, na);
    // the middle bone: its rest direction (turned by the upper) onto B → C
    const v0 = new THREE.Vector3().subVectors(C, B).normalize().applyQuaternion(_q2), v1 = new THREE.Vector3().subVectors(_t, _b).normalize();
    _q.setFromUnitVectors(v0, v1).multiply(_q2);
    bb.quaternion.copy(_qi.copy(_q2).invert()).multiply(_q);
    record(r, nb);
    // the lower bone: the ground's orientation turned by the toe
    bc.quaternion.copy(_qi.copy(_q).invert()).multiply(_q1);
    record(r, nc);
    bd.quaternion.identity();
    record(r, nd);
  }
}

// ─────────────────────────────── the clips: rows ───────────────────────────────

/**
 * An expression: a number; a name (a `let` of the clip, the clip's input `x`, the clock `t`, the rest's `H`, `walkStride`
 * or `chargeStride`, or `TAU`); or a call `[op, ...args]`:
 *   `+` `*` (two or more, folded left to right), `-` (two), `neg`, `sin`, `cos`, `abs`, `max`, `min` (two, Math's order),
 *   `pow` (two), `?` (cond ≠ 0 ? a : b), `step` (x, a, b: smoothstep(0, 1, (x − a) / (b − a))), `at` (bone, 'x' | 'y' | 'z':
 *   its rest position, the root's when the rig lacks it), `root` ('x' | 'y' | 'z'), `gait` (component 0 | 1 | 2 = dz | dy | toe
 *   of the stance / swing foot curve, phase, stance share, stroke, lift).
 */
export type PoseExpr = number | string | readonly PoseExpr[];
/** One channel a clip sets: a pose key or a foot slot (`limb * 4 + 0..3` = dx dy dz toe), its value, and (optionally) a
 *  bone the rest must have for it to apply. */
export type PoseSet = readonly [channel: LimbPoseKey | number, value: PoseExpr] | readonly [channel: LimbPoseKey | number, value: PoseExpr, needs: string];
/** One clip: its named values in order, then the channels it sets. Unset channels stay at the rest (0). */
export interface PoseClip { readonly lets?: readonly (readonly [string, PoseExpr])[]; readonly set: readonly PoseSet[] }

const TAU = Math.PI * 2;
const step = (x: number, a: number, b: number): number => smoothstep(0, 1, (x - a) / (b - a));
/** the walk / the charge: a foot's offset along one gait cycle. Stance: planted (moves back at the body's speed); swing:
 *  lifted and carried forward. [dz, dy, toe] */
export function gaitFoot(ph: number, stance: number, stroke: number, lift: number, out: [number, number, number]): [number, number, number] {
  const p = ((ph % 1) + 1) % 1;
  if (p < stance) { out[0] = stroke * (0.5 - p / stance); out[1] = 0; out[2] = 0; return out; }
  const u = (p - stance) / (1 - stance);
  out[0] = stroke * (-0.5 + smoothstep(0, 1, u));
  out[1] = lift * Math.sin(Math.PI * u) ** 1.2;
  out[2] = 0.7 * Math.sin(Math.PI * u) * (1 - u);   // the toe flicks back as it leaves, flat as it lands
  return out;
}
const _g: [number, number, number] = [0, 0, 0];

interface Scope { x: number; t: number; r: LimbPoseRest; lets: Map<string, number> }
const axisOf = (v: PoseExpr | undefined): 'x' | 'y' | 'z' => {
  if (v === 'x' || v === 'y' || v === 'z') return v;
  throw new Error(`limb rig clip: bad axis ${String(v)}`);
};

function name(n: string, s: Scope): number {
  const v = s.lets.get(n);
  if (v !== undefined) return v;
  switch (n) {
    case 'x': return s.x;
    case 't': return s.t;
    case 'H': return s.r.H;
    case 'walkStride': return s.r.walkStride;
    case 'chargeStride': return s.r.chargeStride;
    case 'TAU': return TAU;
    default: throw new Error(`limb rig clip: unknown name ${n}`);
  }
}

function arg(e: readonly PoseExpr[], i: number, s: Scope): number {
  const a = e[i];
  if (a === undefined) throw new Error(`limb rig clip: ${String(e[0])} lacks argument ${i}`);
  return ev(a, s);
}

function ev(e: PoseExpr, s: Scope): number {
  if (typeof e === 'number') return e;
  if (typeof e === 'string') return name(e, s);
  const op = e[0];
  if (typeof op !== 'string') throw new Error('limb rig clip: a call starts with its op');
  switch (op) {
    case '+': { let v = arg(e, 1, s); for (let i = 2; i < e.length; i++) v += arg(e, i, s); return v; }
    case '*': { let v = arg(e, 1, s); for (let i = 2; i < e.length; i++) v *= arg(e, i, s); return v; }
    case '-': return arg(e, 1, s) - arg(e, 2, s);
    case 'neg': return -arg(e, 1, s);
    case 'sin': return Math.sin(arg(e, 1, s));
    case 'cos': return Math.cos(arg(e, 1, s));
    case 'abs': return Math.abs(arg(e, 1, s));
    case 'max': return Math.max(arg(e, 1, s), arg(e, 2, s));
    case 'min': return Math.min(arg(e, 1, s), arg(e, 2, s));
    case 'pow': return arg(e, 1, s) ** arg(e, 2, s);
    case '?': return arg(e, 1, s) !== 0 ? arg(e, 2, s) : arg(e, 3, s);
    case 'step': return step(arg(e, 1, s), arg(e, 2, s), arg(e, 3, s));
    case 'at': { const bone = e[1], at = typeof bone === 'string' ? s.r.at[bone] : undefined; return (at ?? s.r.rootPos)[axisOf(e[2])]; }
    case 'root': return s.r.rootPos[axisOf(e[1])];
    case 'gait': {
      const c = arg(e, 1, s);
      gaitFoot(arg(e, 2, s), arg(e, 3, s), arg(e, 4, s), arg(e, 5, s), _g);
      return _g[c === 0 ? 0 : c === 1 ? 1 : 2];
    }
    default: throw new Error(`limb rig clip: unknown op ${op}`);
  }
}

const _scope: Scope = { x: 0, t: 0, r: { at: {}, rootPos: { x: 0, y: 0, z: 0 }, H: 1, walkStride: 1, chargeStride: 1 }, lets: new Map() };

/** Plays `clip` at `x` (its input: a phase, a progress, seconds) and clock `t` onto `p` (added to what `p` holds: zero it
 *  first for the clip alone). Allocates nothing. */
export function playPoseClip(clip: PoseClip, p: LimbPose, r: LimbPoseRest, x: number, t: number): LimbPose {
  const s = _scope;
  s.x = x; s.t = t; s.r = r;
  s.lets.clear();
  for (const [n, e] of clip.lets ?? []) s.lets.set(n, ev(e, s));
  for (const row of clip.set) {
    const needs = row[2];
    if (needs !== undefined && r.at[needs] === undefined) continue;
    const ch = row[0], v = ev(row[1], s);
    if (typeof ch === 'number') p.feet[ch] = v; else p[ch] = v;
  }
  return p;
}
