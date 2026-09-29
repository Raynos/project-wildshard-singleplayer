// Lantern Square: wet granite, the Well's stone balustrade and sign masts, the cinnabar paifang (九龍疊城), the banyan
// in its round planter with the earth-god shrine, mahjong tables, the noodle stall, lantern strings and the crowd.
import { Color, Matrix4, Quaternion, Vector3 } from 'three';
import { buildBanyan } from './banyan';
import { mahjongSeats } from './hero/figures';
import type { Ctx } from './ctx';
import { buildGate, relief } from './gate';
import { SURF } from '../look/paint';
import { lionOnPost } from './props3d';
import type { KitX } from './hero/kitx';
import { BOOTH, BOOTHS, PARASOLS, hawkerStall, marketRow, noodleStall } from './stalls';
import { E, K, type Kit, type Look } from './kit';
import { GATE, PLAZA, STALL, STREET, WELL, Y0, walkable } from '../layout';
import { dragonHook, lamp, scooter } from './props';
import { MIN, METAL, Rng } from '../util';

// the balustrade's stone: a mid wet grey (dome A's ΔE: 0x76767b rendered #757784, 0x4a4c53 #44454e; the spawn target #656469)
const STONE: Look = { wash: 0x626469, kind: K.stone, line: 1, wet: 0.55, surf: SURF.concrete };
const BUD: Look = { wash: 0x66676c, kind: K.stone, line: 1, wet: 0.45, surf: SURF.concrete };
const UPV = new Vector3(0, 1, 0);
/** a figure's placement on the square's floor */
const standAt = (x: number, z: number, yaw: number, s: number): Matrix4 => new Matrix4().compose(new Vector3(x, Y0, z), new Quaternion().setFromAxisAngle(UPV, yaw), new Vector3(s, s, s));

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
    // E281: chunkier posts under a square cap slab (the A1 / A2 targets' balustrade), the cap's top at +1.12 (a lion's seat)
    bx(p, y + 0.16, 0.44, 0.86, 0.44, STONE);
    bx(p, y + 1.02, 0.54, 0.1, 0.54, STONE);
    // a lotus-bud finial (style-A's balustrade): a petal collar, the bud swelling and closing to a point; a post that
    // carries a TRELLIS lion (props3d.ts) keeps only its cap block
    if (lionRun === undefined || !lionOnPost(lionRun, i, n)) lotusBud(k, cx, y + 1.12, cz);
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

/**
 * A lotus-bud finial on a post's cap at (cx, yb, cz): a petal collar turned out over the cap, a neck, then the bud
 * swelling and closing to a point — one ruled lathe of eight faces, its ribs the petals' seams (E281: the targets'
 * buds are as wide as the post, ~0.55 m, and ~0.7 m tall, carved stone with petal lines; a smooth brushed bud read as
 * an egg). ~290 vertices where the old 12-sided lathe took 336.
 */
function lotusBud(k: Kit, cx: number, yb: number, cz: number): void {
  k.lathe(cx, yb, cz, [[0.25, 0], [0.29, 0.05], [0.27, 0.1], [0.2, 0.13], [0.25, 0.22], [0.265, 0.32], [0.225, 0.44], [0.15, 0.55], [0.06, 0.64], [0, 0.69]], 8, BUD, true, 3);
}

/**
 * A mahjong table for the TRELLIS sitters (they bring their own stools): the hero lab's table (hero/figures.ts) at a
 * quarter of its vertices — each wall of tiles and each standing hand one ruled block instead of 9 and 7 little boxes,
 * no hidden undersides (E281: ~490 vertices a table where it took ~1 950; the same random draws, so nothing after it
 * moves). From the spawn the nearest table is 8 m off: a tile is a pixel there.
 */
