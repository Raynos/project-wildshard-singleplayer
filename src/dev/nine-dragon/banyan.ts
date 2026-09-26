// Dome B (E169, round-10-dome-b): the banyan of Lantern Square at hero quality, grown from the hero lab's tree
// (hero/banyan.ts) against the dome-B targets (round-10-dome-b-*/target-2, 6, 7, 9: a massive gnarled trunk of fused
// roots pouring over a carved stone planter, curtains of aerial roots, a dense dark layered canopy spreading over the
// noodle stall and toward the gate, red wish ribbons and lanterns, the red earth-god shrine lit by candles):
// - the trunk: a thick braided bundle of 22 roots round a core, the outer ones spilling over the planter's rim onto
//   the flagstones as buttresses; 9 main limbs with secondary branches and twigs;
// - prop roots: a dozen thick aerial roots dropping from the limbs into the planter's soil (the banyan's pillars), and
//   ~260 thin hanging roots in curtains (real tubes, never cards: Jake's no-cut-outs rule);
// - the canopy: cloud shelves on every limb, branch and twig tip, 12–16 small flattened lumps each (lit tops lighter,
//   shaded bellies darker, the gongbi leaf pattern K.leaf), the greens darkened to the targets' night foliage;
// - the planter: dark wet granite with carved panels, a moulded rim, soil; the shrine: a red lacquer cabinet under a
//   little tiled hip roof, a gold-lit niche, candles, a censer with incense smoke, oranges on a plate, paper couplets.
import { Color, Vector3 } from 'three';
import type { Ctx } from './ctx';
import { curvedRoof, relief } from './gate';
import { E, K, type Kit, type Look } from './kit';
import { BANYAN, Y0 } from './layout';
import { Rng } from './util';
import { SURF } from './paint';
import { type KitX, curve } from './hero/kitx';

export interface BanyanSpec {
  x: number; y: number; z: number; r: number; seed: number; height: number; spread: number;
  /** false: plan the canopy's lumps but draw no K.leaf ellipsoids (a card canopy — the organic lab's — dresses them) */
  leaves?: boolean;
}

/** one lump of foliage (the organic lab's `Lump` shape): centre, radii, how high it sits on its shelf, a seed, a wash */
export interface CanopyLump { c: Vector3; r: Vector3; up: number; seed: number; wash: number }
/** what the tree hands on: the canopy's lumps (crown fill first, then the shelves) */
export interface BanyanPlan { lumps: CanopyLump[] }

const BARK: Look = { wash: 0x4a3727, kind: K.bars, col: 0.09, row: 0, line: 0 };
const BARK_DARK: Look = { wash: 0x392b21, kind: K.bars, col: 0.07, row: 0, line: 0 };
const ROOT: Look = { wash: 0x4c4034, line: 0 };
const STONE: Look = { wash: 0x4f4a4a, kind: K.panel, line: 1, wet: 0.35 };
const STONE_RIM: Look = { wash: 0x575151, line: 1, wet: 0.45, surf: SURF.concrete };
// night foliage (ΔE vs target-2 / target-7): bellies near-black olive (#242b24 from below), lit tops a light olive
// (#6b8265 from above); the round-1 greens read too saturated underneath and too blue on top
const GREENS = [0x26352a, 0x2c3c2e, 0x223027, 0x33452f, 0x1f2c24, 0x2f3f30] as const;
const LIGHT = [0x506a4a, 0x5a7450, 0x4a6244] as const;
const DARK = [0x182219, 0x1c261d, 0x151e17] as const;
const X = new Vector3(1, 0, 0), Y = new Vector3(0, 1, 0), Z = new Vector3(0, 0, 1);

