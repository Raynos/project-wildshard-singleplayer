// OB2 (open-plots build-out, G978): Lantern Bayou's tile vocabulary. The shared letters are Night Market's builders
// (gardens, canals, forecourts, plaza, retinted by the layout's palette); two theme tiles are the bayou's own, both inset
// ponds whose paved boardwalk border meets any neighbour ('pppp'):
//   T stilts: a pond with two stilt houses and a boat house standing in it, facing the boardwalk on its north side;
//   W marsh:  a lily-and-reed pond with cypress knees, fireflies over it and lantern posts on its corners.
// Their models are the bayou kit families (scripts/blender/open-plots/bayou.py: `stilts`, `marsh`), placed only when
// the layout's kit has them, like every kit family.
import { HALF, INNER, placePlotModels, pool } from './kit.mjs';
import { nightMarketBuilders } from './nightMarket.mjs';

/** the ponds' water below the boardwalk (the canal's level, kit.py BRIDGE['water']) */
const DEPTH = 0.45;
/** T's pond (x0, z0, x1, z1 at rotation 0): open south, its boardwalk the north strip the houses face */
const STILT_POND = [-INNER + 1, -INNER + 1, INNER - 1, 12];
/** W's pond: the tile's middle inside a boardwalk border */
const MARSH_POND = [-21, -21, 21, 21];

/** A stable variant (0 to count - 1) for a piece at tile-local (x, z), so neighbours differ and every bake repeats. */
const pick = (x, z, count, salt = 0) => (((Math.round(x * 4) * 7 + Math.round(z * 4) * 13 + salt) % count) + count) % count;

/** NM10's moving-light marking (nightMarket.mjs): a firefly is a 12 cm tetrahedron in Glow whose colour has red alone,
 *  red in [0, 0.5) its seed; the glow graph wanders and blinks it. */
let seeds = 0;
function firefly(w, x, y, z) {
  seeds++;
  const c = [((seeds * 0.6180339887) % 1) * 0.5, 0, 0], s = 0.12;
  const top = [x, y + s * 1.4, z], a = [x - s, y - s, z - s], b = [x + s, y - s, z - s], d = [x, y - s, z + s * 1.4];
  w.tri('Glow', top, b, a, c); w.tri('Glow', top, d, b, c); w.tri('Glow', top, a, d, c); w.tri('Glow', a, b, d, c);
}

/** A pond: recessed water, its banks walked with the water on their left so they face it, a collision skirt. */
function pond(w, p, [x0, z0, x1, z1]) {
  w.floor('Water', x0, z0, x1, z1, -DEPTH, p.water);
  for (const [xa, za, xb, zb] of [[x0, z1, x0, z0], [x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1]]) {
    w.quad('Kit', [xa, -DEPTH, za], [xb, -DEPTH, zb], [xb, 0, zb], [xa, 0, za], p.bank ?? p.stone);
  }
  w.solid([x0, -DEPTH - 0.3, z0], [x1, -DEPTH, z1]);
}

/** A lantern post on the boardwalk (the kit's paper-lantern bracket, retinted) and its pool of light. */
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

/** T stilts: two stilt houses and a boat house standing in the pond, their porches toward the north boardwalk, lily
 *  patches and reeds between them, fireflies, lanterns along the boardwalk's edge. `variant` swaps the houses' order. */
function stilts(w, p, variant) {
  pond(w, p, STILT_POND);
  const houses = variant === 0 ? [[-14, 6, 0], [6, 6, 1], [21, -2, 2]] : [[-17, -2, 2], [-2, 6, 1], [16, 6, 0]];
  for (const [x, z, kind] of houses) {
    // a model's front is +z at yaw 0: the porches face the north boardwalk
    if (w.hasModel('stilts')) w.placeModel('stilts', kind, x, z, { yaw: 0 });
    // the deck and porch walk (the models' decks stand 1.2-1.8 m up; their footprint is the collider)
    w.solid([x - 5, -DEPTH, z - 3], [x + 5, 1.8, z + 4.6]);
  }
  if (w.hasModel('marsh')) {
    for (const [x, z, v] of [[-4, -14, 0], [14, -18, 0], [-22, -17, 1], [24, -20, 1], [-6, -24, 2]]) w.placeModel('marsh', v, x, z, { yaw: pick(x, z, 4) * Math.PI / 2 });
  }
  for (const [x, z] of [[-8, -10], [10, -12], [-20, -4], [2, -20]]) firefly(w, x, 1.2 + pick(x, z, 3) * 0.5, z);
  for (const x of [-22, -6, 10, 24]) post(w, x, 14.5, p, Math.PI);
}

