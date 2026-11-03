// OP18 (OPEN-PLOTS wave C, G978): Thin Ice's tile vocabulary, after round 62's board
// (art/grid/round-62-open-plot-palettes/08-thin-ice.jpg). The shared letters are Night Market's builders (plaza and
// forecourts, retinted by the layout's palette: snow paving, Frostline's snowy pines for their trees); three theme tiles
// are the frozen lake's own, each a paved border meeting any neighbour ('pppp'):
//   I ice:     a sheet of aqua lake ice with paler cracks across it; `variant` 0 cuts an ice-fishing hole ringed with snow,
//              the `polar` family's fishing gear (variant 1) behind it; variant 1 has a low snow drift instead;
//   E bank:    the snowy shore: Frostline's pine clumps (the `pines` family) in drifts, a bench (polar variant 2) and a lamp;
//   K igloos:  two igloos (polar variant 0) in the tile's north-west corner facing in, pines behind them, a bench (the plot's
//              corners).
// The avenues are lined with lamps; no strings or banners cross the lake. Every model is a kit family (polar, pines, lanterns), placed only when the layout's kit
// has it. A pale cyan noon: no fireflies, no lanterns lit by day; snow birds drift over the ice (bar 7).
import { HALF, INNER, pool } from './kit.mjs';
import { nightMarketBuilders } from './nightMarket.mjs';

/** The shared builders' fireflies (Glow with no green or blue, red in [0, 0.5)) blink to black, specks by day: a lake
 *  tile's writer drops them and keeps everything else (fairground.mjs's morning writer) */
const noFireflies = (w) => new Proxy(w, { get: (target, key) => key === 'tri'
  ? (part, a, b, c, colour, ...rest) => (part === 'Glow' && colour?.[1] === 0 && colour?.[2] === 0 && colour[0] < 0.5 ? undefined : target.tri(part, a, b, c, colour, ...rest))
  : (typeof target[key] === 'function' ? target[key].bind(target) : target[key]) });

/** Life (bar 7): a snow bird, a 0.6 m mover in the glow graph's steady mode (red seed in [0.5, 1), no green: drifting
 *  slowly, never blinking to black) at full blue, which the graph lights white (Coral's gull, coral.mjs), over the ice */
let seeds = 0;
function bird(w, x, y, z) {
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

/** A snowy pine clump (Frostline's `pines` family, its variant by `k`) and its collider. */
function pines(w, x, z, k, yaw = 0) {
  if (w.hasModel('pines')) w.placeModel('pines', ((k % 3) + 3) % 3, x, z, { yaw });
  w.solid([x - 1, 0, z - 1], [x + 1, 4, z + 1]);
}

/** A `polar` model (variant) at (x, z), turned `yaw`, and its collider box (half sizes after the turn, height `h`). */
function polar(w, variant, x, z, yaw, hx, hz, h) {
  if (w.hasModel('polar')) w.placeModel('polar', variant, x, z, { yaw });
  if (h > 0) w.solid([x - hx, 0, z - hz], [x + hx, h, z + hz]);
}

/** A flat octagon (a fan of `part` triangles) of radius `r` at (x, y, z). */
function disc(w, part, x, y, z, r, colour) {
  for (let i = 0; i < 8; i++) {
    const a0 = i / 8 * Math.PI * 2, a1 = (i + 1) / 8 * Math.PI * 2;
    w.tri(part, [x, y, z], [x + r * Math.sin(a1), y, z + r * Math.cos(a1)], [x + r * Math.sin(a0), y, z + r * Math.cos(a0)], colour);
  }
}

/** A crack across the ice: a thin pale strip from (x0, z0) to (x1, z1). */
function crack(w, p, x0, z0, x1, z1, width = 0.12) {
  const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz) || 1, nx = -dz / l * width, nz = dx / l * width, y = 0.045;
  w.quad('Kit', [x0 - nx, y, z0 - nz], [x0 + nx, y, z0 + nz], [x1 + nx, y, z1 + nz], [x1 - nx, y, z1 - nz], p.iceCrack ?? p.snow);
}

