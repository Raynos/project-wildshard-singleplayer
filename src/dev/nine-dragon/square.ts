// Lantern Square: wet granite, the Well's stone balustrade and sign masts, the cinnabar paifang (九龍疊城), the banyan
// in its round planter with the earth-god shrine, mahjong tables, the noodle stall, lantern strings and the crowd.
import { IcosahedronGeometry, Vector3 } from 'three';
import type { Ctx } from './ctx';
import { E, K, type Kit, type Look } from './kit';
import { BANYAN, GATE, PLAZA, STALL, STREET, WELL, Y0 } from './layout';
import { dragonHook, lamp, mahjong, person, scooter, stool } from './props';
import { MIN, METAL, NEON, chars, type Rng } from './util';

const STONE: Look = { wash: 0x94918a, line: 1 };
const CINNABAR: Look = { wash: 0xb8321f, line: 1, accent: true };
const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

function flagstones(k: Kit, x0: number, z0: number, x1: number, z1: number, y: number): void {
  k.quad(new Vector3(x0, y, z1), new Vector3(1, 0, 0), new Vector3(0, 0, -1), x1 - x0, z1 - z0, { wash: 0x8a8886, kind: K.flag, wet: 1, line: 0 });
}

/**
 * The Well's balustrade: plinth, carved panels, posts with lotus caps, a top rail; the ground line is heavier.
 * It runs along z at x = `at` (or along x at z = `at` when `alongX`), from `a0` down to `a1`.
 */
export function balustrade(k: Kit, at: number, a0: number, a1: number, y: number, alongX = false): void {
  const len = a0 - a1;
  const n = Math.max(1, Math.round(len / 2.3));
  const step = len / n;
  const bx = (p: number, yy: number, sAcross: number, sy: number, sAlong: number, lk: Look): void => {
    if (alongX) k.box(p, yy, at, sAlong, sy, sAcross, lk);
    else k.box(at, yy, p, sAcross, sy, sAlong, lk);
  };
  const px = (p: number): [number, number] => (alongX ? [p, at] : [at, p]);
  bx((a0 + a1) / 2, y, 0.62, 0.16, len, { ...STONE, line: 2 });
  for (let i = 0; i <= n; i++) {
    const p = a0 - i * step;
    const [cx, cz] = px(p);
    bx(p, y + 0.16, 0.36, 0.86, 0.36, STONE);
    k.cyl(cx, y + 1.02, cz, 0.16, 0.2, 0.1, 8, STONE);
    k.lathe(cx, y + 1.12, cz, [[0.2, 0], [0.22, 0.08], [0.19, 0.18], [0.1, 0.28], [0.02, 0.34]], 8, STONE, true, 0);
    if (i < n) {
      const pm = p - step / 2;
      bx(pm, y + 0.16, 0.16, 0.6, step - 0.36, { wash: 0x8c8983, kind: K.panel, line: 1 });
      bx(pm, y + 0.76, 0.26, 0.12, step - 0.3, STONE);
    }
  }
}

