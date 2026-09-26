// Dome B (E169, round-10-dome-b): the noodle stall (大牌檔) at the banyan's foot at hero quality, against the dome-B
// targets (round-10-dome-b-*/target-2, 4, 7, 9 and the style-A spawn mockup): a green-painted steel frame under a
// corrugated roof, a red-and-white striped canvas awning with a scalloped valance, the white 麵 banner, a lit name
// board, a timber counter with a steel top crowded with bowls, chopstick cups and sauce bottles, three steaming
// stockpots and a wok on a glowing burner, a lit back wall of menu strips and shelves of jars, bare bulbs and lanterns,
// cooks behind the counter, customers on stools and at two folding tables in front, gas bottles and crates at the side.
import { Color, Matrix4, Quaternion, Vector3 } from 'three';
import type { Ctx } from './ctx';
import { E, K, type Kit, type Look } from './kit';
import { STALL, Y0 } from './layout';
import type { Rng } from './util';
import { SURF } from './paint';
import { person } from './hero/figures';
import { curve } from './hero/kitx';

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

/** a quad drawn on both faces */
function quad2(k: Kit, a: Vector3, b: Vector3, c: Vector3, d: Vector3, w: number, h: number, look: Look, edges: number = E.all): void {
  k.quad4(a, b, c, d, w, h, look, 0, 0, edges);
  k.quad4(b, a, d, c, w, h, look, 0, 0, edges);
}

export function noodleStall(ctx: Ctx, rng: Rng): void {
  const k = ctx.kit('stall', true);
  const x = ctx.kitx('stall');
  const { x0, x1, z0, z1 } = STALL;
  const y = Y0;
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
  const roofLook: Look = { wash: 0xa82318, kind: K.cloth, row: 1, col: 0.46, line: 1, accent: true };
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
  const awn: Look = { wash: 0xb8261a, kind: K.cloth, row: 1, col: 0.46, line: 1, accent: true };
  const aA = new Vector3(x0 - 0.1, aY1, aZ1), aB = new Vector3(x1 + 0.1, aY1, aZ1), aC = new Vector3(x1 + 0.1, aY0, z1), aD = new Vector3(x0 - 0.1, aY0, z1);
  k.quad4(aA, aB, aC, aD, W + 0.2, aA.distanceTo(aD), awn);
  k.quad4(aB, aA, aD, aC, W + 0.2, aA.distanceTo(aD), { ...awn, wash: 0x8e2016 });
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
  k.box(xc, y + 1.1, z0 + 0.08, W - 0.2, 2.1, 0.1, { wash: 0xa87c4a, emit: 0.18, line: 1, accent: true, surf: SURF.none });
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
  const menu = ['牛腩麵', '雲吞麵', '魚蛋粉', '炒麵', '豬扒包', '奶茶', '叉燒飯', '腸粉'] as const;
  menu.forEach((m, i) => {
    const mx = x0 + 0.6 + i * ((W - 1.2) / (menu.length - 1));
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
  ctx.emitters.push({ at: new Vector3(xc, y + 1.6, z1 - 0.2), color: new Color(0xffb870), w: W - 1, h: 1.8, power: 0.45, spill: 0.6 });
  ctx.emitters.push({ at: new Vector3(xc, y + 2.3, aZ1 - 0.6), color: new Color(0xffd0a0), w: W - 1.5, h: 0.6, power: 0.25, spill: 0.4 });
  // ── the signs: the white 麵 banner, the lit name board, a neon word on the roof ──
  ctx.signs.place({ at: new Vector3(x0 + 0.5, y + 1.72, aZ1 + 0.02), normal: new Vector3(0, 0, 1), size: 0.72, spec: { text: '麵', color: '#b8261a', vertical: true, style: 'banner', ink: '#efe8d8' }, gain: 1.35, blade: true }, null);
  x.sweep([new Vector3(x0 + 0.05, aY1 - 0.05, aZ1 + 0.02), new Vector3(x0 + 0.95, aY1 - 0.05, aZ1 + 0.02)], () => 0.018, 5, { wash: 0x3a2a1e, line: 0 });
  ctx.signs.place({ at: new Vector3(xc + 0.6, yf - 0.28, z1 + 0.02), normal: new Vector3(0, 0, 1), size: 0.34, spec: { text: '九記牛腩麵', color: '#fff1dc', vertical: false, style: 'box' }, gain: 2.0, board: 0xa8261a }, k);
  // wooden menu plaques hung along the front beam either side of the name board (the targets' stall front); they
  // reuse the back wall's menu strips (the same sign specs: no new cell in the shared colour atlas, which is full)
  menu.slice(0, 5).forEach((m, i) => {
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
}
