import * as THREE from 'three';
import type { RigAnimCtx } from '@wildshard/engine/entities/species/registry';
import { clamp, lookAngles, step } from '@wildshard/engine/entities/species/rigs';
import { addLimbPose, applyLimbPose, limbRest, newLimbPose, playBakedClip, readBakedClips, scaleLimbPose, zeroLimbPose, type BakedPoseClip, type LimbPose, type LimbPoseRest, type LimbRest, type LimbRigSpec } from './limbRigBefore';
import { KING_GAITS as GAITS, KING_RIG as RIG } from '../../../src/shards/pine-hollow/data/kingRig';
import baked from '../../../src/shards/pine-hollow/data/kingClips.generated.json' with { type: 'json' };

/**
 * The Antler King's OWN rig (E322 F-M1; Jake picked B — A, the Bark Warden hull baked onto the elk's bones, walking like
 * an elk ×2.6, went with its Debug row). This rig is his concept's body plan
 * (art/pine-hollow/round-2-antler-king/A-bark-warden.jpg): a raised barrel chest, a shoulder hump, long heavy forelimbs
 * that can rear and strike, shorter hind legs — on a hull generated in that stance
 * (art/pine-hollow/round-25-e322-king-rig/, `public/assets/pine-hollow/creatures/antler-king-rig[.phone].rigged.glb`,
 * skinned by scripts/king-rig-bake.mjs). A custom rig (`SpeciesDef.rig: 'custom'`): Animal.ts hands `animateKing` the
 * shared timers every frame and the poses drive the bones.
 *
 * The skeleton and the solve are the limb rig's (../runtime/species/limbRig.ts, SHARD-PLATFORM M3): the bone names and
 * proportions (and the stand-in skeleton) are ../data/kingRig.ts, and every clip is baked from rows offline (../generators/kingClips.ts →
 * data/kingClips.generated.json, looked up here, never evaluated); this file keeps the King's
 * blend (`advanceKingPose`: walk ↔ charge by ground speed, the fight's named attack held and eased out, the recoil, the look).
 *
 * The fight names its move in `Animal.mem.act` before `startAttack` (ACT_*); a charge is the speed (the lane runs at
 * 13 m/s); a hit is Animal's flinch. `Animal.debugGait` ({ gait: clip name, phase }) holds a clip still (the capture
 * scripts). The gate (scripts/king-rig-gate.mjs) samples these same functions.
 */

const KING_RIG: LimbRigSpec = RIG;
export const KING_LIMBS: readonly (readonly [string, string, string, string])[] = KING_RIG.limbs;

/** what the fight writes in `Animal.mem.act` before `startAttack` (0 / missing: an attack with no name = the strike) */
export const ACT_SWEEP = 1, ACT_STRIKE = 2, ACT_ROAR = 3, ACT_BRACE = 4;

/** every clip a capture or the gate can hold (`Animal.debugGait.gait`) */
export const KING_CLIP_NAMES = ['idle', 'walk', 'charge', 'strike', 'hit', 'sweep', 'roar', 'brace', 'die'] as const;
export type KingClip = typeof KING_CLIP_NAMES[number];
const bakedClip = readBakedClips(baked);
const KING_CLIPS: Readonly<Record<KingClip, BakedPoseClip>> = {
  idle: bakedClip('idle'), walk: bakedClip('walk'), charge: bakedClip('charge'), strike: bakedClip('strike'), hit: bakedClip('hit'),
  sweep: bakedClip('sweep'), roar: bakedClip('roar'), brace: bakedClip('brace'), die: bakedClip('die'),
};

/** one pose: offsets from the rest (the hull's stance); feet per limb FL FR BL BR: dx dy dz toe */
export type KingPose = LimbPose;
export const newPose: () => KingPose = newLimbPose;
/** the rig's rest, readable without bones */
export type KingPoseRest = LimbPoseRest;
/** the rig's rest measured off its bones */
export type KingRest = LimbRest;
/** the rig's rest, read once off its bones */
export const kingRest = (bones: Record<string, THREE.Bone>): KingRest => limbRest(KING_RIG, bones);
/** the gaits' timing (the gate reads the stance windows off it) */
export const KING_GAITS: typeof GAITS = GAITS;

