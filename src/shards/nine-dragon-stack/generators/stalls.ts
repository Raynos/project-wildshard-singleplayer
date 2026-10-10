// Dome B (E169, round-10-dome-b): the noodle stall (大牌檔) at the banyan's foot at hero quality, against the dome-B
// targets (round-10-dome-b-*/target-2, 4, 7, 9 and the style-A spawn mockup): a green-painted steel frame under a
// corrugated roof, a red-and-white striped canvas awning with a scalloped valance, the white 麵 banner, a lit name
// board, a timber counter with a steel top crowded with bowls, chopstick cups and sauce bottles, three steaming
// stockpots and a wok on a glowing burner, a lit back wall of menu strips and shelves of jars, bare bulbs and lanterns,
// cooks behind the counter, customers on stools and at two folding tables in front, gas bottles and crates at the side.
import { Box3, type BufferGeometry, Color, Matrix4, Quaternion, Vector3 } from 'three';
import type { Ctx } from '../world/ctx';
import { E, K, Kit, type Look } from '../world/kit';
import { HAWKER, STALL, Y0 } from '../layout';
import type { Rng } from '@wildshard/engine/core/rng';
import { SURF } from '../look/paint';
import { person } from './heroFigures';
import { KitX, curve, merge } from '../world/hero/kitx';
import { curvedRoof } from './gate';
import { placeSet } from '../world/props3d';
import { BOOTH, PAV, type StallRect } from '../world/specimenDims';

const X = new Vector3(1, 0, 0), Y = new Vector3(0, 1, 0), Z = new Vector3(0, 0, 1);
const STEEL: Look = { wash: 0x2c463a, line: 1, accent: true };
const TIMBER: Look = { wash: 0x5e3a22, kind: K.panel, line: 1, accent: true, surf: SURF.wood };
const TOP: Look = { wash: 0xa4a9ae, line: 1, gloss: true };
const UPV = new Vector3(0, 1, 0);
const seat = (x: number, z: number, yaw: number): Matrix4 => new Matrix4().compose(new Vector3(x, Y0, z), new Quaternion().setFromAxisAngle(UPV, yaw), new Vector3(1, 1, 1));

/** a stack of `n` bowls at (x, y, z) */
function bowls(k: Kit, x: number, y: number, z: number, n: number, wash: number): void {
  for (let i = 0; i < n; i++) k.lathe(x, y + i * 0.045, z, [[0.045, 0], [0.075, 0.02], [0.09, 0.055]], 10, { wash, line: 0.5 }, false, 1);
}