/** the cracks over an ice tile (tile-local segments), two sets the variant picks between */
const CRACKS = [
  [[-22, -18, -6, -9], [-6, -9, 4, -14], [-6, -9, -2, 6], [-2, 6, 12, 10], [12, 10, 22, 20], [-2, 6, -16, 16]],
  [[-20, 14, -8, 4], [-8, 4, 6, 8], [6, 8, 20, -4], [-8, 4, -12, -14], [-12, -14, 2, -22], [6, 8, 10, 22]],
];

/** I ice: the lake's ice over the tile's middle, cracks across it; variant 0 cuts an ice-fishing hole (dark water in a
 *  ring of snow) with the gear behind it, variant 1 lays a low snow drift; snow birds over it. */
function ice(w, p, variant) {
  w.floor('Kit', -INNER, -INNER, INNER, INNER, 0.03, p.ice ?? p.water);
  for (const [x0, z0, x1, z1] of CRACKS[variant % 2]) crack(w, p, x0, z0, x1, z1);
  if (variant % 2 === 0) {
    const [hx, hz] = [8, -4];
    disc(w, 'Kit', hx, 0.05, hz, 1.8, p.snow ?? p.paving);
    disc(w, 'Water', hx, 0.06, hz, 1.1, p.water);
    polar(w, 1, hx, hz - 1.4, 0, 1.8, 0.5, 1.9);
  } else {
    for (const [x, z, r] of [[-10, 12, 3.2], [-6, 14, 2.2]]) disc(w, 'Kit', x, 0.08, z, r, p.snow ?? p.paving);
  }
  for (const [x, y, z] of variant % 2 === 0 ? [[-8, 9, 6], [10, 12, -10]] : [[6, 10, 8], [-10, 13, -6]]) bird(w, x, y, z);
}

/** E bank: the snowy shore, pine clumps in drifts, a bench facing the tile's south (the lake inside the plot) and a lamp. */
function bank(w, p, variant) {
  w.floor('Kit', -INNER, -INNER, INNER, INNER, 0.03, p.snow ?? p.paving);
  const clumps = variant % 2 === 0 ? [[-18, 16], [-4, 20], [14, 14], [20, -10], [-16, -14], [4, -20]] : [[-20, 6], [-8, 18], [10, 20], [18, 2], [-6, -16], [16, -18]];
  for (const [k, [x, z]] of clumps.entries()) { disc(w, 'Kit', x, 0.05, z, 3.4, p.snowShade ?? p.snow); pines(w, x, z, k + variant, k * 1.3); }
  polar(w, 2, variant % 2 === 0 ? 2 : -2, 4, Math.PI, 1.2, 0.35, 1);
  lamp(w, p, variant % 2 === 0 ? -6 : 6, 2);
}

/** K igloos: two igloos in the tile's north-west corner (the plot's outer corner) facing in, pines behind them, a bench. */
function igloos(w, p) {
  w.floor('Kit', -INNER, -INNER, INNER, INNER, 0.03, p.snow ?? p.paving);
  polar(w, 0, -14, 14, Math.PI * 0.75, 3.4, 3.4, 3.2);
  polar(w, 0, 6, 16, Math.PI, 3.4, 3.4, 3.2);
  for (const [k, [x, z]] of [[-22, 22], [-22, 2], [-6, 23], [18, 22], [-22, -16]].entries()) pines(w, x, z, k, k);
  polar(w, 2, -2, 2, Math.PI * 0.75, 0.9, 0.9, 1);
  lamp(w, p, 10, 4);
}

/** where an avenue's lamps stand (plot metres from the plaza along it, either side of the lane), clear of the plaza's
 *  perimeter lane at 62.5 m (the walk route's ring) and short of the road entry's 15 m footprint */
const LAMPS = [82, 112, 142, 172, 202];

