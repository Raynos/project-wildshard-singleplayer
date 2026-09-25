import * as THREE from 'three';
import type { Rng } from '../../core/rng';
import { registerSpecies, type AnimalSpecies, type BoneDef, type VariantDef, type RigAnimCtx } from './registry';
import { loft, skinPlain, S, boneIndex, mix, sstep, paletteColors, paintNoise, type Paint, type RGB, type Station } from './loft';
import { NO_FUR, bump, clamp } from './rigs';
import { eliteThink, eliteDamageMul } from '../eliteBrain';

/**
 * Snow leopard (Nalati named elite E1 — Aqbars the Pale, Irbis of the Crags; row B12; mockup
 * art/nalati-grasslands/round-2/4-named-elites/elite-1-aqbars-snow-leopard.jpg). Pale smoky fur with dark open rosettes, a
 * cream belly, a huge thick tail, ice-blue eyes, a muzzle scar. 0.6 m at the shoulder at scale 1 (Aqbars is ×1.5).
 *
 * The QUADRUPED rig (Animal.ts poses the gait: the canid's bone names), feline proportions: long low body, short
 * round head, small round ears, heavy forepaws, the tail as long as the body. `postPose` adds, from `animal.mem`:
 *   mem.low     the stalking crouch (belly to the rock)       mem.snarl  lips back, ears flat
 *   mem.leap    0..1 airborne (the POUNCE: forelegs reach, hind legs trail, tail streaming)
 *   attackPhase (Animal.startAttack) a swipe: the right forepaw rakes (0.3–0.6), the left follows (0.6–0.9)
 * The AI is the elite's (src/nalati/elites.ts). No think here: the species is not placed by any herd.
 */

export const LEOPARD = 'leopard';

const PAL = {
  base: [0.8, 0.79, 0.75], smoke: [0.62, 0.62, 0.6], belly: [0.93, 0.92, 0.88], rosette: [0.15, 0.15, 0.16], nose: [0.36, 0.26, 0.27],
  eye: [0.62, 0.86, 0.98], pupil: [0.03, 0.03, 0.04], mouth: [0.4, 0.12, 0.12], scar: [0.86, 0.6, 0.58], claw: [0.9, 0.88, 0.82],
} satisfies Record<string, RGB>;

const fract = (x: number) => x - Math.floor(x);
const h2 = (a: number, b: number) => fract(Math.sin(a * 127.1 + b * 311.7) * 43758.5453);
/** distance to the nearest jittered cell centre (a cheap Worley field) → the rosettes */
function worley(u: number, v: number): number {
  const iu = Math.floor(u), iv = Math.floor(v);
  let best = 9;
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
    const cu = iu + a + 0.2 + 0.6 * h2(iu + a, iv + b), cv = iv + b + 0.2 + 0.6 * h2(iv + b + 17, iu + a + 3);
    best = Math.min(best, Math.hypot(u - cu, v - cv));
  }
  return best;
}

/** densify a station list (`n` per segment, bone weights blended): the rosettes are painted per VERTEX, a coarse loft
 *  would alias them away (the King's armour has the same helper) */
function dense(st: Station[], n: number): Station[] {
  const out: Station[] = [];
  const weights = (q: Station): Map<number, number> => { const m = new Map<number, number>(); m.set(q.b0, (m.get(q.b0) ?? 0) + 1 - q.w1); m.set(q.b1, (m.get(q.b1) ?? 0) + q.w1); return m; };
  for (let i = 0; i < st.length - 1; i++) {
    const a = st[i], b = st[i + 1];
    if (a === undefined || b === undefined) continue;
    const wa = weights(a), wb = weights(b);
    for (let k = 0; k < n; k++) {
      const t = k / n, L = THREE.MathUtils.lerp, w = new Map<number, number>();
      for (const [bone, v] of wa) w.set(bone, (w.get(bone) ?? 0) + v * (1 - t));
      for (const [bone, v] of wb) w.set(bone, (w.get(bone) ?? 0) + v * t);
      const top2 = [...w.entries()].sort((x, y) => y[1] - x[1]);
      const [b0, v0] = top2[0] ?? [a.b0, 1], [b1, v1] = top2[1] ?? [b0, 0];
      out.push({ x: L(a.x, b.x, t), y: L(a.y, b.y, t), z: L(a.z, b.z, t), rx: L(a.rx, b.rx, t), ry: L(a.ry, b.ry, t), top: L(a.top, b.top, t), bot: L(a.bot, b.bot, t), b0, b1, w1: v1 / Math.max(1e-6, v0 + v1) });
    }
  }
  const last = st[st.length - 1];
  if (last) out.push(last);
  return out;
}