/** a timber bar stool (painted wood): a seat on four splayed legs with a foot cross */
function woodStool(k: Kit, x: number, y: number, z: number): void {
  const w: Look = { wash: 0x6e4428, line: 0.8, accent: true, surf: SURF.wood };
  k.box(x, y + 0.66, z, 0.36, 0.05, 0.36, w);
  for (const [lx, lz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) k.beam(new Vector3(x + lx * 0.19, y, z + lz * 0.19), new Vector3(x + lx * 0.14, y + 0.66, z + lz * 0.14), 0.04, 0.04, w);
  k.box(x, y + 0.24, z, 0.34, 0.025, 0.025, w);
  k.box(x, y + 0.24, z, 0.025, 0.025, 0.34, w);
}

/** the menu strips' words (the sign specs are shared: the colour atlas is small) */
const MENU = ['牛腩麵', '雲吞麵', '魚蛋粉', '炒麵', '豬扒包', '奶茶', '叉燒飯', '腸粉'] as const;

/** a quad drawn on both faces */
function quad2(k: Kit, a: Vector3, b: Vector3, c: Vector3, d: Vector3, w: number, h: number, look: Look, edges: number = E.all): void {
  k.quad4(a, b, c, d, w, h, look, 0, 0, edges);
  k.quad4(b, a, d, c, w, h, look, 0, 0, edges);
}

/** where a stall drawn into the square's kit stands (its footprint's centre): the stall models' placement */
function standsAt(ctx: Ctx, model: string, r: StallRect, y: number, k: Kit, x: KitX, v0: number, w0: number): void {
  ctx.inKit.push({ model, kit: k, at: { x: (r.x0 + r.x1) / 2, y, z: (r.z0 + r.z1) / 2 }, box: x.boundsFrom(w0, k.boundsFrom(v0, new Box3())) });
}

/** the noodle stall (the noodle stall model, ../models/stalls.ts), drawn into the square cluster's kit at `rect` */
export function noodleStall(ctx: Ctx, rng: Rng, rect: StallRect = STALL, ground: number = Y0): void {
  const k = ctx.kit('paifang', true); // the square cluster's kit (one draw, budget.md)
  const x = ctx.kitx('paifang');
  const v0 = k.vertexCount, w0 = x.vertexCount;
  const { x0, x1, z0, z1 } = rect;
  const y = ground;
  const xc = (x0 + x1) / 2, W = x1 - x0;
  // ── the frame: four steel posts, a roof frame, a corrugated roof sloping to the front ──
  const yb = y + 3.25, yf = y + 2.95;
  for (const [px, pz, h] of [[x0 + 0.08, z0 + 0.08, yb], [x1 - 0.08, z0 + 0.08, yb], [x0 + 0.08, z1 - 0.08, yf], [x1 - 0.08, z1 - 0.08, yf]] as const) {
    k.box(px, y, pz, 0.1, h - y, 0.1, STEEL);
  }
  k.beam(new Vector3(x0, yf, z1 - 0.08), new Vector3(x1, yf, z1 - 0.08), 0.1, 0.12, STEEL);
  k.beam(new Vector3(x0, yb, z0 + 0.08), new Vector3(x1, yb, z0 + 0.08), 0.1, 0.12, STEEL);
  for (const px of [x0 + 0.08, xc, x1 - 0.08]) k.beam(new Vector3(px, yb, z0), new Vector3(px, yf, z1), 0.08, 0.1, STEEL);
  // the roof is a striped canvas too (the targets' stall reads from above as one red-and-white canopy), over steel
  // (E281: plain weathered oxblood canvas, not candy stripes — the A2 targets' noodle stall and style-A's stall carry dark
  // brown-red roofs and awnings, the stripes only on the valance; from the aerials the stripes were the square's loudest thing)
  const roofLook: Look = { wash: 0x5e2218, kind: K.cloth, row: 0, col: 0.9, line: 1, accent: true };
  const rA = new Vector3(x0 - 0.15, yf + 0.08, z1 + 0.1), rB = new Vector3(x1 + 0.15, yf + 0.08, z1 + 0.1);
  const rC = new Vector3(x1 + 0.15, yb + 0.08, z0 - 0.1), rD = new Vector3(x0 - 0.15, yb + 0.08, z0 - 0.1);
  const rl = rA.distanceTo(rD);
  k.quad4(rA, rB, rC, rD, W + 0.3, rl, roofLook);
  k.quad4(rB, rA, rD, rC, W + 0.3, rl, { wash: 0x4a4c50, kind: K.bars, col: 0.11, row: 0, line: 1 });
  // clutter on the roof: a water tank, a crate, a tarp weighed with a tyre
  k.cyl(x1 - 0.9, yb - 0.1, z0 + 0.6, 0.35, 0.35, 0.8, 12, { wash: 0x3a6a8a, line: 1 }, { edges: E.rims });
  k.box(x0 + 1.2, yb - 0.02, z0 + 0.7, 0.8, 0.4, 0.6, { wash: 0x6a5a44, kind: K.panel, line: 1 });
  // ── the striped awning with a scalloped valance, on two struts ──
  const aY0 = yf + 0.02, aY1 = y + 2.45, aZ1 = z1 + 1.7;
  const awn: Look = { wash: 0x6e2a1c, kind: K.cloth, row: 0, col: 0.9, line: 1, accent: true };
  const aA = new Vector3(x0 - 0.1, aY1, aZ1), aB = new Vector3(x1 + 0.1, aY1, aZ1), aC = new Vector3(x1 + 0.1, aY0, z1), aD = new Vector3(x0 - 0.1, aY0, z1);
  k.quad4(aA, aB, aC, aD, W + 0.2, aA.distanceTo(aD), awn);
  k.quad4(aB, aA, aD, aC, W + 0.2, aA.distanceTo(aD), { ...awn, wash: 0x4a1a12 });
  const nFlap = Math.round((W + 0.2) / 0.46);
  for (let i = 0; i < nFlap; i++) {
    const fx = x0 - 0.1 + i * ((W + 0.2) / nFlap);
    const fw = (W + 0.2) / nFlap;
    const fl: Look = { wash: i % 2 === 0 ? 0xb8261a : 0xe6dfcf, line: 0.8, accent: true };
    quad2(k, new Vector3(fx, aY1 - 0.22, aZ1), new Vector3(fx + fw, aY1 - 0.22, aZ1), new Vector3(fx + fw, aY1, aZ1), new Vector3(fx, aY1, aZ1), fw, 0.22, fl, E.u0 | E.u1 | E.v1);
    k.tri(new Vector3(fx, aY1 - 0.22, aZ1), new Vector3(fx + fw / 2, aY1 - 0.34, aZ1), new Vector3(fx + fw, aY1 - 0.22, aZ1), fl);
    k.tri(new Vector3(fx + fw, aY1 - 0.22, aZ1), new Vector3(fx + fw / 2, aY1 - 0.34, aZ1), new Vector3(fx, aY1 - 0.22, aZ1), fl);
  }
  for (const px of [x0 + 0.1, x1 - 0.1]) k.beam(new Vector3(px, y + 2.1, z1 - 0.08), new Vector3(px, aY1, aZ1), 0.04, 0.04, STEEL);
  // ── the back wall: white tile below, warm-lit plaster above, menu strips, shelves of jars ──
  k.box(xc, y, z0 + 0.08, W - 0.2, 1.1, 0.1, { wash: 0xc9c3b6, kind: K.facade, row: 0.15, col: 0.15, line: 0.8 });
  k.box(xc, y + 1.1, z0 + 0.08, W - 0.2, 2.1, 0.1, { wash: 0xa87c4a, emit: 0.28, line: 1, accent: true, surf: SURF.none });
  // E281 round 2: a warm ceiling under the roof, so the stall glows inside from the square and the aerials
  k.box(xc, yf - 0.1, (z0 + z1) / 2, W - 0.3, 0.04, z1 - z0 - 0.3, { wash: 0xd89a58, emit: 0.5, line: 0.6, accent: true, surf: SURF.none }, { top: null });
  // the back wall's clutter: a drinks fridge with a lit glass door, a clock, a red calendar, a wall fan, the kitchen god
  // shelf with its red lamp
  k.box(x1 - 0.55, y, z0 + 0.4, 0.8, 1.9, 0.6, { wash: 0xd8d6cf, line: 1 });
  k.box(x1 - 0.55, y + 0.15, z0 + 0.71, 0.66, 1.6, 0.02, { wash: 0xbfe0e8, emit: 0.55, kind: K.facade, row: 0.32, col: 0.66, line: 0.8 });
  x.ellipsoid(new Vector3(xc - 0.2, y + 2.75, z0 + 0.16), X, Y, Z, 0.16, 0.16, 0.03, { wash: 0xf2eee4, line: 0 }, () => 1, 6, 16);
  ctx.signs.place({ at: new Vector3(xc + 0.5, y + 2.7, z0 + 0.15), normal: new Vector3(0, 0, 1), size: 0.12, spec: { text: '福', color: '#f0c86a', vertical: true, style: 'paper', ink: '#b8261a' }, gain: 1.1 }, null);
  x.ellipsoid(new Vector3(x0 + 0.5, y + 2.6, z0 + 0.3), X, Y, Z, 0.2, 0.2, 0.05, { wash: 0x2e5fa3, line: 0 }, () => 1, 6, 16);
  k.box(x0 + 0.5, y + 2.1, z0 + 0.22, 0.5, 0.04, 0.26, { wash: 0x7e1e1a, line: 0.8, accent: true });
  k.box(x0 + 0.5, y + 2.14, z0 + 0.2, 0.14, 0.2, 0.06, { wash: 0xb08a3c, line: 0.8, accent: true });
  x.ellipsoid(new Vector3(x0 + 0.72, y + 2.2, z0 + 0.26), X, Y, Z, 0.03, 0.04, 0.03, { wash: 0xff3b30, emit: 3, line: 0, accent: true }, () => 1, 3, 6);
  MENU.forEach((m, i) => {
    const mx = x0 + 0.6 + i * ((W - 1.2) / (MENU.length - 1));
    const red = i % 3 === 0;
    ctx.signs.place({ at: new Vector3(mx, y + 2.45, z0 + 0.15), normal: new Vector3(0, 0, 1), size: 0.13, spec: { text: m, color: red ? '#f3e7cf' : '#b8261a', vertical: true, style: 'paper', ink: red ? '#b8261a' : '#efe6d2' }, gain: 1.15 }, null);
  });
  for (const sy of [1.45, 1.85]) {
    k.box(xc + 1.2, y + sy, z0 + 0.3, 2.4, 0.04, 0.34, { wash: 0x4a3322, line: 0.8 });
    for (let i = 0; i < 9; i++) {
      const jx = xc + 0.1 + i * 0.26;
      const kind = (i + Math.round(sy * 10)) % 4;
      if (kind === 3) bowls(k, jx, y + sy + 0.04, z0 + 0.3, 4, 0xece8dd);
      else k.cyl(jx, y + sy + 0.04, z0 + 0.3, 0.07, 0.06, 0.2, 8, { wash: [0xc0703a, 0x8a3a24, 0xd8c070][kind] ?? 0xc0703a, line: 0.6, gloss: true });
    }
  }
  // side walls: half-height boards with posters, a steel mesh above
  // (open above: the kitchen shows from the side, as in the targets)
  for (const px of [x0 + 0.06, x1 - 0.06]) {
    k.box(px, y, (z0 + z1) / 2, 0.06, 1.15, z1 - z0 - 0.2, TIMBER);
    k.box(px, y + 1.15, (z0 + z1) / 2, 0.08, 0.06, z1 - z0 - 0.2, STEEL);
  }
  ctx.signs.place({ at: new Vector3(x0 + 0.02, y + 0.62, (z0 + z1) / 2 - 0.4), normal: new Vector3(-1, 0, 0), size: 0.16, spec: { text: '即叫即煮', color: '#f3e7cf', vertical: true, style: 'paper', ink: '#b8261a' }, gain: 1.1 }, null);
  ctx.signs.place({ at: new Vector3(x0 + 0.02, y + 0.62, (z0 + z1) / 2 + 0.5), normal: new Vector3(-1, 0, 0), size: 0.16, spec: { text: '牛腩', color: '#1a1614', vertical: true, style: 'paper', ink: '#e9c65a' }, gain: 1.1 }, null);
  // ── the kitchen line: a stove with three stockpots and a wok on a glowing burner ──
  k.box(xc - 0.6, y, z0 + 0.62, W - 2.2, 0.85, 0.72, { wash: 0x8c9196, line: 1, gloss: true });
  for (let i = 0; i < 3; i++) {
    const px = xc - 1.9 + i * 0.75;
    k.cyl(px, y + 0.85, z0 + 0.62, 0.29, 0.29, 0.5, 14, { wash: 0xa9aeb3, line: 1, gloss: true }, { edges: E.rims });
    k.cyl(px, y + 1.35, z0 + 0.62, 0.3, 0.26, 0.05, 14, { wash: 0x7d8288, line: 0.8, gloss: true }, { edges: E.rims });
    k.cyl(px, y + 1.4, z0 + 0.62, 0.04, 0.04, 0.05, 6, { wash: 0x2a2c31, line: 0.6 });
    ctx.steam.push(new Vector3(px, y + 1.5, z0 + 0.62));
  }
  const wx = xc + 0.6;
  k.cyl(wx, y + 0.85, z0 + 0.62, 0.3, 0.3, 0.03, 12, { wash: 0xff7a2a, emit: 2.2, line: 0, accent: true });
  k.lathe(wx, y + 0.9, z0 + 0.62, [[0.02, 0], [0.18, 0.03], [0.3, 0.12], [0.34, 0.2]], 14, { wash: 0x2a2c31, line: 0.8, gloss: true }, false, 0);
  x.sweep([new Vector3(wx + 0.34, y + 1.08, z0 + 0.62), new Vector3(wx + 0.7, y + 1.18, z0 + 0.62)], () => 0.025, 5, { wash: 0x3a2a1e, line: 0 });
  ctx.steam.push(new Vector3(wx, y + 1.3, z0 + 0.62));
  // ladles on a rail
  k.beam(new Vector3(xc - 2.2, y + 1.75, z0 + 0.2), new Vector3(xc + 0.2, y + 1.75, z0 + 0.2), 0.02, 0.02, TOP);
  for (let i = 0; i < 6; i++) {
    const lx = xc - 2.0 + i * 0.4;
    x.sweep([new Vector3(lx, y + 1.75, z0 + 0.22), new Vector3(lx, y + 1.35, z0 + 0.24)], () => 0.01, 4, { wash: 0x9da3aa, line: 0 });
    x.ellipsoid(new Vector3(lx, y + 1.32, z0 + 0.25), X, Y, Z, 0.06, 0.035, 0.06, { wash: 0x9da3aa, line: 0, gloss: true }, () => 1, 3, 8);
  }
  // ── the counter: carved timber front, a steel top, bowls, cups, bottles, noodles, a till ──
  const cz = z1 - 0.48;
  k.box(xc, y, cz, W - 0.5, 0.95, 0.78, TIMBER);
  k.box(xc, y + 0.95, cz + 0.02, W - 0.36, 0.05, 0.9, TOP);
  k.box(xc, y + 0.08, cz + 0.4, W - 0.5, 0.08, 0.04, { wash: 0x2a2c31, line: 1 });
  for (let i = 0; i < 5; i++) bowls(k, x0 + 0.6 + i * 0.28, y + 1.0, cz - 0.1, 3 + (i % 3), i % 2 === 0 ? 0xece8dd : 0xd7e0e4);
  for (let i = 0; i < 3; i++) {
    const bx = x0 + 2.5 + i * 0.5;
    k.cyl(bx, y + 1.0, cz + 0.22, 0.06, 0.06, 0.14, 8, { wash: 0x6f8a6a, line: 0.6 });
    for (let j = 0; j < 5; j++) x.sweep([new Vector3(bx + (j - 2) * 0.012, y + 1.05, cz + 0.22), new Vector3(bx + (j - 2) * 0.02, y + 1.3, cz + 0.22 + (j % 2) * 0.02)], () => 0.004, 3, { wash: 0xd8c9a0, line: 0 });
  }
  for (let i = 0; i < 4; i++) {
    const bx = x1 - 1.6 + i * 0.12;
    const soy = i % 2 === 0;
    k.cyl(bx, y + 1.0, cz + 0.25, 0.035, 0.035, 0.2, 8, { wash: soy ? 0x2a1a12 : 0xb8261a, line: 0.5, gloss: true });
    k.cyl(bx, y + 1.2, cz + 0.25, 0.015, 0.02, 0.05, 6, { wash: soy ? 0xc8261a : 0xe8e4da, line: 0.4 });
  }
  k.box(x1 - 0.9, y + 1.0, cz - 0.15, 0.5, 0.05, 0.35, { wash: 0xd9b85a, kind: K.bars, col: 0.02, row: 0, line: 0.6 });
  for (let i = 0; i < 3; i++) bowls(k, x0 + 1.4 + i * 0.9, y + 1.0, cz + 0.28, 1, 0xece8dd);
  // ── light: bare bulbs on cords, lanterns at the front corners, the stall's warm glow ──
  for (let i = 0; i < 4; i++) {
    const bx = x0 + 0.8 + i * ((W - 1.6) / 3);
    const top = new Vector3(bx, yf - 0.05, z1 - 0.3);
    x.sweep([top, top.clone().add(new Vector3(0, -0.45, 0))], () => 0.006, 3, { wash: 0x1c1c1f, line: 0 });
    x.ellipsoid(top.clone().add(new Vector3(0, -0.52, 0)), X, Y, Z, 0.055, 0.07, 0.055, { wash: 0xffd9a0, emit: 4.0, line: 0, accent: true }, () => 1, 4, 8);
    k.lathe(bx, yf - 0.55, z1 - 0.3, [[0.02, 0.1], [0.12, 0.03], [0.16, 0]], 10, { wash: 0x2c463a, line: 0.6 }, false, 0);
  }
  ctx.lantern(x0 + 0.1, aY1 - 0.1, aZ1, 0.75);
  ctx.lantern(x1 - 0.1, aY1 - 0.1, aZ1, 0.75);
  // E281 pass 9: a row of lanterns along the awning's edge (the A2 targets' stall is hung with them), roast ducks on
  // a rail behind the counter, a warm pool on the flagstones before it, the steam rising past the awning
  for (const t of [0.3, 0.5, 0.7]) ctx.lantern(x0 + W * t, aY1 - 0.1, aZ1, 0.6);
  k.beam(new Vector3(x0 + 0.4, y + 2.3, z1 - 0.95), new Vector3(x0 + 1.9, y + 2.3, z1 - 0.95), 0.03, 0.03, STEEL);
  for (let i = 0; i < 5; i++) {
    const hx = x0 + 0.55 + i * 0.3;
    x.sweep([new Vector3(hx, y + 2.3, z1 - 0.95), new Vector3(hx, y + 2.08, z1 - 0.95)], () => 0.006, 3, { wash: 0x9aa0a6, line: 0 });
    x.ellipsoid(new Vector3(hx, y + 1.94, z1 - 0.95), X, Y, Z, 0.075, 0.15, 0.06, { wash: 0x9a4a18, line: 0, accent: true, gloss: true }, (d) => 1 + (d.y > 0.5 ? -0.25 : 0), 4, 8);
  }
  ctx.emitters.push({ at: new Vector3(xc, y + 0.4, aZ1 + 0.9), color: new Color(0xffa860), w: W - 1, h: 0.6, power: 0.25, spill: 0.45 });
  ctx.steam.push(new Vector3(xc - 1.1, y + 2.9, z1 + 0.4), new Vector3(xc - 1.0, y + 3.7, z1 + 0.7));
  ctx.emitters.push({ at: new Vector3(xc, y + 1.6, z1 - 0.2), color: new Color(0xffb870), w: W - 1, h: 1.8, power: 0.45, spill: 0.6 });
  ctx.emitters.push({ at: new Vector3(xc, y + 2.3, aZ1 - 0.6), color: new Color(0xffd0a0), w: W - 1.5, h: 0.6, power: 0.25, spill: 0.4 });
  // ── the signs: the white 麵 banner, the lit name board, a neon word on the roof ──
  ctx.signs.place({ at: new Vector3(x0 + 0.5, y + 1.72, aZ1 + 0.02), normal: new Vector3(0, 0, 1), size: 0.72, spec: { text: '麵', color: '#b8261a', vertical: true, style: 'banner', ink: '#efe8d8' }, gain: 1.35, blade: true }, null);
  x.sweep([new Vector3(x0 + 0.05, aY1 - 0.05, aZ1 + 0.02), new Vector3(x0 + 0.95, aY1 - 0.05, aZ1 + 0.02)], () => 0.018, 5, { wash: 0x3a2a1e, line: 0 });
  ctx.signs.place({ at: new Vector3(xc + 0.6, yf - 0.28, z1 + 0.02), normal: new Vector3(0, 0, 1), size: 0.34, spec: { text: '九記牛腩麵', color: '#fff1dc', vertical: false, style: 'box' }, gain: 2.0, board: 0xa8261a }, k);
  // wooden menu plaques hung along the front beam either side of the name board (the targets' stall front); they
  // reuse the back wall's menu strips (the same sign specs: no new cell in the shared colour atlas, which is full)
  MENU.slice(0, 5).forEach((m, i) => {
    const red = i % 3 === 0;
    const px = i < 3 ? x0 + 0.45 + i * 0.42 : x1 - 0.95 + (i - 3) * 0.42;
    k.box(px, yf - 0.62, z1 + 0.01, 0.24, 0.5, 0.04, { wash: 0x5a3a22, line: 0.8, accent: true, surf: SURF.wood });
    ctx.signs.place({ at: new Vector3(px, yf - 0.37, z1 + 0.035), normal: new Vector3(0, 0, 1), size: 0.13, spec: { text: m, color: red ? '#f3e7cf' : '#b8261a', vertical: true, style: 'paper', ink: red ? '#b8261a' : '#efe6d2' }, gain: 1.1 }, null);
  });
  ctx.signs.place({ at: new Vector3(xc - 0.4, yb + 0.75, z0 + 0.5), normal: new Vector3(0, 0, 1), size: 0.5, spec: { text: '重慶小麵', color: '#ff3b30', vertical: false, style: 'tube' }, gain: 5 }, k);
  // ── the people: two cooks, customers at the counter and at two folding tables ──
  person(x, rng, xc - 1.2, y, z1 - 1.45, 0, { pose: 'cook', hat: 'none', coat: 0x3b3f4a });
  person(x, rng, xc + 1.3, y, z1 - 1.5, 0.25, { pose: 'cook', hat: 'cap', coat: 0x55504a });
  for (let i = 0; i < 4; i++) {
    const sx = x0 + 0.8 + i * 1.4;
    woodStool(k, sx, y, z1 + 0.55);
    if (i !== 2) ctx.sitters.push(seat(sx, z1 + 0.62, Math.PI));
  }
  for (const [tx, tz] of [[x0 + 1.3, z1 + 2.4], [x0 + 4.0, z1 + 2.6]] as const) {
    k.box(tx, y + 0.7, tz, 0.72, 0.04, 0.72, { wash: 0xb7bcc0, line: 1 });
    for (const [lx, lz] of [[-0.3, -0.3], [0.3, -0.3], [0.3, 0.3], [-0.3, 0.3]] as const) k.beam(new Vector3(tx + lx, y, tz + lz), new Vector3(tx + lx * 0.9, y + 0.7, tz + lz * 0.9), 0.025, 0.025, STEEL);
    bowls(k, tx - 0.15, y + 0.74, tz, 1, 0xece8dd);
    bowls(k, tx + 0.15, y + 0.74, tz + 0.1, 1, 0xece8dd);
    ctx.steam.push(new Vector3(tx - 0.15, y + 0.85, tz));
    ctx.sitters.push(seat(tx, tz - 0.62, 0));
    ctx.sitters.push(seat(tx + 0.62, tz, -Math.PI / 2));
  }
  // ── the side: a red gas bottle, stacked crates, a bucket, a crate of greens ──
  const sx0 = x1 + 0.35;
  k.cyl(sx0, y, z1 - 0.4, 0.17, 0.17, 0.62, 10, { wash: 0xb8261a, line: 1, accent: true }, { edges: E.rims });
  k.lathe(sx0, y + 0.62, z1 - 0.4, [[0.17, 0], [0.12, 0.08], [0.05, 0.12]], 10, { wash: 0xb8261a, line: 0.8, accent: true }, false, 0);
  for (let i = 0; i < 3; i++) k.box(sx0, y + i * 0.3, z0 + 1.2, 0.46, 0.3, 0.36, { wash: i === 1 ? 0x2e5fa3 : 0xb8321f, kind: K.bars, col: 0.06, row: 1, line: 0.8, accent: true });
  k.cyl(x0 - 0.35, y, z1 - 0.3, 0.18, 0.2, 0.36, 10, { wash: 0x3a6a8a, line: 0.8 }, { edges: E.rims });
  k.box(x0 - 0.4, y, z0 + 0.9, 0.5, 0.28, 0.38, { wash: 0x6a5a44, kind: K.bars, col: 0.05, row: 0, line: 0.8 });
  for (let i = 0; i < 6; i++) x.ellipsoid(new Vector3(x0 - 0.52 + (i % 3) * 0.12, y + 0.32, z0 + 0.82 + Math.floor(i / 3) * 0.14), X, Y, Z, 0.07, 0.05, 0.07, { wash: 0x4f8a3c, kind: K.leaf, line: 0, accent: true }, () => 1, 3, 6);
  // the cord from the roof to the tower wall (the stall's power)
  x.sweep(curve([new Vector3(x1, yb, z0 + 0.3), new Vector3(x1 + 0.4, yb - 0.3, z0 + 0.3), new Vector3(x1 + 0.6, yb + 1.2, z0 + 0.3)], 4), () => 0.012, 3, { wash: 0x1c1c1f, line: 0 });
  ctx.map.push({ x0, z0, x1, z1, kind: 'block' });
  standsAt(ctx, 'nine-dragon-stack/noodle-stall', rect, y, k, x, v0, w0);
}

/**
 * The hawker stall at the spawn's right (dome B: the style-A mockup's right third is a steaming noodle stall seen from
 * the front, its 麵 banner at the near corner, a cook behind the counter, mahjong players in front of it). A compact
 * 大牌檔 facing SOUTH, toward the spawn, ~11 m ahead at its right: a steel frame, a striped canvas roof and awning with
 * a scalloped valance, the white 麵 banner at the west corner, a steaming stockpot and a wok on a glowing burner, bowls,
 * a warm-lit back wall with menu strips, a cook, two customers on stools, lanterns, a bulb; the steam rises past the
 * roof. Every sign reuses a spec of the big stall's (the colour atlas is small).
 */
export function hawkerStall(ctx: Ctx, rng: Rng, rect: StallRect = HAWKER, ground: number = Y0): void {
  const k = ctx.kit('paifang', true); // the square cluster's kit (one draw, budget.md)
  const x = ctx.kitx('paifang');
  const v0 = k.vertexCount, w0 = x.vertexCount;
  const { x0, x1, z0, z1 } = rect;
  const y = ground;
  const xc = mid(x0, x1), L = x1 - x0;
  const yf = y + 2.7, yb = y + 3.0;
  // the frame and a canvas roof sloping down to the front (south)
  for (const [px, pz, h] of [[x0 + 0.08, z1 - 0.08, yf], [x1 - 0.08, z1 - 0.08, yf], [x0 + 0.08, z0 + 0.08, yb], [x1 - 0.08, z0 + 0.08, yb]] as const) k.box(px, y, pz, 0.1, h - y, 0.1, STEEL);
  k.beam(new Vector3(x0, yf, z1 - 0.08), new Vector3(x1, yf, z1 - 0.08), 0.1, 0.12, STEEL);
  k.beam(new Vector3(x0, yb, z0 + 0.08), new Vector3(x1, yb, z0 + 0.08), 0.1, 0.12, STEEL);
  const roof: Look = { wash: 0x5e2218, kind: K.cloth, row: 0, col: 0.9, line: 1, accent: true };
  const rA = new Vector3(x0 - 0.12, yf + 0.08, z1 + 0.12), rB = new Vector3(x1 + 0.12, yf + 0.08, z1 + 0.12);
  const rC = new Vector3(x1 + 0.12, yb + 0.08, z0 - 0.12), rD = new Vector3(x0 - 0.12, yb + 0.08, z0 - 0.12);
  quad2(k, rA, rB, rC, rD, L + 0.24, rA.distanceTo(rD), roof);
  // the awning out over the customers, with a scalloped valance
  const aY1 = y + 2.2, aZ1 = z1 + 1.35;
  const awn: Look = { wash: 0x6e2a1c, kind: K.cloth, row: 0, col: 0.9, line: 1, accent: true };
  quad2(k, new Vector3(x0 - 0.1, aY1, aZ1), new Vector3(x1 + 0.1, aY1, aZ1), new Vector3(x1 + 0.1, yf, z1), new Vector3(x0 - 0.1, yf, z1), L + 0.2, Math.hypot(aZ1 - z1, yf - aY1), awn);
  const nFlap = Math.round((L + 0.2) / 0.46);
  for (let i = 0; i < nFlap; i++) {
    const fw = (L + 0.2) / nFlap, fx = x0 - 0.1 + i * fw;
    const fl: Look = { wash: i % 2 === 0 ? 0xb8261a : 0xe6dfcf, line: 0.8, accent: true };
    quad2(k, new Vector3(fx, aY1 - 0.22, aZ1), new Vector3(fx + fw, aY1 - 0.22, aZ1), new Vector3(fx + fw, aY1, aZ1), new Vector3(fx, aY1, aZ1), fw, 0.22, fl, E.u0 | E.u1 | E.v1);
    k.tri(new Vector3(fx, aY1 - 0.22, aZ1), new Vector3(fx + fw / 2, aY1 - 0.34, aZ1), new Vector3(fx + fw, aY1 - 0.22, aZ1), fl);
    k.tri(new Vector3(fx + fw, aY1 - 0.22, aZ1), new Vector3(fx + fw / 2, aY1 - 0.34, aZ1), new Vector3(fx, aY1 - 0.22, aZ1), fl);
  }
  for (const px of [x0 + 0.1, x1 - 0.1]) k.beam(new Vector3(px, y + 1.9, z1 - 0.08), new Vector3(px, aY1, aZ1), 0.035, 0.035, STEEL);
  // the back wall, warm-lit, with menu strips and a shelf of jars; a side board at the east end
  k.box(xc, y, z0 + 0.1, L - 0.2, 1.0, 0.1, { wash: 0xc9c3b6, kind: K.facade, row: 0.15, col: 0.15, line: 0.8 });
  k.box(xc, y + 1.0, z0 + 0.1, L - 0.2, 1.9, 0.1, { wash: 0x6e4c30, emit: 0.3, line: 1, accent: true, surf: SURF.none });
  // E281 round 2: a lit box — a warm ceiling under the canvas roof (the targets' stalls glow inside from every side)
  k.box(xc, yf - 0.1, mid(z0, z1), L - 0.2, 0.04, z1 - z0 - 0.2, { wash: 0xd89a58, emit: 0.5, line: 0.6, accent: true, surf: SURF.none }, { top: null });
  // the kitchen's clutter against the lit wall (style-A: the interior is busy and warm, never a flat lit panel): a rail of
  // ladles and strainers, hanging bowls of noodles drying, a row of jars on a second shelf, a wall clock
  k.beam(new Vector3(x0 + 0.3, y + 2.0, z0 + 0.22), new Vector3(x1 - 0.3, y + 2.0, z0 + 0.22), 0.02, 0.02, TOP);
  for (let i = 0; i < 9; i++) {
    const lx = x0 + 0.45 + i * ((L - 0.9) / 8);
    x.sweep([new Vector3(lx, y + 2.0, z0 + 0.24), new Vector3(lx, y + 1.62, z0 + 0.26)], () => 0.01, 4, { wash: 0x9da3aa, line: 0 });
    x.ellipsoid(new Vector3(lx, y + 1.58, z0 + 0.27), X, Y, Z, i % 3 === 0 ? 0.09 : 0.06, 0.035, i % 3 === 0 ? 0.09 : 0.06, { wash: i % 3 === 0 ? 0xc8b890 : 0x9da3aa, line: 0, gloss: true }, () => 1, 3, 8);
  }
  k.box(xc + 0.7, y + 1.2, z0 + 0.3, 1.4, 0.04, 0.3, { wash: 0x4a3322, line: 0.8 });
  for (let i = 0; i < 5; i++) k.cyl(xc + 0.15 + i * 0.27, y + 1.24, z0 + 0.3, 0.08, 0.07, 0.22, 8, { wash: [0x7a3a24, 0xc0703a, 0xd8c070][i % 3] ?? 0x7a3a24, line: 0.6, gloss: true });
  x.ellipsoid(new Vector3(x1 - 0.5, y + 2.55, z0 + 0.17), X, Y, Z, 0.14, 0.14, 0.025, { wash: 0xf2eee4, line: 0 }, () => 1, 6, 14);
  MENU.slice(0, 6).forEach((m, i) => {
    const mx = x0 + 0.45 + i * ((L - 0.9) / 5);
    const red = i % 3 === 0;
    ctx.signs.place({ at: new Vector3(mx, y + 2.25, z0 + 0.17), normal: new Vector3(0, 0, 1), size: 0.13, spec: { text: m, color: red ? '#f3e7cf' : '#b8261a', vertical: true, style: 'paper', ink: red ? '#b8261a' : '#efe6d2' }, gain: 1.15 }, null);
  });
  k.box(xc - 0.6, y + 1.55, z0 + 0.3, 1.6, 0.04, 0.34, { wash: 0x4a3322, line: 0.8 });
  for (let i = 0; i < 6; i++) k.cyl(xc - 1.25 + i * 0.26, y + 1.59, z0 + 0.3, 0.07, 0.06, 0.2, 8, { wash: [0xc0703a, 0x8a3a24, 0xd8c070][i % 3] ?? 0xc0703a, line: 0.6, gloss: true });
  k.box(x1 - 0.06, y, mid(z0, z1), 0.06, 1.1, z1 - z0 - 0.1, TIMBER);
  // the west end: a dark timber board to counter height and open above, so the spawn sees into the lit stall (E281
  // round 2; closed to the roof it read as a brown box in mockup A), roast ducks and sausages on a rail in the opening
  k.box(x0 + 0.06, y, mid(z0, z1), 0.08, 1.1, z1 - z0 - 0.1, { ...TIMBER, wash: 0x4a2e1c });
  k.beam(new Vector3(x0 + 0.1, y + 2.25, z0 + 0.2), new Vector3(x0 + 0.1, y + 2.25, z1 - 0.3), 0.03, 0.03, STEEL);
  for (let i = 0; i < 5; i++) {
    const hz = z0 + 0.35 + i * 0.32;
    x.sweep([new Vector3(x0 + 0.1, y + 2.25, hz), new Vector3(x0 + 0.1, y + 2.02, hz)], () => 0.006, 3, { wash: 0x9aa0a6, line: 0 });
    if (i % 2 === 0) x.ellipsoid(new Vector3(x0 + 0.1, y + 1.88, hz), X, Y, Z, 0.06, 0.15, 0.075, { wash: 0x9a4a18, line: 0, accent: true, gloss: true }, (d) => 1 + (d.y > 0.5 ? -0.25 : 0), 4, 8);
    else for (let j = 0; j < 3; j++) x.ellipsoid(new Vector3(x0 + 0.1, y + 2.1 - j * 0.13, hz + (j % 2) * 0.02), X, Y, Z, 0.022, 0.065, 0.022, { wash: 0x8a2418, line: 0, accent: true, gloss: true }, () => 1, 3, 6);
  }
  // the counter along the front: carved timber, a steel top, bowls; the stove behind it: a stockpot and a wok
  k.box(xc, y, z1 - 0.45, L - 0.3, 0.95, 0.7, TIMBER);
  k.box(xc, y + 0.95, z1 - 0.42, L - 0.2, 0.05, 0.86, TOP);
  for (let i = 0; i < 4; i++) bowls(k, x0 + 0.5 + i * 0.32, y + 1.0, z1 - 0.3, 2 + (i % 3), i % 2 === 0 ? 0xece8dd : 0xd7e0e4);
  for (let i = 0; i < 2; i++) bowls(k, x1 - 0.6 - i * 0.45, y + 1.0, z1 - 0.25, 1, 0xece8dd);
  k.box(xc + 0.4, y, z0 + 0.7, 1.6, 0.85, 0.7, { wash: 0x8c9196, line: 1, gloss: true });
  k.cyl(xc + 0.8, y + 0.85, z0 + 0.7, 0.3, 0.3, 0.52, 14, { wash: 0xa9aeb3, line: 1, gloss: true }, { edges: E.rims });
  k.cyl(xc + 0.8, y + 1.37, z0 + 0.7, 0.31, 0.27, 0.05, 14, { wash: 0x7d8288, line: 0.8, gloss: true }, { edges: E.rims });
  k.cyl(xc, y + 0.85, z0 + 0.7, 0.28, 0.28, 0.03, 12, { wash: 0xff7a2a, emit: 2.2, line: 0, accent: true });
  k.lathe(xc, y + 0.9, z0 + 0.7, [[0.02, 0], [0.17, 0.03], [0.28, 0.11], [0.32, 0.18]], 14, { wash: 0x2a2c31, line: 0.8, gloss: true }, false, 0);
  // the steam: off the pot and the wok, and a column rising past the roof's front edge (style-A's plume)
  for (const sp of [[xc + 0.8, 1.55, z0 + 0.7], [xc, 1.25, z0 + 0.7], [xc + 0.6, 2.2, z1 - 0.2], [xc + 0.5, 3.0, z1 + 0.2], [xc + 0.7, 3.8, z1 + 0.35]] as const) ctx.steam.push(new Vector3(sp[0], y + sp[1], sp[2]));
  // light: a bare bulb under the roof, lanterns at the awning's corners and one over the mahjong table, the warm glow
  const bulb = new Vector3(xc - 0.4, yf - 0.55, z1 - 0.5);
  x.sweep([bulb.clone().add(new Vector3(0, 0.5, 0)), bulb.clone().add(new Vector3(0, 0.06, 0))], () => 0.006, 3, { wash: 0x1c1c1f, line: 0 });
  x.ellipsoid(bulb, X, Y, Z, 0.055, 0.07, 0.055, { wash: 0xffd9a0, emit: 4.0, line: 0, accent: true }, () => 1, 4, 8);
  ctx.lantern(x0 - 0.05, aY1 - 0.1, aZ1 + 0.05, 0.75);
  ctx.lantern(x1 + 0.05, aY1 - 0.1, aZ1 + 0.05, 0.75);
  ctx.lantern(xc, aY1 - 0.1, aZ1 + 0.05, 0.6);
  ctx.emitters.push({ at: new Vector3(xc, y + 1.6, z1 + 0.1), color: new Color(0xffb870), w: L - 0.6, h: 1.8, power: 0.45, spill: 0.6 });
  // the white 麵 banner at the west front corner, facing the spawn (the big stall's spec: one atlas cell)
  ctx.signs.place({ at: new Vector3(x0 + 0.4, y + 1.5, aZ1 + 0.03), normal: new Vector3(0, 0, 1), size: 0.72, spec: { text: '麵', color: '#b8261a', vertical: true, style: 'banner', ink: '#efe8d8' }, gain: 1.6, blade: true }, null);
  x.sweep([new Vector3(x0 - 0.1, y + 2.05, aZ1 + 0.03), new Vector3(x0 + 0.9, y + 2.05, aZ1 + 0.03)], () => 0.018, 5, { wash: 0x3a2a1e, line: 0 });
  // the cook behind the counter, facing the square; two customers on stools in front
  person(x, rng, xc - 0.5, y, z1 - 1.05, 0, { pose: 'cook', hat: 'none', coat: 0xd8d2c4 });
  for (const [i, sx] of [x0 + 1.0, xc + 0.3, x1 - 0.7].entries()) {
    woodStool(k, sx, y, z1 + 0.45);
    if (i !== 1) ctx.sitters.push(seat(sx, z1 + 0.52, Math.PI));
  }
  // its back (the north side, seen from the gate and from Q): a blue tarp tied over the back wall, stacked crates and
  // stools, a water barrel, a posted notice
  const tarp: Look = { wash: 0x2e5a8a, kind: K.cloth, row: 0.4, col: 0.9, line: 1, accent: true };
  k.quad4(new Vector3(x0 - 0.05, yb + 0.05, z0 - 0.03), new Vector3(x1 + 0.05, yb + 0.05, z0 - 0.03), new Vector3(x1 - 0.1, y + 1.0, z0 - 0.09), new Vector3(x0 + 0.1, y + 1.0, z0 - 0.09), L + 0.1, 2.05, tarp);
  for (let i = 0; i < 3; i++) k.box(x0 + 0.6, y + i * 0.3, z0 - 0.35, 0.5, 0.3, 0.4, { wash: i === 1 ? 0x2e5fa3 : 0xb8321f, kind: K.bars, col: 0.06, row: 1, line: 0.8, accent: true });
  for (let i = 0; i < 4; i++) k.cyl(x0 + 1.5, y + i * 0.09, z0 - 0.35, 0.19, 0.16, 0.44, 8, { wash: 0x3a6f9a, line: 0.7, accent: true }, { edges: E.rims });
  k.cyl(x1 - 0.8, y, z0 - 0.4, 0.3, 0.28, 0.8, 12, { wash: 0x4a6a5a, line: 1 }, { edges: E.rims });
  ctx.signs.place({ at: new Vector3(xc + 0.3, y + 1.6, z0 - 0.11), normal: new Vector3(0, 0, -1), size: 0.13, spec: { text: MENU[0], color: '#f3e7cf', vertical: true, style: 'paper', ink: '#b8261a' }, gain: 1.0 }, null);
  // at the east end: a red gas bottle, a crate of greens
  k.cyl(x1 + 0.3, y, z1 - 0.4, 0.16, 0.16, 0.6, 10, { wash: 0xb8261a, line: 1, accent: true }, { edges: E.rims });
  k.box(x1 + 0.3, y, z0 + 0.4, 0.38, 0.28, 0.5, { wash: 0x6a5a44, kind: K.bars, col: 0.05, row: 0, line: 0.8 });
  ctx.map.push({ x0, z0, x1, z1, kind: 'block' });
  standsAt(ctx, 'nine-dragon-stack/hawker-stall', rect, y, k, x, v0, w0);
}

function mid(a: number, b: number): number { return (a + b) / 2; }

// ── E281 (the mockup pass): the market along the square's east side ──
// The A1 / A2 targets line the square's east edge with small food booths (teal tiled roofs, lanterns at the eaves, a
// lit counter, a cook) and set parasol tables among them. Each is ONE geometry drawn instanced (props3d.ts `placeSet`):
// a row of booths costs one draw and one copy of the geometry, not a kit's worth each (E264's memory caps). Instanced
// sets miss the kits' neon-spill bake, so each carries its own lamp's warm light in aSpill (`warmSpill`).

/** the booths' front centres (x, z): their fronts face the square (west), their backs 1.7 m east, toward the shops */
export const BOOTHS: readonly (readonly [number, number])[] = [[19.8, -9.8], [19.8, -6.6], [19.8, -3.4], [19.8, 12.4], [19.8, 15.6]];
/** the parasol tables (x, z, quarter turns) */
export const PARASOLS: readonly (readonly [number, number, number])[] = [[17.5, -8.2, 0], [17.3, -1.9, 1], [13.3, 1.9, 2], [17.3, 14.0, 3], [12.6, 14.8, 1], [10.2, 4.6, 0]];

/** E281 round 2: the dining pavilions (x, z, yaw): a table of four under a plum canopy on four posts, in the south half */
export const PAVILIONS: readonly (readonly [number, number, number])[] = [[7.6, 15.6, 0.2], [14.6, 10.2, -0.3], [4.1, 12.9, 0.5]];
/** a lamp's warm light baked into a set's aSpill (the instanced sets miss bakeSpill): falls off over `r` m from `at` */
function warmSpill(g: BufferGeometry, at: Vector3, color: Color, r: number, power: number, below = Number.POSITIVE_INFINITY): void {
  const pos = g.getAttribute('position'), sp = g.getAttribute('aSpill');
  const p = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    // (nothing above `below`: the lamp hangs under the roof, and a lit roof read as a green-gold slab from the aerials)
    const f = p.y > below ? 0 : Math.max(0, 1 - p.distanceTo(at) / r) ** 2 * power;
    sp.setXYZ(i, sp.getX(i) + color.r * f, sp.getY(i) + color.g * f, sp.getZ(i) + color.b * f);
  }
  sp.needsUpdate = true;
}

