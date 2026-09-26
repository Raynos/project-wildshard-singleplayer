// Copied from the hero lab (src/dev/nd-lab/hero/banyan.ts, round-7-lab-hero) into the clean room.
// The banyan (lab P4 "hero", E169): the square's old strangler fig in its round carved planter. What reads in the
// targets (round-6 style A, round-4 A, concept 03) and is here:
// - a trunk that is a BUNDLE of twisted roots (each a smooth swept tube with ruled bark fissures), pouring over the
//   planter's rim, braided into a column and fanning out into the main limbs;
// - curtains of aerial roots hanging from the limbs (real thin tubes, never cards: Jake's no-cut-outs rule);
// - a dense canopy of layered leaf clumps: lumpy ellipsoids with smooth "cloud" normals (a lit top, a shaded belly in
//   the 2-band ramp) and the gongbi leaf pattern (K.leaf), tinted per clump in 5 greens, stacked in 3 tiers;
// - red wish ribbons, a carved stone planter (ruled panels, a rim, dark soil).
import { Vector3 } from 'three';
import { E, K, type Kit, type Look } from '../kit';
import { Rng } from '../util';
import { type KitX, curve } from './kitx';

export interface BanyanSpec {
  x: number; y: number; z: number; r: number; seed: number; height: number; spread: number;
  /** false: skip the planter, trunk and limbs (a TRELLIS trunk stands in), keep canopy, aerial roots, ribbons */
  trunk?: boolean;
}

const BARK: Look = { wash: 0x6a4e36, kind: K.bars, col: 0.1, row: 0, line: 0 };
const BARK_DARK: Look = { wash: 0x543c29, kind: K.bars, col: 0.08, row: 0, line: 0 };
const ROOT: Look = { wash: 0x7a6a56, line: 0 };
const GREENS = [0x2f6a48, 0x3a7a52, 0x285c40, 0x4a8a5c, 0x23553b, 0x3f7550] as const;

