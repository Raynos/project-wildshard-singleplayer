// OP7 (OPEN-PLOTS wave A, G978): Patchwork Fairground's tile vocabulary, after round 75's board
// (art/grid/round-75-new-plot-palettes/03-patchwork-fairground.jpg). The shared letters are Night Market's builders (plaza,
// gardens and forecourts, retinted by the layout's palette: sand paving, striped stalls); three theme tiles are the fair's
// own, each a paved border meeting any neighbour ('pppp'):
//   Q quilt:    a 3 x 3 patchwork of mustard, lavender and clover field squares between box hedges, hay bales on two;
//   K carousel: the carousel (the `fair` family's variant 0) on a clover lawn in a ring of box hedges, a sunken pool either
//               side, lamps at its corners;
//   T big top:  the striped big top (variant 1) on a lawn, its door toward the tile's north edge, hay bales and lamps round it.
// The avenues are lined with striped booths (the kit's stalls), a helter-skelter (variant 2) either side at the road entry. Every model is a kit family (fair,
// lanterns, trees, stalls), placed only when the layout's kit has it. A fresh morning: no fireflies, no lanterns lit by day;
// birds drift over the fields and carousels (bar 7).
import { HALF, INNER, pool } from './kit.mjs';
import { nightMarketBuilders } from './nightMarket.mjs';

/** The shared builders' fireflies (Glow with no green or blue, red in [0, 0.5)) blink to black, specks by day: a fair
 *  tile's writer drops them and keeps everything else (coral.mjs's noon writer) */
const noFireflies = (w) => new Proxy(w, { get: (target, key) => key === 'tri'
  ? (part, a, b, c, colour, ...rest) => (part === 'Glow' && colour?.[1] === 0 && colour?.[2] === 0 && colour[0] < 0.5 ? undefined : target.tri(part, a, b, c, colour, ...rest))
  : (typeof target[key] === 'function' ? target[key].bind(target) : target[key]) });

/** Life (bar 7): a bird, a 0.6 m mover in the glow graph's steady mode (red seed in [0.5, 1), no green: drifting slowly,
 *  never blinking to black) at full blue, which the graph lights white (Coral's gull, coral.mjs), high over the fields */
let seeds = 0;
function bird(w, x, y, z) {
  seeds++;
  const c = [((seeds * 0.6180339887) % 1) * 0.5 + 0.5, 0, 1], s = 0.6;
  const top = [x, y + s * 1.4, z], a = [x - s, y - s, z - s], b = [x + s, y - s, z - s], d = [x, y - s, z + s * 1.4];
  w.tri('Glow', top, b, a, c); w.tri('Glow', top, d, b, c); w.tri('Glow', top, a, d, c); w.tri('Glow', a, b, d, c);
}

/** a quilt square's side, and the hedge strip between squares (three squares and two strips fill the inner tile) */
const SQUARE = 16.5, HEDGE = 1.6;

/** A box hedge from (x0, z0) to (x1, z1), `h` high, and its collider. */
function hedge(w, p, x0, z0, x1, z1, h = 1.1) {
  w.box('Kit', [x0, 0, z0], [x1, h, z1], p.hedge, p.foliage ?? p.hedge);
  w.solid([x0, 0, z0], [x1, h, z1]);
}

/** A round hay bale (a faceted drum lying on its side) at (x, z), and its collider. */
function bale(w, p, x, z, along = 0) {
  const r = 0.8, l = 1.3, n = 8, ax = along === 0 ? [1, 0] : [0, 1];
  for (let i = 0; i < n; i++) {
    const a0 = 2 * Math.PI * i / n, a1 = 2 * Math.PI * (i + 1) / n;
    const ring = (a, s) => [x + ax[0] * s + (ax[1] * Math.cos(a)) * r, r + Math.sin(a) * r, z + ax[1] * s + (ax[0] * Math.cos(a)) * r];
    w.quad('Kit', ring(a0, -l / 2), ring(a1, -l / 2), ring(a1, l / 2), ring(a0, l / 2), p.hay);
  }
  w.solid([x - (along === 0 ? l / 2 : r), 0, z - (along === 0 ? r : l / 2)], [x + (along === 0 ? l / 2 : r), 2 * r, z + (along === 0 ? r : l / 2)]);
}

