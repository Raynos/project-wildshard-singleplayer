// OP13 (OPEN-PLOTS wave A, G978): Jungle Ziggurat's tile vocabulary, after round 75's board
// (art/grid/round-75-new-plot-palettes/02-jungle-ziggurat.jpg). The shared letters are Night Market's builders (gardens and
// forecourts, retinted by the layout's palette: wet tan paving, cinnabar kiosks); its plaza is Jungle's own, because the
// ziggurat's 70 m base fills the shared plaza's stall rows. Three theme tiles, each a paved border meeting any neighbour ('pppp'):
//   J pool:  a square jade pool in a cream coping, fed by a stepped waterfall off its north edge, lily pads, a stone lamp on
//            each corner and egrets over the water;
//   U house: two thatched stilt houses (the shared `huts` family) on a cream platform among round trees and palms;
//   T stele: two rows of painted steles (cinnabar shafts, turquoise and saffron bands, a cream glyph panel) along a paved
//            walk, planters of red flowers and round trees, stone lamps at the walk's ends.
// Every model is a shared kit family (lanterns, trees, huts, palms), placed only when the layout's kit has it.
import { HALF, INNER, pool } from './kit.mjs';
import { nightMarketBuilders } from './nightMarket.mjs';

/** the pool's water below its coping */
const DEPTH = 0.6;
/** J's pool (x0, z0, x1, z1): the tile's middle inside its coping, its north side short of the waterfall */
const POOL = [-22, -22, 22, 17];
/** the ziggurat's half footprint on the plaza (ziggurat.py at the layout's 54 m, `stand()` centred: its base course 40 m
 *  from the centre), plus the walk round it: the plaza quarter dresses only outside it */
const ZIGGURAT = 48;
/** each of its four stairs (one up each face, on the lanes in): its half width with the balustrades and its foot's
 *  distance from the centre, plus a walk either side; the lanes' lamps and the plaza's dressing stand outside it */
const STAIR = { half: 12, foot: 63 };

/** A stable variant (0 to count - 1) for a piece at tile-local (x, z), so neighbours differ and every bake repeats. */
const pick = (x, z, count, salt = 0) => (((Math.round(x * 4) * 7 + Math.round(z * 4) * 13 + salt) % count) + count) % count;

/** Life (bar 7): an egret, an `s` m (0.6 m by default) mover in the glow graph's steady mode (red seed in [0.5, 1), no
 *  green: drifting slowly, never blinking to black) at full blue, which the graph lights white (Coral's gull, coral.mjs) */
let seeds = 0;
function egret(w, x, y, z, s = 0.6) {
  seeds++;
  const c = [((seeds * 0.6180339887) % 1) * 0.5 + 0.5, 0, 1];
  const top = [x, y + s * 1.4, z], a = [x - s, y - s, z - s], b = [x + s, y - s, z - s], d = [x, y - s, z + s * 1.4];
  w.tri('Glow', top, b, a, c); w.tri('Glow', top, d, b, c); w.tri('Glow', top, a, d, c); w.tri('Glow', a, b, d, c);
}

/** The shared builders' fireflies (Glow with no green or blue, red in [0, 0.5)) blink to black, specks by day: a jungle
 *  tile's writer drops them and keeps everything else (coral.mjs's noon writer) */
const noFireflies = (w) => new Proxy(w, { get: (target, key) => key === 'tri'
  ? (part, a, b, c, colour, ...rest) => (part === 'Glow' && colour?.[1] === 0 && colour?.[2] === 0 && colour[0] < 0.5 ? undefined : target.tri(part, a, b, c, colour, ...rest))
  : (typeof target[key] === 'function' ? target[key].bind(target) : target[key]) });

/** A stone lamp (the kit's stone post lantern, retinted warm) and its pool of light. */
function lamp(w, p, x, z, yaw = 0) {
  if (w.hasModel('lanterns')) w.placeModel('lanterns', 0, x, z, { height: 2.6, yaw });
  else {
    w.lanternEmitter?.([x, 3.0, z], [...p.lantern]);
    w.sides('Kit', [x - 0.15, 0, z - 0.15], [x + 0.15, 2.6, z + 0.15], p.stone);
    w.box('Glow', [x - 0.3, 2.6, z - 0.3], [x + 0.3, 3.3, z + 0.3], p.lantern, p.lantern);
  }
  w.solid([x - 0.2, 0, z - 0.2], [x + 0.2, 2.6, z + 0.2]);
  pool(w, x, z, 3.5, p.pool);
}