/** a hip roof with upturned corners, glazed tiles, a ridge with end-beasts, painted eaves and a neon eave tube */
export function hipRoof(ctx: Ctx, k: Kit, cx: number, y0: number, cz: number, w: number, d: number, h: number, up: number, tile: number, neon: number | null): void {
  const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
  const rx0 = x0 + d * 0.42, rx1 = x1 - d * 0.42;
  const yr = y0 + h;
  const tl: Look = { wash: tile, kind: K.tiles, line: 1, accent: true };
  const A = new Vector3(x0, y0 + up, z1), B = new Vector3(x1, y0 + up, z1), C = new Vector3(x1, y0 + up, z0), D = new Vector3(x0, y0 + up, z0);
  const mA = new Vector3(cx, y0, z1), mC = new Vector3(cx, y0, z0);
  const R0 = new Vector3(rx0, yr, cz), R1 = new Vector3(rx1, yr, cz);
  const slant = Math.hypot(h, d / 2);
  // each long slope in two halves so its eave sags to the middle (the curve of a Chinese roof)
  k.quad4(A, mA, new Vector3(cx, yr, cz), R0, w / 2, slant, tl, 0, 0, E.u0 | E.v0);
  k.quad4(mA, B, R1, new Vector3(cx, yr, cz), w / 2, slant, tl, 0, 0, E.u1 | E.v0);
  k.quad4(C, mC, new Vector3(cx, yr, cz), R1, w / 2, slant, tl, 0, 0, E.u0 | E.v0);
  k.quad4(mC, D, R0, new Vector3(cx, yr, cz), w / 2, slant, tl, 0, 0, E.u1 | E.v0);
  k.tri(D, A, R0, tl);
  k.tri(B, C, R1, tl);
  // painted soffit and the eave fascia
  k.quad4(D, C, B, A, w, d, { wash: MIN.azurite, line: 1, accent: true });
  k.box(cx, y0 - 0.22, z1 - 0.05, w - 0.2, 0.22, 0.12, { wash: MIN.lightMalachite, line: 1, accent: true });
  k.box(cx, y0 - 0.22, z0 + 0.05, w - 0.2, 0.22, 0.12, { wash: MIN.lightMalachite, line: 1, accent: true });
  // ridge + chiwen
  k.box((rx0 + rx1) / 2, yr - 0.05, cz, rx1 - rx0 + 0.3, 0.32, 0.3, { wash: 0x245e48, line: 1, accent: true });
  for (const rx of [rx0, rx1]) {
    k.box(rx, yr + 0.2, cz, 0.3, 0.5, 0.24, { wash: 0x245e48, line: 1, accent: true });
    k.box(rx + (rx === rx0 ? -0.12 : 0.12), yr + 0.5, cz, 0.12, 0.3, 0.14, { wash: METAL.gold, line: 1, accent: true });
  }
  if (neon !== null) {
    const f = new Vector3(0, 0.35, 1).normalize();
    const lift = new Vector3(0, 0.03, 0.03);
    ctx.signs.tube(A.clone().add(lift), mA.clone().add(lift), f, 0.07, neon, 4.5);
    ctx.signs.tube(mA.clone().add(lift), B.clone().add(lift), f, 0.07, neon, 4.5);
    ctx.signs.tube(A.clone().add(lift), R0.clone().add(lift), new Vector3(-1, 0.4, 0.3).normalize(), 0.06, neon, 4.5);
    ctx.signs.tube(B.clone().add(lift), R1.clone().add(lift), new Vector3(1, 0.4, 0.3).normalize(), 0.06, neon, 4.5);
  }
}

/** a row of dougong brackets on a beam top */
function dougong(k: Kit, x0: number, x1: number, y: number, z: number): void {
  const n = Math.max(2, Math.round((x1 - x0) / 0.55));
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    k.box(x, y, z, 0.26, 0.16, 0.5, { wash: i % 2 === 0 ? MIN.azurite : MIN.malachite, line: 0.9, accent: true });
    k.box(x, y + 0.16, z, 0.4, 0.12, 0.62, { wash: METAL.gold, line: 0.9, accent: true });
  }
}

