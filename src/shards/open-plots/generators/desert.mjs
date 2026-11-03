// OP12 (OPEN-PLOTS wave B, G978): Desert Ruin's tile vocabulary, after round 62's board
// (art/grid/round-62-open-plot-palettes/14-desert-ruin.jpg: harsh white-gold noon, bleached sand, deep blue oasis). The
// shared letters are Night Market's builders (forecourts and gardens, retinted: bleached sandstone paving); its plaza is
// Desert Ruin's own, because the gateway stands across the shared plaza's stall rows. Theme tiles, each a paved border
// meeting any neighbour ('pppp'):
//   O oasis: a deep blue pool in a sandstone coping, palms round it, a blue-awning tent and pots on its bank, birds over it;
//   M palms: Coral Drift's shared palm grove (coral.mjs `palms`), on bleached sand;
//   R ruins: a ruin court of the shared ruin-stone pieces (an arch, an L of wall, column stumps, rubble) on sand, a palm
//            or two among them, sandstone lamps at its mouth;
//   K tents: two rows of the kit's stalls under deep blue awnings facing a sandstone aisle, pots and crates behind them,
//            birds over the aisle (bar 7's second source beside the lamps).
// Every model is a shared kit family (lanterns, palms, huts, ruins, rubble, stalls, props), placed only when the layout's
// kit has it.
import { HALF, INNER, pool } from './kit.mjs';
import { nightMarketBuilders } from './nightMarket.mjs';
import { palms as palmGrove } from './coral.mjs';

/** the oasis water below its coping */
const DEPTH = 0.6;
/** O's pool (x0, z0, x1, z1): the tile's middle inside its 1.2 m coping and the sand banks round it */
const POOL = [-22, -22, 22, 22];
/** the gateway's half footprint on the plaza (gateway.py at the layout's 52 m, `stand()` centred: about 29 m wide
 *  and 13 m deep with its fallen blocks), plus the walk round it: the plaza quarter dresses only outside it */
const GATEWAY = { x: 34, z: 14 };

/** A stable variant (0 to count - 1) for a piece at tile-local (x, z), so neighbours differ and every bake repeats. */
const pick = (x, z, count, salt = 0) => (((Math.round(x * 4) * 7 + Math.round(z * 4) * 13 + salt) % count) + count) % count;

/** each ruin piece's kit family and variant (ruins.py: arch, L wall, terrace; rubble, columns) */
const RUIN_MODELS = [['ruins', 0], ['ruins', 1], ['rubble', 0], ['rubble', 1], ['ruins', 2]];
/** each ruin piece's collision boxes at yaw 0 (tile-local metres; ruins.py: a piece's front is +z), as mosslight.mjs */
const RUIN_SOLIDS = [
  [[-4.7, 0, -0.9, -3.1, 7.4, 0.9], [3.1, 0, -0.9, 4.7, 7.4, 0.9]],
  [[-5, 0, -0.5, 5, 6, 0.5], [-5, 0, -7, -4, 6, -0.5]],
  [[-2.2, 0, -2.2, 2.2, 1.6, 2.2]],
  [[-6, 0, -1.6, 6, 0.8, 1.6], [-4.4, 0, -0.8, -2.8, 6.1, 0.8], [-0.8, 0, -0.8, 0.8, 4, 0.8], [2.8, 0, -0.8, 4.4, 2.8, 0.8]],
  [[-4.5, 0, -2.1, 4.5, 0.6, 2.1], [-4.5, 0, -2.1, 4.5, 1.2, 0.7], [-4.5, 0, -2.1, 4.5, 1.8, -0.7], [-4.5, 0, -2.1, 4.5, 3, -1.5]],
];
/** the ruin courts' scale (round 62's ruins stand taller than a person by far) */
const RUIN_SCALE = 1.5;

/** A ruin piece at tile-local (x, z), turned `turns` quarter turns, scaled `scale`, and its colliders. */
function ruin(w, piece, x, z, turns, scale = RUIN_SCALE) {
  const yaw = turns * Math.PI / 2, c = Math.round(Math.cos(yaw)), s = Math.round(Math.sin(yaw));
  const [family, variant] = RUIN_MODELS[piece] ?? ['ruins', 0];
  if (w.hasModel(family)) w.placeModel(family, variant, x, z, { yaw, scale });
  for (const [x0, y0, z0, x1, y1, z1] of RUIN_SOLIDS[piece] ?? []) {
    const ax = (x0 * c + z0 * s) * scale, az = (-x0 * s + z0 * c) * scale, bx = (x1 * c + z1 * s) * scale, bz = (-x1 * s + z1 * c) * scale;
    w.solid([x + Math.min(ax, bx), y0 * scale, z + Math.min(az, bz)], [x + Math.max(ax, bx), y1 * scale, z + Math.max(az, bz)]);
  }
}

