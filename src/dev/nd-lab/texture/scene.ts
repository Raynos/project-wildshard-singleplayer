// P5 texture lab test scene: a corner of Lantern Square at blue hour. Wet flagstones out to 70 m (the far-tiling test),
// the Well's carved balustrade run on the west over the drop, a Kowloon tower base on the east with a row of
// shopfronts (poster-covered piers, timber frames, lit rooms, a glazed-tile lean-to and striped awnings), a small
// cinnabar lacquer gate with an azurite roof, a lacquered lantern post, and tower walls across the Well and to the north
// (concrete at every distance). Neon: a lightbox 麵, blade tubes 茶 / 藥房, a horizontal 旅館, lanterns and a lamp.
import { Color, Vector3 } from 'three';
import type { Emitter } from './emitters';
import { type Dressing, dressWall } from './facade/grammar';
import { E, K, type Kit, type Look } from './kit';
import type { Lanterns } from './lanterns';
import { SURF } from './paint';
import type { SignBuilder } from './signs';
import { MIN, METAL, NEON, Rng, WALL, chars } from './util';

export const Y0 = 125;
const STONE: Look = { wash: 0x76767b, kind: K.stone, line: 1, wet: 0.5 };
const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

/** the Well's balustrade (the clean room's square.ts): plinth, carved panels, posts with lotus caps, a top rail */
export function balustrade(k: Kit, at: number, a0: number, a1: number, y: number): void {
  const len = a0 - a1;
  const n = Math.max(1, Math.round(len / 2.3));
  const step = len / n;
  const bx = (p: number, yy: number, sAcross: number, sy: number, sAlong: number, lk: Look): void => { k.box(at, yy, p, sAcross, sy, sAlong, lk); };
  bx((a0 + a1) / 2, y, 0.62, 0.16, len, { ...STONE, line: 2 });
  for (let i = 0; i <= n; i++) {
    const p = a0 - i * step;
    bx(p, y + 0.16, 0.36, 0.86, 0.36, STONE);
    k.cyl(at, y + 1.02, p, 0.16, 0.2, 0.1, 8, STONE);
    k.lathe(at, y + 1.12, p, [[0.2, 0], [0.22, 0.08], [0.19, 0.18], [0.1, 0.28], [0.02, 0.34]], 8, STONE, true, 0);
    if (i < n) {
      const pm = p - step / 2;
      bx(pm, y + 0.16, 0.16, 0.6, step - 0.36, { wash: 0x6f6f74, kind: K.panel, line: 1, wet: 0.5 });
      bx(pm, y + 0.76, 0.26, 0.12, step - 0.3, STONE);
    }
  }
}

/** a hip roof with upturned corners and glazed tiles (square.ts hipRoof, no neon) */
export function hipRoof(k: Kit, cx: number, y0: number, cz: number, w: number, d: number, h: number, up: number, tile: number): void {
  const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
  const rx0 = x0 + d * 0.42, rx1 = x1 - d * 0.42;
  const yr = y0 + h;
  const tl: Look = { wash: tile, kind: K.tiles, line: 1, accent: true };
  const A = new Vector3(x0, y0 + up, z1), B = new Vector3(x1, y0 + up, z1), C = new Vector3(x1, y0 + up, z0), D = new Vector3(x0, y0 + up, z0);
  const mA = new Vector3(cx, y0, z1), mC = new Vector3(cx, y0, z0);
  const R0 = new Vector3(rx0, yr, cz), R1 = new Vector3(rx1, yr, cz);
  const slant = Math.hypot(h, d / 2);
  k.quad4(A, mA, new Vector3(cx, yr, cz), R0, w / 2, slant, tl, 0, 0, E.u0 | E.v0);
  k.quad4(mA, B, R1, new Vector3(cx, yr, cz), w / 2, slant, tl, 0, 0, E.u1 | E.v0);
  k.quad4(C, mC, new Vector3(cx, yr, cz), R1, w / 2, slant, tl, 0, 0, E.u0 | E.v0);
  k.quad4(mC, D, R0, new Vector3(cx, yr, cz), w / 2, slant, tl, 0, 0, E.u1 | E.v0);
  k.tri(D, A, R0, tl);
  k.tri(B, C, R1, tl);
  k.quad4(D, C, B, A, w, d, { wash: MIN.azurite, line: 1, accent: true });
  k.box(cx, y0 - 0.22, z1 - 0.05, w - 0.2, 0.22, 0.12, { wash: MIN.lightMalachite, line: 1, accent: true });
  k.box(cx, y0 - 0.22, z0 + 0.05, w - 0.2, 0.22, 0.12, { wash: MIN.lightMalachite, line: 1, accent: true });
  k.box((rx0 + rx1) / 2, yr - 0.05, cz, rx1 - rx0 + 0.3, 0.32, 0.3, { wash: 0x245e48, line: 1, accent: true });
  for (const rx of [rx0, rx1]) {
    k.box(rx, yr + 0.2, cz, 0.3, 0.5, 0.24, { wash: 0x245e48, line: 1, accent: true });
    k.box(rx + (rx === rx0 ? -0.12 : 0.12), yr + 0.5, cz, 0.12, 0.3, 0.14, { wash: METAL.gold, line: 1, accent: true });
  }
}