/** A white lamp post (the kit's post lantern, retinted) and its collider; unlit by day, so no pool. */
function lamp(w, p, x, z, yaw) {
  if (w.hasModel('lanterns')) w.placeModel('lanterns', 0, x, z, { height: 3.2, yaw });
  else w.sides('Kit', [x - 0.12, 0, z - 0.12], [x + 0.12, 3.2, z + 0.12], p.stone);
  w.solid([x - 0.15, 0, z - 0.15], [x + 0.15, 3.2, z + 0.15]);
}

/** A fair model (the `fair` family's variant) at (x, z), turned `yaw`, and its collider box (half sizes `hx`, `hz`). */
function ride(w, variant, x, z, yaw, hx, hz, h) {
  if (w.hasModel('fair')) w.placeModel('fair', variant, x, z, { yaw });
  w.solid([x - hx, 0, z - hz], [x + hx, h, z + hz]);
}

/** Q quilt: a 3 x 3 patchwork of field squares in the palette's three quilt colours (no two neighbours alike), box hedges
 *  between them, hay bales on two squares. `variant` turns the patchwork's colours. */
function quilt(w, p, variant) {
  const colours = [p.quiltA ?? p.lawn, p.quiltB ?? p.lawn, p.quiltC ?? p.lawn];
  const at = (k) => -INNER + k * (SQUARE + HEDGE);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    const x0 = at(c), z0 = at(r), colour = colours[(r + c * 2 + variant) % 3];
    w.floor('Kit', x0, z0, x0 + SQUARE, z0 + SQUARE, 0.04, colour);
  }
  for (const k of [1, 2]) {
    const s = at(k) - HEDGE;
    hedge(w, p, -INNER, s, INNER, s + HEDGE);
    hedge(w, p, s, -INNER, s + HEDGE, s, 1.1); hedge(w, p, s, s + HEDGE, s + HEDGE, INNER, 1.1);
  }
  for (const [x, z, along] of variant % 2 === 0 ? [[-17, 17, 0], [-14, 19, 1], [17, -18, 0], [19, -15, 1], [15, -15, 0]] : [[-18, -17, 1], [-15, -19, 0], [17, 18, 1], [14, 16, 0]]) bale(w, p, x, z, along);
  for (const [x, y, z] of variant % 2 === 0 ? [[-9, 13, 6], [11, 16, -10]] : [[8, 12, 9], [-12, 15, -7]]) bird(w, x, y, z);
}

/** the pools' water below their coping (the canal's level, kit.py BRIDGE['water']) */
const DEPTH = 0.45;
/** K's two pools (x0, z0, x1, z1): either side of the carousel, as round 75's quadrants set blue basins beside it */
const POOLS = [[-24.5, -7, -17, 7], [17, -7, 24.5, 7]];

/** A sunken pool: recessed water, its banks walked with the water on their left so they face it, a white coping, a
 *  collision skirt. */
function basin(w, p, [x0, z0, x1, z1]) {
  w.floor('Water', x0, z0, x1, z1, -DEPTH, p.water);
  for (const [xa, za, xb, zb] of [[x0, z1, x0, z0], [x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1]]) {
    w.quad('Kit', [xa, -DEPTH, za], [xb, -DEPTH, zb], [xb, 0, zb], [xa, 0, za], p.stone);
  }
  for (const [a, b] of [[[x0 - 0.5, z0 - 0.5], [x1 + 0.5, z0]], [[x0 - 0.5, z1], [x1 + 0.5, z1 + 0.5]], [[x0 - 0.5, z0], [x0, z1]], [[x1, z0], [x1 + 0.5, z1]]]) {
    w.box('Kit', [a[0], 0, a[1]], [b[0], 0.3, b[1]], p.stoneTop ?? p.stone);
  }
  w.solid([x0, -DEPTH - 0.3, z0], [x1, -DEPTH, z1]);
}

