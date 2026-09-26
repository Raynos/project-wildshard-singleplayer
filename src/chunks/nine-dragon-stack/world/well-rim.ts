// The Yamen Well's rim and near galleries (dome C → domes B1 / D1, E169): where the mockup B / D cameras stand and
// what they look over. The south ledge at the square's datum with dome B's carved balustrade on its lip, the shops and
// towers above the rim on its south and west sides, and the main shaft's galleries from the rim down to SPLIT + 3 m:
// deep timber verandas on the west, shallower ones under the square's lip on the east, balconies under the ledge on
// the south, their hero signs and the brass hooks the Fei Zhua bites.
import { Vector3 } from 'three';
import { dressWall } from './facade/grammar';
import { K, type Kit } from './kit';
import { WELL, Y0 } from '../layout';
import { dragonHook, stool } from './props';
import { relief } from './gate';
import { placeLion } from './props3d';
import type { KitX } from './hero/kitx';
import { NEON, Rng } from '../util';
import { NEONS, WORDS } from './towers';
import { SURF } from '../look/paint';
import { FLOOR_H, pentRoof, stand, win } from './well-galleries';
import { type BandKits, RIM, SPLIT, type WellPlan, snapFloor } from './well-plan';

const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

/** the near hero signs, big and legible from the rim: text, colour, side (W / E wall), z, height, size */
const HERO: readonly [string, number, 'W' | 'E', number, number, number][] = [
  ['麵', NEON.magenta, 'W', -26, Y0 - 4, 1.55], ['牙科', NEON.cyan, 'W', -10, Y0 - 12, 1.4], ['火鍋', NEON.red, 'W', 2, Y0 - 18, 1.35],
  ['藥房', NEON.magenta, 'W', -38, Y0 - 9, 1.2], ['麻雀', NEON.jade, 'W', -2, Y0 - 26, 1.1],
  ['火鍋', NEON.red, 'E', -32, Y0 - 6, 1.45], ['茶', NEON.amber, 'E', -17, Y0 - 12, 1.5], ['旅館', NEON.jade, 'E', -4, Y0 - 22, 1.3],
  ['九龍', NEON.red, 'E', -8, Y0 - 4.5, 1.3],
];

/** the brass dragon hooks on the near gallery corners (the mockup cameras' two first: shots.ts hookNear) */
const HOOKS: readonly ['W' | 'E', number, number][] = [['E', -24, Y0 - 2.2], ['E', -6, Y0 - 11.2], ['W', -20, Y0 + 1.6], ['W', -2, Y0 - 7.2], ['E', -40, Y0 - 20.2], ['W', -36, Y0 - 14.2]];