/**
 * A market booth in its own frame: the front (the counter) on z = 0 facing +z, the back wall at z = −d, the counter
 * along x. Lacquer posts under a small teal tiled hip roof (the gate's curved roof in small: tile rolls, a painted
 * soffit, flying corners), a striped valance, a timber counter with a red cloth front, bowls, a steamer tower, a
 * stockpot and buns; a lit back wall with a shelf of jars; a bare bulb; a cook.
 */
export function boothSet(rng: Rng): BufferGeometry {
  const k = new Kit(), x = new KitX();
  const W = BOOTH.w, D = BOOTH.d, hw = W / 2;
  const POST: Look = { wash: 0x4a1a12, line: 1, accent: true, gloss: true, surf: SURF.lacquer };
  for (const [px, pz, h] of [[-hw + 0.06, -0.12, 2.32], [hw - 0.06, -0.12, 2.32], [-hw + 0.06, -D + 0.06, 2.46], [hw - 0.06, -D + 0.06, 2.46]] as const) {
    k.box(px, 0, pz, 0.11, h, 0.11, POST, { bottom: null });
  }
  k.box(0, 2.2, -0.12, W, 0.12, 0.12, POST);
  k.box(0, 2.34, -D + 0.06, W, 0.12, 0.12, POST);
  curvedRoof(k, x, null, { cx: 0, y0: 2.42, cz: -D / 2 + 0.05, w: W + 0.8, d: D + 1.0, h: 0.78, lift: 0.3, flare: 0.14, tile: 0x1b4440, neon: null, ornaments: false, grid: [6, 4], roll: 0.4 });
  // the striped valance under the front eave
  const nFlap = 6, fw = W / nFlap;
  for (let i = 0; i < nFlap; i++) {
    const fx = -hw + i * fw;
    const fl: Look = { wash: i % 2 === 0 ? 0xb8261a : 0xe6dfcf, line: 0.8, accent: true };
    quad2(k, new Vector3(fx, 1.96, 0.0), new Vector3(fx + fw, 1.96, 0.0), new Vector3(fx + fw, 2.16, 0.0), new Vector3(fx, 2.16, 0.0), fw, 0.2, fl, E.u0 | E.u1 | E.v1);
    k.tri(new Vector3(fx, 1.96, 0.0), new Vector3(fx + fw / 2, 1.86, 0.0), new Vector3(fx + fw, 1.96, 0.0), fl);
    k.tri(new Vector3(fx + fw, 1.96, 0.0), new Vector3(fx + fw / 2, 1.86, 0.0), new Vector3(fx, 1.96, 0.0), fl);
  }
  // the back wall: a white-tiled dado, warm-lit plaster, a shelf of jars; half-height side boards
  k.box(0, 0, -D + 0.03, W - 0.12, 1.0, 0.06, { wash: 0xc9c3b6, kind: K.facade, row: 0.15, col: 0.15, line: 0.8 }, { bottom: null });
  k.box(0, 1.0, -D + 0.03, W - 0.12, 1.36, 0.06, { wash: 0x8e6038, emit: 0.4, line: 1, accent: true, surf: SURF.none }, { bottom: null });
  // E281 round 2: a lit box — a warm ceiling under the roof, so from the square and the aerials the booth glows inside
  k.box(0, 2.3, -D / 2, W - 0.1, 0.04, D - 0.1, { wash: 0xd89a58, emit: 0.55, line: 0.6, accent: true, surf: SURF.none }, { top: null });
  k.box(0, 1.52, -D + 0.2, W - 0.5, 0.04, 0.26, { wash: 0x4a3322, line: 0.8 });
  for (let i = 0; i < 7; i++) k.cyl(-0.9 + i * 0.3, 1.56, -D + 0.2, 0.08, 0.07, 0.22, 8, { wash: [0xc0703a, 0x8a3a24, 0xd8c070][i % 3] ?? 0xc0703a, line: 0.6, gloss: true });
  for (const sx of [-1, 1]) k.box(sx * (hw - 0.05), 0, -D / 2 - 0.25, 0.05, 1.05, D - 0.6, TIMBER, { bottom: null });
  // the counter: timber, a steel top, a red cloth hung across its front
  k.box(0, 0, -0.42, W - 0.24, 0.92, 0.56, { ...TIMBER, wash: 0x6a3a20 }, { bottom: null });
  k.box(0, 0.92, -0.4, W - 0.1, 0.05, 0.68, TOP, { bottom: null });
  k.quad(new Vector3(-hw + 0.16, 0.1, -0.13), X, Y, W - 0.32, 0.72, { wash: 0xa8261a, kind: K.cloth, row: 0, col: 0.9, line: 1, accent: true });
  // the food: bowls, a bamboo steamer tower, a stockpot, a tray of buns
  for (let i = 0; i < 4; i++) bowls(k, -1.0 + i * 0.2, 0.97, -0.28, 2 + (i % 2), i % 2 === 0 ? 0xece8dd : 0xd7e0e4);
  for (let i = 0; i < 3; i++) k.cyl(0.32, 0.97 + i * 0.13, -0.45, 0.2, 0.2, 0.12, 10, { wash: 0xa8844e, kind: K.bars, col: 0.05, row: 0, line: 0.6 }, { edges: E.rims });
  k.lathe(0.32, 1.36, -0.45, [[0.2, 0], [0.12, 0.08], [0.03, 0.11]], 10, { wash: 0xa8844e, line: 0.6 }, false, 0);
  k.cyl(0.85, 0.97, -0.48, 0.2, 0.2, 0.3, 12, { wash: 0xa9aeb3, line: 1, gloss: true }, { edges: E.rims });
  k.box(-0.3, 0.97, -0.55, 0.46, 0.03, 0.3, { wash: 0x3a3d44, line: 0.6 });
  for (let i = 0; i < 6; i++) x.ellipsoid(new Vector3(-0.47 + (i % 3) * 0.17, 1.03, -0.62 + Math.floor(i / 3) * 0.15), X, Y, Z, 0.07, 0.045, 0.07, { wash: 0xeee4cc, line: 0 }, () => 1, 3, 6);
  // hanging goods from the front beam (the targets' stalls): five glazed roast ducks on hooks at the left, strings of
  // lap cheong sausages at the right
  for (let i = 0; i < 5; i++) {
    const hx = -1.05 + i * 0.16;
    x.sweep([new Vector3(hx, 2.2, -0.14), new Vector3(hx, 1.98, -0.14)], () => 0.006, 3, { wash: 0x9aa0a6, line: 0 });
    x.ellipsoid(new Vector3(hx, 1.84, -0.14), X, Y, Z, 0.075, 0.15, 0.06, { wash: 0x9a4a18, line: 0, accent: true, gloss: true }, (d) => 1 + (d.y > 0.5 ? -0.25 : 0), 4, 8);
  }
  for (let i = 0; i < 4; i++) {
    const hx = 0.55 + i * 0.14;
    for (let j = 0; j < 3; j++) x.ellipsoid(new Vector3(hx + (j % 2) * 0.02, 2.08 - j * 0.13, -0.14), X, Y, Z, 0.022, 0.065, 0.022, { wash: 0x8a2418, line: 0, accent: true, gloss: true }, () => 1, 3, 6);
  }
  // a bare bulb under the roof
  const bulb = new Vector3(-0.3, 1.9, -0.75);
  x.sweep([bulb.clone().add(new Vector3(0, 0.5, 0)), bulb.clone().add(new Vector3(0, 0.06, 0))], () => 0.006, 3, { wash: 0x1c1c1f, line: 0 });
  x.ellipsoid(bulb, X, Y, Z, 0.055, 0.07, 0.055, { wash: 0xffd9a0, emit: 4.0, line: 0, accent: true }, () => 1, 4, 8);
  // the cook behind the counter
  person(x, rng, 0.1, 0, -1.05, 0, { pose: 'cook', hat: 'none', coat: 0x4a4640 });
  const g = merge([k.build(), x.build()]);
  warmSpill(g, new Vector3(-0.3, 1.8, -0.7), new Color(1.0, 0.6, 0.28), 2.6, 0.6, 2.3);
  return g;
}

