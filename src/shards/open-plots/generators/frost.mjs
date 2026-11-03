// OB3 (open-plots build-out, G978): Frostline Peaks' tile vocabulary. The shared letters are Night Market's builders
// (canals, forecourts, plaza, gardens, retinted by the layout's palette: its canals read as the frozen blue canals); two
// theme tiles are Frostline's own, both snowy courts whose paved border meets any neighbour ('pppp'):
//   D lodges: three timber lodges round a snowy court, pines in its corners, lantern posts at its mouth;
//   F pines:  a dense pine wood round a small clearing with a cabin.
// Their models are the frost kit families (scripts/blender/open-plots/frost.py: `lodges`, `pines`), placed only when the
// layout's kit has them, like every kit family.
import { INNER, placePlotModels, pool } from './kit.mjs';
import { nightMarketBuilders } from './nightMarket.mjs';

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

/** Hooks at the generic construction points (tiledPlotCore.mjs): the landmark's lanterns (none by default: its lodge's
 *  windows are its light) and a cool pool of light round the peak's foot. */
export const frostlinePlot = {
  builders: layout => frostlineBuilders(layout.builders),
  lanternBake: { gain: 0.8, radius: 1.5, cut: 3 },
  models(parts, kit, layout) {
    placePlotModels(parts, kit, (layout.landmark.lanterns ?? []).map(at =>
      ({ family: layout.landmark.lanternFamily ?? 'hero', variant: layout.landmark.lanternVariant ?? 2, at, scale: layout.landmark.lanternScale ?? 1 })),
    new Set(['lodges', 'pines']));
  },
  pools(parts, palette) {
    const lit = { Pool: parts.Pool }, plotWriter = { triColours: (part, a, b, c, colours) => lit[part].triColours(part, [a, b, c], colours) };
    pool(plotWriter, 0, 0, 34, palette.gatePool, 0.05);
  },
};
