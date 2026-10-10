// The Yamen Well's mid-shaft (dome B2, E169; dome C's first cut): the canyon's run north under the Cable Deck — its
// galleries on both sides, the stub wall that closes the main shaft's north-east corner and the far end, with stair
// flights zig-zagging down their fronts — and everything that crosses the shaft: the bridges, catwalks and the two gate
// bridges (well-bridges.ts; the paifang across the shaft that mockups B and D look at), the sagging nets strung like
// hammocks between the gallery fronts, the gondola's cable and stations, the pipes and lantern strings across the gap,
// the far signs and the brass dragon hooks. Mockup B looks along the shaft from the south rim: crossings at every level
// receding into the silk mist like the rungs of a ladder, so each crossing's detail steps down with its distance from
// the rim and from dome B2's anchor (the timber bridge 6 m under the rim at z −21).
import { Vector3 } from 'three';
import { spanStreet } from './facadeGrammar';
import { E, K, type Kit, type Look } from '../world/kit';
import { WELL, Y0 } from '../layout';
import { dragonHook } from './props';
import { NEONS } from './towers';
import { WORDS } from '../world/words';
import { NEON } from '../util';
import { Rng } from '@wildshard/engine/core/rng';
import { SURF } from '../look/paint';
import { FLOOR_H, stand } from './well-galleries';
import { archDrop, bridge, net, station } from './well-bridges';
import type { Ctx } from '../world/ctx';
import { type BandKits, CROSSINGS, type Crossing, DECK_TOP, LOW, type WellPlan, snapFloor } from './well-plan';
import { CABLE, CROSSING_COLLIDERS, EXT, FAR } from '../world/wellBounds';
import { ghostLevels } from './well-lower-deep';

const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

/**
 * Where dome B2's anchor stands, on the timber bridge 6 m under the rim (CROSSINGS' z −21): nobody stands there, no
 * rail post or lantern blocks the view off it, its pavilion stands aside, and its crowd is doubled (the targets show a
 * packed bridge from every side).
 */
const ANCHOR = { x: -14, z: -21, y: Y0 - 6 } as const;

/** mockup B / D's cameras (mockupCameras.ts) and dome B2's anchor: a crossing's detail steps down with its distance */
const VIEWS = [new Vector3(-19.5, Y0 + 1.68, 13.3), new Vector3(-14, Y0 + 1.9, 11.3), new Vector3(-14, Y0 - 4, -21)] as const;
const lodAt = (x: number, y: number, z: number): number => {
  const d = Math.min(...VIEWS.map((v) => v.distanceTo(new Vector3(x, y, z))));
  return d < 45 ? 0 : d < 70 ? 1 : 2;
};

/** the nets, strung like hammocks: z range (3–4 m), height of the rim (between floors); none nearer the rim than z −8 */
const NETS: readonly [number, number, number][] = [
  [-16.5, -19.4, Y0 - 10.5], [-14, -18, Y0 - 22.5], [-30, -34, Y0 - 31.5], [-39, -43, Y0 - 13.5], [-20, -24, Y0 - 43.5], [-8, -12, Y0 - 56.5],
  [-47, -50, Y0 - 7.5], [-55, -59, Y0 - 16.5], [-64.5, -67.5, Y0 - 1.5], [-73, -77, Y0 - 22.5], [-82, -85, Y0 - 10.5],
  [-91, -94, Y0 - 28.5], [-60, -63, Y0 - 40.5], [-80, -83, Y0 - 46.5],
];

/** the far hero signs: text, colour, side, z, height, size (F4, mockup B: its canyon walls carry big calligraphy on both
 *  sides, receding: ×1.6, and 旅館 off the stone crossing's end at z −51) */
const HERO: readonly [string, number, 'W' | 'E', number, number, number][] = [
  ['酒家', NEON.amber, 'W', -58, Y0 + 7, 1.9], ['理髮', NEON.cyan, 'E', -66, Y0 + 2, 1.75], ['當舖', NEON.red, 'W', -78, Y0 - 4, 1.75], ['冰室', NEON.magenta, 'E', -86, Y0 + 9, 1.75],
  ['旅館', NEON.jade, 'E', -56, Y0 - 9, 1.85], ['麵', NEON.magenta, 'W', -47, Y0 - 13, 2.0], ['火鍋', NEON.red, 'E', -74, Y0 + 15, 1.75], ['藥房', NEON.jade, 'W', -90, Y0 - 16, 1.6],
];

