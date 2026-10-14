import * as THREE from 'three';
import { smoothstep as sstep } from '@wildshard/engine/core/noise';
import type { Rng } from '@wildshard/engine/core/rng';
import { loft, tube, skinPlain, S, boneIndex, srgb, mix, paintNoise, setShag, isLowPoly, toonPaint, paletteColors, type Paint } from '@wildshard/engine/entities/species/loft';
import type { AnimalSpecies, BoneDef, VariantDef } from '@wildshard/engine/entities/species/registry';
import type { RGB } from '@wildshard/engine/level/data';

/**
 * Pine Hollow's deer and elk as procedural lofts, OFFLINE only (SHARD-PLATFORM, sp-o194; moved out of
 * src/game/systems/species/deer.ts and elk.ts): the page draws both on their Hunyuan3D-2 rigged hulls, which the factory
 * binds to the bones and dims of species/bodies.ts, so these lofts are the rigs' authoring input (the skeleton the hulls were
 * skinned to, the thralls' eye and fern spots: generators/thrallExtras.ts). test/pine-creature-bodies.test.ts keeps
 * species/bodies.ts equal to what these builds return.
 */

const DEER_PALETTE = {
  // autumn coat: ~#7a5a3c body, greyer neck/legs, cream belly + throat, pale rump patch with a dark tail stripe
  body: [0.40, 0.335, 0.265], bodyDark: [0.30, 0.25, 0.20], grey: [0.38, 0.34, 0.30], greyDark: [0.29, 0.255, 0.22],
  belly: [0.68, 0.62, 0.52], cream: [0.74, 0.68, 0.56], rump: [0.62, 0.57, 0.47],
  legDark: [0.30, 0.25, 0.20], nose: [0.06, 0.05, 0.05], muzzle: [0.28, 0.24, 0.21], eyeRing: [0.20, 0.16, 0.13], earIn: [0.62, 0.56, 0.48],
  antler: [0.40, 0.31, 0.22], antlerTip: [0.74, 0.68, 0.58], hoof: [0.10, 0.08, 0.07], eye: [0.02, 0.015, 0.01],
} satisfies Record<string, RGB>;