export function buildRim(plan: WellPlan): void {
  const ctx = plan.ctx;
  const rng = new Rng(57);
  // ── the south ledge at the datum, its balustrade, lanterns and people (the viewpoint x −16…−5 kept clear) ──
  const rim = ctx.kit('well-rim', true);
  rim.box((WELL.x0 + WELL.x1) / 2, Y0 - 0.7, (RIM.z0 + RIM.z1) / 2, WELL.x1 - WELL.x0, 0.7, RIM.z1 - RIM.z0, { wash: 0x8e939b, line: 2 }, { top: { wash: 0x5a5d64, kind: K.flag, wet: 0.8, line: 0 } });
  rimBalustrade(ctx.kitx('well-rim'), rim);
  // people along it: some leaning on the balustrade looking into the shaft, some walking past the shops
  // (the leaners keep clear of the two shared mockup cameras: B at x −19.5, D at x −14, both on z 11.2…12.5)
  for (let x = WELL.x0 + 1.5; x < WELL.x1 - 1; x += rng.range(1.6, 3.4)) {
    const viewpoint = x > -21 && x < -7;
    if (rng.chance(0.45)) { if (!viewpoint) stand(ctx, new Vector3(x, Y0, RIM.z0 + rng.range(0.5, 0.8)), new Vector3(rng.range(-0.3, 0.3), 0, -1), rng.range(0.94, 1.04)); }
    else if (rng.chance(0.35)) stand(ctx, new Vector3(x, Y0, rng.range(RIM.z0 + 2.2, RIM.z1 - 1.2)), new Vector3(rng.chance(0.5) ? 1 : -1, 0, 0), rng.range(0.94, 1.04));
  }
  // a lantern string sagging along the ledge from the building face's brackets, and a lamp at each end
  const LZ = RIM.z0 + 2.6;
  const cab = ctx.kit('well-rim');
  const sagAt = (t: number): Vector3 => new Vector3(WELL.x0 + 0.6 + (WELL.x1 - WELL.x0 - 1.2) * t, Y0 + 3.7 - Math.sin(t * Math.PI * 3) ** 2 * 0.55, LZ);
  for (let i = 0; i < 36; i++) cab.beam(sagAt(i / 36), sagAt((i + 1) / 36), 0.03, 0.03, { wash: 0x1d1e22, line: 0.5 });
  for (let t = 0.02; t < 0.99; t += 0.034) {
    const p = sagAt(t);
    ctx.lantern(p.x, p.y - 0.05, p.z, 0.62);
  }
  for (const x of [WELL.x0 + 0.6, (WELL.x0 + WELL.x1) / 3, WELL.x1 - 0.6]) cab.beam(new Vector3(x, Y0 + 3.9, RIM.z1), new Vector3(x, Y0 + 3.7, LZ), 0.06, 0.06, { wash: 0x2a2c31, line: 0.7 });
  // ── the towers above the rim on its south and west sides (the square's left edge), dressed by the facade grammar ──
  const up = { gallery: 0.35, timber: 0.75, lit: 0.72, setbacks: false, street: Y0, lod: 0 as const, roof: true, detailY: [Y0, Y0 + 45] as const };
  // (dressed in full up to +45 m over the rim; above that the towers set back 2 m and are painted shells: nobody at the
  // rim or on the square sees their pieces, and the triangles go to the galleries)
  const HI = Y0 + 45;
  dressWall(ctx.fd, new Vector3(WELL.x1 + 0.5, 0, WELL.z1), new Vector3(0, 0, -1), WELL.x1 + 0.5 - WELL.x0, Y0 + FLOOR_H, HI, 70331, { ...up, wash: 0x7c7c80, roof: false });
  dressWall(ctx.fd, new Vector3(WELL.x1 + 0.5, 0, WELL.z1 + 2), new Vector3(0, 0, -1), WELL.x1 + 0.5 - WELL.x0, HI, Y0 + 88, 70333, { ...up, lod: 2, wash: 0x7c7c80 });
  dressWall(ctx.fd, new Vector3(WELL.x0, 0, WELL.z1), new Vector3(1, 0, 0), WELL.z1 - WELL.z0, Y0 + FLOOR_H, HI, 70417, { ...up, wash: 0x737782, roof: false });
  dressWall(ctx.fd, new Vector3(WELL.x0 - 2, 0, WELL.z1), new Vector3(1, 0, 0), WELL.z1 - WELL.z0, HI, Y0 + 95, 70419, { ...up, lod: 2, wash: 0x737782 });
  rimShops(plan, rng);

  // ── the near galleries: the main shaft's three walls from their top floor down to SPLIT + one floor ──
  // (one kit for the whole near band and one for its barred railings / catch nets: the lane's cap is 12 draws)
  const K2: BandKits = { kit: () => ctx.kit('well-r'), alpha: () => ctx.alpha('well-r-a') };
  // Deep: the fronts pulled out into the shaft (west 6.2–8.2 m, east 5.2–7 m before each stack's in-and-out cycle), so
  // from the rim the open gap reads 10–15 m, the verandas converging down the shaft. The west rim floor itself stays
  // shallow (the mockup B camera stands at x −19.5 beside it).
  plan.band('south', Y0, SPLIT + FLOOR_H, 811, K2, undefined, 1);
  plan.band('west', Y0, Y0, 821, K2, undefined, 0, { street: 5.4 });
  plan.band('west', Y0 - FLOOR_H, SPLIT + FLOOR_H, 823, K2, undefined, 3, { depths: { dMin: 6.2, dMax: 8.2 } });
  plan.band('east', Y0, SPLIT + FLOOR_H, 839, K2, undefined, 3, { depths: { dMin: 5.2, dMax: 7 } });

  // ── the hero signs, hung out from the fronts on brackets, facing the rim ──
  const hk = ctx.kit('well-rim', true);
  const south = new Vector3(0, 0, 1);
  for (const [text, col, side, z, y, size] of HERO) {
    const [fw, fe] = plan.fronts(z, snapFloor(y));
    const w = size * 1.36;
    const x = side === 'W' ? fw + 0.35 + w / 2 : fe - 0.35 - w / 2;
    ctx.signs.place({ at: new Vector3(x, y, z), normal: south, size, spec: { text, color: hex(col), vertical: true, style: 'tube' }, blade: true }, null);
    const top = y + (size * (Array.from(text).length + 0.62)) / 2 + 0.2;
    hk.beam(new Vector3(side === 'W' ? fw - 0.3 : fe + 0.3, top, z), new Vector3(side === 'W' ? x + w / 2 + 0.1 : x - w / 2 - 0.1, top, z), 0.1, 0.1, { wash: 0x2e3036, line: 0.8 });
  }
  for (const [side, z, y] of HOOKS) {
    const [fw, fe] = plan.fronts(z, snapFloor(y));
    dragonHook(hk, ctx, new Vector3(side === 'W' ? fw - 0.1 : fe + 0.1, y, z), new Vector3(side === 'W' ? 1 : -1, 0, 0), 0.9);
  }
}