/** A round-canopy tree from the kit (round, tall or willow by place), else a trunk and a green crown, and its trunk's collider. */
function tree(w, p, x, z, size) {
  if (w.hasModel('trees')) w.placeModel('trees', pick(x, z, 2), x, z, { yaw: pick(x, z, 8) * Math.PI / 4, scale: size * 1.1 / 8 });
  else {
    w.sides('Kit', [x - 0.3, 0, z - 0.3], [x + 0.3, size * 0.45, z + 0.3], p.trunk);
    w.box('Kit', [x - size * 0.42, size * 0.45, z - size * 0.42], [x + size * 0.42, size, z + size * 0.42], p.foliage, p.foliage);
  }
  w.solid([x - 0.35, 0, z - 0.35], [x + 0.35, 3, z + 0.35]);
}

/** A palm from the shared family (Coral's), else a trunk and a green crown box, its trunk the collider. */
function palm(w, p, x, z) {
  if (w.hasModel('palms')) w.placeModel('palms', pick(x, z, 3), x, z, { yaw: pick(x, z, 8, 1) * Math.PI / 4 });
  else {
    w.sides('Kit', [x - 0.25, 0, z - 0.25], [x + 0.25, 7, z + 0.25], p.trunk);
    w.box('Kit', [x - 2, 7, z - 2], [x + 2, 8.2, z + 2], p.foliage);
  }
  w.solid([x - 0.35, 0, z - 0.35], [x + 0.35, 6, z + 0.35]);
}

/** A raised planter of red flowers: a cream kerb, a lawn top and a few flower heads (boxes) on it. */
function planter(w, p, x, z, hx, hz) {
  w.box('Kit', [x - hx, 0, z - hz], [x + hx, 0.6, z + hz], p.stone, p.lawn);
  for (let i = 0; i < 6; i++) {
    const fx = x - hx + 0.8 + (2 * hx - 1.6) * ((i * 0.37) % 1), fz = z - hz + 0.8 + (2 * hz - 1.6) * ((i * 0.61) % 1);
    w.box('Kit', [fx - 0.35, 0.6, fz - 0.35], [fx + 0.35, 1.05, fz + 0.35], p.flowerRed ?? p.awning);
  }
  w.solid([x - hx, 0, z - hz], [x + hx, 0.6, z + hz]);
}

/** A painted stele facing +z (turned by `yaw`'s sign): a cream plinth, a cinnabar shaft with a turquoise band and a saffron
 *  band, a cream glyph panel on its face with turquoise frets, a saffron cap. About 4.6 m tall, 120 triangles. */
function stele(w, p, x, z, face) {
  const cin = p.cinnabar ?? p.stall, tur = p.turquoise ?? p.water, saf = p.saffron ?? p.lantern, cream = p.stoneTop;
  w.box('Kit', [x - 1.0, 0, z - 0.8], [x + 1.0, 0.5, z + 0.8], p.stone, cream);
  w.sides('Kit', [x - 0.7, 0.5, z - 0.45], [x + 0.7, 4.1, z + 0.45], cin);
  w.sides('Kit', [x - 0.74, 1.3, z - 0.49], [x + 0.74, 1.75, z + 0.49], tur);
  w.sides('Kit', [x - 0.74, 3.25, z - 0.49], [x + 0.74, 3.6, z + 0.49], saf);
  w.box('Kit', [x - 0.85, 4.1, z - 0.6], [x + 0.85, 4.6, z + 0.6], saf, saf);
  // the glyph panel and its frets, a little proud of the face toward `face` (+1: +z, -1: -z)
  const f = z + face * 0.47, g = z + face * 0.5;
  const panel = (x0, y0, x1, y1, colour, at) => (face > 0
    ? w.quad('Kit', [x0, y0, at], [x1, y0, at], [x1, y1, at], [x0, y1, at], colour)
    : w.quad('Kit', [x1, y0, at], [x0, y0, at], [x0, y1, at], [x1, y1, at], colour));
  panel(x - 0.5, 1.95, x + 0.5, 3.05, cream, f);
  panel(x - 0.36, 2.15, x - 0.04, 2.47, tur, g); panel(x + 0.04, 2.15, x + 0.36, 2.47, tur, g);
  panel(x - 0.36, 2.55, x + 0.36, 2.85, cin, g);
  w.solid([x - 1.0, 0, z - 0.8], [x + 1.0, 4.6, z + 0.8]);
}

/** J pool: a jade pool in a cream coping, a stepped waterfall feeding it off its north edge (three stone steps, a water
 *  sheet down each riser, foam at its foot), lily pads, a stone lamp on each corner, two trees behind the falls and
 *  egrets over the water. `variant` moves the pads and egrets. */
