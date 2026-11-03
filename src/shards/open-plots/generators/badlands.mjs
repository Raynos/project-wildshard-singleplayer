// OP21 (OPEN-PLOTS wave B, G978): Fossil Badlands' tile vocabulary, after round 75's board
// (art/grid/round-75-new-plot-palettes/06-fossil-badlands.jpg). The shared letters are Night Market's builders (plaza and
// forecourts, retinted by the layout's palette: lavender flagstones, lit lanterns at the blue hour); five theme tiles are
// the dig's own, each a paved border meeting any neighbour ('pppp'):
//   M mesa:    a stepped L of oxblood, mustard and cream strata wrapping the tile's north-west corner (the plot's corners);
//   A camp:    two rows of canvas dig tents facing a yard of sorting tables (the `dig` family's variants 0 and 2);
//   D trench:  a roped-off dig pit in oxblood earth, a string grid over its floor, a hand crane (variant 1) at its south end
//              hoisting a bone bundle off a heap;
//   W sump:    a trench whose north end has flooded, a shallow pool of water in the pit (the plot's water);
//   F fossil:  a trench with a great skeleton half dug out of its floor: a spine, standing ribs and a skull.
// The avenues carry mine-cart rails and lit lanterns from the plaza to the road entries. Every model is a kit family (dig,
// lanterns, stalls...), placed only when the layout's kit has it. A lavender blue hour: lanterns lit, fireflies over the
// digs and camps (bar 7).
import { HALF, INNER, pool } from './kit.mjs';
import { nightMarketBuilders } from './nightMarket.mjs';

/** Life (bar 7): a firefly, a 12 cm mover the glow graph wanders and blinks (Night Market's mover: Glow with no green or
 *  blue, its red the seed in [0, 0.5)) */
let seeds = 0;
function firefly(w, x, y, z) {
  seeds++;
  const c = [((seeds * 0.6180339887) % 1) * 0.5, 0, 0], s = 0.12;
  const top = [x, y + s * 1.4, z], a = [x - s, y - s, z - s], b = [x + s, y - s, z - s], d = [x, y - s, z + s * 1.4];
  w.tri('Glow', top, b, a, c); w.tri('Glow', top, d, b, c); w.tri('Glow', top, a, d, c); w.tri('Glow', a, b, d, c);
}

/** A lit lantern on a post (the kit's post lantern, its model emitting the bake's light), its collider and pool. */
function lamp(w, p, x, z, yaw = 0) {
  if (w.hasModel('lanterns')) w.placeModel('lanterns', 0, x, z, { height: 2.8, yaw });
  else {
    w.lanternEmitter?.([x, 3.2, z], [...p.lantern]);
    w.sides('Kit', [x - 0.09, 0, z - 0.09], [x + 0.09, 2.8, z + 0.09], p.timber ?? p.wood);
    w.box('Glow', [x - 0.3, 2.8, z - 0.3], [x + 0.3, 3.5, z + 0.3], p.lantern, p.lantern);
  }
  w.solid([x - 0.12, 0, z - 0.12], [x + 0.12, 2.8, z + 0.12]);
  pool(w, x, z, 4.5, p.pool);
}

/** A dig model (the `dig` family's variant) at (x, z) and `y`, turned `yaw`. */
function dig(w, variant, x, z, yaw = 0, y = 0) {
  if (w.hasModel('dig')) w.placeModel('dig', variant, x, z, { yaw, y });
}

/** A canvas tent (variant 0) at (x, z), its door toward +z (`yaw` 0) or -z (pi), its collider and its lantern's pool. */
function tent(w, p, x, z, yaw) {
  dig(w, 0, x, z, yaw);
  w.solid([x - 2.6, 0, z - 2.1], [x + 2.6, 2.7, z + 2.1]);
  pool(w, x, z + Math.cos(yaw) * 3.4, 4, p.pool);
}

/** A sorting table with its crates (variant 2) at (x, z), and its collider. */
function table(w, x, z) {
  dig(w, 2, x, z);
  w.solid([x - 1.5, 0, z - 0.6], [x + 2.7, 1.4, z + 0.6]);
}