/** the main shaft's lantern strings, one a level (z, the floor they hang over) */
const LEVEL_STRINGS: readonly [number, number][] = [
  [-20, Y0 - 21], [-21, Y0 - 27], [-25, Y0 - 30], [-24, Y0 - 36], [0, Y0 - 36], [-4, Y0 - 45], [-29, Y0 - 51], [-13, Y0 - 51], [-24, Y0 - 57],
];

/** the run north's lantern strings (z, the floor they hang over) */
const RUN_STRINGS: readonly [number, number][] = [[-54.5, Y0 - 6], [-67, Y0 - 9], [-74, Y0 - 12], [-79, Y0 - 15], [-89.5, Y0 - 3]];

/** the pipes run across the gap (z, height, radius, colour) */
const PIPES: readonly [number, number, number, number][] = [
  [-46, Y0 - 3.2, 0.22, 0x7c8187], [-61, Y0 + 6.4, 0.3, 0x8a6650], [-68, Y0 - 12.5, 0.2, 0x6d7178], [-79, Y0 + 3.6, 0.26, 0x7c8187],
  [-92, Y0 - 7.3, 0.22, 0x8a6650], [-36, Y0 - 24.4, 0.24, 0x6d7178], [-2, Y0 - 38.5, 0.2, 0x8a6650],
];

/** the run north's parked gondola (F4): its cable across the slot at z, height y, the cabin at x */
const RUN_CABLE = { z: -46.5, y: Y0 + 16, x: -21 } as const;

/** mockup B's gondola far off: the detailed cabin's (well-bridges.ts gondolaCabin) big masses, hung from a cable point */
function farCabin(k: Kit, x: number, y: number, z: number, s = 1): void {
  const W = 2.9 * s, D = 2.1 * s, y0 = y - 4.35 * s;
  const RED: Look = { wash: 0xb32a1b, line: 1.1, accent: true, gloss: true, surf: SURF.lacquer };
  const ROOF: Look = { wash: 0x7e1f14, kind: K.tiles, line: 1, accent: true };
  const GOLD: Look = { wash: 0xd9b25a, line: 1, accent: true, gloss: true };
  k.box(x, y0, z, W - 0.1 * s, 0.14 * s, D - 0.1 * s, { wash: 0x6e1a10, line: 1, accent: true });
  k.box(x, y0 + 0.14 * s, z, W, 0.92 * s, D, { wash: 0xa82619, kind: K.panel, line: 1, accent: true, surf: SURF.lacquer });
  k.box(x, y0 + 1.06 * s, z, W - 0.06 * s, s, D - 0.06 * s, { wash: 0xffdca6, emit: 1.2, kind: K.facade, row: s, col: 0.6 * s, seed: 5, line: 1, accent: true });
  k.box(x, y0 + 1.02 * s, z, W + 0.06 * s, 0.06 * s, D + 0.06 * s, GOLD);
  k.box(x, y0 + 2.06 * s, z, W, 0.3 * s, D, RED);
  k.box(x, y0 + 2.36 * s, z, W + 0.28 * s, 0.2 * s, D + 0.28 * s, ROOF);
  k.box(x, y0 + 2.56 * s, z, W - 0.7 * s, 0.3 * s, D - 0.9 * s, ROOF);
  k.box(x, y0 + 2.86 * s, z, 0.14 * s, y - 0.5 * s - (y0 + 2.86 * s), 0.14 * s, { wash: 0x2a2c31, line: 1 });
  k.box(x, y - 0.5 * s, z, 1.4 * s, 0.34 * s, 0.34 * s, { wash: 0x3a3d44, line: 1 });
}

