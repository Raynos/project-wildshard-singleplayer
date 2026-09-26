// The Yamen Well: a 500 m shaft through all nine strata. Four Kowloon walls fall away from the balustrade, a ring
// street with lanterns at every stratum, catwalks across, sagging wire safety nets at each stratum line, silk fog
// sheets in the gaps, the red gondola on its cable, the old yamen on its island at Old Street and the Sump's jade water.
import { Vector3 } from 'three';
import type { Ctx } from './ctx';
import { buildWall, frame, up } from './facades';
import { K, Kit, type Look } from './kit';
import { STRATA, WELL, Y0 } from './layout';
import { dragonHook, person } from './props';
import { balustrade, hipRoof } from './square';
import { NEONS, WORDS } from './towers';
import { NEON, Rng } from './util';

const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;
/** altitude bands: one merged kit per band so the frustum culls the deep ones when you look across */
const BANDS = [[-250, -150], [-150, -70], [-70, 0], [0, 70], [70, Y0], [Y0, Y0 + 110]] as const;

interface WellWall { p0: Vector3; n: Vector3; len: number; top: number }

function walls(): WellWall[] {
  return [
    { p0: new Vector3(WELL.x0, 0, WELL.z1), n: new Vector3(1, 0, 0), len: WELL.z1 - WELL.z0, top: Y0 + 95 },
    { p0: new Vector3(WELL.x0, 0, WELL.z0), n: new Vector3(0, 0, 1), len: WELL.x1 + 0.5 - WELL.x0, top: Y0 + 28.4 },
    { p0: new Vector3(WELL.x1, 0, WELL.z1), n: new Vector3(0, 0, -1), len: WELL.x1 - WELL.x0, top: Y0 + 88 },
    { p0: new Vector3(WELL.x1, 0, WELL.z0), n: new Vector3(-1, 0, 0), len: WELL.z1 - WELL.z0, top: Y0 - 1.4 },
  ];
}

function tone(y: number): number { return 0.62 + 0.4 * Math.min(1, Math.max(0, (y + 245) / 370)); }

/** a sagging wire safety net across the whole shaft */
function net(k: Kit, y: number, sag: number): void {
  const nx = 10, nz = 18;
  const x0 = WELL.x0 + 1.8, x1 = WELL.x1 - 1.8, z0 = WELL.z0 + 1.8, z1 = WELL.z1 - 1.8;
  const at = (i: number, j: number): Vector3 => {
    const u = i / nx, v = j / nz;
    const s = Math.sin(u * Math.PI) * Math.sin(v * Math.PI);
    return new Vector3(x0 + (x1 - x0) * u, y - sag * s, z0 + (z1 - z0) * v);
  };
  const look: Look = { wash: 0x2e3036, kind: K.net, col: 0.8, line: 1.2 };
  const cw = (x1 - x0) / nx, cz = (z1 - z0) / nz;
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const edges = (i === 0 ? 1 : 0) | (i === nx - 1 ? 2 : 0) | (j === 0 ? 4 : 0) | (j === nz - 1 ? 8 : 0);
    const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), d = at(i, j + 1);
    k.quad4(a, b, c, d, cw, cz, { ...look, edges }, x0 + i * cw, z0 + j * cz);
  }
}

