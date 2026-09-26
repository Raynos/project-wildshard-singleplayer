// The towers around Lantern Square and up the street: Kowloon walls with shopfronts and hundreds of neon blade signs,
// the skybridges, the hanging monorail (a train passes), the Cable Deck whose underside is an LED sky screen playing a
// painted 青绿 landscape, the Crown's antenna forest against the one strip of real sky, cargo drones.
import { Vector3 } from 'three';
import type { Ctx } from './ctx';
import { shopfronts } from './facades';
import { dressWall, spanStreet } from './facade/grammar';
import { K, Kit, type Look } from './kit';
import { PLAZA, STAIR, STREET, WELL, Y0 } from './layout';
import { dragonHook, person } from './props';
import { hipRoof } from './square';
import { WORDS } from './words';
import { NEON, Rng, chars } from './util';

export { WORDS } from './words';
export const NEONS = [NEON.magenta, NEON.cyan, NEON.jade, NEON.red, NEON.amber, NEON.red, NEON.magenta, NEON.cyan, 0xff7a2a, 0xa8ff5a] as const;
const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

/** a run of wall split into segments with their own skyline */
/** the spawn's eye (for the facade's level of detail) */
const EYE = new Vector3(1.45, Y0 + 1.6, 6);

/**
 * A run of wall split into segments with their own skyline, each dressed by the facade lab's grammar (dressWall into
 * ctx.fd). The segments far from the spawn drop their small clutter (lod 1) or become painted shells (lod 2).
 */
function wallRun(ctx: Ctx, rng: Rng, p0: Vector3, n: Vector3, length: number, y0: number, top: [number, number], _kit: string, opts: { timber?: number; shops?: boolean; roof?: boolean; openStart?: boolean; openEnd?: boolean } = {}): void {
  const u = new Vector3().crossVectors(new Vector3(0, 1, 0), n).normalize();
  let x = 0;
  while (x < length - 0.5) {
    const seg = Math.min(length - x, rng.range(10, 20));
    const at = p0.clone().addScaledVector(u, x);
    // a run that ends at a street opening dresses that end's side face too (else a painted shell shows)
    const faces = 1 + (opts.openEnd === true && x + seg >= length - 0.5 ? 4 : 0) + (opts.openStart === true && x === 0 ? 8 : 0);
    const mid = at.clone().addScaledVector(u, seg / 2).setY(y0 + 10);
    const d = mid.distanceTo(EYE);
    const lod = d > 170 ? 2 : d > 95 ? 1 : 0;
    dressWall(ctx.fd, at, n, seg, y0, rng.range(top[0], top[1]), Math.floor(rng.next() * 1e6), {
      shops: opts.shops ?? false, street: Y0, detailY: [Y0 - 5, Y0 + 60], timber: opts.timber ?? 0.15, lit: 0.72, lod, roof: opts.roof ?? true,
    }, 12, faces);
    x += seg;
  }
}

/** blade signs hung out from a wall, facing along the wall so they read down a street */
function bladeSigns(ctx: Ctx, rng: Rng, kit: Kit, wallX: number, zFrom: number, zTo: number, outSign: number, count: number, yMin: number, yMax: number, face = 1): void {
  for (let i = 0; i < count; i++) {
    const z = zFrom + (zTo - zFrom) * ((i + rng.range(0.1, 0.9)) / count);
    const word = rng.pick(WORDS);
    const nch = chars(word).length;
    const size = rng.range(0.7, 1.35) * (nch === 1 ? 1.25 : 1);
    const col = rng.pick(NEONS);
    const w = size * 1.36;
    const x = wallX + outSign * (1.0 + w / 2);
    const y = rng.range(yMin, yMax);
    const style = rng.chance(0.72) ? 'tube' : 'box';
    ctx.signs.place({
      at: new Vector3(x, y, z), normal: new Vector3(0, 0, face), size,
      spec: style === 'tube' ? { text: word, color: hex(col), vertical: true, style: 'tube' } : { text: word, color: hex(col), vertical: true, style: 'box' },
      blade: true, flicker: rng.chance(0.08) ? rng.range(0.1, 1) : 0,
    }, kit);
    const hgt = size * (nch + 0.62);
    kit.beam(new Vector3(wallX, y + hgt / 2 + 0.25, z), new Vector3(x + outSign * w / 2, y + hgt / 2 + 0.25, z), 0.08, 0.08, { wash: 0x2e3036, line: 0.8 });
  }
}

