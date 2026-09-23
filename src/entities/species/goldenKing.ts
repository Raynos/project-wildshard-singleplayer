import * as THREE from 'three';
import type { Rng } from '../../core/rng';
import { registerSpecies, type AnimalSpecies, type BoneDef, type VariantDef, type RigAnimCtx, type ThinkCtx } from './registry';
import { loft, skinPlain, S, boneIndex, mix, sstep, paletteColors, paintNoise, type Paint, type RGB, type Station } from './loft';
import type { Animal } from '../Animal';
import { NO_FUR, lookAngles, smooth01, bump, step, clamp } from './rigs';
import { heightAt } from '../../world/Heightfield';

/**
 * The Golden King — Nalati's first boss (docs/design/nalati/elites-and-bosses.md §2, plan row B13; mockups
 * art/nalati-grasslands/round-2/5-bosses/boss-1…4, round-1/3-enemies/enemy-5-kurgan-king.png). A Saka king risen in the great
 * kurgan: gold scale armour over a withered body, a tall pointed red-felt headdress hung with gold plaques (the Issyk
 * "Golden Man"), a red cloak with a gold hem, a golden akinakes (the short sword) in the right hand, eyes of gold fire.
 * Humanoid custom rig like the drowned sailor (sailor.ts): body · spine · chest · head · crown · cape · per side arm
 * sh / el / hand and leg hip / knee / foot. The `crown` and `cape` bones exist so the fight can take them off: a bone
 * scaled to ~0 collapses its skin (phase III tears off the cloak; shooting the headdress off drops it).
 *
 * This file is the BODY only: the rig, the paint and the poses. The brain lives with the fight
 * (`src/nalati/kurganBoss.ts` sets `goldenKingBrain.think`), because the King's AI is the boss script — phases, the
 * shield, the adds and the hazards all read the arena. The species' `think` just forwards to it.
 *
 * `Animal.mem` (numbers only) is the contract between the brain and the poses:
 *   floorY   absolute world y of the floor he stands on (the chamber is not on the terrain: yOffset follows it)
 *   lift     extra metres over the floor (lying in the coffin / standing in it)
 *   pose     0 lying in the coffin · 1 standing · 2 dead (crumbling)
 *   rise     0..1 lying → sitting → standing (advanced by the brain; eased here)
 *   kneel    0..1 target: down on one knee (the phase II shield, a stun, the headdress shot off)
 *   act      what the attack timer (`animal.startAttack`) is: 1 akinakes strike · 2 sunburst · 3 roar (phase change) · 4 tear the cloak
 *   strike   which strike of the combo (0..3): the cut alternates forehand / backhand, the last is the wide one
 *   cape / crown   1 worn, 0 gone
 *   raise    0..1 the sword held high (the sunburst's charge, the phase II kneel)
 */

export const GOLDEN_KING = 'golden-king';

const PALETTE = {
  // darker than it reads: the chamber is unlit-baked, the King takes the full painterly sun — gold comes from the contrast
  gold: [0.66, 0.45, 0.13], goldDark: [0.24, 0.13, 0.04], goldHi: [0.92, 0.74, 0.34],
  red: [0.46, 0.07, 0.05], redDark: [0.2, 0.03, 0.03], felt: [0.42, 0.06, 0.04],
  skin: [0.29, 0.19, 0.11], skinDark: [0.13, 0.08, 0.05], leather: [0.20, 0.12, 0.07],
  eye: [1.0, 0.82, 0.32], blade: [1.0, 0.86, 0.46],
} satisfies Record<string, RGB>;

type Side = 'L' | 'R';
type KingBones = Record<'body' | 'spine' | 'chest' | 'head' | 'crown' | 'cape' | `arm${Side}_${'sh' | 'el' | 'hand'}` | `leg${Side}_${'hip' | 'knee' | 'foot'}`, THREE.Bone>;
interface KingMem extends Record<string, number | undefined> {
  init?: number; floorY?: number; lift?: number; pose?: number; rise?: number; kneel?: number; act?: number; strike?: number;
  cape?: number; crown?: number; raise?: number; kneelS?: number; raiseS?: number; floorS?: number; deadT?: number;
}

/** the fight script's brain (src/nalati/kurganBoss.ts) — the species forwards its 10 Hz tick and its damage rule here
 *  (the gold scale takes half from arrows, the face full, a shield nothing; the script knows which) */