function paifang(ctx: Ctx): void {
  const k = ctx.kit('paifang', true);
  const y = Y0;
  const z = GATE.z;
  const S = GATE.s;
  const [p0, p1, p2, p3] = GATE.posts;
  const posts: [number, number, number][] = [[p0, 0.3, 6.2], [p1, 0.38, 8.1], [p2, 0.38, 8.1], [p3, 0.3, 6.2]];
  for (const [px, r, h] of posts) {
    k.box(px, y, z, 1.4, 0.6, 1.5, { ...STONE, line: 2 });
    k.box(px, y + 0.6, z, 1.1, 1.1, 1.2, { wash: 0xc9c5bb, kind: K.panel, line: 1 });
    k.cyl(px, y + 1.7, z, r * S, r * S * 0.92, h * S - 1.7, 16, CINNABAR);
    for (const dz of [-1.2, 1.2]) {
      k.box(px, y + 0.6, z + dz, 0.6, 1.6, 0.75, { wash: 0xc9c5bb, kind: K.panel, line: 1 });
      k.lathe(px, y + 2.2, z + dz, [[0.3, 0], [0.34, 0.12], [0.26, 0.3], [0.12, 0.44], [0.02, 0.5]], 8, STONE, true, 0);
    }
  }
  const cx = GATE.x;
  // centre bay: two lintels with the big gold 九龍 plaque between, painted friezes
  const L1 = y + 6.7 * S, L2 = y + 5.0 * S;
  k.box(cx, L1, z, p2 - p1 + 1.5, 0.6 * S, 0.7, CINNABAR);
  k.box(cx, L1 + 0.04, z + 0.36, p2 - p1 + 1.2, 0.46 * S, 0.02, { wash: MIN.azurite, kind: K.panel, line: 1, accent: true });
  k.box(cx, L2, z, p2 - p1, 0.5 * S, 0.6, CINNABAR);
  k.box(cx, L2 + 0.04, z + 0.31, p2 - p1 - 0.3, 0.36 * S, 0.02, { wash: MIN.malachite, kind: K.panel, line: 1, accent: true });
  const plaqueY = (L1 + L2 + 0.5 * S) / 2;
  k.box(cx, plaqueY - 0.95, z, 3.3, 1.9, 0.34, { wash: 0x15110e, line: 1.3, accent: true });
  k.box(cx, plaqueY - 1.05, z, 3.6, 2.1, 0.2, { wash: METAL.gold, line: 1.2, gloss: true, accent: true });
  for (const sz of [1, -1]) {
    ctx.signs.place({ at: new Vector3(cx, plaqueY, z + sz * 0.18), normal: new Vector3(0, 0, sz), size: 1.02, spec: { text: '九龍', color: '#f3cd6c', vertical: false, style: 'plaque' }, gain: 1.9 }, null);
  }
  dougong(k, p1 - 0.5, p2 + 0.5, L1 + 0.3 * S, z);
  hipRoof(ctx, k, cx, L1 + S, z, p2 - p1 + 3.2, 3.1, 1.9, 0.6, 0x2f7d5e, NEON.red);
  hipRoof(ctx, k, cx, L1 + 3.05 * S, z, (p2 - p1) * 0.55, 2.2, 1.3, 0.45, 0x2f7d5e, null);
  k.box(cx, L1 + 2.2 * S, z, (p2 - p1) * 0.5, 0.7, 1.2, { wash: 0xb8321f, kind: K.panel, line: 1, accent: true });
  // side bays
  for (const [a, b] of [[p0, p1], [p2, p3]] as const) {
    const m = (a + b) / 2;
    const l1 = y + 4.75 * S, l2 = y + 3.85 * S;
    k.box(m, l1, z, b - a + 1.1, 0.55 * S, 0.62, CINNABAR);
    k.box(m, l1 + 0.03, z + 0.32, b - a + 0.8, 0.36 * S, 0.02, { wash: MIN.azurite, kind: K.panel, line: 1, accent: true });
    k.box(m, l2, z, b - a, 0.42 * S, 0.5, CINNABAR);
    k.box(m, l2 + 0.45 * S, z, b - a - 0.4, 0.6 * S, 0.24, { wash: MIN.lightMalachite, kind: K.panel, line: 1, accent: true });
    dougong(k, a - 0.3, b + 0.3, l1 + 0.55 * S, z);
    hipRoof(ctx, k, m, l1 + 1.2 * S, z, b - a + 2.5, 2.6, 1.45, 0.5, 0x2f7d5e, NEON.red);
  }
  // couplets on the two inner posts (white boards, black kai)
  ctx.signs.place({ at: new Vector3(p1, y + 3.6, z + 0.5), normal: new Vector3(0, 0, 1), size: 0.52, spec: { text: '萬家燈火', color: '#1a1614', vertical: true, style: 'paper', ink: '#ece7da' }, gain: 1.05 }, k);
  ctx.signs.place({ at: new Vector3(p2, y + 3.6, z + 0.5), normal: new Vector3(0, 0, 1), size: 0.52, spec: { text: '天下一家', color: '#1a1614', vertical: true, style: 'paper', ink: '#ece7da' }, gain: 1.05 }, k);
  // lanterns under every lintel
  for (let i = 0; i < 4; i++) ctx.lantern(p1 + 0.9 + i * ((p2 - p1 - 1.8) / 3), L2 - 0.3, z, 1.25);
  for (const [a, b] of [[p0, p1], [p2, p3]] as const) for (let i = 0; i < 2; i++) ctx.lantern(a + (b - a) * (0.3 + i * 0.4), y + 3.85 * S - 0.25, z, 1.05);
  ctx.map.push({ x0: p0 - 0.6, z0: z - 1.2, x1: p3 + 0.6, z1: z + 1.2, kind: 'gate' });
}

