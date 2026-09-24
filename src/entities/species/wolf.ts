import * as THREE from 'three';
import type { Rng } from '../../core/rng';
import { registerSpecies, type AnimalSpecies, type BoneDef, type VariantDef, type RigAnimCtx } from './registry';
import { loft, skinPlain, S, boneIndex, mix, sstep, srgb, paletteColors, paintNoise, type Paint, type RGB } from './loft';
import { NO_FUR, smooth01, bump, clamp } from './rigs';
import { tuft, hash01, type V3, type Skin } from '../creatureKit';
import { thinkWolf } from '../Pack';

/**
 * Steppe wolf (Nalati, row B4) — grey-tawny, a dark saddle over a buff coat, cream mask / throat / belly, a thick ruff on
 * the neck, amber eyes, a bushy black-tipped tail. 0.78 m at the shoulder. Pack hunter: the AI is `src/entities/Pack.ts`
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

function canidPaint(v: VariantDef): Paint {
  const P = paletteColors(WOLF, v.tint);
  const scar = Boolean(v.traits?.['scar']);
  const dog = Boolean(v.traits?.['dog']);
  return (out, x, y, z, nx, ny, nz, part, t) => {
    switch (part) {
      case 'body': {
        out.copy(P.side);
        // the saddle: dark over the back and shoulders, softening toward the flanks
        mix(out, out, P.back, sstep(-0.05, 0.6, ny + 0.15 * paintNoise.fbm(x * 6 + 3, z * 5, 2)) * (0.6 + 0.4 * sstep(-0.5, 0.2, z)));
        mix(out, out, P.cream, sstep(-0.25, -0.75, ny));                                        // belly
        if (dog) mix(out, out, P.cream, sstep(0.18, 0.34, z) * sstep(0.2, -0.4, ny) * 0.95);    // white chest bib
        break;
      }
      case 'neck':
        out.copy(P.side);
        mix(out, out, P.back, sstep(0.1, 0.8, ny) * 0.85);
        mix(out, out, P.cream, sstep(-0.05, -0.6, ny) + (dog ? sstep(0.15, 0.55, t) * 0.9 : 0));  // throat (the collie's white collar)
        break;
      case 'head': {
        out.copy(P.side);
        mix(out, out, P.back, sstep(0.45, 0.9, ny) * sstep(0.7, 0.3, t) * 0.8);               // dark crown
        // the pale mask: cheeks, brows and the muzzle sides
        mix(out, out, P.cream, sstep(0.35, 0.6, t) * sstep(0.2, -0.5, ny) * 0.9 + sstep(0.55, 0.8, t) * sstep(0.35, 0.8, Math.abs(nx)) * 0.7);
        if (dog) mix(out, out, P.cream, sstep(0.025, 0.012, Math.abs(x)) * sstep(0.4, 0.55, t) * 0.95);   // white blaze
        mix(out, out, P.nose, sstep(0.93, 0.985, t));
        {
          // the mask: dark rims round the eyes and a tear line down to the muzzle, a pale brow spot above each eye
          const ex = Math.abs(x) - 0.063, ey = y - 0.889, ez = z - 0.728;
          const de = Math.hypot(ex, ey * 1.3, ez);
          mix(out, out, P.dark, sstep(0.034, 0.018, de) * 0.85 + sstep(0.02, 0.008, Math.abs(ex + 0.004 - (ez) * 0.3)) * sstep(0.0, -0.02, ey) * sstep(0.08, 0.02, ez) * 0.5);
          mix(out, out, P.cream, sstep(0.028, 0.012, Math.hypot(ex + 0.004, ey - 0.026, ez + 0.01)) * 0.8);
        }
        if (scar && x > 0 && t > 0.35 && t < 0.8) {
          const d = Math.abs((y - 0.87) + (z - 0.72) * 0.9);                                    // a slash from the brow over the left eye to the muzzle
          mix(out, out, P.scar, sstep(0.012, 0.004, d) * sstep(0.2, 0.6, nx));
        }
        break;
      }
      case 'jaw': mix(out, P.cream, P.mouth, sstep(0.2, 0.7, ny)); mix(out, out, P.nose, sstep(0.85, 1, t) * 0.6); break;
      case 'ear': out.copy(P.back); mix(out, out, P.earIn, sstep(0.1, 0.7, nz) * 0.9); mix(out, out, P.dark, sstep(0.7, 1, t) * 0.7); break;
      case 'leg': mix(out, P.leg, P.cream, sstep(0.1, 0.8, -nx * Math.sign(x)) * 0.6); if (!dog) mix(out, out, P.back, sstep(0.45, 0.65, y) * 0.4); out.multiplyScalar(1 - 0.22 * sstep(0.42, 0.62, y)); break;   // AO where the leg meets the body
      case 'paw': mix(out, dog ? P.cream : P.leg, P.dark, 0.35); break;
      case 'tail': out.copy(P.side); mix(out, out, P.back, sstep(0.2, 0.8, ny) * 0.8); mix(out, out, dog ? P.cream : P.dark, sstep(0.72, 0.88, t)); break;
      case 'eye': out.copy(P.eye); break;
      case 'pupil': out.copy(P.nose); break;
      default: out.copy(P.side);
    }
    void nz;
  };
}

/**
 * The canid skeleton + lofts (wolf proportions at scale 1). `v.traits.dog` = the collie: softer semi-drop ears, a
 * shorter muzzle, a longer feathered tail. Used by wolf.ts and sheepdog.ts.
 */
