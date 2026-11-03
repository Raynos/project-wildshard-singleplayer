// OP9 (OPEN-PLOTS wave A, G978): Saltwind Lighthouse's tile vocabulary, after round 75's board
// (art/grid/round-75-new-plot-palettes/04-saltwind-lighthouse.jpg): a northern fishing harbour on black basalt in a squall.
// Every tile is the harbour's own (no market tiles: no stalls, kiosks or hedges), each a wet quay border meeting any
// neighbour ('pppp'):
//   B basin:     a square slate-green basin in basalt quay walls, two fishing boats moored in it, bollards on its coping,
//                lamps at its corners, gulls over it;
//   C cottages:  a terrace of whitewashed black-roofed cottages along the tile's north edge facing in, net racks and pots
//                on the quay before them (variant 1 ends the row in a boathouse, the cottage turned);
//   R nets:      a quay of net-drying racks, lobster pots and buoy posts round a bollard row;
//   P plaza:     a plaza quarter round the lighthouse's plinth (the tile's south-east corner, (HALF, -HALF)): wet stone, a
//                ring of lamps and bollards;
//   N forecourt: an entry quay, lamps either side of the lane in from the road, pots and a net rack in its corners.
// The four avenues are lined with black lamp posts. Every model is a kit family (harbour, lanterns), placed only when the
// layout's kit has it. A stormy late afternoon: no fireflies, warm lamps lit.
import { HALF, pool } from './kit.mjs';

/** Life (bar 7): a gull, a 0.6 m mover in the glow graph's steady mode (red seed in [0.5, 1), no green: drifting slowly,
 *  never blinking to black) at full blue, which the graph lights white (Coral's gull, coral.mjs), low over the basins */
let seeds = 0;
function gull(w, x, y, z) {
  seeds++;
  const c = [((seeds * 0.6180339887) % 1) * 0.5 + 0.5, 0, 1], s = 0.6;
  const top = [x, y + s * 1.4, z], a = [x - s, y - s, z - s], b = [x + s, y - s, z - s], d = [x, y - s, z + s * 1.4];
  w.tri('Glow', top, b, a, c); w.tri('Glow', top, d, b, c); w.tri('Glow', top, a, d, c); w.tri('Glow', a, b, d, c);
}

/** A black lamp post (the kit's post lantern, retinted), its warm pool on the wet stone and its collider. */
function lamp(w, p, x, z, yaw) {
  if (w.hasModel('lanterns')) w.placeModel('lanterns', 0, x, z, { height: 3.4, yaw });
  else {
    w.lanternEmitter?.([x, 3.8, z], [...p.lantern]);
    w.sides('Kit', [x - 0.12, 0, z - 0.12], [x + 0.12, 3.4, z + 0.12], p.iron ?? p.stone);
    w.box('Glow', [x - 0.25, 3.4, z - 0.25], [x + 0.25, 4.1, z + 0.25], p.lantern, p.lantern);
  }
  w.solid([x - 0.15, 0, z - 0.15], [x + 0.15, 3.4, z + 0.15]);
  pool(w, x, z, 3.5, p.pool);
}

/** A black iron bollard on the quay and its collider. */
function bollard(w, p, x, z) {
  const c = p.tar ?? p.iron ?? p.stone;
  w.sides('Kit', [x - 0.22, 0, z - 0.22], [x + 0.22, 0.7, z + 0.22], c);
  w.box('Kit', [x - 0.32, 0.7, z - 0.32], [x + 0.32, 0.85, z + 0.32], c);
  w.solid([x - 0.25, 0, z - 0.25], [x + 0.25, 0.85, z + 0.25]);
}

/** A harbour model (the `harbour` family's variant) at (x, z), turned `yaw`, raised `y`, and its collider box (half sizes
 *  along x and z after the turn, height `h` above `y`). */
function piece(w, variant, x, z, yaw, hx, hz, h, y = 0) {
  if (w.hasModel('harbour')) w.placeModel('harbour', variant, x, z, { yaw, y });
  if (h > 0) w.solid([x - hx, y, z - hz], [x + hx, y + h, z + hz]);
}

/** the basin's water below the quay, and the basin (x0, z0, x1, z1): the tile's middle inside its quay */
const DEPTH = 0.6;
const BASIN = [-20, -20, 20, 20];

/** B basin: the slate-green basin in basalt quay walls with a coping, two boats moored in it (bows toward the tile's
 *  north and south walls in turn), bollards along the coping, a lamp at each corner and gulls over it. */