/** a catwalk across the shaft (along x or z) with ruled railings, a few people, a lantern or two */
function catwalk(ctx: Ctx, k: Kit, ka: Kit, rng: Rng, y: number, along: 'x' | 'z', at: number, width: number): void {
  const railLook: Look = { wash: 0x2a2c31, kind: K.bars, row: 1, col: 0.18, line: 1 };
  const deck: Look = { wash: 0x8b9099, line: 1.6 };
  if (along === 'x') {
    const len = WELL.x1 - WELL.x0;
    k.box((WELL.x0 + WELL.x1) / 2, y - 0.3, at, len, 0.3, width, deck);
    k.box((WELL.x0 + WELL.x1) / 2, y - 0.9, at, len, 0.6, 0.25, { wash: 0x6b717a, line: 1 });
    ka.quad(new Vector3(WELL.x0, y, at + width / 2), new Vector3(1, 0, 0), up, len, 1.05, railLook);
    ka.quad(new Vector3(WELL.x1, y, at - width / 2), new Vector3(-1, 0, 0), up, len, 1.05, railLook);
    for (let i = 0; i < rng.int(0, 3); i++) person(k, rng, rng.range(WELL.x0 + 2, WELL.x1 - 2), y, at + rng.range(-0.4, 0.4), rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2, 'stand', rng.chance(0.3));
    if (rng.chance(0.6)) ctx.lantern(rng.range(WELL.x0 + 3, WELL.x1 - 3), y + 2.2, at, 0.8);
  } else {
    const len = WELL.z1 - WELL.z0;
    k.box(at, y - 0.3, (WELL.z0 + WELL.z1) / 2, width, 0.3, len, deck);
    k.box(at, y - 0.9, (WELL.z0 + WELL.z1) / 2, 0.25, 0.6, len, { wash: 0x6b717a, line: 1 });
    ka.quad(new Vector3(at - width / 2, y, WELL.z1), new Vector3(0, 0, -1), up, len, 1.05, railLook);
    ka.quad(new Vector3(at + width / 2, y, WELL.z0), new Vector3(0, 0, 1), up, len, 1.05, railLook);
    for (let i = 0; i < rng.int(0, 3); i++) person(k, rng, at + rng.range(-0.4, 0.4), y, rng.range(WELL.z0 + 2, WELL.z1 - 2), rng.chance(0.5) ? 0 : Math.PI, 'stand', rng.chance(0.3));
    if (rng.chance(0.6)) ctx.lantern(at, y + 2.2, rng.range(WELL.z0 + 3, WELL.z1 - 3), 0.8);
  }
}

/** the ring street of a stratum: a deep ledge along every wall, railing, lanterns, shop glow, signs */
function ringStreet(ctx: Ctx, k: Kit, ka: Kit, rng: Rng, y: number, skipEast: boolean): void {
  const deep = 3.2;
  for (const w of walls()) {
    if (skipEast && w.n.x < -0.5) continue;
    const { u, n } = frame(w.n);
    const out = 1.8 + deep;
    const c = w.p0.clone().addScaledVector(u, w.len / 2).addScaledVector(n, out / 2).setY(y - 0.35);
    k.boxAxes(c, u, up, n, w.len / 2, 0.35, out / 2, { wash: 0x8e939b, line: 2 }, { top: { wash: 0x9a9ea4, kind: K.flag, wet: 0.6, line: 0 } });
    // the square's own level gets stone on the south side (the look along the shaft); the rest ruled railings
    if (y === Y0 && w.n.z < -0.5) balustrade(k, w.p0.z - out + 0.2, WELL.x1, WELL.x0, y, true);
    else ka.quad(w.p0.clone().addScaledVector(n, out).setY(y), u, up, w.len, 1.1, { wash: 0x2a2c31, kind: K.bars, row: 1, col: 0.16, line: 1 });
    // shop glow along the ledge's back
    for (let x = 2; x < w.len - 2; x += rng.range(3.5, 6)) {
      const p = w.p0.clone().addScaledVector(u, x).addScaledVector(n, 1.85).setY(y + 1.4);
      ctx.signs.light(p, u, up, rng.range(2, 3.2), 2.4, rng.pick([0xd9a868, 0xe0b47a, 0x9fc4c0, 0xd49a5c]), rng.range(0.5, 0.9));
      const viewpoint = y === Y0 && w.n.z < -0.5 && p.x > -16 && p.x < -5;
      if (rng.chance(0.5) && !viewpoint) ctx.lantern(p.x + n.x * 2.4, y + 2.7, p.z + n.z * 2.4, 0.75);
      if (rng.chance(0.25) && !viewpoint) person(k, rng, p.x + n.x * rng.range(0.8, 2.6), y, p.z + n.z * rng.range(0.8, 2.6), rng.range(0, 6.28), 'stand', rng.chance(0.3));
    }
  }
}

