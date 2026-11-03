// OP22 (OPEN-PLOTS wave D, G978): Floating Island Race's tile vocabulary, after round 62's board
// (art/grid/round-62-open-plot-palettes/15-sky-race.jpg). The shared letters are Night Market's builders (plaza and
// forecourts, retinted by the layout's palette: pale paving, blue stalls); four theme tiles are the circuit's own, each a
// paved border meeting any neighbour ('pppp'):
//   T track:    a quarter of a kart circuit round the tile's south-east corner: four T tiles turned round a shared corner
//               draw one rounded-square loop of asphalt with red-and-white kerbs across the lanes between them, a grass
//               infield with trees and a small pond (the plot's water) at its centre, tyre stacks on its outer bend;
//   R paddock:  two rows of parked race cars (the `race` family's variant 0) nose out, trees and checkered flags;
//   K garages:  pit garages (variant 1) along the tile's north and west edges with cars before them (the plot's corners);
//   A stand:    a grandstand (variant 2) along the tile's north edge facing south, trees and flags before it.
// Every model is a kit family (race, trees, lanterns), placed only when the layout's kit has it. A saturated cobalt high
// noon: no fireflies, no lanterns lit by day; birds over the circuits (bar 7).
import { HALF, INNER, pool } from './kit.mjs';
import { nightMarketBuilders } from './nightMarket.mjs';

/** The shared builders' fireflies (Glow with no green or blue, red in [0, 0.5)) blink to black, specks by day: a circuit
 *  tile's writer drops them and keeps everything else (fairground.mjs's morning writer) */
const noFireflies = (w) => new Proxy(w, { get: (target, key) => key === 'tri'
  ? (part, a, b, c, colour, ...rest) => (part === 'Glow' && colour?.[1] === 0 && colour?.[2] === 0 && colour[0] < 0.5 ? undefined : target.tri(part, a, b, c, colour, ...rest))
  : (typeof target[key] === 'function' ? target[key].bind(target) : target[key]) });

/** Life (bar 7): a bird, a 0.6 m mover in the glow graph's steady mode (red seed in [0.5, 1), no green: drifting slowly,
 *  never blinking to black) at full blue, which the graph lights white (Coral's gull, coral.mjs), over the circuits */
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

/** A tree (the kit's trees, a 6 m crown) and its collider. */
function tree(w, x, z, spin = 0) {
  if (w.hasModel('trees')) w.placeModel('trees', 0, x, z, { yaw: spin, scale: 6 / 8 });
  w.solid([x - 0.3, 0, z - 0.3], [x + 0.3, 3, z + 0.3]);
}

/** A checkered flag on a 5 m pole at (x, z), its 4 x 3 squares facing along x, and the pole's collider. */
function flag(w, p, x, z) {
  w.sides('Kit', [x - 0.08, 0, z - 0.08], [x + 0.08, 5, z + 0.08], p.steel ?? p.stone);
  const s = 0.45;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
    const x0 = x + 0.08 + i * s, y1 = 4.9 - j * s, colour = (i + j) % 2 === 0 ? (p.checkDark ?? p.iron) : (p.checkLight ?? p.paving);
    w.quad('Kit', [x0, y1 - s, z], [x0 + s, y1 - s, z], [x0 + s, y1, z], [x0, y1, z], colour);
    w.quad('Kit', [x0 + s, y1 - s, z], [x0, y1 - s, z], [x0, y1, z], [x0 + s, y1, z], colour);
  }
  w.solid([x - 0.1, 0, z - 0.1], [x + 0.1, 5, z + 0.1]);
}

/** A `race` model (variant) at (x, z), turned `yaw`, and its collider box (half sizes after the turn, height `h`). */
function race(w, variant, x, z, yaw, hx, hz, h) {
  if (w.hasModel('race')) w.placeModel('race', variant, x, z, { yaw });
  if (h > 0) w.solid([x - hx, 0, z - hz], [x + hx, h, z + hz]);
}
/** A parked race car, nose toward `yaw` (0 is +z), and its collider. */
const car = (w, x, z, yaw) => race(w, 0, x, z, yaw, Math.abs(Math.sin(yaw)) > 0.5 ? 2.6 : 1.1, Math.abs(Math.sin(yaw)) > 0.5 ? 1.1 : 2.6, 1.2);

/** the loop's centreline: its half size from the shared corner, its bends' radius, the asphalt's width and a kerb's */
const D = 40, R = 16, WIDTH = 9, KERB = 1;
/** the half size of the pond at the loop's centre */
const POND = 6;

/** The quarter loop's centreline in a T tile (loop centre at the tile's south-east corner (HALF, -HALF)), sampled every
 *  ~2.5 m from the east edge west along z = -HALF + D, round the bend, then south along x = HALF - D to the south edge:
 *  [[x, z], ...] with the unit normal toward the loop's centre at each point. */
