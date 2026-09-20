import * as THREE from 'three';
import type { Rng } from '../../core/rng';
import { registerSpecies, type AnimalSpecies, type BoneDef, type VariantDef } from './registry';
import { loft, tube, skinPlain, S, boneIndex, mix, sstep, paintNoise, setShag, isLowPoly, paletteColors, type Paint, type RGB } from './loft';
import { bearPaintLow } from '../lowpoly';
import type { HuntTuning } from '../AnimalManager';

/**
 * Bear — black bear (scale 1: ~1.0 m at the shoulder, ~2.0 m nose to rump) and the bigger humped brown /
 * grizzly. Long heavy barrel, big round skull with a long muzzle, small round ears, stub tail, thick legs
 * on flat plantigrade paws with five dark claws. Shaggy coat (long shells, strong silhouette shag).
 *
 * TERRITORIAL HUNTERS: a bear does not run from you. Inside `stalk.detect` m (or when a bolt lands within
 * impactAlert m) it stands up alert for 1–2 s, then STALKS — walks at you huffing — and CHARGES at 9 m/s
 * (faster than your 7.2 sprint; only the hoverboard outruns it) from panicDist m. A hit that does not kill
 * it makes it charge from wherever it is. See AnimalManager.ts `HuntTuning.stalk`.
 *
 * Variants (traits read by build): hump (0..1.3: shoulder hump height), blaze (0/1: cream chest blaze),
 * grizzle (0..1: pale guard-hair tips on the back and shoulders).
 * Palette keys (VariantDef.tint): base tip dark muzzle blaze nose claw eye pad.
 */

const BEAR_PALETTE = {
  // black bear: near-black coat with a warm brown cast in the light, tan muzzle
  base: [0.075, 0.062, 0.055], tip: [0.20, 0.16, 0.13], dark: [0.035, 0.03, 0.028],
  muzzle: [0.40, 0.29, 0.19], blaze: [0.82, 0.74, 0.58], nose: [0.04, 0.035, 0.035],
  claw: [0.12, 0.10, 0.085], eye: [0.02, 0.015, 0.01], pad: [0.10, 0.08, 0.07],
} satisfies Record<string, RGB>;

/** brown / grizzly: mid brown with pale silver-blond guard-hair tips over the shoulders and back */
const BROWN_TINT: Record<string, RGB> = {
  base: [0.36, 0.25, 0.155], tip: [0.68, 0.56, 0.40], dark: [0.16, 0.115, 0.08],
  muzzle: [0.50, 0.40, 0.29], nose: [0.06, 0.045, 0.04], claw: [0.55, 0.48, 0.38], pad: [0.16, 0.12, 0.10],
};

/** Grizzled Sow: an old, silvered grizzly — paler base, near-white tips, a grey muzzle */
const GRIZZLED_TINT: Record<string, RGB> = {
  base: [0.38, 0.30, 0.22], tip: [0.78, 0.72, 0.62], dark: [0.18, 0.14, 0.11],
  muzzle: [0.62, 0.56, 0.48], nose: [0.07, 0.06, 0.055], claw: [0.60, 0.54, 0.44], pad: [0.18, 0.14, 0.12],
};

/** Old Blackpaw: coal black with a rust sheen over the shoulders and a greyed muzzle */
const BLACKPAW_TINT: Record<string, RGB> = {
  base: [0.06, 0.05, 0.045], tip: [0.26, 0.17, 0.11], dark: [0.028, 0.025, 0.024],
  muzzle: [0.50, 0.44, 0.36], nose: [0.035, 0.03, 0.03],
};