/**
 * The rim's shop row under the south towers (their facade starts one floor up): lit glass fronts, glazed timber canopies
 * on cinnabar posts with lanterns under them, neon and lightbox signs, a table and stools out front, pot plants.
 */
function rimShops(plan: WellPlan, rng: Rng): void {
  const ctx = plan.ctx;
  const k = ctx.kit('well-rim');
  const z = WELL.z1, n = new Vector3(0, 0, -1), u = new Vector3(-1, 0, 0);
  k.quad(new Vector3(WELL.x1 + 0.5, Y0 - 0.02, z - 0.01), u, new Vector3(0, 1, 0), WELL.x1 + 0.5 - WELL.x0, FLOOR_H + 0.02, { wash: 0x6f6a64, line: 1, surf: SURF.concrete, edges: 4 });
  let x = WELL.x1 - 0.3;
  while (x > WELL.x0 + 1.5) {
    const w = Math.min(rng.range(3.4, 4.8), x - WELL.x0 - 0.3);
    const x1 = x, x0 = x - w, cx = (x0 + x1) / 2;
    const wash = rng.pick([0x6f6a64, 0x7a7266, 0x68645e]);
    const open = rng.chance(0.8);
    if (open) win(ctx, rng, new Vector3(cx, Y0 + 0.05, z), u, n, w - 0.7, 2.45, wash, true, 0.95);
    else k.quad(new Vector3(x1 - 0.3, Y0 + 0.02, z - 0.03), u, new Vector3(0, 1, 0), w - 0.6, 2.5, { wash: 0x8d9298, kind: K.tiles, line: 1 });
    // the canopy on two posts, lanterns under its eave
    const tile = rng.pick([0x2b6b55, 0x2c4f82, 0x3d4a52, 0x2b6b55]);
    pentRoof(k, new Vector3(x1, Y0 + 3.35, z - 0.02), new Vector3(x0, Y0 + 3.35, z - 0.02), n, 1.95, 0.62, tile);
    for (const px of [x0 + 0.18, x1 - 0.18]) k.box(px, Y0, z - 1.55, 0.16, 2.78, 0.16, { wash: 0x9c3627, line: 1, accent: true, surf: SURF.lacquer });
    k.box(cx, Y0 + 2.62, z - 1.55, w, 0.16, 0.12, { wash: 0x3a2e26, line: 1 });
    for (const t of [0.3, 0.7]) if (rng.chance(0.8)) ctx.lantern(x0 + w * t, Y0 + 2.5, z - 1.35, 0.78);
    // its sign: a neon word over the canopy on the wall, or a blade hung at a post reading along the rim
    const col = hex(rng.pick(NEONS));
    if (rng.chance(0.55)) ctx.signs.place({ at: new Vector3(cx, Y0 + 4.05, z - 0.08), normal: n.clone(), size: 0.62, spec: { text: rng.pick(WORDS), color: col, vertical: false, style: rng.chance(0.6) ? 'tube' : 'box' } }, k);
    else ctx.signs.place({ at: new Vector3(x1 - 0.18, Y0 + 1.55, z - 2.2), normal: new Vector3(1, 0, 0), size: 0.5, spec: { text: rng.pick(WORDS), color: col, vertical: true, style: 'tube' }, blade: true }, null);
    // out front: a low table and stools, a crate, a pot plant (the viewpoint x −14…−7 at the balustrade stays clear)
    if (open && rng.chance(0.5)) {
      const tx = cx + rng.range(-0.6, 0.6), tz = z - 2.3;
      k.box(tx, Y0, tz, 0.8, 0.66, 0.6, { wash: 0x5a4636, line: 1, surf: SURF.wood });
      for (const [dx, dz] of [[0.65, 0], [-0.65, 0], [0, -0.55]] as const) stool(k, tx + dx, Y0, tz + dz, rng.pick([0x2e5fa3, 0xc23b22, 0x3e5a4a]));
    }
    if (rng.chance(0.5)) ctx.put('plant', new Vector3(rng.chance(0.5) ? x0 + 0.4 : x1 - 0.4, Y0, z - 0.4), n.clone(), new Vector3(1.3, rng.range(1.2, 1.7), 1.3));
    x = x0;
  }
}

