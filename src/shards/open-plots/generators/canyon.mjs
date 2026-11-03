// OP19 (OPEN-PLOTS wave C, G978): Clockwork Canyon's tile vocabulary, after round 62's board
// (art/grid/round-62-open-plot-palettes/11-clockwork-canyon.jpg): a brass-and-verdigris works town of pink sandstone
// terraces round turquoise canals under a pale teal steam sky, the clock tower on its plaza. The shared letters are Night
// Market's builders (gardens, canals, forecourts and the plaza, retinted by the layout's palette); the straight canals are
// dressed with a waterwheel turning in each near its banks; one theme tile is the canyon's own, its paved border meeting
// any neighbour ('pppp'):
//   W works terrace: two stepped pink sandstone terraces at the tile's back, a boiler on each with steam off its stack,
//                    gear works on the paving before them, bushes along the terraces' feet, lamps at the mouth.
// Every model is a kit family (clockwork, trees, lanterns, bridges, canal), placed only when the layout's kit has it. A
// daylit plot: no fireflies.
import { HALF, INNER, pool } from './kit.mjs';
import { nightMarketBuilders } from './nightMarket.mjs';

/** The shared builders' fireflies (Glow with no green or blue, red in [0, 0.5)) blink to black, specks by day: a tile's
 *  writer drops them and keeps everything else (coral.mjs's noon writer) */
const noFireflies = (w) => new Proxy(w, { get: (target, key) => key === 'tri'
  ? (part, a, b, c, colour, ...rest) => (part === 'Glow' && colour?.[1] === 0 && colour?.[2] === 0 && colour[0] < 0.5 ? undefined : target.tri(part, a, b, c, colour, ...rest))
  : (typeof target[key] === 'function' ? target[key].bind(target) : target[key]) });

/** Life (bar 7): steam off a stack at (x, y, z): three small octahedra in the additive Pool draw, marked by a vertex colour
 *  with blue and no red and seeded by green, so the pool graph lifts each on its own loop (Night Market's kiosk steam). */
let seeds = 0;
function steam(w, x, y, z) {
  for (let k = 0; k < 3; k++) {
    seeds++;
    const c = [0, (seeds * 0.6180339887) % 1, 1], r = 0.45, at = [x + (k - 1) * 0.25, y + k * 0.6, z];
    const tip = [[0, r, 0], [0, -r, 0]], ring = [[r, 0, 0], [0, 0, r], [-r, 0, 0], [0, 0, -r]];
    const v = d => [at[0] + d[0], at[1] + d[1], at[2] + d[2]];
    for (let i = 0; i < 4; i++) {
      const a = ring[i], b = ring[(i + 1) % 4];
      w.tri('Pool', v(tip[0]), v(b), v(a), c); w.tri('Pool', v(tip[1]), v(a), v(b), c);
    }
  }
}

/** A brass lamp post (the kit's post lantern, retinted), its pool and collider. */
function lamp(w, p, x, z, yaw) {
  if (w.hasModel('lanterns')) w.placeModel('lanterns', 0, x, z, { height: 3.2, yaw });
  else {
    w.lanternEmitter?.([x, 3.6, z], [...p.lantern]);
    w.sides('Kit', [x - 0.12, 0, z - 0.12], [x + 0.12, 3.2, z + 0.12], p.stone);
    w.box('Glow', [x - 0.25, 3.2, z - 0.25], [x + 0.25, 3.9, z + 0.25], p.lantern, p.lantern);
  }
  w.solid([x - 0.15, 0, z - 0.15], [x + 0.15, 3.2, z + 0.15]);
  pool(w, x, z, 3, p.pool);
}

/** A round bush (the kit's tree, small), else a faceted stand-in, and its collider. */
function bush(w, p, x, z, y, size) {
  if (w.hasModel('trees')) w.placeModel('trees', 0, x, z, { y, yaw: x + z, scale: size * 1.1 / 8 });
  else w.box('Kit', [x - size * 0.4, y, z - size * 0.4], [x + size * 0.4, y + size * 0.8, z + size * 0.4], p.foliage, p.foliage);
  w.solid([x - 0.3, y, z - 0.3], [x + 0.3, y + 2, z + 0.3]);
}

/** A clockwork model (variant) at (x, z) raised `y`, turned `yaw`, and its collider (half sizes `hx`, `hz`, height `h`). */
function works(w, variant, x, z, y, yaw, hx, hz, h) {
  if (w.hasModel('clockwork')) w.placeModel('clockwork', variant, x, z, { y, yaw });
  w.solid([x - hx, y, z - hz], [x + hx, y + h, z + hz]);
}

/** A sandstone terrace from (x0, z0) to (x1, z1), `h` high, its top paved, and its collider. */
function terrace(w, p, x0, z0, x1, z1, h) {
  w.box('Kit', [x0, 0, z0], [x1, h, z1], p.sand ?? p.stone, p.terrace ?? p.paving);
  w.solid([x0, 0, z0], [x1, h, z1]);
}

/** W works terrace: a low and a high terrace across the tile's back (north), a boiler on each puffing steam off its stack,
 *  gear works on the paving before them, bushes along the terraces' feet, lamps either side of the mouth. `variant`
 *  mirrors it. */