/** the run north's lowest gallery floor (its lowest crossing lands at Y0 − 39) */
const X_LOW = Y0 - 42;
/** where the run north's walls stop, as painted shells, deep in the silk (dome D2: the views north and down) */
const SHELL_BOTTOM = -40;

/**
 * (F4, round 2: mockup B's "crossings like ladder rungs receding into the mist to the far gate") the run north goes on
 * past the Cable Deck's edge (z −104) to FAR.z0, open to the sky, at the far LOD: a painted back wall to the canyon's
 * top (+155; the facade program's window rows), ghost levels from DECK_TOP (a deck slab, a lit room or
 * two, now and then a lantern: well-lower-deep.ts) 17 floors down to +101 (below that, 120–200 m off, the rim's eye sees
 * only silk) and a far north wall where the view ends; its triangles go in the run north's two kits (no draw of its own).
 */
function farRun(ctx: Ctx, kit: (y: number) => Kit): void {
  const top = Y0 + 30;
  const walls = [
    { p0: new Vector3(FAR.x0, 0, FAR.z1), n: new Vector3(1, 0, 0), len: FAR.z1 - FAR.z0, wash: 0x737782, seed: 9101 },
    { p0: new Vector3(FAR.x1, 0, FAR.z0), n: new Vector3(-1, 0, 0), len: FAR.z1 - FAR.z0, wash: 0x7c7c80, seed: 9203 },
    { p0: new Vector3(FAR.x0, 0, FAR.z0), n: new Vector3(0, 0, 1), len: FAR.x1 - FAR.x0, wash: 0x70747f, seed: 9307 },
  ];
  for (const w of walls) {
    const u = new Vector3().crossVectors(new Vector3(0, 1, 0), w.n).normalize();
    for (let y = SHELL_BOTTOM; y < top - 0.01; y += 30) {
      const h = Math.min(30, top - y);
      const a = w.p0.clone().setY(y), b = a.clone().addScaledVector(u, w.len);
      const vo = ((y - (Y0 % FLOOR_H)) % FLOOR_H + FLOOR_H) % FLOOR_H;
      kit(y).quad4(a, b, b.clone().setY(y + h), a.clone().setY(y + h), w.len, h, { wash: w.wash, kind: K.facade, row: FLOOR_H, col: 2.8, seed: w.seed % 97, line: 1 }, a.dot(u), vo, E.none);
    }
    ghostLevels(ctx, kit, { p0: w.p0, n: w.n, len: w.len, dMin: 2, dMax: 3.4, wash: w.wash }, DECK_TOP, 17, 1.2, w.seed);
  }
  // (E355, the E323 audit) the far walls are painted, but the rungs past the deck's edge reach them and collide: a 1 m
  // slab behind each wall, from under the fragment's floor (manifest bounds, Y0 − 100) to the canyon's top, so a drop or
  // a walk off a far rung's end stays in the canyon (the bounds' soft respawn catches the fall) instead of passing
  // through the paint into the street's underside or past the level's edge
  const y0 = Y0 - 104, h = top - y0, cy = y0 + h / 2, surface = 'stone' as const;
  CROSSING_COLLIDERS.push(
    { kind: 'box', x: FAR.x0 - 0.5, y: cy, z: (FAR.z0 + FAR.z1) / 2, hx: 0.5, hy: h / 2, hz: (FAR.z1 - FAR.z0) / 2 + 1, surface },
    { kind: 'box', x: FAR.x1 + 0.5, y: cy, z: (FAR.z0 + FAR.z1) / 2, hx: 0.5, hy: h / 2, hz: (FAR.z1 - FAR.z0) / 2 + 1, surface },
    { kind: 'box', x: (FAR.x0 + FAR.x1) / 2, y: cy, z: FAR.z0 - 0.5, hx: (FAR.x1 - FAR.x0) / 2 + 1, hy: h / 2, hz: 0.5, surface },
  );
}

/** the crossings' kits: the main shaft's and the run north's (each one mesh, culled as a whole), one alpha-cut kit */
function regionKits(ctx: Ctx): { main: Kit; ext: Kit; at: (z: number) => Kit; alpha: Kit } {
  const main = ctx.kit('well-c-main'), ext = ctx.kit('well-c-ext');
  return { main, ext, at: (z) => (z > WELL.z0 ? main : ext), alpha: ctx.alpha('well-c-a') };
}