function skybridge(ctx: Ctx, rng: Rng, x0: number, x1: number, z: number, y: number, width: number): void {
  const k = ctx.kit('bridges', true);
  const ka = ctx.alpha('bridges-a');
  const len = x1 - x0;
  k.box((x0 + x1) / 2, y - 0.5, z, len, 0.6, width, { wash: 0x6c737d, line: 1.5 }, { top: { wash: 0x7d828a, line: 1 } });
  k.box((x0 + x1) / 2, y + 2.7, z, len, 0.35, width + 0.4, { wash: 0x7c838d, line: 1.2 });
  const glass: Look = { wash: 0x2a2c31, kind: K.bars, row: 1, col: 1.2, line: 1 };
  ka.quad(new Vector3(x0, y + 0.1, z + width / 2), new Vector3(1, 0, 0), new Vector3(0, 1, 0), len, 2.5, glass);
  ka.quad(new Vector3(x1, y + 0.1, z - width / 2), new Vector3(-1, 0, 0), new Vector3(0, 1, 0), len, 2.5, glass);
  // a lit band under the roof and people crossing
  ctx.signs.light(new Vector3((x0 + x1) / 2, y + 2.45, z + width / 2 + 0.03), new Vector3(1, 0, 0), new Vector3(0, 1, 0), len - 1, 0.1, 0xffd9a0, 1.4);
  for (let i = 0; i < Math.round(len / 5); i++) person(k, rng, rng.range(x0 + 1, x1 - 1), y, z + rng.range(-width / 3, width / 3), rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2);
  for (let x = x0 + 3; x < x1 - 2; x += 5) ctx.lantern(x, y + 2.4, z + width / 2 + 0.5, 0.7);
}

/** the hanging monorail: a box-girder track slung from the Cable Deck on steel rods */
function monorail(ctx: Ctx): void {
  const k = ctx.kit('monorail', true);
  const y = Y0 + 25.5, z = -27;
  k.box(15, y - 1.2, z, 190, 1.2, 1.4, { wash: 0x7e8591, kind: K.panel, line: 1.5 });
  k.box(15, y - 1.45, z, 190, 0.25, 2.2, { wash: 0x5c626c, line: 1.2 });
  for (let x = -75; x <= 105; x += 15) {
    k.beam(new Vector3(x, y - 0.1, z), new Vector3(x - 2, Y0 + 30, z - 2), 0.14, 0.14, { wash: 0x3b3e45, line: 0.8 });
    k.beam(new Vector3(x, y - 0.1, z), new Vector3(x + 2, Y0 + 30, z - 4), 0.14, 0.14, { wash: 0x3b3e45, line: 0.8 });
  }
}

/** the train (its own mesh; main.ts slides it along x) */
export function trainKit(): Kit {
  const k = new Kit();
  const cars = 4, carL = 13;
  for (let i = 0; i < cars; i++) {
    const x = i * (carL + 0.6);
    k.box(x, -4.1, 0, carL, 2.9, 2.7, { wash: 0x6a717c, line: 1.2 }, { top: { wash: 0x565c66, line: 1 } });
    k.box(x, -3.1, 0, carL - 0.8, 0.9, 2.74, { wash: 0xffd9a0, emit: 0.3, kind: K.facade, row: 0.9, col: 1.4, seed: 7 + i, line: 1, accent: true });
    k.box(x, -4.05, 0, carL + 0.02, 0.28, 2.76, { wash: 0xc23b22, line: 1, accent: true });
    k.box(x, -1.2, 0, 2.2, 0.6, 1.4, { wash: 0x5c626c, line: 1 });
  }
  k.box(-carL / 2 - 0.05, -3.4, 0, 0.1, 0.35, 1.8, { wash: 0xfff6e0, emit: 4, line: 0.6, accent: true });
  return k;
}