function jadePool(w, p, variant) {
  const [x0, z0, x1, z1] = POOL;
  // the court round the pool, never over it: a floor across the whole tile hid the sunken water (R1)
  for (const [a, b, c, d] of [[-INNER, -INNER, INNER, z0], [-INNER, z1, INNER, INNER], [-INNER, z0, x0, z1], [x1, z0, INNER, z1]]) w.floor('Kit', a, b, c, d, 0.03, p.court);
  w.floor('Water', x0, z0, x1, z1, -DEPTH, p.water);
  for (const [xa, za, xb, zb] of [[x0, z1, x0, z0], [x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1]]) {
    w.quad('Kit', [xa, -DEPTH, za], [xb, -DEPTH, zb], [xb, 0, zb], [xa, 0, za], p.stone);
  }
  w.solid([x0, -DEPTH - 0.3, z0], [x1, -DEPTH, z1]);
  // the coping: a cream kerb 1.2 m wide and 0.5 m high round the rim, its colliders a low wall the walk steps along
  const c = 1.2, h = 0.5;
  for (const [a, b] of [[[x0 - c, z0 - c], [x1 + c, z0]], [[x0 - c, z1], [x1 + c, z1 + c]], [[x0 - c, z0], [x0, z1]], [[x1, z0], [x1 + c, z1]]]) {
    w.box('Kit', [a[0], 0, a[1]], [b[0], h, b[1]], p.stone, p.stoneTop); w.solid([a[0], 0, a[1]], [b[0], h, b[1]]);
  }
  // the waterfall: three stone steps north of the pool, each riser a sheet of water, foam where it lands
  const fx = 7, steps = [[z1 + c, z1 + c + 3, 1.4], [z1 + c + 3, z1 + c + 6, 2.8], [z1 + c + 6, z1 + c + 9, 4.2]];
  for (const [za, zb, y] of steps) { w.box('Kit', [-fx - 1.5, 0, za], [fx + 1.5, y, zb], p.stone, p.stoneTop); w.solid([-fx - 1.5, 0, za], [fx + 1.5, y, zb]); }
  for (const [i, [za, , y]] of steps.entries()) {
    const below = i === 0 ? h : (steps[i - 1]?.[2] ?? 0);
    w.quad('Water', [fx, below - 0.05, za - 0.05], [-fx, below - 0.05, za - 0.05], [-fx, y + 0.05, za - 0.05], [fx, y + 0.05, za - 0.05], p.water);
  }
  w.quad('Water', [fx, -DEPTH + 0.02, z1 + 0.02], [-fx, -DEPTH + 0.02, z1 + 0.02], [-fx, h, z1 + 0.02], [fx, h, z1 + 0.02], p.water);
  w.floor('Kit', -fx, z1 - 3, fx, z1, -DEPTH + 0.06, p.foam ?? p.stoneTop);
  // lily pads: flat green discs (thin boxes) on the water
  const pads = variant === 0 ? [[-14, -12], [-8, -16], [12, -6], [15, -14], [-16, 4], [6, 8]] : [[-12, -6], [-15, 8], [10, -15], [14, 2], [-4, -15], [16, 10]];
  for (const [x, z] of pads) w.box('Kit', [x - 1, -DEPTH + 0.02, z - 1], [x + 1, -DEPTH + 0.1, z + 1], p.pad ?? p.lawn, p.pad ?? p.lawn);
  for (const s of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) lamp(w, p, s[0] * 26, s[1] * 26, Math.atan2(-s[0], -s[1]));
  for (const x of [-15, 15]) tree(w, p, x, 26, 9);
  for (const [x, y, z] of variant === 0 ? [[-8, 9, -4], [10, 12, 6]] : [[6, 10, -8], [-11, 11, 5]]) egret(w, x, y, z);
}

/** U house: two thatched stilt houses on a cream platform, decks facing the tile's south walk, round trees and palms
 *  round them, a planter at the platform's foot. `variant` swaps the houses' sides. */