/** a string of paper lanterns on a sagging wire from a to b, one every `spacing` m */
function lanternLine(ctx: Ctx, k: Kit, a: Vector3, b: Vector3, spacing: number, scale = 0.62, cordSegs = 0): void {
  const len = a.distanceTo(b);
  const n = Math.max(2, Math.round(len / spacing));
  const sag = len * 0.06;
  const at = (t: number): Vector3 => a.clone().lerp(b, t).add(new Vector3(0, -sag * 4 * t * (1 - t), 0));
  // the cord: a segment per lantern, or `cordSegs` (a far string's cord is a hairline; each segment is a 24-vertex beam)
  const m = cordSegs > 0 ? cordSegs : n;
  for (let i = 0; i < m; i++) k.beam(at(i / m), at((i + 1) / m), 0.025, 0.025, { wash: 0x2a2c31, line: 0.5 });
  for (let i = 1; i < n; i++) { const p = at(i / n); ctx.lantern(p.x, p.y - 0.15, p.z, scale); }
}

export function buildMid(plan: WellPlan): void {
  const ctx = plan.ctx;
  const rng = new Rng(157);
  CROSSING_COLLIDERS.length = 0;
  // ── the run north's walls and the stub, top to bottom, stair flights down their fronts ──
  // (the lane's budget, art/nine-dragon-stack/budget.md: ≤ 16 draws, ≤ 0.35 M tris — so few, big kits: the run north's
  // walls in two, the crossings by region, one alpha kit, one for both gates. The run north's galleries stop at
  // X_LOW, under its lowest crossing: below that its walls run on as painted shells into the mist.)
  const KX: BandKits = { kit: (y) => ctx.kit(y >= Y0 - 25 ? 'well-x-hi' : 'well-x-lo'), alpha: () => ctx.alpha('well-c-a') };
  // (round 2, pass 10, mockup B: "its walls are warm-lit timber galleries, verandas with lanterns") a lantern row along
  // every open front of the stub and the run north, from the rim's level down: each gallery a warm line receding up the
  // canyon (the stub, face-on to B 57 m off, reads as tiers of lit verandas instead of a block)
  const row = { yMin: X_LOW, yMax: Y0 + 12, spacing: 3.4 };
  plan.band('stub', DECK_TOP, LOW, 853, KX, SHELL_BOTTOM, 2, { lanternRow: row });
  // (round 2, mockup B) the run north's galleries 1.2–2.2 m deep (the plan's 2–3.4): from the rim its open gap reads
  // ~12.5 m, not ~10, so the view down it stays a canyon to the vanishing point instead of a slot between two walls
  const shallow = { depths: { dMin: 1.2, dMax: 2.2 }, lanternRow: row };
  plan.band('west-x', DECK_TOP, X_LOW, 857, KX, SHELL_BOTTOM, 5, shallow);
  plan.band('east-x', DECK_TOP, X_LOW, 863, KX, SHELL_BOTTOM, 5, shallow);
  // (round 2: the run north's north wall at z −104 went — the canyon runs on past the deck's edge, farRun)
  farRun(ctx, KX.kit);

  // ── the crossings (their ends at the gallery fronts: the rim's, this region's and the lower levels' bands) ──
  const KC = regionKits(ctx);
  CROSSINGS.forEach((c) => {
    const [fw, fe] = plan.fronts(c.z, c.y);
    const [tw, te] = plan.fronts(c.z, c.y + FLOOR_H);
    const [aw, ae] = plan.frontsMax(c.z - c.w / 2, c.z + c.w / 2, c.y - archDrop(c.kind, fe - fw) * 0.6);
    const kx = ctx.kitx('well-c-gates');
    const k = c.kind === 'gate' ? ctx.kit('well-c-gates') : KC.at(c.z);
    const lod = lodAt((fw + fe) / 2, c.y, c.z);
    const anchor = c.z === ANCHOR.z && c.y === ANCHOR.y;
    // (far walkers are a ~220-triangle LOD: the far crossings carry twice the plan's people, so each rung has its crowd)
    const crowd = anchor || lod >= 1 ? c.crowd * 2 : c.crowd;
    CROSSING_COLLIDERS.push(...bridge(ctx, k, KC.alpha, kx, {
      kind: c.kind, z: c.z, y: c.y, x0: fw, x1: fe, w: c.w, seed: 9000 + Math.round((c.z + 200) * 7 + c.y * 13), crowd, lod,
      ax0: Math.max(fw, aw), ax1: Math.min(fe, ae), top0: Math.max(fw, tw), top1: Math.min(fe, te),
      ...(anchor ? { clear: ANCHOR.x } : {}),
    }));
  });
  // ── the nets between the gallery fronts ──
  NETS.forEach(([z0, z1, y], i) => {
    const [fw, fe] = plan.frontsMax(z0, z1, y);
    const sag = Math.min(2.4, (fe - fw) * 0.14);
    net(KC.at(z0), KC.alpha, fw + 0.15, fe - 0.15, Math.min(z0, z1), Math.max(z0, z1), y, sag, 300 + i * 7);
    // a net-mender in the belly of a few (the targets' nets carry people)
    if (i % 4 === 0 && lodAt((fw + fe) / 2, y, z0) < 2) stand(ctx, new Vector3((fw + fe) / 2 + rng.range(-1.5, 1.5), y - sag * 0.93, (z0 + z1) / 2), rng.chance(0.5) ? new Vector3(1, 0, 0) : new Vector3(0, 0, 1), 1);
  });
  // ── the gondola: its cable pair and the two stations off the walls ──
  const ck = KC.at(CABLE.z);
  for (const dz of [-0.9, 0.9]) ck.beam(new Vector3(CABLE.x0 + 1, CABLE.y, CABLE.z + dz), new Vector3(CABLE.x1 - 1, CABLE.y + 0.8, CABLE.z + dz), 0.06, 0.06, { wash: 0x1d1e22, line: 0.6 });
  ck.beam(new Vector3(CABLE.x0 + 1, CABLE.y + 0.02, CABLE.z), new Vector3(CABLE.x1 - 1, CABLE.y + 0.82, CABLE.z), 0.07, 0.07, { wash: 0x1d1e22, line: 0.6 });
  station(ctx, ck, CABLE.x0, CABLE.x0 + 5.2, CABLE.z, CABLE.y + 1.4, 1, CABLE.y);
  station(ctx, ck, CABLE.x1 - 5.2, CABLE.x1, CABLE.z, CABLE.y + 2.2, -1, CABLE.y + 0.8);
  // ── (F4, mockup B) a second line across the run north, its cabin parked mid-span: mockup B's red gondola hangs in the
  // middle of the view up the canyon (from B's camera ~33 % down the frame, 59 m off in the silk). Its cable pair ties
  // to brackets on the gallery fronts; the cabin is a far LOD (~150 tris) in the run north's crossings kit (no draw) ──
  {
    const [fw, fe] = plan.fronts(RUN_CABLE.z, snapFloor(RUN_CABLE.y));
    const k = KC.at(RUN_CABLE.z), rise = 0.6;
    const wire = { wash: 0x1d1e22, line: 0.6 };
    for (const dz of [-0.4, 0.4]) k.beam(new Vector3(fw - 0.2, RUN_CABLE.y, RUN_CABLE.z + dz), new Vector3(fe + 0.2, RUN_CABLE.y + rise, RUN_CABLE.z + dz), 0.05, 0.05, wire);
    for (const [x, t] of [[fw + 0.25, 0], [fe - 0.25, 1]] as const) k.box(x, RUN_CABLE.y - 0.5 + rise * t, RUN_CABLE.z, 0.5, 0.9, 1.3, { wash: 0x3a3d44, line: 1 });
    const cx = RUN_CABLE.x, t = (cx - fw) / Math.max(fe - fw, 1);
    // (×1.5: at 59 m the cabin at its real size was a few pixels; mockup B's reads as the frame's one red landmark)
    farCabin(k, cx, RUN_CABLE.y + rise * t, RUN_CABLE.z, 1.5);
  }

  // ── the far signs and hooks ──
  const hk = (z: number): Kit => KC.at(z);
  const south = new Vector3(0, 0, 1);
  for (const [text, col, side, z, y, size] of HERO) {
    const [fw, fe] = plan.fronts(z, snapFloor(y));
    const w = size * 1.36;
    const x = side === 'W' ? fw + 0.35 + w / 2 : fe - 0.35 - w / 2;
    ctx.signs.place({ at: new Vector3(x, y, z), normal: south, size, spec: { text, color: hex(col), vertical: true, style: 'tube' }, blade: true }, null);
    const top = y + (size * (Array.from(text).length + 0.62)) / 2 + 0.2;
    hk(z).beam(new Vector3(side === 'W' ? fw - 0.3 : fe + 0.3, top, z), new Vector3(side === 'W' ? x + w / 2 + 0.1 : x - w / 2 - 0.1, top, z), 0.1, 0.1, { wash: 0x2e3036, line: 0.8 });
  }
  // blade signs of every size down both walls
  for (let i = 0; i < 26; i++) {
    const ext = rng.chance(0.55);
    const z = ext ? rng.range(EXT.z0 + 4, EXT.z1 - 2) : rng.range(WELL.z0 + 2, WELL.z1 - 6);
    const y = rng.chance(0.65) ? rng.range(Y0 - 30, ext ? Y0 + 26 : Y0 - 2) : rng.range(LOW, Y0 - 30);
    const [fw, fe] = plan.fronts(z, snapFloor(y));
    if (fe - fw < 4) continue;
    const size = rng.range(0.7, 1.2);
    const w = size * 1.36;
    const onW = rng.chance(0.5);
    ctx.signs.place({ at: new Vector3(onW ? fw + 0.3 + w / 2 : fe - 0.3 - w / 2, y, z), normal: south, size, spec: { text: rng.pick(WORDS), color: hex(rng.pick(NEONS)), vertical: true, style: rng.chance(0.85) ? 'tube' : 'box' }, blade: true, flicker: rng.chance(0.06) ? rng.next() : 0 }, hk(z));
  }
  for (const [side, z, y] of [['E', -60, Y0 + 7.8], ['W', -72, Y0 + 1.8], ['E', -84, Y0 - 7.2], ['W', -54, Y0 - 13.2], ['E', -40, Y0 - 25.2]] as const) {
    const [fw, fe] = plan.fronts(z, snapFloor(y));
    dragonHook(hk(z), ctx, new Vector3(side === 'W' ? fw - 0.1 : fe + 0.1, y, z), new Vector3(side === 'W' ? 1 : -1, 0, 0), 0.9);
  }
  // ── what is strung across the gap: pipes, lantern strings, laundry lines and cable bundles ──
  for (const [z, y, r, col] of PIPES) {
    const [fw, fe] = plan.frontsMax(z - r, z + r, snapFloor(y));
    const k = KC.at(z);
    k.beam(new Vector3(fw - 0.2, y, z), new Vector3(fe + 0.2, y, z), r * 2, r * 2, { wash: col, line: 0.8 });
    for (const x of [fw + 0.5, fe - 0.5]) k.box(x, y - r - 0.05, z, 0.14, 2 * r + 0.1, 0.5, { wash: 0x3a3d44, line: 0.8 });
  }

  for (let i = 0; i < 8; i++) {
    const ext = i % 3 !== 0;
    const z = ext ? rng.range(EXT.z0 + 3, EXT.z1 - 1) : rng.range(WELL.z0 + 2, WELL.z1 - 14);
    const floor = Y0 - FLOOR_H * rng.int(ext ? -6 : 1, 9);
    const [fw, fe] = plan.fronts(z, floor);
    const ya = floor + rng.range(2.2, 2.6);
    lanternLine(ctx, KC.at(z), new Vector3(fw + 0.1, ya, z), new Vector3(fe - 0.1, ya + rng.range(-0.8, 0.8), z + rng.range(-2, 2)), 3.2);
  }
  for (let i = 0; i < 14; i++) {
    const ext = i % 2 === 1;
    const z = ext ? rng.range(EXT.z0 + 3, EXT.z1 - 1) : rng.range(WELL.z0 + 2, WELL.z1 - 12);
    const floor = Y0 - FLOOR_H * rng.int(ext ? -7 : 2, 12);
    const [fw, fe] = plan.fronts(z, floor);
    const ya = floor + rng.range(1.9, 2.5);
    spanStreet(ctx.fd, new Vector3(fw + 0.1, ya, z), new Vector3(fe - 0.1, ya + rng.range(-1.2, 1.2), z + rng.range(-3, 3)), Math.floor(rng.next() * 1e6));
  }
  // (F5, mockup D: "level after level … stepping down into the mist") strings of paper lanterns across the main shaft,
  // one a level, each deeper and further on than the last: from mockup D's camera they step down the frame from the
  // gate bridge (~22 %) to the temple (~64 %), lines of warm light the silk lets through (a lit surface punches through
  // it, look/style.ts EMIT_FOG). Clear of every crossing and net, and ≥ 6 m off dome D2's anchor (−14, +97.6, −6): one
  // strung 3 m under it hung as a row of big orange blobs across its look-down
  for (const [z, floor] of LEVEL_STRINGS) {
    const [fw, fe] = plan.fronts(z, floor);
    const ya = floor + 2.4;
    lanternLine(ctx, KC.main, new Vector3(fw + 0.1, ya, z), new Vector3(fe - 0.1, ya + 0.3, z + 0.6), 1.5, 1.0, 3);
  }
  // (F4, mockup B) and up the run north, below the rim's eye: rungs of warm light receding between the crossings into
  // the silk (clear of every crossing, net and pipe there)
  for (const [z, floor] of RUN_STRINGS) {
    const [fw, fe] = plan.fronts(z, floor);
    const ya = floor + 2.4;
    lanternLine(ctx, KC.at(z), new Vector3(fw + 0.1, ya, z), new Vector3(fe - 0.1, ya + 0.3, z - 0.6), 1.4, 1.2, 3);
  }
  skyCables(ctx, KC.main, rng);
  outriggers(plan, KX.kit, KX.alpha, CROSSINGS, rng);
}