/** One of the four avenues from a road entry to the crystal (the seams on x = 0 and z = 0): a lamp either side at each
 *  of LAMPS. */
function avenue(w, p, side, centre) {
  const along = (u, off) => (side === 0 ? [u, HALF + off] : [HALF + off, -u]);
  const at = list => list.flatMap(r => [r, -r]).map(r => (side === 0 ? r - centre[0] : centre[1] - r)).filter(u => u >= -HALF && u < HALF);
  for (const u of at(LAMPS)) for (const off of [-5.5, 5.5]) { const [x, z] = along(u, off); lamp(w, p, x, z); }
}

/** A lane seam: open snow (no strings or banners over the lake, which round 62 leaves clear), and on the four avenues the
 *  lamps. */
function lakeLane(w, p, side, centre) {
  if ((side === 0 ? centre[1] : centre[0]) + HALF === 0) avenue(w, p, side, centre);
}

/** The far stand-ins (RM11): the ice and its holes, the snow banks with their pines as dark green blocks, the igloos. */
function farLake(w, p, type, variant) {
  w.floor('far', -HALF, -HALF, HALF, HALF, 0, p.paving);
  if (type === 'I') {
    w.floor('far', -INNER, -INNER, INNER, INNER, 0.04, p.ice ?? p.water);
    if (variant % 2 === 0) w.floor('far', 7, -5, 9, -3, 0.06, p.water);
    return;
  }
  w.floor('far', -INNER, -INNER, INNER, INNER, 0.04, p.snow ?? p.paving);
  if (type === 'E') for (const [x, z] of [[-18, 16], [14, 14], [20, -10], [-16, -14]]) w.box('far', [x - 1.6, 0, z - 1.6], [x + 1.6, 6, z + 1.6], p.foliageDark ?? p.foliage);
  else for (const [x, z] of [[-14, 14], [6, 16]]) w.box('far', [x - 3, 0, z - 3], [x + 3, 3, z + 3], p.snow ?? p.paving);
}

const THEME = {
  I: { build: ice, far: (w, p, variant) => farLake(w, p, 'I', variant), sockets: 'pppp' },
  E: { build: bank, far: (w, p, variant) => farLake(w, p, 'E', variant), sockets: 'pppp' },
  K: { build: igloos, far: (w, p, variant) => farLake(w, p, 'K', variant), sockets: 'pppp' },
};

/** The lake's builders: a layout's shared letters (Night Market's kinds, `layout.builders`) plus I, E and K, every one
 *  drawn without fireflies, and lane seams that line the avenues with lamps (the pines draw only near, as Frostline's). */
export function thinIceBuilders(letters) {
  const shared = nightMarketBuilders(letters);
  for (const letter of Object.keys(THEME)) if (Object.hasOwn(shared.tiles, letter)) throw new Error(`thin-ice: letter ${letter} is a theme tile`);
  const tiles = { ...shared.tiles, ...THEME };
  const day = Object.fromEntries(Object.entries(tiles).map(([letter, tile]) => [letter, { ...tile, build: (w, ...rest) => tile.build(noFireflies(w), ...rest) }]));
  return { tiles: day, coarseFamilies: new Set([...shared.coarseFamilies, 'polar']), seam: lakeLane };
}

/** Hooks at the generic construction points (tiledPlotCore.mjs): the crystal stands alone on its plinth on the plaza, a
 *  pale cyan pool of light round it. */
export const thinIcePlot = {
  builders: layout => thinIceBuilders(layout.builders),
  lanternBake: { gain: 0.6, radius: 1.5, cut: 3 },
  ringInKit: true,
  models() { return undefined; },
  pools(parts, palette) {
    const lit = { Pool: parts.Pool }, plotWriter = { triColours: (part, a, b, c, colours) => lit[part].triColours(part, [a, b, c], colours) };
    pool(plotWriter, 0, 0, 22, palette.gatePool, 0.05);
  },
};
