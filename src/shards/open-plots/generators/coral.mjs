// OB5 (open-plots build-out, G978): Coral Drift's tile vocabulary. The shared letters are Night Market's builders
// (gardens, canals, forecourts, plaza, retinted by the layout's palette: sun-bleached boards, turquoise canals); three
// theme tiles are the lagoon's own, each inset in a boardwalk border that meets any neighbour ('pppp'):
//   B huts:  a turquoise lagoon with two stilt huts and a pier hut standing in it, their decks toward the north
//            boardwalk, a reef cluster between them, gulls over it;
//   M palms: a white-sand grove of the shared palms round a cabana, pale rocks among them (Desert Ruin reuses it);
//   R reef:  a coral pool: staghorn clusters, brain-coral mounds and rock groups in a sand-banked lagoon.
// Their models are the lagoon kit families (scripts/blender/open-plots/lagoon.py: `huts`, `palms`, `reef`), placed
// only when the layout's kit has them, like every kit family.
import { HALF, INNER, pool } from './kit.mjs';
import { nightMarketBuilders } from './nightMarket.mjs';

/** the lagoon's water below the boardwalk (the canal's level, kit.py BRIDGE['water']) */
const DEPTH = 0.45;
/** B's lagoon (x0, z0, x1, z1 at rotation 0): open south, its boardwalk the north strip the huts face */
const HUT_LAGOON = [-INNER + 1, -INNER + 1, INNER - 1, 12];
/** R's pool: the tile's middle inside a boardwalk border */
const REEF_POOL = [-21, -21, 21, 21];
/** M's sand: the tile's middle inside its border */
const GROVE = [-INNER + 0.5, -INNER + 0.5, INNER - 0.5, INNER - 0.5];

/** A stable variant (0 to count - 1) for a piece at tile-local (x, z), so neighbours differ and every bake repeats. */
const pick = (x, z, count, salt = 0) => (((Math.round(x * 4) * 7 + Math.round(z * 4) * 13 + salt) % count) + count) % count;

/** OB5 (bar 7): a gull, a 0.6 m mover in the glow graph's steady mode (red seed in [0.5, 1), no green: drifting slowly,
 *  never blinking to black) at full blue, which the graph lights frost white (sp-o3's tint, frost.mjs `glint`); 0.35 m read
 *  1-2 px from the road entry (sp-o3's bar-7 clip at acc0a955d6). High
 *  over the lagoons, so they are the noon plot's motion seen from the road entry with the lamps' flicker. */
let seeds = 0;
function gull(w, x, y, z) {
  seeds++;
  const c = [((seeds * 0.6180339887) % 1) * 0.5 + 0.5, 0, 1], s = 0.6;
  const top = [x, y + s * 1.4, z], a = [x - s, y - s, z - s], b = [x + s, y - s, z - s], d = [x, y - s, z + s * 1.4];
  w.tri('Glow', top, b, a, c); w.tri('Glow', top, d, b, c); w.tri('Glow', top, a, d, c); w.tri('Glow', a, b, d, c);
}

/** The shared builders' fireflies (Night Market's marked movers: Glow with no green or blue, red in [0, 0.5)) blink to
 *  black, which reads as specks at noon: a lagoon tile's writer drops them and keeps everything else. */
const noFireflies = (w) => new Proxy(w, { get: (target, key) => key === 'tri'
  ? (part, a, b, c, colour, ...rest) => (part === 'Glow' && colour?.[1] === 0 && colour?.[2] === 0 && colour[0] < 0.5 ? undefined : target.tri(part, a, b, c, colour, ...rest))
  : (typeof target[key] === 'function' ? target[key].bind(target) : target[key]) });

/** A lagoon: recessed water, its sand banks walked with the water on their left so they face it, a collision skirt. */
function lagoon(w, p, [x0, z0, x1, z1]) {
  w.floor('Water', x0, z0, x1, z1, -DEPTH, p.water);
  for (const [xa, za, xb, zb] of [[x0, z1, x0, z0], [x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1]]) {
    w.quad('Kit', [xa, -DEPTH, za], [xb, -DEPTH, zb], [xb, 0, zb], [xa, 0, za], p.sand ?? p.paving);
  }
  w.solid([x0, -DEPTH - 0.3, z0], [x1, -DEPTH, z1]);
}

/** A lamp post on the boardwalk (the kit's paper-lantern bracket, retinted) and its pool of light. */
function post(w, x, z, p, yaw) {
  if (w.hasModel('lanterns')) w.placeModel('lanterns', 1, x, z, { height: 2.8, yaw });
  else {
    w.lanternEmitter?.([x, 3.2, z], [...p.lantern]);
    w.sides('Kit', [x - 0.09, 0, z - 0.09], [x + 0.09, 2.8, z + 0.09], p.wood);
    w.box('Glow', [x - 0.25, 2.8, z - 0.25], [x + 0.25, 3.5, z + 0.25], p.lantern, p.lantern);
  }
  w.solid([x - 0.12, 0, z - 0.12], [x + 0.12, 2.8, z + 0.12]);
  pool(w, x, z, 4, p.pool);
}