function felidPaint(v: VariantDef): Paint {
  const P = paletteColors(PAL, v.tint);
  const eyeHdr = P.eye.clone().multiplyScalar(2.2);
  return (out, x, y, z, _nx, ny, nz, part, t) => {
    switch (part) {
      case 'body': case 'neck': case 'leg': case 'tail': case 'head': {
        mix(out, P.base, P.smoke, 0.5 + 0.5 * paintNoise.fbm(x * 5 + z * 2, y * 5, 2));
        mix(out, out, P.belly, sstep(-0.2, -0.7, ny) * (part === 'tail' ? 0.4 : 1));
        // open rosettes on the body and legs, solid spots on the head and lower legs, rings on the tail
        const sc = part === 'head' ? 15 : part === 'tail' ? 7 : 7.5;
        const d = worley(z * sc + x * 3, y * sc + x * sc * 0.6);
        let dark = part === 'head' || (part === 'leg' && y < 0.25) ? sstep(0.32, 0.2, d) : sstep(0.18, 0.26, d) * sstep(0.46, 0.36, d);
        if (part === 'tail') dark = Math.max(dark, sstep(0.72, 0.8, fract(t * 9)) * 0.9);
        mix(out, out, P.rosette, dark * (ny < -0.6 ? 0.3 : 0.9));
        if (part === 'head' && nz > 0.6 && y < 0.63) mix(out, out, P.belly, 0.5);
        if (part === 'tail' && t > 0.93) mix(out, out, P.rosette, 0.8);   // the dark tip
        break;
      }
      case 'ear': mix(out, P.rosette, P.base, sstep(0.2, 0.9, t) * 0.6); break;
      case 'nose': out.copy(P.nose); break;
      case 'mouth': out.copy(P.mouth); break;
      case 'eye': out.copy(eyeHdr); break;
      case 'pupil': out.copy(P.pupil); break;
      case 'scar': out.copy(P.scar); break;
      case 'claw': out.copy(P.claw); break;
      default: out.copy(P.base);
    }
  };
}