/** K carousel: the carousel on a clover lawn in a ring of box hedges open at the four sides, a pool either side, a lamp on
 *  each corner. */
function carousel(w, p, variant) {
  const lawn = p.quiltC ?? p.lawn, [[a0, b0, a1, b1], [c0, , c1]] = POOLS;
  w.floor('Kit', -INNER, -INNER, INNER, b0 - 0.5, 0.04, lawn); w.floor('Kit', -INNER, b1 + 0.5, INNER, INNER, 0.04, lawn);
  w.floor('Kit', -INNER, b0 - 0.5, a0 - 0.5, b1 + 0.5, 0.04, lawn); w.floor('Kit', a1 + 0.5, b0 - 0.5, c0 - 0.5, b1 + 0.5, 0.04, lawn);
  w.floor('Kit', c1 + 0.5, b0 - 0.5, INNER, b1 + 0.5, 0.04, lawn);
  for (const rect of POOLS) basin(w, p, rect);
  w.floor('Kit', -10, -10, 10, 10, 0.06, p.paving);
  for (const [x0, z0, x1, z1] of [[-14, -14, -4, -12.6], [4, -14, 14, -12.6], [-14, 12.6, -4, 14], [4, 12.6, 14, 14],
    [-14, -12.6, -12.6, -4], [-14, 4, -12.6, 12.6], [12.6, -12.6, 14, -4], [12.6, 4, 14, 12.6]]) hedge(w, p, x0, z0, x1, z1);
  ride(w, 0, 0, 0, variant * Math.PI / 4, 6.6, 6.6, 9.8);
  for (const s of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) lamp(w, p, s[0] * 23.5, s[1] * 23.5, Math.atan2(-s[0], -s[1]));
  for (const [x, z, along] of [[-21, 4, 1], [21, -5, 1], [5, 21, 0]]) bale(w, p, x, z, along);
  for (const [x, y, z] of [[-6, 14, -16], [9, 12, 15]]) bird(w, x, y, z);
}

/** T big top: the striped big top on a lawn, its door to the north (tile +z), hay bales and lamps round it. */
function bigTop(w, p, variant) {
  w.floor('Kit', -INNER, -INNER, INNER, INNER, 0.04, p.quiltA ?? p.lawn);
  w.floor('Kit', -3, 8, 3, INNER, 0.06, p.paving);
  ride(w, 1, 0, -2, 0, 8.4, 8.4, 12);
  for (const [x, z, along] of variant === 0 ? [[-19, -18, 0], [-16, -20, 1], [18, -17, 1], [20, 14, 0]] : [[19, -18, 0], [16, -20, 1], [-18, -17, 1], [-20, 14, 0]]) bale(w, p, x, z, along);
  for (const x of [-5, 5]) lamp(w, p, x, 14, 0);
}

/** where an avenue's booths stand (plot metres from the plaza along it, either side of the lane) and where the
 *  helter-skelter pair flanks it at the road entry, short of the entry's 15 m footprint, which must stay clear; the first
 *  booth stands clear of the plaza's perimeter lane at 62.5 m (the walk route's ring) */
const BOOTHS = [82, 102, 122, 142, 162, 182], GATE = 205;

/** One of the four avenues from a road entry to the wheel (the seams on x = 0 and z = 0), as round 75's top-down lines
 *  them: a striped booth either side at each of BOOTHS, its front toward the lane, and the helter-skelter pair at GATE.
 *  `along(u, off)` is the seam's tile-local point. */
function avenue(w, side, centre) {
  const along = (u, off) => (side === 0 ? [u, HALF + off] : [HALF + off, -u]);
  // the seam's points (u) whose distance along the avenue is one of `list`, on either side of the plaza
  const at = list => list.flatMap(r => [r, -r]).map(r => (side === 0 ? r - centre[0] : centre[1] - r)).filter(u => u >= -HALF && u < HALF);
  for (const u of at(BOOTHS)) for (const off of [-6.5, 6.5]) {
    const [x, z] = along(u, off), yaw = side === 0 ? (off < 0 ? 0 : Math.PI) : (off < 0 ? Math.PI / 2 : -Math.PI / 2);
    if (w.hasModel('stalls')) w.placeModel('stalls', ((Math.round(u) % 3) + 3) % 3, x, z, { yaw });
    w.solid([x - 1.6, 0, z - 1.6], [x + 1.6, 2.6, z + 1.6]);
  }
  for (const u of at([GATE])) for (const off of [-8.5, 8.5]) { const [x, z] = along(u, off); ride(w, 2, x, z, 0, 3.2, 3.2, 16); }
}

