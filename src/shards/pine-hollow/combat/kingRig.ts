import * as THREE from 'three';
import type { BoneDef, RigAnimCtx } from '@wildshard/engine/entities/species/registry';
import { smoothstep } from '@wildshard/engine/core/noise';

/**
 * The Antler King's OWN rig (E322 F-M1; Jake picked B — A, the Bark Warden hull baked onto the elk's bones, walking like
 * an elk ×2.6, went with its Debug row). This rig is his concept's body plan
 * (art/pine-hollow/round-2-antler-king/A-bark-warden.jpg): a raised barrel chest, a shoulder hump, long heavy forelimbs
 * that can rear and strike, shorter hind legs — on a hull generated in that stance
 * (art/pine-hollow/round-25-e322-king-rig/, `public/assets/pine-hollow/creatures/antler-king-rig[.phone].rigged.glb`,
 * skinned by scripts/king-rig-bake.mjs). A custom rig (`SpeciesDef.rig: 'custom'`): Animal.ts hands `animateKing` the
 * shared timers every frame and the poses below drive the bones.
 *
 * THE SKELETON (22 bones, the GLB's joints by name and in this order; the rest positions are the hull's, measured by the
 * bake — the positions here only place the stand-in box when the rig has not loaded):
 *   body (mid torso, the root) → hips → tail; body → chest (the hump) → neck → head;
 *   chest → arm{L,R}_sh → _el → _wr → _hoof (the forelimbs); hips → leg{L,R}_hip → _knee → _hock → _hoof.
 *   L is +x (the King's left), as every rig in the game.
 *
 * THE CLIPS, all procedural, all over the same pose record (`KingPose`) so they blend before one IK pass plants the hooves:
 *   idle     breathing, the head's slow weight, every hoof planted
 *   walk     the lateral-sequence walk (hind, fore, hind, fore), feet planted in stance (IK), the hump rolling
 *   charge   the bounding gallop down a lane, head low and the rack leading
 *   strike   the rearing strike: up on the hind legs (pivot at the hips), forelimbs raised, then slammed down — the
 *            stomp's contact is at the attack's end (the fight's root ring goes out at attackPhase 1)
 *   hit      the recoil: the chest thrown back, the head tossed, the hooves stay planted
 *   plus the fight's other moves on the same record: `sweep` (the antler sweep: wound left, swung right), `roar` (the
 *   bells: reared and held, no slam), `brace` (a lane's tell: head down, a forehoof pawing) and `die`.
 *
 * The fight names its move in `Animal.mem.act` before `startAttack` (ACT_*: src/shards/pine-hollow/combat/antlerKing.ts); a charge is
 * the speed (the lane runs at 13 m/s); a hit is Animal's flinch. `Animal.debugGait` ({ gait: clip name, phase }) holds a
 * clip still (the capture scripts). The gate (scripts/king-rig-gate.mjs) samples these same functions.
 */

type Side = 'L' | 'R';
export const KING_LIMBS: readonly (readonly [string, string, string, string])[] = [
  ['armL_sh', 'armL_el', 'armL_wr', 'armL_hoof'], ['armR_sh', 'armR_el', 'armR_wr', 'armR_hoof'],
  ['legL_hip', 'legL_knee', 'legL_hock', 'legL_hoof'], ['legR_hip', 'legR_knee', 'legR_hock', 'legR_hoof'],
];
/** FL FR BL BR, as the limbs above */
const FORE = [true, true, false, false] as const;