/** a parasol table in its own frame (table at the origin): a steel folding table, bowls, a red oil-paper parasol on a
 * bamboo pole; the four diners are TRELLIS sitters, who bring their own stools (E281 round 2: every table full) */
export function parasolSet(): BufferGeometry {
  const k = new Kit(), x = new KitX();
  k.box(0, 0.7, 0, 0.8, 0.04, 0.8, { wash: 0xb7bcc0, line: 1 });
  for (const [lx, lz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) k.beam(new Vector3(lx * 0.34, 0, lz * 0.34), new Vector3(lx * 0.3, 0.7, lz * 0.3), 0.025, 0.025, STEEL);
  bowls(k, -0.16, 0.74, 0.06, 1, 0xece8dd);
  bowls(k, 0.14, 0.74, -0.12, 2, 0xd7e0e4);
  k.cyl(0.04, 0.74, 0.22, 0.05, 0.05, 0.12, 8, { wash: 0x6f8a6a, line: 0.6 });
  const pole: Look = { wash: 0x6a5030, line: 0 };
  x.sweep([new Vector3(0, 0.74, 0), new Vector3(0, 2.62, 0)], () => 0.028, 5, pole);
  const top = new Vector3(0, 2.28, 0);
  x.ellipsoid(top, X, Y, Z, 1.4, 0.44, 1.4, { wash: 0x8e2a1c, line: 0, accent: true }, (d) => (d.y < 0.05 ? 0.0 : 1 - 0.07 * Math.abs(Math.sin(Math.atan2(d.z, d.x) * 6))), 5, 24);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    x.sweep([new Vector3(0, 1.95, 0), new Vector3(Math.cos(a) * 1.3, 2.38, Math.sin(a) * 1.3)], () => 0.012, 3, pole);
  }
  const g = merge([k.build(), x.build()]);
  warmSpill(g, new Vector3(0, 1.8, 0), new Color(1.0, 0.55, 0.3), 2.0, 0.45, 2.0);
  return g;
}

