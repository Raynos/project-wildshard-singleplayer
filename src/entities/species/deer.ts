import * as THREE from 'three';
import type { Rng } from '../../core/rng';
import { registerSpecies, type AnimalSpecies, type BoneDef, type VariantDef } from './registry';
import { loft, tube, skinPlain, S, boneIndex, srgb, mix, sstep, paintNoise, setShag, isLowPoly, type Paint } from './loft';
import { deerPaintLow } from '../lowpoly';

/**
 * Deer — red-deer proportions: 0.92 m at the spine, long neck, stags carry a 6-point rack.
 *
 * Variants (traits read by build): antlers (0/1), antlerScale, piebald (0/1 white patches).
 * Palette keys (VariantDef.tint): body bodyDark grey greyDark belly cream rump legDark nose muzzle eyeRing
 * earIn antler antlerTip hoof eye.
 */

const DEER_PALETTE: Record<string, [number, number, number]> = {
  // autumn coat: ~#7a5a3c body, greyer neck/legs, cream belly + throat, pale rump patch with a dark tail stripe
  body: [0.40, 0.335, 0.265], bodyDark: [0.30, 0.25, 0.20], grey: [0.38, 0.34, 0.30], greyDark: [0.29, 0.255, 0.22],
  belly: [0.68, 0.62, 0.52], cream: [0.74, 0.68, 0.56], rump: [0.62, 0.57, 0.47],
  legDark: [0.30, 0.25, 0.20], nose: [0.06, 0.05, 0.05], muzzle: [0.28, 0.24, 0.21], eyeRing: [0.20, 0.16, 0.13], earIn: [0.62, 0.56, 0.48],
  antler: [0.40, 0.31, 0.22], antlerTip: [0.74, 0.68, 0.58], hoof: [0.10, 0.08, 0.07], eye: [0.02, 0.015, 0.01],
};

/** pale cream coat, pink nose / ear linings, pale hooves and antlers (leucistic) */
const WHITE_TINT: Record<string, [number, number, number]> = {
  body: [0.86, 0.83, 0.76], bodyDark: [0.74, 0.71, 0.64], grey: [0.84, 0.82, 0.77], greyDark: [0.76, 0.74, 0.69],
  belly: [0.94, 0.92, 0.87], cream: [0.95, 0.93, 0.88], rump: [0.93, 0.91, 0.86],
  legDark: [0.74, 0.71, 0.65], nose: [0.62, 0.40, 0.42], muzzle: [0.82, 0.74, 0.72], eyeRing: [0.74, 0.66, 0.64], earIn: [0.88, 0.72, 0.72],
  antler: [0.70, 0.64, 0.56], antlerTip: [0.90, 0.88, 0.82], hoof: [0.42, 0.38, 0.34],
};

/** the Ghost stag: white with a cold blue cast; the glow is in the fur override */
const GHOST_TINT: Record<string, [number, number, number]> = {
  ...WHITE_TINT,
  body: [0.84, 0.88, 0.92], bodyDark: [0.70, 0.76, 0.82], grey: [0.82, 0.87, 0.92], greyDark: [0.72, 0.78, 0.84],
  belly: [0.94, 0.96, 0.98], cream: [0.95, 0.97, 0.99], rump: [0.93, 0.95, 0.98],
  legDark: [0.70, 0.76, 0.82], nose: [0.50, 0.44, 0.52], antler: [0.78, 0.82, 0.86], antlerTip: [0.96, 0.98, 1.0],
};

