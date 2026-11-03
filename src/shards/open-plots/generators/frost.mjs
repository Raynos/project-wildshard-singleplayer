// OB3 (open-plots build-out, G978): Frostline Peaks' tile vocabulary. The shared letters are Night Market's builders
// (canals, forecourts, plaza, gardens, retinted by the layout's palette: its canals read as the frozen blue canals); two
// theme tiles are Frostline's own, both snowy courts whose paved border meets any neighbour ('pppp'):
//   D lodges: three timber lodges round a snowy court, pines in its corners, lantern posts at its mouth;
//   F pines:  a dense pine wood round a small clearing with a cabin.
// Their models are the frost kit families (scripts/blender/open-plots/frost.py: `lodges`, `pines`), placed only when the
// layout's kit has them, like every kit family.
import { HALF, INNER, placePlotModels, plotWriter, pool } from './kit.mjs';
import { nightMarketBuilders } from './nightMarket.mjs';

/** sRGB hex to linear RGB (the layout's palette rows) */
const linear = (hex) => [1, 3, 5].map(at => { const c = Number.parseInt(hex.slice(at, at + 2), 16) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
/** A stable variant (0 to count - 1) for a piece at tile-local (x, z), so neighbours differ and every bake repeats. */
const pick = (x, z, count, salt = 0) => (((Math.round(x * 4) * 7 + Math.round(z * 4) * 13 + salt) % count) + count) % count;

/**
 * OB3 open items: a baked shadow on the snow (the round-62 sheet's long blue shadows; the phone draws no cast shadows
 * here). The look pins a low morning sun, so a piece's shadow falls `shade.length` times its height along `shade.dir`
 * (plot axes, away from the sun): the hull of its footprint `base` (tile-local [x, z] points round `at`) and that
 * footprint pulled in by `taper` and moved down the shadow, in the snow-shadow blue, paler toward its far end. It lies
 * in the kit's draw 3 cm over the ground (ruled with it) and stops inside `bound` (the tile's edge, never over a canal).
 */
function shadow(w, p, shade, at, base, h, taper = 1, bound = HALF - 0.5) {
  if (shade === undefined) return;
  const [dx, dz] = w.local(shade.dir), [cx, cz] = at;
  let reach = shade.length * h;
  for (const [x, z] of base) for (const [c, d] of [[x, dx], [z, dz]]) {
    if (Math.abs(d) > 1e-6) reach = Math.min(reach, ((d > 0 ? bound : -bound) - c) / d);
  }
  if (!(reach > 1)) return;
  const near = base.map(([x, z]) => ({ x, z, far: false }));
  const far = base.map(([x, z]) => ({ x: cx + (x - cx) * taper + dx * reach, z: cz + (z - cz) * taper + dz * reach, far: true }));
  // the hull (monotone chain), counter-clockwise seen from above
  const points = [...near, ...far].sort((a, b) => a.x - b.x || a.z - b.z), turn = (o, a, b) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);
  const lower = [], upper = [];
  for (const q of points) { while (lower.length >= 2 && turn(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  for (const q of [...points].reverse()) { while (upper.length >= 2 && turn(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)];
  const dark = p.snowShadow ?? p.snowShade ?? p.paving, pale = dark.map((v, i) => v + ((p.paving[i] ?? v) - v) * 0.55);
  const colour = q => (q.far ? pale : dark), y = 0.03;
  const mid = { x: hull.reduce((sum, q) => sum + q.x, 0) / hull.length, z: hull.reduce((sum, q) => sum + q.z, 0) / hull.length };
  const midColour = dark.map((v, i) => (v + (pale[i] ?? v)) / 2);
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i], b = hull[(i + 1) % hull.length];
    // counter-clockwise in (x, z) faces down (y up = z x x); the writer's triangle takes the up-facing order
    w.triColours('Kit', [mid.x, y, mid.z], [b.x, y, b.z], [a.x, y, a.z], [midColour, colour(b), colour(a)]);
  }
}
/** an n-gon footprint of radius r round (x, z) */
const ring = (x, z, r, n = 8) => Array.from({ length: n }, (_, i) => [x + r * Math.cos(i / n * Math.PI * 2), z + r * Math.sin(i / n * Math.PI * 2)]);

/** A snow bank: a low drift box, its top the snow colour (the kit's ground stays the paving's). */
function drift(w, p, x0, z0, x1, z1, h = 0.5) {
  w.box('Kit', [x0, 0, z0], [x1, h, z1], p.snowShade ?? p.lawn, p.snow ?? p.lawn);
}

/** A lantern post (the kit's stone post lantern, retinted) and its pool of light. */
function post(w, x, z, p, yaw) {
  if (w.hasModel('lanterns')) w.placeModel('lanterns', 0, x, z, { height: 2.8, yaw });
  else {
    w.lanternEmitter?.([x, 3.2, z], [...p.lantern]);
    w.sides('Kit', [x - 0.1, 0, z - 0.1], [x + 0.1, 2.8, z + 0.1], p.stone);
    w.box('Glow', [x - 0.25, 2.8, z - 0.25], [x + 0.25, 3.5, z + 0.25], p.lantern, p.lantern);
  }
  w.solid([x - 0.15, 0, z - 0.15], [x + 0.15, 2.8, z + 0.15]);
  pool(w, x, z, 4, p.pool);
}

/** OB3 look round 1: Frostline's own L1 stand-ins (the generic coarse box took its top from up-facing faces, and a steep
 *  snow roof or a pine cone has almost none: the courts read as dark brown and green cubes from the road and above). A pine
 *  clump is one pyramid, needles below and snow on its tip; a lodge is its walls under a white gable. */
function coarseCone(w, p, x, z, r, h) {
  const base = (i) => [x + r * Math.sin(i * Math.PI / 2), h * 0.08, z + r * Math.cos(i * Math.PI / 2)], tip = [x, h, z], snow = p.snow ?? p.foliage;
  for (let i = 0; i < 4; i++) w.triColours('coarse', base(i), base(i + 1), tip, [p.foliage, p.foliage, snow]);
}
/** one snow-tipped pyramid a clump, as wide as the clump (4 triangles: cheaper than the generic box's 12) */
function coarsePines(w, p, x, z, variant) {
  const [r, h] = variant === 0 ? [2.2, 7] : variant === 1 ? [3.4, 8] : [4, 9];
  coarseCone(w, p, x, z, r, h);
}
function coarseLodge(w, p, x, z, hx, hz) {
  const wall = 4, ridge = 7.2;
  w.sides('coarse', [x - hx, 0, z - hz], [x + hx, wall, z + hz], p.wood);
  const roof = p.snow ?? p.roof, e = 0.6;
  if (hx >= hz) {
    w.quad('coarse', [x - hx - e, wall, z - hz - e], [x - hx - e, ridge, z], [x + hx + e, ridge, z], [x + hx + e, wall, z - hz - e], roof);
    w.quad('coarse', [x + hx + e, wall, z + hz + e], [x + hx + e, ridge, z], [x - hx - e, ridge, z], [x - hx - e, wall, z + hz + e], roof);
    w.tri('coarse', [x - hx, wall, z + hz], [x - hx, ridge, z], [x - hx, wall, z - hz], p.wood); w.tri('coarse', [x + hx, wall, z - hz], [x + hx, ridge, z], [x + hx, wall, z + hz], p.wood);
  } else {
    w.quad('coarse', [x + hx + e, wall, z - hz - e], [x, ridge, z - hz - e], [x, ridge, z + hz + e], [x + hx + e, wall, z + hz + e], roof);
    w.quad('coarse', [x - hx - e, wall, z + hz + e], [x, ridge, z + hz + e], [x, ridge, z - hz - e], [x - hx - e, wall, z - hz - e], roof);
    w.tri('coarse', [x - hx, wall, z - hz], [x, ridge, z - hz], [x + hx, wall, z - hz], p.wood); w.tri('coarse', [x + hx, wall, z + hz], [x, ridge, z + hz], [x - hx, wall, z + hz], p.wood);
  }
}

/** A pine clump (the kit's, 3 / 5 / 8 trees), or a stand-in cone when the kit has no pines, and its shadow. */
function pines(w, p, x, z, variant, shade, bound) {
  const [r, h] = variant === 0 ? [2.2, 7] : variant === 1 ? [3.4, 8] : [4, 9];
  // OP26: a clump in a poster's keep-out stands nowhere (its shadow is drawn before its model would be refused)
  if (!w.clear(x, z, r)) return;
  shadow(w, p, shade, [x, z], ring(x, z, r * 0.8, 5), h, 0.3, bound);
  if (w.hasModel('pines')) { w.placeModel('pines', variant, x, z, { yaw: pick(x, z, 4) * Math.PI / 2 }); coarsePines(w, p, x, z, variant); }
  else for (const [dx, dz] of [[0, 0], [2.4, 1.2], [-2, 1.6]]) {
    w.sides('Kit', [x + dx - 0.2, 0, z + dz - 0.2], [x + dx + 0.2, 2, z + dz + 0.2], p.trunk);
    w.box('Kit', [x + dx - 1.6, 2, z + dz - 1.6], [x + dx + 1.6, 7, z + dz + 1.6], p.foliage, p.snow ?? p.foliage);
  }
  w.solid([x - 1, 0, z - 1], [x + 1, 4, z + 1]);
}

/** D lodges: a lodge across the north of a snowy court, a chalet and a cabin on its sides facing in, drifts along the
 *  walls, pines in the corners, two lantern posts at the court's south mouth. `variant` swaps the side houses. */
function lodges(w, p, variant, shade) {
  const houses = [[0, 17, 0, Math.PI], [variant === 0 ? -17 : 17, -2, 1, variant === 0 ? Math.PI / 2 : -Math.PI / 2],
    [variant === 0 ? 17 : -17, -4, 2, variant === 0 ? -Math.PI / 2 : Math.PI / 2]];
  for (const [x, z, kind, yaw] of houses) {
    const half = kind === 0 ? [5.3, 3.8] : kind === 1 ? [4.3, 4.3] : [3.3, 2.8];
    const [hx, hz] = Math.abs(Math.sin(yaw)) > 0.5 ? [half[1], half[0]] : half;
    if (w.hasModel('lodges')) { w.placeModel('lodges', kind, x, z, { yaw }); coarseLodge(w, p, x, z, hx, hz); }
    w.solid([x - hx, 0, z - hz], [x + hx, 6, z + hz]);
    shadow(w, p, shade, [x, z], [[x - hx, z - hz], [x + hx, z - hz], [x + hx, z + hz], [x - hx, z + hz]], 6);
  }
  drift(w, p, -INNER, INNER - 2.5, INNER, INNER); drift(w, p, -INNER, -INNER, -INNER + 2.5, INNER - 2.5);
  drift(w, p, INNER - 2.5, -INNER, INNER, INNER - 2.5);
  for (const [x, z, v] of [[-22, 22, 1], [22, 22, 0], [-22, -22, 0], [22, -22, 1]]) pines(w, p, x, z, v, shade);
  for (const x of [-5, 5]) post(w, x, -20, p, 0);
}

/** F pines: a pine wood of nine clumps round a clearing with a cabin and its lantern. */
function wood(w, p, variant, shade) {
  const spots = [[-20, 20, 2], [0, 22, 1], [20, 20, 2], [-21, 0, 1], [21, 1, 2], [-20, -20, 2], [0, -21, 1], [20, -20, 2], [10, 10, 0]];
  for (const [i, [x, z, v]] of spots.entries()) pines(w, p, variant === 0 ? x : -x, z, (v + i) % 3, shade);
  if (w.hasModel('lodges')) { w.placeModel('lodges', 2, variant === 0 ? -6 : 6, -6, { yaw: 0 }); coarseLodge(w, p, variant === 0 ? -6 : 6, -6, 3.3, 2.8); }
  w.solid([(variant === 0 ? -6 : 6) - 3.3, 0, -6 - 2.8], [(variant === 0 ? -6 : 6) + 3.3, 4, -6 + 2.8]);
  drift(w, p, -6, 4, 6, 7, 0.6);
  post(w, variant === 0 ? -1.5 : 1.5, -9.5, p, 0);
}

/** The far stand-ins (RM11): the snowy ground, the lodges' boxes under white roofs, the pines as dark cones. */
function farFrost(w, p, type, variant) {
  w.floor('far', -31.25, -31.25, 31.25, 31.25, 0, p.snow ?? p.paving);
  const cone = (x, z, r, h) => {
    for (let i = 0; i < 5; i++) {
      const a0 = i / 5 * Math.PI * 2, a1 = (i + 1) / 5 * Math.PI * 2;
      w.tri('far', [x + r * Math.sin(a0), 1, z + r * Math.cos(a0)], [x + r * Math.sin(a1), 1, z + r * Math.cos(a1)], [x, h, z], p.foliage);
    }
  };
  if (type === 'D') {
    for (const [x, z, hx, hz] of [[0, 17, 5, 3.5], [-17, -2, 4, 4], [17, -4, 3, 2.5]]) {
      w.sides('far', [x - hx, 0, z - hz], [x + hx, 5, z + hz], p.wood);
      w.floor('far', x - hx - 0.8, z - hz - 0.8, x + hx + 0.8, z + hz + 0.8, 7.5, p.snow ?? p.roof);
    }
    for (const [x, z] of [[-22, 22], [22, 22], [-22, -22], [22, -22]]) cone(x, z, 3, 8);
  } else for (const [x, z] of [[-20, 20], [0, 22], [20, 20], [-21, 0], [21, 1], [-20, -20], [0, -21], [20, -20], [10, 10]]) cone(variant === 0 ? x : -x, z, 3.4, 9);
}

/** OB3 look round 3: a lane seam (in place of Night Market's string lights and red banner posts, which round 62 doesn't
 *  have): one lantern post at each end of the seam, on alternate sides, and nothing on the peak's foot or over the four
 *  road entries. */
function frostLane(w, p, side, centre) {
  const along = (u, off) => (side === 0 ? [u, HALF + off] : [HALF + off, -u]);
  const clear = (x, z) => { const wx = centre[0] + x, wz = centre[1] + z, margin = 1.5;
    return (Math.abs(wx) < 4 + margin && Math.abs(wz) > 235 - margin) || (Math.abs(wz) < 4 + margin && Math.abs(wx) > 235 - margin) || Math.hypot(wx, wz) < 50; };
  for (const [u, off] of [[-HALF + 4, -3], [HALF - 4, 3]]) {
    const [x, z] = along(u, off);
    if (!clear(x, z)) post(w, x, z, p, side === 0 ? 0 : Math.PI / 2);
  }
}

/** D and F; `shade` is the layout's `shadows` row ({ dir, length }), or undefined for none. */
const theme = shade => ({
  D: { build: (w, p, variant) => lodges(w, p, variant, shade), far: (w, p, variant) => farFrost(w, p, 'D', variant), sockets: 'pppp' },
  F: { build: (w, p, variant) => wood(w, p, variant, shade), far: (w, p, variant) => farFrost(w, p, 'F', variant), sockets: 'pppp' },
});

/** Frostline's builders: a layout's shared letters (Night Market's kinds, `layout.builders`) plus D and F. */
export function frostlineBuilders(letters, shade) {
  const shared = nightMarketBuilders(letters), own = theme(shade);
  for (const letter of Object.keys(own)) if (Object.hasOwn(shared.tiles, letter)) throw new Error(`frostline-peaks: letter ${letter} is a theme tile`);
  return { tiles: { ...shared.tiles, ...own }, coarseFamilies: shared.coarseFamilies, seam: frostLane };
}

/** The chair lift's placements and cable (the layout's `landmark.lift`: `stations` [bottom, top] and `towers` as
 *  [x, y, z] plot metres on the peak's surface, `chairs` a line): the kit's `lift` stations and towers turned across the
 *  line, its chairs hung at their grips along the up and down cables, 1.8 m either side of the line, which sag 12 m over
 *  the towers' feet between them. A tower may give its sheaves' height as a fourth number (the kit's tower is 11.9 m;
 *  OB3: the first tower below Frostline's lodge terrace stands 22 m, so the cable clears the cliff lip), scaled to it.
 *  Returns the placements; the cables are written into `cable` (the Kit soup). */
/** the kit's lift tower: its sheaves' height (m) at scale 1 */
const TOWER = 11.9;
export function liftPlacements(lift, cable, colour) {
  const { stations, towers, chairs = 12 } = lift, line = [stations[0], ...towers, stations[1]];
  const [[x0, , z0], [x1, , z1]] = [line[0], line[line.length - 1]], yaw = Math.atan2(x1 - x0, z1 - z0);
  const across = [Math.cos(yaw) * 1.8, 0, -Math.sin(yaw) * 1.8];
  const height = (k) => (k === 0 || k === line.length - 1 ? 3.0 : line[k][3] ?? TOWER); // a station's wheel, a tower's sheaves
  const cablePoint = (k, s) => [line[k][0] + across[0] * s, line[k][1] + height(k), line[k][2] + across[2] * s];
  const placements = [{ family: 'lift', variant: 2, at: stations[0], scale: 1, yaw }, { family: 'lift', variant: 2, at: stations[1], scale: 1, yaw: yaw + Math.PI },
    ...towers.map(([x, y, z, sheaves = TOWER]) => ({ family: 'lift', variant: 0, at: [x, y, z], scale: sheaves / TOWER, yaw }))];
  for (const s of [-1, 1]) {
    for (let k = 0; k + 1 < line.length; k++) {
      const a = cablePoint(k, s), b = cablePoint(k + 1, s), r = 0.06;
      cable.tri('Kit', [a[0], a[1] + r, a[2]], [b[0], b[1] + r, b[2]], [b[0] + across[0] * r, b[1], b[2] + across[2] * r], colour);
      cable.tri('Kit', [a[0], a[1] + r, a[2]], [b[0] + across[0] * r, b[1], b[2] + across[2] * r], [a[0] + across[0] * r, a[1], a[2] + across[2] * r], colour);
      cable.tri('Kit', [b[0], b[1] + r, b[2]], [a[0], a[1] + r, a[2]], [a[0] - across[0] * r, a[1], a[2] - across[2] * r], colour);
      cable.tri('Kit', [b[0], b[1] + r, b[2]], [a[0] - across[0] * r, a[1], a[2] - across[2] * r], [b[0] - across[0] * r, b[1], b[2] - across[2] * r], colour);
    }
    for (let i = 0; i < chairs / 2; i++) {
      const t = (i + (s > 0 ? 0.25 : 0.75)) / (chairs / 2) * (line.length - 1), k = Math.min(line.length - 2, Math.floor(t)), u = t - k;
      const a = cablePoint(k, s), b = cablePoint(k + 1, s);
      placements.push({ family: 'lift', variant: 1, at: [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u], scale: 1, yaw: s > 0 ? yaw : yaw + Math.PI });
    }
  }
  return placements;
}

/** NM10's moving-light marking (nightMarket.mjs): a tetrahedron in Glow whose colour has no green, red in [0.5, 1) its seed
 *  (the glow graph's steady mode: drifting slowly, never blinking to black) and full blue, which the graph lights frost
 *  white: a glint of wind-blown snow. */
let seeds = 0;
function glint(w, x, y, z, s) {
  seeds++;
  const c = [((seeds * 0.6180339887) % 1) * 0.5 + 0.5, 0, 1];
  const top = [x, y + s * 1.4, z], a = [x - s, y - s, z - s], b = [x + s, y - s, z - s], d = [x, y - s, z + s * 1.4];
  w.tri('Glow', top, b, a, c); w.tri('Glow', top, d, b, c); w.tri('Glow', top, a, d, c); w.tri('Glow', a, b, d, c);
}

/** Hooks at the generic construction points (tiledPlotCore.mjs): the landmark's chair lift (`landmark.lift`) and
 *  lanterns (none by default: its lodge's windows are its light), and a cool pool of light round the peak's foot.
 *  OB3 (bar 7): snow glints blowing off the summit (the layout's `landmark.glints`, plot metres for the 70 m peak at turn
 *  0, before the lodge and the crown). They are Glow, which the coarse tiles keep, so with the lamps' flicker they are the
 *  plot's motion seen from the road entry: 0.6 m glints up a 5 m column at each point. */
export const frostlinePlot = {
  builders: layout => frostlineBuilders(layout.builders, layout.shadows),
  lanternBake: { gain: 0.8, radius: 1.5, cut: 3 },
  models(parts, kit, layout) {
    const lift = layout.landmark.lift === undefined ? [] : liftPlacements(layout.landmark.lift, parts.Kit, linear(layout.palette.iron ?? '#2b2b33'));
    placePlotModels(parts, kit, [...lift, ...(layout.landmark.lanterns ?? []).map(at =>
      ({ family: layout.landmark.lanternFamily ?? 'hero', variant: layout.landmark.lanternVariant ?? 2, at, scale: layout.landmark.lanternScale ?? 1 }))],
    new Set(['lodges', 'pines', 'lift']));
    // OB3 open items: round 62 hugs the peak with pines: the layout's `plazaPines` ([x, z, variant] in one quarter, plot
    // metres, mirrored into all four), on the plaza outside the peak's foot, their shadows kept on the plaza
    const plaza = plotWriter(parts, kit, new Set(['pines'])), palette = Object.fromEntries(Object.entries(layout.palette).map(([key, hex]) => [key, linear(hex)]));
    for (const [x, z, v] of layout.plazaPines ?? []) for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) pines(plaza, palette, sx * x, sz * z, v, layout.shadows, 61);
    const writer = { tri: (part, a, b, c, colour) => parts[part].tri(part, a, b, c, colour) }, k = (layout.landmark.height ?? 70) / 70;
    for (const [x, y, z] of layout.landmark.glints ?? []) {
      for (let i = 0; i < 7; i++) glint(writer, (x + Math.sin(i * 2.4) * 1.5) * k, (y + i * 0.75) * k, (z + Math.cos(i * 2.4) * 1.5) * k, 0.6);
    }
  },
  pools(parts, palette) {
    const lit = { Pool: parts.Pool }, poolWriter = { triColours: (part, a, b, c, colours) => lit[part].triColours(part, [a, b, c], colours) };
    pool(poolWriter, 0, 0, 34, palette.gatePool, 0.05);
  },
};