/** the stand-in skeleton (the hull's own joints replace these positions when its rig loads) */
export const KING_BONES: readonly BoneDef[] = (() => {
  const b: BoneDef[] = [
    { name: 'body', parent: null, pos: [0, 1.55, -0.1] },
    { name: 'hips', parent: 'body', pos: [0, 1.45, -0.75] },
    { name: 'chest', parent: 'body', pos: [0, 2.0, 0.45] },
    { name: 'neck', parent: 'chest', pos: [0, 2.35, 0.75] },
    { name: 'head', parent: 'neck', pos: [0, 2.6, 0.95] },
    { name: 'tail', parent: 'hips', pos: [0, 1.5, -1.15] },
  ];
  for (const s of ['L', 'R'] as Side[]) {
    const x = s === 'L' ? 1 : -1;
    b.push(
      { name: `arm${s}_sh`, parent: 'chest', pos: [x * 0.45, 1.85, 0.5] },
      { name: `arm${s}_el`, parent: `arm${s}_sh`, pos: [x * 0.55, 1.1, 0.45] },
      { name: `arm${s}_wr`, parent: `arm${s}_el`, pos: [x * 0.6, 0.4, 0.6] },
      { name: `arm${s}_hoof`, parent: `arm${s}_wr`, pos: [x * 0.6, 0.0, 0.65] },
      { name: `leg${s}_hip`, parent: 'hips', pos: [x * 0.35, 1.3, -0.75] },
      { name: `leg${s}_knee`, parent: `leg${s}_hip`, pos: [x * 0.4, 0.8, -0.55] },
      { name: `leg${s}_hock`, parent: `leg${s}_knee`, pos: [x * 0.4, 0.4, -0.85] },
      { name: `leg${s}_hoof`, parent: `leg${s}_hock`, pos: [x * 0.4, 0.0, -0.8] },
    );
  }
  return b;
})();

/** what the fight writes in `Animal.mem.act` before `startAttack` (0 / missing: an attack with no name = the strike) */
export const ACT_SWEEP = 1, ACT_STRIKE = 2, ACT_ROAR = 3, ACT_BRACE = 4;

/** every clip a capture or the gate can hold (`Animal.debugGait.gait`) */
export const KING_CLIP_NAMES = ['idle', 'walk', 'charge', 'strike', 'hit', 'sweep', 'roar', 'brace', 'die'] as const;
export type KingClip = typeof KING_CLIP_NAMES[number];

/** one pose: offsets from the rest (the hull's stance). Angles in radians: pitch + = nose down (three's +x), yaw + = to
 *  his left, roll + = his right side down. Feet: the hoof's model-space offset from its rest spot and its toe pitch */
export interface KingPose {
  rootY: number; rootZ: number; rootPitch: number; rootRoll: number; rootYaw: number;
  hipsPitch: number; chestPitch: number; chestYaw: number; chestRoll: number;
  neckPitch: number; neckYaw: number; headPitch: number; headYaw: number; headRoll: number;
  tailPitch: number; tailYaw: number;
  /** per limb FL FR BL BR: dx dy dz toe */
  feet: Float32Array;
}
const POSE_KEYS = ['rootY', 'rootZ', 'rootPitch', 'rootRoll', 'rootYaw', 'hipsPitch', 'chestPitch', 'chestYaw', 'chestRoll', 'neckPitch', 'neckYaw', 'headPitch', 'headYaw', 'headRoll', 'tailPitch', 'tailYaw'] as const;
export function newPose(): KingPose {
  return { rootY: 0, rootZ: 0, rootPitch: 0, rootRoll: 0, rootYaw: 0, hipsPitch: 0, chestPitch: 0, chestYaw: 0, chestRoll: 0, neckPitch: 0, neckYaw: 0, headPitch: 0, headYaw: 0, headRoll: 0, tailPitch: 0, tailYaw: 0, feet: new Float32Array(16) };
}
function zero(p: KingPose): KingPose { for (const k of POSE_KEYS) p[k] = 0; p.feet.fill(0); return p; }
function addScaled(into: KingPose, p: KingPose, w: number): void {
  if (w === 0) return;
  for (const k of POSE_KEYS) into[k] += p[k] * w;
  for (let i = 0; i < 16; i++) into.feet[i] = (into.feet[i] ?? 0) + (p.feet[i] ?? 0) * w;
}
const setFoot = (p: KingPose, leg: number, dx: number, dy: number, dz: number, toe: number): void => { p.feet[leg * 4] = dx; p.feet[leg * 4 + 1] = dy; p.feet[leg * 4 + 2] = dz; p.feet[leg * 4 + 3] = toe; };

const clamp = THREE.MathUtils.clamp;
const step = (x: number, a: number, b: number): number => smoothstep(0, 1, (x - a) / (b - a));
const TAU = Math.PI * 2;

// ─────────────────────────────── the rest measure ───────────────────────────────