function buildFelid(v: VariantDef, _rng: Rng): AnimalSpecies {
  const bones: BoneDef[] = [
    { name: 'body', parent: null, pos: [0, 0.5, -0.05] },
    { name: 'neck1', parent: 'body', pos: [0, 0.55, 0.32] },
    { name: 'neck2', parent: 'neck1', pos: [0, 0.6, 0.42] },
    { name: 'head', parent: 'neck2', pos: [0, 0.64, 0.52] },
    { name: 'jaw', parent: 'head', pos: [0, 0.6, 0.57] },
    { name: 'earL', parent: 'head', pos: [0.055, 0.71, 0.53] },
    { name: 'earR', parent: 'head', pos: [-0.055, 0.71, 0.53] },
    { name: 'tail', parent: 'body', pos: [0, 0.54, -0.55] },
    { name: 'tail2', parent: 'tail', pos: [0, 0.34, -0.9] },
    { name: 'belly', parent: 'body', pos: [0, 0.42, 0.0] },
  ];
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    bones.push(
      { name: `F${side}_shoulder`, parent: 'body', pos: [sx * 0.1, 0.47, 0.28] },
      { name: `F${side}_carpus`, parent: `F${side}_shoulder`, pos: [sx * 0.1, 0.19, 0.31] },
      { name: `F${side}_fetlock`, parent: `F${side}_carpus`, pos: [sx * 0.1, 0.06, 0.32] },
      { name: `B${side}_hip`, parent: 'body', pos: [sx * 0.1, 0.51, -0.42] },
      { name: `B${side}_stifle`, parent: `B${side}_hip`, pos: [sx * 0.11, 0.32, -0.33] },
      { name: `B${side}_hock`, parent: `B${side}_stifle`, pos: [sx * 0.11, 0.17, -0.5] },
    );
  }
  const B = boneIndex(bones);
  const paint = felidPaint(v);
  const fur: THREE.BufferGeometry[] = [], hard: THREE.BufferGeometry[] = [], eyes: THREE.BufferGeometry[] = [];
  const body = B('body'), n1 = B('neck1'), n2 = B('neck2'), hd = B('head'), jw = B('jaw'), bl = B('belly'), tl = B('tail'), t2 = B('tail2');
  // a long, low, thick-furred body: deep chest, the belly skin hanging a little behind
  fur.push(loft(dense([
    S(0, 0.52, -0.6, 0.03, 0.03, body),
    S(0, 0.52, -0.56, 0.1, 0.11, body),
    S(0, 0.5, -0.46, 0.15, 0.16, body),
    S(0, 0.49, -0.3, 0.15, 0.16, body, bl, 0.3, 1, 1.1),
    S(0, 0.49, -0.1, 0.155, 0.17, body, bl, 0.5, 1, 1.12),
    S(0, 0.5, 0.1, 0.16, 0.18, body, bl, 0.3, 1, 1.05),
    S(0, 0.52, 0.24, 0.16, 0.18, body, n1, 0.2),
    S(0, 0.54, 0.33, 0.13, 0.15, body, n1, 0.5),
    S(0, 0.56, 0.4, 0.04, 0.05, n1),
  ], 3), 36, 'body', paint));
  fur.push(loft(dense([
    S(0, 0.53, 0.28, 0.13, 0.15, body, n1, 0.3), S(0, 0.57, 0.38, 0.11, 0.12, n1), S(0, 0.61, 0.46, 0.085, 0.095, n1, n2, 0.6),
    S(0, 0.64, 0.51, 0.07, 0.075, n2, hd, 0.6), S(0, 0.65, 0.53, 0.03, 0.03, hd),
  ], 3), 28, 'neck', paint, false, true));
  // the head: a round skull, broad cheeks, a short muzzle
  fur.push(loft(dense([
    S(0, 0.64, 0.48, 0.06, 0.06, hd), S(0, 0.66, 0.51, 0.09, 0.085, hd), S(0, 0.66, 0.56, 0.095, 0.08, hd),
    S(0, 0.645, 0.6, 0.075, 0.065, hd, hd, 0, 1, 0.85), S(0, 0.632, 0.635, 0.05, 0.045, hd, hd, 0, 1, 0.7),
    S(0, 0.628, 0.655, 0.03, 0.028, hd), S(0, 0.627, 0.66, 0.008, 0.008, hd),
  ], 2), 24, 'head', paint));
  fur.push(loft([S(0, 0.61, 0.57, 0.045, 0.02, hd, jw, 0.6), S(0, 0.605, 0.61, 0.035, 0.016, jw), S(0, 0.607, 0.64, 0.02, 0.01, jw), S(0, 0.608, 0.648, 0.005, 0.005, jw)], 10, 'head', paint));
  hard.push(skinPlain(new THREE.SphereGeometry(0.009, 8, 6).scale(1.4, 0.7, 0.8).translate(0, 0.638, 0.658), hd, 'nose', paint));
  hard.push(skinPlain(new THREE.BoxGeometry(0.006, 0.05, 0.004).rotateZ(0.5).translate(0.03, 0.655, 0.642), hd, 'scar', paint));
  for (const sx of [1, -1]) {
    const eb = B(sx > 0 ? 'earL' : 'earR');
    fur.push(loft([S(sx * 0.05, 0.7, 0.525, 0.03, 0.012, hd, eb, 0.4), S(sx * 0.058, 0.725, 0.528, 0.028, 0.01, eb), S(sx * 0.062, 0.745, 0.53, 0.01, 0.006, eb)], 8, 'ear', paint, true, true, 'z'));
    eyes.push(skinPlain(new THREE.SphereGeometry(0.013, 10, 8).scale(1, 0.75, 0.8).translate(sx * 0.038, 0.668, 0.6), hd, 'eye', paint));
    eyes.push(skinPlain(new THREE.SphereGeometry(0.006, 6, 5).scale(0.5, 1, 1).translate(sx * 0.039, 0.668, 0.609), hd, 'pupil', paint));
  }
  // the tail: as long as the body and as thick as a forearm, curling up at the tip
  fur.push(loft(dense([
    S(0, 0.53, -0.56, 0.05, 0.05, body, tl, 0.5), S(0, 0.5, -0.64, 0.058, 0.058, tl), S(0, 0.44, -0.74, 0.062, 0.062, tl),
    S(0, 0.37, -0.86, 0.064, 0.064, tl, t2, 0.5), S(0, 0.31, -1.0, 0.066, 0.066, t2), S(0, 0.29, -1.14, 0.066, 0.066, t2),
    S(0, 0.32, -1.27, 0.062, 0.062, t2), S(0, 0.4, -1.35, 0.05, 0.05, t2), S(0, 0.46, -1.36, 0.02, 0.02, t2),
  ], 3), 18, 'tail', paint, false, true));
  // legs: heavy forearms and big round paws
  const feetF: [number, number][] = [], feetB: [number, number][] = [];
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    const sh = B(`F${side}_shoulder`), ca = B(`F${side}_carpus`), fe = B(`F${side}_fetlock`);
    fur.push(loft(dense([
      S(sx * 0.085, 0.53, 0.27, 0.07, 0.11, body, sh, 0.3), S(sx * 0.1, 0.4, 0.29, 0.06, 0.075, body, sh, 0.8),
      S(sx * 0.1, 0.28, 0.3, 0.05, 0.055, sh), S(sx * 0.1, 0.19, 0.31, 0.043, 0.047, sh, ca, 0.5), S(sx * 0.1, 0.1, 0.315, 0.04, 0.043, ca),
      S(sx * 0.1, 0.06, 0.32, 0.045, 0.045, ca, fe, 0.6),
    ], 2), 16, 'leg', paint, false, true));
    fur.push(loft([S(sx * 0.1, 0.05, 0.29, 0.05, 0.035, fe), S(sx * 0.1, 0.04, 0.34, 0.058, 0.04, fe), S(sx * 0.1, 0.028, 0.38, 0.05, 0.028, fe), S(sx * 0.1, 0.02, 0.4, 0.02, 0.012, fe)], 12, 'leg', paint));
    for (let c = -1; c <= 1; c++) hard.push(skinPlain(new THREE.ConeGeometry(0.006, 0.03, 5).rotateX(Math.PI / 2 + 0.5).translate(sx * 0.1 + c * 0.018, 0.018, 0.405), fe, 'claw', paint));
    feetF.push([sx * 0.1, 0.34]);
    const hp = B(`B${side}_hip`), stf = B(`B${side}_stifle`), hk = B(`B${side}_hock`);
    fur.push(loft(dense([
      S(sx * 0.08, 0.55, -0.42, 0.08, 0.13, body, hp, 0.3), S(sx * 0.1, 0.42, -0.38, 0.07, 0.1, body, hp, 0.8),
      S(sx * 0.11, 0.32, -0.34, 0.05, 0.06, hp, stf, 0.5), S(sx * 0.11, 0.24, -0.43, 0.04, 0.045, stf), S(sx * 0.11, 0.17, -0.5, 0.035, 0.04, stf, hk, 0.5),
      S(sx * 0.11, 0.1, -0.49, 0.035, 0.038, hk), S(sx * 0.11, 0.05, -0.47, 0.04, 0.04, hk),
    ], 2), 16, 'leg', paint, false, true));
    fur.push(loft([S(sx * 0.11, 0.045, -0.5, 0.045, 0.032, hk), S(sx * 0.11, 0.035, -0.45, 0.05, 0.035, hk), S(sx * 0.11, 0.025, -0.41, 0.042, 0.025, hk), S(sx * 0.11, 0.02, -0.395, 0.015, 0.01, hk)], 12, 'leg', paint));
    feetB.push([sx * 0.11, -0.45]);
  }
  return {
    bones, furParts: fur, hardParts: hard, eyeParts: eyes,
    dims: { bodyY: 0.5, bodyHalfLen: 0.48, bodyRadius: 0.17, headRadius: 0.1, legLen: 0.47, feet: [...feetF, ...feetB], halfWidth: 0.16 },
  };
}