/** W marsh: a lily-and-reed pond in a boardwalk ring, knees at its middle, fireflies, a lantern post on each corner. */
function marsh(w, p, variant) {
  pond(w, p, MARSH_POND);
  if (w.hasModel('marsh')) {
    const spots = variant === 0
      ? [[-11, -10, 0], [11, 9, 0], [-12, 12, 0], [12, -12, 0], [-17, 0, 1], [17, 3, 1], [0, -17, 1], [2, 17, 1], [0, 0, 2]]
      : [[-10, 11, 0], [10, -10, 0], [12, 12, 0], [-12, -12, 0], [0, 17, 1], [-17, -3, 1], [17, 0, 1], [-3, -17, 1], [0, 0, 2]];
    for (const [x, z, v] of spots) w.placeModel('marsh', v, x, z, { yaw: pick(x, z, 4, v) * Math.PI / 2 });
  }
  for (const [x, z] of [[-6, -4], [7, 6], [-9, 12], [12, -8], [3, -13]]) firefly(w, x, 1.0 + pick(x, z, 3) * 0.6, z);
  for (const s of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) post(w, s[0] * 23.5, s[1] * 23.5, p, Math.atan2(-s[0], -s[1]));
}

/** The far stand-ins (RM11): each pond's water, the stilt houses' boxes and roofs, the reed beds as low green mounds. */
function farBayou(w, p, type, variant) {
  w.floor('far', -HALF, -HALF, HALF, HALF, 0, p.paving);
  const [x0, z0, x1, z1] = type === 'T' ? STILT_POND : MARSH_POND;
  w.floor('far', x0, z0, x1, z1, 0.04, p.water);
  if (type === 'T') {
    const houses = variant === 0 ? [[-14, 6], [6, 6], [21, -2]] : [[-17, -2], [-2, 6], [16, 6]];
    for (const [x, z] of houses) {
      w.sides('far', [x - 4, 1.6, z - 3], [x + 4, 4.4, z + 3], p.wall);
      w.quad('far', [x - 4.6, 4.4, z - 3.6], [x - 4.6, 6.6, z], [x + 4.6, 6.6, z], [x + 4.6, 4.4, z - 3.6], p.roof);
      w.quad('far', [x + 4.6, 4.4, z + 3.6], [x + 4.6, 6.6, z], [x - 4.6, 6.6, z], [x - 4.6, 4.4, z + 3.6], p.roof);
    }
  } else for (const [x, z] of [[-17, 0], [17, 3], [0, -17], [2, 17]]) w.box('far', [x - 2, 0, z - 2], [x + 2, 1.6, z + 2], p.reed ?? p.foliage);
}

const THEME = {
  T: { build: stilts, far: (w, p, variant) => farBayou(w, p, 'T', variant), sockets: 'pppp', water: [STILT_POND] },
  W: { build: marsh, far: (w, p, variant) => farBayou(w, p, 'W', variant), sockets: 'pppp', water: [MARSH_POND] },
};

/** The bayou's builders: a layout's shared letters (Night Market's kinds, `layout.builders`) plus T and W. */
export function lanternBayouBuilders(letters) {
  const shared = nightMarketBuilders(letters);
  for (const letter of Object.keys(THEME)) if (Object.hasOwn(shared.tiles, letter)) throw new Error(`lantern-bayou: letter ${letter} is a theme tile`);
  return { tiles: { ...shared.tiles, ...THEME }, coarseFamilies: new Set([...shared.coarseFamilies, 'stilts']), seam: shared.seam };
}

/** Hooks at the generic construction points (tiledPlotCore.mjs): the landmark's lanterns are the kit's hero lanterns
 *  (`hero`, take C: the iron box) hung at the cypress's rope ends (build/hooks.json of scripts/blender/open-plots/cypress.py). */
export const lanternBayouPlot = {
  builders: layout => lanternBayouBuilders(layout.builders),
  lanternBake: { gain: 0.8, radius: 1.5, cut: 3 },
  // T8: the ring in the kit's draw, so an edge tile holds Kit, Water, Glow and Pool (8 draws, not 9)
  ringInKit: true,
  models(parts, kit, layout) {
    placePlotModels(parts, kit, (layout.landmark.lanterns ?? []).map(at =>
      ({ family: layout.landmark.lanternFamily ?? 'hero', variant: layout.landmark.lanternVariant ?? 2, at, scale: layout.landmark.lanternScale ?? 1 })),
    new Set(['stilts']));
  },
  // a wide warm pool under the cypress's crown, and one under each of its four lowest limbs
  pools(parts, palette) {
    const lit = { Pool: parts.Pool }, plotWriter = { triColours: (part, a, b, c, colours) => lit[part].triColours(part, [a, b, c], colours) };
    pool(plotWriter, 0, 0, 26, palette.gatePool, 0.07);
    for (let i = 0; i < 4; i++) { const a = (i + 0.5) / 4 * Math.PI * 2; pool(plotWriter, 15 * Math.sin(a), 15 * Math.cos(a), 9, palette.gatePool, 0.08); }
  },
};