/** the rig's rest, read once off its bones (their local positions are the rest offsets; rest rotations are identity) */
export interface KingRest {
  bones: Record<string, THREE.Bone>;
  names: string[];
  /** model-space rest position per bone name */
  at: Record<string, THREE.Vector3>;
  rootPos: THREE.Vector3;
  /** the shoulder height (the body's size unit) and the stride lengths it gives, model units */
  H: number; walkStride: number; chargeStride: number;
  /** each limb's rest bend plane (unit normal, model space) and the side of it its middle joint sits on (±1): the IK
   *  bends every limb in its own rest plane, so the rest pose solves to itself and a knee never flips */
  plane: THREE.Vector3[]; bend: number[];
}
const rests = new WeakMap<THREE.Bone, KingRest>();
const isBone = (o: THREE.Object3D | null): o is THREE.Bone => o !== null && (o as Partial<THREE.Bone>).isBone === true;

export function kingRest(bones: Record<string, THREE.Bone>): KingRest {
  const body = bones['body'];
  if (!body) throw new Error('antler-king rig: no body bone');
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
  const H = Math.max(0.5, (P('armL_sh').y + P('armR_sh').y) / 2);
  const plane: THREE.Vector3[] = [], bend: number[] = [];
  for (const [a, b, c] of KING_LIMBS) {
    const A = P(a), B = P(b), C = P(c);
    const n = new THREE.Vector3().crossVectors(new THREE.Vector3().subVectors(B, A), new THREE.Vector3().subVectors(C, B));
    // a near-straight limb has no plane of its own: the side axis, bent forward (+z) like a knee
    if (n.length() < 1e-4 * A.distanceTo(C) ** 2) n.set(1, 0, 0); else n.normalize();
    const u = new THREE.Vector3().subVectors(C, A).normalize();
    const off = new THREE.Vector3().subVectors(B, A).addScaledVector(u, -new THREE.Vector3().subVectors(B, A).dot(u));
    const w = new THREE.Vector3().crossVectors(n, u);
    plane.push(n); bend.push(off.lengthSq() < 1e-10 ? -1 : Math.sign(off.dot(w)) || 1);
  }
  const r: KingRest = { bones, names, at, rootPos: body.position.clone(), H, walkStride: 0.6 * H, chargeStride: 1.2 * H, plane, bend };
  rests.set(body, r);
  return r;
}

// ─────────────────────────────── the clips ───────────────────────────────

/** the walk / the charge: foot `leg`'s offset along one gait cycle. Stance: planted (moves back at the body's speed);
 *  swing: lifted and carried forward. Returns [dz, dy, toe] */
function gaitFoot(ph: number, stance: number, stroke: number, lift: number, out: [number, number, number]): [number, number, number] {
  const p = ((ph % 1) + 1) % 1;
  if (p < stance) { out[0] = stroke * (0.5 - p / stance); out[1] = 0; out[2] = 0; return out; }
  const u = (p - stance) / (1 - stance);
  out[0] = stroke * (-0.5 + smoothstep(0, 1, u));
  out[1] = lift * Math.sin(Math.PI * u) ** 1.2;
  out[2] = 0.7 * Math.sin(Math.PI * u) * (1 - u);   // the toe flicks back as it leaves, flat as it lands
  return out;
}
const _g: [number, number, number] = [0, 0, 0];

function clipIdle(p: KingPose, r: KingRest, t: number): void {
  const H = r.H, br = Math.sin(t * TAU * 0.22);
  p.rootY = 0.006 * H * br;
  p.chestPitch = -0.02 * br;
  p.neckPitch = 0.03 * Math.sin(t * TAU * 0.11 + 1);
  p.headPitch = 0.04 * Math.sin(t * TAU * 0.13);
  p.headYaw = 0.08 * Math.sin(t * TAU * 0.07);
  p.headRoll = 0.03 * Math.sin(t * TAU * 0.09 + 2);
  p.tailYaw = 0.12 * Math.sin(t * TAU * 0.3);
}

/** walk cycle: FL FR BL BR phase offsets and stance share (a lateral-sequence walk: BL, FL, BR, FR) */
const WALK_OFF = [0.25, 0.75, 0.0, 0.5], WALK_STANCE = 0.64;
/** where each limb's stroke is centred, as a share of the stroke from its rest hoof (+ = forward): his forehooves stand
 *  ahead of the shoulders and his hind hooves behind the hips, so the strokes swing under him */
