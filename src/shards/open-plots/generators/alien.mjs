// OP20 (OPEN-PLOTS wave D): Pastel Alien Plain's tile vocabulary, after round 62's board
// (art/grid/round-62-open-plot-palettes/13-alien-plain.jpg): a violet garden colony under a green-violet bioluminescent
// night, faceted dome habitats at its corners, beds of violet and acid-lime crystals between lime lamp posts, the glowing
// monolith on its plaza. The shared letters are Night Market's builders (the forecourts and the plaza, retinted by the
// layout's palette); three theme tiles are the plain's own, their paved border meeting any neighbour ('pppp'):
//   B crystal bed: four raised violet beds round a paved cross, crystal clusters and glow plants in them, lamps at the
//                  cross's mouths, lime motes drifting low over the beds;
//   R rock outcrop: a violet bed with dark rock spires split by lime cracks, crystal clusters and glow plants at their
//                   feet, motes;
//   D dome habitat: a 20 m faceted dome on the paving, its lit door to the tile's south (-z), crystals and glow plants
//                   round it, lamps either side of the door.
// Every model is a kit family (alien, trees, lanterns, props), placed only when the layout's kit has it. The market's
// fireflies stay; the motes are mosslight's steady glow (bar 7).
import { HALF, INNER, pool } from './kit.mjs';
import { nightMarketBuilders } from './nightMarket.mjs';

/** A stable variant (0 to count - 1) for a piece at tile-local (x, z), so neighbours differ and every bake repeats. */
const pick = (x, z, count, salt = 0) => (((Math.round(x * 4) * 7 + Math.round(z * 4) * 13 + salt) % count) + count) % count;

/** Mosslight's moving-light marking: a mote is a tetrahedron in Glow whose colour has no green, red in [0.5, 1) its
 *  seed: the glow graph's steady mode, drifting slowly and never blinking to black; a little blue lights it green. */
let seeds = 0;
function mote(w, x, y, z, s = 0.14) {
  seeds++;
  const c = [((seeds * 0.6180339887) % 1) * 0.5 + 0.5, 0, 0.01];
  const top = [x, y + s * 1.4, z], a = [x - s, y - s, z - s], b = [x + s, y - s, z - s], d = [x, y - s, z + s * 1.4];
  w.tri('Glow', top, b, a, c); w.tri('Glow', top, d, b, c); w.tri('Glow', top, a, d, c); w.tri('Glow', a, b, d, c);
}

/** A lime lamp post (the kit's post lantern, retinted), its pool and collider. */
function lamp(w, p, x, z) {
  if (w.hasModel('lanterns')) w.placeModel('lanterns', 0, x, z, { height: 3.2, yaw: 0 });
  else {
    w.lanternEmitter?.([x, 3.6, z], [...p.lantern]);
    w.sides('Kit', [x - 0.12, 0, z - 0.12], [x + 0.12, 3.2, z + 0.12], p.stone);
    w.box('Glow', [x - 0.25, 3.2, z - 0.25], [x + 0.25, 3.9, z + 0.25], p.lantern, p.lantern);
  }
  w.solid([x - 0.15, 0, z - 0.15], [x + 0.15, 3.2, z + 0.15]);
  pool(w, x, z, 3.5, p.pool);
}

/** An `alien` model (variant) at (x, z) raised `y`, scaled `scale`, and its collider (half size `r` a side, height `h`,
 *  both at scale 1). Glow plants (variant 3) are walk-through. */
function alien(w, variant, x, z, y, scale, yaw, r, h) {
  if (w.hasModel('alien')) w.placeModel('alien', variant, x, z, { y, yaw, scale });
  if (r > 0) w.solid([x - r * scale, y, z - r * scale], [x + r * scale, y + h * scale, z + r * scale]);
}
const cluster = (w, x, z, y, scale) => alien(w, 0, x, z, y, scale, x * 0.7 + z, 0.9, 3.4);

/** A glow plant at (x, z) raised `y`: a walk-through fan of seven pointed deep green leaves, their tips lit lime (the
 *  plain's bushes; no mushrooms). Drawn here, not as a kit model: a family holds at most three variants. */
function plant(w, p, x, z, y, scale) {
  const leaf = p.leaf ?? p.foliage, tip = p.glowLime ?? p.lantern;
  for (let k = 0; k < 7; k++) {
    const a = (k / 7 + pick(x, z, 5, k) * 0.03) * Math.PI * 2, tilt = 0.55 + pick(z, x, 4, k) * 0.12, length = (1.9 + pick(x, z, 3, k * 3) * 0.3) * scale;
    const d = [Math.cos(a) * Math.cos(tilt), Math.sin(tilt), Math.sin(a) * Math.cos(tilt)], side = [-Math.sin(a) * 0.3 * scale, 0, Math.cos(a) * 0.3 * scale];
    const at = (t, s) => [x + d[0] * length * t + side[0] * s, y + 0.1 + d[1] * length * t, z + d[2] * length * t + side[2] * s];
    const base = at(0, 0), l = at(0.55, -1), r = at(0.55, 1), nl = at(0.8, -0.5), nr = at(0.8, 0.5), end = at(1, 0);
    for (const [u, v, q] of [[base, r, l], [l, r, nr], [l, nr, nl]]) { w.tri('Kit', u, v, q, leaf); w.tri('Kit', u, q, v, leaf); }
    w.tri('Glow', nl, nr, end, tip); w.tri('Glow', nl, end, nr, tip);
  }
}