function bearPaint(v: VariantDef): Paint {
  const P = paletteColors(BEAR_PALETTE, v.tint);
  const { base, tip, dark, muzzle, blaze, nose, claw, eye, pad } = P;
  const hasBlaze = Boolean(v.traits?.['blaze']);
  const grizzle = Number(v.traits?.['grizzle'] ?? 0.35);
  return (out, x, y, z, nx, ny, nz, part, t, _a) => {
    const n1 = paintNoise.fbm(x * 3.5 + 23, z * 3.5 + y * 2.5, 3);
    const n2 = paintNoise.fbm(x * 12 - 40, z * 10 + y * 6, 2);
    switch (part) {
      case 'body':
        out.copy(base);
        // pale guard-hair tips over the back and shoulders (strongest on the hump), broken by noise
        mix(out, out, tip, sstep(-0.15, 0.85, ny) * grizzle * (0.45 + 0.55 * sstep(-0.4, 0.5, n1)) * (0.6 + 0.4 * sstep(-0.1, 0.55, z)));
        mix(out, out, dark, sstep(-0.35, -0.85, ny) * 0.8);
        // cream chest blaze: a V on the upper chest between the front legs
        if (hasBlaze && z > 0.28 && ny < -0.15) {
          const edge = n2 * 0.05;
          const band = sstep(0.17, 0.08, Math.abs(x) - 0.06 * sstep(0.35, 0.62, z) + edge) * sstep(0.28, 0.42, z) * sstep(0.72, 0.6, z + Math.abs(x) * 0.6);
          mix(out, out, blaze, band * sstep(-0.15, -0.6, ny));
        }
        break;
      case 'neck':
        out.copy(base);
        mix(out, out, tip, sstep(0.0, 0.9, ny) * grizzle * 0.5);
        mix(out, out, dark, sstep(-0.3, -0.85, ny) * 0.7);
        break;
      case 'head':
        out.copy(base);
        mix(out, out, tip, sstep(0.3, 0.95, ny) * grizzle * 0.35 * sstep(0.55, 0.2, t));
        // tan muzzle from the brow forward, a little paler around the eyes / cheeks
        mix(out, out, muzzle, sstep(0.5, 0.78, t) * (0.75 + 0.25 * sstep(-0.2, -0.9, ny)));
        mix(out, out, muzzle, sstep(0.28, 0.5, t) * sstep(0.5, 0.95, Math.abs(nx)) * 0.25);
        mix(out, out, dark, sstep(0.94, 1.0, t) * 0.6);
        break;
      case 'ear': out.copy(base); mix(out, out, dark, sstep(0.2, 0.8, nz) * 0.7); mix(out, out, tip, sstep(-0.3, -0.9, nz) * grizzle * 0.4); break;
      case 'leg': mix(out, base, dark, sstep(0.5, 0.12, y) * 0.85); mix(out, out, pad, sstep(0.09, 0.03, y) * sstep(0.2, -0.8, ny) * 0.8); break;
      case 'tail': mix(out, base, dark, sstep(0.3, 1, t) * 0.6); break;
      case 'nose': out.copy(nose); break;
      case 'claw': mix(out, claw, dark, sstep(0.4, 1.0, t) * 0.5); break;
      case 'eye': out.copy(eye); break;
      default: out.copy(base);
    }
    let m = 1 + 0.12 * n1 + 0.05 * n2;
    if (part === 'body') m *= 1 - 0.3 * sstep(-0.2, -0.9, ny) - 0.22 * sstep(0.28, 0.08, Math.abs(Math.abs(z) - 0.48)) * sstep(0.6, 0.4, y);   // shadowed belly, leg roots
    if (part === 'leg') m *= 1 - 0.25 * sstep(0.35, 0.62, y);
    if (part === 'head') m *= 1 - 0.2 * sstep(0.5, 0.2, ny) * sstep(0.55, 0.3, t);   // under the jaw
    out.r *= m; out.g *= m; out.b *= m;
  };
}