/** the Cable Deck (stratum 7) over the north of the square: its underside is the painted sky screen */
function cableDeck(ctx: Ctx, rng: Rng): void {
  const k = ctx.kit('deck', true);
  const y = Y0 + 30;
  const f = -24;
  k.box(1, y, f - 40, 60, 3.2, 80, { wash: 0x8a9099, kind: K.facade, row: 1.6, col: 4, seed: 11, line: 1.5 }, { bottom: null });
  // the front fascia: lit ropeway-station windows, railings, people, a few signs
  k.box(1, y + 3.2, f - 0.6, 62, 1.1, 0.4, { wash: 0x767c86, line: 1.4 });
  for (let x = -26; x < 28; x += 3.2) if (rng.chance(0.7)) ctx.signs.light(new Vector3(x, y + 1.6, f + 0.06), new Vector3(1, 0, 0), new Vector3(0, 1, 0), 2.0, 0.8, rng.pick([0xd9a868, 0xe0b47a, 0x9fc4c0]), rng.range(0.7, 1.1));
  const ka = ctx.alpha('deck-a');
  ka.quad(new Vector3(-30, y + 3.2, f - 0.2), new Vector3(1, 0, 0), new Vector3(0, 1, 0), 62, 1.1, { wash: 0x2a2c31, kind: K.bars, row: 1, col: 0.16, line: 1 });
  for (let i = 0; i < 9; i++) person(k, rng, rng.range(-24, 26), y + 3.2, rng.range(f - 3, f - 1.2), rng.range(0, 6.28));
  // ropeway station roofs on the deck's edge
  hipRoof(ctx, k, -12, y + 8.5, f - 6, 12, 7, 2.4, 0.5, 0x2e5fa3, NEON.cyan);
  k.box(-12, y + 3.2, f - 6, 10, 5.3, 5.5, { wash: 0xa5aab1, kind: K.facade, row: 2.65, col: 2.5, seed: 21, line: 1 });
  hipRoof(ctx, k, 16, y + 7.8, f - 8, 9, 6, 2.0, 0.45, 0x2f7d5e, NEON.jade);
  k.box(16, y + 3.2, f - 8, 7.5, 4.6, 4.8, { wash: 0xa5aab1, kind: K.facade, row: 2.3, col: 2.5, seed: 23, line: 1 });
  ctx.signs.place({ at: new Vector3(-12, y + 6.6, f - 3.2), normal: new Vector3(0, 0, 1), size: 1.1, spec: { text: '纜車站', color: hex(NEON.cyan), vertical: false, style: 'tube' } }, k);
  ctx.signs.place({ at: new Vector3(1, y + 1.6, f + 0.3), normal: new Vector3(0, 0, 1), size: 1.25, spec: { text: '九龍', color: hex(NEON.red), vertical: false, style: 'tube' } }, k);
  dragonHook(k, ctx, new Vector3(-4, y + 0.2, f + 0.1), new Vector3(0, 0, 1), 0.6);
  dragonHook(k, ctx, new Vector3(22, y + 0.2, f + 0.1), new Vector3(0, 0, 1), 0.6);
  // a second deck over the stair-street
  const k2 = ctx.kit('deck2');
  k2.box(78, Y0 + 50, 6, 70, 3, 64, { wash: 0x8a9099, kind: K.facade, row: 1.5, col: 4, seed: 12, line: 1.5 }, { bottom: null });
}