/** Life (bar 7): a white bird, an `s` m mover in the glow graph's steady mode (red seed in [0.5, 1), no green: drifting
 *  slowly, never blinking to black) at full blue, which the graph lights white (Jungle's egret, jungle.mjs) */
let seeds = 0;
function bird(w, x, y, z, s = 1.2) {
  seeds++;
  const c = [((seeds * 0.6180339887) % 1) * 0.5 + 0.5, 0, 1];
  const top = [x, y + s * 1.4, z], a = [x - s, y - s, z - s], b = [x + s, y - s, z - s], d = [x, y - s, z + s * 1.4];
  w.tri('Glow', top, b, a, c); w.tri('Glow', top, d, b, c); w.tri('Glow', top, a, d, c); w.tri('Glow', a, b, d, c);
}

/** A palm from the shared family, else a trunk and a green crown, its trunk the collider. */
function palm(w, p, x, z) {
  if (w.hasModel('palms')) w.placeModel('palms', pick(x, z, 3), x, z, { yaw: pick(x, z, 8, 1) * Math.PI / 4 });
  else {
    w.sides('Kit', [x - 0.25, 0, z - 0.25], [x + 0.25, 7, z + 0.25], p.trunk);
    w.box('Kit', [x - 2, 7, z - 2], [x + 2, 8.2, z + 2], p.foliage);
  }
  w.solid([x - 0.35, 0, z - 0.35], [x + 0.35, 6, z + 0.35]);
}

/** A sandstone lamp (the kit's stone post lantern, retinted warm) and its pool of light. */
function lamp(w, p, x, z) {
  if (w.hasModel('lanterns')) w.placeModel('lanterns', 0, x, z, { height: 2.6, yaw: 0 });
  else {
    w.lanternEmitter?.([x, 3.0, z], [...p.lantern]);
    w.sides('Kit', [x - 0.15, 0, z - 0.15], [x + 0.15, 2.6, z + 0.15], p.stone);
    w.box('Glow', [x - 0.3, 2.6, z - 0.3], [x + 0.3, 3.3, z + 0.3], p.lantern, p.lantern);
  }
  w.solid([x - 0.2, 0, z - 0.2], [x + 0.2, 2.6, z + 0.2]);
  pool(w, x, z, 3, p.pool);
}

/** A blue-awning tent (the kit's row stall) facing `yaw`, its counter the collider. */
function tent(w, x, z, yaw) {
  if (w.hasModel('stalls')) w.placeModel('stalls', 1, x, z, { yaw });
  const across = Math.abs(Math.sin(yaw)) > 0.5;
  w.solid(across ? [x - 1.5, 0, z - 2.1] : [x - 2.1, 0, z - 1.5], across ? [x + 1.5, 1.1, z + 2.1] : [x + 2.1, 1.1, z + 1.5]);
}

/** Pots and crates (the kit's crate stack) at (x, z). */
function goods(w, x, z, yaw) {
  if (w.hasModel('props')) { w.placeModel('props', 2, x, z, { yaw }); w.solid([x - 0.7, 0, z - 0.7], [x + 0.7, 0.8, z + 0.7]); }
}

/** O oasis: a deep blue pool in a sandstone coping, steps down on its south side, palms round its banks, a tent and goods
 *  on its north bank. `variant` swaps the tent's side. */
function oasis(w, p, variant) {
  const [x0, z0, x1, z1] = POOL;
  // the sand round the pool, never over it (Jungle's R1 lesson: a floor across the tile hides sunken water)
  for (const [a, b, c, d] of [[-INNER, -INNER, INNER, z0], [-INNER, z1, INNER, INNER], [-INNER, z0, x0, z1], [x1, z0, INNER, z1]]) w.floor('Kit', a, b, c, d, 0.03, p.sand ?? p.paving);
  w.floor('Water', x0, z0, x1, z1, -DEPTH, p.water);
  for (const [xa, za, xb, zb] of [[x0, z1, x0, z0], [x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1]]) {
    w.quad('Kit', [xa, -DEPTH, za], [xb, -DEPTH, zb], [xb, 0, zb], [xa, 0, za], p.stone);
  }
  w.solid([x0, -DEPTH - 0.3, z0], [x1, -DEPTH, z1]);
  const c = 1.2, h = 0.45;
  for (const [a, b] of [[[x0 - c, z0 - c], [x1 + c, z0]], [[x0 - c, z1], [x1 + c, z1 + c]], [[x0 - c, z0], [x0, z1]], [[x1, z0], [x1 + c, z1]]]) {
    w.box('Kit', [a[0], 0, a[1]], [b[0], h, b[1]], p.stone, p.stoneTop); w.solid([a[0], 0, a[1]], [b[0], h, b[1]]);
  }
  for (const [x, z] of [[-25.5, -25.5], [-25.5, -8], [-25.5, 10], [25.5, -18], [25.5, 4], [25.5, 25.5], [-10, -25.5], [8, -25.5]]) palm(w, p, variant === 0 ? x : -x, z);
  const tx = variant === 0 ? -8 : 8;
  tent(w, tx, 25.5, Math.PI); tent(w, tx + (variant === 0 ? 7 : -7), 25.5, Math.PI);
  goods(w, tx + (variant === 0 ? 14 : -14), 25.5, 0);
  lamp(w, p, variant === 0 ? -25.5 : 25.5, 25.5);
  bird(w, -6, 10, 4); bird(w, 8, 12, -6);
}