export function gondolaKit(): Kit {
  const k = new Kit();
  k.box(0, -3.6, 0, 3.0, 2.3, 2.2, { wash: 0xc2301f, line: 1.2, accent: true }, { top: { wash: 0x9c2418, line: 1, accent: true } });
  k.box(0, -3.0, 0, 2.6, 0.95, 2.24, { wash: 0xffe0b0, emit: 1.1, kind: K.facade, row: 0.95, col: 0.65, seed: 5, line: 1, accent: true });
  k.box(0, -1.3, 0, 0.12, 2.1, 0.12, { wash: 0x2a2c31, line: 1 });
  k.box(0, -0.25, 0, 1.2, 0.35, 0.4, { wash: 0x3a3d44, line: 1 });
  k.box(0, -3.75, 0, 3.04, 0.12, 2.26, { wash: 0xe9c65a, line: 1, accent: true });
  return k;
}

/** the gondola's cable runs along x at this z, y */
export const CABLE = { z: -12, y: Y0 - 16, x0: WELL.x0, x1: WELL.x1 } as const;

function yamen(ctx: Ctx, rng: Rng): void {
  const k = ctx.kit('yamen');
  const y = 0;
  const cx = -14, cz = -14;
  // the island platform on its rock pier
  k.box(cx, -40, cz, 16, 40, 22, { wash: 0x4a4b4e, kind: K.facade, row: 3.2, col: 3.0, seed: 41, line: 1 });
  k.box(cx, y - 0.6, cz, 17, 0.6, 23, { wash: 0x9a9690, line: 2 }, { top: { wash: 0x8f8d88, kind: K.flag, wet: 0.5, line: 0 } });
  // the main hall: red pillars, white walls, a double-eave hip roof in azurite
  k.box(cx, y, cz - 3, 11, 4.2, 6.5, { wash: 0xd8d2c4, kind: K.panel, line: 1 });
  for (let i = 0; i < 6; i++) k.cyl(cx - 5 + i * 2, y, cz + 0.6, 0.22, 0.22, 4.3, 8, { wash: 0xb8321f, line: 1, accent: true });
  hipRoof(ctx, k, cx, y + 4.4, cz - 2, 14, 9, 1.8, 0.5, 0x2e5fa3, NEON.amber);
  hipRoof(ctx, k, cx, y + 6.4, cz - 2, 10, 6, 2.4, 0.45, 0x2e5fa3, null);
  // the courtyard gate and two side halls
  k.box(cx, y, cz + 8, 5, 3.2, 1.2, { wash: 0xb8321f, line: 1, accent: true });
  hipRoof(ctx, k, cx, y + 3.3, cz + 8, 7, 2.6, 1.1, 0.3, 0x2e5fa3, null);
  for (const sx of [-5.5, 5.5]) {
    k.box(cx + sx, y, cz + 4, 3.2, 3.0, 6, { wash: 0xd2ccbe, kind: K.panel, line: 1 });
    hipRoof(ctx, k, cx + sx, y + 3.1, cz + 4, 4.4, 7, 1.2, 0.25, 0x2f7d5e, null);
  }
  for (let i = 0; i < 6; i++) ctx.lantern(cx - 5 + i * 2, y + 4.0, cz + 1.1, 0.9);
  // bridges from the island to the walls
  const kb = ctx.kit('well-b3');
  kb.box((WELL.x0 + cx - 8) / 2, y - 0.4, cz, cx - 8 - WELL.x0, 0.4, 3, { wash: 0x8b9099, line: 1.6 });
  kb.box((cx + 8.5 + WELL.x1) / 2, y - 0.4, cz, WELL.x1 - cx - 8.5, 0.4, 3, { wash: 0x8b9099, line: 1.6 });
  ctx.signs.place({ at: new Vector3(cx, y + 2.4, cz + 8.62), normal: new Vector3(0, 0, 1), size: 0.6, spec: { text: '九龍衙門', color: '#f0c86a', vertical: false, style: 'plaque' } }, k);
  void rng;
}