function deerPaint(v: VariantDef): Paint {
  const P: Record<string, THREE.Color> = {};
  for (const k of Object.keys(DEER_PALETTE)) { const c = v.tint?.[k] ?? DEER_PALETTE[k]; P[k] = srgb(c[0], c[1], c[2]); }
  const { body, bodyDark, grey, greyDark, belly, cream, rump, legDark, nose, muzzle, eyeRing, earIn, antler, antlerTip, hoof, eye } = P;
  const piebald = !!v.traits?.piebald;
  const white = srgb(0.92, 0.90, 0.85);
  return (out, x, y, z, nx, ny, nz, part, t, a) => {
    const n1 = paintNoise.fbm(x * 2.5 + 3, z * 2.5 + y * 1.7, 3);
    switch (part) {
      case 'body': {
        out.copy(body);
        mix(out, out, bodyDark, sstep(0.75, 0.95, ny) * sstep(0.12, 0.03, Math.abs(x)) * 0.8);          // dorsal stripe
        mix(out, out, grey, sstep(0.4, 0.75, z) * 0.5);                                              // greyer shoulders
        mix(out, out, belly, sstep(-0.15, -0.7, ny) * 0.9);                                          // cream belly
        const rd = Math.hypot(x * 1.2, (y - 0.98) * 1.3, (z + 0.9) * 0.9);
        mix(out, out, rump, sstep(0.30, 0.16, rd) * (ny > -0.4 ? 0.85 : 0.4));                       // pale rump patch
        mix(out, out, bodyDark, sstep(0.30, 0.16, rd) * sstep(0.05, 0.015, Math.abs(x)) * sstep(0.3, 0.8, ny)); // dark stripe over the tail
        break;
      }
      case 'neck':
        mix(out, grey, body, 0.35);
        mix(out, out, greyDark, sstep(0.6, 0.9, ny) * 0.5);
        mix(out, out, cream, sstep(-0.3, -0.85, ny) * 0.85);                                          // throat
        break;
      case 'head':
        mix(out, grey, body, 0.45);
        mix(out, out, greyDark, sstep(0.4, 0.9, ny) * 0.4 * (1 - sstep(0.55, 0.8, t)));
        mix(out, out, muzzle, sstep(0.62, 0.88, t) * 0.8);
        mix(out, out, cream, sstep(-0.3, -0.8, ny) * sstep(0.35, 0.7, t) * 0.8);                     // chin / lower jaw
        mix(out, out, eyeRing, sstep(0.09, 0.03, Math.hypot(Math.abs(x) - 0.098, (y - 1.735) * 1.2, (z - 1.215) * 0.8)) * 0.9);
        mix(out, out, nose, sstep(0.9, 0.97, t));
        break;
      case 'ear':
        out.copy(greyDark);
        mix(out, out, earIn, sstep(0.1, 0.6, nz) * 0.9);
        mix(out, out, nose, sstep(0.8, 1, t) * 0.6);
        break;
      case 'leg':
        mix(out, grey, legDark, sstep(0.62, 0.3, y));
        mix(out, out, body, 0.25);
        break;
      case 'tail':
        out.copy(bodyDark);
        mix(out, out, rump, sstep(-0.1, -0.7, ny) * 0.9 + sstep(0.5, 1, t) * 0.3);
        break;
      case 'antler':
        mix(out, antler, antlerTip, sstep(0.5, 1, t) * 0.85 + 0.1 * n1);
        break;
      case 'hoof': out.copy(hoof); break;
      case 'eye': out.copy(eye); break;
      default: out.copy(body);
    }
    // piebald: big soft-edged white patches over the body, neck and legs (never the nose / hooves)
    if (piebald && (part === 'body' || part === 'neck' || part === 'leg' || part === 'tail' || (part === 'head' && t < 0.6))) {
      const p = paintNoise.fbm(x * 1.4 + 40, z * 1.1 + y * 0.9 - 20, 3);
      mix(out, out, white, sstep(0.02, 0.14, p) * 0.95);
    }
    let m = 1 + 0.10 * n1;
    // baked occlusion: underside, between the legs and where the legs meet the body
    if (part === 'body') m *= 1 - 0.35 * sstep(-0.2, -0.9, ny) - 0.25 * sstep(0.25, 0.05, Math.abs(Math.abs(z) - 0.5)) * sstep(0.85, 0.6, y);
    if (part === 'leg') m *= 1 - 0.3 * sstep(0.45, 0.8, y) - 0.2 * sstep(0.16, 0.1, Math.abs(x));
    if (part === 'neck') m *= 1 - 0.2 * sstep(-0.2, -0.8, ny);
    out.r *= m; out.g *= m; out.b *= m * 0.98;
  };
}

