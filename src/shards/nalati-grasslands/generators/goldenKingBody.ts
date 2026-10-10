import { smoothstep as sstep } from '@wildshard/engine/core/noise';
import type { Rng } from '@wildshard/engine/core/rng';
import { loft, skinPlain, S, boneIndex, mix, paletteColors, paintNoise, type Paint, type RGB, type Station } from '@wildshard/engine/entities/species/loft';
import type { AnimalSpecies, BoneDef, VariantDef } from '@wildshard/engine/entities/species/registry';
import * as THREE from 'three';

/**
 * Build-time only (SHARD-PLATFORM M3, Nalati's species bodies bake): the Golden King's lofts, which `species/goldenKing.ts` used to run
 * on the page. The body reads its variant's `traits` / `tint` only (no rng), so `generators/bodies.ts` bakes each variant
 * once (`scripts/bake-nalati-bodies.mjs`) and the page reads it back bit-exact (`species/bodies.ts` `nalatiBody`).
 */

const PALETTE = {
  // gold that reads as gold, not ochre: saturated, the lit plaque edges past 1 (they catch the shaft / the sun like metal),
  // a deep brown-gold in the gaps; the reds truer so the cloak and the felt cap stay red under the painterly grade
  gold: [0.84, 0.56, 0.1], goldDark: [0.32, 0.17, 0.03], goldHi: [1.25, 0.98, 0.42],
  red: [0.6, 0.06, 0.04], redDark: [0.3, 0.03, 0.03], felt: [0.56, 0.06, 0.04],
  skin: [0.29, 0.19, 0.11], skinDark: [0.13, 0.08, 0.05], leather: [0.20, 0.12, 0.07],
  eye: [1.0, 0.82, 0.32], blade: [1.0, 0.86, 0.46],
} satisfies Record<string, RGB>;

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

export function buildKing(v: VariantDef, rng: Rng): AnimalSpecies {
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
