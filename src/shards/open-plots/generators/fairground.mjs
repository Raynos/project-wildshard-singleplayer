// OP7 (OPEN-PLOTS wave A, G978): Patchwork Fairground's tile vocabulary, after round 75's board
// (art/grid/round-75-new-plot-palettes/03-patchwork-fairground.jpg). The shared letters are Night Market's builders (plaza,
// gardens and forecourts, retinted by the layout's palette: sand paving, striped stalls); three theme tiles are the fair's
// own, each a paved border meeting any neighbour ('pppp'):
//   Q quilt:    a 3 x 3 patchwork of mustard, lavender and clover field squares between box hedges, hay bales on two;
//   K carousel: the carousel (the `fair` family's variant 0) on a clover lawn in a ring of box hedges, lamps at its corners;
//   T big top:  the striped big top (variant 1) on a lawn, its door toward the tile's north edge, hay bales and lamps round it.
// The entry forecourts carry a helter-skelter (variant 2) either side of the lane. Every model is a kit family (fair,
// lanterns, trees, stalls), placed only when the layout's kit has it. A fresh morning: no fireflies, no lanterns lit by day.
import { HALF, INNER, pool } from './kit.mjs';
import { nightMarketBuilders } from './nightMarket.mjs';

/** The shared builders' fireflies (Glow with no green or blue, red in [0, 0.5)) blink to black, specks by day: a fair
 *  tile's writer drops them and keeps everything else (coral.mjs's noon writer) */
const noFireflies = (w) => new Proxy(w, { get: (target, key) => key === 'tri'
  ? (part, a, b, c, colour, ...rest) => (part === 'Glow' && colour?.[1] === 0 && colour?.[2] === 0 && colour[0] < 0.5 ? undefined : target.tri(part, a, b, c, colour, ...rest))
  : (typeof target[key] === 'function' ? target[key].bind(target) : target[key]) });

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
}

/** K carousel: the carousel on a clover lawn in a ring of box hedges open at the four sides, a lamp on each corner. */
function carousel(w, p, variant) {
  w.floor('Kit', -INNER, -INNER, INNER, INNER, 0.04, p.quiltC ?? p.lawn);
  w.floor('Kit', -10, -10, 10, 10, 0.06, p.paving);
  for (const [x0, z0, x1, z1] of [[-14, -14, -4, -12.6], [4, -14, 14, -12.6], [-14, 12.6, -4, 14], [4, 12.6, 14, 14],
    [-14, -12.6, -12.6, -4], [-14, 4, -12.6, 12.6], [12.6, -12.6, 14, -4], [12.6, 4, 14, 12.6]]) hedge(w, p, x0, z0, x1, z1);
  ride(w, 0, 0, 0, variant * Math.PI / 4, 6.6, 6.6, 9.8);
  for (const s of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) lamp(w, p, s[0] * 23.5, s[1] * 23.5, Math.atan2(-s[0], -s[1]));
  for (const [x, z, along] of [[-21, 4, 1], [21, -5, 1], [5, 21, 0]]) bale(w, p, x, z, along);
}

/** T big top: the striped big top on a lawn, its door to the north (tile +z), hay bales and lamps round it. */
function bigTop(w, p, variant) {
  w.floor('Kit', -INNER, -INNER, INNER, INNER, 0.04, p.quiltA ?? p.lawn);
  w.floor('Kit', -3, 8, 3, INNER, 0.06, p.paving);
  ride(w, 1, 0, -2, 0, 8.4, 8.4, 12);
  for (const [x, z, along] of variant === 0 ? [[-19, -18, 0], [-16, -20, 1], [18, -17, 1], [20, 14, 0]] : [[19, -18, 0], [16, -20, 1], [-18, -17, 1], [-20, 14, 0]]) bale(w, p, x, z, along);
  for (const x of [-5, 5]) lamp(w, p, x, 14, 0);
}

/** An entry forecourt's fair dressing: a helter-skelter either side of the road entry's lane, set into the tile's corner
 *  nearest the seam (tile-local: the seam on +x, the road on -z for variant 0; the generator turns the tile). */
function forecourtFair(w) {
  ride(w, 2, HALF - 12, -HALF + 12, Math.PI, 3.2, 3.2, 16);
}

/** The shared kinds the fair dresses, and Night Market's own letters for them when a layout names none. */
const DRESS = { forecourt: forecourtFair };
const SHARED_LETTERS = { G: 'garden', N: 'forecourt', P: 'plaza' };

/** The far stand-ins (RM11): the field squares' colours, hedges as low green boxes, the rides as coloured blocks. */
function farFair(w, p, type, variant) {
  w.floor('far', -HALF, -HALF, HALF, HALF, 0, p.paving);
  if (type === 'Q') {
    const colours = [p.quiltA ?? p.lawn, p.quiltB ?? p.lawn, p.quiltC ?? p.lawn], at = (k) => -INNER + k * (SQUARE + HEDGE);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) w.floor('far', at(c), at(r), at(c) + SQUARE, at(r) + SQUARE, 0.04, colours[(r + c * 2 + variant) % 3]);
    return;
  }
  w.floor('far', -INNER, -INNER, INNER, INNER, 0.04, type === 'K' ? (p.quiltC ?? p.lawn) : (p.quiltA ?? p.lawn));
  if (type === 'K') w.box('far', [-6, 0, -6], [6, 7, 6], p.tentRed ?? p.stall);
  else w.box('far', [-8, 0, -10], [8, 9, 6], p.tentWhite ?? p.wall);
}

const THEME = {
  Q: { build: quilt, far: (w, p, variant) => farFair(w, p, 'Q', variant), sockets: 'pppp' },
  K: { build: carousel, far: (w, p, variant) => farFair(w, p, 'K', variant), sockets: 'pppp' },
  T: { build: bigTop, far: (w, p, variant) => farFair(w, p, 'T', variant), sockets: 'pppp' },
};

/** The fair's builders: a layout's shared letters (Night Market's kinds, `layout.builders`, their forecourts dressed with
 *  helter-skelters) plus Q, K and T, every one drawn without fireflies. */
export function patchworkFairgroundBuilders(letters) {
  const shared = nightMarketBuilders(letters);
  for (const letter of Object.keys(THEME)) if (Object.hasOwn(shared.tiles, letter)) throw new Error(`patchwork-fairground: letter ${letter} is a theme tile`);
  const tiles = { ...shared.tiles, ...THEME };
  for (const [letter, kind] of Object.entries(letters ?? SHARED_LETTERS)) {
    const dress = DRESS[kind], base = tiles[letter];
    if (dress !== undefined && base !== undefined) tiles[letter] = { ...base, build: (w, p, variant) => { base.build(w, p, variant); dress(w, p, variant); } };
  }
  const day = Object.fromEntries(Object.entries(tiles).map(([letter, tile]) => [letter, { ...tile, build: (w, ...rest) => tile.build(noFireflies(w), ...rest) }]));
  const seam = shared.seam === undefined ? undefined : (w, ...rest) => shared.seam(noFireflies(w), ...rest);
  return { tiles: day, coarseFamilies: new Set([...shared.coarseFamilies, 'fair']), seam };
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
