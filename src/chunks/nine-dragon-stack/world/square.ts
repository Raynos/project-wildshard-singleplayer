// Lantern Square: wet granite, the Well's stone balustrade and sign masts, the cinnabar paifang (九龍疊城), the banyan
// in its round planter with the earth-god shrine, mahjong tables, the noodle stall, lantern strings and the crowd.
import { Color, Matrix4, Quaternion, Vector3 } from 'three';
import { buildBanyan } from './banyan';
import { mahjong as heroMahjong, mahjongSeats } from './hero/figures';
import type { Ctx } from './ctx';
import { buildGate, relief } from './gate';
import { SURF } from '../look/paint';
import { lionOnPost } from './props3d';
import type { KitX } from './hero/kitx';
import { hawkerStall, noodleStall } from './stalls';
import { E, K, type Kit, type Look } from './kit';
import { GATE, PLAZA, STALL, STREET, WELL, Y0, walkable } from '../layout';
import { dragonHook, lamp, scooter } from './props';
import { MIN, METAL, NEON, Rng, chars } from '../util';

// the balustrade's stone: a mid wet grey (dome A's ΔE: 0x76767b rendered #757784, 0x4a4c53 #44454e; the spawn target #656469)
const STONE: Look = { wash: 0x626469, kind: K.stone, line: 1, wet: 0.55, surf: SURF.concrete };
const UPV = new Vector3(0, 1, 0);
/** a figure's placement on the square's floor */
const standAt = (x: number, z: number, yaw: number, s: number): Matrix4 => new Matrix4().compose(new Vector3(x, Y0, z), new Quaternion().setFromAxisAngle(UPV, yaw), new Vector3(s, s, s));
const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

function flagstones(k: Kit, x0: number, z0: number, x1: number, z1: number, y: number): void {
  k.quad(new Vector3(x0, y, z1), new Vector3(1, 0, 0), new Vector3(0, 0, -1), x1 - x0, z1 - z0, { wash: 0x3e4148, kind: K.flag, wet: 1, line: 0 });
}

/**
 * The Well's balustrade: plinth, carved panels, posts with lotus caps, a top rail; the ground line is heavier.
 * It runs along z at x = `at` (or along x at z = `at` when `alongX`), from `a0` down to `a1`.
 */