const STROKE_AT = [-0.25, -0.25, 0.3, 0.3];
function clipWalk(p: KingPose, r: KingRest, ph: number): void {
  const H = r.H, stroke = r.walkStride * WALK_STANCE;
  for (let l = 0; l < 4; l++) {
    gaitFoot(ph + (WALK_OFF[l] ?? 0), WALK_STANCE, stroke, (FORE[l] ? 0.14 : 0.09) * H, _g);
    setFoot(p, l, 0, _g[1], _g[0] + (STROKE_AT[l] ?? 0) * stroke, _g[2]);
  }
  const c2 = Math.cos(ph * TAU * 2);
  p.rootY = -0.025 * H + 0.01 * H * c2;
  p.rootRoll = 0.035 * Math.sin(ph * TAU);
  p.chestRoll = -0.05 * Math.sin(ph * TAU + 0.8);
  p.chestYaw = 0.05 * Math.sin(ph * TAU + 0.4);
  p.chestPitch = 0.02 * c2;
  p.neckPitch = 0.06 - 0.03 * c2;
  p.headPitch = 0.03 * Math.sin(ph * TAU * 2 + 1);
  p.headYaw = -0.04 * Math.sin(ph * TAU + 0.4);
  p.tailYaw = 0.15 * Math.sin(ph * TAU);
}

/** charge: a bounding rotary gallop (the lane runs at 13 m/s) */
const RUN_OFF = [0.55, 0.66, 0.0, 0.1], RUN_STANCE = 0.34;
/** the gaits' timing (the gate reads the stance windows off it) */
export const KING_GAITS = { walk: { off: WALK_OFF, stance: WALK_STANCE }, charge: { off: RUN_OFF, stance: RUN_STANCE } } as const;
function clipCharge(p: KingPose, r: KingRest, ph: number): void {
  const H = r.H, stroke = r.chargeStride * RUN_STANCE;
  for (let l = 0; l < 4; l++) {
    gaitFoot(ph + (RUN_OFF[l] ?? 0), RUN_STANCE, stroke, (FORE[l] ? 0.14 : 0.1) * H, _g);
    setFoot(p, l, 0, _g[1], _g[0] + (STROKE_AT[l] ?? 0) * stroke, _g[2]);
  }
  const s = Math.sin(ph * TAU), c = Math.cos(ph * TAU);
  p.rootY = -0.06 * H + 0.03 * H * Math.max(0, s);
  p.rootPitch = 0.1 * c + 0.05;
  p.chestPitch = 0.12;          // the hump comes down and forward
  p.neckPitch = 0.2 - 0.05 * c;
  p.headPitch = 0.3;            // the rack lowered, leading
  p.headRoll = 0.04 * s;
  p.tailPitch = -0.35;
}

/** the rearing strike, a 0..1: rise → up (the roar at the top) → the slam, contact at 1 */
function clipStrike(p: KingPose, r: KingRest, a: number, slam: boolean): void {
  const H = r.H;
  const rise = step(a, 0.0, 0.5);
  const down = slam ? step(a, 0.78, 0.97) : step(a, 0.8, 1.0);
  const up = rise * (1 - down);
  const hip = r.at['hips'] ?? r.rootPos, root = r.rootPos;
  // rear about the hips: the body pitches up and the root swings round the hip joint (the hind hooves stay put)
  const th = -0.72 * up;
  const dz = root.z - hip.z, dy = root.y - hip.y;
  p.rootPitch = th;
  p.rootZ = dz * Math.cos(th) + dy * Math.sin(th) - dz;
  p.rootY = -dz * Math.sin(th) + dy * Math.cos(th) - dy - 0.06 * H * rise * (1 - down * 0.5);
  p.hipsPitch = 0.3 * up;       // the pelvis stays under him, the hind legs load
  p.chestPitch = -0.1 * up;
  p.neckPitch = -0.1 * up;
  p.headPitch = -0.18 * up * step(a, 0.35, 0.6) + (slam ? 0.22 * down : 0);
  p.headRoll = 0.04 * Math.sin(a * 40) * up * step(a, 0.45, 0.7);
  p.tailPitch = 0.3 * up;
  // the forelimbs: carried round with the body, folded up and forward; at the slam driven down ahead of the rest spot
  const c = Math.cos(th), s = Math.sin(th);
  for (let l = 0; l < 2; l++) {
    const name = KING_LIMBS[l]?.[3] ?? '';
    const f = r.at[name];
    if (!f) continue;
    const fz = f.z - hip.z, fy = f.y - hip.y;
    const rz = hip.z + fz * c + fy * s, ry = hip.y - fz * s + fy * c;   // rotated with the body
    const fold = up * (1 - down);
    const reach = slam ? 0.16 * H * down : 0;
    const tz = (rz - f.z) + 0.14 * H * fold + reach * (1 - up), ty = (ry - f.y) + 0.06 * H * fold;
    setFoot(p, l, 0, Math.max(0, ty), tz, -0.9 * fold);
  }
}

