import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { RGB } from '@wildshard/engine/entities/species/loft';
import type { SpeciesDef, AnimalSpecies, VariantDef, RigAnimCtx } from '@wildshard/engine/entities/species/registry';
import { NO_FUR, smooth01, bump, clamp } from '@wildshard/engine/entities/species/rigs';
import { engineString } from '@wildshard/engine/strings';

import * as THREE from 'three';




import { thinkHorse, actHorse, horseDamageMul } from '../runtime/groupDispatch';

import { nalatiBody } from './bodies';
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
 *   horseSaddle(horse, out)    → the rider's seat (world): on the spine behind the withers, riding the gait's bob
 *   horseEye(horse, out)       → a point between the ears (world) — a camera anchor for a mounted look
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

export const HORSE_SPEED = { walk: 1.8, trot: 4.5, canter: 8.5, gallop: 13 } as const;

export const HORSE = {   // exported: glbCreatures.ts recolours the rigged hull per variant from it
  coat: [0.50, 0.27, 0.14], belly: [0.60, 0.38, 0.22], points: [0.07, 0.055, 0.05], mane: [0.07, 0.055, 0.05],
  muzzle: [0.22, 0.15, 0.12], sock: [0.92, 0.90, 0.85], hoof: [0.20, 0.17, 0.15], eye: [0.04, 0.03, 0.025],
  earIn: [0.30, 0.20, 0.16], dorsal: [0.07, 0.055, 0.05],
} satisfies Record<string, RGB>;

const CHESTNUT: Record<string, RGB> = { coat: [0.62, 0.32, 0.14], belly: [0.70, 0.42, 0.22], points: [0.58, 0.30, 0.13], mane: [0.78, 0.52, 0.28], muzzle: [0.40, 0.24, 0.15], dorsal: [0.62, 0.32, 0.14] };
const BLACK: Record<string, RGB> = { coat: [0.16, 0.15, 0.155], belly: [0.18, 0.165, 0.16], points: [0.07, 0.065, 0.068], mane: [0.05, 0.045, 0.05], muzzle: [0.14, 0.12, 0.12], earIn: [0.10, 0.08, 0.08], dorsal: [0.13, 0.12, 0.125] };
const DUN: Record<string, RGB> = { coat: [0.76, 0.62, 0.42], belly: [0.84, 0.74, 0.56], points: [0.10, 0.08, 0.07], mane: [0.10, 0.08, 0.07], muzzle: [0.30, 0.24, 0.20], dorsal: [0.24, 0.17, 0.12] };
const GREY: Record<string, RGB> = { coat: [0.80, 0.80, 0.78], belly: [0.88, 0.88, 0.86], points: [0.36, 0.35, 0.35], mane: [0.55, 0.54, 0.53], muzzle: [0.24, 0.22, 0.22], earIn: [0.45, 0.40, 0.40], dorsal: [0.80, 0.80, 0.78] };
const FOAL_BAY: Record<string, RGB> = { coat: [0.66, 0.45, 0.30], belly: [0.76, 0.60, 0.44], points: [0.72, 0.58, 0.44], mane: [0.30, 0.22, 0.16], muzzle: [0.42, 0.33, 0.28], dorsal: [0.66, 0.45, 0.30] };
const FOAL_CHESTNUT: Record<string, RGB> = { coat: [0.74, 0.46, 0.26], belly: [0.84, 0.64, 0.46], points: [0.80, 0.60, 0.42], mane: [0.84, 0.62, 0.40], muzzle: [0.50, 0.36, 0.28], dorsal: [0.74, 0.46, 0.26] };

/** the horse's body: its variant's baked lofts (`generators/horseBody.ts` -> `species/bodies.ts`) */
const buildHorse = (v: VariantDef): AnimalSpecies => nalatiBody('horse', v);

// ── the horse's own motion (SpeciesDef.postPose) ───────────────────────────────────────────────────────────────────

const decayKnob = (m: Record<string, number>, k: string, dt: number, rate: number): number => {
  const v = m[k] ?? 0;
  if (v > 0) m[k] = Math.max(0, v - dt * rate);
  return v;
};