function sump(ctx: Ctx, rng: Rng): void {
  const k = ctx.kit('sump');
  k.quad(new Vector3(WELL.x0, WELL.water, WELL.z1), new Vector3(1, 0, 0), new Vector3(0, 0, -1), WELL.x1 - WELL.x0, WELL.z1 - WELL.z0, { wash: 0x1d6e5e, emit: 0.55, kind: K.flag, wet: 1, line: 0 });
  for (let i = 0; i < 40; i++) {
    const x = rng.range(WELL.x0 + 1, WELL.x1 - 1), z = rng.range(WELL.z0 + 1, WELL.z1 - 1);
    ctx.signs.light(new Vector3(x, WELL.water + 0.05, z), new Vector3(1, 0, 0), new Vector3(0, 0, -1), rng.range(0.5, 2.5), rng.range(0.1, 0.3), NEON.jade, rng.range(2, 5));
  }
  for (let i = 0; i < 5; i++) {
    const x = rng.range(WELL.x0 + 4, WELL.x1 - 4), z = rng.range(WELL.z0 + 4, WELL.z1 - 4);
    k.box(x, WELL.water, z, 1.4, 0.5, 4.5, { wash: 0x5a4632, line: 1 }, { rotY: rng.range(0, 3) });
    ctx.lantern(x, WELL.water + 1.6, z, 0.7);
  }
}

/** the fog sheets' heights (main.ts builds them as one transparent mesh) */
export const wellSheets: { y: number; band: number; a: number }[] = [];