/** A palm at (x, z): the shared palm family's variant there (or a trunk and a green crown box without the kit), its
 *  trunk the collider. */
function palm(w, p, x, z, variant) {
  if (w.hasModel('palms')) w.placeModel('palms', variant, x, z, { yaw: pick(x, z, 8) * Math.PI / 4 });
  else {
    w.sides('Kit', [x - 0.25, 0, z - 0.25], [x + 0.25, 7, z + 0.25], p.trunk);
    w.box('Kit', [x - 2, 7, z - 2], [x + 2, 8.2, z + 2], p.foliage);
  }
  w.solid([x - 0.35, 0, z - 0.35], [x + 0.35, 6, z + 0.35]);
}

/** B huts: two stilt huts and a pier hut standing in the lagoon, decks toward the north boardwalk, reef between them,
 *  palms on the sand corners, lamps along the boardwalk. `variant` swaps the huts' order. */
function huts(w, p, variant) {
  lagoon(w, p, HUT_LAGOON);
  const placed = variant === 0 ? [[-15, 5, 0], [3, 5, 1], [18, 4, 0]] : [[-17, 4, 0], [-1, 5, 1], [16, 5, 0]];
  for (const [x, z, kind] of placed) {
    // a model's front is +z at yaw 0: the decks face the north boardwalk (lagoon.py)
    if (w.hasModel('huts')) w.placeModel('huts', kind, x, z, { yaw: 0 });
    w.solid(kind === 1 ? [x - 2.8, -DEPTH, z - 4.6] : [x - 3, -DEPTH, z - 2.5], kind === 1 ? [x + 2.8, 1.0, z + 6.2] : [x + 3, 1.5, z + 3.9]);
  }
  if (w.hasModel('reef')) {
    for (const [x, z, v] of [[-6, -14, 0], [12, -17, 1], [-22, -18, 2], [23, -20, 0]]) w.placeModel('reef', v, x, z, { yaw: pick(x, z, 4) * Math.PI / 2 });
  }
  for (const x of [-22, -6, 10, 24]) post(w, x, 14.5, p, Math.PI);
  for (const [x, y, z] of variant === 0 ? [[-12, 11, -6], [9, 14, -14], [20, 12, 2]] : [[-19, 13, -12], [4, 11, -4], [14, 15, -18]]) gull(w, x, y, z);
}

/** The palm grove (M): white sand inside its border, palms in a loose ring, a cabana at its middle, pale rocks among
 *  them, lamp posts at its corners. Exported for any plot that plants the shared palm tile (Desert Ruin). */
export function palms(w, p, variant) {
  const [x0, z0, x1, z1] = GROVE;
  w.floor('Kit', x0, z0, x1, z1, 0.02, p.sand ?? p.paving);
  const spots = variant === 0
    ? [[-18, -16, 0], [-6, -21, 1], [9, -18, 2], [20, -9, 0], [21, 8, 1], [11, 19, 0], [-4, 20, 2], [-17, 14, 1], [-21, 1, 2], [0, -9, 2]]
    : [[-20, -12, 1], [-9, -20, 0], [5, -21, 2], [18, -15, 1], [20, 4, 0], [14, 18, 2], [0, 21, 1], [-15, 18, 0], [-21, 5, 2], [8, 9, 2]];
  for (const [x, z, v] of spots) palm(w, p, x, z, v);
  if (w.hasModel('huts')) w.placeModel('huts', 2, variant === 0 ? 4 : -3, variant === 0 ? 4 : -2, { yaw: pick(variant, 1, 4) * Math.PI / 2 });
  w.solid([-2.2 + (variant === 0 ? 4 : -3), 0, -2.2 + (variant === 0 ? 4 : -2)], [2.2 + (variant === 0 ? 4 : -3), 2.5, 2.2 + (variant === 0 ? 4 : -2)]);
  if (w.hasModel('reef')) for (const [x, z] of [[-11, -6], [13, -3], [-6, 12]]) w.placeModel('reef', 2, x, z, { yaw: pick(x, z, 4, 3) * Math.PI / 2 });
  for (const s of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) post(w, s[0] * 26.5, s[1] * 26.5, p, Math.atan2(-s[0], -s[1]));
}

/** R reef: a coral pool in a boardwalk ring, staghorn clusters, brain-coral mounds and rock groups in it, a lamp post on
 *  each corner. */