/** A heap of dug bones: a faceted six-sided cone of radius `r` at (x, y, z). */
function heap(w, p, x, y, z, r) {
  const top = [x, y + r * 0.6, z];
  for (let i = 0; i < 6; i++) {
    const a0 = i / 6 * Math.PI * 2, a1 = (i + 1) / 6 * Math.PI * 2;
    w.tri('Kit', top, [x + r * Math.sin(a1), y, z + r * Math.cos(a1)], [x + r * Math.sin(a0), y, z + r * Math.cos(a0)], p.bone);
  }
}

/** A rib standing out of the ground: a semicircular arc of radius `r` in the (y, z) plane at x, its foot sunk `sink`
 *  below y, 0.35 m deep and 0.3 m wide. */
function rib(w, p, x, y, z, r, sink = 0.3) {
  const n = 6, t = 0.35, hw = 0.15, cy = y - r * sink;
  const at = (a, radius, dx) => [x + dx, cy + radius * Math.sin(a), z + radius * Math.cos(a)];
  for (let i = 0; i < n; i++) {
    const a0 = i / n * Math.PI, a1 = (i + 1) / n * Math.PI;
    w.quad('Kit', at(a0, r, -hw), at(a1, r, -hw), at(a1, r, hw), at(a0, r, hw), p.bone);
    w.quad('Kit', at(a0, r - t, hw), at(a1, r - t, hw), at(a1, r - t, -hw), at(a0, r - t, -hw), p.bone);
    w.quad('Kit', at(a0, r - t, -hw), at(a1, r - t, -hw), at(a1, r, -hw), at(a0, r, -hw), p.bone);
    w.quad('Kit', at(a0, r, hw), at(a1, r, hw), at(a1, r - t, hw), at(a0, r - t, hw), p.bone);
  }
}

/** every trench's pit (x0, z0, x1, z1, tile-local) and its depth; the layout's paving leaves it open (`water`) */
const PIT = [-15, -11, 15, 11], DEPTH = 1.4;
/** the sump's flooded north end of the pit, and its water's level below the paving */
const SUMP = [-14, 3, 14, 10], SUMP_LEVEL = -1.05;

/** A dig pit: oxblood earth below the paving, its walls banded mustard over oxblood (walked with the pit on their left so
 *  they face in), a cream coping, a string grid over its floor, a roped fence round it and a 2 m collider at the fence
 *  (nobody walks over the open pit), a lit lantern at each corner. */
function pit(w, p) {
  const [x0, z0, x1, z1] = PIT, mid = -DEPTH * 0.45;
  w.floor('Kit', x0, z0, x1, z1, -DEPTH, p.pit);
  for (const [xa, za, xb, zb] of [[x0, z1, x0, z0], [x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1]]) {
    w.quad('Kit', [xa, -DEPTH, za], [xb, -DEPTH, zb], [xb, mid, zb], [xa, mid, za], p.strataRed);
    w.quad('Kit', [xa, mid, za], [xb, mid, zb], [xb, 0, zb], [xa, 0, za], p.strataGold);
  }
  for (const [a, b] of [[[x0 - 0.6, z0 - 0.6], [x1 + 0.6, z0]], [[x0 - 0.6, z1], [x1 + 0.6, z1 + 0.6]], [[x0 - 0.6, z0], [x0, z1]], [[x1, z0], [x1 + 0.6, z1]]]) {
    w.box('Kit', [a[0], 0, a[1]], [b[0], 0.15, b[1]], p.strataCream);
  }
  for (let x = x0 + 5; x < x1; x += 5) w.floor('Kit', x - 0.05, z0, x + 0.05, z1, -DEPTH + 0.02, p.rope);
  for (let z = z0 + 5.5; z < z1; z += 5.5) w.floor('Kit', x0, z - 0.05, x1, z + 0.05, -DEPTH + 0.02, p.rope);
  const fx0 = x0 - 0.9, fz0 = z0 - 0.9, fx1 = x1 + 0.9, fz1 = z1 + 0.9;
  for (let x = fx0; x <= fx1 + 0.01; x += (fx1 - fx0) / 8) for (const z of [fz0, fz1]) w.sides('Kit', [x - 0.07, 0, z - 0.07], [x + 0.07, 1.1, z + 0.07], p.timber);
  for (let z = fz0 + (fz1 - fz0) / 6; z < fz1 - 0.01; z += (fz1 - fz0) / 6) for (const x of [fx0, fx1]) w.sides('Kit', [x - 0.07, 0, z - 0.07], [x + 0.07, 1.1, z + 0.07], p.timber);
  for (const [a, b] of [[[fx0, fz0], [fx1, fz0]], [[fx0, fz1], [fx1, fz1]], [[fx0, fz0], [fx0, fz1]], [[fx1, fz0], [fx1, fz1]]]) {
    w.box('Kit', [a[0] - 0.03, 0.85, a[1] - 0.03], [b[0] + 0.03, 0.9, b[1] + 0.03], p.rope);
    w.solid([a[0] - 0.15, 0, a[1] - 0.15], [b[0] + 0.15, 2, b[1] + 0.15]);
  }
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) lamp(w, p, sx * (x1 + 3), sz * (z1 + 3));
}

