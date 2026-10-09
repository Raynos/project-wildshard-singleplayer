// The towers around Lantern Square and up the street: Kowloon walls with shopfronts and hundreds of neon blade signs,
// the skybridges, the hanging monorail (a train passes), the Cable Deck whose underside is an LED sky screen playing a
// painted 青绿 landscape, the Crown's antenna forest against the one strip of real sky, cargo drones.
import { Color, Matrix4, Quaternion, Vector3 } from 'three';
import type { Ctx } from '../world/ctx';
import { shopfronts } from './facades';
import { type DressOptions, dressTower, dressWall, spanStreet } from './facadeGrammar';
import { Dressing } from '../world/facade/dressing';
import type { PieceId } from '../world/facade/pieces';
import { K, type Kit, type Look } from '../world/kit';
import { PLAZA, STAIR, STREET, WELL, Y0 } from '../layout';
import { dragonHook, person } from '../world/props';
import { lanternString } from '../look/lanterns';
import { hipRoof } from '../world/squareParts';
import { WORDS } from '../world/words';
import { buildStairStreet } from './stairstreet';
import { SQ_DEPTH } from '../world/stairPlan';
import { buildStairUpper } from './stairstreet-upper';
import { NEON, chars } from '../util';
import { Rng } from '@wildshard/engine/core/rng';

export const NEONS = [NEON.magenta, NEON.cyan, NEON.jade, NEON.red, NEON.amber, NEON.red, NEON.magenta, NEON.cyan, 0xff7a2a, 0xa8ff5a] as const;
const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

/** a run of wall split into segments with their own skyline */
/** the spawn's eye (for the facade's level of detail) */
const EYE = new Vector3(1.45, Y0 + 1.6, 6);

/**
 * A run of wall split into segments with their own skyline, each dressed by the facade lab's grammar (dressWall into
 * ctx.fd). The segments far from the spawn drop their small clutter (lod 1) or become painted shells (lod 2).
 */