function banyan(ctx: Ctx, rng: Rng): void {
  const k = ctx.kit('banyan', true);
  const { x, z, r } = BANYAN;
  const y = Y0;
  // round stone planter, carved panels, a rim, dark soil
  k.cyl(x, y, z, r, r, 1.0, 22, { wash: 0xb3b0a7, kind: K.panel, line: 1 }, { caps: false, edges: E.all });
  k.cyl(x, y + 1.0, z, r + 0.18, r + 0.18, 0.16, 22, STONE, { edges: E.rims });
  k.cyl(x, y + 0.98, z, r - 0.05, r - 0.05, 0.12, 22, { wash: 0x3a3228, line: 0 }, { edges: E.none });
  const bark: Look = { wash: 0x5b4a3a, line: 0 };
  const bark2: Look = { wash: 0x4a3c30, line: 0 };
  const ground = y + 1.1;
  const L = (a: Vector3, b: Vector3, r0: number, r1: number, lk: Look): void => { k.limb(a, b, r0, r1, 8, lk, E.none, true); };
  // a gnarled trunk: five strands twisting up and fusing into the crown
  const crown = new Vector3(x + 0.2, ground + 5.6, z - 0.2);
  for (let i = 0; i < 5; i++) {
    const a0 = (i / 5) * Math.PI * 2;
    let prev = new Vector3(x + Math.cos(a0) * 0.75, ground, z + Math.sin(a0) * 0.75);
    for (let j = 1; j <= 4; j++) {
      const t = j / 4;
      const a1 = a0 + t * 1.6;
      const rad = 0.75 * (1 - t) + 0.25 * t;
      const next = new Vector3(x + Math.cos(a1) * rad, ground + t * 5.6, z + Math.sin(a1) * rad).lerp(crown, t * t * 0.6);
      L(prev, next, 0.42 - t * 0.12, 0.36 - t * 0.1, i % 2 === 0 ? bark : bark2);
      prev = next;
    }
  }
  // buttress roots gripping the planter and draping over its rim
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + rng.range(-0.15, 0.15);
    const mid = new Vector3(x + Math.cos(a) * 1.9, ground + 0.25, z + Math.sin(a) * 1.9);
    L(new Vector3(x + Math.cos(a) * 0.6, ground + 1.4, z + Math.sin(a) * 0.6), mid, 0.3, 0.2, bark);
    L(mid, new Vector3(x + Math.cos(a) * (r + 0.25), ground + 0.05, z + Math.sin(a) * (r + 0.25)), 0.2, 0.1, bark2);
    if (i % 2 === 0) L(new Vector3(x + Math.cos(a) * (r + 0.25), ground + 0.05, z + Math.sin(a) * (r + 0.25)), new Vector3(x + Math.cos(a) * (r + 0.4), y + 0.2, z + Math.sin(a) * (r + 0.4)), 0.1, 0.07, bark2);
  }
  // limbs spreading wide, each forking
  const tips: Vector3[] = [];
  const nodes: Vector3[] = [];
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + rng.range(-0.2, 0.2);
    const reach = rng.range(4.2, 6.6);
    const mid = crown.clone().add(new Vector3(Math.cos(a) * reach * 0.5, rng.range(1.2, 2.4), Math.sin(a) * reach * 0.45));
    const tip = crown.clone().add(new Vector3(Math.cos(a) * reach, rng.range(2.2, 4.4), Math.sin(a) * reach * 0.85));
    L(crown, mid, 0.34, 0.22, bark);
    L(mid, tip, 0.22, 0.09, bark);
    const fork = tip.clone().add(new Vector3(rng.range(-1.5, 1.5), rng.range(0.5, 1.6), rng.range(-1.5, 1.5)));
    L(mid.clone().lerp(tip, 0.5), fork, 0.12, 0.05, bark2);
    tips.push(tip, fork);
    nodes.push(mid, mid.clone().lerp(tip, 0.5), tip);
  }
  // aerial roots: dozens of strands falling from the limbs, some to the soil
  for (let i = 0; i < 70; i++) {
    const p = rng.pick(nodes).clone().add(new Vector3(rng.range(-0.6, 0.6), -0.1, rng.range(-0.6, 0.6)));
    const reachGround = rng.chance(0.35);
    const len = reachGround ? p.y - ground : rng.range(1.5, Math.max(1.6, (p.y - ground) * 0.8));
    const bend = new Vector3(rng.range(-0.25, 0.25), 0, rng.range(-0.25, 0.25));
    const m1 = p.clone().add(new Vector3(0, -len * 0.5, 0)).add(bend);
    const r0 = rng.range(0.025, 0.06);
    k.limb(p, m1, r0, r0 * 0.9, 4, { wash: 0x3e3226, line: 0 }, E.none, true);
    k.limb(m1, p.clone().add(new Vector3(0, -len, 0)).add(bend.clone().multiplyScalar(0.4)), r0 * 0.9, r0 * 0.6, 4, { wash: 0x3e3226, line: 0 }, E.none, true);
  }
  // the canopy: three layers of leaf pads, smooth-shaded, each drawn as gongbi leaves
  const ico = new IcosahedronGeometry(1, 2);
  const pos = ico.getAttribute('position').array;
  const greens = [0x2f6a48, 0x3a7a52, 0x285c40, 0x4a8a5c, 0x23553b, 0x356f4c, 0x437f52] as const;
  const pads: [Vector3, number][] = [];
  for (const t of tips) pads.push([t.clone().add(new Vector3(0, 0.6, 0)), rng.range(1.9, 2.8)]);
  for (let i = 0; i < 90; i++) {
    const a = rng.range(0, Math.PI * 2);
    const rr = Math.sqrt(rng.next()) * 6.2;
    pads.push([new Vector3(x + Math.cos(a) * rr, ground + 8.4 + rng.range(-1.4, 2.6) - rr * rr * 0.03, z + Math.sin(a) * rr * 0.9), rng.range(0.9, 1.7)]);
  }
  for (const [c, s] of pads) {
    k.blob(pos, null, c.x, c.y, c.z, s * 1.15, s * 0.78, s * 1.05, { wash: rng.pick(greens), kind: K.leaf, line: 0, accent: true }, true);
  }
  // red wish ribbons
  for (let i = 0; i < 60; i++) {
    const p = rng.pick(nodes).clone().add(new Vector3(rng.range(-0.8, 0.8), -rng.range(0.1, 0.6), rng.range(-0.8, 0.8)));
    const d = new Vector3(rng.range(-1, 1), 0, rng.range(-1, 1)).normalize();
    const h = rng.range(0.5, 1.0);
    k.quad(p.clone().add(new Vector3(0, -h, 0)), d, new Vector3(0, 1, 0), 0.09, h, { wash: 0xd23a26, line: 0.4, accent: true });
    k.quad(p.clone().add(new Vector3(0, -h, 0)).addScaledVector(d, 0.09), d.clone().negate(), new Vector3(0, 1, 0), 0.09, h, { wash: 0xd23a26, line: 0.4, accent: true });
  }
  for (let i = 0; i < 6; i++) { const t = rng.pick(nodes); ctx.lantern(t.x, t.y - 0.3, t.z, 0.8); }
  // the earth-god shrine at the planter's front
  const sx = x - 1.4, sz = z + r + 0.55;
  k.box(sx, y, sz, 1.3, 0.9, 0.8, { wash: 0xb3b0a7, kind: K.panel, line: 1 });
  k.box(sx, y + 0.9, sz, 1.0, 1.1, 0.65, { wash: 0x9c2a1c, line: 1, accent: true });
  k.box(sx, y + 1.0, sz + 0.33, 0.62, 0.8, 0.02, { wash: 0x3a0e0a, line: 1, accent: true });
  k.box(sx, y + 1.05, sz + 0.36, 0.24, 0.42, 0.06, { wash: METAL.gold, emit: 0.7, line: 0.8, accent: true });
  hipRoof(ctx, k, sx, y + 2.05, sz, 1.5, 1.1, 0.5, 0.14, 0x2f7d5e, null);
  for (const dx of [-0.35, 0.35]) k.box(sx + dx, y + 0.9, sz + 0.45, 0.06, 0.26, 0.06, { wash: 0xff4a2a, emit: 2.5, line: 0.4, accent: true });
  ctx.signs.place({ at: new Vector3(sx - 0.62, y + 1.5, sz + 0.34), normal: new Vector3(0, 0, 1), size: 0.18, spec: { text: '福德正神', color: '#f0c86a', vertical: true, style: 'paper', ink: '#8e1f14' }, gain: 1.1 }, null);
  k.box(x + 2.6, y, z + r + 0.2, 0.8, 3.2, 0.5, { wash: 0xb9b5ab, kind: K.panel, line: 1 });
  ctx.signs.place({ at: new Vector3(x + 2.6, y + 1.9, z + r + 0.47), normal: new Vector3(0, 0, 1), size: 0.52, spec: { text: '九龍城', color: '#2a2320', vertical: true, style: 'paper', ink: '#c8c3b6' }, gain: 1.0 }, null);
  ctx.map.push({ x0: x - r, z0: z - r, x1: x + r, z1: z + r, kind: 'green' });
  ctx.steam.push(new Vector3(sx - 0.1, y + 1.3, sz + 0.5));
}