/**
 * The east market: the booths and parasol tables (instanced sets), and per copy what an instance cannot vary — the
 * lanterns at the eaves, a 麵 banner or menu strips (existing sign specs: the colour atlas is full), the counter's glow
 * (a light-pool emitter and its streak), steam, customers at the counter and sitters at the tables.
 */
export function marketRow(ctx: Ctx, rng: Rng): void {
  const UP = new Vector3(0, 1, 0);
  BOOTHS.forEach(([bx, bz], i) => {
    const m = new Matrix4().compose(new Vector3(bx, Y0, bz), new Quaternion().setFromAxisAngle(UP, -Math.PI / 2), new Vector3(1, 1, 1));
    placeSet('booth', () => boothSet(rng), m);
    const w = (lx: number, ly: number, lz: number): Vector3 => new Vector3(lx, ly, lz).applyMatrix4(m);
    const front = new Vector3(-1, 0, 0);
    // four lanterns along the front eave (the targets hang three or four a stall)
    for (const lx of [-1.45, -0.5, 0.5, 1.45]) { const p = w(lx, 2.3, 0.3); ctx.lantern(p.x, p.y, p.z, Math.abs(lx) > 1 ? 0.7 : 0.55); }
    if (i % 2 === 0) {
      ctx.signs.place({ at: w(-0.85, 1.35, 0.06), normal: front, size: 0.46, spec: { text: '麵', color: '#b8261a', vertical: true, style: 'banner', ink: '#efe8d8' }, gain: 1.4, blade: true }, null);
    } else {
      // two menu strips on the front posts (MENU[j] keeps its colour pair: j % 3 === 0 is the red one)
      for (const [sx, j] of [[-1, i % MENU.length], [1, (i + 3) % MENU.length]] as const) {
        const red = j % 3 === 0;
        ctx.signs.place({ at: w(sx * 1.24, 1.5, 0.02), normal: front, size: 0.13, spec: { text: MENU[j] ?? MENU[0], color: red ? '#f3e7cf' : '#b8261a', vertical: true, style: 'paper', ink: red ? '#b8261a' : '#efe6d2' }, gain: 1.15 }, null);
      }
    }
    ctx.emitters.push({ at: w(0, 1.5, -0.3), color: new Color(0xffb870), w: 2.2, h: 1.4, power: 0.4, spill: 0.5 });
    // the warm light it throws out on the flagstones in front (the render lane turns it into a tight pool)
    ctx.emitters.push({ at: w(0, 0.4, 0.9), color: new Color(0xffa860), w: 2.4, h: 0.6, power: 0.25, spill: 0.45 });
    // steam off the steamer and the pot, rising in a column past the eave
    ctx.steam.push(w(0.32, 1.5, -0.45), w(0.85, 1.35, -0.48), w(0.5, 2.6, -0.2), w(0.55, 3.4, 0.1));
    // one or two customers at the counter, facing it (east)
    for (let c = 0; c < 1 + (i % 2); c++) {
      const p = w(-0.7 + c * 1.1 + rng.range(-0.2, 0.2), 0, 0.55 + rng.range(0, 0.25));
      ctx.walkers.push(new Matrix4().compose(p, new Quaternion().setFromAxisAngle(UP, Math.PI / 2 + rng.range(-0.35, 0.35)), new Vector3(1, 1, 1)));
    }
    ctx.map.push({ x0: bx, z0: bz - BOOTH.w / 2, x1: bx + BOOTH.d, z1: bz + BOOTH.w / 2, kind: 'block' });
  });
  for (const [tx, tz, q] of PARASOLS) {
    const r = (q * Math.PI) / 2;
    const m = new Matrix4().compose(new Vector3(tx, Y0, tz), new Quaternion().setFromAxisAngle(UP, r), new Vector3(1, 1, 1));
    placeSet('parasol', parasolSet, m);
    // the sitters at the table's west and south sides (local), facing it (the east and north ones: marketDiners)
    for (const [lx, lz, yaw] of [[-0.64, 0, Math.PI / 2], [0, 0.64, Math.PI]] as const) {
      const p = new Vector3(lx, 0, lz).applyMatrix4(m);
      ctx.sitters.push(new Matrix4().compose(p, new Quaternion().setFromAxisAngle(UP, r + yaw), new Vector3(1, 1, 1)));
    }
    const lp = new Vector3(0, 2.0, 0).applyMatrix4(m);
    ctx.lantern(lp.x, lp.y, lp.z, 0.45);
    ctx.steam.push(new Vector3(-0.16, 0.85, 0.06).applyMatrix4(m));
  }
}

