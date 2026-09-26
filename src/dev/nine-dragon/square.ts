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
  k.quad(new Vector3(x0, y, z1), new Vector3(1, 0, 0), new Vector3(0, 0, -1), x1 - x0, z1 - z0, { wash: 0xa8a8a2, kind: K.flag, wet: 1, line: 0 });
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
  const [p0, p1, p2, p3] = GATE.posts;
  const posts: [number, number, number][] = [[p0, 0.28, 6.1], [p1, 0.36, 8.0], [p2, 0.36, 8.0], [p3, 0.28, 6.1]];
  for (const [px, r, h] of posts) {
    k.box(px, y, z, 1.15, 0.5, 1.2, { ...STONE, line: 2 });
    k.box(px, y + 0.5, z, 0.9, 0.9, 1.0, { wash: 0xc9c5bb, kind: K.panel, line: 1 });
    k.cyl(px, y + 1.4, z, r, r * 0.92, h - 1.4, 14, CINNABAR);
    // drum stones braced front and back
    k.box(px, y + 0.5, z - 0.95, 0.5, 1.3, 0.6, { wash: 0xc9c5bb, kind: K.panel, line: 1 });
    k.box(px, y + 0.5, z + 0.95, 0.5, 1.3, 0.6, { wash: 0xc9c5bb, kind: K.panel, line: 1 });
  }
  const cx = GATE.x;
  // centre bay: two lintels with the plaque between, a painted frieze
  k.box(cx, y + 6.7, z, p2 - p1 + 1.3, 0.55, 0.6, CINNABAR);
  k.box(cx, y + 6.72, z + 0.31, p2 - p1 + 1.0, 0.4, 0.02, { wash: MIN.azurite, line: 1, accent: true });
  k.box(cx, y + 5.0, z, p2 - p1, 0.45, 0.5, CINNABAR);
  k.box(cx, y + 5.03, z + 0.26, p2 - p1 - 0.3, 0.3, 0.02, { wash: MIN.malachite, line: 1, accent: true });
  k.box(cx, y + 5.45, z, 2.9, 1.25, 0.3, { wash: 0x15110e, line: 1.2, accent: true });
  ctx.signs.place({ at: new Vector3(cx, y + 6.07, z + 0.16), normal: new Vector3(0, 0, 1), size: 0.52, spec: { text: '九龍疊城', color: '#f0c86a', vertical: false, style: 'plaque' }, gain: 1.6 }, null);
  ctx.signs.place({ at: new Vector3(cx, y + 6.07, z - 0.16), normal: new Vector3(0, 0, -1), size: 0.52, spec: { text: '九龍疊城', color: '#f0c86a', vertical: false, style: 'plaque' }, gain: 1.6 }, null);
  dougong(k, p1 - 0.4, p2 + 0.4, y + 6.98, z);
  hipRoof(ctx, k, cx, y + 7.55, z, p2 - p1 + 2.5, 2.5, 1.55, 0.45, 0x2f7d5e, NEON.red);
  // side bays
  for (const [a, b] of [[p0, p1], [p2, p3]] as const) {
    const m = (a + b) / 2;
    k.box(m, y + 4.75, z, b - a + 0.9, 0.46, 0.52, CINNABAR);
    k.box(m, y + 4.77, z + 0.27, b - a + 0.6, 0.3, 0.02, { wash: MIN.azurite, line: 1, accent: true });
    k.box(m, y + 3.85, z, b - a, 0.36, 0.44, CINNABAR);
    k.box(m, y + 4.21, z, b - a - 0.4, 0.54, 0.2, { wash: MIN.lightMalachite, kind: K.panel, line: 1, accent: true });
    dougong(k, a - 0.2, b + 0.2, y + 5.21, z);
    hipRoof(ctx, k, m, y + 5.72, z, b - a + 2.0, 2.1, 1.2, 0.38, 0x2f7d5e, NEON.red);
  }
  // couplets on the two inner posts (white boards, black kai)
  ctx.signs.place({ at: new Vector3(p1, y + 3.1, z + 0.36), normal: new Vector3(0, 0, 1), size: 0.42, spec: { text: '萬家燈火', color: '#1a1614', vertical: true, style: 'paper', ink: '#ece7da' }, gain: 1.05 }, k);
  ctx.signs.place({ at: new Vector3(p2, y + 3.1, z + 0.36), normal: new Vector3(0, 0, 1), size: 0.42, spec: { text: '天下一家', color: '#1a1614', vertical: true, style: 'paper', ink: '#ece7da' }, gain: 1.05 }, k);
  // lanterns under the lintels
  for (let i = 0; i < 3; i++) ctx.lantern(p1 + 0.9 + i * 1.3, y + 4.75, z, 1.05);
  ctx.lantern(p0 + 0.9, y + 3.65, z, 0.9);
  ctx.lantern(p0 + 2.5, y + 3.65, z, 0.9);
  ctx.lantern(p2 + 0.9, y + 3.65, z, 0.9);
  ctx.lantern(p2 + 2.5, y + 3.65, z, 0.9);
  ctx.map.push({ x0: p0 - 0.6, z0: z - 1.2, x1: p3 + 0.6, z1: z + 1.2, kind: 'gate' });
}