/** A lane seam: the shared builders' strings and banners (no fireflies by day), and on the four avenues the booths and
 *  helter-skelters. */
function fairLane(shared) {
  return (w, p, side, centre, ...rest) => {
    shared?.(noFireflies(w), p, side, centre, ...rest);
    if ((side === 0 ? centre[1] : centre[0]) + HALF === 0) avenue(noFireflies(w), side, centre);
  };
}

/** The far stand-ins (RM11): the field squares' colours, hedges as low green boxes, the rides as coloured blocks. */
function farFair(w, p, type, variant) {
  w.floor('far', -HALF, -HALF, HALF, HALF, 0, p.paving);
  if (type === 'Q') {
    const colours = [p.quiltA ?? p.lawn, p.quiltB ?? p.lawn, p.quiltC ?? p.lawn], at = (k) => -INNER + k * (SQUARE + HEDGE);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) w.floor('far', at(c), at(r), at(c) + SQUARE, at(r) + SQUARE, 0.04, colours[(r + c * 2 + variant) % 3]);
    return;
  }
  w.floor('far', -INNER, -INNER, INNER, INNER, 0.04, type === 'K' ? (p.quiltC ?? p.lawn) : (p.quiltA ?? p.lawn));
  if (type === 'K') { w.box('far', [-6, 0, -6], [6, 7, 6], p.tentRed ?? p.stall); for (const [x0, z0, x1, z1] of POOLS) w.floor('far', x0, z0, x1, z1, 0.06, p.water); }
  else w.box('far', [-8, 0, -10], [8, 9, 6], p.tentWhite ?? p.wall);
}

const THEME = {
  Q: { build: quilt, far: (w, p, variant) => farFair(w, p, 'Q', variant), sockets: 'pppp' },
  K: { build: carousel, far: (w, p, variant) => farFair(w, p, 'K', variant), sockets: 'pppp', water: POOLS },
  T: { build: bigTop, far: (w, p, variant) => farFair(w, p, 'T', variant), sockets: 'pppp' },
};

/** The fair's builders: a layout's shared letters (Night Market's kinds, `layout.builders`) plus Q, K and T, every one
 *  drawn without fireflies, and lane seams that line the avenues with booths and the helter-skelter pair. */
export function patchworkFairgroundBuilders(letters) {
  const shared = nightMarketBuilders(letters);
  for (const letter of Object.keys(THEME)) if (Object.hasOwn(shared.tiles, letter)) throw new Error(`patchwork-fairground: letter ${letter} is a theme tile`);
  const tiles = { ...shared.tiles, ...THEME };
  const day = Object.fromEntries(Object.entries(tiles).map(([letter, tile]) => [letter, { ...tile, build: (w, ...rest) => tile.build(noFireflies(w), ...rest) }]));
  return { tiles: day, coarseFamilies: new Set([...shared.coarseFamilies, 'fair', 'stalls']), seam: fairLane(shared.seam) };
}

/** Hooks at the generic construction points (tiledPlotCore.mjs): the wheel stands alone on the plaza (no lanterns of its
 *  own by day), a pale pool of light under it. */
export const patchworkFairgroundPlot = {
  builders: layout => patchworkFairgroundBuilders(layout.builders),
  lanternBake: { gain: 0.6, radius: 1.5, cut: 3 },
  ringInKit: true,
  models() { return undefined; },
  pools(parts, palette) {
    const lit = { Pool: parts.Pool }, plotWriter = { triColours: (part, a, b, c, colours) => lit[part].triColours(part, [a, b, c], colours) };
    pool(plotWriter, 0, 0, 20, palette.gatePool, 0.05);
  },
};