/**
 * E281 pass 9: the stalls' empty seats filled — the noodle stall's third counter stool and its two folding tables'
 * other two sides, the hawker's middle stool: six sitters, called last (a multiple of three, so no sitter changes coat)
 */
export function stallDiners(ctx: Ctx): void {
  const { x0, z1 } = STALL;
  ctx.sitters.push(seat(x0 + 0.8 + 2 * 1.4, z1 + 0.62, Math.PI));
  for (const [tx, tz] of [[x0 + 1.3, z1 + 2.4], [x0 + 4.0, z1 + 2.6]] as const) {
    ctx.sitters.push(seat(tx - 0.62, tz, Math.PI / 2), seat(tx, tz + 0.62, Math.PI));
  }
  ctx.sitters.push(seat(mid(HAWKER.x0, HAWKER.x1) + 0.3, HAWKER.z1 + 0.52, Math.PI));
}

/**
 * E281 round 2: every parasol table full — the diners on each table's east and north sides (the west and south ones
 * sit down in marketRow). Called after everything else the square seats, so no earlier sitter changes variant.
 */
export function marketDiners(ctx: Ctx): void {
  const UP = new Vector3(0, 1, 0);
  for (const [tx, tz, q] of PARASOLS) {
    const r = (q * Math.PI) / 2;
    const m = new Matrix4().compose(new Vector3(tx, Y0, tz), new Quaternion().setFromAxisAngle(UP, r), new Vector3(1, 1, 1));
    for (const [lx, lz, yaw] of [[0.64, 0, -Math.PI / 2], [0, -0.64, 0]] as const) {
      const p = new Vector3(lx, 0, lz).applyMatrix4(m);
      ctx.sitters.push(new Matrix4().compose(p, new Quaternion().setFromAxisAngle(UP, r + yaw), new Vector3(1, 1, 1)));
    }
  }
}