function buildDeer(v: VariantDef, _rng: Rng): AnimalSpecies {
  const stag = !!v.traits?.antlers;
  const antlerScale = Number(v.traits?.antlerScale ?? 1);
  setShag(0.005);
  const bones: BoneDef[] = [
    { name: 'body', parent: null, pos: [0, 0.92, -0.05] },
    { name: 'neck1', parent: 'body', pos: [0, 1.04, 0.62] },
    { name: 'neck2', parent: 'neck1', pos: [0, 1.34, 0.86] },
    { name: 'head', parent: 'neck2', pos: [0, 1.68, 1.04] },
    { name: 'earL', parent: 'head', pos: [0.075, 1.79, 1.08] },
    { name: 'earR', parent: 'head', pos: [-0.075, 1.79, 1.08] },
    { name: 'tail', parent: 'body', pos: [0, 1.0, -0.9] },
    { name: 'belly', parent: 'body', pos: [0, 0.8, 0.0] },   // scaled for breathing
  ];
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    bones.push(
      { name: `F${side}_shoulder`, parent: 'body', pos: [sx * 0.15, 0.92, 0.45] },
      { name: `F${side}_carpus`, parent: `F${side}_shoulder`, pos: [sx * 0.15, 0.48, 0.45] },
      { name: `F${side}_fetlock`, parent: `F${side}_carpus`, pos: [sx * 0.15, 0.12, 0.45] },
      { name: `B${side}_hip`, parent: 'body', pos: [sx * 0.14, 0.93, -0.55] },
      { name: `B${side}_stifle`, parent: `B${side}_hip`, pos: [sx * 0.14, 0.58, -0.46] },
      { name: `B${side}_hock`, parent: `B${side}_stifle`, pos: [sx * 0.15, 0.40, -0.61] },
    );
  }
  const B = boneIndex(bones);
  const paint = isLowPoly() ? deerPaintLow(v) : deerPaint(v);   // Driftwood Isle: flat pastel palette (see ../lowpoly.ts)
  const fur: THREE.BufferGeometry[] = [], hard: THREE.BufferGeometry[] = [], eyes: THREE.BufferGeometry[] = [];
  const body = B('body'), n1 = B('neck1'), n2 = B('neck2'), hd = B('head'), bl = B('belly');

  // torso
  fur.push(loft([
    S(0, 0.99, -0.90, 0.02, 0.02, body),
    S(0, 0.985, -0.89, 0.12, 0.17, body),
    S(0, 0.975, -0.86, 0.19, 0.26, body, body, 0, 1.03, 1.0),
    S(0, 0.97, -0.79, 0.225, 0.29, body, body, 0, 1.06, 0.86),
    S(0, 0.965, -0.66, 0.245, 0.31, body, body, 0, 1.08, 0.86),
    S(0, 0.955, -0.52, 0.25, 0.32, body, bl, 0.3, 1.06, 0.9),
    S(0, 0.94, -0.25, 0.25, 0.33, body, bl, 0.7, 0.99, 1.0),
    S(0, 0.93, 0.05, 0.25, 0.345, body, bl, 0.7, 1.0, 1.08),
    S(0, 0.935, 0.32, 0.245, 0.35, body, bl, 0.35, 1.14, 1.1),
    S(0, 0.955, 0.52, 0.225, 0.34, body, n1, 0.25, 1.15, 1.02),
    S(0, 0.975, 0.70, 0.18, 0.28, body, n1, 0.4, 1.04, 0.9),
    S(0, 0.99, 0.82, 0.10, 0.16, body, n1, 0.5),
    S(0, 1.00, 0.86, 0.02, 0.03, body, n1, 0.5),
  ], 22, 'body', paint));
  // neck
  fur.push(loft([
    S(0, 0.98, 0.50, 0.18, 0.25, body, n1, 0.2),
    S(0, 1.10, 0.70, 0.145, 0.21, body, n1, 0.7),
    S(0, 1.26, 0.82, 0.115, 0.17, n1, n2, 0.3),
    S(0, 1.44, 0.93, 0.095, 0.145, n1, n2, 0.8),
    S(0, 1.58, 1.00, 0.085, 0.125, n2, hd, 0.3),
    S(0, 1.69, 1.04, 0.08, 0.105, n2, hd, 0.8),
    S(0, 1.745, 1.06, 0.06, 0.08, hd),
  ], 16, 'neck', paint, false, true));
  // head: broad skull, deep jaw, tapering muzzle, dark nose
  fur.push(loft([
    S(0, 1.71, 0.99, 0.065, 0.075, hd),
    S(0, 1.745, 1.03, 0.10, 0.115, hd),
    S(0, 1.76, 1.11, 0.112, 0.125, hd, hd, 0, 1.0, 1.02),
    S(0, 1.745, 1.21, 0.108, 0.12, hd, hd, 0, 1.0, 1.1),
    S(0, 1.71, 1.31, 0.088, 0.10, hd, hd, 0, 1.0, 1.15),
    S(0, 1.665, 1.41, 0.068, 0.08, hd, hd, 0, 1.0, 1.15),
    S(0, 1.625, 1.49, 0.056, 0.065, hd, hd, 0, 1.0, 1.1),
    S(0, 1.60, 1.545, 0.047, 0.052, hd),
    S(0, 1.588, 1.57, 0.022, 0.024, hd),
  ], 18, 'head', paint));
  // ears
  for (const sx of [1, -1]) {
    const eb = B(sx > 0 ? 'earL' : 'earR');
    fur.push(loft([
      S(sx * 0.07, 1.78, 1.07, 0.024, 0.014, hd, eb, 0.3),
      S(sx * 0.115, 1.85, 1.05, 0.048, 0.015, eb),
      S(sx * 0.165, 1.92, 1.02, 0.056, 0.013, eb),
      S(sx * 0.215, 1.99, 0.99, 0.042, 0.010, eb),
      S(sx * 0.25, 2.05, 0.97, 0.016, 0.006, eb),
    ], 10, 'ear', paint, true, true, 'z'));
    // eye
    const eye = isLowPoly() ? new THREE.SphereGeometry(0.024, 6, 4) : new THREE.SphereGeometry(0.022, 10, 8);
    eye.translate(sx * 0.098, 1.735, 1.215);
    eyes.push(skinPlain(eye, hd, 'eye', paint));
  }
  // tail
  const tl = B('tail');
  fur.push(loft([
    S(0, 1.00, -0.88, 0.035, 0.035, body, tl, 0.3),
    S(0, 0.93, -0.95, 0.045, 0.04, tl),
    S(0, 0.84, -0.98, 0.035, 0.03, tl),
    S(0, 0.79, -0.99, 0.015, 0.012, tl),
  ], 8, 'tail', paint, false, true));
  // legs
  const feet: [number, number][] = [];
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    const sh = B(`F${side}_shoulder`), ca = B(`F${side}_carpus`), fe = B(`F${side}_fetlock`);
    fur.push(loft([
      S(sx * 0.13, 0.95, 0.44, 0.10, 0.17, body, sh, 0.3),
      S(sx * 0.15, 0.78, 0.45, 0.085, 0.14, body, sh, 0.8),
      S(sx * 0.155, 0.62, 0.45, 0.062, 0.095, sh),
      S(sx * 0.155, 0.52, 0.45, 0.045, 0.06, sh, ca, 0.5),
      S(sx * 0.155, 0.44, 0.45, 0.034, 0.047, ca),
      S(sx * 0.155, 0.28, 0.45, 0.028, 0.038, ca),
      S(sx * 0.155, 0.16, 0.45, 0.033, 0.044, ca, fe, 0.5),
      S(sx * 0.155, 0.10, 0.46, 0.034, 0.045, fe),
      S(sx * 0.155, 0.06, 0.475, 0.032, 0.04, fe),
    ], 12, 'leg', paint, false, true));
    hard.push(loft([
      S(sx * 0.155, 0.075, 0.475, 0.034, 0.042, fe),
      S(sx * 0.155, 0.04, 0.485, 0.04, 0.05, fe),
      S(sx * 0.155, 0.0, 0.49, 0.037, 0.047, fe),
      S(sx * 0.155, -0.005, 0.49, 0.01, 0.01, fe),
    ], 10, 'hoof', paint));
    feet.push([sx * 0.155, 0.49]);
    const hp = B(`B${side}_hip`), stf = B(`B${side}_stifle`), hk = B(`B${side}_hock`);
    fur.push(loft([
      S(sx * 0.12, 0.96, -0.60, 0.11, 0.21, body, hp, 0.3),
      S(sx * 0.14, 0.80, -0.54, 0.10, 0.18, body, hp, 0.8),
      S(sx * 0.15, 0.66, -0.49, 0.075, 0.12, hp),
      S(sx * 0.15, 0.58, -0.47, 0.058, 0.085, hp, stf, 0.5),
      S(sx * 0.155, 0.50, -0.53, 0.048, 0.068, stf),
      S(sx * 0.155, 0.43, -0.59, 0.04, 0.058, stf, hk, 0.5),
      S(sx * 0.155, 0.36, -0.615, 0.034, 0.047, hk),
      S(sx * 0.155, 0.20, -0.61, 0.028, 0.038, hk),
      S(sx * 0.155, 0.10, -0.605, 0.035, 0.045, hk),
      S(sx * 0.155, 0.06, -0.60, 0.032, 0.04, hk),
    ], 12, 'leg', paint, false, true));
    hard.push(loft([
      S(sx * 0.155, 0.075, -0.60, 0.034, 0.042, hk),
      S(sx * 0.155, 0.04, -0.595, 0.04, 0.05, hk),
      S(sx * 0.155, 0.0, -0.59, 0.037, 0.047, hk),
      S(sx * 0.155, -0.005, -0.59, 0.01, 0.01, hk),
    ], 10, 'hoof', paint));
    feet.push([sx * 0.155, -0.59]);
  }
  // antlers: the rack is scaled about its root on the skull (antlerScale), radii a little less than length
  if (stag) {
    const k = antlerScale, rk = Math.pow(antlerScale, 0.7);
    for (const sx of [1, -1]) {
      const root: [number, number, number] = [sx * 0.055, 1.81, 1.08];
      const A = (p: [number, number, number]): [number, number, number] => [root[0] + (p[0] - root[0]) * k, root[1] + (p[1] - root[1]) * k, root[2] + (p[2] - root[2]) * k];
      const beam: [number, number, number][] = [[sx * 0.055, 1.81, 1.08], [sx * 0.09, 1.95, 1.03], [sx * 0.15, 2.10, 0.98], [sx * 0.21, 2.28, 0.99], [sx * 0.25, 2.44, 1.04], [sx * 0.27, 2.56, 1.10]];
      hard.push(tube(beam.map(A), 0.046 * rk, 0.015 * rk, hd, 'antler', paint));
      const tine = (from: [number, number, number], to: [number, number, number], mid: [number, number, number], r0 = 0.026) => hard.push(tube([A(from), A(mid), A(to)], r0 * rk, 0.007 * rk, hd, 'antler', paint, 6));
      tine([sx * 0.07, 1.88, 1.04], [sx * 0.11, 2.02, 1.27], [sx * 0.09, 1.97, 1.16]);           // brow
      tine([sx * 0.13, 2.05, 0.99], [sx * 0.16, 2.24, 1.20], [sx * 0.145, 2.16, 1.10]);         // bez
      tine([sx * 0.20, 2.25, 0.99], [sx * 0.34, 2.36, 1.14], [sx * 0.27, 2.32, 1.06]);          // trez
      tine([sx * 0.25, 2.46, 1.05], [sx * 0.20, 2.66, 1.18], [sx * 0.23, 2.57, 1.11], 0.02);   // crown fwd
      tine([sx * 0.26, 2.50, 1.07], [sx * 0.40, 2.66, 1.02], [sx * 0.33, 2.59, 1.05], 0.02);   // crown out
      if (k > 1.15) tine([sx * 0.235, 2.38, 1.02], [sx * 0.12, 2.52, 0.92], [sx * 0.18, 2.46, 0.97], 0.018); // extra rear tine on big racks
    }
  }
  setShag(0);
  // sort feet in FL, FR, BL, BR order (loop pushed FL, BL, FR, BR)
  const feetOrdered: [number, number][] = [feet[0], feet[2], feet[1], feet[3]];
  return {
    bones, furParts: fur, hardParts: hard, eyeParts: eyes,
    dims: { bodyY: 0.92, bodyHalfLen: 0.72, bodyRadius: 0.33, headRadius: 0.17, legLen: 0.92, feet: feetOrdered, halfWidth: 0.27 },
  };
}