/**
 * The cable bundles over the main shaft above the rim: from the west towers' face to the sign masts on the square's lip
 * (square.ts signMasts), 2–3 sagging wires each, one strung with lanterns — the shaft's sky reads crossed and layered
 * from the rim and from the crossings below (dome B2's look-up).
 */
function skyCables(ctx: Ctx, k: Kit, rng: Rng): void {
  const MASTS: readonly [number, number][] = [[-1.0, -6], [-3.2, -13], [-1.4, -20], [-3.6, -28]];
  const wire = { wash: 0x1d1e22, line: 0.5 };
  const sagged = (a: Vector3, b: Vector3, sag: number, n: number): Vector3[] => {
    const pts: Vector3[] = [];
    for (let i = 0; i <= n; i++) pts.push(a.clone().lerp(b, i / n).add(new Vector3(0, -sag * 4 * (i / n) * (1 - i / n), 0)));
    return pts;
  };
  MASTS.forEach(([mx, mz], i) => {
    const za = mz + rng.range(-6, 6);
    const ya = Y0 + rng.range(7, 17);
    const yb = Y0 + rng.range(12, 19.5);
    const nW = rng.int(2, 3);
    for (let j = 0; j < nW; j++) {
      const a = new Vector3(WELL.x0 + 0.3, ya + j * 0.18, za + j * 0.12), b = new Vector3(mx - 0.2, yb + j * 0.15, mz);
      const pts = sagged(a, b, 1.2 + j * 0.35, 8);
      for (let q = 0; q + 1 < pts.length; q++) { const p0 = pts[q], p1 = pts[q + 1]; if (p0 !== undefined && p1 !== undefined) k.beam(p0, p1, 0.035, 0.035, wire); }
    }
    if (i % 2 === 1) lanternLine(ctx, k, new Vector3(WELL.x0 + 0.3, ya - 1.2, za), new Vector3(mx - 0.2, yb - 1.4, mz), 2.4);
  });
}

