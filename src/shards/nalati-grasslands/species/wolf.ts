import type { RGB } from '@wildshard/engine/entities/species/loft';
import type { SpeciesDef, AnimalSpecies, VariantDef, RigAnimCtx } from '@wildshard/engine/entities/species/registry';
import { NO_FUR, smooth01, bump, clamp } from '@wildshard/engine/entities/species/rigs';
import { engineString } from '@wildshard/engine/strings';

import * as THREE from 'three';




import { nalatiBody } from './bodies';
import { thinkWolf, actWolf } from '../runtime/groupDispatch';

/**
 * Steppe wolf (Nalati, row B4) — grey-tawny, a dark saddle over a buff coat, cream mask / throat / belly, a thick ruff on
 * the neck, amber eyes, a bushy black-tipped tail. 0.78 m at the shoulder. Pack hunter: the AI is `src/shards/nalati-grasslands/runtime/groupDispatch.ts`
 * (roles alpha / flankers / lunger / scout; roam → scent → shadow → encircle → lunge → howl regroup → break).
 *
 * The same canid build makes the camp's sheepdog (`species/sheepdog.ts`, trait `dog`): a black-and-white collie.
 *
 * Rig: the quadruped skeleton (Animal.ts poses it) + extra bones `jaw` (bite / snarl / howl), `tail2` (the brush).
 * `postPose` (SpeciesDef hook) layers the species' own motion from `animal.mem` (numbers 0..1 the Pack writes):
 *   mem.low    shadowing crouch — belly to the grass, head level and forward
 *   mem.snarl  lips back, jaw a crack open, ears flat (the 0.4 s lunge telegraph)
 *   mem.howl   head thrown back, jaw open — the regroup call (wolf-2 mockup)
 *   attackPhase (Animal.startAttack) the lunge: coil (0–0.3) → spring (0.3–0.7) → bite snap (0.7–1)
 * Stats: 70 hp (alpha 110); trot 4.0, run 9.5 m/s; bite 12 (alpha 18).
 * Palette keys (VariantDef.tint): back side cream leg dark nose earIn eye mouth scar.
 */

export const WOLF = {   // exported: glbCreatures.ts recolours the rigged hull per variant from it
  back: [0.20, 0.185, 0.175], side: [0.60, 0.52, 0.42], cream: [0.90, 0.86, 0.78], leg: [0.66, 0.55, 0.41],
  dark: [0.14, 0.12, 0.11], nose: [0.05, 0.045, 0.045], earIn: [0.82, 0.70, 0.58], eye: [0.86, 0.60, 0.16],
  mouth: [0.42, 0.10, 0.10], scar: [0.80, 0.55, 0.52],
} satisfies Record<string, RGB>;

/** Greymane, the pack alpha: silver back, pale ruff */
const ALPHA_TINT: Record<string, RGB> = { back: [0.34, 0.34, 0.36], side: [0.72, 0.70, 0.66], cream: [0.95, 0.94, 0.91], leg: [0.70, 0.66, 0.60] };
const TAWNY_TINT: Record<string, RGB> = { back: [0.30, 0.24, 0.19], side: [0.72, 0.55, 0.34], leg: [0.72, 0.56, 0.37], cream: [0.92, 0.84, 0.70] };
const DARK_TINT: Record<string, RGB> = { back: [0.15, 0.14, 0.14], side: [0.32, 0.30, 0.28], leg: [0.36, 0.33, 0.30], cream: [0.62, 0.58, 0.52] };
const SCOUT_TINT: Record<string, RGB> = { back: [0.32, 0.29, 0.25], side: [0.72, 0.62, 0.48], leg: [0.74, 0.64, 0.50] };

/** the sheepdog: a black-and-white collie (species/sheepdog.ts) */
export const COLLIE_TINT: Record<string, RGB> = {
  back: [0.06, 0.06, 0.065], side: [0.08, 0.075, 0.08], cream: [0.93, 0.92, 0.89], leg: [0.92, 0.91, 0.88],
  dark: [0.05, 0.05, 0.05], earIn: [0.30, 0.22, 0.20], eye: [0.30, 0.18, 0.08],
};
/** The camp's sheepdog's one variant (species/sheepdog.ts): here, beside its tint, so the spawn rolls read it renderer-free. */
export const SHEEPDOG_VARIANTS: VariantDef[] = [{ id: 'collie', label: engineString('s_062ffea0e911'), weight: 1, rarity: 'common', scale: [0.7, 0.72], hp: 60, tint: COLLIE_TINT, traits: { dog: 1, ruff: 1.1 } }];

/**
 * The canid skeleton + lofts (wolf proportions at scale 1; `v.traits.dog` = the collie): its variant's baked body
 * (`generators/canidBody.ts` -> `species/bodies.ts`). Used by wolf.ts, sheepdog.ts and kokbori.ts.
 */
export const buildCanid = (v: VariantDef): AnimalSpecies => nalatiBody('canid', v);

const _e = new THREE.Euler();

/**
 * The canid's own motion on top of Animal.ts' quadruped pose (SpeciesDef.postPose): the stalking crouch, the snarl,
 * the lunge (coil → spring → snap), the howl, the jaw, the brush swinging behind.
 */