/** D trench: the pit, a hand crane at its south end over a bone heap (the side by `variant`), bones on the floor, two
 *  sorting tables north of it. */
function trench(w, p, variant) {
  pit(w, p);
  const side = variant % 2 === 0 ? 1 : -1, cx = side * 5;
  dig(w, 1, cx, -6, 0, -DEPTH);
  heap(w, p, cx + 1.85, -DEPTH, -6, 1.6);
  heap(w, p, -cx * 1.4, -DEPTH, 4, 1.2);
  for (const [x, z, r] of [[-side * 2, -1, 1.8], [side * 9, 5, 1.4]]) rib(w, p, x, -DEPTH, z, r, 0.5);
  table(w, -8, 18); table(w, 6, 19);
  for (const [x, y, z] of [[-6, 2.5, 0], [8, 3.4, -5], [2, 2.8, 16]]) firefly(w, x, y, z);
}

/** W sump: the pit with its north end flooded to a shallow pool, a bone heap on the dry end, a tent beside it. */
function sump(w, p, variant) {
  pit(w, p);
  const [x0, z0, x1, z1] = SUMP;
  w.floor('Water', x0, z0, x1, z1, SUMP_LEVEL, p.water);
  heap(w, p, variant % 2 === 0 ? -6 : 6, -DEPTH, -6, 1.8);
  rib(w, p, variant % 2 === 0 ? 7 : -7, -DEPTH, -5, 1.6, 0.5);
  tent(w, p, variant % 2 === 0 ? 14 : -14, 19, Math.PI);
  table(w, variant % 2 === 0 ? -10 : 6, 18);
  for (const [x, y, z] of [[-9, 1.2, 6], [4, 1.6, 7], [10, 1.0, 5], [-3, 2.6, -14]]) firefly(w, x, y, z);
}

/** F fossil: a pit with a great skeleton half dug out of its floor along x: a spine of vertebrae, standing ribs either
 *  side of it, a skull at its east end, a crane over its middle. */
function fossil(w, p, variant) {
  pit(w, p);
  const y = -DEPTH;
  for (let x = -12; x <= 9; x += 1.4) {
    const h = 0.5 + 0.5 * Math.exp(-(((x + 2) / 6) ** 2));
    w.box('Kit', [x - 0.45, y, -0.35], [x + 0.45, y + h, 0.35], p.bone);
  }
  for (let x = -7; x <= 3; x += 2) rib(w, p, x, y, 0, 3.6 - Math.abs(x + 2) * 0.25, 0.35);
  w.box('Kit', [10, y, -1.4], [13.4, y + 1.6, 1.4], p.bone);
  w.box('Kit', [13.4, y, -0.9], [14.6, y + 0.8, 0.9], p.bone);
  dig(w, 1, variant % 2 === 0 ? -9 : 7, 6, 0, -DEPTH);
  table(w, -6, -18); table(w, 7, -19);
  for (const [x, y2, z] of [[-4, 3, 2], [6, 2.2, -3], [-10, 2.6, -16]]) firefly(w, x, y2, z);
}