/** one clip, alone, at `x` (a phase for walk / charge, a 0..1 progress for the attacks, seconds for idle) into `p` */
export function clipPose(p: KingPose, clip: KingClip, x: number, t = 0): KingPose {
  zeroLimbPose(p);
  return playBakedClip(KING_CLIPS[clip], p, x, t);
}

/** Pose the skeleton: the spine by FK, each limb by two-bone IK onto its hoof's target (the limb rig's solve). */
export function applyKingPose(r: KingRest, p: KingPose): void { applyLimbPose(KING_RIG, r, p); }

// ─────────────────────────────── the species' animate ───────────────────────────────

const _pose = newPose(), _clip = newPose();

/** per animal, in `Animal.mem`: ph (the stride phase), act (the fight's move), held (s the attack has sat at 1), walkW /
 *  runW (the eased gait weights) */

/** Animal.ts's per-frame call (SpeciesDef.animate) */
export interface KingPoseInput {
  dt: number; t: number; scale: number; speed: number; deathT: number;
  flinch: number; brace: number; attack: number; lookWeight: number; yaw: number;
  lookTarget: Readonly<{ x: number; y: number; z: number }>;
  position: Readonly<{ x: number; y: number; z: number }>;
  mem: Record<string, number>;
}

/** The shipping scalar blend and saved gait/held clocks. It reads no bones, vertices or skinning. */
export function advanceKingPose(c: KingPoseInput, r: KingPoseRest, into: KingPose,
  dbg?: { gait: string; phase: number }): KingPose {
  const m = c.mem;
  const P = zeroLimbPose(into);
  if (dbg !== undefined && (KING_CLIP_NAMES as readonly string[]).includes(dbg.gait)) {
    const clip = dbg.gait as KingClip;
    addLimbPose(P, clipPose(_clip, clip, clip === 'idle' ? c.t : dbg.phase, c.t), 1);
    return P;
  }
  if (c.deathT >= 0) {
    addLimbPose(P, clipPose(_clip, 'die', c.deathT, c.t), 1);
    return P;
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
  if (iw > 0) addLimbPose(P, clipPose(_clip, 'idle', c.t), iw);
  if (ww > 0) addLimbPose(P, clipPose(_clip, 'walk', ph), ww);
  if (rw > 0) addLimbPose(P, clipPose(_clip, 'charge', ph), rw);
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
      scaleLimbPose(P, 1 - k);
      addLimbPose(P, clipPose(_clip, clip, a, c.t), k);
      if (clip === 'sweep') dive = k;
    }
  } else m['held'] = 0;
  // the recoil: a hit (the flinch) and the stagger's brace
  const f = Math.max(c.flinch, c.brace * 0.7);
  if (f > 0.01) addLimbPose(P, clipPose(_clip, 'hit', 1 - f, c.t), 1);
  // the look (the custom rigs' shared lookAngles, from his head's rest height): the neck and head turn to the target, on top of the clip
  if (c.lookWeight > 0.001) {
    const look = lookAngles(c, r.at['head']?.y ?? 2.5, 1.0, 0.4, -0.5);
    // (the sweep owns the head: its dive is measured without the look — the look's pitch would drive the rack into the ground)
    const k = (1 - rw * 0.6) * (1 - dive);
    P.neckYaw += look.yaw * 0.45 * k; P.headYaw += look.yaw * 0.4 * k; P.headPitch -= look.pitch * 0.6 * k;
  }
  return P;
}

/** Visual skinning stays live; collision adapters consume this exact same scalar pose. */
const poseObservers = new WeakMap<RigAnimCtx['animal'], (pose: KingPose) => void>();

/** Observe the already-evaluated custom pose, without advancing its blend memory twice. Explicitly removed with its owner. */
export function observeKingPose(animal: RigAnimCtx['animal'], receive: (pose: KingPose) => void): () => void {
  if (poseObservers.has(animal)) throw new Error('King pose observer already installed');
  poseObservers.set(animal, receive);
  return () => { if (poseObservers.get(animal) === receive) poseObservers.delete(animal); };
}

export function animateKing(c: RigAnimCtx): void {
  const r = kingRest(c.bones);
  const pose = advanceKingPose(c, r, _pose, c.animal.debugGait);
  applyKingPose(r, pose);
  poseObservers.get(c.animal)?.(pose);
}