export const goldenKingBrain: {
  think: ((a: Animal, c: ThinkCtx) => void) | null;
  damageMul: ((a: Animal, hitPoint: THREE.Vector3, dir: THREE.Vector3) => number) | null;
} = { think: null, damageMul: null };

const fract = (x: number) => x - Math.floor(x);
const hash = (a: number, b: number) => fract(Math.sin(a * 127.1 + b * 311.7) * 43758.5453);

/** densify a station list (`n` stations per segment, weights blended per bone): the scale armour is painted per VERTEX,
 *  so a coarse loft would alias the plaques away — a plaque needs ~3 rings and ~3 ring sides */
function dense(st: Station[], n: number): Station[] {
  const out: Station[] = [];
  const weights = (s: Station): Map<number, number> => { const m = new Map<number, number>(); m.set(s.b0, (m.get(s.b0) ?? 0) + 1 - s.w1); m.set(s.b1, (m.get(s.b1) ?? 0) + s.w1); return m; };
  for (let i = 0; i < st.length - 1; i++) {
    const a = st[i], b = st[i + 1];
    if (a === undefined || b === undefined) continue;
    const wa = weights(a), wb = weights(b);
    for (let k = 0; k < n; k++) {
      const t = k / n, L = THREE.MathUtils.lerp;
      const w = new Map<number, number>();
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

function kingPaint(v: VariantDef): Paint {
  const P = paletteColors(PALETTE, v.tint);
  const eyeHdr = P.eye.clone().multiplyScalar(5);
  const bladeHdr = P.blade.clone().multiplyScalar(1.6);
  // gold scale plaques: rows `rows` per metre, `cols` round the ring; each plaque darker at its lower edge, lit on top
  const scales = (out: THREE.Color, y: number, a: number, ny: number, rows: number, cols: number) => {
    const row = Math.floor(y * rows);
    const colF = a / (Math.PI * 2) * cols + (row % 2) * 0.5;
    const fy = fract(y * rows), fx = fract(colF);
    const h = hash(row, Math.floor(colF));
    // a rounded plaque: bright in its middle, a dark gap under it and between it and its neighbours (reads at 20 m)
    const edge = sstep(0.0, 0.3, fy) * sstep(0.0, 0.16, 0.5 - Math.abs(fx - 0.5));
    mix(out, P.goldDark, P.gold, 0.1 + 0.9 * edge);
    mix(out, out, P.goldHi, sstep(0.45, 0.95, fy) * 0.5 * edge + sstep(0.2, 0.95, ny) * 0.25);
    if (h < 0.08) mix(out, out, P.skinDark, 0.75);            // a plaque lost: the leather under it
    else if (h < 0.25) mix(out, out, P.goldDark, 0.35);       // tarnished
  };
  return (out, x, y, z, nx, ny, nz, part, t, a) => {
    switch (part) {
      case 'scale': scales(out, y, a, ny, 15, 15); break;
      case 'skirt': scales(out, y, a, ny, 11, 18); break;
      case 'sleeve': scales(out, y + a * 0.02, a, ny, 17, 9); break;
      case 'trouser': mix(out, P.redDark, P.leather, 0.4 + 0.3 * Math.sin(a * 3 + y * 9)); break;
      case 'belt': {
        out.copy(P.red);
        const plaque = fract(a / (Math.PI * 2) * 9);
        if (plaque > 0.18 && plaque < 0.82) mix(out, P.gold, P.goldHi, sstep(0.3, 0.9, ny + 0.5) * 0.5);
        break;
      }
      case 'cape': {
        // red felt: darker inside (facing the body) and in the folds, a gold-embroidered hem
        const fold = 0.5 + 0.5 * Math.sin(a * 7 + y * 3);
        mix(out, P.red, P.redDark, 0.25 + 0.35 * fold + 0.3 * sstep(0.0, 0.8, nz));
        if (t > 0.9) mix(out, out, P.gold, sstep(0.9, 0.95, t));
        break;
      }
      case 'crown': {
        // the pointed felt hat: red felt with gold bands and stamped plaques (horses, arrows) round it
        out.copy(P.felt);
        const band = fract(t * 4.2);
        if (band < 0.1) mix(out, P.gold, P.goldHi, 0.4);
        const plaque = fract(a / (Math.PI * 2) * 8 + 0.25);
        if (band > 0.35 && band < 0.8 && plaque > 0.3 && plaque < 0.7) mix(out, P.gold, P.goldHi, sstep(0.4, 0.8, band) * 0.5);
        if (t < 0.12) mix(out, P.gold, P.goldDark, 0.25);
        break;
      }
      case 'gold': mix(out, P.gold, P.goldHi, sstep(-0.2, 0.9, ny) * 0.6); mix(out, out, P.goldDark, sstep(0.3, -0.8, ny) * 0.5); break;
      case 'goldHi': mix(out, P.goldHi, P.gold, 0.2); break;
      case 'face': {
        // a withered face: leather-dark, sunken cheeks and sockets, gold dust in the creases
        mix(out, P.skin, P.skinDark, sstep(0.4, -0.6, ny) * 0.6 + sstep(0.5, 0.0, nz) * 0.3);
        mix(out, out, P.gold, paintNoise.fbm(x * 40, y * 40, 2) > 0.35 ? 0.35 : 0);
        break;
      }
      case 'skin': mix(out, P.skin, P.skinDark, 0.3 + 0.3 * Math.sin(y * 20 + a)); break;
      case 'leather': mix(out, P.leather, P.skinDark, sstep(0.3, 0.0, y) * 0.4); break;
      case 'blade': mix(out, bladeHdr, P.goldHi, sstep(0.2, 0.9, Math.abs(nx)) * 0.4); void z; break;
      case 'eye': out.copy(eyeHdr); break;
      default: out.copy(P.gold);
    }
  };
}

function buildKing(v: VariantDef, rng: Rng): AnimalSpecies {
  const bones: BoneDef[] = [
    { name: 'body', parent: null, pos: [0, 0.95, 0] },
    { name: 'spine', parent: 'body', pos: [0, 1.12, 0] },
    { name: 'chest', parent: 'spine', pos: [0, 1.34, 0] },
    { name: 'head', parent: 'chest', pos: [0, 1.58, 0.02] },
    { name: 'crown', parent: 'head', pos: [0, 1.74, 0.0] },
    { name: 'cape', parent: 'chest', pos: [0, 1.47, -0.14] },
  ];
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    bones.push(
      { name: `arm${side}_sh`, parent: 'chest', pos: [sx * 0.24, 1.46, 0] },
      { name: `arm${side}_el`, parent: `arm${side}_sh`, pos: [sx * 0.28, 1.19, 0.02] },
      { name: `arm${side}_hand`, parent: `arm${side}_el`, pos: [sx * 0.30, 0.95, 0.06] },
      { name: `leg${side}_hip`, parent: 'body', pos: [sx * 0.11, 0.92, 0] },
      { name: `leg${side}_knee`, parent: `leg${side}_hip`, pos: [sx * 0.12, 0.50, 0.01] },
      { name: `leg${side}_foot`, parent: `leg${side}_knee`, pos: [sx * 0.12, 0.08, 0.02] },
    );
  }
  const B = boneIndex(bones);
  const paint = kingPaint(v);
  const fur: THREE.BufferGeometry[] = [], hard: THREE.BufferGeometry[] = [], eyes: THREE.BufferGeometry[] = [];
  const body = B('body'), spine = B('spine'), chest = B('chest'), head = B('head'), crown = B('crown'), cape = B('cape');

  // ── the armoured torso: scale coat from the hips to the shoulders, a broad chest ──
  fur.push(loft(dense([
    S(0, 0.90, 0.0, 0.19, 0.15, body),
    S(0, 1.00, 0.0, 0.195, 0.15, body, spine, 0.3),
    S(0, 1.12, 0.005, 0.205, 0.155, spine),
    S(0, 1.26, 0.012, 0.26, 0.18, spine, chest, 0.7),
    S(0, 1.38, 0.01, 0.27, 0.175, chest),
    S(0, 1.47, 0.0, 0.215, 0.14, chest),
    S(0, 1.53, -0.005, 0.12, 0.09, chest),
  ], 5), 44, 'scale', paint, true, true));
  // the scale skirt: flares from the belt to above the knee (the legs move under it)
  fur.push(loft(dense([
    S(0, 0.98, 0.0, 0.2, 0.155, body),
    S(0, 0.82, 0.0, 0.245, 0.2, body),
    S(0, 0.62, 0.0, 0.29, 0.24, body),
    S(0, 0.5, 0.0, 0.31, 0.255, body),
  ], 6), 54, 'skirt', paint, false, false));
  // the belt: red leather hung with gold horse plaques
  hard.push(loft([S(0, 0.93, 0.0, 0.212, 0.165, body), S(0, 0.975, 0.0, 0.214, 0.167, body), S(0, 1.02, 0.0, 0.208, 0.162, body, spine, 0.3)], 22, 'belt', paint, false, false));
  // a gold pectoral collar
  hard.push(loft([S(0, 1.44, 0.01, 0.235, 0.155, chest), S(0, 1.49, 0.015, 0.19, 0.13, chest), S(0, 1.53, 0.012, 0.11, 0.085, chest)], 20, 'gold', paint, false, true));
  // the neck and the head: withered, a gaunt long face under gold cheek guards
  fur.push(loft([S(0, 1.49, 0.0, 0.06, 0.06, chest), S(0, 1.58, 0.012, 0.055, 0.055, chest, head, 0.7)], 10, 'skin', paint, false, false));
  fur.push(loft([
    S(0, 1.56, 0.07, 0.05, 0.035, head),
    S(0, 1.585, 0.05, 0.085, 0.07, head),
    S(0, 1.63, 0.0, 0.105, 0.105, head),
    S(0, 1.68, -0.02, 0.105, 0.1, head),
    S(0, 1.73, -0.03, 0.08, 0.075, head),
  ], 16, 'face', paint, true, true));
  // the face: a long nose ridge, brows, the jaw (withered — the eyes sit in deep sockets)
  hard.push(loft([S(0, 1.67, 0.105, 0.012, 0.01, head), S(0, 1.64, 0.125, 0.016, 0.014, head), S(0, 1.615, 0.118, 0.012, 0.012, head)], 8, 'face', paint, true, true));
  for (const sx of [1, -1]) {
    hard.push(skinPlain(new THREE.SphereGeometry(0.028, 8, 6).scale(1.3, 0.55, 0.8).translate(sx * 0.042, 1.672, 0.088), head, 'face', paint));
    const eye = new THREE.SphereGeometry(0.018, 8, 6);
    eye.translate(sx * 0.04, 1.652, 0.092);
    eyes.push(skinPlain(eye, head, 'eye', paint));
    // gold cheek guards hanging from the headdress rim
    hard.push(skinPlain(new THREE.BoxGeometry(0.018, 0.12, 0.09).translate(sx * 0.105, 1.63, 0.02), head, 'gold', paint));
  }
  // ── the headdress: a tall pointed felt cap on a gold diadem, gold fins (arrows / wings) round it, a spike on top ──
  hard.push(loft([S(0, 1.70, -0.02, 0.118, 0.118, head), S(0, 1.745, -0.022, 0.12, 0.12, head)], 18, 'goldHi', paint, false, false));
  hard.push(loft([
    S(0, 1.72, -0.02, 0.112, 0.112, crown),
    S(0, 1.86, -0.03, 0.098, 0.098, crown),
    S(0, 2.06, -0.04, 0.072, 0.072, crown),
    S(0, 2.28, -0.05, 0.042, 0.042, crown),
    S(0, 2.48, -0.055, 0.016, 0.016, crown),
    S(0, 2.56, -0.056, 0.004, 0.004, crown),
  ], 16, 'crown', paint, true, true));
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2 + 0.2, y0 = 1.8 + (i % 2) * 0.16, len = 0.26 - (i % 2) * 0.06;
    const r = 0.1 - (i % 2) * 0.012;
    const fin = new THREE.BoxGeometry(0.012, len, 0.05);
    fin.translate(0, len / 2, 0);
    fin.rotateZ(-0.18);
    fin.rotateY(ang + Math.PI / 2);
    fin.translate(Math.sin(ang) * r, y0, -0.03 + Math.cos(ang) * r);
    hard.push(skinPlain(fin, crown, 'goldHi', paint));
  }
  // a gold ibex / bird finial at the tip
  hard.push(skinPlain(new THREE.ConeGeometry(0.02, 0.14, 6).translate(0, 2.62, -0.056), crown, 'goldHi', paint));
  // ── the cloak: hangs from the shoulders down the back to the calves (all on the `cape` bone — it can be torn off) ──
  fur.push(loft([
    S(0, 1.5, -0.06, 0.3, 0.1, cape),
    S(0, 1.32, -0.17, 0.36, 0.11, cape),
    S(0, 0.95, -0.25, 0.4, 0.11, cape),
    S(0, 0.55, -0.3, 0.44, 0.1, cape),
    S(0, 0.2, -0.33, 0.47, 0.08, cape),
  ], 18, 'cape', paint, true, true));
  // ── arms: gold scale sleeves over the upper arm, withered forearms in gold bracers, dark hands ──
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    const sh = B(`arm${side}_sh`), el = B(`arm${side}_el`), hand = B(`arm${side}_hand`);
    // the pauldron: a gold dome over the shoulder
    hard.push(skinPlain(new THREE.SphereGeometry(0.1, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55).scale(1.1, 0.8, 1.05).translate(sx * 0.25, 1.47, 0), sh, 'sleeve', paint));
    fur.push(loft(dense([
      S(sx * 0.245, 1.47, 0, 0.068, 0.064, chest, sh, 0.6), S(sx * 0.26, 1.36, 0.005, 0.062, 0.058, sh),
      S(sx * 0.275, 1.23, 0.018, 0.052, 0.05, sh, el, 0.4),
    ], 5), 27, 'sleeve', paint, true, false));
    fur.push(loft([
      S(sx * 0.278, 1.22, 0.02, 0.042, 0.04, sh, el, 0.6), S(sx * 0.29, 1.08, 0.04, 0.038, 0.036, el),
      S(sx * 0.3, 0.97, 0.058, 0.03, 0.03, el, hand, 0.6),
    ], 10, 'skin', paint, false, false));
    hard.push(loft([S(sx * 0.288, 1.12, 0.035, 0.047, 0.045, el), S(sx * 0.296, 1.03, 0.048, 0.043, 0.041, el)], 12, 'gold', paint, false, false));
    hard.push(loft([S(sx * 0.3, 0.975, 0.06, 0.035, 0.03, hand), S(sx * 0.305, 0.92, 0.07, 0.04, 0.028, hand), S(sx * 0.305, 0.86, 0.08, 0.02, 0.014, hand)], 8, 'skin', paint, false, true));
    // legs: dark red leather trousers under the skirt, gold scale greaves over the shins, leather boots
    const hip = B(`leg${side}_hip`), knee = B(`leg${side}_knee`), foot = B(`leg${side}_foot`);
    fur.push(loft([
      S(sx * 0.11, 0.9, 0.0, 0.08, 0.08, body, hip, 0.5), S(sx * 0.115, 0.72, 0.005, 0.072, 0.07, hip),
      S(sx * 0.12, 0.52, 0.012, 0.058, 0.058, hip, knee, 0.5),
    ], 12, 'trouser', paint, true, false));
    fur.push(loft(dense([
      S(sx * 0.12, 0.5, 0.014, 0.062, 0.062, hip, knee, 0.6), S(sx * 0.12, 0.34, 0.018, 0.058, 0.056, knee),
      S(sx * 0.12, 0.16, 0.02, 0.05, 0.05, knee, foot, 0.5),
    ], 5), 27, 'sleeve', paint, false, false));
    hard.push(skinPlain(new THREE.SphereGeometry(0.062, 8, 6).translate(sx * 0.12, 0.52, 0.03), knee, 'gold', paint));
    hard.push(loft([S(sx * 0.12, 0.2, 0.015, 0.05, 0.05, knee, foot, 0.6), S(sx * 0.12, 0.07, -0.02, 0.055, 0.05, foot), S(sx * 0.12, 0.045, 0.1, 0.05, 0.035, foot), S(sx * 0.12, 0.035, 0.18, 0.028, 0.018, foot)], 10, 'leather', paint, true, true));
  }
  // ── the akinakes in the right hand: a leather grip, the heart-shaped gold guard, a leaf blade pointing forward ──
  {
    const hand = B('armR_hand'), x = -0.305;
    hard.push(loft([S(x, 0.955, 0.03, 0.02, 0.02, hand), S(x, 0.9, 0.035, 0.022, 0.022, hand), S(x, 0.84, 0.04, 0.03, 0.03, hand)], 8, 'leather', paint, true, true));
    hard.push(loft([S(x, 0.905, 0.075, 0.075, 0.03, hand), S(x, 0.905, 0.1, 0.07, 0.028, hand), S(x, 0.905, 0.12, 0.025, 0.02, hand)], 10, 'goldHi', paint, true, true));
    hard.push(loft([
      S(x, 0.905, 0.12, 0.034, 0.008, hand), S(x, 0.905, 0.3, 0.042, 0.009, hand), S(x, 0.905, 0.48, 0.036, 0.008, hand),
      S(x, 0.905, 0.62, 0.018, 0.005, hand), S(x, 0.905, 0.7, 0.002, 0.002, hand),
    ], 8, 'blade', paint, true, true, 'z'));
  }
  void rng; void spine;
  return {
    bones, furParts: fur, hardParts: hard, eyeParts: eyes,
    dims: { bodyY: 0.95, bodyHalfLen: 0.5, bodyRadius: 0.3, headRadius: 0.16, legLen: 0.87, feet: [[0.12, 0.05], [-0.12, 0.05], [0.12, -0.05], [-0.12, -0.05]], halfWidth: 0.3, capsuleAxis: 'y' },
  };
}

