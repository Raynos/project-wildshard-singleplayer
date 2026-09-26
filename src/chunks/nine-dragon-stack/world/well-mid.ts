// The Yamen Well's mid-shaft (dome B2, E169; dome C's first cut): the canyon's run north under the Cable Deck — its
// galleries on both sides, the stub wall that closes the main shaft's north-east corner and the far end, with stair
// flights zig-zagging down their fronts — and everything that crosses the shaft: the bridges, catwalks and the two gate
// bridges (well-bridges.ts; the paifang across the shaft that mockups B and D look at), the sagging nets strung like
// hammocks between the gallery fronts, the gondola's cable and stations, the pipes and lantern strings across the gap,
// the far signs and the brass dragon hooks. Mockup B looks along the shaft from the south rim: crossings at every level
// receding into the silk mist like the rungs of a ladder, so each crossing's detail steps down with its distance from
// the rim and from dome B2's anchor (the timber bridge 6 m under the rim at z −21).
import { Vector3 } from 'three';
import type { ColliderDesc } from '../../../world/registry';
import { spanStreet } from './facade/grammar';
import type { Kit } from './kit';
import { WELL, Y0 } from '../layout';
import { dragonHook } from './props';
import { NEONS, WORDS } from './towers';
import { NEON, Rng } from '../util';
import { FLOOR_H, stand } from './well-galleries';
import { archDrop, bridge, net, station } from './well-bridges';
import type { Ctx } from './ctx';
import { CABLE, CROSSINGS, type Crossing, DECK_TOP, EXT, LOW, type WellPlan, bandKits, snapFloor } from './well-plan';

const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

/**
 * Where dome B2's anchor stands, on the timber bridge 6 m under the rim (CROSSINGS' z −21): nobody stands there, no
 * rail post or lantern blocks the view off it, its pavilion stands aside, and its crowd is doubled (the targets show a
 * packed bridge from every side).
 */
const ANCHOR = { x: -14, z: -21, y: Y0 - 6 } as const;

/** mockup B / D's cameras (mockupCameras.ts) and dome B2's anchor: a crossing's detail steps down with its distance */
const VIEWS = [new Vector3(-19.5, Y0 + 1.68, 12.25), new Vector3(-14, Y0 + 1.9, 11.3), new Vector3(-14, Y0 - 4, -21)] as const;
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

/** the far hero signs: text, colour, side, z, height, size */
const HERO: readonly [string, number, 'W' | 'E', number, number, number][] = [
  ['酒家', NEON.amber, 'W', -58, Y0 + 7, 1.2], ['理髮', NEON.cyan, 'E', -66, Y0 + 2, 1.1], ['當舖', NEON.red, 'W', -78, Y0 - 4, 1.1], ['冰室', NEON.magenta, 'E', -86, Y0 + 9, 1.1],
  ['旅館', NEON.jade, 'E', -52, Y0 - 9, 1.15], ['麵', NEON.magenta, 'W', -48, Y0 - 13, 1.3], ['火鍋', NEON.red, 'E', -74, Y0 + 15, 1.1], ['藥房', NEON.jade, 'W', -90, Y0 - 16, 1.0],
];

/** the pipes run across the gap (z, height, radius, colour) */
const PIPES: readonly [number, number, number, number][] = [
  [-46, Y0 - 3.2, 0.22, 0x7c8187], [-61, Y0 + 6.4, 0.3, 0x8a6650], [-68, Y0 - 12.5, 0.2, 0x6d7178], [-79, Y0 + 3.6, 0.26, 0x7c8187],
  [-92, Y0 - 7.3, 0.22, 0x8a6650], [-36, Y0 - 24.4, 0.24, 0x6d7178], [-2, Y0 - 38.5, 0.2, 0x8a6650],
];

const COLLIDERS: ColliderDesc[] = [];
/** the crossings' collision (deck slabs following each deck, rail walls, the gate's posts); filled by `buildWell` */
export function crossingColliders(): readonly ColliderDesc[] { return COLLIDERS; }

