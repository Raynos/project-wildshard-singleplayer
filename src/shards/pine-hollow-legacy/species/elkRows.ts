// The elk's rows (moved from the engine's species folder, E405 LAYER-PURITY; out of the kit, SF54). Only Pine Hollow
// spawns it, on its rigged hulls, with its own spawn-only thrall (src/shards/pine-hollow/species/rows.ts); its procedural
// lofts are Pine's offline rig input (src/shards/pine-hollow/generators/creatureLofts.ts, sp-o194).
import type { HuntTuning } from '@wildshard/engine/ai/hunt';
import type { SpeciesDef } from '@wildshard/engine/entities/species/registry';
import type { RGB } from '@wildshard/engine/level/data';

/**
 * Elk (wapiti) — a much bigger beast than the deer: 1.5 m at the shoulder, ~2.4 m of body, a heavy neck
 * under a dark shaggy mane, pale tan body over dark brown neck / legs / belly and a cream rump patch.
 * Bulls carry a 6×6 rack that sweeps back over the neck (2.5× the stag's, tines pointing forward).
 *
 * Behaviour: "like the deer but way harder to hunt" — its own HuntTuning below (ELK_TUNING): it sees
 * you at 45 m, hears a walker at 22 m, its awareness fills ~2× faster than a deer's, the head-up freeze
 * is only 0.6–1.2 s and then it bolts at 11 m/s and keeps going 90–140 m before it looks back; one
 * spooked elk moves the whole group (herd radius 40 m). Body hits do ×0.8 (thick hide; every variant
 * carries mods.damageTaken 0.8) — headshots land in full. Bulls bugle every 40–120 s when calm.
 *
 * Variants (traits read by the lofts and the coats): antlers (0/1), antlerScale. Tint keys (VariantDef.tint): body
 * bodyDark neck mane belly rump legDark nose muzzle eyeRing earIn antler antlerTip hoof eye.
 */

/** cream-white coat (leucistic): the mane and legs only a shade darker, pink nose, pale hooves + antlers */
const PALE_TINT: Record<string, RGB> = {
  body: [0.88, 0.85, 0.78], bodyDark: [0.78, 0.74, 0.66],
  neck: [0.72, 0.66, 0.58], mane: [0.60, 0.54, 0.47], belly: [0.80, 0.76, 0.70], rump: [0.95, 0.93, 0.88],
  legDark: [0.72, 0.67, 0.60], nose: [0.55, 0.40, 0.40], muzzle: [0.80, 0.74, 0.70], eyeRing: [0.72, 0.64, 0.60], earIn: [0.88, 0.76, 0.74],
  antler: [0.70, 0.64, 0.56], antlerTip: [0.92, 0.90, 0.84], hoof: [0.40, 0.36, 0.32],
};

/** the Imperial bull: a warmer, gold-cast coat with an even darker mane; the glow is in the fur override */
const IMPERIAL_TINT: Record<string, RGB> = {
  body: [0.52, 0.40, 0.24], bodyDark: [0.40, 0.30, 0.17],
  neck: [0.22, 0.15, 0.09], mane: [0.14, 0.10, 0.07], belly: [0.28, 0.21, 0.14], rump: [0.92, 0.84, 0.62],
  antler: [0.52, 0.40, 0.24], antlerTip: [0.94, 0.86, 0.64],
};

/**
 * The elk's hunting loop — NOT the deer baseline. Player speeds for reference: crouch 2.2, walk 4.3, sprint 7.2 m/s.
 * Head-on it sees a walker at 45 m in a wide cone, hears one at 22 m (sprint 40 m); the meter fills twice as fast as
 * a deer's, the stare is under a second, then 11 m/s to 90–140 m away, wary for a minute; herd radius 40 m.
 */
export const ELK_TUNING: HuntTuning = {
  hp: 160,
  sightRange: 45, sightRangeGraze: 24, sightCone: 70 * (Math.PI / 180),
  hearStill: 4, hearCrouch: 10, hearWalk: 22, hearSprint: 40,
  noticeRate: 0.6, forgetRate: 0.25, alertAt: 0.4, boltAt: 1.0,
  freezeMin: 0.6, freezeMax: 1.2, relaxAfter: 4, panicDist: 14,
  runSpeed: 11.0, trotSpeed: 5.0, fleeMinTime: 3, fleeUntil: 90, fleeUntilMax: 140, fleeMaxTime: 16, lookBack: 3,
  waryTime: 60, waryBoost: 1.3,
  herdAlertRadius: 40, herdBoltDelayMin: 0.15, herdBoltDelayMax: 0.6,
  impactSpook: 10, impactAlert: 30,
};

/** The elk's rows and look fields; the body (`build`) is the look's (Pine: the baked hull body, species/bodies.ts). */
export const ELK: Omit<SpeciesDef, 'build'> = {
  rigContract: { skeleton: 'quadruped.v1', clips: [], sockets: ['body', 'head'] },
  kind: 'elk',
  trampleRadius: 0.65,
  label: 'Elk',
  fur: {
    texSeed: 103, tex: { contrast: 0.85, grizzle: 0.2, normalStrength: 1.7, bristle: 0.1, strandLen: 28, root: 0.16 },
    roughness: 0.86, sheen: 0.22, sheenColor: [0.42, 0.33, 0.22], envMapIntensity: 0.55, rim: [1.0, 0.78, 0.48], shellLen: 0.065, shag: 0.008,
  },
  aggressive: false,
  walkSpeed: 1.5,
  tuning: ELK_TUNING,
  // bulls bugle (AnimalManager: sounds.callVariants / callEvery); a hit gets the deer's bark
  sounds: { call: 'elk_bugle', hurt: 'deer_call', callVariants: ['bull', 'big-bull', 'imperial'], callEvery: [40, 120] },
  pose: { grazeNeck: 0.9, gallopTail: 0.4 },
  // weights sum to 100: cow 50 % · bull 38 % · Royal bull 8 % · pale 3 % · Imperial 1 %; every variant's body hits do ×0.8 (hide)
  variants: [
    { id: 'cow', label: 'Elk cow', weight: 50, rarity: 'common', scale: [0.95, 1.05], hp: 160, mods: { damageTaken: 0.8 } },
    { id: 'bull', label: 'Bull elk', weight: 38, rarity: 'common', scale: [1.05, 1.15], hp: 200, traits: { antlers: 1 }, mods: { damageTaken: 0.8 } },
    { id: 'big-bull', label: 'Royal bull', weight: 8, rarity: 'uncommon', scale: [1.25, 1.25], hp: 260, traits: { antlers: 1, antlerScale: 1.2 }, mods: { damageTaken: 0.8 } },
    { id: 'pale', label: 'Pale elk', weight: 3, rarity: 'rare', scale: [0.95, 1.1], hp: 160, tint: PALE_TINT, mods: { damageTaken: 0.8 } },
    {
      id: 'imperial', label: 'Imperial bull', weight: 1, rarity: 'legendary', scale: [1.4, 1.4], hp: 340,
      tint: IMPERIAL_TINT, traits: { antlers: 1, antlerScale: 1.4 },
      // faint golden backlit rim + self-glow so it reads at dusk; outruns everything
      fur: { rim: [1.0, 0.86, 0.45], emissive: [0.55, 0.40, 0.12], emissiveIntensity: 0.06, sheenColor: [0.75, 0.60, 0.30] },
      mods: { speed: 1.15, damageTaken: 0.8 },
    },
  ],
};