/**
 * Outriggers on the run north's walls: small decks cantilevered 1.4–2.4 m past a gallery front on two steel struts,
 * with a barred railing round three sides, a lantern, a pot plant and sometimes someone at the rail — the walls read
 * layered, platforms stepping out into the canyon at many heights. None where a crossing or a net comes near.
 */
function outriggers(plan: WellPlan, kit: (y: number) => Kit, alpha: (y: number) => Kit, crossings: readonly Crossing[], rng: Rng): void {
  const ctx = plan.ctx;
  const steel = { wash: 0x3a3d44, line: 0.9 };
  const bars = { wash: 0x2a2c31, kind: 4, row: 1, col: 0.13, line: 1 };
  for (let i = 0, tries = 0; i < 12 && tries < 80; tries++) {
    const z = rng.range(EXT.z0 + 5, EXT.z1 - 3);
    const y = Y0 - FLOOR_H * rng.int(-7, 12);
    if (crossings.some((c) => Math.abs(c.z - z) < c.w / 2 + 3 && Math.abs(c.y - y) < 7)) continue;
    if (NETS.some(([z0, z1, ny]) => z < Math.max(z0, z1) + 2 && z > Math.min(z0, z1) - 2 && Math.abs(ny - y) < 5)) continue;
    const west = rng.chance(0.5);
    const [fw, fe] = plan.fronts(z, y);
    if (fe - fw < 7) continue;
    const out = rng.range(1.4, 2.4), len = rng.range(2.2, 3.6);
    const s = west ? 1 : -1;
    const x0 = west ? fw : fe, x1 = x0 + s * out;
    const k = kit(y), ka = alpha(y);
    const cx = (x0 + x1) / 2;
    k.box(cx, y - 0.16, z, out, 0.16, len, { wash: 0x6b6d72, line: 1.8 }, { top: { wash: 0x5a5c62, kind: 3, line: 0, wet: 0.6 } });
    for (const dz of [-len / 2 + 0.2, len / 2 - 0.2]) k.beam(new Vector3(x0, y - 1.9, z + dz), new Vector3(x1 - s * 0.15, y - 0.2, z + dz), 0.12, 0.12, steel);
    // the railing: the outer edge and the two sides (alpha-cut bars), a top rail
    const n = new Vector3(s, 0, 0);
    ka.quad(new Vector3(x1, y, z + (west ? -len / 2 : len / 2)), new Vector3(0, 0, west ? 1 : -1), new Vector3(0, 1, 0), len, 1.02, bars);
    k.beam(new Vector3(x1, y + 1.02, z - len / 2), new Vector3(x1, y + 1.02, z + len / 2), 0.06, 0.06, steel);
    for (const dz of [-len / 2, len / 2]) {
      k.beam(new Vector3(x0, y + 1.02, z + dz), new Vector3(x1, y + 1.02, z + dz), 0.06, 0.06, steel);
      k.box(x1, y, z + dz, 0.07, 1.02, 0.07, steel);
      ka.quad(new Vector3(dz > 0 ? x0 : x1, y, z + dz), new Vector3(dz > 0 ? s : -s, 0, 0), new Vector3(0, 1, 0), out, 1.02, bars);
    }
    ctx.lantern(x1 - s * 0.2, y + 2.1, z + rng.range(-len / 3, len / 3), 0.7);
    ctx.put('plant', new Vector3(x0 + s * 0.4, y, z + (rng.chance(0.5) ? 1 : -1) * (len / 2 - 0.4)), n.clone().negate(), new Vector3(1.2, rng.range(1, 1.5), 1.2));
    if (rng.chance(0.45)) stand(ctx, new Vector3(x1 - s * 0.6, y, z + rng.range(-len / 4, len / 4)), n, rng.range(0.94, 1.04));
    i++;
  }
}