export function buildBanyan(k: Kit, x: KitX, B: BanyanSpec): void {
  const rng = new Rng(B.seed);
  const { r } = B;
  const cx = B.x, cz = B.z, y = B.y;
  const H = B.height, SP = B.spread;
  const drawTrunk = B.trunk ?? true;
  // the planter: carved panels round the wall, a rim, soil
  if (drawTrunk) k.cyl(cx, y, cz, r, r, 0.95, 20, { wash: 0xb3b0a7, kind: K.panel, line: 1 }, { caps: false, edges: E.all });
  if (drawTrunk) {
    k.cyl(cx, y, cz, r + 0.12, r + 0.12, 0.14, 20, { wash: 0x9e9a91, line: 1.5 }, { caps: false, edges: E.rims });
    k.cyl(cx, y + 0.95, cz, r + 0.2, r + 0.2, 0.18, 20, { wash: 0xa9a59c, line: 1 }, { edges: E.rims });
    k.cyl(cx, y + 1.08, cz, r - 0.02, r - 0.02, 0.04, 20, { wash: 0x3a3228, line: 0 }, { edges: E.none });
  }
  const soil = y + 1.12;
  // the trunk column's axis: leaning a little, twisting
  const axis = (t: number): Vector3 => new Vector3(cx + 0.35 * Math.sin(t * 2.2) * t, soil + t * H * 0.55, cz - 0.25 * t);
  // the root bundle: each root starts at a foot on the soil (some spill over the rim to the ground), spirals up
  // around the axis and leaves it again as a main limb
  const limbTips: Vector3[] = [];
  const N = 14;
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2 + rng.range(-0.2, 0.2);
    const over = i % 4 === 0;
    const footR = over ? r + 0.45 : rng.range(1.3, r - 0.2);
    const foot = new Vector3(cx + Math.cos(a0) * footR, over ? y + 0.05 : soil, cz + Math.sin(a0) * footR);
    const pts: Vector3[] = [foot];
    if (over) pts.push(new Vector3(cx + Math.cos(a0) * (r + 0.25), soil + 0.15, cz + Math.sin(a0) * (r + 0.25)));
    const twist = rng.range(0.5, 1.1) * (i % 2 === 0 ? 1 : -1);
    for (let j = 1; j <= 5; j++) {
      const t = j / 5;
      const ax = axis(t * 0.9);
      const a = a0 + twist * t;
      const rr = (1 - t) * 1.1 + 0.55;
      pts.push(new Vector3(ax.x + Math.cos(a) * rr, ax.y, ax.z + Math.sin(a) * rr));
    }
    // out into a limb
    const la = a0 + twist + rng.range(-0.3, 0.3);
    const reach = rng.range(0.55, 1.0) * SP;
    const tip = new Vector3(cx + Math.cos(la) * reach, soil + H * rng.range(0.78, 0.98), cz + Math.sin(la) * reach * 0.85);
    const last = pts[pts.length - 1] ?? foot;
    const mid = last.clone().lerp(tip, 0.45).add(new Vector3(0, H * 0.12, 0));
    pts.push(mid, tip);
    const rad0 = rng.range(0.24, 0.36);
    if (drawTrunk) x.sweep(curve(pts, 4), (t) => rad0 * (t < 0.08 ? 1.35 - t * 4 : 1) * (1 - t * 0.72), 7, i % 3 === 0 ? BARK_DARK : BARK, { capEnd: true });
    limbTips.push(tip);
    // a secondary branch off each limb
    const bp = last.clone().lerp(tip, 0.7);
    const bt = bp.clone().add(new Vector3(rng.range(-2.5, 2.5), rng.range(0.6, 1.8), rng.range(-2.5, 2.5)));
    if (drawTrunk) x.sweep(curve([bp, bp.clone().lerp(bt, 0.5).add(new Vector3(0, 0.4, 0)), bt], 3), (t) => 0.13 * (1 - t * 0.7), 5, BARK, { capEnd: true });
    limbTips.push(bt);
    // twigs: two short forks off the branch, each carrying its own shelf of foliage
    for (let f = 0; f < 2; f++) {
      const tp = bp.clone().lerp(bt, rng.range(0.4, 0.8));
      const tt = tp.clone().add(new Vector3(rng.range(-1.8, 1.8), rng.range(0.3, 1.2), rng.range(-1.8, 1.8)));
      x.sweep([tp, tt], (t) => 0.07 * (1 - t * 0.7), 4, BARK);
      limbTips.push(tt);
    }
  }
  // a core so the bundle reads solid from every side
  if (drawTrunk) x.sweep(curve([axis(0), axis(0.35), axis(0.7)], 3), (t) => 1.05 - t * 0.35, 10, BARK_DARK, { capEnd: true });
  // aerial roots: thin tubes hanging from the limbs, some long enough to root in the planter
  for (let i = 0; i < 90; i++) {
    const tip = rng.pick(limbTips);
    const from = axis(0.75).lerp(tip, rng.range(0.3, 0.98));
    const len = Math.min(from.y - soil + 0.1, rng.range(1.0, from.y - soil));
    const sway = new Vector3(rng.range(-0.2, 0.2), 0, rng.range(-0.2, 0.2));
    const w1 = new Vector3(rng.range(-0.12, 0.12), 0, rng.range(-0.12, 0.12));
    const pts = [from, from.clone().add(new Vector3(0, -len * 0.33, 0)).add(w1), from.clone().add(new Vector3(0, -len * 0.66, 0)).add(sway), from.clone().add(new Vector3(0, -len, 0)).add(sway.clone().multiplyScalar(1.3)).sub(w1)];
    const rr = len > 4 ? rng.range(0.03, 0.055) : rng.range(0.012, 0.025);
    x.sweep(curve(pts, 3), (t) => rr * (1 - t * 0.55), 4, ROOT);
  }
  // the canopy (v3): a cloud-shelf of foliage on every limb tip, the gongbi / jiehua way of drawing a banyan — flat
  // layered masses with leafy edges and gaps where the limbs show, never one blob (v1) nor loose pads (v2). Each shelf
  // is 5–7 overlapping flattened lumps: their seams draw as cluster outlines in the post silhouette, the upper lumps
  // take the lighter greens (the lit tops), the lower ones the darker (the shaded bellies).
  const X = new Vector3(1, 0, 0), Y = new Vector3(0, 1, 0), Z = new Vector3(0, 0, 1);
  const LIGHT = [0x4f8a5c, 0x5a9160, 0x467f55] as const, DARK = [0x23513a, 0x2a5a42, 0x1f4a36] as const;
  for (const tip of limbTips) {
    const n = rng.int(7, 9);
    const shelfR = rng.range(1.0, 1.7);
    for (let j = 0; j < n; j++) {
      const a = rng.range(0, Math.PI * 2);
      const rr = rng.range(0.2, 1) * shelfR;
      const up = rng.range(-0.25, 0.45);
      const c = tip.clone().add(new Vector3(Math.cos(a) * rr, up + 0.35, Math.sin(a) * rr));
      const s0 = rng.range(0.5, 0.9);
      const sd = rng.range(0, 10);
      const wash = up > 0.1 ? rng.pick(LIGHT) : up < -0.05 ? rng.pick(DARK) : rng.pick(GREENS);
      x.ellipsoid(c, X, Y, Z, s0 * 1.25, s0 * 0.48, s0 * 1.15, { wash, kind: K.leaf, line: 0, accent: true },
        (d) => 1 + 0.14 * Math.sin(d.x * 9.3 + sd) * Math.sin(d.y * 5.1 + sd * 2) * Math.sin(d.z * 8.7 + sd * 3) + 0.08 * Math.abs(Math.sin(d.x * 19 + d.z * 15 + sd)) - (d.y < -0.2 ? 0.25 : 0),
        4, 8);
    }
  }
  // red wish ribbons on the lower limbs
  for (let i = 0; i < 46; i++) {
    const tip = rng.pick(limbTips);
    const p = axis(0.7).lerp(tip, rng.range(0.25, 0.8)).add(new Vector3(0, -rng.range(0.1, 0.5), 0));
    const len = rng.range(0.6, 1.2);
    const d = new Vector3(rng.range(-1, 1), 0, rng.range(-1, 1)).normalize();
    x.sweep([p, p.clone().add(new Vector3(0, -len, 0)).addScaledVector(d, 0.08)], () => 0.04, 3, { wash: i % 3 === 0 ? 0xe0b040 : 0xd23a26, line: 0, accent: true }, { flat: 0.2, up: d });
  }
}