/** the antler sweep, a 0..1: wound up to his left with the head driven down, swung hard to his right by 1 (the hit lands
 *  at the end). E350 F-X2: the old sweep turned the head at standing height, the rack 6 m up, over a player's head; now the
 *  body tips forward and drops, the chest, neck and head dive, so the rack scythes through a standing player's height: its
 *  low tines 0.8–1.7 m off the ground from the wind-up's end to the blow, touching a standing player out to 7.1 m from 45°
 *  right to 15° left of his heading (scripts/e350-king-measure.mjs --sweepmap; the fight's SWEEP_* numbers; the look is
 *  held off while he dives). The pitch is split so the rig gate's edge stretch stays
 *  ≤ 1.99 on both hulls (the neck's share stretches the chest under the beard, the head's the rack's base) */
function clipSweep(p: KingPose, r: KingRest, a: number): void {
  const H = r.H;
  const wind = step(a, 0, 0.55), swing = step(a, 0.62, 0.95);
  const yaw = 0.42 * wind - 0.95 * swing;
  p.chestYaw = yaw * 0.45; p.neckYaw = yaw * 0.4; p.headYaw = yaw * 0.2;
  p.rootPitch = 0.35 * wind; p.chestPitch = 0.3 * wind;
  p.neckPitch = 0.4 * wind; p.headPitch = 0.8 * wind;
  p.headRoll = -yaw * 0.05;
  p.chestRoll = -0.06 * wind + 0.1 * swing;
  p.rootY = -0.3 * H * wind;
  p.rootYaw = yaw * 0.12;
}

/** a lane's tell: head down, the rack forward, a forehoof pawing back twice */
function clipBrace(p: KingPose, r: KingRest, a: number, t: number): void {
  const H = r.H, k = step(a, 0, 0.3);
  p.rootY = -0.05 * H * k; p.rootPitch = 0.06 * k;
  p.chestPitch = 0.1 * k; p.neckPitch = 0.2 * k; p.headPitch = 0.45 * k;
  const paw = Math.max(0, Math.sin(t * TAU * 1.6)) * k * (1 - step(a, 0.85, 1));
  setFoot(p, 0, 0, 0.14 * H * paw, 0.1 * H * Math.cos(t * TAU * 1.6) * k, 0.5 * paw);
}

/** the recoil (flinch 1 at the blow, decaying): the chest thrown back, the head tossed */
function clipHit(p: KingPose, r: KingRest, f: number, t: number): void {
  const H = r.H;
  p.rootPitch = -0.1 * f; p.rootY = 0.02 * H * f;
  p.chestPitch = -0.16 * f;
  p.neckPitch = -0.14 * f; p.headPitch = -0.3 * f;
  p.headRoll = 0.12 * f * Math.sin(t * 17);
  p.tailPitch = 0.2 * f;
}

/** the collapse, d 0..1: the hind legs give, then the forequarters sink, the head goes down (the physics tips the body
 *  over, src/engine/physics/ragdoll.ts 'rigid'; the limbs only fold under him) */
function clipDie(p: KingPose, r: KingRest, d: number): void {
  const H = r.H, hind = step(d, 0, 0.6), fore = step(d, 0.25, 0.9);
  p.rootY = -0.22 * H * (0.55 * hind + 0.45 * fore);
  p.rootPitch = -0.08 * hind + 0.14 * fore;
  p.chestPitch = 0.08 * fore; p.neckPitch = 0.2 * fore; p.headPitch = 0.3 * fore;
  p.tailPitch = 0.25 * hind;
  for (let l = 0; l < 4; l++) {
    const k = l < 2 ? fore : hind;
    setFoot(p, l, 0, 0, (l < 2 ? -0.08 : 0.1) * H * k, 0.35 * k);
  }
}