function noodleStall(ctx: Ctx, rng: Rng): void {
  const k = ctx.kit('stall', true);
  const { x0, x1, z0, z1 } = STALL;
  const y = Y0;
  const xc = (x0 + x1) / 2;
  // the counter faces the square (south); the cooks work behind it, the customers sit on stools in front
  k.box(xc, y, z1 - 0.5, x1 - x0 - 1, 1.0, 1.0, { wash: 0x8f5a36, kind: K.panel, line: 1, accent: true });
  k.box(xc, y + 1.0, z1 - 0.5, x1 - x0 - 0.8, 0.08, 1.25, { wash: 0xb9b7b0, line: 1 });
  for (const xx of [x0 + 0.2, x1 - 0.2]) k.box(xx, y, z1 + 0.2, 0.14, 3.3, 0.14, { wash: 0x2a2c31, line: 1 });
  k.quad4(new Vector3(x0, y + 3.0, z1 + 1.1), new Vector3(x1, y + 3.0, z1 + 1.1), new Vector3(x1, y + 3.9, z0), new Vector3(x0, y + 3.9, z0),
    x1 - x0, 5.2, { wash: 0xc23b22, kind: K.cloth, row: 1, col: 0.55, line: 1, accent: true });
  // warm light inside: the stall's back wall glows
  k.box(xc, y + 1.2, z0 + 0.3, x1 - x0 - 1.2, 2.2, 0.2, { wash: 0xe8b070, emit: 0.55, kind: K.facade, row: 0.55, col: 0.7, seed: 5, line: 1, accent: true });
  for (let i = 0; i < 4; i++) {
    const px = x0 + 1.3 + i * ((x1 - x0 - 2.6) / 3);
    k.cyl(px, y + 1.08, z1 - 0.55, 0.34, 0.34, 0.42, 12, { wash: 0x9da3aa, line: 1, gloss: true });
    ctx.steam.push(new Vector3(px, y + 1.6, z1 - 0.55));
  }
  for (let i = 0; i < 6; i++) k.cyl(x0 + 1.2 + (i % 3) * 2.4, y + 1.5 + Math.floor(i / 3) * 0.45, z0 + 0.8, 0.2, 0.12, 0.12, 8, { wash: 0xf2eee4, line: 0.8 });
  person(k, rng, xc - 1.5, y, z1 - 1.6, 0, 'cook');
  person(k, rng, xc + 2.0, y, z1 - 1.7, 0.2, 'cook');
  for (let i = 0; i < 3; i++) {
    const sx = x0 + 1.4 + i * 2.6;
    stool(k, sx, y, z1 + 0.8, 0xb8352a);
    if (i !== 1) person(k, rng, sx, y, z1 + 0.8, Math.PI, 'sit');
  }
  // the signs: a big lightbox 麵 hanging at the front corner, a neon line along the awning
  ctx.signs.place({ at: new Vector3(x0 + 0.3, y + 5.2, z1 + 1.3), normal: new Vector3(0, 0, 1), size: 1.45, spec: { text: '麵', color: '#fff1dc', vertical: true, style: 'box' }, gain: 2.0, board: 0xa8261a, blade: true }, k);
  ctx.signs.place({ at: new Vector3(xc + 1.2, y + 4.6, z0 + 0.4), normal: new Vector3(0, 0, 1), size: 0.62, spec: { text: '重慶小麵', color: hex(NEON.red), vertical: false, style: 'tube' }, gain: 5 }, k);
  ctx.map.push({ x0, z0, x1, z1, kind: 'block' });
}