/** a string of paper lanterns on a sagging wire from a to b, one every `spacing` m */
function lanternLine(ctx: Ctx, k: Kit, a: Vector3, b: Vector3, spacing: number): void {
  const len = a.distanceTo(b);
  const n = Math.max(2, Math.round(len / spacing));
  const sag = len * 0.06;
  const at = (t: number): Vector3 => a.clone().lerp(b, t).add(new Vector3(0, -sag * 4 * t * (1 - t), 0));
  for (let i = 0; i < n; i++) k.beam(at(i / n), at((i + 1) / n), 0.025, 0.025, { wash: 0x2a2c31, line: 0.5 });
  for (let i = 1; i < n; i++) { const p = at(i / n); ctx.lantern(p.x, p.y - 0.15, p.z, 0.62); }
}

export function buildMid(plan: WellPlan): void {
  const ctx = plan.ctx;
  const rng = new Rng(157);
  COLLIDERS.length = 0;
  // ── the run north's walls and the stub, top to bottom, stair flights down their fronts ──
  const KX = bandKits(ctx, 'x');
  plan.band('stub', DECK_TOP, LOW, 853, KX, LOW - 40, 2);
  plan.band('west-x', DECK_TOP, LOW, 857, KX, LOW - 40, 7);
  plan.band('east-x', DECK_TOP, LOW, 863, KX, LOW - 40, 7);
  plan.band('north', DECK_TOP, LOW, 877, KX, LOW - 40, 2);

  // ── the crossings (their ends at the gallery fronts: the rim's, this region's and the lower levels' bands) ──
  const KC = bandKits(ctx, 'c');
  CROSSINGS.forEach((c, i) => {
    const [fw, fe] = plan.fronts(c.z, c.y);
    const [tw, te] = plan.fronts(c.z, c.y + FLOOR_H);
    const [aw, ae] = plan.frontsMax(c.z - c.w / 2, c.z + c.w / 2, c.y - archDrop(c.kind, fe - fw) * 0.6);
    const kx = ctx.kitx(`well-c-${c.kind === 'gate' ? `gate${i}` : 'x'}`);
    const k = c.kind === 'gate' ? ctx.kit(`well-c-gate${i}`) : KC.kit(c.y);
    const lod = lodAt((fw + fe) / 2, c.y, c.z);
    const anchor = c.z === ANCHOR.z && c.y === ANCHOR.y;
    // (far walkers are a ~220-triangle LOD: the far crossings carry twice the plan's people, so each rung has its crowd)
    const crowd = anchor || lod >= 1 ? c.crowd * 2 : c.crowd;
    COLLIDERS.push(...bridge(ctx, k, KC.alpha(c.y), kx, {
      kind: c.kind, z: c.z, y: c.y, x0: fw, x1: fe, w: c.w, seed: 9000 + i * 17, crowd, lod,
      ax0: Math.max(fw, aw), ax1: Math.min(fe, ae), top0: Math.max(fw, tw), top1: Math.min(fe, te),
      ...(anchor ? { clear: ANCHOR.x } : {}),
    }));
  });
  // ── the nets between the gallery fronts ──
  NETS.forEach(([z0, z1, y], i) => {
    const [fw, fe] = plan.frontsMax(z0, z1, y);
    const sag = Math.min(2.4, (fe - fw) * 0.14);
    net(KC.kit(y), KC.alpha(y), fw + 0.15, fe - 0.15, Math.min(z0, z1), Math.max(z0, z1), y, sag, 300 + i * 7);
    // a net-mender in the belly of a few (the targets' nets carry people)
    if (i % 4 === 0 && lodAt((fw + fe) / 2, y, z0) < 2) stand(ctx, new Vector3((fw + fe) / 2 + rng.range(-1.5, 1.5), y - sag * 0.93, (z0 + z1) / 2), rng.chance(0.5) ? new Vector3(1, 0, 0) : new Vector3(0, 0, 1), 1);
  });
  // ── the gondola: its cable pair and the two stations off the walls ──
  const ck = KC.kit(CABLE.y);
  for (const dz of [-0.9, 0.9]) ck.beam(new Vector3(CABLE.x0 + 1, CABLE.y, CABLE.z + dz), new Vector3(CABLE.x1 - 1, CABLE.y + 0.8, CABLE.z + dz), 0.06, 0.06, { wash: 0x1d1e22, line: 0.6 });
  ck.beam(new Vector3(CABLE.x0 + 1, CABLE.y + 0.02, CABLE.z), new Vector3(CABLE.x1 - 1, CABLE.y + 0.82, CABLE.z), 0.07, 0.07, { wash: 0x1d1e22, line: 0.6 });
  station(ctx, ck, CABLE.x0, CABLE.x0 + 5.2, CABLE.z, CABLE.y + 1.4, 1, CABLE.y);
  station(ctx, ck, CABLE.x1 - 5.2, CABLE.x1, CABLE.z, CABLE.y + 2.2, -1, CABLE.y + 0.8);

  // ── the far signs and hooks ──
  const hk = ctx.kit('well-c-signs', true);
  const south = new Vector3(0, 0, 1);
  for (const [text, col, side, z, y, size] of HERO) {
    const [fw, fe] = plan.fronts(z, snapFloor(y));
    const w = size * 1.36;
    const x = side === 'W' ? fw + 0.35 + w / 2 : fe - 0.35 - w / 2;
    ctx.signs.place({ at: new Vector3(x, y, z), normal: south, size, spec: { text, color: hex(col), vertical: true, style: 'tube' }, blade: true }, null);
    const top = y + (size * (Array.from(text).length + 0.62)) / 2 + 0.2;
    hk.beam(new Vector3(side === 'W' ? fw - 0.3 : fe + 0.3, top, z), new Vector3(side === 'W' ? x + w / 2 + 0.1 : x - w / 2 - 0.1, top, z), 0.1, 0.1, { wash: 0x2e3036, line: 0.8 });
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
    ctx.signs.place({ at: new Vector3(onW ? fw + 0.3 + w / 2 : fe - 0.3 - w / 2, y, z), normal: south, size, spec: { text: rng.pick(WORDS), color: hex(rng.pick(NEONS)), vertical: true, style: rng.chance(0.85) ? 'tube' : 'box' }, blade: true, flicker: rng.chance(0.06) ? rng.next() : 0 }, hk);
  }
  for (const [side, z, y] of [['E', -60, Y0 + 7.8], ['W', -72, Y0 + 1.8], ['E', -84, Y0 - 7.2], ['W', -54, Y0 - 13.2], ['E', -40, Y0 - 25.2]] as const) {
    const [fw, fe] = plan.fronts(z, snapFloor(y));
    dragonHook(hk, ctx, new Vector3(side === 'W' ? fw - 0.1 : fe + 0.1, y, z), new Vector3(side === 'W' ? 1 : -1, 0, 0), 0.9);
  }
  // ── what is strung across the gap: pipes, lantern strings, laundry lines and cable bundles ──
  for (const [z, y, r, col] of PIPES) {
    const [fw, fe] = plan.frontsMax(z - r, z + r, snapFloor(y));
    const k = KC.kit(y);
    k.beam(new Vector3(fw - 0.2, y, z), new Vector3(fe + 0.2, y, z), r * 2, r * 2, { wash: col, line: 0.8 });
    for (const x of [fw + 0.5, fe - 0.5]) k.box(x, y - r - 0.05, z, 0.14, 2 * r + 0.1, 0.5, { wash: 0x3a3d44, line: 0.8 });
  }
  const KL = ctx.kit('well-c-strings');
  for (let i = 0; i < 8; i++) {
    const ext = i % 3 !== 0;
    const z = ext ? rng.range(EXT.z0 + 3, EXT.z1 - 1) : rng.range(WELL.z0 + 2, WELL.z1 - 14);
    const floor = Y0 - FLOOR_H * rng.int(ext ? -6 : 1, 9);
    const [fw, fe] = plan.fronts(z, floor);
    const ya = floor + rng.range(2.2, 2.6);
    lanternLine(ctx, KL, new Vector3(fw + 0.1, ya, z), new Vector3(fe - 0.1, ya + rng.range(-0.8, 0.8), z + rng.range(-2, 2)), 3.2);
  }
  for (let i = 0; i < 14; i++) {
    const ext = i % 2 === 1;
    const z = ext ? rng.range(EXT.z0 + 3, EXT.z1 - 1) : rng.range(WELL.z0 + 2, WELL.z1 - 12);
    const floor = Y0 - FLOOR_H * rng.int(ext ? -7 : 2, 12);
    const [fw, fe] = plan.fronts(z, floor);
    const ya = floor + rng.range(1.9, 2.5);
    spanStreet(ctx.fd, new Vector3(fw + 0.1, ya, z), new Vector3(fe - 0.1, ya + rng.range(-1.2, 1.2), z + rng.range(-3, 3)), Math.floor(rng.next() * 1e6));
  }
  skyCables(ctx, KL, rng);
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