/** a tower wall of facade cells: a vertical rectangle from p0 along u (w m) and up (h m) */
function wall(k: Kit, p0: Vector3, u: Vector3, w: number, h: number, wash: number, seed: number, colP = 2.4): void {
  k.quad(p0, u, new Vector3(0, 1, 0), w, h, { wash, kind: K.facade, row: 3.0, col: colP, seed, line: 1 });
}

/** a slab tower: four facade walls and a roof, x0..x1 × z0..z1 from y0 to y1 */
function tower(k: Kit, x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, wash: number, seed: number): void {
  const h = y1 - y0;
  wall(k, new Vector3(x0, y0, z1), new Vector3(1, 0, 0), x1 - x0, h, wash, seed);
  wall(k, new Vector3(x1, y0, z0), new Vector3(-1, 0, 0), x1 - x0, h, wash, seed + 1);
  wall(k, new Vector3(x1, y0, z1), new Vector3(0, 0, -1), z1 - z0, h, wash, seed + 2);
  wall(k, new Vector3(x0, y0, z0), new Vector3(0, 0, 1), z1 - z0, h, wash, seed + 3);
  k.quad(new Vector3(x0, y1, z1), new Vector3(1, 0, 0), new Vector3(0, 0, -1), x1 - x0, z1 - z0, { wash: 0x6d737c, line: 1, surf: SURF.concrete });
}

export interface Corner { lanterns: Lanterns; emitters: Emitter[] }