function mahjongTable(k: Kit, rng: Rng, px: number, py: number, pz: number, r: number): void {
  const c = Math.cos(r), sn = Math.sin(r);
  const at = (lx: number, lz: number, a: number): [number, number] => {
    const ca = Math.cos(a), sa = Math.sin(a);
    return [px + lx * ca + lz * sa, pz - lx * sa + lz * ca];
  };
  k.box(px, py + 0.7, pz, 0.98, 0.07, 0.98, { wash: 0x5a3a26, line: 1, accent: true }, { rotY: r, top: { wash: 0x2f6a4c, line: 1, accent: true }, bottom: null });
  for (const [lx, lz] of [[-0.42, -0.42], [0.42, -0.42], [0.42, 0.42], [-0.42, 0.42]] as const) {
    k.box(px + lx * c + lz * sn, py, pz - lx * sn + lz * c, 0.06, 0.7, 0.06, { wash: 0x3d2a1e, line: 0.6 }, { rotY: r, top: null, bottom: null });
  }
  const tile: Look = { wash: 0xefe8d6, line: 0.6, accent: true };
  for (let side = 0; side < 4; side++) {
    const a = r + (side * Math.PI) / 2;
    const [wx, wz] = at(0, 0.3, a);
    k.box(wx, py + 0.77, wz, 0.62, 0.05, 0.042, { ...tile, kind: K.panel }, { rotY: a, bottom: null });
    const [hx, hz] = at(0, 0.4, a);
    k.box(hx, py + 0.77, hz, 0.46, 0.075, 0.035, tile, { rotY: a, bottom: null });
    for (let i = 0; i < 3; i++) {
      const [dx, dz] = at(rng.range(-0.18, 0.18), rng.range(-0.1, 0.18), a);
      k.box(dx, py + 0.77, dz, 0.06, 0.02, 0.08, tile, { rotY: a + rng.range(-0.4, 0.4), bottom: null });
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
  // roofs with a rafter soffit, the gold-framed 九龍 plaque, lanterns (no eave neon: the style-A mockup and the
  // dome-B targets light the gate with its lanterns only)
  const k = ctx.kit('paifang', true);
  const x = ctx.kitx('paifang');
  buildGate(k, x, ctx.signs, (px, py, pz, s) => { ctx.lantern(px, py, pz, s); }, {
    x: GATE.x, y: Y0, z: GATE.z, posts: GATE.posts, s: GATE.s, plaque: '九龍', couplets: null, neonEaves: null, lions: false,
    // E281: 14 m to the ridge beasts, not 18 (style-A's gate is about as tall as it is broad; A1·9's camera, 15 m up
    // behind the gate, looks down on its roofs); its posts bare lacquer, no paper couplets (style-A, the A2 targets)
    k: 0.78, paint: 'cinnabar',
  });
  ctx.map.push({ x0: GATE.posts[0] - 0.6, z0: GATE.z - 1.2, x1: GATE.posts[3] + 0.6, z1: GATE.z + 1.2, kind: 'gate' });
}

/**
 * Slim steel masts on the Well's lip, each with a dragon hook on top (the grapple's anchors). E281: they lost their
 * blade signs and ladders. The fabric lane's Well wall carries style-A's left-hand column (九龍, 牙科, 火鍋, 茶) where
 * the mockup has it, across the Well; the masts' own words doubled it at the frame's edge or stood in front of it from
 * the spawn, and their twin poles and ladder ties were a grille of black lines across A1·3, A2·2 and mockup A's left
 * edge. The hooks stay where they were.
 */
function signMasts(ctx: Ctx): void {
  const k = ctx.kit('paifang', true); // the square cluster's kit (one draw, budget.md)
  const steel: Look = { wash: 0x3a3d44, line: 0.8 };
  for (const [mx, mz] of [[-1.0, -6], [-3.2, -13], [-1.4, -20], [-3.6, -28]] as const) {
    const top = Y0 + 20.5;
    k.beam(new Vector3(mx, Y0 - 3, mz), new Vector3(mx, top, mz), 0.14, 0.14, steel);
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
  // (E281: the balustrade, the tables and the lamps joined the square cluster's kit, 'paifang': one draw fewer, budget.md)
  const floor = ctx.kit('paifang', true);
  flagstones(floor, PLAZA.x0, PLAZA.z0, PLAZA.x1, PLAZA.z1, Y0);
  flagstones(floor, STREET.x0, STREET.z0, STREET.x1, STREET.z1, Y0);
  // the plaza's lip over the Well
  floor.box(PLAZA.x0 - 0.3, Y0 - 1.4, (PLAZA.z0 + PLAZA.z1) / 2, 0.6, 1.4, PLAZA.z1 - PLAZA.z0, { wash: 0x8d8f93, line: 1.5, surf: SURF.concrete });
  const props = floor;
  const carve = { x: ctx.kitx('paifang'), side: 1 };
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
  // E281: the east market (instanced booths and parasol tables, stalls.ts), on its own random stream
  marketRow(ctx, new Rng(2811));
  for (const [tx0, tz0, tr, n] of tables) {
    mahjongTable(props, rng, tx0, Y0, tz0, tr);
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
    // E281: the market booths and their customers' strip, the parasol tables and their sitters
    for (const [bx0, bz0] of BOOTHS) if (x > bx0 - 1.1 && Math.abs(z - bz0) < BOOTH.w / 2 + 0.3) return false;
    for (const [px0, pz0] of PARASOLS) if ((x - px0) ** 2 + (z - pz0) ** 2 < 1.5 * 1.5) return false;
    // dome A2 (the anchor 4.5 m before the gate): its east and south foregrounds stay open (targets 6 and 7)
    if (x > 8 && x < 10.5 && z > -22.5 && z < -17.5) return false;
    if (x > 3.5 && x < 8.5 && z > -17.5 && z < -13) return false;
    for (const [px, pz] of placed) if ((x - px) ** 2 + (z - pz) ** 2 < 0.9 * 0.9) return false;
    // the spawn frame's foreground stays open for 14 m (style-A: the crowd is mid-distance, under the gate)
    const dx = x - 0.95, dz = z - 7.5, along = dx * 0.208 - dz * 0.978, across = Math.abs(dx * 0.978 + dz * 0.208);
    if (along > 0 && along < 20 && across < along * 0.84 + 1.2) return false;
    return true;
  };
  // (E281: the A1 / A2 targets fill the square with ~90 people, the gate's passage thickest: the zones grew by ~40)
  const zones: { n: number; x: [number, number]; z: [number, number]; yaw: () => number }[] = [
    // through the gate, north or south
    { n: 20, x: [1.6, 11.2], z: [-27, -19.5], yaw: () => (crowdRng.chance(0.5) ? Math.PI : 0) + crowdRng.range(-0.35, 0.35) },
    // just past the gate, the street's first stretch
    { n: 12, x: [1.8, 11.4], z: [-36, -27], yaw: () => (crowdRng.chance(0.5) ? Math.PI : 0) + crowdRng.range(-0.3, 0.3) },
    // across the square in every direction
    { n: 12, x: [2.2, 13], z: [-19.5, 1], yaw: () => crowdRng.range(0, Math.PI * 2) },
    // the east strip by the market and the noodle stall
    { n: 16, x: [14.5, 19.4], z: [-11.5, 1], yaw: () => crowdRng.range(0, Math.PI * 2) },
    // the south half, toward the stair street
    { n: 18, x: [2.5, 20.5], z: [1, 18], yaw: () => crowdRng.range(0, Math.PI * 2) },
    // the promenade along the balustrade past the spawn frame's open foreground, toward the gate (A1·2, A2·2: busy)
    // (not past z −16.5: A2·4, from the gate toward the Well, keeps its foreground to the balustrade)
    { n: 7, x: [1.5, 5], z: [-16.5, -11], yaw: () => (crowdRng.chance(0.5) ? Math.PI : 0) + crowdRng.range(-0.3, 0.3) },
    // along the balustrade south of the spawn, walking its length (A1·7: turned round, the promenade is busy)
    { n: 9, x: [1.6, 6.5], z: [10.5, 19.2], yaw: () => (crowdRng.chance(0.5) ? Math.PI : 0) + crowdRng.range(-0.3, 0.3) },
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
  // (E281: only the south lamp is left — the two along the balustrade stood in the middle of A1·5 and A2·4, where
  // style-A and the targets have none, and the east one stood inside a market booth)
  lamp(props, 1.1, Y0, 12, 4.2);
  // the light lab's hunk (round-9-lab-light): the lamps are lights too (a warm pool under each, a streak in the wet stone)
  for (const [x, z] of [[1.1, 12]] as const) {
    ctx.emitters.push({ at: new Vector3(x, Y0 + 4.1, z), color: new Color(0xffc987), w: 0.34, h: 0.3, power: 0.5, spill: 0.25 });
  }
  const str = ctx.kit('paifang', true); // the square cluster's kit (one draw, budget.md)
  lanternString(ctx, new Vector3(GATE.x + 4, Y0 + 12.2, GATE.z + 0.5), new Vector3(22.6, Y0 + 12.5, -22), 1.9, str);
  lanternString(ctx, new Vector3(-1.2, Y0 + 10.4, -26), new Vector3(GATE.x - 1, Y0 + 11, GATE.z + 0.5), 1.8, str);
  lanternString(ctx, new Vector3(GATE.x + 4, Y0 + 9.8, GATE.z + 0.6), new Vector3(22.6, Y0 + 9.6, -28), 1.8, str);
  // (E281: the two strings across the square's north half are gone — they crossed style-A's frame in front of the gate's
  // roofs, where the mockup has none; the east shops carry one instead, over the market, out of that frame)
  lanternString(ctx, new Vector3(22.3, Y0 + 6.2, -12.4), new Vector3(22.3, Y0 + 6.5, 18.6), 1.9, str);
  // E281: one over the south half, from the lamp by the balustrade to the east shops (A1·6 / A1·7's lanterns overhead;
  // behind the spawn, out of the mockup's frame)
  lanternString(ctx, new Vector3(1.1, Y0 + 4.4, 12), new Vector3(22.4, Y0 + 7.6, 14.5), 1.9, str);
  for (let z = -26; z > -150; z -= 6) lanternString(ctx, new Vector3(STREET.x0 - 0.2, Y0 + 6.5 + (z % 3), z), new Vector3(STREET.x1 + 0.2, Y0 + 7.2, z - 1.5), 1.8, str);
}