function stiltHouses(w, p, variant) {
  w.floor('Kit', -INNER, -INNER, INNER, INNER, 0.03, p.lawn);
  w.box('Kit', [-20, 0, -8], [20, 0.9, 12], p.stone, p.stoneTop); w.solid([-20, 0, -8], [20, 0.9, 12]);
  for (let k = 0; k < 3; k++) w.box('Kit', [-3, 0, -8 - (k + 1) * 0.9], [3, 0.9 - k * 0.3, -8 - k * 0.9], p.stone, p.stoneTop);
  const houses = variant === 0 ? [[-10, 3, 0], [10, 3, 2]] : [[-10, 3, 2], [10, 3, 0]];
  for (const [x, z, kind] of houses) {
    // huts: 0 the stilt hut, 2 the cabana (lagoon.py); a model's front is +z at yaw 0, so turned to face the south walk
    if (w.hasModel('huts')) w.placeModel('huts', kind, x, z, { yaw: Math.PI, y: 0.9 });
    w.solid([x - 3, 0.9, z - 3], [x + 3, 4.5, z + 3]);
  }
  for (const [x, z, size] of [[-24, 20, 10], [24, 20, 9], [0, 22, 11], [-24, -20, 8], [24, -20, 9]]) tree(w, p, x, z, size);
  for (const [x, z] of [[-24, 2], [24, 2], [-14, 22], [14, 22]]) palm(w, p, x, z);
  planter(w, p, -10, -16, 4, 2); planter(w, p, 10, -16, 4, 2);
  for (const x of [-4.5, 4.5]) lamp(w, p, x, -13);
}

/** T stele: a paved walk down the tile's middle (north-south), two rows of four painted steles facing it, planters of red
 *  flowers and round trees beyond them, a stone lamp at each end of the walk, two egrets over it (big enough to read from
 *  the road entry down the south avenue's walks: bar 7's second source). Symmetric under every turn's mirror. */
function steleWalk(w, p) {
  w.floor('Kit', -INNER, -INNER, INNER, INNER, 0.03, p.lawn);
  w.floor('Kit', -6, -INNER, 6, INNER, 0.05, p.court);
  for (const z of [-18, -6, 6, 18]) { stele(w, p, -9, z, -1); stele(w, p, 9, z, 1); }
  for (const z of [-18, 18]) { planter(w, p, -19, z, 3, 3); planter(w, p, 19, z, 3, 3); }
  for (const [x, z, size] of [[-21, 0, 10], [21, 0, 10], [-24, -25, 8], [24, 25, 8], [-24, 25, 9], [24, -25, 9]]) tree(w, p, x, z, size);
  for (const z of [-26, 26]) for (const x of [-4.5, 4.5]) lamp(w, p, x, z);
  egret(w, -3, 9, -10, 1.2); egret(w, 3, 11, 12, 1.2);
}

/** The plaza quarter (its corner (HALF, -HALF) is the plaza's centre, as Night Market's): wet tan paving, the ziggurat on it,
 *  and outside the ziggurat's ZIGGURAT m a raised planter with a tree, a pair of stone lamps flanking each stair, a palm
 *  in the far corner and a stele either side of each lane where it enters, clear of its stair. Diagonal-symmetric, so
 *  the four turned quarters mirror. */
function plaza(w, p) {
  w.floor('Kit', -HALF + 0.02, -HALF + 0.02, HALF - 0.02, HALF - 0.02, 0.03, p.plaza);
  // (a, b): metres from the ziggurat's centre along the tile's two lanes in (a west of the east lane, b north of the south)
  const at = (a, b) => [HALF - a, -HALF + b];
  for (const d of [ZIGGURAT + 3, ZIGGURAT + 15]) {
    const [x1, z1] = at(STAIR.half + 1.5, d), [x2, z2] = at(d, STAIR.half + 1.5);
    lamp(w, p, x1, z1); lamp(w, p, x2, z2);
  }
  const [px, pz] = at(52, 52);
  planter(w, p, px, pz, 4, 4); tree(w, p, px, pz, 10);
  const [qx, qz] = at(56, 30), [rx, rz] = at(30, 56);
  palm(w, p, qx, qz); palm(w, p, rx, rz);
  const [sx, sz] = at(STAIR.half + 2, 58), [tx, tz] = at(58, STAIR.half + 2);
  stele(w, p, sx, sz, -1); stele(w, p, tx, tz, 1);
}

/** The far stand-ins (RM11): each tile's ground, the pool's water, houses and steles as boxes, trees as green mounds. */
function farJungle(w, p, type, variant) {
  w.floor('far', -HALF, -HALF, HALF, HALF, 0, type === 'J' ? p.court : p.lawn);
  if (type === 'J') {
    const [x0, z0, x1, z1] = POOL;
    w.floor('far', x0, z0, x1, z1, 0.04, p.water);
    w.box('far', [-8.5, 0, z1 + 1.2], [8.5, 4.2, z1 + 10.2], p.stone);
    for (const x of [-15, 15]) w.box('far', [x - 3.6, 2, 26 - 3.6], [x + 3.6, 9, 26 + 3.6], p.foliage);
    return;
  }
  if (type === 'U') {
    w.box('far', [-20, 0, -8], [20, 0.9, 12], p.stone);
    for (const x of variant === 0 ? [-10, 10] : [10, -10]) w.box('far', [x - 3.2, 0.9, 0], [x + 3.2, 6, 6], p.hutRoof ?? p.roof);
    for (const [x, z] of [[-24, 20], [24, 20], [0, 22]]) w.box('far', [x - 4, 2, z - 4], [x + 4, 10, z + 4], p.foliage);
    return;
  }
  for (const z of [-18, -6, 6, 18]) for (const x of [-9, 9]) w.box('far', [x - 0.8, 0, z - 0.5], [x + 0.8, 4.6, z + 0.5], p.cinnabar ?? p.stall);
  for (const [x, z] of [[-21, 0], [21, 0]]) w.box('far', [x - 4, 2, z - 4], [x + 4, 10, z + 4], p.foliage);
}