registerSpecies({
  kind: 'deer',
  label: 'Deer',
  fur: {
    texSeed: 101, tex: { contrast: 0.8, grizzle: 0.15, normalStrength: 1.6, bristle: 0, strandLen: 24, root: 0.14 },
    roughness: 0.82, sheen: 0.3, sheenColor: [0.45, 0.36, 0.26], envMapIntensity: 0.6, rim: [1.0, 0.72, 0.42], shellLen: 0.05, shag: 0.005,
  },
  aggressive: false,
  walkSpeed: 1.3,
  sounds: { call: 'deer_call', hurt: 'deer_call' },
  pose: { grazeNeck: 1, gallopTail: 1 },
  // weights sum to 96: hind 48 % · stag 31 % · white 8.3 % · big stag 8.3 % · piebald 3.1 % · ghost 1.0 %
  variants: [
    { id: 'hind', label: 'Hind', weight: 46, rarity: 'common', scale: [0.9, 1.05] },
    { id: 'stag', label: 'Stag', weight: 30, rarity: 'common', scale: [1.0, 1.1], traits: { antlers: 1 } },
    { id: 'white-hind', label: 'White hind', weight: 4, rarity: 'uncommon', scale: [0.9, 1.05], tint: WHITE_TINT },
    { id: 'white-stag', label: 'White stag', weight: 4, rarity: 'uncommon', scale: [1.0, 1.1], tint: WHITE_TINT, traits: { antlers: 1 } },
    { id: 'big-stag', label: 'Great stag', weight: 8, rarity: 'uncommon', scale: [1.2, 1.3], hp: 90, traits: { antlers: 1, antlerScale: 1.25 } },
    { id: 'piebald', label: 'Piebald hind', weight: 3, rarity: 'rare', scale: [0.95, 1.1], traits: { piebald: 1 } },
    {
      id: 'ghost', label: 'Ghost stag', weight: 1, rarity: 'legendary', scale: [1.35, 1.35], hp: 130,
      tint: GHOST_TINT, traits: { antlers: 1, antlerScale: 1.35 },
      // pale-cyan backlit rim + a faint self-glow so it reads at dusk; flees faster than anything you can sprint after
      fur: { rim: [0.55, 0.92, 1.0], emissive: [0.30, 0.62, 0.75], emissiveIntensity: 0.16, sheenColor: [0.6, 0.8, 0.9] },
      mods: { speed: 1.25 },
    },
  ],
  build: buildDeer,
});