export function buildCanid(v: VariantDef, _rng: Rng): AnimalSpecies {
  const dog = Boolean(v.traits?.['dog']);
  const ruff = Number(v.traits?.['ruff'] ?? 1);
  // girth: a wolf is deep-chested and thick-coated — the lofts below are the lean skeleton, these fill it out
  const TW = 1.18, TH = 1.1, LW = dog ? 1.15 : 1.3, HW = dog ? 1.08 : 1.18;
  const bones: BoneDef[] = [
    { name: 'body', parent: null, pos: [0, 0.66, -0.02] },
    { name: 'neck1', parent: 'body', pos: [0, 0.73, 0.38] },
    { name: 'neck2', parent: 'neck1', pos: [0, 0.80, 0.50] },
    { name: 'head', parent: 'neck2', pos: [0, 0.865, 0.61] },
    { name: 'jaw', parent: 'head', pos: [0, 0.815, 0.67] },
    { name: 'earL', parent: 'head', pos: [0.058, 0.935, 0.625] },
    { name: 'earR', parent: 'head', pos: [-0.058, 0.935, 0.625] },
    { name: 'tail', parent: 'body', pos: [0, 0.69, -0.53] },
    { name: 'tail2', parent: 'tail', pos: [0, 0.53, -0.66] },
    { name: 'belly', parent: 'body', pos: [0, 0.55, 0.05] },
  ];
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    bones.push(
      { name: `F${side}_shoulder`, parent: 'body', pos: [sx * 0.10, 0.60, 0.34] },
      { name: `F${side}_carpus`, parent: `F${side}_shoulder`, pos: [sx * 0.10, 0.27, 0.36] },
      { name: `F${side}_fetlock`, parent: `F${side}_carpus`, pos: [sx * 0.10, 0.08, 0.37] },
      { name: `B${side}_hip`, parent: 'body', pos: [sx * 0.095, 0.64, -0.40] },
      { name: `B${side}_stifle`, parent: `B${side}_hip`, pos: [sx * 0.105, 0.44, -0.34] },
      { name: `B${side}_hock`, parent: `B${side}_stifle`, pos: [sx * 0.11, 0.23, -0.50] },
    );
  }
  const B = boneIndex(bones);
  const paint = canidPaint(v);
  const fur: THREE.BufferGeometry[] = [], hard: THREE.BufferGeometry[] = [], eyes: THREE.BufferGeometry[] = [];
  const body = B('body'), n1 = B('neck1'), n2 = B('neck2'), hd = B('head'), bl = B('belly'), jw = B('jaw');
  // torso: tucked waist, deep narrow chest, the ruff swelling over the shoulders
  fur.push(loft([
    S(0, 0.665, -0.57, (0.02) * TW, (0.02) * TH, body),
    S(0, 0.67, -0.55, (0.085) * TW, (0.095) * TH, body),
    S(0, 0.665, -0.49, (0.125) * TW, (0.135) * TH, body),
    S(0, 0.66, -0.39, (0.135) * TW, (0.145) * TH, body),
    S(0, 0.655, -0.24, (0.125) * TW, (0.13) * TH, body, bl, 0.4, 1.0, 0.85),
    S(0, 0.66, -0.07, (0.135) * TW, (0.16) * TH, body, bl, 0.6, 1.0, 1.0),
    S(0, 0.665, 0.10, (0.145) * TW, (0.19) * TH, body, bl, 0.4, 1.0, 1.12),
    S(0, 0.675, 0.24, (0.15) * TW, (0.205) * TH, body, n1, 0.1, 1.05, 1.15),
    S(0, 0.695, 0.36, (0.14 * ruff) * TW, (0.19) * TH, body, n1, 0.4, 1.12, 1.05),
    S(0, 0.715, 0.45, (0.11) * TW, (0.14) * TH, n1, n2, 0.3),
    S(0, 0.72, 0.49, (0.03) * TW, (0.04) * TH, n1),
  ], 18, 'body', paint));
  // neck with the ruff
  fur.push(loft([
    S(0, 0.69, 0.28, (0.145) * TW, (0.19) * TH, body, n1, 0.2),
    S(0, 0.745, 0.40, (0.14 * ruff) * TW, (0.165 * ruff) * TH, n1),
    S(0, 0.795, 0.50, (0.125 * ruff) * TW, (0.14 * ruff) * TH, n1, n2, 0.6),
    S(0, 0.845, 0.575, (0.10) * TW, (0.11) * TH, n2, hd, 0.5),
    S(0, 0.875, 0.62, (0.075) * TW, (0.08) * TH, hd),
    S(0, 0.885, 0.64, (0.03) * TW, (0.03) * TH, hd),
  ], 16, 'neck', paint, false, true));
  // head: broad skull and cheeks, a long tapering muzzle (the upper jaw; the lower jaw is its own part on the `jaw` bone)
  const mz = dog ? 0.8 : 1;   // the collie's shorter muzzle
  fur.push(loft([
    S(0, 0.86, 0.575, 0.07 * HW, 0.075 * HW, hd),
    S(0, 0.875, 0.615, 0.095 * HW, 0.09 * HW, hd),
    S(0, 0.878, 0.665, 0.10 * HW, 0.088 * HW, hd),
    S(0, 0.868, 0.715, 0.083 * HW, 0.072 * HW, hd, hd, 0, 1.0, 0.9),
    S(0, 0.848, 0.715 + 0.06 * mz, 0.056 * HW, 0.052 * HW, hd, hd, 0, 1.0, 0.7),
    S(0, 0.836, 0.715 + 0.12 * mz, 0.045 * HW, 0.043 * HW, hd, hd, 0, 1.0, 0.6),
    S(0, 0.83, 0.715 + 0.175 * mz, 0.038 * HW, 0.035 * HW, hd, hd, 0, 1.0, 0.6),
    S(0, 0.829, 0.715 + 0.205 * mz, 0.028 * HW, 0.027 * HW, hd),
    S(0, 0.828, 0.715 + 0.215 * mz, 0.01 * HW, 0.01 * HW, hd),
  ], 16, 'head', paint));
  // lower jaw (hinged at the back of the cheek)
  fur.push(loft([
    S(0, 0.815, 0.67, 0.06 * HW, 0.03 * HW, hd, jw, 0.6),
    S(0, 0.807, 0.72 + 0.03 * mz, 0.045 * HW, 0.024 * HW, jw),
    S(0, 0.806, 0.72 + 0.10 * mz, 0.034 * HW, 0.02 * HW, jw),
    S(0, 0.807, 0.72 + 0.16 * mz, 0.026 * HW, 0.016 * HW, jw),
    S(0, 0.809, 0.72 + 0.185 * mz, 0.01 * HW, 0.008 * HW, jw),
  ], 12, 'jaw', paint));
  // ears: tall triangles (the collie's tips fold forward)
  for (const sx of [1, -1]) {
    const eb = B(sx > 0 ? 'earL' : 'earR');
    const fold = dog ? 0.035 : 0;
    fur.push(loft([
      S(sx * 0.052, 0.915, 0.625, 0.036, 0.013, hd, eb, 0.3),
      S(sx * 0.062, 0.965, 0.628, 0.032, 0.012, eb),
      S(sx * 0.07, 1.01, 0.632 + fold * 0.5, 0.02, 0.009, eb),
      S(sx * 0.074, 1.045 - fold * 0.6, 0.64 + fold, 0.006, 0.004, eb),
    ], 8, 'ear', paint, true, true, 'z'));
    const eye = new THREE.SphereGeometry(0.0145, 10, 8);
    eye.scale(1, 0.8, 1);
    eye.translate(sx * 0.053 * HW, 0.889, 0.728);
    eyes.push(skinPlain(eye, hd, 'eye', paint));
    const pupil = new THREE.SphereGeometry(0.007, 6, 5);
    pupil.translate(sx * 0.058 * HW, 0.89, 0.737);
    eyes.push(skinPlain(pupil, hd, 'pupil', paint));
  }
  // the brush: hangs from the rump, thick in the middle
  const tl = B('tail'), t2 = B('tail2');
  const tk = dog ? 1.15 : 1;
  fur.push(loft([
    S(0, 0.68, -0.53, 0.035, 0.04, body, tl, 0.4),
    S(0, 0.645, -0.59, 0.05, 0.055, tl),
    S(0, 0.585, -0.645, 0.062, 0.066, tl, t2, 0.4),
    S(0, 0.50, -0.685, 0.066, 0.066, t2),
    S(0, 0.41 - 0.03 * tk, -0.71, 0.056, 0.056, t2),
    S(0, 0.33 - 0.05 * tk, -0.72, 0.032, 0.032, t2),
    S(0, 0.29 - 0.06 * tk, -0.722, 0.01, 0.01, t2),
  ], 12, 'tail', paint, false, true));
  // legs
  const feetF: [number, number][] = [], feetB: [number, number][] = [];
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    const sh = B(`F${side}_shoulder`), ca = B(`F${side}_carpus`), fe = B(`F${side}_fetlock`);
    fur.push(loft([
      S(sx * 0.085, 0.67, 0.335, 0.06 * LW, 0.10 * LW, body, sh, 0.3),
      S(sx * 0.10, 0.52, 0.35, 0.05 * LW, 0.068 * LW, body, sh, 0.8),
      S(sx * 0.10, 0.38, 0.36, 0.034 * LW, 0.044 * LW, sh),
      S(sx * 0.10, 0.285, 0.36, 0.027 * LW, 0.031 * LW, sh, ca, 0.5),
      S(sx * 0.10, 0.17, 0.365, 0.022 * LW, 0.026 * LW, ca),
      S(sx * 0.10, 0.085, 0.37, 0.024 * LW, 0.028 * LW, ca, fe, 0.5),
      S(sx * 0.10, 0.05, 0.378, 0.027 * LW, 0.028 * LW, fe),
    ], 10, 'leg', paint, false, true));
    hard.push(loft([
      S(sx * 0.10, 0.03, 0.35, 0.026 * LW, 0.02 * LW, fe),
      S(sx * 0.10, 0.032, 0.38, 0.034 * LW, 0.03 * LW, fe),
      S(sx * 0.10, 0.024, 0.41, 0.03 * LW, 0.022 * LW, fe),
      S(sx * 0.10, 0.016, 0.428, 0.014 * LW, 0.01 * LW, fe),
    ], 10, 'paw', paint));
    feetF.push([sx * 0.10, 0.40]);
    const hp = B(`B${side}_hip`), stf = B(`B${side}_stifle`), hk = B(`B${side}_hock`);
    fur.push(loft([
      S(sx * 0.075, 0.69, -0.40, 0.07 * LW, 0.12 * LW, body, hp, 0.3),
      S(sx * 0.095, 0.55, -0.37, 0.064 * LW, 0.10 * LW, body, hp, 0.8),
      S(sx * 0.105, 0.44, -0.35, 0.048 * LW, 0.058 * LW, hp, stf, 0.5),
      S(sx * 0.11, 0.34, -0.42, 0.034 * LW, 0.04 * LW, stf),
      S(sx * 0.11, 0.235, -0.495, 0.027 * LW, 0.03 * LW, stf, hk, 0.5),
      S(sx * 0.11, 0.14, -0.485, 0.022 * LW, 0.026 * LW, hk),
      S(sx * 0.11, 0.05, -0.475, 0.026 * LW, 0.028 * LW, hk),
    ], 10, 'leg', paint, false, true));
    hard.push(loft([
      S(sx * 0.11, 0.03, -0.50, 0.026 * LW, 0.02 * LW, hk),
      S(sx * 0.11, 0.032, -0.47, 0.033 * LW, 0.03 * LW, hk),
      S(sx * 0.11, 0.024, -0.44, 0.029 * LW, 0.022 * LW, hk),
      S(sx * 0.11, 0.016, -0.424, 0.013 * LW, 0.01 * LW, hk),
    ], 10, 'paw', paint));
    feetB.push([sx * 0.11, -0.46]);
  }
  // ── fur tufts: the silhouette a smooth loft can't give (the ruff, cheek fluff, hackles, the brush, the trousers) ──
  addCanidTufts(fur, paint, { B, TW, HW, ruff, dog, tl, t2 });
  return {
    bones, furParts: fur, hardParts: hard, eyeParts: eyes,
    dims: { bodyY: 0.66, bodyHalfLen: 0.46, bodyRadius: 0.19, headRadius: 0.12, legLen: 0.6, feet: [...feetF, ...feetB], halfWidth: 0.16 },
  };
}

