// OB3 (open-plots build-out, G978): Frostline Peaks' tile vocabulary. The shared letters are Night Market's builders
// (canals, forecourts, plaza, gardens, retinted by the layout's palette: its canals read as the frozen blue canals); two
// theme tiles are Frostline's own, both snowy courts whose paved border meets any neighbour ('pppp'):
//   D lodges: three timber lodges round a snowy court, pines in its corners, lantern posts at its mouth;
//   F pines:  a dense pine wood round a small clearing with a cabin.
// Their models are the frost kit families (scripts/blender/open-plots/frost.py: `lodges`, `pines`), placed only when the
// layout's kit has them, like every kit family.
import { INNER, placePlotModels, pool } from './kit.mjs';
import { nightMarketBuilders } from './nightMarket.mjs';

/** sRGB hex to linear RGB (the layout's palette rows) */
const linear = (hex) => [1, 3, 5].map(at => { const c = Number.parseInt(hex.slice(at, at + 2), 16) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
/** A stable variant (0 to count - 1) for a piece at tile-local (x, z), so neighbours differ and every bake repeats. */
const pick = (x, z, count, salt = 0) => (((Math.round(x * 4) * 7 + Math.round(z * 4) * 13 + salt) % count) + count) % count;

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

/** A pine clump (the kit's, 3 / 5 / 8 trees), or a stand-in cone when the kit has no pines. */
function pines(w, p, x, z, variant) {
  if (w.hasModel('pines')) w.placeModel('pines', variant, x, z, { yaw: pick(x, z, 4) * Math.PI / 2 });
  else for (const [dx, dz] of [[0, 0], [2.4, 1.2], [-2, 1.6]]) {
    w.sides('Kit', [x + dx - 0.2, 0, z + dz - 0.2], [x + dx + 0.2, 2, z + dz + 0.2], p.trunk);
    w.box('Kit', [x + dx - 1.6, 2, z + dz - 1.6], [x + dx + 1.6, 7, z + dz + 1.6], p.foliage, p.snow ?? p.foliage);
  }
  w.solid([x - 1, 0, z - 1], [x + 1, 4, z + 1]);
}

/** D lodges: a lodge across the north of a snowy court, a chalet and a cabin on its sides facing in, drifts along the
 *  walls, pines in the corners, two lantern posts at the court's south mouth. `variant` swaps the side houses. */
function lodges(w, p, variant) {
  const houses = [[0, 17, 0, Math.PI], [variant === 0 ? -17 : 17, -2, 1, variant === 0 ? Math.PI / 2 : -Math.PI / 2],
    [variant === 0 ? 17 : -17, -4, 2, variant === 0 ? -Math.PI / 2 : Math.PI / 2]];
  for (const [x, z, kind, yaw] of houses) {
    if (w.hasModel('lodges')) w.placeModel('lodges', kind, x, z, { yaw });
    const half = kind === 0 ? [5.3, 3.8] : kind === 1 ? [4.3, 4.3] : [3.3, 2.8];
    const [hx, hz] = Math.abs(Math.sin(yaw)) > 0.5 ? [half[1], half[0]] : half;
    w.solid([x - hx, 0, z - hz], [x + hx, 6, z + hz]);
  }
  drift(w, p, -INNER, INNER - 2.5, INNER, INNER); drift(w, p, -INNER, -INNER, -INNER + 2.5, INNER - 2.5);
  drift(w, p, INNER - 2.5, -INNER, INNER, INNER - 2.5);
  for (const [x, z, v] of [[-22, 22, 1], [22, 22, 0], [-22, -22, 0], [22, -22, 1]]) pines(w, p, x, z, v);
  for (const x of [-5, 5]) post(w, x, -20, p, 0);
}

/** F pines: a pine wood of nine clumps round a clearing with a cabin and its lantern. */
function wood(w, p, variant) {
  const spots = [[-20, 20, 2], [0, 22, 1], [20, 20, 2], [-21, 0, 1], [21, 1, 2], [-20, -20, 2], [0, -21, 1], [20, -20, 2], [10, 10, 0]];
  for (const [i, [x, z, v]] of spots.entries()) pines(w, p, variant === 0 ? x : -x, z, (v + i) % 3);
  if (w.hasModel('lodges')) w.placeModel('lodges', 2, variant === 0 ? -6 : 6, -6, { yaw: 0 });
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

const THEME = {
  D: { build: lodges, far: (w, p, variant) => farFrost(w, p, 'D', variant), sockets: 'pppp' },
  F: { build: wood, far: (w, p, variant) => farFrost(w, p, 'F', variant), sockets: 'pppp' },
};

/** Frostline's builders: a layout's shared letters (Night Market's kinds, `layout.builders`) plus D and F. */
export function frostlineBuilders(letters) {
  const shared = nightMarketBuilders(letters);
  for (const letter of Object.keys(THEME)) if (Object.hasOwn(shared.tiles, letter)) throw new Error(`frostline-peaks: letter ${letter} is a theme tile`);
  return { tiles: { ...shared.tiles, ...THEME }, coarseFamilies: new Set([...shared.coarseFamilies, 'lodges', 'pines']), seam: shared.seam };
}

/** The chair lift's placements and cable (the layout's `landmark.lift`: `stations` [bottom, top] and `towers` as
 *  [x, y, z] plot metres on the peak's surface, `chairs` a line): the kit's `lift` stations and towers turned across the
 *  line, its chairs hung at their grips along the up and down cables, 1.8 m either side of the line, which sag 12 m over
 *  the towers' feet between them. Returns the placements; the cables are written into `cable` (the Kit soup). */
export function liftPlacements(lift, cable, colour) {
  const { stations, towers, chairs = 12 } = lift, line = [stations[0], ...towers, stations[1]];
  const [[x0, , z0], [x1, , z1]] = [line[0], line[line.length - 1]], yaw = Math.atan2(x1 - x0, z1 - z0);
  const across = [Math.cos(yaw) * 1.8, 0, -Math.sin(yaw) * 1.8];
  const height = (k) => (k === 0 || k === line.length - 1 ? 3.0 : 11.9); // a station's wheel, a tower's sheaves
  const cablePoint = (k, s) => [line[k][0] + across[0] * s, line[k][1] + height(k), line[k][2] + across[2] * s];
  const placements = [{ family: 'lift', variant: 2, at: stations[0], scale: 1, yaw }, { family: 'lift', variant: 2, at: stations[1], scale: 1, yaw: yaw + Math.PI },
    ...towers.map(at => ({ family: 'lift', variant: 0, at, scale: 1, yaw }))];
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

/** Hooks at the generic construction points (tiledPlotCore.mjs): the landmark's chair lift (`landmark.lift`) and
 *  lanterns (none by default: its lodge's windows are its light), and a cool pool of light round the peak's foot. */
export const frostlinePlot = {
  builders: layout => frostlineBuilders(layout.builders),
  lanternBake: { gain: 0.8, radius: 1.5, cut: 3 },
  models(parts, kit, layout) {
    const lift = layout.landmark.lift === undefined ? [] : liftPlacements(layout.landmark.lift, parts.Kit, linear(layout.palette.iron ?? '#2b2b33'));
    placePlotModels(parts, kit, [...lift, ...(layout.landmark.lanterns ?? []).map(at =>
      ({ family: layout.landmark.lanternFamily ?? 'hero', variant: layout.landmark.lanternVariant ?? 2, at, scale: layout.landmark.lanternScale ?? 1 }))],
    new Set(['lodges', 'pines', 'lift']));
  },
  pools(parts, palette) {
    const lit = { Pool: parts.Pool }, plotWriter = { triColours: (part, a, b, c, colours) => lit[part].triColours(part, [a, b, c], colours) };
    pool(plotWriter, 0, 0, 34, palette.gatePool, 0.05);
  },
};