/** one clip, alone, at `x` (a phase for walk / charge, a 0..1 progress for the attacks, seconds for idle) into `p` */
export function clipPose(p: KingPose, r: KingRest, clip: KingClip, x: number, t = 0): KingPose {
  zero(p);
  switch (clip) {
    case 'idle': clipIdle(p, r, x); break;
    case 'walk': clipWalk(p, r, x); break;
    case 'charge': clipCharge(p, r, x); break;
    case 'strike': clipStrike(p, r, x, true); break;
    case 'roar': clipStrike(p, r, Math.min(x, 1), false); break;
    case 'sweep': clipSweep(p, r, x); break;
    case 'brace': clipBrace(p, r, x, t); break;
    case 'hit': clipHit(p, r, 1 - x, t); break;
    case 'die': clipDie(p, r, x); break;
    default: break;
  }
  return p;
}

// ─────────────────────────────── the solve: FK + two-bone IK ───────────────────────────────

const _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _wq: Record<string, THREE.Quaternion> = {};
const _wp: Record<string, THREE.Vector3> = {};
const wq = (n: string): THREE.Quaternion => (_wq[n] ??= new THREE.Quaternion());
const wp = (n: string): THREE.Vector3 => (_wp[n] ??= new THREE.Vector3());
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _t = new THREE.Vector3(), _u = new THREE.Vector3(), _n = new THREE.Vector3(), _w = new THREE.Vector3(), _x = new THREE.Vector3();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _qi = new THREE.Quaternion(), _m = new THREE.Matrix4(), _m0 = new THREE.Matrix4();

/** set bone `n`'s local rotation from euler angles and record its model-space transform (the parent's first) */
function fk(r: KingRest, n: string, x: number, y: number, z: number): void {
  const b = r.bones[n];
  if (!b) return;
  _e.set(x, y, z, 'YXZ');
  b.quaternion.setFromEuler(_e);
  record(r, n);
}
function record(r: KingRest, n: string): void {
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
 * Pose the skeleton: the spine by FK, each limb by two-bone IK onto its hoof's target (rest spot + the pose's offset,
 * model space): the upper and middle bones solve, the cannon keeps the ground's orientation (turned by the toe pitch).
 * The bend plane is the parent's side axis, and each limb bends the way its rest bends, so a knee never flips.
 */
export function applyKingPose(r: KingRest, p: KingPose): void {
  const body = r.bones['body'];
  if (!body) return;
  body.position.set(r.rootPos.x, r.rootPos.y + p.rootY, r.rootPos.z + p.rootZ);
  fk(r, 'body', p.rootPitch, p.rootYaw, p.rootRoll);
  fk(r, 'hips', p.hipsPitch - p.rootPitch * 0.35, 0, -p.rootRoll * 0.5);
  fk(r, 'tail', p.tailPitch, p.tailYaw, 0);
  fk(r, 'chest', p.chestPitch, p.chestYaw, p.chestRoll);
  fk(r, 'neck', p.neckPitch, p.neckYaw, 0);
  fk(r, 'head', p.headPitch, p.headYaw, p.headRoll);
  for (let l = 0; l < 4; l++) {
    const chain = KING_LIMBS[l];
    if (!chain) continue;
    const [na, nb, nc, nd] = chain;
    const A = r.at[na], B = r.at[nb], C = r.at[nc], D = r.at[nd];
    const ba = r.bones[na], bb = r.bones[nb], bc = r.bones[nc], bd = r.bones[nd];
    if (!A || !B || !C || !D || !ba || !bb || !bc || !bd) continue;
    const par = isBone(ba.parent) ? ba.parent.name : 'body';
    // the upper joint where the spine left it
    _a.copy(ba.position).applyQuaternion(wq(par)).add(wp(par));
    // the target: the hoof's rest + offset; the cannon (C → D) turned by the toe pitch about the side axis
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
    // the cannon: the ground's orientation turned by the toe
    bc.quaternion.copy(_qi.copy(_q).invert()).multiply(_q1);
    record(r, nc);
    bd.quaternion.identity();
    record(r, nd);
  }
}

// ─────────────────────────────── the species' animate ───────────────────────────────

const _pose = newPose(), _clip = newPose();
const _look = new THREE.Vector3();

/** per animal, in `Animal.mem`: ph (the stride phase), act (the fight's move), held (s the attack has sat at 1), walkW /
 *  runW (the eased gait weights) */

