// OP11 (OPEN-PLOTS wave B, G978): Sky Harbor's tile vocabulary, after round 62's board
// (art/grid/round-62-open-plot-palettes/09-sky-harbor.jpg). The shared letters are Night Market's builders (plaza and
// forecourts, retinted by the layout's palette: white stone, timber); three theme tiles are the harbour's own, each a paved
// border meeting any neighbour ('pppp'):
//   B basin:    a square cornflower basin inside a timber-capped stone quay, a plank jetty out from its north quay, two
//               rowboats moored beside it (the `skyport` family's variant 1), a dock crane (variant 0) and cargo
//               (variant 2) on the quay;
//   Q quay:     a timber wharf deck between basins, cargo pallets, a dock crane, trees in stone planters, lamps;
//   K cottages: two blue-roofed harbour cottages (the `harbour` family's variant 1) along the tile's north and west edges
//               facing in, trees and cargo in the yard (the plot's corners).
// The avenues are lined with lamps and planter trees. Every model is a kit family (skyport, harbour, lanterns, trees),
// placed only when the layout's kit has it. A bright clear day: no fireflies, no lanterns lit by day; gulls drift over the
// basins (bar 7).
import { HALF, INNER, pool } from './kit.mjs';
import { nightMarketBuilders } from './nightMarket.mjs';

/** The shared builders' fireflies (Glow with no green or blue, red in [0, 0.5)) blink to black, specks by day: a harbour
 *  tile's writer drops them and keeps everything else (fairground.mjs's morning writer) */
const noFireflies = (w) => new Proxy(w, { get: (target, key) => key === 'tri'
  ? (part, a, b, c, colour, ...rest) => (part === 'Glow' && colour?.[1] === 0 && colour?.[2] === 0 && colour[0] < 0.5 ? undefined : target.tri(part, a, b, c, colour, ...rest))
  : (typeof target[key] === 'function' ? target[key].bind(target) : target[key]) });

/** Life (bar 7): a gull, a 0.6 m mover in the glow graph's steady mode (red seed in [0.5, 1), no green: drifting slowly,
 *  never blinking to black) at full blue, which the graph lights white (Coral's gull, coral.mjs), low over the basins */
let seeds = 0;
function gull(w, x, y, z) {
  seeds++;
  const c = [((seeds * 0.6180339887) % 1) * 0.5 + 0.5, 0, 1], s = 0.6;
  const top = [x, y + s * 1.4, z], a = [x - s, y - s, z - s], b = [x + s, y - s, z - s], d = [x, y - s, z + s * 1.4];
  w.tri('Glow', top, b, a, c); w.tri('Glow', top, d, b, c); w.tri('Glow', top, a, d, c); w.tri('Glow', a, b, d, c);
}

/** A lamp post (the kit's post lantern, retinted) and its collider; unlit by day, so no pool. */
function lamp(w, p, x, z, yaw = 0) {
  if (w.hasModel('lanterns')) w.placeModel('lanterns', 0, x, z, { height: 3.2, yaw });
  else w.sides('Kit', [x - 0.12, 0, z - 0.12], [x + 0.12, 3.2, z + 0.12], p.iron ?? p.stone);
  w.solid([x - 0.15, 0, z - 0.15], [x + 0.15, 3.2, z + 0.15]);
}

/** A tree in a square stone planter (the kit's trees, a 5 m crown) and its collider. */
function planter(w, p, x, z, spin = 0) {
  w.box('Kit', [x - 1.1, 0, z - 1.1], [x + 1.1, 0.6, z + 1.1], p.stone, p.soil ?? p.stoneTop);
  if (w.hasModel('trees')) w.placeModel('trees', 0, x, z, { yaw: spin, y: 0.6, scale: 5 / 8 });
  w.solid([x - 1.1, 0, z - 1.1], [x + 1.1, 3, z + 1.1]);
}

/** A model of `family` (variant) at (x, z), turned `yaw`, raised `y`, and its collider box (half sizes along x and z
 *  after the turn, height `h` above `y`; none for 0). */
function piece(w, family, variant, x, z, yaw, hx, hz, h, y = 0) {
  if (w.hasModel(family)) w.placeModel(family, variant, x, z, { yaw, y });
  if (h > 0) w.solid([x - hx, y, z - hz], [x + hx, y + h, z + hz]);
}

/** A dock crane, its jib out toward `yaw` (0 is +z), and its footing's collider. */
const crane = (w, x, z, yaw) => piece(w, 'skyport', 0, x, z, yaw, 1.2, 1.2, 9);
/** A cargo pallet (crates, barrels, sacks) and its collider. */
const cargo = (w, x, z, yaw = 0) => piece(w, 'skyport', 2, x, z, yaw, yaw === 0 ? 1.6 : 1.1, yaw === 0 ? 1.1 : 1.6, 2.4);