function wallRun(ctx: Ctx, rng: Rng, p0: Vector3, n: Vector3, length: number, y0: number, top: [number, number], _kit: string, opts: { timber?: number; gallery?: number; shops?: boolean; roof?: boolean; openStart?: boolean; openEnd?: boolean; openDepth?: { span: number; depth: number }; open?: readonly [number, number]; lodAt?: readonly [number, number] } = {}): void {
  const u = new Vector3().crossVectors(new Vector3(0, 1, 0), n).normalize();
  let x = 0;
  while (x < length - 0.5) {
    const seg = Math.min(length - x, rng.range(10, 20));
    const at = p0.clone().addScaledVector(u, x);
    // a run that ends at a street opening dresses that end's side face too (else a painted shell shows)
    const faces = 1 + (opts.openEnd === true && x + seg >= length - 0.5 ? 4 : 0) + (opts.openStart === true && x === 0 ? 8 : 0);
    const mid = at.clone().addScaledVector(u, seg / 2).setY(y0 + 10);
    const d = mid.distanceTo(EYE);
    const la = opts.lodAt ?? [95, 170];
    const lod = d > la[1] ? 2 : d > la[0] ? 1 : 0;
    // dome C1: the towers at a street opening can stand shallower (their front and the rng are unchanged: only the
    // depth behind the face, so the stair-street's pavilions and set-back towers have room behind the square's corner)
    const od = opts.openDepth;
    const shallow = od !== undefined && ((opts.openEnd === true && x + seg >= length - od.span) || (opts.openStart === true && x <= od.span));
    const topY = rng.range(top[0], top[1]), seed = Math.floor(rng.next() * 1e6);
    const dopt: DressOptions = {
      // E281: the targets' Chongqing stacks — timber-clad columns, lattice windows, verandas on some floors
      shops: opts.shops ?? false, street: Y0, detailY: [Y0 - 5, Y0 + 60], timber: opts.timber ?? 0.55, gallery: opts.gallery ?? 0.28, lit: 0.78, lod, roof: opts.roof ?? true,
    };
    // (E281 round 2: `open` — run-local [from, to] — leaves a street's mouth: a segment across it is cut back to the
    // gap and dresses its end toward the street; the rolls are the same, so nothing later in the city moves)
    const gap = opts.open;
    if (gap === undefined || x + seg <= gap[0] || x >= gap[1]) dressWall(ctx.fd, at, n, seg, y0, topY, seed, dopt, shallow ? od.depth : 12, faces);
    else {
      // the whole segment's sign slots, shrunk to nothing, keep the slot list's order and length (§12); the two parts
      // round the gap emit none
      const probe = new Dressing();
      dressWall(probe, at, n, seg, y0, topY, seed, dopt, shallow ? od.depth : 12, faces);
      for (const sl of probe.signs) ctx.fd.addSign({ ...sl, size: 0.001 });
      const cut: DressOptions = { ...dopt, signs: false };
      if (gap[0] - x > 0.5) dressWall(ctx.fd, at, n, gap[0] - x, y0, topY, seed, cut, shallow ? od.depth : 12, (faces & ~4) | 4);
      if (x + seg - gap[1] > 0.5) dressWall(ctx.fd, p0.clone().addScaledVector(u, gap[1]), n, x + seg - gap[1], y0, topY, seed + 1, cut, shallow ? od.depth : 12, (faces & ~8) | 8);
    }
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

/** lantern strings (E281): paper lanterns every `spacing` m on a sagging cord (in the blade signs' kit: no draw) */
function strings(ctx: Ctx, kit: Kit, list: readonly (readonly [Vector3, Vector3])[], spacing: number, sagK: number, scale: number): void {
  for (const [a, b] of list) {
    const { cord, hooks } = lanternString(a, b, spacing, a.distanceTo(b) * sagK, 6);
    for (let i = 0; i + 1 < cord.length; i++) {
      const p = cord[i], q = cord[i + 1];
      if (p !== undefined && q !== undefined) kit.wire(p, q, 0.022, { wash: 0x1d1e22, line: 0.5 });
    }
    for (const h of hooks) ctx.lantern(h.x, h.y, h.z, scale);
  }
}

/** a big neon blade on two arms out of a wall (x = wallX), its face toward +z; `out` = its inner edge off the wall */
function heroBlade(ctx: Ctx, kit: Kit, text: string, col: number, wallX: number, outSign: number, out: number, y: number, z: number, size: number): void {
  const w = size * 1.36;
  const x = wallX + outSign * (out + w / 2);
  ctx.signs.place({ at: new Vector3(x, y, z), normal: new Vector3(0, 0, 1), size, spec: { text, color: hex(col), vertical: true, style: 'tube' }, blade: true }, kit);
  const h = size * (chars(text).length + 0.62);
  for (const dy of [h / 2 - 0.4, -h / 2 + 0.4]) kit.beam(new Vector3(wallX, y + dy, z), new Vector3(x - outSign * (w / 2 - 0.2), y + dy, z), 0.09, 0.09, { wash: 0x2e3036, line: 0.8 });
}

/** a big neon board flat toward +z on two arms out of a wall (z = wallZ): the north wall's signs, face-on to the square */
function heroFlat(ctx: Ctx, kit: Kit, text: string, col: number, x: number, y: number, wallZ: number, out: number, size: number): void {
  const w = size * 1.36, h = size * (chars(text).length + 0.62);
  // (full strength across the Well's mist: 1.5× the gain, the tubes cut through 0.8 of the silk)
  ctx.signs.place({ at: new Vector3(x, y, wallZ + out), normal: new Vector3(0, 0, 1), size, spec: { text, color: hex(col), vertical: true, style: 'tube' }, blade: true, gain: 6.6, clear: 0.8 }, kit);
  for (const dx of [-w / 3, w / 3]) kit.beam(new Vector3(x + dx, y + h / 2 - 0.35, wallZ), new Vector3(x + dx, y + h / 2 - 0.35, wallZ + out - 0.1), 0.09, 0.09, { wash: 0x2e3036, line: 0.8 });
}

/** a brush-drawn figure standing in kit `k` (props.ts `person`; a model drawn into the kit: models/inKit.ts) */
function figure(ctx: Ctx, k: Kit, rng: Rng, x: number, y: number, z: number, r: number): void {
  person(k, rng, x, y, z, r);
  ctx.inKit.push({ model: 'nine-dragon-stack/ink-figure', kit: k, at: { x, y, z, yaw: r } });
}

function skybridge(ctx: Ctx, rng: Rng, x0: number, x1: number, z: number, y: number, width: number, people = 1): void {
  const k = ctx.kit('bridges', true);
  k.compact = true;
  const ka = ctx.alpha('bridges-a');
  const len = x1 - x0;
  k.box((x0 + x1) / 2, y - 0.5, z, len, 0.6, width, { wash: 0x6c737d, line: 1.5 }, { top: { wash: 0x7d828a, line: 1 } });
  k.box((x0 + x1) / 2, y + 2.7, z, len, 0.35, width + 0.4, { wash: 0x7c838d, line: 1.2 });
  const glass: Look = { wash: 0x2a2c31, kind: K.bars, row: 1, col: 1.2, line: 1 };
  ka.quad(new Vector3(x0, y + 0.1, z + width / 2), new Vector3(1, 0, 0), new Vector3(0, 1, 0), len, 2.5, glass);
  ka.quad(new Vector3(x1, y + 0.1, z - width / 2), new Vector3(-1, 0, 0), new Vector3(0, 1, 0), len, 2.5, glass);
  // a lit band under the roof and people crossing
  ctx.signs.light(new Vector3((x0 + x1) / 2, y + 2.45, z + width / 2 + 0.03), new Vector3(1, 0, 0), new Vector3(0, 1, 0), len - 1, 0.1, 0xffd9a0, 1.4);
  for (let i = 0; i < Math.round((len / 5) * people); i++) figure(ctx, k, rng, rng.range(x0 + 1, x1 - 1), y, z + rng.range(-width / 3, width / 3), rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2);
  for (let x = x0 + 3; x < x1 - 2; x += 5) ctx.lantern(x, y + 2.4, z + width / 2 + 0.5, 0.7);
}

/** the hanging monorail: a box-girder track slung from the Cable Deck on steel rods */
function monorail(ctx: Ctx): void {
  const k = ctx.kit('monorail', true);
  k.compact = true;
  const y = Y0 + 25.5, z = -27;
  k.box(15, y - 1.2, z, 190, 1.2, 1.4, { wash: 0x7e8591, kind: K.panel, line: 1.5 });
  k.box(15, y - 1.45, z, 190, 0.25, 2.2, { wash: 0x5c626c, line: 1.2 });
  for (let x = -75; x <= 105; x += 15) {
    k.beam(new Vector3(x, y - 0.1, z), new Vector3(x - 2, Y0 + 30, z - 2), 0.14, 0.14, { wash: 0x3b3e45, line: 0.8 });
    k.beam(new Vector3(x, y - 0.1, z), new Vector3(x + 2, Y0 + 30, z - 4), 0.14, 0.14, { wash: 0x3b3e45, line: 0.8 });
  }
}

/** the Cable Deck (stratum 7) over the north of the square: its underside is the painted sky screen */
function cableDeck(ctx: Ctx, rng: Rng): void {
  const k = ctx.kit('deck', true);
  k.compact = true;
  const y = Y0 + 30;
  const f = -24;
  k.box(1, y, f - 40, 60, 3.2, 80, { wash: 0x8a9099, kind: K.facade, row: 1.6, col: 4, seed: 11, line: 1.5 }, { bottom: null });
  // the front fascia: lit ropeway-station windows, railings, people, a few signs
  k.box(1, y + 3.2, f - 0.6, 62, 1.1, 0.4, { wash: 0x767c86, line: 1.4 });
  for (let x = -26; x < 28; x += 3.2) if (rng.chance(0.7)) ctx.signs.light(new Vector3(x, y + 1.6, f + 0.06), new Vector3(1, 0, 0), new Vector3(0, 1, 0), 2.0, 0.8, rng.pick([0xd9a868, 0xe0b47a, 0x9fc4c0]), rng.range(0.7, 1.1));
  const ka = ctx.alpha('deck-a');
  ka.quad(new Vector3(-30, y + 3.2, f - 0.2), new Vector3(1, 0, 0), new Vector3(0, 1, 0), 62, 1.1, { wash: 0x2a2c31, kind: K.bars, row: 1, col: 0.16, line: 1 });
  for (let i = 0; i < 9; i++) figure(ctx, k, rng, rng.range(-24, 26), y + 3.2, rng.range(f - 3, f - 1.2), rng.range(0, 6.28));
  // ropeway station roofs on the deck's edge
  hipRoof(ctx, k, -12, y + 8.5, f - 6, 12, 7, 2.4, 0.5, 0x2e5fa3, NEON.cyan);
  k.box(-12, y + 3.2, f - 6, 10, 5.3, 5.5, { wash: 0xa5aab1, kind: K.facade, row: 2.65, col: 2.5, seed: 21, line: 1 });
  hipRoof(ctx, k, 16, y + 7.8, f - 8, 9, 6, 2.0, 0.45, 0x2f7d5e, NEON.jade);
  k.box(16, y + 3.2, f - 8, 7.5, 4.6, 4.8, { wash: 0xa5aab1, kind: K.facade, row: 2.3, col: 2.5, seed: 23, line: 1 });
  ctx.signs.place({ at: new Vector3(-12, y + 6.6, f - 3.2), normal: new Vector3(0, 0, 1), size: 1.1, spec: { text: '纜車站', color: hex(NEON.cyan), vertical: false, style: 'tube' } }, k);
  ctx.signs.place({ at: new Vector3(1, y + 1.6, f + 0.3), normal: new Vector3(0, 0, 1), size: 1.25, spec: { text: '九龍', color: hex(NEON.red), vertical: false, style: 'tube' } }, k);
  dragonHook(k, ctx, new Vector3(-4, y + 0.2, f + 0.1), new Vector3(0, 0, 1), 0.6);
  dragonHook(k, ctx, new Vector3(22, y + 0.2, f + 0.1), new Vector3(0, 0, 1), 0.6);
  // (E281: the second deck over the stair-street went with its sky screen — a bare slab over the stair from above)
}

/**
 * The far towers rising to the Crown: silhouettes in the fog around the strip of sky. E281: no longer plain boxes with a
 * window grid (they read as modern slabs in every look-up) — each is the facade grammar's far tower (painted faces,
 * 2–3 setback segments, parapets, slab lips and glazed pent eaves banding every face), crowned with a glazed pavilion,
 * tanks and an antenna forest with red beacons.
 */
function crown(ctx: Ctx, rng: Rng): void {
  const k = ctx.kit('crown');
  k.compact = true;
  const spots: [number, number][] = [];
  for (let i = 0; i < 40; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(70, 210);
    spots.push([6 + Math.cos(a) * r, -10 + Math.sin(a) * r]);
  }
  const up = new Vector3(0, 1, 0);
  const put = (piece: PieceId, at: Vector3, n: Vector3, sx: number, sy: number, sz: number, c: number): void => {
    const u = new Vector3().crossVectors(up, n);
    ctx.fd.pieces.push({ piece, m: new Matrix4().makeBasis(u, up, n).scale(new Vector3(sx, sy, sz)).setPosition(at), c: new Color(c) });
  };
  for (const [x, zRoll] of spots) {
    const w = rng.range(14, 30), d = rng.range(14, 30);
    // (the stair lane, E281: a tower that lands in the stair-street's canyon walls off the view past its gatehouse —
    // it moves out to the canyon's nearer side; the rolls are unchanged, so no other tower moves)
    const z = x > 55 && zRoll > -25 && zRoll < 35 ? (zRoll < 5 ? -25 - d / 2 : 35 + d / 2) : zRoll;
    const top = rng.range(Y0 + 70, 252);
    const y0 = Y0 + 30;
    dressTower({ x, z, w, d, y0, h: top - y0 }, Math.floor(rng.next() * 1e6), { lod: 2, setbacks: true, wash: rng.pick([0x8c8a86, 0x85878a, 0x938a7e, 0x7f8388]), roof: false }, ctx.fd);
    // the crown: a glazed pavilion, tanks, an antenna forest with red beacons (the lower segment's size bounds them)
    const rw = w * 0.35, rd = d * 0.35;
    if (rng.chance(0.55)) put(rng.chance(0.6) ? 'shackG' : 'shackB', new Vector3(x + rng.range(-rw, rw) * 0.5, top, z + rng.range(-rd, rd) * 0.5), new Vector3(0, 0, 1), rng.range(2.2, 3.2), rng.range(1.6, 2.4), rng.range(2.0, 2.8), 0xffffff);
    for (let j = rng.int(0, 2); j > 0; j--) put('tank', new Vector3(x + rng.range(-rw, rw), top, z + rng.range(-rd, rd)), new Vector3(0, 0, 1), 1.6, 1.6, 1.6, 0xffffff);
    const nA = rng.int(1, 4);
    for (let j = 0; j < nA; j++) {
      const ax = x + rng.range(-rw, rw), az = z + rng.range(-rd, rd);
      const h = rng.range(8, 26);
      k.beam(new Vector3(ax, top, az), new Vector3(ax, top + h, az), 0.3, 0.3, { wash: 0x3a3d44, line: 1 });
      k.beam(new Vector3(ax - 1.5, top + h * 0.6, az), new Vector3(ax + 1.5, top + h * 0.6, az), 0.12, 0.12, { wash: 0x3a3d44, line: 0.8 });
      ctx.signs.light(new Vector3(ax, top + h + 0.3, az), new Vector3(1, 0, 0), new Vector3(0, 1, 0), 0.7, 0.7, NEON.red, 9, 2, rng.next());
    }
    for (let j = rng.int(2, 6); j > 0; j--) put('antenna', new Vector3(x + rng.range(-rw, rw), top, z + rng.range(-rd, rd)), new Vector3(1, 0, 0), 1.6, rng.range(4, 11), 1.6, 0xffffff);
  }
}

/** the lantern street south out of the square's south-west corner (E281 round 2, A1·7): x, and its far end */
const SOUTH_ST = { x0: 0.6, x1: 8.6, z1: 150 } as const;

/**
 * The lantern street south (E281 round 2). A1·7's target turns round from the spawn and looks down a long, lit,
 * lantern-strung street; the square's south-west corner building filled that frame. Its own stream (nothing else in the
 * city re-rolls): Kowloon walls both sides (the west one a shallow veneer where the Well's south-rim tower stands),
 * shops, the flagstones, blade signs reading toward the square, lantern strings at every height, two skybridges, a far
 * wall in the mist, walkers. Scenery for now: the square's edge still bounds the walk (colliders.ts).
 */
function southStreet(ctx: Ctx): void {
  const sr = new Rng(8117);
  // (its sign slots go after every other: the words of the city's existing signs stay as they were)
  ctx.fd.late = true;
  const S = SOUTH_ST, z0 = PLAZA.z1 + 0.6;
  const east = new Vector3(1, 0, 0), west = new Vector3(-1, 0, 0);
  // the west side: from the far end back to the square; its last 10 m a veneer on the rim tower's end
  // (seen end-on down the street through the silk: full dressing to 60 m from the spawn, painted past 110 m)
  wallRun(ctx, sr, new Vector3(S.x0, 0, S.z1), east, S.z1 - z0, Y0 + 5, [Y0 + 45, Y0 + 90], 'street-s-w', { openEnd: true, openDepth: { span: 10, depth: 0.6 }, lodAt: [60, 110] });
  shopfronts(ctx, 'south-shops', new Vector3(S.x0, 0, S.z1), east, S.z1 - z0, Y0, sr, WORDS, NEONS);
  // the east side: behind the square's corner tower (12 m deep) to the far end
  wallRun(ctx, sr, new Vector3(S.x1, 0, z0 + 12), west, S.z1 - z0 - 12, Y0 + 5, [Y0 + 45, Y0 + 95], 'street-s-e', { lodAt: [60, 110] });
  shopfronts(ctx, 'south-shops', new Vector3(S.x1, 0, z0 + 12), west, S.z1 - z0 - 12, Y0, sr, WORDS, NEONS);
  // the far end in the mist
  wallRun(ctx, sr, new Vector3(S.x1 + 6, 0, S.z1), new Vector3(0, 0, -1), S.x1 - S.x0 + 12, Y0, [Y0 + 80, Y0 + 110], 'street-s-end');
  // the flagstones (in the shops' kit: no draw)
  const k = ctx.kit('south-shops', true);
  k.quad(new Vector3(S.x0, Y0, S.z1), new Vector3(1, 0, 0), new Vector3(0, 0, -1), S.x1 - S.x0, S.z1 - z0, { wash: 0x3e4148, kind: K.flag, wet: 1, line: 0 });
  // blade signs reading toward the square, and lantern strings at every height
  const bs = ctx.kit('blades', true);
  bladeSigns(ctx, sr, bs, S.x0, z0 + 4, S.z1 - 20, 1, 12, Y0 + 5, Y0 + 22, -1);
  bladeSigns(ctx, sr, bs, S.x1, z0 + 14, S.z1 - 20, -1, 12, Y0 + 5, Y0 + 22, -1);
  const lines: [Vector3, Vector3][] = [];
  for (let z = z0 + 3; z < S.z1 - 8; z += sr.range(5, 8.5)) {
    const y = Y0 + sr.range(7, 24);
    lines.push([new Vector3(S.x0 + 0.4, y, z), new Vector3(S.x1 - 0.4, y + sr.range(-1.5, 1.5), z + sr.range(-2, 2))]);
  }
  strings(ctx, bs, lines, 1.45, 0.08, 0.68);
  skybridge(ctx, sr, S.x0 - 1, S.x1 + 1, z0 + 40, Y0 + 12, 3.0, 0.5);
  skybridge(ctx, sr, S.x0 - 1, S.x1 + 1, z0 + 78, Y0 + 23, 3.0, 0.5);
  // walkers down its middle
  for (let i = 0; i < 14; i++) {
    const z = z0 + 3 + i * sr.range(4, 7);
    const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), sr.chance(0.5) ? sr.range(-0.3, 0.3) : Math.PI + sr.range(-0.3, 0.3));
    ctx.walkers.push(new Matrix4().compose(new Vector3(sr.range(S.x0 + 1.8, S.x1 - 1.8), Y0, z), q, new Vector3(1, 1, 1).multiplyScalar(sr.range(0.94, 1.04))));
  }
  ctx.fd.late = false;
}