/**
 * The rim's carved stone balustrade (石欄杆), waist high (1.1 m) so the mockup D camera leans over it: a plinth, square
 * posts every ~2.4 m with carved faces, caps and lotus-bud finials (stone lions on the two camera posts), a relief-carved
 * panel between each pair on the ledge's side, vase balusters under a heavy rail. The posts stand where the two shared
 * mockup cameras need them: D's lion post at its lower left (x −15.2), B looking over a panel with its lion post at its
 * lower right (x −18.2).
 */
function rimBalustrade(kx: KitX, k: Kit): void {
  const z = RIM.z0, y = Y0;
  const STONE = { wash: 0x5e6066, kind: K.stone, line: 1, wet: 0.3, surf: SURF.concrete } as const;
  const PANEL = { wash: 0x585a60, kind: K.panel, line: 1, wet: 0.25 } as const;
  const X = new Vector3(1, 0, 0), UPV = new Vector3(0, 1, 0), SZ = new Vector3(0, 0, 1);
  // posts every ~2.4 m, set out from the two shared cameras: D (x −14) has its lion post at its lower left (−15.2);
  // B (x −19.5) looks over a panel, its lion post at its lower right (−18.2), the next post at −21.2
  // (and the eight-dome targets' old camera spot, x −10.5, also looks over a panel: posts at −12.4 / −8.8)
  const posts: number[] = [-26.0, -23.6, -21.2, -18.2, -15.2, -12.4, -8.8, -6.4, -4.0, -1.6];
  const LIONS = new Map<number, number>([[-15.2, 0.45], [-18.2, Math.PI]]);
  // the plinth (地栿) the whole length, a heavy ground line on its lip
  k.box((WELL.x0 + WELL.x1) / 2, y, z, WELL.x1 - WELL.x0, 0.2, 0.62, { ...STONE, line: 2 });
  const bays: [number, number][] = [[WELL.x0 + 0.3, posts[0] ?? WELL.x0 + 2]];
  posts.forEach((px, i) => { bays.push([px, posts[i + 1] ?? WELL.x1 - 0.3]); });
  for (const [a, b] of bays) {
    const w = b - a - 0.36, cx = (a + b) / 2;
    if (w < 0.3) continue;
    // the panel (欄板) with its relief on the ledge side, a vase-baluster row over it, the rail (尋杖)
    k.box(cx, y + 0.2, z, w, 0.58, 0.16, PANEL);
    relief(kx, new Vector3(cx, y + 0.49, z + 0.085), X.clone(), UPV.clone(), SZ.clone(), w - 0.16, 0.44, 5100 + Math.round(cx * 7), { wash: 0x68686c, line: 0, wet: 0.35 });
    k.box(cx, y + 0.78, z, w + 0.02, 0.08, 0.2, STONE);
    for (const t of [0.25, 0.75]) k.lathe(a + 0.18 + w * t, y + 0.86, z, [[0.07, 0], [0.1, 0.05], [0.06, 0.1], [0.05, 0.14], [0.08, 0.2]], 8, STONE, false, 0);
    // the rail: a round bar (尋杖), shaded round, not a flat slab seen from the rim
    k.limb(new Vector3(a + 0.18, y + 1.06, z), new Vector3(b - 0.18, y + 1.06, z), 0.085, 0.085, 10, STONE, 0, true);
  }
  for (const px of posts) {
    // the post (望柱): a carved shaft, a cap, a lotus bud (a lion goes on the camera posts once dome B's is callable)
    k.box(px, y + 0.2, z, 0.36, 0.94, 0.36, { ...PANEL, line: 1 });
    k.box(px, y + 1.14, z, 0.44, 0.1, 0.44, STONE);
    const lion = LIONS.get(px);
    // a TRELLIS stone lion on the camera posts (dome B's lion draw), a lotus bud on the rest
    if (lion !== undefined) placeLion(px, y + 1.24, z, lion, 1);
    else k.lathe(px, y + 1.24, z, [[0.2, 0], [0.23, 0.05], [0.17, 0.09], [0.19, 0.15], [0.18, 0.22], [0.13, 0.3], [0.06, 0.37], [0.0, 0.41]], 12, STONE, true, 0);
  }
}