export function buildBanyanTree(k: Kit, x: KitX, B: BanyanSpec): BanyanPlan {
  const lumps: CanopyLump[] = [];
  const drawLeaves = B.leaves ?? true;
  const rng = new Rng(B.seed);
  const { r } = B;
  const cx = B.x, cz = B.z, y = B.y;
  const H = B.height, SP = B.spread;
  // the planter: a moulded plinth, carved panels round the wall, a rim, soil
  k.cyl(cx, y, cz, r + 0.16, r + 0.16, 0.16, 24, { ...STONE_RIM, line: 2 }, { caps: false, edges: E.rims });
  k.cyl(cx, y + 0.16, cz, r, r, 0.8, 24, STONE, { caps: false, edges: E.all });
  // every other panel carved: dragons among clouds, raised off the wall
  for (let i = 0; i < 24; i += 2) {
    const a = ((i + 0.5) / 24) * Math.PI * 2;
    const nrm = new Vector3(Math.cos(a), 0, Math.sin(a));
    relief(x, new Vector3(cx + nrm.x * r * 0.991, y + 0.56, cz + nrm.z * r * 0.991), new Vector3(-nrm.z, 0, nrm.x), Y.clone(), nrm, 0.7, 0.5, 900 + i);
  }
  k.cyl(cx, y + 0.96, cz, r + 0.22, r + 0.22, 0.16, 24, STONE_RIM, { edges: E.rims });
  k.cyl(cx, y + 1.12, cz, r - 0.02, r - 0.02, 0.03, 24, { wash: 0x2e271f, line: 0 }, { edges: E.none });
  const soil = y + 1.14;
  // the trunk column's axis: leaning a little, twisting
  const axis = (t: number): Vector3 => new Vector3(cx + 0.3 * Math.sin(t * 2.2) * t, soil + t * H * 0.5, cz - 0.2 * t);
  const limbTips: Vector3[] = [];
  const limbs: { from: Vector3; tip: Vector3 }[] = [];
  const N = 22;
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2 + rng.range(-0.15, 0.15);
    const over = i % 3 === 0;
    // the buttresses spill over the rim and run out across the flagstones
    const footR = over ? r + rng.range(0.6, 1.3) : rng.range(1.0, r - 0.3);
    const foot = new Vector3(cx + Math.cos(a0) * footR, over ? y + 0.04 : soil, cz + Math.sin(a0) * footR);
    const pts: Vector3[] = [foot];
    if (over) {
      pts.push(new Vector3(cx + Math.cos(a0) * (r + 0.35), y + 0.55, cz + Math.sin(a0) * (r + 0.35)));
      pts.push(new Vector3(cx + Math.cos(a0) * (r + 0.05), soil + 0.2, cz + Math.sin(a0) * (r + 0.05)));
    }
    const twist = rng.range(0.4, 1.0) * (i % 2 === 0 ? 1 : -1);
    for (let j = 1; j <= 5; j++) {
      const t = j / 5;
      const ax = axis(t * 0.95);
      const a = a0 + twist * t;
      const rr = (1 - t) * 1.25 + 0.75;
      pts.push(new Vector3(ax.x + Math.cos(a) * rr, ax.y, ax.z + Math.sin(a) * rr));
    }
    const last = pts[pts.length - 1] ?? foot;
    const rad0 = rng.range(0.28, 0.44);
    // every other root leaves the column as a main limb; the rest fuse into the crown
    if (i % 2 === 0) {
      const la = a0 + twist + rng.range(-0.3, 0.3);
      const reach = rng.range(0.6, 1.0) * SP;
      // the crown leans out over the square (south-west): the tree stands in the corner of the north and east walls,
      // and a tip that reached back into those blocks would bury its leaves in the facades
      const tip = new Vector3(cx + Math.cos(la) * reach - 1.4, soil + H * rng.range(0.72, 0.95), cz + Math.sin(la) * reach * 0.8 + 1.6);
      if (tip.x > cx + 2.6) tip.x = cx + 2.6 + (tip.x - cx - 2.6) * 0.3;
      if (tip.z < cz - 2.4) tip.z = cz - 2.4 + (tip.z - cz + 2.4) * 0.3;
      // nor over the gate's east bay (round 4: roots curtained the gate in 1, the crown covered its roof in 9)
      if (tip.x < cx - 4.6) tip.x = cx - 4.6 - (cx - 4.6 - tip.x) * 0.3;
      const mid = last.clone().lerp(tip, 0.4).add(new Vector3(0, H * 0.14, 0));
      pts.push(mid, tip);
      x.sweep(curve(pts, 4), (t) => rad0 * (t < 0.1 ? 1.45 - t * 4.5 : 1) * (1 - t * 0.78), 8, i % 4 === 0 ? BARK_DARK : BARK, { capEnd: true });
      limbTips.push(tip);
      limbs.push({ from: last, tip });
      // secondary branches and twigs, each carrying its own shelf of foliage
      for (let b = 0; b < 2; b++) {
        const bp = last.clone().lerp(tip, rng.range(0.45, 0.8));
        const bt = bp.clone().add(new Vector3(rng.range(-2.8, 2.8), rng.range(0.5, 1.8), rng.range(-2.8, 2.8)));
        x.sweep(curve([bp, bp.clone().lerp(bt, 0.5).add(new Vector3(0, 0.35, 0)), bt], 3), (t) => 0.14 * (1 - t * 0.7), 5, BARK, { capEnd: true });
        limbTips.push(bt);
        limbs.push({ from: bp, tip: bt });
        const tp = bp.clone().lerp(bt, rng.range(0.4, 0.8));
        const tt = tp.clone().add(new Vector3(rng.range(-1.6, 1.6), rng.range(0.3, 1.0), rng.range(-1.6, 1.6)));
        x.sweep([tp, tt], (t) => 0.07 * (1 - t * 0.7), 4, BARK);
        limbTips.push(tt);
      }
    } else {
      pts.push(axis(1.02).add(new Vector3(Math.cos(a0) * 0.5, 0, Math.sin(a0) * 0.5)));
      x.sweep(curve(pts, 4), (t) => rad0 * (t < 0.1 ? 1.45 - t * 4.5 : 1) * (1 - t * 0.5), 8, i % 3 === 1 ? BARK_DARK : BARK, { capEnd: true });
    }
  }
  // the core, so the bundle reads solid and massive from every side
  x.sweep(curve([axis(0), axis(0.4), axis(0.8), axis(1.0)], 3), (t) => 1.35 - t * 0.55, 12, BARK_DARK, { capEnd: true });
  // knots and burls on the trunk
  for (let i = 0; i < 10; i++) {
    const t = rng.range(0.1, 0.8);
    const a = rng.range(0, Math.PI * 2);
    const p = axis(t).add(new Vector3(Math.cos(a) * (1.35 - t * 0.5), 0, Math.sin(a) * (1.35 - t * 0.5)));
    x.ellipsoid(p, X, Y, Z, rng.range(0.18, 0.32), rng.range(0.22, 0.4), rng.range(0.18, 0.32), BARK_DARK, (d) => 1 + 0.15 * Math.sin(d.y * 9), 4, 8);
  }
  // prop roots: thick aerial roots from the limbs straight down into the planter's soil (or past its rim to the ground)
  for (let i = 0; i < 7; i++) {
    const L = rng.pick(limbs);
    const from = L.from.clone().lerp(L.tip, rng.range(0.25, 0.6));
    const dx = from.x - cx, dz = from.z - cz;
    const inPlanter = dx * dx + dz * dz < (r - 0.2) ** 2;
    const groundY = inPlanter ? soil : y;
    if (from.y - groundY < 2) continue;
    // a gnarled pillar: it wanders as it drops and flares where it roots, a few thinner strands braided round it
    const drop = from.y - groundY;
    const pts: Vector3[] = [];
    for (let j = 0; j <= 5; j++) {
      const t = j / 5;
      pts.push(new Vector3(from.x + Math.sin(t * 5 + i) * 0.14 * t, from.y - drop * t - (j === 5 ? 0.05 : 0), from.z + Math.cos(t * 4 + i) * 0.14 * t));
    }
    const rr = rng.range(0.05, 0.09);
    x.sweep(curve(pts, 3), (t) => rr * (1 + t * t * 1.2), 6, BARK_DARK);
    for (let s = 0; s < 3; s++) {
      const ph = (s / 3) * Math.PI * 2;
      const strand = pts.map((p, j) => p.clone().add(new Vector3(Math.cos(ph + j * 0.9) * rr * 1.6, 0, Math.sin(ph + j * 0.9) * rr * 1.6)));
      x.sweep(curve(strand, 3), () => rr * 0.35, 4, ROOT);
    }
  }
  // curtains of thin hanging roots, bunched under the limbs
  for (let i = 0; i < 260; i++) {
    const L = rng.pick(limbs);
    const from = L.from.clone().lerp(L.tip, rng.range(0.2, 0.98)).add(new Vector3(rng.range(-0.4, 0.4), -0.1, rng.range(-0.4, 0.4)));
    const maxLen = from.y - soil;
    if (maxLen < 0.8) continue;
    const len = Math.min(maxLen - 0.3, rng.range(0.8, maxLen) * (rng.chance(0.3) ? 1 : 0.55));
    if (len < 0.5) continue;
    const sway = new Vector3(rng.range(-0.18, 0.18), 0, rng.range(-0.18, 0.18));
    const pts = [from, from.clone().add(new Vector3(0, -len * 0.5, 0)).add(sway.clone().multiplyScalar(0.5)), from.clone().add(new Vector3(0, -len, 0)).add(sway)];
    const rr = len > 4 ? rng.range(0.025, 0.045) : rng.range(0.01, 0.022);
    x.sweep(curve(pts, 3), (t) => rr * (1 - t * 0.5), 4, ROOT);
  }
  // the crown's fill: big dark lumps in a dome shell under the shelves, so the gaps between the shelves read as deep
  // foliage (from above round 2 read as separate lily pads over the flagstones)
  const crownC = new Vector3(cx - 0.4, soil + H * 0.8, cz + 1.2);
  for (let i = 0; i < 26; i++) {
    const a = rng.range(0, Math.PI * 2), el = rng.range(0.1, 1.2);
    const rr = SP * 0.62 * Math.cos(el * 0.8);
    const c = crownC.clone().add(new Vector3(Math.cos(a) * rr, Math.sin(el) * H * 0.18 - 0.4, Math.sin(a) * rr * 0.85));
    const s0 = rng.range(1.2, 1.8);
    const wash = rng.pick(GREENS);
    lumps.push({ c, r: new Vector3(s0 * 1.2, s0 * 0.6, s0 * 1.1), up: -0.3, seed: i, wash });
    if (drawLeaves) {
      x.ellipsoid(c, X, Y, Z, s0 * 1.2, s0 * 0.6, s0 * 1.1, { wash, kind: K.leaf, line: 0 },
        (d) => 1 + 0.14 * Math.sin(d.x * 7 + i) * Math.sin(d.z * 6 + i * 2) - (d.y < -0.3 ? 0.3 : 0), 6, 10);
    }
  }
  // the canopy: cloud shelves of small leaf lumps on every tip (upper lumps light, bellies dark)
  for (const tip of limbTips) {
    const n = rng.int(12, 16);
    const shelfR = rng.range(1.2, 2.0);
    for (let j = 0; j < n; j++) {
      const a = rng.range(0, Math.PI * 2);
      const rr = Math.sqrt(rng.next()) * shelfR;
      const up = rng.range(-0.3, 0.5) * (1 - rr / (shelfR * 1.4));
      const c = tip.clone().add(new Vector3(Math.cos(a) * rr, up + 0.3, Math.sin(a) * rr));
      const s0 = rng.range(0.38, 0.66);
      const sd = rng.range(0, 10);
      const wash = up > 0.15 ? rng.pick(LIGHT) : up < -0.05 ? rng.pick(DARK) : rng.pick(GREENS);
      lumps.push({ c, r: new Vector3(s0 * 1.25, s0 * 0.68, s0 * 1.15), up, seed: sd, wash });
      if (drawLeaves) {
        x.ellipsoid(c, X, Y, Z, s0 * 1.25, s0 * 0.68, s0 * 1.15, { wash, kind: K.leaf, line: 0 },
          (d) => 1 + 0.16 * Math.sin(d.x * 9.3 + sd) * Math.sin(d.y * 5.1 + sd * 2) * Math.sin(d.z * 8.7 + sd * 3) + 0.1 * Math.abs(Math.sin(d.x * 19 + d.z * 15 + sd)) - (d.y < -0.2 ? 0.28 : 0),
          5, 9);
      }
    }
  }
  // red and gold wish ribbons on the lower limbs
  for (let i = 0; i < 90; i++) {
    const L = rng.pick(limbs);
    const p = L.from.clone().lerp(L.tip, rng.range(0.15, 0.7)).add(new Vector3(0, -rng.range(0.1, 0.4), 0));
    if (p.y > soil + 6.5) continue;
    const len = rng.range(0.5, 1.1);
    const d = new Vector3(rng.range(-1, 1), 0, rng.range(-1, 1)).normalize();
    x.sweep([p, p.clone().add(new Vector3(0, -len * 0.5, 0)).addScaledVector(d, 0.05), p.clone().add(new Vector3(0, -len, 0)).addScaledVector(d, 0.1)], () => 0.035, 3, { wash: i % 4 === 0 ? 0xd9a441 : 0xb8261a, line: 0, accent: true }, { flat: 0.2, up: d });
  }
  return { lumps };
}