function reef(w, p, variant) {
  lagoon(w, p, REEF_POOL);
  if (w.hasModel('reef')) {
    const spots = variant === 0
      ? [[-11, -10, 0], [11, 9, 0], [-12, 12, 1], [12, -12, 1], [-17, 0, 2], [17, 3, 0], [0, -17, 1], [2, 17, 2], [0, 0, 0]]
      : [[-10, 11, 0], [10, -10, 0], [12, 12, 1], [-12, -12, 1], [0, 17, 0], [-17, -3, 2], [17, 0, 1], [-3, -17, 2], [0, 0, 1]];
    for (const [x, z, v] of spots) w.placeModel('reef', v, x, z, { yaw: pick(x, z, 4, v) * Math.PI / 2 });
  }
  for (const s of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) post(w, s[0] * 23.5, s[1] * 23.5, p, Math.atan2(-s[0], -s[1]));
  for (const [x, y, z] of variant === 0 ? [[-8, 12, 6], [10, 15, -9]] : [[7, 13, 9], [-11, 10, -7]]) gull(w, x, y, z);
}

/** The far stand-ins (RM11): each lagoon's water, the huts' boxes and blue roofs, the palms as green crowns on posts. */
function farLagoon(w, p, type, variant) {
  w.floor('far', -HALF, -HALF, HALF, HALF, 0, type === 'M' ? (p.sand ?? p.paving) : p.paving);
  if (type === 'M') {
    for (const [x, z] of variant === 0 ? [[-18, -16], [9, -18], [21, 8], [-4, 20], [-21, 1]] : [[-20, -12], [5, -21], [20, 4], [0, 21], [-21, 5]]) {
      w.box('far', [x - 2.2, 6, z - 2.2], [x + 2.2, 7.4, z + 2.2], p.foliage);
    }
    return;
  }
  const [x0, z0, x1, z1] = type === 'B' ? HUT_LAGOON : REEF_POOL;
  w.floor('far', x0, z0, x1, z1, 0.04, p.water);
  if (type === 'B') {
    for (const [x, z] of variant === 0 ? [[-15, 5], [3, 5], [18, 4]] : [[-17, 4], [-1, 5], [16, 5]]) {
      w.sides('far', [x - 2.5, 1.4, z - 2], [x + 2.5, 3.9, z + 2], p.wall);
      w.box('far', [x - 3.2, 3.9, z - 2.7], [x + 3.2, 5.2, z + 2.7], p.hutRoof ?? p.roof);
    }
  } else for (const [x, z] of [[-11, -10], [11, 9], [-12, 12], [12, -12]]) w.box('far', [x - 2, 0, z - 2], [x + 2, 1.4, z + 2], p.coralPink ?? p.foliage);
}

const THEME = {
  B: { build: huts, far: (w, p, variant) => farLagoon(w, p, 'B', variant), sockets: 'pppp', water: [HUT_LAGOON] },
  M: { build: palms, far: (w, p, variant) => farLagoon(w, p, 'M', variant), sockets: 'pppp' },
  R: { build: reef, far: (w, p, variant) => farLagoon(w, p, 'R', variant), sockets: 'pppp', water: [REEF_POOL] },
};

/** The lagoon's builders: a layout's shared letters (Night Market's kinds, `layout.builders`) plus B, M and R. */
export function coralDriftBuilders(letters) {
  const shared = nightMarketBuilders(letters);
  for (const letter of Object.keys(THEME)) if (Object.hasOwn(shared.tiles, letter)) throw new Error(`coral-drift: letter ${letter} is a theme tile`);
  const noon = Object.fromEntries(Object.entries(shared.tiles).map(([letter, tile]) => [letter, { ...tile, build: (w, ...rest) => tile.build(noFireflies(w), ...rest) }]));
  const seam = shared.seam === undefined ? undefined : (w, ...rest) => shared.seam(noFireflies(w), ...rest);
  return { tiles: { ...noon, ...THEME }, coarseFamilies: new Set([...shared.coarseFamilies, 'huts', 'palms']), seam };
}

/** Hooks at the generic construction points (tiledPlotCore.mjs): the arch stands alone over the plaza (no lanterns of
 *  its own: noon), warm-white pools of light under it. */
export const coralDriftPlot = {
  builders: layout => coralDriftBuilders(layout.builders),
  lanternBake: { gain: 0.6, radius: 1.5, cut: 3 },
  // T8: the ring in the kit's draw (Lantern Bayou's 99290a64f1), so an edge tile holds Kit, Water, Glow and Pool
  ringInKit: true,
  // the arch hangs no lanterns (noon): nothing to place beyond the layout's tiles
  models() { return undefined; },
  pools(parts, palette) {
    const lit = { Pool: parts.Pool }, plotWriter = { triColours: (part, a, b, c, colours) => lit[part].triColours(part, [a, b, c], colours) };
    pool(plotWriter, 0, 0, 22, palette.gatePool, 0.05);
  },
};