export function buildWell(ctx: Ctx): void {
  const rng = new Rng(57);
  // the four walls, in altitude bands
  for (const w of walls()) {
    for (let b = 0; b < BANDS.length; b++) {
      const band = BANDS[b];
      if (band === undefined) continue;
      const y0 = band[0], y1 = Math.min(band[1], w.top);
      if (y1 <= y0 + 1) continue;
      buildWall(ctx, { p0: w.p0, n: w.n, length: w.len, y0, y1, kit: `well-b${b}`, alpha: `well-b${b}-a`, seed: rng.next() * 99, dress: 1, roofs: b >= 3, maxOut: 1.8, tone: tone((y0 + y1) / 2) }, rng);
    }
  }
  // strata: ring streets, nets under them, silk fog sheets in the gaps
  const sheets: { y: number; band: number; a: number }[] = [];
  for (const sy of STRATA) {
    if (sy <= WELL.water + 1) continue;
    const b = BANDS.findIndex((bd) => sy >= bd[0] && sy < bd[1]);
    const k = ctx.kit(`well-b${Math.max(0, b)}`);
    const ka = ctx.alpha(`well-b${Math.max(0, b)}-a`);
    if (sy !== 0) ringStreet(ctx, k, ka, rng, sy, sy >= Y0);
    if (sy < Y0 && sy !== 0) net(ka, sy - 5, 2.6);
  }
  net(ctx.alpha('well-b4-a'), Y0 - 27, 3.4);
  net(ctx.alpha('well-b4-a'), Y0 - 44, 3.0);
  const bandYs = [[101, 2, 0.42], [36, 3, 0.55], [-30, 4, 0.65], [-110, 5, 0.75], [-190, 6, 0.85], [-236, 7, 0.9]] as const;
  for (const [y, band, a] of bandYs) sheets.push({ y, band, a });
  // catwalks at intermediate levels
  for (let y = Y0 - 5; y > -230; y -= y > Y0 - 70 ? rng.range(4.5, 7.5) : rng.range(9, 17)) {
    const b = BANDS.findIndex((bd) => y >= bd[0] && y < bd[1]);
    const k = ctx.kit(`well-b${Math.max(0, b)}`);
    const ka = ctx.alpha(`well-b${Math.max(0, b)}-a`);
    if (rng.chance(0.55)) catwalk(ctx, k, ka, rng, y, 'x', rng.range(WELL.z0 + 6, WELL.z1 - 6), rng.range(1.6, 2.6));
    else catwalk(ctx, k, ka, rng, y, 'z', rng.range(WELL.x0 + 5, WELL.x1 - 5), rng.range(1.6, 2.6));
  }
  // blade signs down the walls, thickest near the ring streets
  const bk = ctx.kit('well-signs', true);
  for (let i = 0; i < 70; i++) {
    const w = rng.pick(walls().slice(0, 3));
    const { u, n } = frame(w.n);
    const y = rng.chance(0.6) ? Y0 + rng.range(-40, 30) : rng.range(-200, Y0 - 40);
    const along = rng.range(3, w.len - 3);
    const word = rng.pick(WORDS);
    const size = rng.range(0.8, 1.5);
    const at = w.p0.clone().addScaledVector(u, along).addScaledVector(n, 2.6 + size * 0.68).setY(y);
    ctx.signs.place({ at, normal: u.clone(), size, spec: { text: word, color: hex(rng.pick(NEONS)), vertical: true, style: rng.chance(0.8) ? 'tube' : 'box', ink: hex(rng.pick(NEONS)) }, blade: true, flicker: rng.chance(0.06) ? rng.next() : 0 }, y > Y0 - 50 ? bk : null);
  }
  // hero signs across the Well, facing the balustrade
  const west = new Vector3(1, 0, 0);
  const heroes: [string, number, number, number][] = [['麵', NEON.magenta, Y0 + 6, -3], ['牙科', NEON.cyan, Y0 - 2, -8], ['火鍋', NEON.red, Y0 - 13, 0], ['茶', NEON.jade, Y0 + 2, -26], ['旅館', NEON.jade, Y0 - 8, -31], ['藥房', NEON.magenta, Y0 - 20, -20]];
  for (const [text, col, y, z] of heroes) {
    ctx.signs.place({ at: new Vector3(WELL.x0 + 2.9, y, z), normal: west, size: 1.5, spec: { text, color: hex(col), vertical: true, style: 'tube' } }, bk);
  }
  // dragon hooks on the balconies across the shaft
  for (const [y, z] of [[Y0 + 3.5, -18], [Y0 - 7, -6], [Y0 - 15, -28], [Y0 + 11, 4], [Y0 - 24, -14]] as const) dragonHook(bk, ctx, new Vector3(WELL.x0 + 1.9, y, z), west, 1.1);
  dragonHook(bk, ctx, new Vector3(-12, Y0 - 5, WELL.z0 + 1.9), new Vector3(0, 0, 1), 1.1);
  dragonHook(bk, ctx, new Vector3(WELL.x1 - 2.0, Y0 - 3, -24), new Vector3(-1, 0, 0), 1.1);
  dragonHook(bk, ctx, new Vector3(WELL.x1 - 2.0, Y0 - 12, -6), new Vector3(-1, 0, 0), 1.1);
  // the gondola's cable and its stations
  const ck = ctx.kit('well-b4');
  for (const dz of [-0.9, 0.9]) {
    ck.beam(new Vector3(CABLE.x0 - 2, CABLE.y, CABLE.z + dz), new Vector3(CABLE.x1 + 2, CABLE.y + 0.8, CABLE.z + dz), 0.06, 0.06, { wash: 0x1d1e22, line: 0.6 });
  }
  ck.box(CABLE.x0 + 1.6, CABLE.y - 5, CABLE.z, 3.2, 6.5, 5, { wash: 0x8e939b, kind: K.facade, row: 3.2, col: 1.6, seed: 61, line: 1.2 });
  hipRoof(ctx, ck, CABLE.x0 + 1.6, CABLE.y + 1.6, CABLE.z, 4.4, 6.2, 1.2, 0.3, 0x2e5fa3, NEON.cyan);
  yamen(ctx, rng);
  sump(ctx, rng);
  ctx.map.push({ x0: WELL.x0, z0: WELL.z0, x1: WELL.x1, z1: WELL.z1, kind: 'well' });
  wellSheets.push(...sheets);
}