/** the earth-god shrine (土地公) at the planter's front: a red lacquer cabinet under a tiled roof, candles, a censer */
function shrine(ctx: Ctx, k: Kit, x: KitX, sx: number, y: number, sz: number): void {
  const RED: Look = { wash: 0x8a2419, line: 1, accent: true, gloss: true, surf: SURF.lacquer };
  // the stone base and the altar table
  k.box(sx, y, sz, 1.5, 0.5, 0.95, { wash: 0x5a5b60, kind: K.panel, line: 1, wet: 0.3 });
  k.box(sx, y + 0.5, sz, 1.6, 0.08, 1.02, { wash: 0x606166, line: 1 });
  // the cabinet: back, sides, a top, an open front; a gold-lit niche with the god's tablet
  k.box(sx, y + 0.58, sz - 0.3, 1.2, 1.2, 0.08, RED);
  for (const dx of [-0.58, 0.58]) k.box(sx + dx, y + 0.58, sz - 0.04, 0.08, 1.2, 0.6, RED);
  k.box(sx, y + 1.78, sz - 0.04, 1.28, 0.1, 0.66, RED);
  k.box(sx, y + 0.62, sz - 0.24, 1.0, 1.08, 0.02, { wash: 0xe8a458, emit: 0.9, line: 0.6, accent: true });
  k.box(sx, y + 0.8, sz - 0.2, 0.3, 0.62, 0.06, { wash: 0xb8862e, emit: 0.35, line: 0.8, accent: true, gloss: true });
  // carved gold lintel boards and red couplet strips on the posts
  k.box(sx, y + 1.62, sz + 0.27, 1.24, 0.16, 0.04, { wash: 0xb08a3c, kind: K.panel, line: 1, accent: true });
  ctx.signs.place({ at: new Vector3(sx, y + 1.99, sz + 0.3), normal: new Vector3(0, 0, 1), size: 0.13, spec: { text: '福德祠', color: '#f0c86a', vertical: false, style: 'plaque' }, gain: 1.3 }, null);
  for (const dx of [-0.58, 0.58]) {
    ctx.signs.place({ at: new Vector3(sx + dx, y + 1.15, sz + 0.27), normal: new Vector3(0, 0, 1), size: 0.1, spec: { text: dx < 0 ? '福而有德' : '正則為神', color: '#1a1614', vertical: true, style: 'paper', ink: '#d33a22' }, gain: 1.0 }, null);
  }
  // the little roof
  curvedRoof(k, x, null, { cx: sx, y0: y + 1.88, cz: sz - 0.04, w: 1.9, d: 1.25, h: 0.55, lift: 0.22, flare: 0.12, tile: 0x1a4a3a, neon: null, ornaments: false });
  // the altar: a bronze censer with incense sticks, two candles, oranges on a plate, a teacup row
  k.lathe(sx, y + 0.58, sz + 0.2, [[0.1, 0], [0.16, 0.05], [0.17, 0.14], [0.14, 0.2], [0.15, 0.22]], 10, { wash: 0x6b5a3a, line: 0.8, gloss: true }, true, 0);
  for (let i = 0; i < 3; i++) {
    const ix = sx - 0.04 + i * 0.04;
    x.sweep([new Vector3(ix, y + 0.78, sz + 0.2), new Vector3(ix + (i - 1) * 0.02, y + 1.12, sz + 0.2)], () => 0.006, 3, { wash: 0x8a2a1a, line: 0 });
    k.box(ix + (i - 1) * 0.02, y + 1.1, sz + 0.2, 0.014, 0.02, 0.014, { wash: 0xff6a2a, emit: 3, line: 0, accent: true });
  }
  for (const dx of [-0.45, 0.45]) {
    k.cyl(sx + dx, y + 0.58, sz + 0.12, 0.05, 0.05, 0.08, 8, { wash: 0x6b5a3a, line: 0.6 });
    k.cyl(sx + dx, y + 0.66, sz + 0.12, 0.035, 0.035, 0.22, 8, { wash: 0xc8261a, line: 0.5, accent: true });
    x.ellipsoid(new Vector3(sx + dx, y + 0.92, sz + 0.12), X, Y, Z, 0.022, 0.045, 0.022, { wash: 0xffc070, emit: 4, line: 0, accent: true }, () => 1, 4, 6);
  }
  k.cyl(sx + 0.24, y + 0.58, sz + 0.05, 0.16, 0.18, 0.03, 12, { wash: 0xd8d2c4, line: 0.6 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    x.ellipsoid(new Vector3(sx + 0.24 + Math.cos(a) * 0.07, y + 0.66 + (i === 4 ? 0.06 : 0), sz + 0.05 + Math.sin(a) * 0.07), X, Y, Z, 0.045, 0.042, 0.045, { wash: 0xe07a1e, line: 0, accent: true }, () => 1, 4, 6);
  }
  for (let i = 0; i < 3; i++) k.cyl(sx - 0.3 + i * 0.1, y + 0.58, sz - 0.02, 0.025, 0.02, 0.035, 8, { wash: 0xe8e4da, line: 0.4 });
  // a red lantern each side, a paper-money burner (a small iron drum) by the planter
  ctx.lantern(sx - 0.8, y + 1.95, sz + 0.3, 0.55);
  ctx.lantern(sx + 0.8, y + 1.95, sz + 0.3, 0.55);
  k.cyl(sx + 1.2, y, sz + 0.25, 0.22, 0.22, 0.55, 12, { wash: 0x3a2e28, line: 1 }, { edges: E.rims });
  k.cyl(sx + 1.2, y + 0.55, sz + 0.25, 0.2, 0.2, 0.01, 12, { wash: 0xff8a3a, emit: 1.2, line: 0, accent: true });
  ctx.steam.push(new Vector3(sx, y + 1.15, sz + 0.2));
  ctx.steam.push(new Vector3(sx + 1.2, y + 0.7, sz + 0.25));
    // the niche's candle-light: a warm emitter (streak card + baked spill on the planter, the roots, the flagstones)
  ctx.emitters.push({ at: new Vector3(sx, y + 1.1, sz + 0.1), color: new Color(0xffa860), w: 0.9, h: 1.0, power: 0.35, spill: 0.45 });
}


/** the banyan, its planter, the earth-god shrine and the 九龍城 stele */
/** the tree's plan, for main.ts: the canopy's lumps, dressed by canopy.ts `buildCanopy` (the organic lab's cards) */
export const banyanOut: { plan: BanyanPlan | null } = { plan: null };

export function buildBanyan(ctx: Ctx, rng: Rng): void {
  const k = ctx.kit('banyan', true);
  const kx = ctx.kitx('banyan');
  const { x, z, r } = BANYAN;
  const y = Y0;
  // no K.leaf lumps: the organic lab's painted leaf cards dress the plan (canopy.ts, wired in main.ts)
  banyanOut.plan = buildBanyanTree(k, kx, { x, y, z, r, seed: 7, height: 14, spread: 8.6, leaves: false });
  for (let i = 0; i < 7; i++) ctx.lantern(x + rng.range(-4.5, 4.5), y + rng.range(6.2, 8.4), z + rng.range(-3, 3.5), 0.8);
  // the shrine stands at the planter's south-west, clear of the stall's back, facing the square
  shrine(ctx, k, kx, x - 3.2, y, z + 2.2);
  // the 九龍城 stele: a dark granite slab on a tortoise-back plinth
  const tx = x - 3.7, tz = z - 1.1;
  k.box(tx, y, tz, 1.0, 0.35, 0.7, { wash: 0x55565b, line: 1, wet: 0.3 });
  k.box(tx, y + 0.35, tz, 0.78, 2.9, 0.42, { wash: 0x4a4b50, kind: K.panel, line: 1, wet: 0.25 });
  k.box(tx, y + 3.25, tz, 0.92, 0.22, 0.5, { wash: 0x55565b, line: 1 });
  ctx.signs.place({ at: new Vector3(tx, y + 1.85, tz + 0.22), normal: new Vector3(0, 0, 1), size: 0.5, spec: { text: '九龍城', color: '#d8c9a0', vertical: true, style: 'paper', ink: '#3a3b40' }, gain: 1.0 }, null);
  ctx.map.push({ x0: x - r, z0: z - r, x1: x + r, z1: z + r, kind: 'green' });
}