export function balustrade(k: Kit, at: number, a0: number, a1: number, y: number, alongX = false, carve?: { x: KitX; side: number }, lionRun?: 'plaza' | 'street'): void {
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
    // a lotus-bud finial (style-A's balustrade): a petal collar, the bud swelling and closing to a point; a post that
    // carries a TRELLIS lion (props3d.ts) keeps only its cap block
    if (lionRun === undefined || !lionOnPost(lionRun, i, n)) k.lathe(cx, y + 1.12, cz, [[0.2, 0], [0.23, 0.05], [0.17, 0.09], [0.19, 0.15], [0.18, 0.22], [0.13, 0.3], [0.06, 0.37], [0.0, 0.41]], 12, STONE, true, 0);
    if (i < n) {
      const pm = p - step / 2;
      bx(pm, y + 0.16, 0.16, 0.6, step - 0.36, { wash: 0x5c5e64, kind: K.panel, line: 1, wet: 0.5 });
      // dome B: the panel's face toward the square carved in relief (a dragon among clouds, as the targets' balustrades)
      if (carve !== undefined) {
        const [pcx, pcz] = px(pm);
        const nrm = alongX ? new Vector3(0, 0, carve.side) : new Vector3(carve.side, 0, 0);
        relief(carve.x, new Vector3(pcx + nrm.x * 0.085, y + 0.46, pcz + nrm.z * 0.085), new Vector3(-nrm.z, 0, nrm.x), UPV.clone(), nrm, step - 0.5, 0.52, 3000 + i, { wash: 0x76787e, line: 0, wet: 0.3 });
      }
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


function paifang(ctx: Ctx): void {
  // dome B's paifang (gate.ts): lacquer posts on Sumeru bases, drum stones, painted beams, dense dougong, thick tiled
  // roofs with a rafter soffit, the gold-framed 九龍 plaque, couplets, lanterns (no eave neon: the style-A mockup and the
  // dome-B targets light the gate with its lanterns only)
  const k = ctx.kit('paifang', true);
  const x = ctx.kitx('paifang');
  buildGate(k, x, ctx.signs, (px, py, pz, s) => { ctx.lantern(px, py, pz, s); }, {
    x: GATE.x, y: Y0, z: GATE.z, posts: GATE.posts, s: GATE.s, plaque: '九龍', couplets: ['萬家燈火', '天下一家'], neonEaves: null, lions: false,
  });
  ctx.map.push({ x0: GATE.posts[0] - 0.6, z0: GATE.z - 1.2, x1: GATE.posts[3] + 0.6, z1: GATE.z + 1.2, kind: 'gate' });
}

/** steel lattice sign masts on the Well's lip, blade signs hung out over the drop, a dragon hook on top */
function signMasts(ctx: Ctx): void {
  const k = ctx.kit('paifang', true); // the square cluster's kit (one draw, budget.md)
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
  const floor = ctx.kit('props'); // the balustrade's kit (one draw, budget.md)
  flagstones(floor, PLAZA.x0, PLAZA.z0, PLAZA.x1, PLAZA.z1, Y0);
  flagstones(floor, STREET.x0, STREET.z0, STREET.x1, STREET.z1, Y0);
  // the plaza's lip over the Well
  floor.box(PLAZA.x0 - 0.3, Y0 - 1.4, (PLAZA.z0 + PLAZA.z1) / 2, 0.6, 1.4, PLAZA.z1 - PLAZA.z0, { wash: 0x8d8f93, line: 1.5, surf: SURF.concrete });
  const props = ctx.kit('props', true);
  const carve = { x: ctx.kitx('props'), side: 1 };
  balustrade(props, PLAZA.x0 + 0.2, PLAZA.z1, PLAZA.z0, Y0, false, carve, 'plaza');
  balustrade(props, STREET.x0 + 0.2, PLAZA.z0 - 0.1, WELL.z0, Y0, false, carve, 'street');
  ctx.map.push({ x0: PLAZA.x0, z0: PLAZA.z0, x1: PLAZA.x1, z1: PLAZA.z1, kind: 'plaza' });
  ctx.map.push({ x0: STREET.x0, z0: -140, x1: STREET.x1, z1: STREET.z1, kind: 'street' });
  paifang(ctx);
  buildBanyan(ctx, rng);
  noodleStall(ctx, rng);
  hawkerStall(ctx, rng);
  signMasts(ctx);
  // mahjong under the banyan's edge
  // mahjong: the hero lab's tables; the players are the TRELLIS sitters (with their own stools), instanced by main.ts
  // dome B round 9: one table brought to the spawn's mid-right, ~8 m ahead (style-A's mahjong players), beside the hawker
  const tables: [number, number, number, number][] = [[11.6, -19.4, 0.2, 4], [12.4, -10.6, -0.3, 3], [4.7, 0.4, 0.15, 4], [14.6, -4.2, 0.5, 2]];
  const tx = ctx.kitx('props');
  for (const [tx0, tz0, tr, n] of tables) {
    heroMahjong(props, tx, rng, tx0, Y0, tz0, tr, 0, 0x6f8fa8, false);
    for (const st of mahjongSeats(tx0, tz0, tr).slice(0, n)) ctx.sitters.push(standAt(st.x, st.z, st.yaw, 1));
  }
  // the crowd (dome B: the TRELLIS walkers only, the procedural mannequins are gone; the dome-B targets fill the square
  // with ~60 people): along the street north, under the gate, across the square, by the stall, along the balustrade
  for (let i = 0; i < 34; i++) {
    const z = rng.range(-95, -33);
    const x = rng.range(STREET.x0 + 1.5, STREET.x1 - 1.2);
    if ((x - 7) ** 2 + (z + 52) ** 2 < 16) continue; // keep the canyon-up camera clear
    ctx.walkers.push(standAt(x, z, rng.chance(0.5) ? Math.PI + rng.range(-0.3, 0.3) : rng.range(-0.3, 0.3), rng.range(0.94, 1.04)));
  }
  const crowdRng = new Rng(1234);
  const placed: [number, number][] = [];
  // dome C1: mockup C's camera at (18, +125, 6) looking east up the stair-street keeps its foreground clear
  const keepClear: [number, number, number][] = [[13, -13, 3.2], [0.95, 7.5, 2.5], [1.45, 5.05, 2.5], [7, -52, 4], [18.5, 6, 2.6], [6.05, -20, 2.8]];
  const free = (x: number, z: number): boolean => {
    if (!walkable(x, z)) return false;
    for (const [tx0, tz0] of tables) if ((x - tx0) ** 2 + (z - tz0) ** 2 < 1.5 ** 2) return false;
    for (const [cx, cz, r] of keepClear) if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) return false;
    if (x > 13.9 && x < 16.6 && z > -21.2 && z < -19.6) return false; // the shrine
    if (x > 13.9 && x < 15.5 && z > -24.4 && z < -23.0) return false; // the stele
    if (x > STALL.x0 - 0.4 && x < STALL.x1 + 0.4 && z > STALL.z1 && z < STALL.z1 + 3.4) return false; // the stall's tables
    if (x > 18 && x < 22 && z > 3.5 && z < 8.5) return false; // dome C1: the cone east of its camera, to the stair's foot
    // dome A2 (the anchor 4.5 m before the gate): its east and south foregrounds stay open (targets 6 and 7)
    if (x > 8 && x < 10.5 && z > -22.5 && z < -17.5) return false;
    if (x > 3.5 && x < 8.5 && z > -17.5 && z < -13) return false;
    for (const [px, pz] of placed) if ((x - px) ** 2 + (z - pz) ** 2 < 0.9 * 0.9) return false;
    // the spawn frame's foreground stays open for 14 m (style-A: the crowd is mid-distance, under the gate)
    const dx = x - 0.95, dz = z - 7.5, along = dx * 0.208 - dz * 0.978, across = Math.abs(dx * 0.978 + dz * 0.208);
    if (along > 0 && along < 20 && across < along * 0.84 + 1.2) return false;
    return true;
  };
  const zones: { n: number; x: [number, number]; z: [number, number]; yaw: () => number }[] = [
    // through the gate, north or south
    { n: 14, x: [1.6, 11.2], z: [-27, -19.5], yaw: () => (crowdRng.chance(0.5) ? Math.PI : 0) + crowdRng.range(-0.35, 0.35) },
    // across the square in every direction
    { n: 8, x: [2.2, 13], z: [-19.5, 1], yaw: () => crowdRng.range(0, Math.PI * 2) },
    // the east strip by the shops and the stall
    { n: 14, x: [14.5, 21.3], z: [-11.5, 1], yaw: () => crowdRng.range(0, Math.PI * 2) },
    // the south half, toward the stair street
    { n: 14, x: [2.5, 20.5], z: [1, 17], yaw: () => crowdRng.range(0, Math.PI * 2) },
  ];
  for (const zn of zones) {
    let n = 0;
    for (let tries = 0; tries < zn.n * 12 && n < zn.n; tries++) {
      const x = crowdRng.range(zn.x[0], zn.x[1]), z = crowdRng.range(zn.z[0], zn.z[1]);
      if (!free(x, z)) continue;
      placed.push([x, z]);
      ctx.walkers.push(standAt(x, z, zn.yaw(), crowdRng.range(0.94, 1.04)));
      n++;
    }
  }
  // loiterers at the balustrade, looking out over the Well
  for (const z of [-22.5, -16.8, -11.5, -3.2, 1.0]) {
    if (!free(1.35, z)) continue;
    placed.push([1.35, z]);
    ctx.walkers.push(standAt(1.35, z, -Math.PI / 2 + crowdRng.range(-0.4, 0.4), crowdRng.range(0.95, 1.03)));
  }
  // a short queue at the stall, beyond its tables
  for (let i = 0; i < 4; i++) ctx.walkers.push(standAt(STALL.x0 + 2.4 + i * 0.95, STALL.z1 + 3.9 + rng.range(-0.3, 0.3), Math.PI + rng.range(-0.4, 0.4), 1));
  scooter(props, 20.4, Y0, 13.5, 0.3, 0x2e5fa3);
  scooter(props, 20.9, Y0, 15.4, 0.2, 0xb8321f);
  scooter(props, 20.6, Y0, -4.5, 1.2, 0x7fbf9a);
  // lamps and lantern strings
  lamp(props, 1.1, Y0, 12, 4.2);
  lamp(props, 1.1, Y0, -9, 4.2);
  lamp(props, 1.1, Y0, -19, 4.2);
  lamp(props, 21, Y0, -6, 4.2);
  // the light lab's hunk (round-9-lab-light): the lamps are lights too (a warm pool under each, a streak in the wet stone)
  for (const [x, z] of [[1.1, 12], [1.1, -9], [1.1, -19], [21, -6]] as const) {
    ctx.emitters.push({ at: new Vector3(x, Y0 + 4.1, z), color: new Color(0xffc987), w: 0.34, h: 0.3, power: 0.5, spill: 0.25 });
  }
  const str = ctx.kit('paifang', true); // the square cluster's kit (one draw, budget.md)
  lanternString(ctx, new Vector3(GATE.x + 4, Y0 + 12.2, GATE.z + 0.5), new Vector3(22.6, Y0 + 12.5, -22), 1.9, str);
  lanternString(ctx, new Vector3(-1.2, Y0 + 10.4, -26), new Vector3(GATE.x - 1, Y0 + 11, GATE.z + 0.5), 1.8, str);
  lanternString(ctx, new Vector3(GATE.x + 4, Y0 + 9.8, GATE.z + 0.6), new Vector3(22.6, Y0 + 9.6, -28), 1.8, str);
  lanternString(ctx, new Vector3(-1.2, Y0 + 9.2, -12), new Vector3(22.6, Y0 + 9.6, -9), 2.2, str);
  // dome B: one more string over the square's north half (the targets hang lanterns across the square; a second one
  // nearer the spawn crowded the hero frame's sky)
  lanternString(ctx, new Vector3(-1.2, Y0 + 8.6, -19.5), new Vector3(22.6, Y0 + 9.2, -13.5), 2.0, str);
  for (let z = -26; z > -150; z -= 6) lanternString(ctx, new Vector3(STREET.x0 - 0.2, Y0 + 6.5 + (z % 3), z), new Vector3(STREET.x1 + 0.2, Y0 + 7.2, z - 1.5), 1.8, str);
}