/** the basin's water below the quay, and the basin (x0, z0, x1, z1): the tile's middle inside its quay */
const DEPTH = 0.6;
const BASIN = [-21, -21, 21, 21];

/** B basin: the cornflower basin in stone quay walls under a timber coping, a plank jetty from the north quay with a
 *  rowboat either side of it (bows south), a dock crane over the water at one north corner beside its cargo, a lamp at the
 *  other two corners, gulls over it. `variant` mirrors the crane. */
function basin(w, p, variant) {
  const [x0, z0, x1, z1] = BASIN, m = variant === 0 ? 1 : -1;
  w.floor('Water', x0, z0, x1, z1, -DEPTH, p.water);
  for (const [xa, za, xb, zb] of [[x0, z1, x0, z0], [x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1]]) {
    w.quad('Kit', [xa, -DEPTH, za], [xb, -DEPTH, zb], [xb, 0, zb], [xa, 0, za], p.stone);
  }
  for (const [a, b] of [[[x0 - 1, z0 - 1], [x1 + 1, z0]], [[x0 - 1, z1], [x1 + 1, z1 + 1]], [[x0 - 1, z0], [x0, z1]], [[x1, z0], [x1 + 1, z1]]]) {
    w.box('Kit', [a[0], 0, a[1]], [b[0], 0.2, b[1]], p.wood, p.plank ?? p.wood);
  }
  w.solid([x0, -DEPTH - 0.3, z0], [x1, -DEPTH, z1]);
  // the jetty: a plank deck on posts from the north quay out over the water
  w.box('Kit', [-1.6, -0.1, 6], [1.6, 0.15, z1], p.wood, p.plank ?? p.wood);
  for (const z of [7, 13]) for (const x of [-1.4, 1.4]) w.sides('Kit', [x - 0.15, -DEPTH, z - 0.15], [x + 0.15, -0.1, z + 0.15], p.wood);
  for (const x of [-4.2, 4.2]) piece(w, 'skyport', 1, x, 11 + (x * m > 0 ? 2 : 0), Math.PI, 0, 0, 0, -DEPTH);
  crane(w, m * (x1 - 3.5), z1 + 2.2, Math.PI);
  cargo(w, m * (x1 - 9), z1 + 2.6);
  for (const x of [-m * (x1 + 2.4), m * (x1 + 2.4)]) lamp(w, p, x, z0 - 2.4);
  lamp(w, p, -m * (x1 + 2.4), z1 + 2.4);
  for (const [x, y, z] of variant === 0 ? [[-8, 9, -4], [10, 12, 8]] : [[7, 10, -6], [-9, 13, 5]]) gull(w, x, y, z);
}

/** Q quay: a timber wharf deck, a dock crane and three cargo pallets on it, a tree in a planter at each corner, two
 *  lamps. `variant` turns the cargo. */
function quay(w, p, variant) {
  w.floor('Kit', -INNER + 4, -INNER + 4, INNER - 4, INNER - 4, 0.06, p.plank ?? p.wood);
  for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) planter(w, p, x * (INNER - 2), z * (INNER - 2), x * 0.7);
  crane(w, variant === 0 ? -9 : 9, 0, variant === 0 ? Math.PI / 2 : -Math.PI / 2);
  for (const [x, z, yaw] of variant === 0 ? [[4, 12, 0], [10, -6, Math.PI / 2], [-6, -14, 0]] : [[-4, 12, 0], [-10, -6, Math.PI / 2], [6, -14, 0]]) cargo(w, x, z, yaw);
  for (const x of [-12, 12]) lamp(w, p, x, 14);
  gull(w, variant === 0 ? 6 : -6, 11, 4);
}

/** K cottages: a blue-roofed harbour cottage along the tile's north edge facing south and one along its west edge facing
 *  east (the plot's outer corner is the tile's north-west), trees and cargo in the yard. */
function cottages(w, p) {
  piece(w, 'harbour', 1, 4, 18, Math.PI, 4.7, 3.2, 6.4);
  piece(w, 'harbour', 1, -18, -4, Math.PI / 2, 3.2, 4.7, 6.4);
  piece(w, 'harbour', 1, -16, 18, Math.PI, 4.7, 3.2, 6.4);
  for (const [x, z] of [[18, 16], [-16, -18], [8, -8]]) planter(w, p, x, z);
  cargo(w, -4, 6); cargo(w, 14, 4, Math.PI / 2);
  lamp(w, p, -6, 10);
  gull(w, 0, 12, -4);
}