function basin(w, p, variant) {
  const [x0, z0, x1, z1] = BASIN;
  w.floor('Water', x0, z0, x1, z1, -DEPTH, p.water);
  for (const [xa, za, xb, zb] of [[x0, z1, x0, z0], [x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1]]) {
    w.quad('Kit', [xa, -DEPTH, za], [xb, -DEPTH, zb], [xb, 0, zb], [xa, 0, za], p.basalt ?? p.stone);
  }
  const top = p.stoneTop ?? p.stone;
  for (const [a, b] of [[[x0 - 1, z0 - 1], [x1 + 1, z0]], [[x0 - 1, z1], [x1 + 1, z1 + 1]], [[x0 - 1, z0], [x0, z1]], [[x1, z0], [x1 + 1, z1]]]) {
    w.box('Kit', [a[0], 0, a[1]], [b[0], 0.25, b[1]], p.basalt ?? p.stone, top);
  }
  w.solid([x0, -DEPTH - 0.3, z0], [x1, -DEPTH, z1]);
  // the boats, side by side along x, one bow north and one south (variant swaps them), their colliders their hulls
  for (const [k, x] of [[0, -8], [1, 8]]) {
    const north = (k + variant) % 2 === 0;
    piece(w, 0, x, north ? 3 : -3, north ? Math.PI : 0, 2.1, 6.0, 2.6, -DEPTH);
  }
  for (const t of [-14, -4, 4, 14]) for (const [x, z] of [[t, z0 - 0.6], [t, z1 + 0.6], [x0 - 0.6, t], [x1 + 0.6, t]]) bollard(w, p, x, z);
  for (const s of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) lamp(w, p, s[0] * 23.5, s[1] * 23.5, Math.atan2(-s[0], -s[1]));
  for (const [x, y, z] of variant === 0 ? [[-6, 9, 4], [10, 12, -8]] : [[7, 10, 6], [-9, 13, -5]]) gull(w, x, y, z);
}

/** C cottages: a terrace of whitewashed cottages along the tile's north edge, fronts toward the tile's middle (south),
 *  net racks and pot stacks on the quay before them, a lamp between each pair. `variant` 1 turns the row's west end into
 *  a boathouse facing west. */
function cottages(w, p, variant) {
  const xs = variant === 0 ? [-18, -6, 6, 18] : [-6, 6, 18];
  for (const x of xs) piece(w, 1, x, 19, Math.PI, 4.7, 3.2, 6.4);
  if (variant === 1) piece(w, 1, -20, 15, -Math.PI / 2, 3.2, 4.7, 6.4);
  for (const x of [-12, 0, 12]) lamp(w, p, x, 13, 0);
  for (const [x, z, yaw] of [[-14, 4, 0], [14, 4, 0], [0, -6, Math.PI / 2]]) piece(w, 2, x, z, yaw, yaw === 0 ? 3.2 : 0.3, yaw === 0 ? 0.3 : 3.2, 2.4);
}

/** R nets: a quay of net racks in two rows, pot stacks at their ends (in the racks' model), a bollard row along the
 *  middle, lamps at two corners. `variant` mirrors the racks. */
function nets(w, p, variant) {
  const m = variant === 0 ? 1 : -1;
  for (const [x, z] of [[-12, 12], [8, 14], [-8, -12], [12, -10]]) piece(w, 2, m * x, z, 0, 3.2, 0.3, 2.4);
  for (const x of [-18, -6, 6, 18]) bollard(w, p, x, 1);
  for (const s of [[-1, 1], [1, -1]]) lamp(w, p, m * s[0] * 23.5, s[1] * 23.5, 0);
}

/** P plaza quarter: wet stone round the lighthouse's plinth (11 m into the quarter from its corner), a ring of lamps and
 *  bollards on the quay round it. */
function plaza(w, p) {
  w.floor('Kit', -HALF + 0.02, -HALF + 0.02, HALF - 0.02, HALF - 0.02, 0.03, p.plaza);
  const cx = HALF, cz = -HALF;
  for (const a of [0.15, 0.5, 0.85]) {
    const angle = Math.PI / 2 + a * Math.PI / 2, r = 22;
    lamp(w, p, cx + r * Math.cos(angle), cz + r * Math.sin(angle), 0);
  }
  for (const a of [0.08, 0.3, 0.7, 0.92]) {
    const angle = Math.PI / 2 + a * Math.PI / 2, r = 16;
    bollard(w, p, cx + r * Math.cos(angle), cz + r * Math.sin(angle));
  }
  piece(w, 2, -18, 18, Math.PI / 4, 2.4, 2.4, 2.4);
}

/** N forecourt: the entry quay, its lane in from the road along the tile's east edge (x = HALF), lamps either side of it,
 *  pots and a net rack in its far corner. */