/** M mesa: three stepped strata tiers in an L round the tile's north-west corner (tile -x, +z), each tier two 2.5 m bands of
 *  the oxblood, mustard and cream strata, a bone heap and a lantern at its inner corner. */
function mesa(w, p) {
  const bands = [p.strataRed, p.strataGold, p.strataCream];
  for (let k = 0; k < 3; k++) {
    const wide = [20, 13.5, 7][k], reach = INNER - 3 - 7 * k;
    // the arms along the north and west edges, meeting at the corner without overlap
    for (const [lo, hi] of [[[-INNER, INNER - wide], [reach, INNER]], [[-INNER, -reach], [-INNER + wide, INNER - wide]]]) {
      for (let band = 0; band < 2; band++) {
        const y0 = 5 * k + 2.5 * band, colour = bands[(2 * k + band) % 3];
        if (band === 0) w.sides('Kit', [lo[0], y0, lo[1]], [hi[0], y0 + 2.5, hi[1]], colour);
        else w.box('Kit', [lo[0], y0, lo[1]], [hi[0], y0 + 2.5, hi[1]], colour, bands[(2 * k + 2) % 3]);
      }
      w.solid([lo[0], 5 * k, lo[1]], [hi[0], 5 * k + 5, hi[1]]);
    }
  }
  heap(w, p, 8, 0, -8, 2);
  lamp(w, p, 14, -14);
  for (const [x, y, z] of [[4, 2.2, -12], [12, 3, -4]]) firefly(w, x, y, z);
}

/** A camp: three tents along the tile's north edge facing south, three along its south edge facing north, sorting tables
 *  and a bone heap in the yard between them, two lanterns. */
function camp(w, p, variant) {
  for (const x of [-16, 0, 16]) { tent(w, p, x, 16, Math.PI); tent(w, p, x, -16, 0); }
  for (const x of variant % 2 === 0 ? [-14, 9] : [-11, 12]) table(w, x, 0);
  heap(w, p, variant % 2 === 0 ? 0 : -2, 0, 1, 1.4);
  for (const x of [-6, 6]) lamp(w, p, x, variant % 2 === 0 ? 5 : -5);
  for (const [x, y, z] of [[-8, 2.4, 8], [10, 3, -7], [2, 2, -4]]) firefly(w, x, y, z);
}

/** where an avenue's lanterns stand (plot metres from the plaza along it, either side of the lane), clear of the plaza's
 *  perimeter lane at 62.5 m (the walk route's ring) and short of the road entry's 15 m footprint; the rails run from the
 *  plaza's edge to the entry */
const LAMPS = [82, 112, 142, 172, 202], RAILS = [66, 232];

/** One of the four avenues from a road entry to the skeleton (the seams on x = 0 and z = 0), as round 75's road entry
 *  lines it: a pair of mine-cart rails on sleepers either side of the lane's middle, a lit lantern either side at each of
 *  LAMPS. `along(u, off)` is the seam's tile-local point. */
function avenue(w, p, side, centre) {
  const along = (u, off) => (side === 0 ? [u, HALF + off] : [HALF + off, -u]);
  const distance = u => Math.abs(side === 0 ? centre[0] + u : centre[1] - u);
  // the seam's points (u) whose distance along the avenue is one of `list`, on either side of the plaza
  const at = list => list.flatMap(r => [r, -r]).map(r => (side === 0 ? r - centre[0] : centre[1] - r)).filter(u => u >= -HALF && u < HALF);
  const run = [];
  for (let u = -HALF; u < HALF; u += 1.25) if (distance(u) >= RAILS[0] && distance(u + 1.25) >= RAILS[0] && distance(u) <= RAILS[1] && distance(u + 1.25) <= RAILS[1]) run.push(u);
  if (run.length > 0) {
    const u0 = run[0], u1 = (run.at(-1) ?? u0) + 1.25;
    for (const track of [-2.2, 2.2]) {
      for (let u = u0 + 0.3; u < u1; u += 1.25) {
        const [ax, az] = along(u, track - 0.75), [bx, bz] = along(u + 0.35, track + 0.75);
        w.floor('Kit', Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz), 0.04, p.sleeper);
      }
      for (const rail of [-0.5, 0.5]) {
        const [ax, az] = along(u0, track + rail - 0.05), [bx, bz] = along(u1, track + rail + 0.05);
        w.box('Kit', [Math.min(ax, bx), 0.04, Math.min(az, bz)], [Math.max(ax, bx), 0.14, Math.max(az, bz)], p.rail);
      }
    }
  }
  for (const u of at(LAMPS)) for (const off of [-5.5, 5.5]) { const [x, z] = along(u, off); lamp(w, p, x, z); }
}