function crown(ctx: Ctx, rng: Rng): void {
  const k = ctx.kit('crown');
  // far towers rising to the Crown: silhouettes in the fog around the strip of sky
  const spots: [number, number][] = [];
  for (let i = 0; i < 40; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(70, 210);
    spots.push([6 + Math.cos(a) * r, -10 + Math.sin(a) * r]);
  }
  for (const [x, z] of spots) {
    const w = rng.range(14, 30), d = rng.range(14, 30);
    const top = rng.range(Y0 + 70, 252);
    k.box(x, Y0 + 30, z, w, top - Y0 - 30, d, { wash: rng.pick([0x9aa2ae, 0x8e96a2, 0xa4a8ad]), kind: K.facade, row: 3.2, col: 2.6, seed: rng.next() * 50, line: 1 });
    const nA = rng.int(1, 4);
    for (let j = 0; j < nA; j++) {
      const ax = x + rng.range(-w / 3, w / 3), az = z + rng.range(-d / 3, d / 3);
      const h = rng.range(8, 26);
      k.beam(new Vector3(ax, top, az), new Vector3(ax, top + h, az), 0.3, 0.3, { wash: 0x3a3d44, line: 1 });
      k.beam(new Vector3(ax - 1.5, top + h * 0.6, az), new Vector3(ax + 1.5, top + h * 0.6, az), 0.12, 0.12, { wash: 0x3a3d44, line: 0.8 });
      ctx.signs.light(new Vector3(ax, top + h + 0.3, az), new Vector3(1, 0, 0), new Vector3(0, 1, 0), 0.7, 0.7, NEON.red, 9, 2, rng.next());
    }
    if (rng.chance(0.4)) k.cyl(x + rng.range(-w / 4, w / 4), top, z + rng.range(-d / 4, d / 4), 2.2, 2.2, 3.5, 10, { wash: 0x7c7f86, line: 1 });
  }
}

/** a cargo drone (its own mesh; main.ts flies it): body, rotor arms, a slung crate, blinking beacons */
export function droneKit(): Kit {
  const k = new Kit();
  k.box(0, 0, 0, 1.6, 0.5, 1.6, { wash: 0x2a2c31, line: 1 });
  for (const [dx, dz] of [[1.3, 1.3], [-1.3, 1.3], [1.3, -1.3], [-1.3, -1.3]] as const) {
    k.beam(new Vector3(0, 0.3, 0), new Vector3(dx, 0.4, dz), 0.12, 0.12, { wash: 0x2a2c31, line: 0.8 });
    k.cyl(dx, 0.42, dz, 0.75, 0.75, 0.04, 12, { wash: 0x55595f, line: 1 });
  }
  k.beam(new Vector3(0, 0, 0), new Vector3(0, -1.6, 0), 0.03, 0.03, { wash: 0x2a2c31, line: 0.5 });
  k.box(0, -2.6, 0, 1.3, 1.0, 1.0, { wash: 0xd9a441, line: 1, accent: true });
  return k;
}

