// OP15 (OPEN-PLOTS wave C, G978): Starfall Observatory's tile vocabulary, after round 62's board
// (art/grid/round-62-open-plot-palettes/12-starfall-observatory.jpg): a white-stone garden town under a deep indigo starry
// night, the domed observatory on its plaza. The shared letters are Night Market's builders (houses, gardens, canals,
// forecourts and the plaza, retinted by the layout's palette: white paving, royal-blue roofs, deep blue canals); one theme
// tile is the observatory's own, a lawn whose paved border meets any neighbour ('pppp'):
//   V stargazer garden: a stargazer's pavilion (the `stars` family's variant 2) on a lawn among trees, a refractor on its
//                       tripod (variant 0) and an armillary sphere (variant 1) on the paving before it, lamps at its corners.
// The avenues are lined with white lamp posts (in place of the market's string lights); the market's fireflies stay, the
// night garden's life. Every model is a kit family (stars, houses, trees, lanterns, bridges, canal), placed only when the
// layout's kit has it.
import { HALF, INNER, pool } from './kit.mjs';
import { nightMarketBuilders } from './nightMarket.mjs';

/** A white lamp post (the kit's post lantern, retinted), its pool of starlight and its collider. */
function lamp(w, p, x, z, yaw) {
  if (w.hasModel('lanterns')) w.placeModel('lanterns', 0, x, z, { height: 3.2, yaw });
  else {
    w.lanternEmitter?.([x, 3.6, z], [...p.lantern]);
    w.sides('Kit', [x - 0.12, 0, z - 0.12], [x + 0.12, 3.2, z + 0.12], p.stone);
    w.box('Glow', [x - 0.25, 3.2, z - 0.25], [x + 0.25, 3.9, z + 0.25], p.lantern, p.lantern);
  }
  w.solid([x - 0.15, 0, z - 0.15], [x + 0.15, 3.2, z + 0.15]);
  pool(w, x, z, 3.5, p.pool);
}

/** A round tree (the kit's), else a faceted stand-in, and its trunk's collider. */
function tree(w, p, x, z, size, spin) {
  if (w.hasModel('trees')) w.placeModel('trees', 0, x, z, { yaw: spin, scale: size * 1.1 / 8 });
  else {
    w.sides('Kit', [x - 0.25, 0, z - 0.25], [x + 0.25, size * 0.45, z + 0.25], p.trunk);
    w.box('Kit', [x - size * 0.4, size * 0.45, z - size * 0.4], [x + size * 0.4, size, z + size * 0.4], p.foliage, p.foliage);
  }
  w.solid([x - 0.3, 0, z - 0.3], [x + 0.3, 3, z + 0.3]);
}

/** A `stars` model (variant) at (x, z), turned `yaw`, and its collider box (half sizes `hx`, `hz`, height `h`). */
function star(w, variant, x, z, yaw, hx, hz, h) {
  if (w.hasModel('stars')) w.placeModel('stars', variant, x, z, { yaw });
  w.solid([x - hx, 0, z - hz], [x + hx, h, z + hz]);
}

/** V stargazer garden: a lawn inside the paved border, the pavilion at its north-middle facing south (its door to the
 *  tile's -z), a paved forecourt before it with a refractor either side and an armillary sphere at its middle, trees in
 *  the lawn's corners and along its sides, a lamp at each corner. `variant` mirrors the trees. */
function stargazer(w, p, variant) {
  w.floor('Kit', -INNER, -INNER, INNER, INNER, 0.04, p.lawn);
  w.floor('Kit', -9, -16, 9, 6, 0.06, p.plaza ?? p.paving);
  star(w, 2, 0, 12, Math.PI, 3.4, 3.4, 6.9);
  for (const x of [-6, 6]) star(w, 0, x, -4, Math.PI, 1.1, 1.1, 3.4);
  star(w, 1, 0, -10, 0, 0.8, 0.8, 3.6);
  const m = variant === 0 ? 1 : -1;
  for (const [x, z, size] of [[-19, 19, 9], [19, 19, 8], [-19, -19, 8], [19, -19, 9], [-19, 0, 7], [19, 2, 7], [m * 13, 21, 6]]) {
    tree(w, p, x, z, size, (x + z) * 0.3);
  }
  for (const s of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) lamp(w, p, s[0] * 23.5, s[1] * 23.5, Math.atan2(-s[0], -s[1]));
}

/** The far stand-in (RM11): the lawn, the forecourt's paving, the pavilion as a white drum under a blue cap. */
function farStargazer(w, p) {
  w.floor('far', -HALF, -HALF, HALF, HALF, 0, p.paving);
  w.floor('far', -INNER, -INNER, INNER, INNER, 0.04, p.lawn);
  w.box('far', [-2.8, 0, 9.2], [2.8, 4, 14.8], p.wall);
  w.box('far', [-3, 4, 9], [3, 6.6, 15], p.domeBlue ?? p.roof);
}

/** where an avenue's lamps stand (plot metres from the plaza along it, either side of the lane), short of the plaza's
 *  plinth and of the road entry's 15 m footprint */
const AVENUE_LAMPS = [44, 68, 92, 116, 140, 164, 188, 212];

/** A lane seam: on the four avenues (the seams on x = 0 and z = 0) a white lamp post either side every 24 m; the other
 *  seams are open paving. */
function starLane(w, p, side, centre) {
  if ((side === 0 ? centre[1] : centre[0]) + HALF !== 0) return;
  const along = (u, off) => (side === 0 ? [u, HALF + off] : [HALF + off, -u]);
  const at = list => list.flatMap(r => [r, -r]).map(r => (side === 0 ? r - centre[0] : centre[1] - r)).filter(u => u >= -HALF && u < HALF);
  for (const u of at(AVENUE_LAMPS)) for (const off of [-4.2, 4.2]) { const [x, z] = along(u, off); lamp(w, p, x, z, 0); }
}

const THEME = { V: { build: stargazer, far: (w, p) => farStargazer(w, p), sockets: 'pppp' } };

/** Starfall's builders: a layout's shared letters (Night Market's kinds, `layout.builders`) plus V, and avenue lamps for
 *  the lane seams. */
export function starfallBuilders(letters) {
  const shared = nightMarketBuilders(letters);
  for (const letter of Object.keys(THEME)) if (Object.hasOwn(shared.tiles, letter)) throw new Error(`starfall-observatory: letter ${letter} is a theme tile`);
  return { tiles: { ...shared.tiles, ...THEME }, coarseFamilies: new Set([...shared.coarseFamilies, 'stars']), seam: starLane };
}

/** Hooks at the generic construction points (tiledPlotCore.mjs): the observatory stands alone on the plaza; a cool pool of
 *  starlight round its plinth. */
export const starfallPlot = {
  builders: layout => starfallBuilders(layout.builders),
  lanternBake: { gain: 0.8, radius: 1.5, cut: 3 },
  ringInKit: true,
  models() { return undefined; },
  pools(parts, palette) {
    const lit = { Pool: parts.Pool }, plotWriter = { triColours: (part, a, b, c, colours) => lit[part].triColours(part, [a, b, c], colours) };
    pool(plotWriter, 0, 0, 24, palette.gatePool, 0.05);
  },
};