/** A lane seam (in place of Night Market's strings and banners): on the four avenues (the x = 0 and z = 0 seams) a stone
 *  lamp either side every 26 m, clear of the road entries and the ziggurat; on the other seams a lamp at each crossing
 *  corner. (R1: no egrets here: a white mover over an avenue read as a floating paper diamond against the stair.) */
function jungleLane(w, p, side, centre) {
  const along = (u, off) => (side === 0 ? [u, HALF + off] : [HALF + off, -u]);
  const world = (x, z) => [centre[0] + x, centre[1] + z];
  // an entry's footprint (8 m wide, 15 m in from the plot's edge), the ziggurat's square and its four stairs stay clear
  const blocked = (x, z) => { const [wx, wz] = world(x, z), margin = 1.5;
    return (Math.abs(wx) < 4 + margin && Math.abs(wz) > 235 - margin) || (Math.abs(wz) < 4 + margin && Math.abs(wx) > 235 - margin)
      || (Math.abs(wx) < ZIGGURAT + 2 && Math.abs(wz) < ZIGGURAT + 2)
      || (Math.min(Math.abs(wx), Math.abs(wz)) < STAIR.half && Math.max(Math.abs(wx), Math.abs(wz)) < STAIR.foot + 2); };
  const avenue = (side === 0 ? centre[1] : centre[0]) + HALF === 0;
  const spots = avenue ? [-HALF + 5, -HALF + 31, HALF - 5] : [-HALF + 4, HALF - 4];
  for (const u of spots) for (const off of [-4.5, 4.5]) {
    const [x, z] = along(u, off);
    if (!blocked(x, z)) lamp(w, p, x, z);
  }
}

/** the shared kinds Jungle dresses: Night Market's gardens and forecourts, its plaza Jungle's own */
const THEME = {
  J: { build: jadePool, far: (w, p, variant) => farJungle(w, p, 'J', variant), sockets: 'pppp', water: [POOL] },
  U: { build: stiltHouses, far: (w, p, variant) => farJungle(w, p, 'U', variant), sockets: 'pppp' },
  T: { build: steleWalk, far: (w, p, variant) => farJungle(w, p, 'T', variant), sockets: 'pppp' },
};

/** Jungle's builders: a layout's shared letters (Night Market's kinds, `layout.builders`, their fireflies left out by day)
 *  with its plaza replaced by Jungle's, plus J, U and T, and its lamp-lined lane seams. */
export function jungleBuilders(letters) {
  const shared = nightMarketBuilders(letters);
  for (const letter of Object.keys(THEME)) if (Object.hasOwn(shared.tiles, letter)) throw new Error(`jungle-ziggurat: letter ${letter} is a theme tile`);
  const day = Object.fromEntries(Object.entries(shared.tiles).map(([letter, tile]) => [letter, { ...tile, build: (w, ...rest) => tile.build(noFireflies(w), ...rest) }]));
  // the plaza letter(s): the layout's own, else Night Market's default P
  for (const [letter, kind] of Object.entries(letters ?? { P: 'plaza' })) if (kind === 'plaza' && day[letter] !== undefined) day[letter] = { ...day[letter], build: plaza };
  return { tiles: { ...day, ...THEME }, coarseFamilies: new Set([...shared.coarseFamilies, 'huts', 'palms']), seam: jungleLane };
}

/** Hooks at the generic construction points (tiledPlotCore.mjs): the ziggurat stands alone on the plaza (afternoon: no
 *  lanterns of its own), the lamps' warm pools the only added light. */
export const jungleZigguratPlot = {
  builders: layout => jungleBuilders(layout.builders),
  lanternBake: { gain: 0.6, radius: 1.5, cut: 3 },
  // T8: the ring in the kit's draw (Lantern Bayou's 99290a64f1), so an edge tile holds Kit, Water, Glow and Pool
  ringInKit: true,
  models() { return undefined; },
  pools() { return undefined; },
};