/** Animal.ts's per-frame call (SpeciesDef.animate) */
export function animateKing(c: RigAnimCtx): void {
  const r = kingRest(c.bones);
  const m = c.mem;
  const P = zero(_pose);
  const dbg = c.animal.debugGait;
  if (dbg !== undefined && (KING_CLIP_NAMES as readonly string[]).includes(dbg.gait)) {
    const clip = dbg.gait as KingClip;
    addScaled(P, clipPose(_clip, r, clip, clip === 'idle' ? c.t : dbg.phase, c.t), 1);
    applyKingPose(r, P);
    return;
  }
  if (c.deathT >= 0) {
    addScaled(P, clipPose(_clip, r, 'die', c.deathT, c.t), 1);
    applyKingPose(r, P);
    return;
  }
  // locomotion: walk ↔ charge by ground speed (model units: ÷ the mesh scale), the phase advanced by the stride
  const v = Math.abs(c.speed) / Math.max(1e-3, c.scale);
  const runK = step(v, 1.6, 3.4), walkK = step(v, 0.05, 0.5) * (1 - runK);
  const ww0 = m['walkW'] ?? 0, rw0 = m['runW'] ?? 0;
  const ww = ww0 + (walkK - ww0) * Math.min(1, c.dt * 6), rw = rw0 + (runK - rw0) * Math.min(1, c.dt * 5), iw = Math.max(0, 1 - ww - rw);
  m['walkW'] = ww; m['runW'] = rw;
  const stride = THREE.MathUtils.lerp(r.walkStride, r.chargeStride, clamp(rw / Math.max(1e-3, ww + rw), 0, 1));
  const ph = ((m['ph'] ?? 0) + (v / stride) * c.dt) % 1;
  m['ph'] = ph;
  if (iw > 0) addScaled(P, clipPose(_clip, r, 'idle', c.t), iw);
  if (ww > 0) addScaled(P, clipPose(_clip, r, 'walk', ph), ww);
  if (rw > 0) addScaled(P, clipPose(_clip, r, 'charge', ph), rw);
  // the attack the fight named (held at 1 until the next: eased back out over 0.6 s)
  let dive = 0;
  if (c.attack >= 0) {
    const a = c.attack, act = m['act'] ?? ACT_STRIKE;
    const held = a >= 1 ? (m['held'] ?? 0) + c.dt : 0;
    m['held'] = held;
    const w = 1 - step(held, 0.15, 0.75);
    if (w > 0) {
      const clip: KingClip = act === ACT_SWEEP ? 'sweep' : act === ACT_ROAR ? 'roar' : act === ACT_BRACE ? 'brace' : 'strike';
      // the attack owns the body: the gait's feet fade under it
      const k = w * (clip === 'brace' ? 0.7 : 1);
      zero(_clip);
      const keep = 1 - k;
      for (const key of POSE_KEYS) P[key] *= keep;
      for (let i = 0; i < 16; i++) P.feet[i] = (P.feet[i] ?? 0) * keep;
      addScaled(P, clipPose(_clip, r, clip, a, c.t), k);
      if (clip === 'sweep') dive = k;
    }
  } else m['held'] = 0;
  // the recoil: a hit (the flinch) and the stagger's brace
  const f = Math.max(c.flinch, c.brace * 0.7);
  if (f > 0.01) addScaled(P, clipPose(_clip, r, 'hit', 1 - f, c.t), 1);
  // the look: the neck and head turn to the target, on top of the clip
  if (c.lookWeight > 0.001) {
    const head = r.at['head'];
    _look.subVectors(c.lookTarget, c.position);
    let yaw = Math.atan2(_look.x, _look.z) - c.yaw;
    yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
    const dist = Math.hypot(_look.x, _look.z);
    const pitch = clamp(Math.atan2(_look.y + 1.4 - (head?.y ?? 2.5) * c.scale, dist), -0.5, 0.4);
    // (the sweep owns the head: its dive is measured without the look — the look's pitch would drive the rack into the ground)
    const k = c.lookWeight * (1 - rw * 0.6) * (1 - dive);
    P.neckYaw += clamp(yaw, -1.0, 1.0) * 0.45 * k; P.headYaw += clamp(yaw, -1.0, 1.0) * 0.4 * k;
    P.headPitch -= pitch * 0.6 * k;
  }
  applyKingPose(r, P);
}