/** A raised violet bed from (x0, z0) to (x1, z1), its dark kerb, and its collider (low enough to step onto). */
function bed(w, p, x0, z0, x1, z1) {
  w.box('Kit', [x0, 0, z0], [x1, 0.35, z1], p.kerb, p.bed ?? p.lawn);
  w.solid([x0, 0, z0], [x1, 0.35, z1]);
}

/** B crystal bed: four beds round a 7 m paved cross, two clusters and three glow plants in each, a lamp either side of
 *  each of the cross's four mouths, motes low over the beds. `variant` swaps the clusters' diagonal. */
function crystalBed(w, p, variant) {
  w.floor('Kit', -INNER, -INNER, INNER, INNER, 0.04, p.court ?? p.paving);
  const m = variant === 0 ? 1 : -1, y = 0.35;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x0 = sx > 0 ? 3.5 : -INNER + 1, x1 = sx > 0 ? INNER - 1 : -3.5, z0 = sz > 0 ? 3.5 : -INNER + 1, z1 = sz > 0 ? INNER - 1 : -3.5;
    bed(w, p, x0, z0, x1, z1);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, d = sx * sz * m;
    cluster(w, cx - 5 * d, cz - 5, y, 1.6 + pick(cx, cz, 3) * 0.3);
    cluster(w, cx + 6 * d, cz + 6, y, 1.2 + pick(cz, cx, 3) * 0.3);
    for (const [dx, dz] of [[6, -6], [-6, 5], [1, 1]]) plant(w, p, cx + dx * d, cz + dz, y, 1.3);
    for (const [dx, dz] of [[-2, -1], [3, 4], [-7, 7]]) mote(w, cx + dx, 1.4 + pick(dx, dz, 3) * 0.6, cz + dz);
  }
  for (const [x, z] of [[-2.6, -INNER + 1], [2.6, -INNER + 1], [-2.6, INNER - 1], [2.6, INNER - 1]]) { lamp(w, p, x, z); lamp(w, p, z, x); }
}

/** R rock outcrop: one bed with two rock spires (their cracks to the south), crystal clusters and glow plants round their
 *  feet, motes. `variant` mirrors it east-west. */
function outcrop(w, p, variant) {
  w.floor('Kit', -INNER, -INNER, INNER, INNER, 0.04, p.court ?? p.paving);
  const m = variant === 0 ? 1 : -1, y = 0.35;
  bed(w, p, -INNER + 2, -INNER + 2, INNER - 2, INNER - 2);
  for (const [x, z, scale] of [[-6, 4, 1.9], [9, -5, 1.3]]) alien(w, 2, m * x, z, y, scale, Math.PI, 1.8, 7);
  for (const [x, z, scale] of [[-15, -12, 1.8], [14, 12, 1.6], [2, 14, 1.4], [-16, 15, 1.3], [17, -16, 1.5]]) cluster(w, m * x, z, y, scale);
  for (const [x, z] of [[-10, -6], [4, -12], [12, 2], [-4, 16], [-18, 4], [18, -6], [0, -2]]) plant(w, p, m * x, z, y, 1.4);
  for (const [x, z] of [[-2, -8], [6, 6], [-12, 10], [14, -12], [-8, -16]]) mote(w, m * x, 1.5 + pick(x, z, 3) * 0.7, z);
}

/** D dome habitat: the dome on the paving north of centre, its door to the south (-z), a lamp either side of its door,
 *  crystal clusters and glow plants on beds at the tile's southern corners. The dome's collider is a stepped cross. */
function habitat(w, p) {
  w.floor('Kit', -INNER, -INNER, INNER, INNER, 0.04, p.court ?? p.paving);
  const z = 4, y = 0.35;
  alien(w, 1, 0, z, 0, 1, Math.PI, 0, 0);
  for (const [hx, hz, h] of [[10, 6.5, 3.4], [6.5, 10, 3.4], [8.5, 4, 5.6], [4, 8.5, 5.6], [5.5, 5.5, 7.8]]) w.solid([-hx, 0, z - hz], [hx, h, z + hz]);
  for (const x of [-3.5, 3.5]) lamp(w, p, x, z - 12);
  for (const sx of [-1, 1]) {
    bed(w, p, sx > 0 ? 10 : -INNER + 1, -INNER + 1, sx > 0 ? INNER - 1 : -10, -9);
    cluster(w, sx * 18, -18, y, 1.7);
    for (const [x, z2] of [[13, -13], [23, -21], [21, -12]]) plant(w, p, sx * x, z2, y, 1.3);
    mote(w, sx * 16, 1.6, -14);
  }
  for (const [x, z2] of [[-20, 18], [20, 18], [-20, 6], [20, 6]]) cluster(w, x, z2, 0, 1.3);
}