function buildBear(v: VariantDef, rng: Rng): AnimalSpecies {
  const hump = Number(v.traits?.['hump'] ?? 0);
  setShag(0.028);
  const bones: BoneDef[] = [
    { name: 'body', parent: null, pos: [0, 0.66, -0.05] },
    { name: 'neck1', parent: 'body', pos: [0, 0.72, 0.52] },
    { name: 'neck2', parent: 'neck1', pos: [0, 0.75, 0.66] },
    { name: 'head', parent: 'neck2', pos: [0, 0.78, 0.78] },
    { name: 'earL', parent: 'head', pos: [0.10, 0.96, 0.77] },
    { name: 'earR', parent: 'head', pos: [-0.10, 0.96, 0.77] },
    { name: 'tail', parent: 'body', pos: [0, 0.73, -0.76] },
    { name: 'belly', parent: 'body', pos: [0, 0.5, -0.05] },
  ];
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    bones.push(
      { name: `F${side}_shoulder`, parent: 'body', pos: [sx * 0.17, 0.62, 0.40] },
      { name: `F${side}_carpus`, parent: `F${side}_shoulder`, pos: [sx * 0.18, 0.32, 0.41] },
      { name: `F${side}_fetlock`, parent: `F${side}_carpus`, pos: [sx * 0.18, 0.12, 0.42] },
      { name: `B${side}_hip`, parent: 'body', pos: [sx * 0.16, 0.64, -0.50] },
      { name: `B${side}_stifle`, parent: `B${side}_hip`, pos: [sx * 0.17, 0.40, -0.40] },
      { name: `B${side}_hock`, parent: `B${side}_stifle`, pos: [sx * 0.17, 0.20, -0.51] },
    );
  }
  const B = boneIndex(bones);
  const paint = isLowPoly() ? bearPaintLow(v) : bearPaint(v);   // Driftwood Isle: flat two-tone coat (see ../lowpoly.ts)
  const fur: THREE.BufferGeometry[] = [], hard: THREE.BufferGeometry[] = [], eyes: THREE.BufferGeometry[] = [];
  const body = B('body'), n1 = B('neck1'), n2 = B('neck2'), hd = B('head'), bl = B('belly');
  // torso: a long, deep, low-slung barrel; heavy round rump, the withers rise into a hump (brown bear)
  fur.push(loft([
    S(0, 0.70, -0.82, 0.03, 0.03, body),
    S(0, 0.70, -0.79, 0.17, 0.21, body),
    S(0, 0.69, -0.70, 0.265, 0.32, body, body, 0, 1.0, 1.04),
    S(0, 0.68, -0.54, 0.30, 0.36, body, body, 0, 1.0, 1.08),
    S(0, 0.67, -0.32, 0.305, 0.365, body, bl, 0.5, 0.98, 1.12),
    S(0, 0.67, -0.06, 0.30, 0.36, body, bl, 0.7, 1.0, 1.12),
    S(0, 0.68, 0.18, 0.295, 0.35, body, bl, 0.4, 1.08 + hump * 0.10, 1.08),
    S(0, 0.69, 0.38, 0.285, 0.34, body, n1, 0.15, 1.16 + hump * 0.24, 1.0),
    S(0, 0.71, 0.55, 0.25, 0.30, body, n1, 0.5, 1.12 + hump * 0.14, 0.94),
    S(0, 0.74, 0.69, 0.215, 0.245, n1, n2, 0.5, 1.04 + hump * 0.04, 0.94),
    S(0, 0.765, 0.80, 0.19, 0.21, n2, hd, 0.6, 1.02, 0.97),
  ], 22, 'body', paint, true, false));
  // head: big round skull with a heavy brow, tapering into a long straight muzzle
  fur.push(loft([
    S(0, 0.765, 0.78, 0.195, 0.215, n2, hd, 0.5, 1.04, 0.98),
    S(0, 0.79, 0.90, 0.18, 0.195, hd, hd, 0, 1.12, 0.95),
    S(0, 0.795, 1.00, 0.15, 0.16, hd, hd, 0, 1.06, 0.92),
    S(0, 0.77, 1.08, 0.11, 0.115, hd, hd, 0, 0.95, 1.0),
    S(0, 0.745, 1.16, 0.084, 0.088, hd),
    S(0, 0.725, 1.23, 0.068, 0.07, hd),
    S(0, 0.715, 1.27, 0.055, 0.054, hd),
  ], 18, 'head', paint, false, true));
  // nose pad
  hard.push(loft([
    S(0, 0.715, 1.265, 0.052, 0.05, hd),
    S(0, 0.717, 1.29, 0.048, 0.044, hd),
    S(0, 0.717, 1.30, 0.022, 0.02, hd),
  ], 12, 'nose', paint));
  // ears (small, round, set wide on the skull) + eyes (small, forward-set)
  for (const sx of [1, -1]) {
    const eb = B(sx > 0 ? 'earL' : 'earR');
    fur.push(loft([
      S(sx * 0.085, 0.92, 0.80, 0.035, 0.02, hd, eb, 0.3),
      S(sx * 0.105, 0.975, 0.785, 0.052, 0.026, eb),
      S(sx * 0.12, 1.025, 0.775, 0.048, 0.024, eb),
      S(sx * 0.13, 1.055, 0.77, 0.028, 0.014, eb),
      S(sx * 0.135, 1.065, 0.768, 0.008, 0.005, eb),
    ], 10, 'ear', paint, true, true, 'z'));
    const eye = new THREE.SphereGeometry(0.015, 10, 8);
    eye.translate(sx * 0.082, 0.80, 1.0);
    eyes.push(skinPlain(eye, hd, 'eye', paint));
  }
  // stub tail
  const tl = B('tail');
  fur.push(loft([
    S(0, 0.72, -0.77, 0.045, 0.045, body, tl, 0.3),
    S(0, 0.685, -0.84, 0.04, 0.04, tl),
    S(0, 0.65, -0.885, 0.028, 0.028, tl),
    S(0, 0.63, -0.90, 0.01, 0.01, tl),
  ], 8, 'tail', paint, false, true));
  // legs: thick columns on flat plantigrade paws (a long foot lofted forward from the ankle) with five claws
  const feetF: [number, number][] = [], feetB: [number, number][] = [];   // front / back, each L then R
  const paw = (x: number, z0: number, bone: number, len: number) => {
    fur.push(loft([
      S(x, 0.075, z0 - 0.02, 0.078, 0.05, bone),
      S(x, 0.06, z0 + len * 0.35, 0.092, 0.052, bone),
      S(x, 0.05, z0 + len * 0.72, 0.09, 0.045, bone),
      S(x, 0.045, z0 + len, 0.07, 0.035, bone),
    ], 12, 'leg', paint, true, true));
    for (let i = 0; i < 5; i++) {
      const cx = x + (i - 2) * 0.034, cz = z0 + len - 0.01 + (0.012 - Math.abs(i - 2) * 0.008);
      hard.push(tube([[cx, 0.05, cz], [cx, 0.04, cz + 0.035], [cx, 0.012, cz + 0.06]], 0.012, 0.004, bone, 'claw', paint, 6));
    }
  };
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    const sh = B(`F${side}_shoulder`), ca = B(`F${side}_carpus`), fe = B(`F${side}_fetlock`);
    fur.push(loft([
      S(sx * 0.16, 0.72, 0.39, 0.16, 0.24, body, sh, 0.3),
      S(sx * 0.175, 0.56, 0.40, 0.13, 0.18, body, sh, 0.8),
      S(sx * 0.18, 0.43, 0.41, 0.10, 0.125, sh),
      S(sx * 0.18, 0.32, 0.41, 0.085, 0.10, sh, ca, 0.5),
      S(sx * 0.18, 0.22, 0.41, 0.078, 0.088, ca),
      S(sx * 0.18, 0.13, 0.42, 0.076, 0.086, ca, fe, 0.5),
      S(sx * 0.18, 0.08, 0.43, 0.08, 0.075, fe),
    ], 12, 'leg', paint, false, true));
    paw(sx * 0.18, 0.36, fe, 0.24);
    feetF.push([sx * 0.18, 0.48]);
    const hp = B(`B${side}_hip`), stf = B(`B${side}_stifle`), hk = B(`B${side}_hock`);
    fur.push(loft([
      S(sx * 0.15, 0.72, -0.53, 0.165, 0.25, body, hp, 0.3),
      S(sx * 0.165, 0.56, -0.46, 0.14, 0.20, body, hp, 0.8),
      S(sx * 0.17, 0.44, -0.40, 0.105, 0.135, hp, stf, 0.5),
      S(sx * 0.17, 0.34, -0.44, 0.088, 0.105, stf),
      S(sx * 0.17, 0.24, -0.51, 0.08, 0.092, stf, hk, 0.5),
      S(sx * 0.17, 0.15, -0.50, 0.078, 0.086, hk),
      S(sx * 0.17, 0.08, -0.49, 0.08, 0.075, hk),
    ], 12, 'leg', paint, false, true));
    paw(sx * 0.17, -0.57, hk, 0.29);
    feetB.push([sx * 0.17, -0.40]);
  }
  setShag(0);
  const feetOrdered: [number, number][] = [...feetF, ...feetB];
  void rng;
  return {
    bones, furParts: fur, hardParts: hard, eyeParts: eyes,
    dims: { bodyY: 0.66, bodyHalfLen: 0.72, bodyRadius: 0.36, headRadius: 0.21, legLen: 0.62, feet: feetOrdered, halfWidth: 0.31 },
  };
}