export function canidPostPose(c: RigAnimCtx): void {
  const b = c.bones;
  const body = b['body'], n1 = b['neck1'], n2 = b['neck2'], head = b['head'], jaw = b['jaw'], t1 = b['tail'], t2 = b['tail2'];
  if (body === undefined || n1 === undefined || n2 === undefined || head === undefined || jaw === undefined || t1 === undefined || t2 === undefined) return;
  const m = c.mem;
  if (!c.alive) { jaw.rotation.x = 0.25 * smooth01(Math.max(0, c.deathT)); return; }
  const low = clamp(m['low'] ?? 0, 0, 1), snarl = clamp(m['snarl'] ?? 0, 0, 1), howl = clamp(m['howl'] ?? 0, 0, 1);
  const a = c.attack;
  // the lunge: coil (body drops, head low) → spring (body pitches up, forelegs reach) → snap (jaw)
  const coil = a >= 0 ? bump(a, 0, 0.42) : 0, spring = a >= 0 ? bump(a, 0.3, 0.8) : 0, snap = a >= 0 ? bump(a, 0.62, 1) : 0;
  const crouch = Math.max(low * 0.7, coil);
  body.position.y += -0.12 * crouch - 0.02 * snarl + 0.28 * spring * spring;   // the spring leaves the ground
  body.rotation.x += 0.06 * crouch - 0.22 * spring;
  // head: level and forward when stalking, thrown back to howl
  n1.rotation.x += 0.25 * crouch - 0.9 * howl;
  n2.rotation.x += 0.08 * crouch - 0.35 * howl;
  head.rotation.x += -0.2 * crouch - 0.5 * howl - 0.25 * spring;
  // forelegs reach during the spring
  for (const s of ['L', 'R'] as const) {
    const sh = b[`F${s}_shoulder`], ca = b[`F${s}_carpus`];
    if (sh !== undefined) sh.rotation.x -= 0.9 * spring;
    if (ca !== undefined) ca.rotation.x += 0.3 * spring + 0.35 * crouch;
    const hp = b[`B${s}_hip`], stf = b[`B${s}_stifle`];
    if (hp !== undefined) hp.rotation.x += 0.35 * crouch - 0.4 * spring;
    if (stf !== undefined) stf.rotation.x -= 0.3 * crouch;
  }
  // jaw: a crack open when snarling, wide in the howl, a snap at the bite, the odd pant at speed
  const pant = c.speed > 3 ? 0.12 + 0.06 * Math.sin(c.t * 9 + c.seed * 5) : 0.02 * Math.max(0, Math.sin(c.t * 0.9 + c.seed * 3));
  jaw.rotation.x = Math.max(pant, 0.22 * snarl, 0.6 * howl, 0.55 * snap);
  // ears flat for the snarl and the lunge
  const flat = Math.max(snarl, coil, spring) * 0.9;
  const eL = b['earL'], eR = b['earR'];
  if (eL !== undefined) eL.rotation.x += flat * 0.9;
  if (eR !== undefined) eR.rotation.x += flat * 0.9;
  // the brush: low and straight when stalking, streaming at a run, a slow lagging swing
  const run = clamp((c.speed - 4) / 5, 0, 1);
  t1.rotation.x += 0.25 * run - 0.25 * low + 0.35 * howl * 0;
  _e.set(0.35 * run + 0.1 * Math.sin(c.t * 1.3 + c.seed), 0, 0.22 * Math.sin(c.phase * Math.PI * 2 - 0.9) * (0.4 + run) + 0.08 * Math.sin(c.t * 0.8 + c.seed * 2));
  t2.rotation.copy(_e);
}

export const WOLF_SPECIES: SpeciesDef = {
  lockable: true,
  rigContract: { skeleton: 'wolf.v1', clips: [], sockets: ['body', 'head'] },
  kind: 'wolf',
  trampleRadius: 0.45,
  label: 'Steppe wolf',
  fur: NO_FUR,
  aggressive: true,
  walkSpeed: 1.6,
  chargeSpeed: 9.5,
  chargeDamage: 12,
  sounds: { call: 'wolf_howl', hurt: 'wolf_yelp', callEvery: [60, 160] },
  pose: { grazeNeck: 0.5, gallopTail: 0.3 },
  gait: { trot: 1.8, gallop: 5.6 },
  tuning: {
    hp: 70, sightRange: 35, sightRangeGraze: 35, sightCone: THREE.MathUtils.degToRad(70),
    hearStill: 4, hearCrouch: 8, hearWalk: 16, hearSprint: 30,
    noticeRate: 0.45, forgetRate: 0.12, alertAt: 0.35, boltAt: 1, freezeMin: 0.5, freezeMax: 1, relaxAfter: 8, panicDist: 0,
    runSpeed: 9.5, trotSpeed: 4.0, fleeMinTime: 2, fleeUntil: 60, fleeUntilMax: 80, fleeMaxTime: 12, lookBack: 1,
    waryTime: 30, waryBoost: 1.3, herdAlertRadius: 40, herdBoltDelayMin: 0.2, herdBoltDelayMax: 0.6, impactSpook: 0, impactAlert: 25,
  },
  variants: [
    { id: 'grey', label: 'Steppe wolf', weight: 50, rarity: 'common', scale: [0.95, 1.05] },
    { id: 'tawny', label: 'Steppe wolf', weight: 30, rarity: 'common', scale: [0.92, 1.02], tint: TAWNY_TINT },
    { id: 'dark', label: 'Dark wolf', weight: 8, rarity: 'uncommon', scale: [1.0, 1.08], tint: DARK_TINT },
    { id: 'scout', label: 'Young wolf', weight: 12, rarity: 'common', scale: [0.84, 0.86], hp: 55, tint: SCOUT_TINT, traits: { ruff: 0.8 } },
    {
      id: 'alpha', label: engineString('s_92e75ea269b1'), weight: 0, rarity: 'rare', scale: [1.16, 1.16], hp: 110, tint: ALPHA_TINT,
      traits: { scar: 1, ruff: 1.25 }, mods: { chargeDamage: 18 },
    },
  ],
  build: buildCanid,
  postPose: canidPostPose,
  tick: 'ai',
  act: actWolf,
  think: thinkWolf,
};