/** steel lattice sign masts on the Well's lip, blade signs hung out over the drop, a dragon hook on top */
function signMasts(ctx: Ctx): void {
  const k = ctx.kit('masts', true);
  const steel: Look = { wash: 0x3a3d44, line: 0.8 };
  const masts: { z: number; x: number; signs: { text: string; color: number; y: number; size: number; flicker?: number }[] }[] = [
    { z: -6, x: -1.0, signs: [{ text: '九龍', color: NEON.red, y: 16.4, size: 1.5 }] },
    { z: -13, x: -3.2, signs: [{ text: '牙科', color: NEON.cyan, y: 14.6, size: 1.3 }, { text: '火鍋', color: NEON.red, y: 9.4, size: 1.25 }] },
    { z: -20, x: -1.4, signs: [{ text: '茶', color: NEON.jade, y: 11.6, size: 1.45 }, { text: '藥房', color: NEON.magenta, y: 7.2, size: 1.05 }] },
    { z: -28, x: -3.6, signs: [{ text: '麻雀', color: NEON.red, y: 13.4, size: 1.15 }, { text: '當舖', color: NEON.jade, y: 8.2, size: 0.95 }] },
  ];
  for (const m of masts) {
    const mx = m.x, mz = m.z;
    const top = Y0 + 20.5;
    // a slim twin-pole mast with ladder ties (a lattice would stand in front of the signs behind it)
    for (const dx of [-0.16, 0.16]) k.beam(new Vector3(mx + dx, Y0 - 3, mz), new Vector3(mx + dx, top, mz), 0.1, 0.1, steel);
    for (let yy = Y0 - 2; yy < top - 1; yy += 1.4) k.beam(new Vector3(mx - 0.16, yy, mz), new Vector3(mx + 0.16, yy, mz), 0.05, 0.05, steel);
    for (const s of m.signs) {
      const n = chars(s.text).length;
      const h = s.size * (n + 0.62);
      const cy = Y0 + s.y - h / 2;
      // hung just south of the mast (in front of it from the square), out over the Well on a bracket
      const sx = mx - 0.35 - s.size * 0.68, sz = mz + 0.75;
      k.beam(new Vector3(mx, Y0 + s.y + 0.3, mz), new Vector3(mx, Y0 + s.y + 0.3, sz), 0.1, 0.1, steel);
      k.beam(new Vector3(mx, Y0 + s.y + 0.3, sz), new Vector3(sx - s.size * 0.68, Y0 + s.y + 0.3, sz), 0.12, 0.12, steel);
      ctx.signs.place({ at: new Vector3(sx, cy, sz), normal: new Vector3(0, 0, 1), size: s.size, spec: { text: s.text, color: hex(s.color), vertical: true, style: 'tube' }, blade: true, flicker: s.flicker ?? 0 }, k);
    }
    dragonHook(k, ctx, new Vector3(mx - 0.3, top - 0.6, mz), new Vector3(-1, 0, 0.25), 0.8);
  }
}