/** R ruins: a ruin court on sand after round 62's edges: an arch across its back (north), the wall's L in both back
 *  corners, column stumps down the sides, rubble between, two palms, sandstone lamps at its mouth (south). */
function ruinCourt(w, p, variant) {
  const m = variant === 0 ? 1 : -1;
  w.floor('Kit', -INNER, -INNER, INNER, INNER, 0.03, p.sand ?? p.paving);
  ruin(w, 0, 0, 20, 0);
  ruin(w, 1, m * -15, 16, variant === 0 ? 0 : 1);
  ruin(w, 1, m * 15, 16, variant === 0 ? 1 : 0);
  ruin(w, 3, m * -18, -4, 1); ruin(w, 3, m * 18, -2, 3);
  ruin(w, 4, m * 4, 4, 0);
  for (const [x, z] of [[-8, -10], [10, -12], [-20, -18], [20, 10]]) ruin(w, 2, m * x, z, 0);
  for (const [x, z] of [[-24, 4], [12, 22]]) palm(w, p, m * x, z);
  for (const x of [-5, 5]) lamp(w, p, x, -INNER + 3);
}

/** K tents: two rows of four blue-awning stalls facing a sandstone aisle (north-south), goods behind every other one,
 *  lamps at the aisle's ends. Symmetric under every turn's mirror. */
function tentRows(w, p) {
  w.floor('Kit', -INNER, -INNER, INNER, INNER, 0.03, p.sand ?? p.paving);
  w.floor('Kit', -6, -INNER, 6, INNER, 0.05, p.court);
  for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
    const z = -16.5 + i * 11, x = side * 10;
    tent(w, x, z, -side * Math.PI / 2);
    if (i % 2 === 0) goods(w, side * 15, z, -side * Math.PI / 2);
  }
  for (const [x, z] of [[-24, -24], [24, 24], [-24, 24], [24, -24]]) palm(w, p, x, z);
  for (const z of [-26, 26]) for (const x of [-4.5, 4.5]) lamp(w, p, x, z);
  bird(w, -2, 9, -8); bird(w, 3, 11, 10);
}

/** The plaza quarter (its corner (HALF, -HALF) is the plaza's centre): bleached sandstone paving under the gateway,
 *  and outside the gateway's footprint column stumps and rubble along the quarter's outer edges, a palm pair, pots,
 *  and a lamp pair flanking each lane in. Diagonal-symmetric, so the four turned quarters mirror. */
function plaza(w, p) {
  w.floor('Kit', -HALF + 0.02, -HALF + 0.02, HALF - 0.02, HALF - 0.02, 0.03, p.plaza);
  // (a, b): metres from the gateway's centre along the tile's two lanes in (a west of the east lane, b north of the south)
  const at = (a, b) => [HALF - a, -HALF + b];
  for (const d of [GATEWAY.x + 6, GATEWAY.x + 22]) {
    const [x1, z1] = at(5, d), [x2, z2] = at(d, 5);
    lamp(w, p, x1, z1); lamp(w, p, x2, z2);
  }
  const [cx, cz] = at(48, 48); ruin(w, 3, cx, cz, 0, 1.2);
  for (const [a, b] of [[56, 30], [30, 56]]) { const [x, z] = at(a, b); palm(w, p, x, z); }
  for (const [a, b] of [[40, 22], [22, 40]]) { const [x, z] = at(a, b); goods(w, x, z, 0); }
  const [rx, rz] = at(56, 56); ruin(w, 2, rx, rz, 0, 1.2);
}