function deerPaint(v: VariantDef): Paint {
  const P = paletteColors(DEER_PALETTE, v.tint);
  const { body, bodyDark, grey, greyDark, belly, cream, rump, legDark, nose, muzzle, eyeRing, earIn, antler, antlerTip, hoof, eye } = P;
  const piebald = Boolean(v.traits?.['piebald']);
  const white = srgb(0.92, 0.90, 0.85);
  return (out, x, y, z, _nx, ny, nz, part, t, _a) => {
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
  const stag = Boolean(v.traits?.['antlers']);
  const antlerScale = Number(v.traits?.['antlerScale'] ?? 1);
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
  const toon = isLowPoly() ? toonPaint('deer') : null;   // a toon level: its own palette
  const paint = toon !== null ? toon(v) : deerPaint(v);
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
  const feetF: [number, number][] = [], feetB: [number, number][] = [];   // front / back, each L then R
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
    feetF.push([sx * 0.155, 0.49]);
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
    feetB.push([sx * 0.155, -0.59]);
  }
  // antlers: the rack is scaled about its root on the skull (antlerScale), radii a little less than length
  if (stag) {
    const k = antlerScale, rk = antlerScale ** 0.7;
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
  // feet in FL, FR, BL, BR order
  const feetOrdered: [number, number][] = [...feetF, ...feetB];
  return {
    bones, furParts: fur, hardParts: hard, eyeParts: eyes,
    dims: { bodyY: 0.92, bodyHalfLen: 0.72, bodyRadius: 0.33, headRadius: 0.17, legLen: 0.92, feet: feetOrdered, halfWidth: 0.27 },
  };
}

const ELK_PALETTE = {
  // pale tan barrel, dark chocolate neck + legs + belly, straw-cream rump patch, near-black mane
  body: [0.47, 0.37, 0.25], bodyDark: [0.35, 0.27, 0.18],
  neck: [0.19, 0.125, 0.08], mane: [0.11, 0.075, 0.05], belly: [0.26, 0.20, 0.14], rump: [0.82, 0.76, 0.62],
  legDark: [0.26, 0.19, 0.135], nose: [0.05, 0.04, 0.04], muzzle: [0.24, 0.19, 0.16], eyeRing: [0.16, 0.12, 0.10], earIn: [0.60, 0.53, 0.45],
  antler: [0.42, 0.32, 0.22], antlerTip: [0.80, 0.74, 0.62], hoof: [0.09, 0.075, 0.065], eye: [0.02, 0.015, 0.01],
} satisfies Record<string, RGB>;


function elkPaint(v: VariantDef): Paint {
  const P = paletteColors(ELK_PALETTE, v.tint);
  const { body, bodyDark, neck, mane, belly, rump, legDark, nose, muzzle, eyeRing, earIn, antler, antlerTip, hoof, eye } = P;
  return (out, x, y, z, _nx, ny, nz, part, t, _a) => {
    const n1 = paintNoise.fbm(x * 1.6 + 3, z * 1.6 + y * 1.1, 3);
    switch (part) {
      case 'body': {
        out.copy(body);
        mix(out, out, bodyDark, sstep(0.75, 0.95, ny) * sstep(0.18, 0.05, Math.abs(x)) * 0.7);          // dorsal stripe
        mix(out, out, neck, sstep(0.45, 0.95, z) * 0.85);                                            // the dark neck runs onto the shoulders
        mix(out, out, belly, sstep(-0.1, -0.7, ny) * 0.9);                                           // dark belly
        mix(out, out, legDark, sstep(-0.1, -0.7, ny) * sstep(0.3, 0.6, Math.abs(z)) * 0.5);
        const rd = Math.hypot(x * 1.1, (y - 1.58) * 1.3, (z + 1.14) * 1.25);
        mix(out, out, rump, sstep(0.42, 0.24, rd) * (ny > -0.4 ? 0.95 : 0.5));                       // cream rump patch
        mix(out, out, bodyDark, sstep(0.42, 0.24, rd) * sstep(0.07, 0.02, Math.abs(x)) * sstep(0.3, 0.8, ny) * 0.8); // dark line over the tail
        break;
      }
      case 'neck':
        out.copy(neck);
        mix(out, out, mane, sstep(0.5, 0.9, ny) * 0.7);                                              // darker along the crest
        mix(out, out, body, sstep(0.75, 1.0, t) * 0.3);                                              // paler toward the head
        mix(out, out, mane, sstep(-0.2, -0.8, ny) * 0.6);                                            // throat
        break;
      case 'crest':                                                                                  // the mane bib under the neck
        mix(out, mane, neck, 0.2 + 0.3 * n1);
        break;
      case 'head':
        mix(out, neck, body, 0.55);
        mix(out, out, bodyDark, sstep(0.4, 0.9, ny) * 0.4 * (1 - sstep(0.55, 0.8, t)));
        mix(out, out, muzzle, sstep(0.62, 0.88, t) * 0.8);
        mix(out, out, rump, sstep(-0.3, -0.8, ny) * sstep(0.35, 0.7, t) * 0.5);                      // pale chin
        mix(out, out, eyeRing, sstep(0.14, 0.05, Math.hypot(Math.abs(x) - 0.15, (y - 2.36) * 1.2, (z - 1.62) * 0.8)) * 0.9);
        mix(out, out, nose, sstep(0.9, 0.97, t));
        break;
      case 'ear':
        out.copy(bodyDark);
        mix(out, out, earIn, sstep(0.1, 0.6, nz) * 0.9);
        mix(out, out, nose, sstep(0.8, 1, t) * 0.5);
        break;
      case 'leg':
        mix(out, legDark, body, sstep(0.9, 1.35, y) * 0.5);                                          // dark legs, tan where they meet the barrel
        break;
      case 'tail':
        mix(out, rump, bodyDark, sstep(0.2, 0.9, t) * 0.6);
        break;
      case 'antler':
        mix(out, antler, antlerTip, sstep(0.45, 1, t) * 0.85 + 0.1 * n1);
        break;
      case 'hoof': out.copy(hoof); break;
      case 'eye': out.copy(eye); break;
      default: out.copy(body);
    }
    let m = 1 + 0.10 * n1;
    // baked occlusion: underside, between the legs, under the mane and where the legs meet the body
    if (part === 'body') m *= 1 - 0.35 * sstep(-0.2, -0.9, ny) - 0.25 * sstep(0.35, 0.08, Math.abs(Math.abs(z) - 0.65)) * sstep(1.4, 1.0, y);
    if (part === 'leg') m *= 1 - 0.3 * sstep(0.75, 1.3, y) - 0.2 * sstep(0.26, 0.16, Math.abs(x));
    if (part === 'neck' || part === 'crest') m *= 1 - 0.25 * sstep(-0.2, -0.8, ny);
    out.r *= m; out.g *= m; out.b *= m * 0.98;
  };
}

function buildElk(v: VariantDef, _rng: Rng): AnimalSpecies {
  const bull = Boolean(v.traits?.['antlers']);
  const antlerScale = Number(v.traits?.['antlerScale'] ?? 1);
  // the barrel + legs + tail are the deer's stations scaled up (1.6 wide, 1.63 tall, 1.25 long, radii 1.62);
  // the neck, mane, head, ears and antlers are their own — that is where an elk stops being a big deer
  const KX = 1.6, KY = 1.63, KZ = 1.25, KR = 1.62;
  const E = (x: number, y: number, z: number, rx: number, ry: number, b0: number, b1 = b0, w1 = 0, top = 1, bot = 1) => S(x * KX, y * KY, z * KZ, rx * KR, ry * KR, b0, b1, w1, top, bot);
  const bones: BoneDef[] = [
    { name: 'body', parent: null, pos: [0, 1.50, -0.06] },
    { name: 'neck1', parent: 'body', pos: [0, 1.66, 0.80] },
    { name: 'neck2', parent: 'neck1', pos: [0, 2.06, 1.16] },
    { name: 'head', parent: 'neck2', pos: [0, 2.28, 1.40] },
    { name: 'earL', parent: 'head', pos: [0.12, 2.43, 1.46] },
    { name: 'earR', parent: 'head', pos: [-0.12, 2.43, 1.46] },
    { name: 'tail', parent: 'body', pos: [0, 1.62, -1.12] },
    { name: 'belly', parent: 'body', pos: [0, 1.30, 0.0] },   // scaled for breathing
  ];
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    bones.push(
      { name: `F${side}_shoulder`, parent: 'body', pos: [sx * 0.24, 1.50, 0.56] },
      { name: `F${side}_carpus`, parent: `F${side}_shoulder`, pos: [sx * 0.24, 0.78, 0.56] },
      { name: `F${side}_fetlock`, parent: `F${side}_carpus`, pos: [sx * 0.24, 0.20, 0.56] },
      { name: `B${side}_hip`, parent: 'body', pos: [sx * 0.224, 1.52, -0.69] },
      { name: `B${side}_stifle`, parent: `B${side}_hip`, pos: [sx * 0.224, 0.95, -0.575] },
      { name: `B${side}_hock`, parent: `B${side}_stifle`, pos: [sx * 0.24, 0.65, -0.76] },
    );
  }
  const B = boneIndex(bones);
  const toon = isLowPoly() ? toonPaint('elk') : null;   // a toon level: its own palette
  const paint = toon !== null ? toon(v) : elkPaint(v);
  const fur: THREE.BufferGeometry[] = [], hard: THREE.BufferGeometry[] = [], eyes: THREE.BufferGeometry[] = [];
  const body = B('body'), n1 = B('neck1'), n2 = B('neck2'), hd = B('head'), bl = B('belly');

  // torso: deep barrel, a hump over the withers
  setShag(0.008);
  fur.push(loft([
    E(0, 0.99, -0.90, 0.02, 0.02, body),
    E(0, 0.985, -0.89, 0.12, 0.17, body),
    E(0, 0.975, -0.86, 0.19, 0.26, body, body, 0, 1.03, 1.0),
    E(0, 0.97, -0.79, 0.225, 0.29, body, body, 0, 1.06, 0.86),
    E(0, 0.965, -0.66, 0.245, 0.31, body, body, 0, 1.08, 0.86),
    E(0, 0.955, -0.52, 0.25, 0.32, body, bl, 0.3, 1.06, 0.9),
    E(0, 0.94, -0.25, 0.25, 0.33, body, bl, 0.7, 0.99, 1.0),
    E(0, 0.93, 0.05, 0.25, 0.345, body, bl, 0.7, 1.0, 1.08),
    E(0, 0.935, 0.32, 0.245, 0.35, body, bl, 0.35, 1.16, 1.1),
    E(0, 0.955, 0.52, 0.225, 0.34, body, n1, 0.25, 1.22, 1.02),   // withers hump
    E(0, 0.975, 0.70, 0.18, 0.28, body, n1, 0.4, 1.12, 0.9),
    E(0, 0.99, 0.82, 0.10, 0.16, body, n1, 0.5),
    E(0, 1.00, 0.86, 0.02, 0.03, body, n1, 0.5),
  ], 22, 'body', paint));
  // neck: thick, carried lower and more forward than the deer's
  setShag(0.014);
  fur.push(loft([
    S(0, 1.58, 0.68, 0.30, 0.40, body, n1, 0.2),
    S(0, 1.74, 0.88, 0.25, 0.35, body, n1, 0.7),
    S(0, 1.92, 1.04, 0.20, 0.29, n1, n2, 0.3),
    S(0, 2.08, 1.18, 0.165, 0.245, n1, n2, 0.8),
    S(0, 2.20, 1.28, 0.14, 0.20, n2, hd, 0.3),
    S(0, 2.29, 1.35, 0.125, 0.16, n2, hd, 0.8),
    S(0, 2.34, 1.39, 0.09, 0.12, hd),
  ], 16, 'neck', paint, false, true));
  // mane: a shaggy bib hanging under the neck (part 'crest' = the longest fur), skinned like the neck
  fur.push(loft([
    S(0, 1.50, 0.60, 0.24, 0.30, body, n1, 0.2, 0.6, 1.7),
    S(0, 1.62, 0.84, 0.23, 0.29, body, n1, 0.7, 0.6, 1.85),
    S(0, 1.80, 1.03, 0.19, 0.25, n1, n2, 0.3, 0.6, 1.75),
    S(0, 1.97, 1.18, 0.14, 0.19, n1, n2, 0.8, 0.6, 1.45),
    S(0, 2.10, 1.27, 0.08, 0.11, n2, hd, 0.3, 0.6, 1.1),
  ], 14, 'crest', paint, true, true));
  setShag(0.006);
  // head: long, deep-jawed, tapering to a broad dark nose
  fur.push(loft([
    S(0, 2.30, 1.34, 0.10, 0.115, hd),
    S(0, 2.36, 1.40, 0.155, 0.175, hd),
    S(0, 2.38, 1.52, 0.17, 0.19, hd, hd, 0, 1.0, 1.02),
    S(0, 2.36, 1.65, 0.165, 0.185, hd, hd, 0, 1.0, 1.1),
    S(0, 2.31, 1.78, 0.135, 0.155, hd, hd, 0, 1.0, 1.15),
    S(0, 2.24, 1.91, 0.105, 0.125, hd, hd, 0, 1.0, 1.15),
    S(0, 2.18, 2.02, 0.088, 0.10, hd, hd, 0, 1.0, 1.1),
    S(0, 2.14, 2.09, 0.072, 0.08, hd),
    S(0, 2.125, 2.125, 0.035, 0.037, hd),
  ], 18, 'head', paint));
  // ears: big, cupped
  for (const sx of [1, -1]) {
    const eb = B(sx > 0 ? 'earL' : 'earR');
    fur.push(loft([
      S(sx * 0.11, 2.42, 1.45, 0.038, 0.022, hd, eb, 0.3),
      S(sx * 0.18, 2.52, 1.42, 0.075, 0.024, eb),
      S(sx * 0.26, 2.63, 1.38, 0.088, 0.020, eb),
      S(sx * 0.34, 2.74, 1.33, 0.066, 0.016, eb),
      S(sx * 0.40, 2.83, 1.30, 0.025, 0.010, eb),
    ], 10, 'ear', paint, true, true, 'z'));
    const eye = isLowPoly() ? new THREE.SphereGeometry(0.036, 6, 4) : new THREE.SphereGeometry(0.034, 10, 8);
    eye.translate(sx * 0.15, 2.36, 1.62);
    eyes.push(skinPlain(eye, hd, 'eye', paint));
  }
  // tail: short pale tuft
  const tl = B('tail');
  fur.push(loft([
    S(0, 1.62, -1.10, 0.05, 0.05, body, tl, 0.3),
    S(0, 1.53, -1.19, 0.06, 0.055, tl),
    S(0, 1.42, -1.23, 0.045, 0.04, tl),
    S(0, 1.35, -1.24, 0.02, 0.016, tl),
  ], 8, 'tail', paint, false, true));
  setShag(0);
  // legs: long and heavy (the deer's, scaled)
  const feetF: [number, number][] = [], feetB: [number, number][] = [];   // front / back, each L then R
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    const sh = B(`F${side}_shoulder`), ca = B(`F${side}_carpus`), fe = B(`F${side}_fetlock`);
    fur.push(loft([
      E(sx * 0.13, 0.95, 0.44, 0.10, 0.17, body, sh, 0.3),
      E(sx * 0.15, 0.78, 0.45, 0.085, 0.14, body, sh, 0.8),
      E(sx * 0.155, 0.62, 0.45, 0.062, 0.095, sh),
      E(sx * 0.155, 0.52, 0.45, 0.045, 0.06, sh, ca, 0.5),
      E(sx * 0.155, 0.44, 0.45, 0.034, 0.047, ca),
      E(sx * 0.155, 0.28, 0.45, 0.028, 0.038, ca),
      E(sx * 0.155, 0.16, 0.45, 0.033, 0.044, ca, fe, 0.5),
      E(sx * 0.155, 0.10, 0.46, 0.034, 0.045, fe),
      E(sx * 0.155, 0.06, 0.475, 0.032, 0.04, fe),
    ], 12, 'leg', paint, false, true));
    hard.push(loft([
      E(sx * 0.155, 0.075, 0.475, 0.034, 0.042, fe),
      E(sx * 0.155, 0.04, 0.485, 0.04, 0.05, fe),
      E(sx * 0.155, 0.0, 0.49, 0.037, 0.047, fe),
      E(sx * 0.155, -0.003, 0.49, 0.01, 0.01, fe),
    ], 10, 'hoof', paint));
    feetF.push([sx * 0.155 * KX, 0.49 * KZ]);
    const hp = B(`B${side}_hip`), stf = B(`B${side}_stifle`), hk = B(`B${side}_hock`);
    fur.push(loft([
      E(sx * 0.12, 0.96, -0.60, 0.11, 0.21, body, hp, 0.3),
      E(sx * 0.14, 0.80, -0.54, 0.10, 0.18, body, hp, 0.8),
      E(sx * 0.15, 0.66, -0.49, 0.075, 0.12, hp),
      E(sx * 0.15, 0.58, -0.47, 0.058, 0.085, hp, stf, 0.5),
      E(sx * 0.155, 0.50, -0.53, 0.048, 0.068, stf),
      E(sx * 0.155, 0.43, -0.59, 0.04, 0.058, stf, hk, 0.5),
      E(sx * 0.155, 0.36, -0.615, 0.034, 0.047, hk),
      E(sx * 0.155, 0.20, -0.61, 0.028, 0.038, hk),
      E(sx * 0.155, 0.10, -0.605, 0.035, 0.045, hk),
      E(sx * 0.155, 0.06, -0.60, 0.032, 0.04, hk),
    ], 12, 'leg', paint, false, true));
    hard.push(loft([
      E(sx * 0.155, 0.075, -0.60, 0.034, 0.042, hk),
      E(sx * 0.155, 0.04, -0.595, 0.04, 0.05, hk),
      E(sx * 0.155, 0.0, -0.59, 0.037, 0.047, hk),
      E(sx * 0.155, -0.003, -0.59, 0.01, 0.01, hk),
    ], 10, 'hoof', paint));
    feetB.push([sx * 0.155 * KX, -0.59 * KZ]);
  }
  // antlers: a 6×6 rack — the main beam rises off the skull and sweeps BACK over the neck, the tines point
  // forward and up (brow, bez, trez, the long dagger, the fifth, and the beam tip). Scaled about its root.
  if (bull) {
    const k = antlerScale, rk = antlerScale ** 0.7;
    for (const sx of [1, -1]) {
      const root: [number, number, number] = [sx * 0.09, 2.52, 1.48];
      const A = (p: [number, number, number]): [number, number, number] => [root[0] + (p[0] - root[0]) * k, root[1] + (p[1] - root[1]) * k, root[2] + (p[2] - root[2]) * k];
      const beam: [number, number, number][] = [
        [sx * 0.09, 2.52, 1.48], [sx * 0.17, 2.74, 1.44], [sx * 0.27, 2.96, 1.31], [sx * 0.37, 3.14, 1.12],
        [sx * 0.46, 3.28, 0.88], [sx * 0.53, 3.36, 0.62], [sx * 0.56, 3.40, 0.38],
      ];
      hard.push(tube(beam.map(A), 0.07 * rk, 0.022 * rk, hd, 'antler', paint, 8));
      const tine = (from: [number, number, number], mid: [number, number, number], to: [number, number, number], r0 = 0.04) =>
        hard.push(tube([A(from), A(mid), A(to)], r0 * rk, 0.01 * rk, hd, 'antler', paint, 6));
      tine([sx * 0.11, 2.60, 1.47], [sx * 0.14, 2.74, 1.66], [sx * 0.17, 2.84, 1.86]);                 // brow
      tine([sx * 0.18, 2.76, 1.43], [sx * 0.22, 2.92, 1.60], [sx * 0.26, 3.06, 1.76]);                 // bez
      tine([sx * 0.28, 2.97, 1.30], [sx * 0.32, 3.14, 1.44], [sx * 0.37, 3.30, 1.56]);                 // trez
      tine([sx * 0.37, 3.14, 1.12], [sx * 0.40, 3.38, 1.22], [sx * 0.43, 3.62, 1.30], 0.044);          // dagger (4th) — the long one
      tine([sx * 0.46, 3.29, 0.86], [sx * 0.51, 3.50, 0.92], [sx * 0.56, 3.70, 0.98], 0.036);          // fifth
      if (k > 1.15) tine([sx * 0.53, 3.37, 0.58], [sx * 0.60, 3.52, 0.50], [sx * 0.68, 3.62, 0.40], 0.03); // royal / imperial: a 7th fork on the tip
    }
  }
  // feet in FL, FR, BL, BR order
  const feetOrdered: [number, number][] = [...feetF, ...feetB];
  return {
    bones, furParts: fur, hardParts: hard, eyeParts: eyes,
    dims: { bodyY: 1.50, bodyHalfLen: 0.95, bodyRadius: 0.52, headRadius: 0.26, legLen: 1.50, feet: feetOrdered, halfWidth: 0.42 },
  };
}

/** The deer's and the elk's procedural builds (a variant's traits pick the antlers). */
export const PINE_LOFTS = { deer: buildDeer, elk: buildElk } as const;