export function buildCorner(k: Kit, signs: SignBuilder, lanterns: Lanterns, fd: Dressing): Corner {
  const y = Y0;
  const rng = new Rng(5);
  const emitters: Emitter[] = [];
  // ── the square's wet flagstones (to 70 m north: the far-tiling test) and the Well's lip ──
  k.quad(new Vector3(-0.4, y, 16), new Vector3(1, 0, 0), new Vector3(0, 0, -1), 14.4, 78, { wash: 0x3e4148, kind: K.flag, wet: 1, line: 0 });
  k.box(-0.7, y - 1.4, -27, 0.6, 1.4, 86, { wash: 0x8d8f93, line: 1.5, surf: SURF.stone });
  balustrade(k, -0.2, 14, -46, y);

  // ── across the Well (west) and down it: concrete at 30–60 m ──
  wall(k, new Vector3(-30, y - 70, 20), new Vector3(0, 0, -1), 70, 130, WALL[1], 3);
  wall(k, new Vector3(-30, y - 70, -50), new Vector3(1, 0, 0), 30, 130, WALL[3], 4);

  // ── the tower base on the east: concrete above, shopfronts below ──
  const tx = 14;
  // the facade lab's Kowloon grammar above the shops (its shell program carries the P5 paint too)
  for (const [z0, len, top, seed] of [[-54, 16, 58, 11], [-38, 14, 44, 12], [-24, 18, 62, 13], [-6, 22, 50, 14]] as const) {
    dressWall(fd, new Vector3(tx, y + 4.6, z0), new Vector3(-1, 0, 0), len, y + 4.6, y + top, seed, { shops: false, street: y, detailY: [y - 5, y + 60], timber: 0.15, lit: 0.72, lod: 0, roof: true }, 12, 1);
  }
  k.box(tx + 0.1, y + 4.2, -19, 0.5, 0.42, 70, { wash: 0x7d8590, line: 1, surf: SURF.concrete });
  const bays = [-2, -7.5, -13, -18.5, -24, -29.5, -35];
  const texts: readonly { t: string; c: number }[] = [{ t: '茶', c: NEON.jade }, { t: '藥房', c: NEON.magenta }, { t: '旅館', c: NEON.amber }, { t: '牙科', c: NEON.cyan }];
  for (let i = 0; i < bays.length; i++) {
    const zc = bays[i] ?? 0;
    const zA = zc + 2.75, zB = zc - 2.75;
    // poster piers (concrete + torn bills), then the timber shopfront between them
    for (const zp of i === 0 ? [zA, zB] : [zB]) k.box(tx - 0.25, y, zp, 0.8, 4.2, 0.7, { wash: WALL[2], line: 1, surf: SURF.poster, seed: zp });
    const lit = i !== 3;
    k.quad(new Vector3(tx, y, zB + 0.35), new Vector3(0, 0, 1), new Vector3(0, 1, 0), 4.8, 3.3,
      { wash: lit ? rng.pick([0xd9a868, 0xe0b47a, 0xd49a5c]) : 0x2c2f35, emit: lit ? 0.5 : 0, kind: K.facade, row: 0.55, col: 0.7, seed: i * 7.3, line: 1, accent: true });
    const wood: Look = { wash: 0x5b4331, line: 1, surf: SURF.wood, accent: true };
    k.box(tx - 0.2, y + 3.3, zc, 0.3, 0.9, 4.8, wood); // fascia board
    k.box(tx - 0.15, y, zc, 0.25, 0.25, 4.8, wood); // sill
    for (const dz of [-1.6, 0, 1.6]) k.box(tx - 0.12, y + 0.25, zc + dz, 0.2, 3.05, 0.14, wood); // mullions
    if (i % 2 === 0) {
      // a glazed-tile lean-to on brackets
      const tl: Look = { wash: i % 4 === 0 ? MIN.malachite : MIN.azurite, kind: K.tiles, line: 1, accent: true };
      k.quad4(new Vector3(tx - 1.9, y + 4.05, zB + 0.3), new Vector3(tx - 1.9, y + 4.05, zA - 0.3), new Vector3(tx - 0.1, y + 4.75, zA - 0.3), new Vector3(tx - 0.1, y + 4.75, zB + 0.3),
        4.9, Math.hypot(1.8, 0.7), tl);
      k.box(tx - 1.0, y + 3.95, zc, 1.9, 0.1, 4.9, { wash: MIN.lightMalachite, line: 1, accent: true });
      for (const dz of [-2.2, 2.2]) k.beam(new Vector3(tx, y + 3.4, zc + dz), new Vector3(tx - 1.8, y + 4.0, zc + dz), 0.08, 0.08, { wash: 0x2a2c31, line: 1 });
    } else {
      k.quad4(new Vector3(tx - 1.6, y + 3.1, zB + 0.35), new Vector3(tx - 1.6, y + 3.1, zA - 0.35), new Vector3(tx - 0.05, y + 3.7, zA - 0.35), new Vector3(tx - 0.05, y + 3.7, zB + 0.35),
        4.8, 1.7, { wash: i % 3 === 0 ? 0xc23b22 : 0x2e5fa3, kind: K.cloth, row: 1, col: 0.5, line: 1, accent: true });
    }
    // the signs: a blade tube on the pier, a lightbox over the door
    const tt = texts[i % texts.length] ?? { t: '茶', c: NEON.jade };
    if (i < 5) {
      const bladeSize = 0.72;
      const n = chars(tt.t).length;
      signs.place({ at: new Vector3(tx - 1.3, y + 6.3 + n * 0.3, zB), normal: new Vector3(0, 0, 1), size: bladeSize,
        spec: { text: tt.t, color: hex(tt.c), vertical: true, style: 'tube' }, blade: true, gain: 4.4 }, k);
    }
    if (i === 1) {
      signs.place({ at: new Vector3(tx - 0.4, y + 3.75, zc), normal: new Vector3(-1, 0, 0), size: 0.7,
        spec: { text: '麵', color: '#fff1dc', vertical: false, style: 'box' }, gain: 2.2, board: 0xa8261a }, k);
    }
    if (lit) emitters.push({ at: new Vector3(tx - 0.2, y + 1.6, zc), color: new Color(0xffc48a), w: 4.3, h: 2.6, power: 0.24, spill: 0.12 }); // the clean room's lit shopfront (spill 0.3 there: 7 bays 14 m off tint the stone orange here)
  }

  // ── the lacquer gate (two cinnabar posts, a lintel, a painted board, an azurite roof) ──
  const gz = -21;
  const lac: Look = { wash: 0x9c3627, line: 1, accent: true, surf: SURF.lacquer };
  for (const gx of [3.2, 9.2]) {
    k.box(gx, y, gz, 0.9, 0.5, 0.9, { ...STONE, kind: K.panel, wash: 0x7a7a7f });
    k.box(gx, y + 0.5, gz, 0.46, 4.6, 0.46, lac);
  }
  k.box(6.2, y + 4.4, gz, 7.2, 0.36, 0.5, lac);
  k.box(6.2, y + 3.8, gz, 6.1, 0.28, 0.4, lac);
  k.box(6.2, y + 4.02, gz, 1.6, 0.36, 0.3, { wash: MIN.azurite, line: 1, accent: true });
  hipRoof(k, 6.2, y + 4.85, gz, 8.2, 1.9, 1.1, 0.35, MIN.azurite);
  signs.place({ at: new Vector3(6.2, y + 4.1, gz + 0.2), normal: new Vector3(0, 0, 1), size: 0.3, spec: { text: '九龍', color: '#f0c86a', vertical: false, style: 'plaque', ink: '#1d3f6e' }, gain: 1.5 }, null);
  // a lacquered lantern post by the balustrade, and a street lamp
  k.box(1.3, y, -9, 0.3, 4.4, 0.3, lac);
  k.box(1.3, y + 4.4, -9.35, 0.12, 0.12, 1.0, lac);
  lanterns.hang(new Vector3(1.3, y + 4.25, -9.8), 0.9);
  k.beam(new Vector3(1.1, y, 3), new Vector3(1.1, y + 4.2, 3), 0.1, 0.1, { wash: 0x2a2c31, line: 1 });
  k.box(1.1, y + 4.1, 3, 0.34, 0.3, 0.34, { wash: 0xffd9a0, emit: 1.8, line: 1, accent: true });
  k.box(1.1, y + 4.4, 3, 0.5, 0.08, 0.5, { wash: MIN.malachite, line: 1, accent: true });
  // lanterns strung from the gate to the tower
  for (let i = 1; i < 6; i++) {
    const t = i / 6;
    const p = new Vector3(9.2, y + 5.2, gz).lerp(new Vector3(tx - 0.5, y + 6.0, -9), t);
    p.y -= 0.9 * 4 * t * (1 - t);
    lanterns.hang(p, 0.75);
  }

  // ── the backdrop: a block across the street north, and farther ones into the fog ──
  dressWall(fd, new Vector3(-6, y, -62), new Vector3(0, 0, 1), 40, y, y + 60, 21, { shops: true, street: y, detailY: [y - 5, y + 60], timber: 0.2, lit: 0.72, lod: 1, roof: true }, 14, 1);
  tower(k, 20, -130, 60, -105, y - 20, y + 90, WALL[7], 31);
  tower(k, -60, -150, -20, -120, y - 60, y + 80, WALL[4], 41);
  return { lanterns, emitters };
}