function banyan(ctx: Ctx, rng: Rng): void {
  const k = ctx.kit('banyan', true);
  const { x, z, r } = BANYAN;
  const y = Y0;
  // round stone planter, carved panels, a rim
  k.cyl(x, y, z, r, r, 1.0, 22, { wash: 0xb3b0a7, kind: K.panel, line: 1 }, { caps: false, edges: E.all });
  k.cyl(x, y + 1.0, z, r + 0.18, r + 0.18, 0.16, 22, STONE, { edges: E.rims });
  k.cyl(x, y + 0.98, z, r - 0.05, r - 0.05, 0.12, 22, { wash: 0x3a3228, line: 0 }, { edges: E.none });
  const bark: Look = { wash: 0x5b4a3a, line: 0 };
  const ground = y + 1.1;
  // buttress roots and the trunk
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    const foot = new Vector3(x + Math.cos(a) * 2.2, ground, z + Math.sin(a) * 2.2);
    k.limb(foot, new Vector3(x + Math.cos(a) * 0.5, ground + 3.2, z + Math.sin(a) * 0.5), 0.35, 0.28, 6, bark);
  }
  k.limb(new Vector3(x, ground, z), new Vector3(x + 0.3, ground + 6.5, z - 0.2), 1.05, 0.62, 10, bark);
  const crown = new Vector3(x + 0.3, ground + 6.2, z - 0.2);
  const tips: Vector3[] = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rng.range(-0.2, 0.2);
    const reach = rng.range(4.5, 8);
    const tip = new Vector3(x + Math.cos(a) * reach, ground + rng.range(7.5, 10.5), z + Math.sin(a) * reach * 0.85);
    const mid = crown.clone().lerp(tip, 0.5).add(new Vector3(0, 1.0, 0));
    k.limb(crown, mid, 0.42, 0.28, 6, bark);
    k.limb(mid, tip, 0.28, 0.12, 5, bark);
    tips.push(tip);
  }
  // aerial roots: ruled dark strands falling from the limbs
  for (let i = 0; i < 34; i++) {
    const t = rng.pick(tips);
    const p = crown.clone().lerp(t, rng.range(0.35, 0.95));
    const len = rng.range(3.0, p.y - ground - 0.2);
    k.beam(p, p.clone().add(new Vector3(0, -len, 0)), 0.05, 0.05, { wash: 0x3e3226, line: 0.6 });
  }
  // canopy: gongbi leaf masses
  const ico = new IcosahedronGeometry(1, 1);
  const pos = ico.getAttribute('position').array;
  const greens = [0x2f6a48, 0x3a7a52, 0x285c40, 0x4a8a5c, 0x23553b, 0x356f4c] as const;
  for (let i = 0; i < 150; i++) {
    const a = rng.range(0, Math.PI * 2);
    const rr = Math.sqrt(rng.next()) * 9.4;
    const cx2 = x + Math.cos(a) * rr, cz2 = z + Math.sin(a) * rr * 0.9;
    const cy = ground + 8.8 + rng.range(-1.2, 2.2) - rr * rr * 0.03;
    const s = rng.range(0.9, 1.8);
    const sd = rng.range(0, 10);
    const lumpy = Array.from(pos, (_, j) => {
      const b = j - (j % 3);
      const px = pos[b] ?? 0, py = pos[b + 1] ?? 0, pz = pos[b + 2] ?? 0;
      const d = 1 + 0.28 * Math.sin(px * 5.3 + sd) * Math.sin(py * 4.1 + sd * 2) * Math.sin(pz * 4.7 + sd * 3) + 0.12 * Math.sin(px * 11 + py * 9 + sd);
      return (pos[j] ?? 0) * d;
    });
    k.blob(lumpy, null, cx2, cy, cz2, s * 1.3, s * 0.6, s * 1.1, { wash: rng.pick(greens), kind: K.leaf, line: 0, accent: true });
  }
  // red wish ribbons
  for (let i = 0; i < 40; i++) {
    const t = rng.pick(tips);
    const p = crown.clone().lerp(t, rng.range(0.4, 1.0)).add(new Vector3(0, -rng.range(0.2, 0.8), 0));
    const d = new Vector3(rng.range(-1, 1), 0, rng.range(-1, 1)).normalize();
    k.quad(p.clone().add(new Vector3(0, -0.8, 0)), d, new Vector3(0, 1, 0), 0.08, 0.8, { wash: 0xd23a26, line: 0.4, accent: true });
  }
  // the earth-god shrine at the planter's front
  const sx = x - 1.4, sz = z + r + 0.55;
  k.box(sx, y, sz, 1.3, 0.9, 0.8, { wash: 0xb3b0a7, kind: K.panel, line: 1 });
  k.box(sx, y + 0.9, sz, 1.0, 1.1, 0.65, { wash: 0x9c2a1c, line: 1, accent: true });
  k.box(sx, y + 1.0, sz + 0.33, 0.62, 0.8, 0.02, { wash: 0x3a0e0a, line: 1, accent: true });
  k.box(sx, y + 1.05, sz + 0.36, 0.24, 0.42, 0.06, { wash: METAL.gold, emit: 0.7, line: 0.8, accent: true });
  hipRoof(ctx, k, sx, y + 2.05, sz, 1.5, 1.1, 0.5, 0.14, 0x2f7d5e, null);
  for (const dx of [-0.35, 0.35]) k.box(sx + dx, y + 0.9, sz + 0.45, 0.06, 0.26, 0.06, { wash: 0xff4a2a, emit: 2.5, line: 0.4, accent: true });
  ctx.signs.place({ at: new Vector3(sx - 0.62, y + 1.5, sz + 0.34), normal: new Vector3(0, 0, 1), size: 0.18, spec: { text: '福德正神', color: '#f0c86a', vertical: true, style: 'paper', ink: '#8e1f14' }, gain: 1.1 }, null);
  // stone pillar banner beside the planter
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
  const masts: { z: number; signs: { text: string; color: number; y: number; size: number; flicker?: number }[] }[] = [
    { z: 2.5, signs: [{ text: '九龍', color: NEON.red, y: 11.5, size: 1.45 }, { text: '旅館', color: NEON.amber, y: 6.4, size: 1.05, flicker: 0.37 }] },
    { z: -9.5, signs: [{ text: '牙科', color: NEON.cyan, y: 10.2, size: 1.1 }, { text: '火鍋', color: NEON.red, y: 5.6, size: 1.05 }] },
    { z: -20.5, signs: [{ text: '茶', color: NEON.jade, y: 9.6, size: 1.2 }, { text: '藥房', color: NEON.magenta, y: 5.2, size: 0.95 }] },
  ];
  for (const m of masts) {
    const mx = -2.4, mz = m.z;
    const top = Y0 + 16;
    for (const [dx, dz] of [[-0.3, -0.3], [0.3, -0.3], [0.3, 0.3], [-0.3, 0.3]] as const) {
      k.beam(new Vector3(mx + dx, Y0 - 3, mz + dz), new Vector3(mx + dx * 0.6, top, mz + dz * 0.6), 0.09, 0.09, steel);
    }
    for (let yy = Y0 - 2; yy < top - 1; yy += 1.6) {
      k.beam(new Vector3(mx - 0.29, yy, mz + 0.29), new Vector3(mx + 0.29, yy + 1.6, mz + 0.29), 0.04, 0.04, steel);
      k.beam(new Vector3(mx - 0.29, yy, mz - 0.29), new Vector3(mx - 0.29, yy + 1.6, mz + 0.29), 0.04, 0.04, steel);
    }
    for (const s of m.signs) {
      const n = chars(s.text).length;
      const h = s.size * (n + 0.62);
      const cy = Y0 + s.y - h / 2;
      const sx = mx - 0.55 - s.size * 0.68;
      k.beam(new Vector3(mx, Y0 + s.y + 0.3, mz), new Vector3(sx - s.size * 0.68, Y0 + s.y + 0.3, mz), 0.12, 0.12, steel);
      k.beam(new Vector3(mx, Y0 + s.y - 1.4, mz), new Vector3(sx, Y0 + s.y + 0.3, mz), 0.06, 0.06, steel);
      ctx.signs.place({ at: new Vector3(sx, cy, mz), normal: new Vector3(0, 0, 1), size: s.size, spec: { text: s.text, color: hex(s.color), vertical: true, style: 'tube' }, blade: true, flicker: s.flicker ?? 0 }, k);
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
  mahjong(props, rng, 9.4, Y0, -11.4, 0.2, 4);
  mahjong(props, rng, 12.8, Y0, -8.2, -0.3, 3);
  mahjong(props, rng, 9.9, Y0, -5.4, 0.1, 4);
  mahjong(props, rng, 13.6, Y0, -3.0, 0.5, 2);
  // the crowd: under and through the gate, along the street, by the balustrade
  const crowd = ctx.kit('crowd');
  for (let i = 0; i < 26; i++) {
    const z = rng.range(-78, -18);
    const x = rng.range(STREET.x0 + 1.5, STREET.x1 - 1.2);
    person(crowd, rng, x, Y0, z, rng.chance(0.5) ? 0 : Math.PI + rng.range(-0.3, 0.3), 'stand', rng.chance(0.35));
  }
  for (let i = 0; i < 6; i++) person(crowd, rng, rng.range(2.5, 7), Y0, rng.range(-19, -6), rng.range(0, 6.28), 'stand', rng.chance(0.4));
  person(crowd, rng, 1.0, Y0, -11.5, Math.PI / 2 + 0.2, 'stand', false);
  person(crowd, rng, 1.1, Y0, -13.0, Math.PI / 2 - 0.3, 'stand', true);
  scooter(props, 27.4, Y0, 13.5, 0.3, 0x2e5fa3);
  scooter(props, 27.9, Y0, 15.4, 0.2, 0xb8321f);
  scooter(props, 22.0, Y0, -20.5, 1.2, 0x7fbf9a);
  // lamps and lantern strings
  lamp(props, 1.1, Y0, 12, 4.2);
  lamp(props, 1.1, Y0, -3, 4.2);
  lamp(props, 28.8, Y0, -16, 4.2);
  const str = ctx.kit('strings', true);
  lanternString(ctx, new Vector3(-1.1, Y0 + 9.2, 2.5), new Vector3(30, Y0 + 9.5, -1), 2.6, str);
  lanternString(ctx, new Vector3(GATE.x + 3, Y0 + 8.5, GATE.z), new Vector3(30, Y0 + 8.8, -15), 2.4, str);
  lanternString(ctx, new Vector3(-1.1, Y0 + 12.2, -9.5), new Vector3(GATE.x - 3, Y0 + 9.2, GATE.z), 2.4, str);
  for (let z = -32; z > -140; z -= 10) lanternString(ctx, new Vector3(STREET.x0 - 0.2, Y0 + 7 + (z % 3), z), new Vector3(STREET.x1 + 0.2, Y0 + 7.5, z - 2), 2.0, str);
}