/**
 * The hunting loop of a bear. Senses reach far (it smells you), the alert freeze is short (1–2 s of standing
 * and looking — your shot window), and `stalk` (bears only) turns the alert into a pursuit instead of a bolt:
 * see AnimalManager.ts. panicDist is the CHARGE trigger (14 m: a 9 m/s charge you cannot outrun on foot).
 * The flee numbers only matter for a black bear that breaks off below 20 % hp.
 */
export const BEAR_TUNING: HuntTuning = {
  hp: 220,
  sightRange: 45, sightRangeGraze: 30, sightCone: THREE.MathUtils.degToRad(70),
  hearStill: 6, hearCrouch: 12, hearWalk: 25, hearSprint: 45,
  noticeRate: 0.8, forgetRate: 0.15, alertAt: 0.3, boltAt: 0.6,
  freezeMin: 1.0, freezeMax: 2.0, relaxAfter: 3, panicDist: 14,
  runSpeed: 7.0, trotSpeed: 3.5, fleeMinTime: 3, fleeUntil: 60, fleeUntilMax: 90, fleeMaxTime: 12, lookBack: 2,
  waryTime: 30, waryBoost: 1.3,
  herdAlertRadius: 20, herdBoltDelayMin: 0.3, herdBoltDelayMax: 1.0,
  impactSpook: 20, impactAlert: 80,
  stalk: { detect: 40, speed: 2.5, giveUp: 60, rechargeCd: 1.5, huffMin: 1.8, huffMax: 3.2, roar: 'bear_roar', fleeBelowHp: 0.2, fleeChance: 0.5 },
};