/**
 * The canid's fur tufts (look pass): two layered rings of ruff round the neck, cheek fluff, hackles down the spine,
 * "trousers" on the hind thighs, a belly fringe, elbow feathers and a bushy brush. Each tuft is painted like the coat
 * at its root (seen from its outward direction) with a paler, grizzled tip.
 */
function addCanidTufts(fur: THREE.BufferGeometry[], paint: Paint, o: { B: (n: string) => number; TW: number; HW: number; ruff: number; dog: boolean; tl: number; t2: number }): void {
  const { B, TW, HW, ruff, dog } = o;
  const body = B('body'), n1 = B('neck1'), n2 = B('neck2'), hd = B('head');
  const tipLight = srgb(0.93, 0.9, 0.84);
  let k = 0;
  const add = (root: V3, dir: V3, len: number, width: number, skin: Skin, region: string, regionT: number, droop = 0.3, tipSkin?: Skin): void => {
    const L = Math.hypot(dir[0], dir[1], dir[2]) || 1;
    const nx = dir[0] / L, ny = dir[1] / L, nz = dir[2] / L;
    const kk = k++;
    const tp: Paint = (out, x, y, z, _nx, _ny, _nz, _part, t, a) => {
      paint(out, root[0], root[1], root[2], nx, ny, nz, region, regionT, a);
      mix(out, out, tipLight, sstep(0.6, 1, t) * (dog ? 0.05 : 0.08) * (0.6 + 0.4 * hash01(kk, 3)));
      out.multiplyScalar(0.93 + 0.07 * t);   // a touch darker at the root: the coat's depth
      void x; void y; void z;
    };
    fur.push(tuft(root, dir, len * (0.85 + 0.3 * hash01(kk)), width, skin, 'tuft', tp, { droop, flat: 0.5, ...(tipSkin !== undefined ? { tipSkin } : {}) }));
  };
  // the ruff: two rings round the neck, layered back over the shoulders (the collie's lighter)
  const rk = ruff * (dog ? 0.8 : 1);
  for (const [z, y0, rr, skin, len] of [[0.47, 0.80, 0.135, [n1, n2, 0.3], 0.11], [0.37, 0.76, 0.16, [body, n1, 0.5], 0.13]] as const) {
    const n = 17;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI * 0.92 + (i / (n - 1)) * Math.PI * 1.84 + (hash01(i, z) - 0.5) * 0.15;   // round from one side over the top to the other
      const sx = Math.sin(a), cy = Math.cos(a);
      const root: V3 = [sx * rr * TW * rk * 0.8, y0 + cy * rr * 1.1 * rk * 0.8, z];
      add(root, [sx * 0.55, cy * 0.12 - 0.18, -1], len * rk * 0.85, 0.06 * rk, [skin[0], skin[1], skin[2]], cy < -0.3 ? 'neck' : 'neck', 0.3, 0.35);
    }
  }
  // throat bib
  for (let i = 0; i < 4; i++) add([(i - 1.5) * 0.03, 0.66, 0.43 - i * 0.015], [(i - 1.5) * 0.2, -1, -0.35], 0.09 * rk, 0.04, [n1, n1, 0], 'neck', 0.3, 0.2);
  // cheek fluff
  for (const sx of [1, -1]) for (let i = 0; i < 3; i++) add([sx * 0.08 * HW, 0.85 - i * 0.022, 0.64 - i * 0.012], [sx * 0.7, -0.35 - i * 0.2, -0.7], 0.06, 0.036, [hd, hd, 0], 'head', 0.45, 0.2);
  // trousers on the hind thighs + elbow feathers + belly fringe
  for (const sx of [1, -1]) {
    for (let i = 0; i < 3; i++) add([sx * 0.11, 0.6 - i * 0.07, -0.5 + i * 0.02], [sx * 0.25, -0.55, -0.85], 0.08, 0.05, [body, B(sx > 0 ? 'BL_hip' : 'BR_hip'), 0.7], 'body', 0.5, 0.3);
    add([sx * 0.1, 0.44, 0.31], [sx * 0.2, -0.4, -1], 0.05, 0.022, [B(sx > 0 ? 'FL_shoulder' : 'FR_shoulder'), B(sx > 0 ? 'FL_shoulder' : 'FR_shoulder'), 0], 'leg', 0.5, 0.3);
  }
  for (let i = 0; i < 5; i++) add([(i % 2 ? 0.05 : -0.05), 0.49, 0.15 - i * 0.08], [0, -0.6, -1], 0.045, 0.04, [body, B('belly'), 0.5], 'body', 0.5, 0.1);
  // the brush: tufts all round the tail, longest in the middle
  const tailPts: [number, number, number, number][] = [[0.66, -0.56, 0.35, 0], [0.61, -0.62, 0.5, 0.3], [0.54, -0.665, 0.6, 0.6], [0.46, -0.695, 0.55, 0.85], [0.38, -0.715, 0.4, 1]];
  tailPts.forEach(([y, z, sz, w], j) => {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + j * 0.7;
      const skin: Skin = [o.tl, o.t2, w];
      add([Math.cos(a) * 0.03, y + Math.sin(a) * 0.03, z], [Math.cos(a) * 0.8, Math.sin(a) * 0.5 - 0.6, -0.5], 0.06 + 0.05 * sz, 0.05, skin, 'tail', 0.3 + 0.15 * j, 0.3);
    }
  });
}

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

registerSpecies({
  kind: 'wolf',
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
      id: 'alpha', label: 'Greymane', weight: 0, rarity: 'rare', scale: [1.16, 1.16], hp: 110, tint: ALPHA_TINT,
      traits: { scar: 1, ruff: 1.25 }, mods: { chargeDamage: 18 },
    },
  ],
  build: buildCanid,
  postPose: canidPostPose,
  think: thinkWolf,
});