function centreline() {
  const cx = HALF - D + R, cz = -HALF + D - R, pts = [];
  for (let x = HALF; x > cx; x -= 2.5) pts.push([[x, -HALF + D], [0, -1]]);
  for (let k = 0; k <= 10; k++) { const a = Math.PI / 2 + (Math.PI / 2) * k / 10; pts.push([[cx + R * Math.cos(a), cz + R * Math.sin(a)], [-Math.cos(a), -Math.sin(a)]]); }
  for (let z = cz - 2.5; z > -HALF; z -= 2.5) pts.push([[HALF - D, z], [1, 0]]);
  pts.push([[HALF - D, -HALF], [1, 0]]);
  pts.unshift([[HALF, -HALF + D], [0, -1]]);
  return pts.filter((pt, i, all) => i === 0 || Math.hypot(pt[0][0] - all[i - 1][0][0], pt[0][1] - all[i - 1][0][1]) > 0.01);
}
const LINE = centreline();

/** A strip along the centreline between offsets `a` and `b` (toward the loop's centre positive) at height `y`; `colour`
 *  gives each segment's colour by its index. */
function strip(w, a, b, y, colour) {
  for (let i = 0; i + 1 < LINE.length; i++) {
    const [[x0, z0], [nx0, nz0]] = LINE[i], [[x1, z1], [nx1, nz1]] = LINE[i + 1];
    const p = (x, z, nx, nz, o) => [x + nx * o, y, z + nz * o];
    w.quad('Kit', p(x0, z0, nx0, nz0, b), p(x1, z1, nx1, nz1, b), p(x1, z1, nx1, nz1, a), p(x0, z0, nx0, nz0, a), colour(i));
  }
}

/** T track: the quarter loop's asphalt and kerbs, the grass infield inside it with trees, tyre stacks on its outer bend,
 *  birds over it. */
function track(w, p, variant) {
  const half = WIDTH / 2, cx = HALF - D + R, cz = -HALF + D - R, inner = R - half - KERB;
  // the infield: a fan from the loop's centre to the inner kerb
  const fan = [[HALF - D + half + KERB, -HALF]];
  for (let k = 0; k <= 10; k++) { const a = Math.PI - (Math.PI / 2) * k / 10; fan.push([cx + inner * Math.cos(a), cz + inner * Math.sin(a)]); }
  fan.push([HALF, -HALF + D - half - KERB]);
  for (let i = 0; i + 1 < fan.length; i++) w.tri('Kit', [HALF, 0.04, -HALF], [fan[i][0], 0.04, fan[i][1]], [fan[i + 1][0], 0.04, fan[i + 1][1]], p.lawn);
  strip(w, -half, half, 0.05, () => p.asphalt ?? p.iron);
  for (const [a, b] of [[half, half + KERB], [-half - KERB, -half]]) strip(w, a, b, 0.055, i => (i % 2 === 0 ? (p.kerbRed ?? p.stall) : (p.kerbWhite ?? p.paving)));
  strip(w, -0.15, 0.15, 0.056, i => (i % 2 === 0 ? (p.kerbWhite ?? p.paving) : (p.asphalt ?? p.iron)));  // the dashed centre line
  // a quarter of the pond at the loop's centre (the four quarters meet over the lanes' crossing) in a white stone rim
  w.floor('Water', HALF - POND, -HALF, HALF, -HALF + POND, 0.06, p.water);
  w.box('Kit', [HALF - POND - 0.5, 0, -HALF], [HALF - POND, 0.35, -HALF + POND + 0.5], p.stone, p.kerbWhite ?? p.paving);
  w.box('Kit', [HALF - POND, 0, -HALF + POND], [HALF, 0.35, -HALF + POND + 0.5], p.stone, p.kerbWhite ?? p.paving);
  for (const [x, z] of [[HALF - 14, -HALF + 14], [HALF - 22, -HALF + 9], [HALF - 9, -HALF + 22]]) tree(w, x, z, x);
  // tyre stacks on the outer bend
  for (let k = 1; k < 4; k++) {
    const a = Math.PI / 2 + (Math.PI / 2) * k / 4, r = R + half + KERB + 1.5, x = cx + r * Math.cos(a), z = cz + r * Math.sin(a);
    w.sides('Kit', [x - 0.7, 0, z - 0.7], [x + 0.7, 1.2, z + 0.7], p.tyre ?? p.iron);
    w.box('Kit', [x - 0.7, 1.2, z - 0.7], [x + 0.7, 1.3, z + 0.7], p.tyre ?? p.iron, p.kerbWhite ?? p.paving);
    w.solid([x - 0.7, 0, z - 0.7], [x + 0.7, 1.3, z + 0.7]);
  }
  if (variant % 2 === 0) flag(w, p, -INNER + 4, INNER - 4);
  bird(w, HALF - 20, 11 + variant, -HALF + 18);
}