function forecourt(w, p) {
  w.floor('Kit', -22, -22, 27, 27, 0.03, p.forecourt);
  for (const z of [-18, -2, 14]) lamp(w, p, HALF - 9, z, 0);
  piece(w, 2, -16, -16, 0, 3.2, 0.3, 2.4);
  for (const [x, z] of [[-20, 4], [-20, 12], [-8, -20]]) bollard(w, p, x, z);
}

/** where an avenue's lamps stand (plot metres from the plaza along it, either side of the lane), short of the plaza's
 *  plinth and of the road entry's 15 m footprint */
const AVENUE_LAMPS = [40, 64, 88, 112, 136, 160, 184, 208, 226];

/** A lane seam: on the four avenues (the seams on x = 0 and z = 0) a black lamp post either side every 24 m; the other
 *  seams are open quay. */
function harbourLane(w, p, side, centre) {
  if ((side === 0 ? centre[1] : centre[0]) + HALF !== 0) return;
  const along = (u, off) => (side === 0 ? [u, HALF + off] : [HALF + off, -u]);
  const at = list => list.flatMap(r => [r, -r]).map(r => (side === 0 ? r - centre[0] : centre[1] - r)).filter(u => u >= -HALF && u < HALF);
  for (const u of at(AVENUE_LAMPS)) for (const off of [-4.2, 4.2]) { const [x, z] = along(u, off); lamp(w, p, x, z, 0); }
}

/** The far stand-ins (RM11): the quay, the basins' water and their boats as red blocks, the cottages as white walls under
 *  black roofs. */
function farHarbour(w, p, type, variant) {
  w.floor('far', -HALF, -HALF, HALF, HALF, 0, type === 'P' ? p.plaza : p.paving);
  if (type === 'B') {
    const [x0, z0, x1, z1] = BASIN;
    w.floor('far', x0, z0, x1, z1, 0.04, p.water);
    for (const x of [-8, 8]) w.box('far', [x - 1.9, 0, -5.5], [x + 1.9, 1.4, 5.5], p.hull ?? p.stall);
  } else if (type === 'C') {
    for (const x of variant === 0 ? [-18, -6, 6, 18] : [-6, 6, 18]) {
      w.box('far', [x - 4.5, 0, 16], [x + 4.5, 3.2, 22], p.wall);
      w.box('far', [x - 4.8, 3.2, 16.5], [x + 4.8, 5.6, 21.5], p.roof);
    }
  }
}

const THEME = {
  B: { build: basin, far: (w, p, variant) => farHarbour(w, p, 'B', variant), sockets: 'pppp', water: [BASIN] },
  C: { build: cottages, far: (w, p, variant) => farHarbour(w, p, 'C', variant), sockets: 'pppp' },
  R: { build: nets, far: (w, p, variant) => farHarbour(w, p, 'R', variant), sockets: 'pppp' },
  P: { build: plaza, far: (w, p, variant) => farHarbour(w, p, 'P', variant), sockets: 'pppp', variant: 0 },
  N: { build: forecourt, far: (w, p, variant) => farHarbour(w, p, 'N', variant), sockets: 'pppp', variant: 0 },
};

/** The harbour's builders: its five letters and lane seams lined with lamps on the avenues. */
export function saltwindBuilders() {
  return { tiles: THEME, coarseFamilies: new Set(['harbour', 'lanterns']), seam: harbourLane };
}

/** Hooks at the generic construction points (tiledPlotCore.mjs): the lighthouse's lantern room glows cold white (a ring of
 *  Glow panes just inside its glass, layout `landmark.lantern`: [radius, y0, y1] in metres for its own height, stood as the
 *  core stands the landmark), a cold pool at its foot. */
export const saltwindPlot = {
  builders: () => saltwindBuilders(),
  lanternBake: { gain: 0.8, radius: 1.5, cut: 3 },
  ringInKit: true,
  models(parts, _kit, layout) {
    const room = layout.landmark.lantern;
    if (room === undefined) return;
    const [r, y0, y1] = room, sides = 16, colour = [0.92, 0.97, 1];
    for (let i = 0; i < sides; i++) {
      const a0 = 2 * Math.PI * i / sides, a1 = 2 * Math.PI * (i + 1) / sides;
      const at = (a, y) => [r * Math.cos(a), y, r * Math.sin(a)];
      parts.Glow.quad('Glow', at(a0, y0), at(a1, y0), at(a1, y1), at(a0, y1), colour);
    }
  },
  pools(parts, palette) {
    const lit = { Pool: parts.Pool }, plotWriter = { triColours: (part, a, b, c, colours) => lit[part].triColours(part, [a, b, c], colours) };
    pool(plotWriter, 0, 0, 18, palette.gatePool, 0.05);
  },
};