// ── animation ────────────────────────────────────────────────────────────────────────────

const R = (b: THREE.Bone, x: number, y: number, z: number) => b.rotation.set(x, y, z);
const L = THREE.MathUtils.lerp;

function animateKing(c: RigAnimCtx): void {
  const b = c.bones as KingBones, t = c.t, m = c.mem as KingMem, a = c.animal, dt = c.dt;
  // ── where he stands: the chamber floor (not the terrain) + the coffin lift ──
  // the floor under him, smoothed (the brain samples it at 10 Hz: plinth, sand drifts, fallen beams); dead, he crumbles
  // into the floor over a second and a half (the fight hides him and shows the heap of plaques)
  const lift = m.lift ?? 0;
  m.floorS = (m.floorS ?? m.floorY ?? 0) + ((m.floorY ?? 0) - (m.floorS ?? m.floorY ?? 0)) * Math.min(1, dt * 8);
  if (!c.alive) m.deadT = (m.deadT ?? 0) + dt;
  const sink = Math.max(0, (m.deadT ?? 0) - 0.9) * 0.9;
  a.yOffset = (m.floorS ?? 0) - heightAt(a.position.x, a.position.z) + lift - sink;
  const up = smooth01(m.pose === 0 ? m.rise ?? 0 : 1);        // 0 lying … 1 standing
  const sit = step(up, 0, 0.55), stand = step(up, 0.45, 1);
  m.kneelS = (m.kneelS ?? 0) + ((m.kneel ?? 0) - (m.kneelS ?? 0)) * Math.min(1, dt * 5);
  m.raiseS = (m.raiseS ?? 0) + ((m.raise ?? 0) - (m.raiseS ?? 0)) * Math.min(1, dt * 6);
  const kneel = smooth01(m.kneelS), raise = smooth01(m.raiseS);
  const dead = c.deathT >= 0 ? smooth01(c.deathT) : 0;
  const moving = clamp(c.speed / 1.2, 0, 1);
  const ph = c.phase * Math.PI * 2;
  const look = lookAngles(c, 1.65, 1.0, 0.5);
  const breathe = Math.sin(t * 1.3 + c.seed * 5);
  const atk = c.attack, act = m.act ?? 0;
  // cloak / headdress: a bone scaled to nothing collapses its skin
  const capeS = Math.max(0.001, m.cape ?? 1), crownS = Math.max(0.001, m.crown ?? 1);
  b.cape.scale.setScalar(capeS); b.crown.scale.setScalar(crownS);
  // ── the root: lying on his back in the coffin → sitting up → standing; kneeling drops the hips ──
  const lie = 1 - sit;
  const kneelDrop = 0.36 * kneel + 0.5 * step(dead, 0, 0.5);
  b.body.position.set(0, c.dims.bodyY - 0.55 * lie - 0.18 * (1 - stand) * sit - kneelDrop + 0.01 * breathe * (1 - moving), -0.35 * lie);
  let bodyP = -1.52 * lie + 0.08 * moving + 0.12 * kneel + 1.2 * step(dead, 0.45, 1);
  let spineY = 0, headP = -0.05 + 0.25 * c.flinch;
  let armRx = 0.1, armRz = -0.18, elR = -0.45;
  const spineP = 0.02 + 0.1 * kneel, handR = 0.25;
  let armLx = 0.15, armLz = 0.2, elL = -0.35;
  // ── the akinakes combo: a glinting wind-up, then the cut; the fourth (phase III) and the third are the wide ones ──
  if (act === 1 && atk >= 0) {
    const wide = (m.strike ?? 0) >= 2;
    const back = (m.strike ?? 0) % 2 === 1;
    const wind = step(atk, 0, 0.55), cut = step(atk, 0.55, 0.75), rec = step(atk, 0.82, 1);
    const k = (1 - rec);
    if (!back) {
      armRx = L(L(0.1, -2.3, wind), 0.9, cut) * k + 0.1 * rec;
      armRz = L(L(-0.18, -1.1, wind), wide ? 0.9 : 0.35, cut) * k - 0.18 * rec;
      elR = L(L(-0.45, -1.1, wind), -0.1, cut) * k - 0.45 * rec;
      spineY = L(L(0, 0.55, wind), wide ? -0.8 : -0.45, cut) * k;
    } else {
      armRx = L(L(0.1, -1.4, wind), 0.5, cut) * k + 0.1 * rec;
      armRz = L(L(-0.18, 0.7, wind), -1.2, cut) * k - 0.18 * rec;
      elR = L(L(-0.45, -1.3, wind), -0.2, cut) * k - 0.45 * rec;
      spineY = L(L(0, -0.5, wind), 0.55, cut) * k;
    }
    bodyP += L(L(0, -0.12, wind), 0.3, cut) * k;
    armLz += 0.4 * wind * k; armLx -= 0.3 * cut * k;
  }
  // ── the sunburst: the sword up over the head (gold spirals into it), then driven down into the floor ──
  if (act === 2 && atk >= 0) {
    const lift2 = step(atk, 0, 0.3), hold = atk < 0.72 ? 1 : 0, slam = step(atk, 0.72, 0.82), rec = step(atk, 0.88, 1);
    armRx = L(L(0.1, -2.9, lift2), 0.6, slam) * (1 - rec) + 0.1 * rec;
    armRz = L(-0.18, -0.25, lift2) * (1 - rec) - 0.18 * rec;
    elR = L(L(-0.45, -0.15, lift2), -0.5, slam) * (1 - rec) - 0.45 * rec;
    armLx = L(L(0.15, -2.4, lift2), 0.4, slam) * (1 - rec) + 0.15 * rec; armLz = L(0.2, 0.5, lift2) * (1 - rec) + 0.2 * rec;
    bodyP += (-0.2 * lift2 * hold + 0.55 * slam) * (1 - rec);
    headP += (-0.35 * lift2 * hold + 0.3 * slam) * (1 - rec);
    b.body.position.y -= 0.2 * slam * (1 - rec);
  }
  // ── the roar (a phase change) / tearing the cloak off: arms flung wide, head back ──
  if ((act === 3 || act === 4) && atk >= 0) {
    const k = bump(atk, 0, 1);
    armRx = L(armRx, act === 4 ? -2.2 : -0.6, k); armRz = L(armRz, -1.3, k);
    armLx = L(armLx, act === 4 ? -1.2 : -0.6, k); armLz = L(armLz, 1.3, k);
    headP -= 0.5 * k; bodyP -= 0.2 * k;
  }
  // ── the phase II kneel: the sword raised in both hands before him (the dome) ──
  if (raise > 0.01) {
    armRx = L(armRx, -1.35, raise); armRz = L(armRz, 0.35, raise); elR = L(elR, -0.9, raise);
    armLx = L(armLx, -1.3, raise); armLz = L(armLz, -0.3, raise); elL = L(elL, -1.0, raise);
    headP = L(headP, -0.2, raise);
  }
  // sitting up in the coffin: arms braced on the rim, then free
  if (lie > 0.02 || stand < 0.98) {
    const sitArms = sit * (1 - stand);
    armRx = L(armRx, 0.6, sitArms); armLx = L(armLx, 0.6, sitArms); armRz = L(armRz, -0.5, sitArms); armLz = L(armLz, 0.5, sitArms);
    armRx = L(armRx, 0.1, lie); armLx = L(armLx, 0.1, lie); armRz = L(armRz, -0.15, lie); armLz = L(armLz, 0.15, lie);
    headP += 0.4 * lie * (1 - sit);
  }
  R(b.body, bodyP, 0, 0.03 * Math.sin(ph) * moving);
  R(b.spine, spineP + 0.02 * breathe, spineY + look.yaw * 0.3, 0);
  R(b.chest, 0.02, look.yaw * 0.25, 0);
  R(b.head, headP - look.pitch * 0.6, look.yaw * 0.45, 0.04 * Math.sin(t * 0.7));
  // the cloak sways with the stride and hangs back from the shoulders
  R(b.cape, 0.08 + 0.12 * moving + 0.05 * Math.sin(t * 1.1 + ph) - 0.3 * lie, 0.06 * Math.sin(ph), 0.03 * Math.sin(t * 0.8));
  const armSw = Math.sin(ph) * 0.3 * moving;
  R(b.armR_sh, armRx + armSw * 0.4 + 0.8 * dead, 0, armRz);
  R(b.armR_el, elR, 0, -0.1);
  R(b.armR_hand, handR, 0, 0);
  R(b.armL_sh, armLx - armSw + 0.8 * dead, 0, armLz);
  R(b.armL_el, elL, 0, 0.1);
  R(b.armL_hand, 0.1, 0, 0);
  // ── legs: a heavy, regal stride; lying they stretch out along the coffin; kneeling the right knee goes down ──
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    const lsw = Math.sin(ph + (sx > 0 ? 0 : Math.PI));
    const hip = b[`leg${side}_hip`], knee = b[`leg${side}_knee`], foot = b[`leg${side}_foot`];
    // one knee down (the right), the left foot planted forward; dying he drops to both knees
    const kneelLeg = Math.max(side === 'R' ? kneel : 0, step(dead, 0, 0.5)), standLeg = side === 'L' ? kneel * (1 - step(dead, 0, 0.5)) : 0;
    // lying the legs ride the body (stretched along the coffin); sitting up the hips flex so they stay flat, then swing
    // down under him as he stands (the knees bend through it)
    const sitHip = -1.52 * sit * (1 - stand), rising = bump(stand, 0, 1);
    R(hip, -0.5 * lsw * moving + sitHip - 0.6 * rising - 1.35 * standLeg + 0.25 * kneelLeg, 0, sx * 0.05);
    R(knee, (0.3 + 0.45 * Math.max(0, lsw)) * moving + 1.2 * rising + 1.45 * standLeg + 1.55 * kneelLeg, 0, 0);
    R(foot, -0.15 * lsw * moving - 0.3 * kneelLeg - 0.1 * standLeg, 0, 0);
  }
}