/** R paddock: two rows of parked cars nose out from a middle lane, trees and checkered flags at the rows' ends. */
function paddock(w, p, variant) {
  for (const x of [-15, -9, -3, 3, 9, 15]) { car(w, x, 9, 0); car(w, x, -9, Math.PI); }
  for (const [x, z] of [[-22, 0], [22, 0]]) tree(w, x, z, x);
  for (const [x, z] of variant % 2 === 0 ? [[-20, 18], [20, -18]] : [[20, 18], [-20, -18]]) flag(w, p, x, z);
  lamp(w, p, 0, 0);
  bird(w, variant % 2 === 0 ? 6 : -6, 12, 4);
}

/** K garages: two pit garages along the tile's north and west edges (the plot's outer corner is the tile's north-west)
 *  facing in, a car before each, trees and a flag. */
function garages(w, p) {
  race(w, 1, 4, 18, Math.PI, 6.2, 4.7, 6.8);
  race(w, 1, -18, -4, Math.PI / 2, 4.7, 6.2, 6.8);
  car(w, 4, 9, Math.PI); car(w, -9, -4, -Math.PI / 2);
  for (const [x, z] of [[-18, 18], [18, -18], [-6, -18]]) tree(w, x, z, x);
  flag(w, p, 12, 6);
  lamp(w, p, -6, 6);
}

/** A stand: a grandstand along the tile's north edge facing south, a row of trees before it, flags at its ends. */
function stand(w, p, variant) {
  race(w, 2, 0, 16, 0, 8.4, 3.8, 6.8);
  for (const x of [-16, -8, 8, 16]) tree(w, x, 4, x);
  for (const x of [-12, 12]) flag(w, p, x, 13);
  lamp(w, p, variant % 2 === 0 ? -20 : 20, -10);
}

/** The far stand-ins (RM11): the circuits' asphalt and infield, the paddocks' cars as red blocks, the garages and stands
 *  as white blocks under blue roofs. */
function farRace(w, p, type) {
  w.floor('far', -HALF, -HALF, HALF, HALF, 0, p.paving);
  if (type === 'T') {
    w.floor('far', HALF - D - WIDTH / 2, -HALF, HALF - D + WIDTH / 2, -HALF + D, 0.04, p.asphalt ?? p.iron);
    w.floor('far', HALF - D + WIDTH / 2, -HALF + D - WIDTH / 2, HALF, -HALF + D + WIDTH / 2, 0.04, p.asphalt ?? p.iron);
    w.floor('far', HALF - D + WIDTH / 2, -HALF, HALF, -HALF + D - WIDTH / 2, 0.04, p.lawn);
    w.floor('far', HALF - POND, -HALF, HALF, -HALF + POND, 0.06, p.water);
    return;
  }
  if (type === 'R') { for (const z of [9, -9]) w.box('far', [-16, 0, z - 2.4], [16, 1.1, z + 2.4], p.body ?? p.stall); return; }
  if (type === 'K') { w.box('far', [-2, 0, 13.5], [10, 4.2, 22.5], p.garage ?? p.wall); w.box('far', [-22.5, 0, -10], [-13.5, 4.2, 2], p.garage ?? p.wall); return; }
  w.box('far', [-8, 0, 13], [8, 5.6, 20], p.canopy ?? p.roof);
}

const THEME = {
  T: { build: track, far: (w, p) => farRace(w, p, 'T'), sockets: 'pppp' },
  R: { build: paddock, far: (w, p) => farRace(w, p, 'R'), sockets: 'pppp' },
  K: { build: garages, far: (w, p) => farRace(w, p, 'K'), sockets: 'pppp' },
  A: { build: stand, far: (w, p) => farRace(w, p, 'A'), sockets: 'pppp' },
};

/** The circuit's builders: a layout's shared letters (Night Market's kinds, `layout.builders`) plus T, R, K and A, every
 *  one drawn without fireflies, and the shared lane seams (bunting and banners, no fireflies by day). */
export function skyRaceBuilders(letters) {
  const shared = nightMarketBuilders(letters);
  for (const letter of Object.keys(THEME)) if (Object.hasOwn(shared.tiles, letter)) throw new Error(`sky-race: letter ${letter} is a theme tile`);
  const tiles = { ...shared.tiles, ...THEME };
  const day = Object.fromEntries(Object.entries(tiles).map(([letter, tile]) => [letter, { ...tile, build: (w, ...rest) => tile.build(noFireflies(w), ...rest) }]));
  const seam = shared.seam === undefined ? undefined : (w, ...rest) => shared.seam(noFireflies(w), ...rest);
  return { tiles: day, coarseFamilies: new Set([...shared.coarseFamilies, 'race']), seam };
}

/** Hooks at the generic construction points (tiledPlotCore.mjs): the race tower stands alone on the plaza, a pale pool of
 *  light under its arch. */
export const skyRacePlot = {
  builders: layout => skyRaceBuilders(layout.builders),
  lanternBake: { gain: 0.6, radius: 1.5, cut: 3 },
  ringInKit: true,
  models() { return undefined; },
  pools(parts, palette) {
    const lit = { Pool: parts.Pool }, plotWriter = { triColours: (part, a, b, c, colours) => lit[part].triColours(part, [a, b, c], colours) };
    pool(plotWriter, 0, 0, 20, palette.gatePool, 0.05);
  },
};