/** The far stand-ins (RM11): each tile's sand, the oasis water, ruins and tents as boxes, palms as green crowns. */
function farDesert(w, p, type, variant) {
  w.floor('far', -HALF, -HALF, HALF, HALF, 0, p.sand ?? p.paving);
  if (type === 'O') {
    const [x0, z0, x1, z1] = POOL;
    w.floor('far', x0, z0, x1, z1, 0.04, p.water);
    for (const [x, z] of [[-25.5, -25.5], [25.5, 4], [-25.5, 10], [25.5, 25.5]]) w.box('far', [x - 2.4, 6, z - 2.4], [x + 2.4, 7.6, z + 2.4], p.foliage);
    return;
  }
  if (type === 'K') {
    for (const side of [-1, 1]) w.box('far', [side * 10 - 2, 0, -20], [side * 10 + 2, 3.2, 20], p.stallRoof ?? p.roof);
    return;
  }
  const m = variant === 0 ? 1 : -1, k = RUIN_SCALE;
  for (const [x, z, hx, hz, h] of [[0, 20, 4.8, 1, 7.4], [-15, 16, 5, 1, 6], [15, 16, 5, 1, 6], [-18, -4, 1.6, 6, 4], [18, -2, 1.6, 6, 4]]) {
    w.box('far', [m * x - hx * k, 0, z - hz * k], [m * x + hx * k, h * k, z + hz * k], p.ruin ?? p.stone);
  }
}

/** A lane seam: on the four avenues a sandstone lamp either side every 26 m, clear of the road entries and the gateway;
 *  on the other seams a lamp at each crossing corner. */
function desertLane(w, p, side, centre) {
  const along = (u, off) => (side === 0 ? [u, HALF + off] : [HALF + off, -u]);
  const world = (x, z) => [centre[0] + x, centre[1] + z];
  const blocked = (x, z) => { const [wx, wz] = world(x, z), margin = 1.5;
    return (Math.abs(wx) < 4 + margin && Math.abs(wz) > 235 - margin) || (Math.abs(wz) < 4 + margin && Math.abs(wx) > 235 - margin)
      || (Math.abs(wx) < GATEWAY.x + 2 && Math.abs(wz) < GATEWAY.z + 2); };
  const avenue = (side === 0 ? centre[1] : centre[0]) + HALF === 0;
  const spots = avenue ? [-HALF + 5, -HALF + 31, HALF - 5] : [-HALF + 4, HALF - 4];
  for (const u of spots) for (const off of [-4.5, 4.5]) {
    const [x, z] = along(u, off);
    if (!blocked(x, z)) lamp(w, p, x, z);
  }
}

/** The shared builders' fireflies blink to black, specks at noon: a desert tile's writer drops them (coral.mjs) */
const noFireflies = (w) => new Proxy(w, { get: (target, key) => key === 'tri'
  ? (part, a, b, c, colour, ...rest) => (part === 'Glow' && colour?.[1] === 0 && colour?.[2] === 0 && colour[0] < 0.5 ? undefined : target.tri(part, a, b, c, colour, ...rest))
  : (typeof target[key] === 'function' ? target[key].bind(target) : target[key]) });

const THEME = {
  O: { build: oasis, far: (w, p, variant) => farDesert(w, p, 'O', variant), sockets: 'pppp', water: [POOL] },
  M: { build: palmGrove, far: (w, p, variant) => farDesert(w, p, 'M', variant), sockets: 'pppp' },
  R: { build: ruinCourt, far: (w, p, variant) => farDesert(w, p, 'R', variant), sockets: 'pppp' },
  K: { build: tentRows, far: (w, p, variant) => farDesert(w, p, 'K', variant), sockets: 'pppp' },
};

/** Desert Ruin's builders: a layout's shared letters (Night Market's kinds, `layout.builders`, their fireflies left out
 *  at noon) with its plaza replaced by Desert Ruin's, plus O, M, R and K, and its lamp-lined lane seams. */
export function desertBuilders(letters) {
  const shared = nightMarketBuilders(letters);
  for (const letter of Object.keys(THEME)) if (Object.hasOwn(shared.tiles, letter)) throw new Error(`desert-ruin: letter ${letter} is a theme tile`);
  const day = Object.fromEntries(Object.entries(shared.tiles).map(([letter, tile]) => [letter, { ...tile, build: (w, ...rest) => tile.build(noFireflies(w), ...rest) }]));
  for (const [letter, kind] of Object.entries(letters ?? { P: 'plaza' })) if (kind === 'plaza' && day[letter] !== undefined) day[letter] = { ...day[letter], build: plaza };
  return { tiles: { ...day, ...THEME }, coarseFamilies: new Set([...shared.coarseFamilies, 'palms', 'ruins', 'rubble']), seam: desertLane };
}

/** Hooks at the generic construction points (tiledPlotCore.mjs): the gateway stands alone over the plaza (noon: no
 *  lanterns of its own), the lamps' warm pools the only added light. */
export const desertRuinPlot = {
  builders: layout => desertBuilders(layout.builders),
  lanternBake: { gain: 0.6, radius: 1.5, cut: 3 },
  ringInKit: true,
  models() { return undefined; },
  pools() { return undefined; },
};
