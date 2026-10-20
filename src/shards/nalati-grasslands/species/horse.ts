import horsePresentation from '../data/horsePresentation.json' with { type: 'json' };
import { poseRidingEnvelopes } from '@wildshard/game/riding/presentation';
import horseRows from './horse.json' with { type: 'json' };
import { numericCreaturePose } from '@wildshard/game/plugin/channelPrograms';
import ecology from '../data/ecology.generated.json' with { type: 'json' };
import type { AnimalRigContext } from '@wildshard/engine/entities/animalRig';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { SpeciesDef } from '@wildshard/engine/entities/species/registry';
import { NO_FUR } from '@wildshard/engine/entities/species/rigs';

import type * as THREE from 'three';




import { HorseHerd } from '../runtime/groupRegistry';

import { nalatiBody, poseNalatiCreature } from './presentation';
import { wildEnv } from '../creatures/env';

/**
 * Wild steppe horse (Nalati, row B4) — a stocky Kazakh horse, 1.42 m at the withers: bay / chestnut / black / dun / grey
 * mares, 0.6-scale foals, and the black stallion with the long mane. Herd AI: `src/shards/nalati-grasslands/runtime/groupDispatch.ts` (lead mare, boids,
 * flight / stampede, the stallion's guard states). Painterly: smooth lofts, vertex colour, one draw call.
 *
 * ── The horse rig, for riding (B7) and taming (B8) ─────────────────────────────────────────────────────────────────
 * A horse is an ordinary `Animal`. To ride one, take it out of the herd AI (`herd.setRidden(horse)`, Herd.ts) and drive
 * it yourself every frame:
 *
 *   horse.setMotion(yaw, speed, turnRate)   the gait follows the speed (SpeciesDef.gait below):
 *        walk ≤ 1.8 m/s (HORSE_SPEED.walk) · trot 3.0–6.0 (blend in from 3.0, 4.5 typical) · canter 6.5–10 (the gallop
 *        cycle at a lower stride rate, 8.5 typical) · gallop 13. The stride rate follows the ground speed, so hooves
 *        never slide at any speed in between.
 *   horseBones(horse)          → { body, neck1, neck2, head, earL, earR, mane1, mane2, tail, tail2, tail3 } (THREE.Bone)
 *                                 — for the first-person head/neck view and a bridle; read their matrixWorld after update
 *   horse.mem knobs (0..1, eased in postPose; set them, the pose follows):
 *        rear    up on the hind legs, forelegs tucked (the stallion's display, a thrown rider)
 *        buck    the hind end kicks up in a rhythm (taming rounds); mem.buckDir ±1 tilts it left / right
 *        kick    a single double-barrelled hind kick (set to 1, it decays)
 *        stamp   a fore hoof stamps (set to 1, it decays)
 *        toss    head toss / snort
 *        headUp  head high, ears forward — watching
 *        pin     ears pinned back — warning / charging
 * Hit volumes: dims below (body capsule 0.9 m half-length, head sphere 0.2 m) — the bow and sabre need nothing new.
 * Palette keys (VariantDef.tint): coat belly points mane muzzle sock hoof eye earIn dorsal.
 */

export const HORSE_SPEED = ecology.modes.ride[0].gaits;

const nativeClips = new WeakMap<object, ReturnType<typeof numericCreaturePose>>();
/** Data channels draw the overlay; this binding observes wind and advances presentation envelopes. */
export function poseNalatiHorse(c: AnimalRigContext, wind: { readonly x: number; readonly z: number; readonly strength: number }, input?: object): void {
  poseRidingEnvelopes(c, horsePresentation, wind);
  if (input === undefined) { poseNalatiCreature('horse', c); return; }
  let pose = nativeClips.get(input); if (pose === undefined) { pose = numericCreaturePose(input); nativeClips.set(input, pose); } pose(c);
}

// ── rig API for riding (B7) ────────────────────────────────────────────────────────────────────────────────────────

export interface HorseBones {
  body: THREE.Bone; neck1: THREE.Bone; neck2: THREE.Bone; head: THREE.Bone; earL: THREE.Bone; earR: THREE.Bone;
  mane1: THREE.Bone; mane2: THREE.Bone; tail: THREE.Bone; tail2: THREE.Bone; tail3: THREE.Bone;
}

const boneCache = new WeakMap<Animal, HorseBones>();

/** the horse's named bones (cached); throws for a non-horse */
export function horseBones(a: Animal): HorseBones {
  const hit = boneCache.get(a);
  if (hit !== undefined) return hit;
  const get = (n: string): THREE.Bone => {
    const found = a.mesh.skeleton.getBoneByName(n);
    if (found === undefined) throw new Error(`horseBones: '${a.kind}' has no bone '${n}'`);
    return found;
  };
  const out: HorseBones = {
    body: get('body'), neck1: get('neck1'), neck2: get('neck2'), head: get('head'), earL: get('earL'), earR: get('earR'),
    mane1: get('mane1'), mane2: get('mane2'), tail: get('tail'), tail2: get('tail2'), tail3: get('tail3'),
  };
  boneCache.set(a, out);
  return out;
}

export const HORSE_SPECIES: SpeciesDef = {
  ...horseRows.definition, fur: NO_FUR,
  build: variant => nalatiBody('horse', variant),
  postPose: c => { poseNalatiHorse(c, wildEnv.wind); },
  act: (a, c) => { if (a.alive) HorseHerd.of(a)?.drive(a, c, true); },
  think: (a, c) => {
    const last = a.mem['groupThinkAt']; if (last !== undefined && c.t - last < .1 - 1e-9) return;
    a.mem['groupThinkAt'] = c.t; HorseHerd.sense(a);
    if (a.mem['ridden'] === 1 || a.mem['owned'] === 1) return;
    const herd = HorseHerd.of(a); if (herd === null || !a.alive) { a.setMotion(a.yaw, 0, 1); return; }
    const step = { ...c, dt: last === undefined ? c.dt : c.t - last }; herd.tick(step); herd.drive(a, step);
  },
  damageMul: a => HorseHerd.damage(a),
};