function horsePostPose(c: RigAnimCtx): void {
  const b = c.bones, m = c.mem;
  const body = b['body'], n1 = b['neck1'], n2 = b['neck2'], head = b['head'], m1 = b['mane1'], m2 = b['mane2'];
  const t1 = b['tail'], t2 = b['tail2'], t3 = b['tail3'];
  if (body === undefined || n1 === undefined || n2 === undefined || head === undefined || m1 === undefined || m2 === undefined || t1 === undefined || t2 === undefined || t3 === undefined) return;
  const dt = c.dt;
  // eased knobs
  const ez = (k: string, target: number, rate: number): number => { const cur = m[`_${k}`] ?? 0; const v = cur + (target - cur) * Math.min(1, dt * rate); m[`_${k}`] = v; return v; };
  const alive = c.alive;
  const rear = smooth01(ez('rear', alive ? clamp(m['rear'] ?? 0, 0, 1) : 0, 3.5));
  const buck = ez('buck', alive ? clamp(m['buck'] ?? 0, 0, 1) : 0, 5);
  const kick = alive ? bump(1 - clamp(decayKnob(m, 'kick', dt, 1.8), 0, 1), 0, 1) * ((m['kick'] ?? 0) > 0 ? 1 : 0) : 0;
  const stamp = alive ? bump(1 - clamp(decayKnob(m, 'stamp', dt, 2.5), 0, 1), 0, 1) * ((m['stamp'] ?? 0) > 0 ? 1 : 0) : 0;
  const toss = alive ? bump(1 - clamp(decayKnob(m, 'toss', dt, 2), 0, 1), 0, 1) * ((m['toss'] ?? 0) > 0 ? 1 : 0) : 0;
  const headUp = ez('headUp', alive ? clamp(m['headUp'] ?? 0, 0, 1) : 0, 3);
  const pin = ez('pin', alive ? clamp(m['pin'] ?? 0, 0, 1) : 0, 6);
  const speed = c.speed;
  const run = clamp((speed - 3) / 9, 0, 1);
  // Animal.ts rewrites the body bone's y every frame but never its z: keep the bind z and set z absolutely
  const bz = (m['_bz'] ??= body.position.z);
  body.position.z = bz;

  // rearing: pivot on the hind feet (raise the body bone so the hips stay put), forelegs fold, neck up
  if (rear > 0.001) {
    const th = rear * 0.78;
    body.rotation.x -= th;
    body.position.y += 0.6 * Math.sin(th);
    body.position.z = bz - 0.31 * (1 - Math.cos(th));
    n1.rotation.x -= 0.35 * rear; head.rotation.x += 0.25 * rear;
    for (const s of ['L', 'R'] as const) {
      const sh = b[`F${s}_shoulder`], ca = b[`F${s}_carpus`], fe = b[`F${s}_fetlock`], hp = b[`B${s}_hip`], stf = b[`B${s}_stifle`];
      const paw = s === 'L' ? Math.sin(c.t * 7) : Math.sin(c.t * 7 + 2);   // the forelegs paw the air
      if (sh !== undefined) sh.rotation.x -= (0.5 + 0.25 * paw) * rear;
      if (ca !== undefined) ca.rotation.x += 1.5 * rear;
      if (fe !== undefined) fe.rotation.x += 0.4 * rear;
      if (hp !== undefined) hp.rotation.x += th * 0.85;
      if (stf !== undefined) stf.rotation.x += 0.25 * rear;
    }
  }
  // bucking: the hind end thrown up, head down, a side twist
  if (buck > 0.001) {
    const ph = Math.sin(c.t * 6.5);
    const up = Math.max(0, ph) * buck;
    body.rotation.x += 0.4 * up - 0.1 * Math.max(0, -ph) * buck;
    body.rotation.z += 0.15 * (m['buckDir'] ?? 1) * up;
    body.position.y += 0.12 * Math.abs(ph) * buck;
    n1.rotation.x += 0.45 * up;
    for (const s of ['L', 'R'] as const) { const hp = b[`B${s}_hip`], stf = b[`B${s}_stifle`]; if (hp !== undefined) hp.rotation.x += 0.9 * up; if (stf !== undefined) stf.rotation.x -= 0.5 * up; }
  }
  // the hind kick: weight forward, both hind legs lash back
  if (kick > 0.001) {
    body.rotation.x += 0.3 * kick;
    n1.rotation.x += 0.4 * kick;
    for (const s of ['L', 'R'] as const) { const hp = b[`B${s}_hip`], hk = b[`B${s}_hock`]; if (hp !== undefined) hp.rotation.x += 1.2 * kick; if (hk !== undefined) hk.rotation.x -= 0.5 * kick; }
  }
  if (stamp > 0.001) { const sh = b['FR_shoulder'], ca = b['FR_carpus']; if (sh !== undefined) sh.rotation.x -= 0.5 * stamp; if (ca !== undefined) ca.rotation.x += stamp; }
  // grazing: the generic graze (pose.grazeNeck 0) only nods the head; a horse drops the whole neck from the withers and
  // tucks the head back toward vertical so the muzzle reaches the grass (solved offline for this rig: neck1 1.7, neck2 0.1,
  // head −1.2 in total)
  const graze = ez('graze', alive && c.state === 'graze' && c.speed < 0.3 ? 1 : 0, 2.2);
  if (graze > 0.001) { n1.rotation.x += 1.35 * graze; n2.rotation.x -= 0.1 * graze; head.rotation.x -= 1.55 * graze; }
  // ridden (Mount.ts `turnLead` −1..1, + = left): the neck bends into the rein before the body turns — eased here (~0.3 s),
  // so a turn reads as the head leading and the body following, never a snap; the head sits a little over the neck's bend
  const lead = ez('turnLead', alive ? clamp(m['turnLead'] ?? 0, -1, 1) : 0, 3.2);
  if (Math.abs(lead) > 0.001) { n1.rotation.y += 0.2 * lead; n2.rotation.y += 0.2 * lead; head.rotation.y += 0.16 * lead; head.rotation.z -= 0.06 * lead; }
  // head high + ears forward (watching); ears pinned (warning); a toss
  n1.rotation.x -= 0.28 * headUp + 0.35 * toss;
  n2.rotation.x -= 0.1 * headUp;
  head.rotation.x += 0.15 * headUp + 0.3 * toss;
  const eL = b['earL'], eR = b['earR'];
  if (eL !== undefined) eL.rotation.x += 1.2 * pin - 0.3 * headUp;
  if (eR !== undefined) eR.rotation.x += 1.2 * pin - 0.3 * headUp;
  // mane: falls to one side, swings with the stride, streams back at speed
  // (the locks fall to the right in the model; the bones lift them back and out at speed and swing them with the stride)
  // the steppe wind lifts the mane and the tail even standing (wildEnv.wind: the gusts' strength, which side it comes from)
  const w = wildEnv.wind, ws = w.strength * (1 - run);
  const across = w.x * Math.cos(c.yaw) - w.z * Math.sin(c.yaw);   // + = the wind blows toward the horse's left
  const gust = 0.6 + 0.4 * Math.sin(c.t * 0.9 + c.seed * 5) + 0.25 * Math.sin(c.t * 3.7 + c.seed);
  const swing = Math.sin(c.phase * Math.PI * 2 - 1.2) * (0.1 + 0.22 * run) + 0.05 * Math.sin(c.t * 1.7 + c.seed * 3) + 0.03 * Math.sin(c.t * 4.1 + c.seed)
    + ws * gust * (0.25 * across + 0.06 * Math.sin(c.t * 5.3 + c.seed * 2));
  m1.rotation.set(-0.35 * run - 0.1 * rear, 0, 0.25 * run + swing * 0.7);
  m2.rotation.set(-0.45 * run - 0.1 * rear, 0, 0.3 * run + swing);
  // tail: the dock lifts when running (Animal.ts' gallopTail), the hair lags and streams
  const lag = Math.sin(c.phase * Math.PI * 2 - 2.0);
  t2.rotation.set(-0.2 * run + 0.06 * lag * run + 0.3 * buck - 0.12 * ws * gust, 0, 0.1 * Math.sin(c.t * 1.1 + c.seed * 4) * (1 - run) + 0.08 * lag * run + 0.3 * ws * gust * across);
  t3.rotation.set(-0.35 * run + 0.08 * lag * run - 0.15 * ws * gust, 0, 0.14 * Math.sin(c.t * 1.1 - 0.8 + c.seed * 4) * (1 - run) + 0.1 * lag * run + 0.35 * ws * gust * across);
  void t1;
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

const SADDLE_LOCAL = new THREE.Vector3(0, 0.36, 0.28);   // on the spine, behind the withers (body-bone space, scale 1)
const EYE_LOCAL = new THREE.Vector3(0, 0.16, 0.0);       // between the ears (head-bone space)

/** the rider's seat, world space (follows the gait's bob and pitch; valid after the horse's update this frame) */
export function horseSaddle(a: Animal, out: THREE.Vector3): THREE.Vector3 {
  return out.copy(SADDLE_LOCAL).applyMatrix4(horseBones(a).body.matrixWorld);
}
/** a point between the ears, world space */
export function horseEye(a: Animal, out: THREE.Vector3): THREE.Vector3 {
  return out.copy(EYE_LOCAL).applyMatrix4(horseBones(a).head.matrixWorld);
}

export const HORSE_SPECIES: SpeciesDef = {
  rigContract: { skeleton: 'horse.v1', clips: [], sockets: ['body', 'head'] },
  kind: 'horse',
  trampleRadius: 0.8,
  label: 'Wild horse',
  fur: NO_FUR,
  aggressive: false,
  walkSpeed: HORSE_SPEED.walk,
  chargeSpeed: 12,
  chargeDamage: 25,
  sounds: { call: 'horse_neigh', hurt: 'horse_squeal', callEvery: [40, 120] },
  pose: { grazeNeck: 0, gallopTail: 0.55 },
  gait: { trot: 3.0, gallop: 6.4 },
  variants: [
    { id: 'bay', label: engineString('s_d8506748df32'), weight: 34, rarity: 'common', scale: [0.96, 1.03] },
    { id: 'chestnut', label: engineString('s_ebae143256f0'), weight: 24, rarity: 'common', scale: [0.95, 1.02], tint: CHESTNUT, traits: { blaze: 1, socks: 1 } },
    { id: 'dun', label: engineString('s_f774e4371404'), weight: 14, rarity: 'common', scale: [0.95, 1.02], tint: DUN },
    { id: 'grey', label: engineString('s_b98ca6c03d96'), weight: 10, rarity: 'uncommon', scale: [0.96, 1.03], tint: GREY, traits: { dapple: 1 } },
    { id: 'black', label: engineString('s_fafd70f6c9c0'), weight: 8, rarity: 'uncommon', scale: [0.96, 1.03], tint: BLACK },
    { id: 'foal-bay', label: engineString('s_154390447871'), weight: 0, rarity: 'common', scale: [0.6, 0.64], hp: 70, tint: FOAL_BAY, traits: { foal: 1, mane: 0.6 } },
    { id: 'foal-chestnut', label: engineString('s_154390447871'), weight: 0, rarity: 'common', scale: [0.6, 0.64], hp: 70, tint: FOAL_CHESTNUT, traits: { foal: 1, mane: 0.6 } },
    {
      id: 'camp-bay', label: 'Camp horse', weight: 0, rarity: 'common', scale: [1.0, 1.0], traits: { tack: 1 },
    },
    { id: 'tulpar', label: engineString('s_58a74ea825dc'), weight: 0, rarity: 'rare', scale: [1.08, 1.08], hp: 150, tint: BLACK, traits: { tack: 1, mane: 1.7, stallion: 1 } },
    { id: 'camp-black', label: 'Camp horse', weight: 0, rarity: 'common', scale: [1.02, 1.02], tint: BLACK, traits: { tack: 1, blaze: 1, mane: 1.3 } },
    {
      id: 'stallion', label: engineString('s_1f0c0753155f'), weight: 0, rarity: 'rare', scale: [1.08, 1.08], hp: 150, tint: BLACK,
      traits: { mane: 1.7, stallion: 1 }, mods: { chargeDamage: 25 },
    },
  ],
  tuning: {
    hp: 150, sightRange: 45, sightRangeGraze: 20, sightCone: THREE.MathUtils.degToRad(70),
    hearStill: 4, hearCrouch: 8, hearWalk: 15, hearSprint: 30,
    noticeRate: 0.4, forgetRate: 0.2, alertAt: 0.45, boltAt: 1, freezeMin: 2, freezeMax: 4, relaxAfter: 4, panicDist: 10,
    runSpeed: 12.5, trotSpeed: 4.5, fleeMinTime: 3, fleeUntil: 80, fleeUntilMax: 120, fleeMaxTime: 14, lookBack: 3,
    waryTime: 20, waryBoost: 1.3, herdAlertRadius: 20, herdBoltDelayMin: 0.2, herdBoltDelayMax: 0.8, impactSpook: 15, impactAlert: 40,
  },
  build: buildHorse,
  postPose: horsePostPose,
  tick: 'ai',
  act: actHorse,
  think: thinkHorse,
  damageMul: horseDamageMul,
};