function lanternString(ctx: Ctx, a: Vector3, b: Vector3, spacing: number, k: Kit): void {
  const len = a.distanceTo(b);
  const n = Math.max(2, Math.round(len / spacing));
  const sag = len * 0.07;
  const at = (t: number): Vector3 => a.clone().lerp(b, t).add(new Vector3(0, -sag * 4 * t * (1 - t), 0));
  for (let i = 0; i < n; i++) k.beam(at(i / n), at((i + 1) / n), 0.02, 0.02, { wash: 0x2a2c31, line: 0.5 });
  for (let i = 1; i < n; i++) { const p = at(i / n); ctx.lantern(p.x, p.y, p.z, 0.75); }
}

export function buildSquare(ctx: Ctx): void {
  const rng = ctx.rng;
  const floor = ctx.kit('plaza');
  flagstones(floor, PLAZA.x0, PLAZA.z0, PLAZA.x1, PLAZA.z1, Y0);
  flagstones(floor, STREET.x0, STREET.z0, STREET.x1, STREET.z1, Y0);
  // the plaza's lip over the Well
  floor.box(PLAZA.x0 - 0.3, Y0 - 1.4, (PLAZA.z0 + PLAZA.z1) / 2, 0.6, 1.4, PLAZA.z1 - PLAZA.z0, { wash: 0x8d8f93, line: 1.5 });
  const props = ctx.kit('props', true);
  balustrade(props, PLAZA.x0 + 0.2, PLAZA.z1, PLAZA.z0, Y0);
  balustrade(props, STREET.x0 + 0.2, PLAZA.z0 - 0.1, WELL.z0, Y0);
  ctx.map.push({ x0: PLAZA.x0, z0: PLAZA.z0, x1: PLAZA.x1, z1: PLAZA.z1, kind: 'plaza' });
  ctx.map.push({ x0: STREET.x0, z0: -140, x1: STREET.x1, z1: STREET.z1, kind: 'street' });
  paifang(ctx);
  banyan(ctx, rng);
  noodleStall(ctx, rng);
  signMasts(ctx);
  // mahjong under the banyan's edge
  mahjong(props, rng, 10.2, Y0, -16.8, 0.2, 4);
  mahjong(props, rng, 13.4, Y0, -12.6, -0.3, 3);
  mahjong(props, rng, 10.0, Y0, -9.6, 0.1, 4);
  mahjong(props, rng, 14.4, Y0, -6.8, 0.5, 2);
  // the crowd: under and through the gate, along the street, by the balustrade
  const crowd = ctx.kit('crowd');
  for (let i = 0; i < 34; i++) {
    const z = rng.range(-95, -33);
    const x = rng.range(STREET.x0 + 1.5, STREET.x1 - 1.2);
    if ((x - 7) ** 2 + (z + 52) ** 2 < 16) continue; // keep the canyon-up camera clear
    person(crowd, rng, x, Y0, z, rng.chance(0.5) ? 0 : Math.PI + rng.range(-0.3, 0.3), 'stand', rng.chance(0.35));
  }
  for (let i = 0; i < 6; i++) person(crowd, rng, rng.range(2.5, 7), Y0, rng.range(-19, -6), rng.range(0, 6.28), 'stand', rng.chance(0.4));
  // the evening crowd on the square: walkers under oil-paper umbrellas, loiterers, a queue at the stall
  for (let i = 0; i < 22; i++) {
    const x = rng.range(2.6, 9), z = rng.range(-23, -4);
    const bx = x - BANYAN.x, bz = z - BANYAN.z;
    if (bx * bx + bz * bz < (BANYAN.r + 1) ** 2) continue;
    if (x > 8.4 && z > -19 && z < -5) continue;
    person(crowd, rng, x, Y0, z, rng.range(0, 6.28), 'stand', rng.chance(0.45));
  }
  for (let i = 0; i < 6; i++) person(crowd, rng, STALL.x0 + 0.8 + i * 1.1, Y0, STALL.z1 + 2.2 + rng.range(-0.3, 0.3), Math.PI + rng.range(-0.4, 0.4), 'stand', rng.chance(0.3));
  person(crowd, rng, 1.0, Y0, -11.5, Math.PI / 2 + 0.2, 'stand', false);
  person(crowd, rng, 1.1, Y0, -13.0, Math.PI / 2 - 0.3, 'stand', true);
  scooter(props, 20.4, Y0, 13.5, 0.3, 0x2e5fa3);
  scooter(props, 20.9, Y0, 15.4, 0.2, 0xb8321f);
  scooter(props, 20.6, Y0, -4.5, 1.2, 0x7fbf9a);
  // lamps and lantern strings
  lamp(props, 1.1, Y0, 12, 4.2);
  lamp(props, 1.1, Y0, -9, 4.2);
  lamp(props, 1.1, Y0, -19, 4.2);
  lamp(props, 21, Y0, -6, 4.2);
  const str = ctx.kit('strings', true);
  lanternString(ctx, new Vector3(GATE.x + 4, Y0 + 12.2, GATE.z + 0.5), new Vector3(22.6, Y0 + 12.5, -22), 1.9, str);
  lanternString(ctx, new Vector3(-1.2, Y0 + 10.4, -26), new Vector3(GATE.x - 1, Y0 + 11, GATE.z + 0.5), 1.8, str);
  lanternString(ctx, new Vector3(GATE.x + 4, Y0 + 9.8, GATE.z + 0.6), new Vector3(22.6, Y0 + 9.6, -28), 1.8, str);
  lanternString(ctx, new Vector3(-1.2, Y0 + 9.2, -12), new Vector3(22.6, Y0 + 9.6, -9), 2.2, str);
  for (let z = -26; z > -150; z -= 6) lanternString(ctx, new Vector3(STREET.x0 - 0.2, Y0 + 6.5 + (z % 3), z), new Vector3(STREET.x1 + 0.2, Y0 + 7.2, z - 1.5), 1.8, str);
}