registerSpecies({
  kind: 'bear',
  label: 'Bear',
  fur: {
    texSeed: 303, tex: { contrast: 0.9, grizzle: 0.45, normalStrength: 2.4, bristle: 0.3, strandLen: 16, root: 0.3 },
    roughness: 0.92, sheen: 0.12, sheenColor: [0.3, 0.24, 0.18], envMapIntensity: 0.85, rim: [0.85, 0.66, 0.42], shellLen: 0.095, shag: 0.028,
  },
  aggressive: true,
  walkSpeed: 1.0,
  chargeSpeed: 9,
  chargeDamage: 35,
  tuning: BEAR_TUNING,
  sounds: { call: 'bear_growl', hurt: 'bear_hurt' },
  pose: { grazeNeck: 0.55, gallopTail: 0.2 },
  // weights sum to 100: black 55 % (a third of them with a chest blaze) · brown 30 % · Old Blackpaw 10 % · Grizzled Sow 5 %
  // (a herd plan's `variants` narrows the pool — Pine Hollow's black den never rolls a brown)
  variants: [
    { id: 'black', label: 'Black bear', weight: 37, rarity: 'common', scale: [1.3, 1.4], hp: 220, traits: { grizzle: 0.3 } },
    { id: 'black-blaze', label: 'Black bear', weight: 18, rarity: 'common', scale: [1.3, 1.4], hp: 220, traits: { grizzle: 0.3, blaze: 1 } },
    {
      id: 'brown', label: 'Brown bear', weight: 30, rarity: 'uncommon', scale: [1.6, 1.75], hp: 320,
      tint: BROWN_TINT, traits: { hump: 1, grizzle: 0.6 },
      fur: { rim: [0.95, 0.8, 0.55], sheenColor: [0.42, 0.34, 0.24] },
      mods: { damageTaken: 0.85, chargeDamage: 45, relentless: true },   // relentless: a brown bear never breaks off
    },
    {
      id: 'black-old', label: 'Old Blackpaw', weight: 10, rarity: 'rare', scale: [1.65, 1.65], hp: 330,
      tint: BLACKPAW_TINT, traits: { grizzle: 0.45, hump: 0.3 },
      mods: { chargeDamage: 42, relentless: true, chargeDist: 1.2 },
    },
    {
      id: 'brown-old', label: 'Grizzled Sow', weight: 5, rarity: 'rare', scale: [2.0, 2.0], hp: 480,
      tint: GRIZZLED_TINT, traits: { hump: 1.3, grizzle: 1.0 },
      fur: { rim: [0.95, 0.9, 0.78], sheenColor: [0.5, 0.46, 0.4] },
      mods: { damageTaken: 0.8, chargeDamage: 55, relentless: true, chargeDist: 1.3, speed: 1.05 },
    },
  ],
  build: buildBear,
});