export function buildTowers(ctx: Ctx): void {
  const rng = new Rng(31);
  const words = WORDS;
  // the east side of the square (x = 30, facing west) — a gap for the stair-street
  const east = new Vector3(-1, 0, 0);
  wallRun(ctx, rng, new Vector3(PLAZA.x1 + 0.6, 0, PLAZA.z0), east, STAIR.z0 - PLAZA.z0, Y0 + 5, [Y0 + 55, Y0 + 100], 'east', { openEnd: true, openDepth: { span: 3, depth: SQ_DEPTH } });
  wallRun(ctx, rng, new Vector3(PLAZA.x1 + 0.6, 0, STAIR.z1), east, PLAZA.z1 - STAIR.z1 + 30, Y0 + 5, [Y0 + 50, Y0 + 95], 'east', { openStart: true, openDepth: { span: 3, depth: SQ_DEPTH } });
  shopfronts(ctx, 'east-shops', new Vector3(PLAZA.x1 + 0.6, 0, PLAZA.z0), east, STAIR.z0 - PLAZA.z0, Y0, rng, words, NEONS);
  shopfronts(ctx, 'east-shops', new Vector3(PLAZA.x1 + 0.6, 0, STAIR.z1), east, PLAZA.z1 - STAIR.z1, Y0, rng, words, NEONS);
  // the north side right of the gate (z = -30, facing south)
  const south = new Vector3(0, 0, 1);
  wallRun(ctx, rng, new Vector3(STREET.x1, 0, PLAZA.z0 - 0.6), south, PLAZA.x1 + 0.6 - STREET.x1, Y0 + 5, [Y0 + 28.4, Y0 + 28.4], 'north');
  shopfronts(ctx, 'north-shops', new Vector3(STREET.x1, 0, PLAZA.z0 - 0.6), south, PLAZA.x1 + 0.6 - STREET.x1, Y0, rng, words, NEONS);
  // the south side behind the spawn (z = 20, facing north)
  const north = new Vector3(0, 0, -1);
  // (E281 round 2: its west end opens on the lantern street south, A1·7 — SOUTH_ST; the rolls are unchanged)
  const southOpen = [PLAZA.x1 + 0.6 - SOUTH_ST.x1, PLAZA.x1 + 1.2] as const;
  wallRun(ctx, rng, new Vector3(PLAZA.x1 + 0.6, 0, PLAZA.z1 + 0.6), north, PLAZA.x1 + 0.6, Y0 + 5, [Y0 + 50, Y0 + 90], 'south', { open: southOpen });
  shopfronts(ctx, 'south-shops', new Vector3(PLAZA.x1 + 0.6, 0, PLAZA.z1 + 0.6), north, PLAZA.x1 + 0.6, Y0, rng, words, NEONS, southOpen);
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
  bs.compact = true;
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
    ['金行', NEON.jade, 21.4, Y0 + 7.6, 1.0, 'tube'], ['當舖', NEON.magenta, 14.6, Y0 + 10.5, 1.0, 'tube'], ['押', NEON.red, 17.6, Y0 + 20.5, 1.2, 'box'],
  ];
  // mockup A's top-right gold 旅館, face-on to the spawn over the gate's right (E281 pass 6)
  heroFlat(ctx, bs, '旅館', NEON.amber, 20, Y0 + 24.2, PLAZA.z0 - 0.6, 1.9, 1.9);
  for (const [text, col, x, y, size, style] of north2) {
    ctx.signs.place({ at: new Vector3(x, y, PLAZA.z0 + 1.2), normal: new Vector3(0, 0, 1), size, spec: { text, color: hex(col), vertical: true, style } }, bs);
    bs.beam(new Vector3(x, y, PLAZA.z0 - 0.6), new Vector3(x, y, PLAZA.z0 + 1.1), 0.1, 0.1, { wash: 0x2e3036, line: 0.8 });
  }
  // E281: the targets' big stacked neon, high on the towers the spawn looks at — the east wall's upper floors (facing
  // the spawn down the square) and across the Well on its west wall (mockup A's 九龍 / 牙科 / 火鍋 / 茶), clear of the
  // galleries (2.4 m out)
  const tall: [string, number, number, number, number, number, number][] = [
    // text, colour, wall x, out sign, y, z, size
    ['大押', NEON.red, PLAZA.x1 + 0.6, -1, Y0 + 31, -10.5, 1.7], ['酒家', NEON.jade, PLAZA.x1 + 0.6, -1, Y0 + 40, -19, 1.8],
    ['按摩', NEON.magenta, PLAZA.x1 + 0.6, -1, Y0 + 27, -1.5, 1.4], ['賓館', NEON.cyan, PLAZA.x1 + 0.6, -1, Y0 + 48, -6, 1.9],
    ['麵', NEON.magenta, WELL.x0, 1, Y0 + 29, -31, 2.4], ['牙科', NEON.cyan, WELL.x0, 1, Y0 + 19.5, -22, 1.5],
    ['火鍋', NEON.red, WELL.x0, 1, Y0 + 12.5, -34, 1.35], ['茶', NEON.jade, WELL.x0, 1, Y0 + 8, -14, 1.7],
    ['藥房', NEON.red, WELL.x0, 1, Y0 + 38, -12, 1.6], ['旅館', NEON.amber, WELL.x0, 1, Y0 + 44, -26, 1.8],
  ];
  for (const [text, col, wx, sg, y, z, size] of tall) heroBlade(ctx, bs, text, col, wx, sg, 2.7, y, z, size);
  // the Well's north wall (z = -44, x -12..0) is the left quarter of mockup A's frame: its stack of neon, face-on to the
  // spawn across the Well (九龍 highest, 牙科, 火鍋, 茶 at the foot), out past the wall's galleries
  // (pass 5: placed from the mockup's frame — each board's span in style-A mapped through the mockup camera — and
  // raised and enlarged; 九龍's top stays under the Cable Deck at +30 m, 火鍋 and 茶 left of the paifang's roofs)
  const flat: [string, number, number, number, number][] = [
    ['九龍', NEON.magenta, -7, Y0 + 25.4, 3.0], ['牙科', NEON.cyan, -1.9, Y0 + 22.2, 1.95],
    ['火鍋', NEON.red, -5.2, Y0 + 15.1, 1.75], ['茶', NEON.jade, -8.4, Y0 + 9, 2.1],
  ];
  for (const [text, col, x, y, size] of flat) heroFlat(ctx, bs, text, col, x, y, WELL.z0, 2.9, size);
  // lantern strings at several heights: across the square and the Well (east towers → the Well's west wall), over the
  // street beyond the gate, and across the square's north-east corner
  const xE = PLAZA.x1 + 0.3, xW = WELL.x0 + 2.6;
  strings(ctx, bs, [
    [new Vector3(xE, Y0 + 17, -5), new Vector3(xW, Y0 + 19, -8)],
    [new Vector3(xE, Y0 + 23, -15), new Vector3(xW, Y0 + 24, -19)],
    [new Vector3(xE, Y0 + 14, 9), new Vector3(xW, Y0 + 15.5, 5)],
    [new Vector3(xE, Y0 + 27.5, 3), new Vector3(xW, Y0 + 28.5, -2)],
  ], 1.9, 0.06, 0.72);
  strings(ctx, bs, [
    [new Vector3(STREET.x0 + 0.4, Y0 + 11, -31), new Vector3(STREET.x1 - 0.4, Y0 + 12, -32)],
    [new Vector3(STREET.x0 + 0.4, Y0 + 16, -37), new Vector3(STREET.x1 - 0.4, Y0 + 15, -36)],
    [new Vector3(STREET.x0 + 0.4, Y0 + 20, -42), new Vector3(STREET.x1 - 0.4, Y0 + 21, -43)],
    [new Vector3(15.5, Y0 + 16, PLAZA.z0 - 0.4), new Vector3(xE, Y0 + 18, -9)],
    [new Vector3(19.5, Y0 + 21, PLAZA.z0 - 0.4), new Vector3(xE, Y0 + 22, -14)],
  ], 1.5, 0.07, 0.68);
  dragonHook(bs, ctx, new Vector3(PLAZA.x1 + 0.6, Y0 + 12.5, -19), new Vector3(-1, 0, 0), 1.0);
  dragonHook(bs, ctx, new Vector3(STREET.x1, Y0 + 11, -46), new Vector3(-1, 0, 0), 1.0);
  dragonHook(bs, ctx, new Vector3(STREET.x0, Y0 + 9.5, -60), new Vector3(1, 0, 0), 1.0);
  // laundry and cables strung across the street
  const cab = bs; // the cables ride in the blade signs' mesh (one draw fewer)
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
  // E281: two high skybridges over the square and the Well (east towers → the Well's west wall): the look-ups'
  // crossings (targets A1·1, B2·1)
  // (north of z = -6, so the stair-street's opening and the top-down views over its foot stay clear)
  skybridge(ctx, rng, WELL.x0, PLAZA.x1 + 0.6, -7.5, Y0 + 37, 3.0, 0.3);
  skybridge(ctx, rng, WELL.x0, PLAZA.x1 + 0.6, -16.5, Y0 + 46, 3.2, 0.3);
  southStreet(ctx);
  // the stair-street climbing east: its foot and first flight (dome C1, stairstreet.ts: the plan, the physics, the tea
  // house, the hotpot shop, the 麵 sign and the dragon hook)
  buildStairStreet(ctx);
  // landing 1 upward (dome C2, stairstreet-upper.ts): the terraces, towers, the paifang, bridges, signs, crowd, far end
  buildStairUpper(ctx);
  // the floor plan for the minimap: blocks around the square and the street
  ctx.map.push({ x0: PLAZA.x1, z0: -120, x1: 70, z1: STAIR.z0, kind: 'block' });
  ctx.map.push({ x0: PLAZA.x1, z0: STAIR.z1, x1: 70, z1: 60, kind: 'block' });
  ctx.map.push({ x0: -60, z0: PLAZA.z1, x1: PLAZA.x1, z1: 60, kind: 'block' });
  ctx.map.push({ x0: STREET.x1, z0: -140, x1: PLAZA.x1, z1: PLAZA.z0, kind: 'block' });
  ctx.map.push({ x0: -60, z0: -140, x1: STREET.x0, z1: WELL.z0, kind: 'block' });
  ctx.map.push({ x0: -60, z0: WELL.z0, x1: WELL.x0, z1: PLAZA.z1, kind: 'block' });
}