function worksTerrace(w, p, variant) {
  const m = variant === 0 ? 1 : -1;
  w.floor('Kit', -INNER, -INNER, INNER, INNER, 0.04, p.court ?? p.paving);
  terrace(w, p, m > 0 ? -INNER : 2, 8, m > 0 ? -2 : INNER, INNER, 1.6);
  terrace(w, p, m > 0 ? 2 : -INNER, 12, m > 0 ? INNER : -2, INNER, 3.2);
  // boilers: their stacks at the back (the model's +z), steam off the stack's cap (10.6 m over the boiler's foot)
  for (const [x, y] of [[m * -13, 1.6], [m * 13, 3.2]]) {
    works(w, 1, x, 18, y, Math.PI, 1.6, 2.6, 4);
    steam(w, x, y + 11.2, 18 - 1.6);
  }
  for (const [x, z] of [[m * -8, -6], [m * 9, -2]]) works(w, 2, x, z, 0, Math.PI / 2, 3.3, 0.7, 6.2);
  for (const [x, z] of [[-18, 6.5], [-10, 6.5], [10, 10.5], [18, 10.5], [-20, -14], [20, -16]]) bush(w, p, m * x, z, 0, 4);
  for (const x of [-5, 5]) lamp(w, p, x, -INNER + 3, 0);
}

/** The far stand-in (RM11): the court, the terraces as sandstone blocks, the boilers' stacks. */
function farWorks(w, p, variant) {
  const m = variant === 0 ? 1 : -1;
  w.floor('far', -HALF, -HALF, HALF, HALF, 0, p.court ?? p.paving);
  w.box('far', [m > 0 ? -INNER : 2, 0, 8], [m > 0 ? -2 : INNER, 1.6, INNER], p.sand ?? p.stone);
  w.box('far', [m > 0 ? 2 : -INNER, 0, 12], [m > 0 ? INNER : -2, 3.2, INNER], p.sand ?? p.stone);
  for (const [x, y] of [[m * -13, 1.6], [m * 13, 3.2]]) w.box('far', [x - 0.5, y, 19], [x + 0.5, y + 10.6, 20], p.brass ?? p.stone);
}

/** A straight canal (Night Market's C, its water along the tile's z) with a waterwheel turning in it near each bank,
 *  its lower paddles in the water; the bend (L) stays plain. */
function wheeled(base) {
  return (w, p, variant) => {
    base(w, p, variant);
    if (variant !== 'C') return;
    for (const [x, z] of [[-6.5, -14], [6.5, 14]]) {
      if (w.hasModel('clockwork')) w.placeModel('clockwork', 0, x, z, { y: -0.6, yaw: 0 });
      w.solid([x - 1.2, -0.6, z - 3.6], [x + 1.2, 6.2, z + 3.6]);
    }
  };
}

/** where an avenue's lamps stand (plot metres from the plaza along it, either side of the lane), short of the plaza's
 *  plinth and of the road entry's 15 m footprint */
const AVENUE_LAMPS = [44, 68, 92, 116, 140, 164, 188, 212];

/** A lane seam: on the four avenues (the seams on x = 0 and z = 0) a brass lamp post either side every 24 m; the other
 *  seams are open paving (Night Market's string lights, drawn without their kit family, floated as bare bulbs). */
function canyonLane(w, p, side, centre) {
  if ((side === 0 ? centre[1] : centre[0]) + HALF !== 0) return;
  const along = (u, off) => (side === 0 ? [u, HALF + off] : [HALF + off, -u]);
  const at = list => list.flatMap(r => [r, -r]).map(r => (side === 0 ? r - centre[0] : centre[1] - r)).filter(u => u >= -HALF && u < HALF);
  for (const u of at(AVENUE_LAMPS)) for (const off of [-4.2, 4.2]) { const [x, z] = along(u, off); lamp(w, p, x, z, 0); }
}

const THEME = { W: { build: worksTerrace, far: farWorks, sockets: 'pppp' } };

/** The canyon's builders: a layout's shared letters (Night Market's kinds, `layout.builders`) plus W, every tile drawn
 *  without fireflies, the straight canals with their waterwheels, and lamp-lined avenues for the lane seams. */
export function clockworkBuilders(letters) {
  const shared = nightMarketBuilders(letters);
  for (const letter of Object.keys(THEME)) if (Object.hasOwn(shared.tiles, letter)) throw new Error(`clockwork-canyon: letter ${letter} is a theme tile`);
  const tiles = { ...shared.tiles, ...THEME };
  const day = Object.fromEntries(Object.entries(tiles).map(([letter, tile]) => {
    const build = letters?.[letter] === 'canal' ? wheeled(tile.build) : tile.build;
    return [letter, { ...tile, build: (w, ...rest) => build(noFireflies(w), ...rest) }];
  }));
  return { tiles: day, coarseFamilies: new Set([...shared.coarseFamilies, 'clockwork']), seam: canyonLane };
}

/** Hooks at the generic construction points (tiledPlotCore.mjs): the clock tower stands alone on the plaza; a warm pool
 *  of light round its plinth. */
export const clockworkPlot = {
  builders: layout => clockworkBuilders(layout.builders),
  lanternBake: { gain: 0.6, radius: 1.5, cut: 3 },
  ringInKit: true,
  models() { return undefined; },
  pools(parts, palette) {
    const lit = { Pool: parts.Pool }, plotWriter = { triColours: (part, a, b, c, colours) => lit[part].triColours(part, [a, b, c], colours) };
    pool(plotWriter, 0, 0, 20, palette.gatePool, 0.05);
  },
};