// ── registration ─────────────────────────────────────────────────────────────────────────

function thinkKing(a: Animal, c: ThinkCtx): void {
  const m = a.mem as KingMem;
  if (m.init !== 1) {
    m.init = 1; m.pose ??= 0; m.rise ??= 0; m.cape ??= 1; m.crown ??= 1;
    m.floorY ??= c.heightAt(a.position.x, a.position.z);
  }
  goldenKingBrain.think?.(a, c);
}

registerSpecies({
  kind: GOLDEN_KING,
  label: 'The Golden King',
  fur: NO_FUR,
  rig: 'custom',
  aggressive: true,
  walkSpeed: 1.5,
  chargeDamage: 14,
  // no corpseFade: a fade clones the painterly material (a new program at the victory); the fight sinks + hides him
  eyeGlow: [0.9, 0.55, 0.12], eyeGlowIntensity: 0.18,
  sounds: { call: 'bear_growl', hurt: 'sailor_groan', callEvery: [18, 40] },
  variants: [
    { id: 'king', label: 'The Golden King', weight: 1, rarity: 'legendary', scale: [1.22, 1.22], hp: 2400 },
  ],
  build: buildKing,
  animate: animateKing,
  think: thinkKing,
  damageMul: (a, hitPoint, dir) => goldenKingBrain.damageMul?.(a, hitPoint, dir) ?? 1,
});