/** where an avenue's lamps and planters stand (plot metres from the plaza along it, either side of the lane), clear of
 *  the plaza's perimeter lane at 62.5 m (the walk route's ring) and short of the road entry's 15 m footprint */
const LAMPS = [82, 112, 142, 172, 202], PLANTERS = [97, 127, 157, 187];

/** One of the four avenues from a road entry to the airship (the seams on x = 0 and z = 0): a lamp either side at each
 *  of LAMPS, a planter tree either side at each of PLANTERS. `along(u, off)` is the seam's tile-local point. */
function avenue(w, p, side, centre) {
  const along = (u, off) => (side === 0 ? [u, HALF + off] : [HALF + off, -u]);
  const at = list => list.flatMap(r => [r, -r]).map(r => (side === 0 ? r - centre[0] : centre[1] - r)).filter(u => u >= -HALF && u < HALF);
  for (const u of at(LAMPS)) for (const off of [-5.5, 5.5]) { const [x, z] = along(u, off); lamp(w, p, x, z); }
  for (const u of at(PLANTERS)) for (const off of [-6, 6]) { const [x, z] = along(u, off); planter(w, p, x, z); }
}

/** A lane seam: the shared builders' strings and banners (no fireflies by day), and on the four avenues the lamps and
 *  planters. */
function harborLane(shared) {
  return (w, p, side, centre, ...rest) => {
    shared?.(noFireflies(w), p, side, centre, ...rest);
    if ((side === 0 ? centre[1] : centre[0]) + HALF === 0) avenue(noFireflies(w), p, side, centre);
  };
}

/** The far stand-ins (RM11): the quay, the basins' water, the wharf deck, the cottages as white walls under blue roofs. */
function farHarbor(w, p, type) {
  w.floor('far', -HALF, -HALF, HALF, HALF, 0, p.paving);
  if (type === 'B') { const [x0, z0, x1, z1] = BASIN; w.floor('far', x0, z0, x1, z1, 0.04, p.water); return; }
  if (type === 'Q') { w.floor('far', -INNER + 4, -INNER + 4, INNER - 4, INNER - 4, 0.04, p.plank ?? p.wood); return; }
  for (const [x0, z0, x1, z1] of [[-0.5, 15, 8.5, 21], [-20.5, 15, -11.5, 21], [-21, -8.5, -15, 0.5]]) {
    w.box('far', [x0, 0, z0], [x1, 3.2, z1], p.cabin ?? p.wall);
    w.box('far', [x0 - 0.3, 3.2, z0 - 0.3], [x1 + 0.3, 5.6, z1 + 0.3], p.tar ?? p.roof);
  }
}

const THEME = {
  B: { build: basin, far: (w, p) => farHarbor(w, p, 'B'), sockets: 'pppp', water: [BASIN] },
  Q: { build: quay, far: (w, p) => farHarbor(w, p, 'Q'), sockets: 'pppp' },
  K: { build: cottages, far: (w, p) => farHarbor(w, p, 'K'), sockets: 'pppp' },
};

/** The harbour's builders: a layout's shared letters (Night Market's kinds, `layout.builders`) plus B, Q and K, every
 *  one drawn without fireflies, and lane seams that line the avenues with lamps and planters. */
export function skyHarborBuilders(letters) {
  const shared = nightMarketBuilders(letters);
  for (const letter of Object.keys(THEME)) if (Object.hasOwn(shared.tiles, letter)) throw new Error(`sky-harbor: letter ${letter} is a theme tile`);
  const tiles = { ...shared.tiles, ...THEME };
  const day = Object.fromEntries(Object.entries(tiles).map(([letter, tile]) => [letter, { ...tile, build: (w, ...rest) => tile.build(noFireflies(w), ...rest) }]));
  return { tiles: day, coarseFamilies: new Set([...shared.coarseFamilies, 'skyport', 'harbour']), seam: harborLane(shared.seam) };
}

/** Hooks at the generic construction points (tiledPlotCore.mjs): the airship and its tower stand alone on the plaza, a
 *  pale pool of light under the tower. */
export const skyHarborPlot = {
  builders: layout => skyHarborBuilders(layout.builders),
  lanternBake: { gain: 0.6, radius: 1.5, cut: 3 },
  ringInKit: true,
  models() { return undefined; },
  pools(parts, palette) {
    const lit = { Pool: parts.Pool }, plotWriter = { triColours: (part, a, b, c, colours) => lit[part].triColours(part, [a, b, c], colours) };
    pool(plotWriter, 0, 0, 20, palette.gatePool, 0.05);
  },
};