export function buildTowers(ctx: Ctx): void {
  const rng = new Rng(31);
  const words = WORDS;
  // the east side of the square (x = 30, facing west) — a gap for the stair-street
  const east = new Vector3(-1, 0, 0);
  wallRun(ctx, rng, new Vector3(PLAZA.x1 + 0.6, 0, PLAZA.z0), east, STAIR.z0 - PLAZA.z0, Y0 + 5, [Y0 + 55, Y0 + 100], 'east', { openEnd: true });
  wallRun(ctx, rng, new Vector3(PLAZA.x1 + 0.6, 0, STAIR.z1), east, PLAZA.z1 - STAIR.z1 + 30, Y0 + 5, [Y0 + 50, Y0 + 95], 'east', { openStart: true });
  shopfronts(ctx, 'east-shops', new Vector3(PLAZA.x1 + 0.6, 0, PLAZA.z0), east, STAIR.z0 - PLAZA.z0, Y0, rng, words, NEONS);
  shopfronts(ctx, 'east-shops', new Vector3(PLAZA.x1 + 0.6, 0, STAIR.z1), east, PLAZA.z1 - STAIR.z1, Y0, rng, words, NEONS);
  // the north side right of the gate (z = -30, facing south)
  const south = new Vector3(0, 0, 1);
  wallRun(ctx, rng, new Vector3(STREET.x1, 0, PLAZA.z0 - 0.6), south, PLAZA.x1 + 0.6 - STREET.x1, Y0 + 5, [Y0 + 28.4, Y0 + 28.4], 'north');
  shopfronts(ctx, 'north-shops', new Vector3(STREET.x1, 0, PLAZA.z0 - 0.6), south, PLAZA.x1 + 0.6 - STREET.x1, Y0, rng, words, NEONS);
  // the south side behind the spawn (z = 20, facing north)
  const north = new Vector3(0, 0, -1);
  wallRun(ctx, rng, new Vector3(PLAZA.x1 + 0.6, 0, PLAZA.z1 + 0.6), north, PLAZA.x1 + 0.6, Y0 + 5, [Y0 + 50, Y0 + 90], 'south');
  shopfronts(ctx, 'south-shops', new Vector3(PLAZA.x1 + 0.6, 0, PLAZA.z1 + 0.6), north, PLAZA.x1 + 0.6, Y0, rng, words, NEONS);
  // the street north: walls both sides, receding into the silk
  const len = STREET.z1 - STREET.z0;
  const DECK_Y = Y0 + 28.4, DECK_Z = -104;
  wallRun(ctx, rng, new Vector3(STREET.x0, 0, WELL.z0), new Vector3(1, 0, 0), WELL.z0 - DECK_Z, Y0 + 5, [DECK_Y, DECK_Y], 'street-w');
  wallRun(ctx, rng, new Vector3(STREET.x0, 0, DECK_Z), new Vector3(1, 0, 0), DECK_Z - STREET.z0, Y0 + 5, [Y0 + 50, Y0 + 115], 'street-w2');
  shopfronts(ctx, 'street-shops', new Vector3(STREET.x0, 0, WELL.z0), new Vector3(1, 0, 0), WELL.z0 - STREET.z0, Y0, rng, words, NEONS);
  wallRun(ctx, rng, new Vector3(STREET.x1, 0, STREET.z0), new Vector3(-1, 0, 0), DECK_Z - STREET.z0, Y0 + 5, [Y0 + 50, Y0 + 115], 'street-e2');
  wallRun(ctx, rng, new Vector3(STREET.x1, 0, DECK_Z), new Vector3(-1, 0, 0), len - (DECK_Z - STREET.z0), Y0 + 5, [DECK_Y, DECK_Y], 'street-e');
  // stratum 7's towers standing on the Cable Deck, set back from its edge
  wallRun(ctx, rng, new Vector3(WELL.x0, 0, -46), new Vector3(0, 0, 1), PLAZA.x1 - WELL.x0, DECK_Y + 4.8, [Y0 + 60, Y0 + 105], 'deck-towers');
  shopfronts(ctx, 'street-shops', new Vector3(STREET.x1, 0, STREET.z0), new Vector3(-1, 0, 0), len, Y0, rng, words, NEONS);
  // blade signs: the east side of the square reads toward the spawn; the street's both sides read down the street
  const bs = ctx.kit('blades', true);
  bladeSigns(ctx, rng, bs, PLAZA.x1 + 0.6, -31, 14, -1, 18, Y0 + 6, Y0 + 38);
  bladeSigns(ctx, rng, bs, STREET.x0, -48, -150, 1, 16, Y0 + 5, Y0 + 20);
  bladeSigns(ctx, rng, bs, STREET.x1, -34, -150, -1, 16, Y0 + 5, Y0 + 20);
  // hero signs on the east facade (the spawn's right side)
  const hero: [string, number, number, number, number][] = [['旅館', NEON.amber, 20.2, Y0 + 14.5, -23], ['藥房', NEON.red, 20.4, Y0 + 8.6, -18.5], ['麻雀', NEON.jade, 20.6, Y0 + 17, -6], ['茶樓', NEON.cyan, 20.3, Y0 + 21, -13]];
  for (const [text, col, x, y, z] of hero) {
    ctx.signs.place({ at: new Vector3(x, y, z), normal: new Vector3(0, 0, 1), size: 1.65, spec: { text, color: hex(col), vertical: true, style: 'tube' }, blade: true }, bs);
    bs.beam(new Vector3(PLAZA.x1 + 0.6, y + 2.2, z), new Vector3(x - 1, y + 2.2, z), 0.1, 0.1, { wash: 0x2e3036, line: 0.8 });
  }
  // hero signs on the square's north side, right of the gate (the spawn sees this wall head-on)
  const north2: [string, number, number, number, number, 'tube' | 'box'][] = [
    ['酒家', NEON.amber, 20.6, Y0 + 16, 1.4, 'tube'], ['藥', NEON.red, 18.2, Y0 + 10.5, 1.5, 'box'], ['茶', NEON.cyan, 15.8, Y0 + 19, 1.3, 'tube'],
    ['金行', NEON.jade, 21.4, Y0 + 7.6, 1.0, 'tube'], ['當舖', NEON.magenta, 14.6, Y0 + 10.5, 1.0, 'tube'], ['押', NEON.red, 19.4, Y0 + 24.5, 1.5, 'box'],
  ];
  for (const [text, col, x, y, size, style] of north2) {
    ctx.signs.place({ at: new Vector3(x, y, PLAZA.z0 + 1.2), normal: new Vector3(0, 0, 1), size, spec: { text, color: hex(col), vertical: true, style } }, bs);
    bs.beam(new Vector3(x, y, PLAZA.z0 - 0.6), new Vector3(x, y, PLAZA.z0 + 1.1), 0.1, 0.1, { wash: 0x2e3036, line: 0.8 });
  }
  dragonHook(bs, ctx, new Vector3(PLAZA.x1 + 0.6, Y0 + 12.5, -19), new Vector3(-1, 0, 0), 1.0);
  dragonHook(bs, ctx, new Vector3(STREET.x1, Y0 + 11, -46), new Vector3(-1, 0, 0), 1.0);
  dragonHook(bs, ctx, new Vector3(STREET.x0, Y0 + 9.5, -60), new Vector3(1, 0, 0), 1.0);
  // laundry and cables strung across the street
  const cab = ctx.kit('cables');
  // what is strung across the street: cables, laundry, lantern strings (the facade lab's spanStreet)
  for (let z = -46; z > -150; z -= rng.range(4, 8)) {
    const ya = Y0 + rng.range(8, 30);
    spanStreet(ctx.fd, new Vector3(STREET.x0 + 1.4, ya, z), new Vector3(STREET.x1 - 1.4, ya + rng.range(-2, 2), z + rng.range(-2, 2)), Math.floor(rng.next() * 1e6));
  }
  // cable bundles over the square, from the masts to the east towers
  for (let j = 0; j < 5; j++) {
    const a = new Vector3(-1.1, Y0 + 14 + j * 0.4, -20.5), b = new Vector3(PLAZA.x1 + 0.6, Y0 + 18 + j * 0.6, -12 + j);
    const mid = a.clone().lerp(b, 0.5).add(new Vector3(0, -2.2 - j * 0.3, 0));
    cab.beam(a, mid, 0.05, 0.05, { wash: 0x1d1e22, line: 0.5 });
    cab.beam(mid, b, 0.05, 0.05, { wash: 0x1d1e22, line: 0.5 });
  }
  skybridge(ctx, rng, STREET.x0 - 2, STREET.x1 + 2, -58, Y0 + 13, 3.2);
  skybridge(ctx, rng, STREET.x0 - 2, STREET.x1 + 2, -92, Y0 + 21, 3.0);
  skybridge(ctx, rng, WELL.x0, WELL.x1, -38, Y0 + 12, 3.0);
  monorail(ctx);
  cableDeck(ctx, rng);
  crown(ctx, rng);
  // the stair-street climbing east: treads with a heavy nosing line, walls, signs, a small paifang at the top
  const st = ctx.kit('stairs', true);
  const steps = 60;
  const run = (STAIR.x1 - STAIR.x0) / steps, rise = STAIR.rise / steps;
  for (let i = 0; i < steps; i++) {
    const x = STAIR.x0 + i * run;
    const landing = i % 15 === 14;
    st.box(x + run / 2, Y0 + i * rise - 0.3, (STAIR.z0 + STAIR.z1) / 2, run + (landing ? 0.01 : 0), rise + 0.3, STAIR.z1 - STAIR.z0, { wash: 0x75747a, kind: K.stone, line: 1.8, wet: 0.7 }, { top: { wash: 0x4a4c52, kind: K.flag, wet: 1, line: 0 } });
  }
  // the stair street's walls start behind the east towers (whose dressed side faces flank its first 12 m)
  wallRun(ctx, rng, new Vector3(PLAZA.x1 + 12.6, 0, STAIR.z0), new Vector3(0, 0, 1), STAIR.x1 + 10 - (PLAZA.x1 + 12.6), Y0 + 3, [Y0 + 40, Y0 + 80], 'stair-n', { timber: 0.35 });
  wallRun(ctx, rng, new Vector3(STAIR.x1 + 10, 0, STAIR.z1), new Vector3(0, 0, -1), STAIR.x1 + 10 - (PLAZA.x1 + 12.6), Y0 + 3, [Y0 + 40, Y0 + 80], 'stair-s', { timber: 0.35 });
  for (let i = 0; i < 12; i++) {
    const x = STAIR.x0 + 3 + i * 3.8;
    const y = Y0 + ((x - STAIR.x0) / (STAIR.x1 - STAIR.x0)) * STAIR.rise;
    const side = i % 2 === 0 ? STAIR.z0 : STAIR.z1;
    const word = rng.pick(WORDS);
    ctx.signs.place({ at: new Vector3(x, y + 5 + rng.range(0, 4), side + (side === STAIR.z0 ? 1.4 : -1.4)), normal: new Vector3(-1, 0, 0), size: rng.range(0.7, 1.1), spec: { text: word, color: hex(rng.pick(NEONS)), vertical: true, style: 'tube' }, blade: true }, st);
    ctx.lantern(x, y + 4.2, side + (side === STAIR.z0 ? 0.8 : -0.8), 0.8);
  }
  dragonHook(st, ctx, new Vector3(STAIR.x0 + 16, Y0 + 11, STAIR.z0), new Vector3(0, 0, 1), 1.1);
  const ga = ctx.kit('stairgate', true);
  const gx = STAIR.x1 - 4, gy = Y0 + STAIR.rise;
  for (const gz of [STAIR.z0 + 0.8, STAIR.z1 - 0.8]) ga.cyl(gx, gy, gz, 0.26, 0.24, 5.2, 12, { wash: 0xb8321f, line: 1, accent: true });
  ga.box(gx, gy + 4.4, (STAIR.z0 + STAIR.z1) / 2, 0.5, 0.5, STAIR.z1 - STAIR.z0 - 0.6, { wash: 0xb8321f, line: 1, accent: true });
  hipRoof(ctx, ga, gx, gy + 5.2, (STAIR.z0 + STAIR.z1) / 2, 2.2, STAIR.z1 - STAIR.z0 + 1.2, 1.2, 0.35, 0x2f7d5e, NEON.red);
  ctx.map.push({ x0: STAIR.x0, z0: STAIR.z0, x1: STAIR.x1, z1: STAIR.z1, kind: 'street' });
  // the floor plan for the minimap: blocks around the square and the street
  ctx.map.push({ x0: PLAZA.x1, z0: -120, x1: 70, z1: STAIR.z0, kind: 'block' });
  ctx.map.push({ x0: PLAZA.x1, z0: STAIR.z1, x1: 70, z1: 60, kind: 'block' });
  ctx.map.push({ x0: -60, z0: PLAZA.z1, x1: PLAZA.x1, z1: 60, kind: 'block' });
  ctx.map.push({ x0: STREET.x1, z0: -140, x1: PLAZA.x1, z1: PLAZA.z0, kind: 'block' });
  ctx.map.push({ x0: -60, z0: -140, x1: STREET.x0, z1: WELL.z0, kind: 'block' });
  ctx.map.push({ x0: -60, z0: WELL.z0, x1: WELL.x0, z1: PLAZA.z1, kind: 'block' });
}