/**
 * E281 round 2: a dining pavilion in its own frame (table at the origin): four lacquer posts under a plum tiled canopy
 * (the gate's curved roof in small, a warm-lit soffit and ceiling), a fringe of cloth round the eave, a table with a
 * hot pot, bowls and a teapot. The diners are TRELLIS sitters (pavilionDiners), the lanterns and the light per copy.
 */
export function pavilionSet(): BufferGeometry {
  const k = new Kit(), x = new KitX();
  const hh = PAV.half, H = PAV.h;
  const POST: Look = { wash: 0x4a1a12, line: 1, accent: true, gloss: true, surf: SURF.lacquer };
  for (const [lx, lz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) k.box(lx * hh, 0, lz * hh, 0.1, H, 0.1, POST, { bottom: null });
  for (const sz of [-1, 1]) {
    k.box(0, H - 0.1, sz * hh, 2 * hh + 0.1, 0.1, 0.1, POST);
    k.box(sz * hh, H - 0.1, 0, 0.1, 0.1, 2 * hh + 0.1, POST);
  }
  curvedRoof(k, x, null, { cx: 0, y0: H, cz: 0, w: 2 * hh + 0.9, d: 2 * hh + 0.9, h: 0.95, lift: 0.3, flare: 0.14, tile: 0x4a1e2c, neon: null, ornaments: false, grid: [5, 3], roll: 0.45, soffit: [0xc8864a, 0xa86a3a], eave: [0x6a2230, 0x5a1c28] });
  k.box(0, H - 0.02, 0, 2 * hh - 0.1, 0.04, 2 * hh - 0.1, { wash: 0xd89a58, emit: 0.5, line: 0.6, accent: true, surf: SURF.none }, { top: null });
  // a cloth fringe round the eave beam, both faces
  for (let side = 0; side < 4; side++) {
    const a = (side * Math.PI) / 2, ca = Math.cos(a), sa = Math.sin(a);
    const p0 = new Vector3(-hh * ca + hh * sa, H - 0.12, hh * sa + hh * ca), p1 = new Vector3(hh * ca + hh * sa, H - 0.12, -hh * sa + hh * ca);
    const dn = new Vector3(0, -0.22, 0);
    quad2(k, p0.clone().add(dn), p1.clone().add(dn), p1, p0, 2 * hh, 0.22, { wash: 0x7a2418, kind: K.cloth, row: 0, col: 0.9, line: 0.8, accent: true }, E.v0 | E.v1);
  }
  // the table: a timber top on a trestle, a hot pot on a burner, bowls, a teapot
  k.box(0, 0.7, 0, 1.0, 0.05, 1.0, { ...TIMBER, wash: 0x5a3420 });
  for (const [lx, lz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) k.box(lx * 0.42, 0, lz * 0.42, 0.06, 0.7, 0.06, TIMBER, { top: null, bottom: null });
  k.cyl(0, 0.75, 0, 0.16, 0.16, 0.05, 10, { wash: 0xff7a2a, emit: 1.6, line: 0, accent: true });
  k.cyl(0, 0.8, 0, 0.2, 0.18, 0.14, 12, { wash: 0x9aa0a6, line: 1, gloss: true }, { edges: E.rims });
  k.cyl(0, 0.94, 0, 0.18, 0.18, 0.005, 12, { wash: 0xb8321a, emit: 0.4, line: 0, accent: true });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    bowls(k, Math.cos(a) * 0.34, 0.75, Math.sin(a) * 0.34, 1, i % 2 === 0 ? 0xece8dd : 0xd7e0e4);
  }
  k.lathe(0.3, 0.75, -0.3, [[0.06, 0], [0.08, 0.04], [0.07, 0.1], [0.03, 0.13]], 8, { wash: 0x3a5a4a, line: 0.6, gloss: true }, false, 0);
  const g = merge([k.build(), x.build()]);
  warmSpill(g, new Vector3(0, 1.9, 0), new Color(1.0, 0.58, 0.3), 2.2, 0.5, H - 0.05);
  return g;
}

/** the pavilions: the instanced set, a lantern at each corner, the warm light, the hot pot's steam */
export function pavilions(ctx: Ctx): void {
  const UP = new Vector3(0, 1, 0);
  for (const [px, pz, r] of PAVILIONS) {
    const m = new Matrix4().compose(new Vector3(px, Y0, pz), new Quaternion().setFromAxisAngle(UP, r), new Vector3(1, 1, 1));
    placeSet('pavilion', pavilionSet, m);
    const w = (lx: number, ly: number, lz: number): Vector3 => new Vector3(lx, ly, lz).applyMatrix4(m);
    for (const [lx, lz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) { const p = w(lx * (PAV.half + 0.3), PAV.h - 0.05, lz * (PAV.half + 0.3)); ctx.lantern(p.x, p.y, p.z, 0.6); }
    ctx.emitters.push({ at: w(0, 1.4, 0), color: new Color(0xffb070), w: 2.2, h: 1.2, power: 0.35, spill: 0.55 });
    ctx.steam.push(w(0, 1.05, 0), w(0.1, 1.7, 0.05));
    ctx.map.push({ x0: px - PAV.half, z0: pz - PAV.half, x1: px + PAV.half, z1: pz + PAV.half, kind: 'block' });
  }
}

/** the pavilions' diners, four a table (called last: 12 sitters, a multiple of three, so no other sitter changes coat) */
export function pavilionDiners(ctx: Ctx): void {
  const UP = new Vector3(0, 1, 0);
  for (const [px, pz, r] of PAVILIONS) {
    const m = new Matrix4().compose(new Vector3(px, Y0, pz), new Quaternion().setFromAxisAngle(UP, r), new Vector3(1, 1, 1));
    for (const [lx, lz, yaw] of [[-0.78, 0, Math.PI / 2], [0.78, 0, -Math.PI / 2], [0, 0.78, Math.PI], [0, -0.78, 0]] as const) {
      const p = new Vector3(lx, 0, lz).applyMatrix4(m);
      ctx.sitters.push(new Matrix4().compose(p, new Quaternion().setFromAxisAngle(UP, r + yaw), new Vector3(1, 1, 1)));
    }
  }
}