/** A lane seam: the shared builders' strings and banners, and on the four avenues the rails and lanterns. */
function digLane(shared) {
  return (w, p, side, centre, ...rest) => {
    shared?.(w, p, side, centre, ...rest);
    if ((side === 0 ? centre[1] : centre[0]) + HALF === 0) avenue(w, p, side, centre);
  };
}

/** The far stand-ins (RM11): the pits as oxblood rectangles, the mesas as banded blocks, the camps as canvas blocks. */
function farDig(w, p, type) {
  w.floor('far', -HALF, -HALF, HALF, HALF, 0, p.paving);
  if (type === 'M') {
    for (let k = 0; k < 3; k++) {
      const wide = [20, 13.5, 7][k], reach = INNER - 3 - 7 * k, colour = [p.strataRed, p.strataGold, p.strataCream][k];
      w.box('far', [-INNER, 5 * k, INNER - wide], [reach, 5 * k + 5, INNER], colour);
      w.box('far', [-INNER, 5 * k, -reach], [-INNER + wide, 5 * k + 5, INNER - wide], colour);
    }
    return;
  }
  if (type === 'A') { for (const z of [16, -16]) w.box('far', [-18.6, 0, z - 2], [18.6, 2.4, z + 2], p.canvas); return; }
  const [x0, z0, x1, z1] = PIT;
  w.floor('far', x0, z0, x1, z1, 0.04, p.pit);
  if (type === 'W') w.floor('far', SUMP[0], SUMP[1], SUMP[2], SUMP[3], 0.06, p.water);
}

const THEME = {
  M: { build: mesa, far: (w, p) => farDig(w, p, 'M'), sockets: 'pppp' },
  A: { build: camp, far: (w, p) => farDig(w, p, 'A'), sockets: 'pppp' },
  D: { build: trench, far: (w, p) => farDig(w, p, 'D'), sockets: 'pppp', water: [PIT] },
  W: { build: sump, far: (w, p) => farDig(w, p, 'W'), sockets: 'pppp', water: [PIT] },
  F: { build: fossil, far: (w, p) => farDig(w, p, 'F'), sockets: 'pppp', water: [PIT] },
};

/** The dig's builders: a layout's shared letters (Night Market's kinds, `layout.builders`) plus M, A, D, W and F, and lane
 *  seams that run the avenues' rails and lanterns. */
export function fossilBadlandsBuilders(letters) {
  const shared = nightMarketBuilders(letters);
  for (const letter of Object.keys(THEME)) if (Object.hasOwn(shared.tiles, letter)) throw new Error(`fossil-badlands: letter ${letter} is a theme tile`);
  return { tiles: { ...shared.tiles, ...THEME }, coarseFamilies: new Set([...shared.coarseFamilies, 'dig']), seam: digLane(shared.seam) };
}

/** Hooks at the generic construction points (tiledPlotCore.mjs): the skeleton stands alone in its raised pit on the
 *  plaza, a warm pool of light under it. */
export const fossilBadlandsPlot = {
  builders: layout => fossilBadlandsBuilders(layout.builders),
  lanternBake: { gain: 0.8, radius: 1.5, cut: 3 },
  ringInKit: true,
  models() { return undefined; },
  pools(parts, palette) {
    const lit = { Pool: parts.Pool }, plotWriter = { triColours: (part, a, b, c, colours) => lit[part].triColours(part, [a, b, c], colours) };
    pool(plotWriter, 0, 0, 24, palette.gatePool, 0.05);
  },
};