const _e = new THREE.Euler();

/** the cat's own motion on top of the quadruped gait: the crouch, the leap, the swipe, the long tail */
function felidPostPose(c: RigAnimCtx): void {
  const b = c.bones;
  const body = b['body'], n1 = b['neck1'], head = b['head'], jaw = b['jaw'], t1 = b['tail'], t2 = b['tail2'];
  if (body === undefined || n1 === undefined || head === undefined || jaw === undefined || t1 === undefined || t2 === undefined) return;
  const m = c.mem;
  if (!c.alive) return;
  const low = clamp(m['low'] ?? 0, 0, 1), snarl = clamp(m['snarl'] ?? 0, 0, 1), leap = clamp(m['leap'] ?? 0, 0, 1);
  const a = c.attack;
  const rake = a >= 0 ? bump(a, 0.25, 0.65) : 0, rake2 = a >= 0 ? bump(a, 0.55, 0.95) : 0;
  body.position.y += -0.14 * low - 0.04 * snarl;
  body.rotation.x += 0.04 * low - 0.18 * leap - 0.08 * Math.max(rake, rake2);
  n1.rotation.x += 0.3 * low - 0.1 * leap;
  head.rotation.x += -0.25 * low + 0.15 * leap;
  for (const s of ['L', 'R'] as const) {
    const sh = b[`F${s}_shoulder`], ca = b[`F${s}_carpus`], hp = b[`B${s}_hip`], stf = b[`B${s}_stifle`];
    const r = s === 'R' ? rake : rake2;
    if (sh !== undefined) { sh.rotation.x -= 1.1 * leap + 1.3 * r; sh.rotation.z += (s === 'L' ? 1 : -1) * 0.35 * r; }
    if (ca !== undefined) ca.rotation.x += 0.4 * low - 0.3 * leap + 0.6 * r;
    if (hp !== undefined) hp.rotation.x += 0.45 * low + 0.7 * leap;
    if (stf !== undefined) stf.rotation.x -= 0.35 * low + 0.3 * leap;
  }
  jaw.rotation.x = Math.max(0.3 * snarl, 0.4 * Math.max(rake, rake2), 0.25 * leap);
  const eL = b['earL'], eR = b['earR'], flat = Math.max(snarl, leap) * 0.9;
  if (eL !== undefined) eL.rotation.x += flat; if (eR !== undefined) eR.rotation.x += flat;
  // the tail: low and twitching at the tip when stalking, streaming straight back in the leap, a slow S-swing otherwise
  const tw = Math.sin(c.t * (low > 0.3 ? 7 : 1.1) + c.seed * 4);
  t1.rotation.x += -0.25 * low + 0.5 * leap;
  _e.set(0.45 * leap - 0.15 + 0.1 * Math.sin(c.t * 0.9 + c.seed), 0, 0.3 * tw * (0.3 + 0.7 * (1 - leap)));
  t2.rotation.copy(_e);
}

registerSpecies({
  kind: LEOPARD,
  label: 'Snow leopard',
  fur: NO_FUR,
  aggressive: true,
  walkSpeed: 1.4,
  chargeSpeed: 11,
  chargeDamage: 14,
  sounds: { call: 'leopard_growl', hurt: 'leopard_growl', callEvery: [40, 90] }, // its own voice, not Pine Hollow's bear (NALATI-MERGE F6)
  pose: { grazeNeck: 0.3, gallopTail: 0.2 },
  gait: { trot: 2.2, gallop: 6 },
  variants: [
    { id: 'aqbars', label: 'Aqbars the Pale', weight: 1, rarity: 'legendary', scale: [1.5, 1.5], hp: 700 },
  ],
  build: buildFelid,
  postPose: felidPostPose,
  think: eliteThink,
  damageMul: eliteDamageMul,
});