/** The far stand-ins (RM11): the paving and the beds as violet slabs, the dome as a pale block, the spires as dark ones. */
function farBed(w, p) {
  w.floor('far', -HALF, -HALF, HALF, HALF, 0, p.court ?? p.paving);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) w.floor('far', sx > 0 ? 3.5 : -INNER, sz > 0 ? 3.5 : -INNER, sx > 0 ? INNER : -3.5, sz > 0 ? INNER : -3.5, 0.3, p.bed ?? p.lawn);
}
function farOutcrop(w, p, variant) {
  const m = variant === 0 ? 1 : -1;
  w.floor('far', -HALF, -HALF, HALF, HALF, 0, p.court ?? p.paving);
  w.floor('far', -INNER, -INNER, INNER, INNER, 0.3, p.bed ?? p.lawn);
  w.box('far', [m * -6 - 2.5, 0, 1.5], [m * -6 + 2.5, 13, 6.5], p.obsidian ?? p.stone);
}
function farHabitat(w, p) {
  w.floor('far', -HALF, -HALF, HALF, HALF, 0, p.court ?? p.paving);
  w.box('far', [-8, 0, -4], [8, 8, 12], p.shell ?? p.wall);
}

/** where an avenue's lamps stand (plot metres from the plaza along it, either side of the lane), short of the plaza's
 *  plinth and of the road entry's 15 m footprint */
const AVENUE_LAMPS = [44, 68, 92, 116, 140, 164, 188, 212];

/** A lane seam: on the four avenues (the seams on x = 0 and z = 0) a lime lamp post either side every 24 m, motes low
 *  between them; the other seams are open paving. */
function alienLane(w, p, side, centre) {
  if ((side === 0 ? centre[1] : centre[0]) + HALF !== 0) return;
  const along = (u, off) => (side === 0 ? [u, HALF + off] : [HALF + off, -u]);
  const at = list => list.flatMap(r => [r, -r]).map(r => (side === 0 ? r - centre[0] : centre[1] - r)).filter(u => u >= -HALF && u < HALF);
  for (const u of at(AVENUE_LAMPS)) for (const off of [-4.2, 4.2]) { const [x, z] = along(u, off); lamp(w, p, x, z); }
  for (const u of at(AVENUE_LAMPS.map(r => r + 12))) { const [x, z] = along(u, (u % 2 ? 1 : -1) * 2.5); mote(w, x, 1.8, z); }
}

const THEME = {
  B: { build: crystalBed, far: farBed, sockets: 'pppp' },
  R: { build: outcrop, far: farOutcrop, sockets: 'pppp' },
  D: { build: habitat, far: farHabitat, sockets: 'pppp' },
};

/** The plain's builders: a layout's shared letters (Night Market's kinds, `layout.builders`) plus B, R and D, and lamp-lined
 *  avenues for the lane seams. */
export function alienBuilders(letters) {
  const shared = nightMarketBuilders(letters);
  for (const letter of Object.keys(THEME)) if (Object.hasOwn(shared.tiles, letter)) throw new Error(`alien-plain: letter ${letter} is a theme tile`);
  return { tiles: { ...shared.tiles, ...THEME }, coarseFamilies: new Set([...shared.coarseFamilies, 'alien']), seam: alienLane };
}

/** Hooks at the generic construction points (tiledPlotCore.mjs): the monolith stands alone on the plaza, lime motes rising
 *  along its cracks (the layout's `landmark.motes`, plot metres for a 32 m monolith at turn 0) and a lime pool of light
 *  round its foot. */
export const alienPlot = {
  builders: layout => alienBuilders(layout.builders),
  lanternBake: { gain: 0.8, radius: 1.5, cut: 3 },
  ringInKit: true,
  models(parts, _kit, layout) {
    const writer = { tri: (part, a, b, c, colour) => parts[part].tri(part, a, b, c, colour) }, k = (layout.landmark?.height ?? 32) / 32;
    for (const [x, y, z] of layout.landmark?.motes ?? []) {
      for (let i = 0; i < 6; i++) mote(writer, (x + Math.sin(i * 2.4) * 1.2) * k, (y + i * 0.8) * k, (z + Math.cos(i * 2.4) * 1.2) * k, 0.45);
    }
  },
  pools(parts, palette) {
    const lit = { Pool: parts.Pool }, plotWriter = { triColours: (part, a, b, c, colours) => lit[part].triColours(part, [a, b, c], colours) };
    pool(plotWriter, 0, 0, 22, palette.gatePool, 0.05);
  },
};
