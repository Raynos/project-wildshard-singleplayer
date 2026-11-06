// OB4 (open-plots build-out, G978): Ember Forge's tile vocabulary. The shared letters are Night Market's builders
// (plaza, canals and bends, retinted by the layout's palette: basalt paving, blue lamps, and with the row's `water: "lava"`
// the canals' water drawn as molten lava, data/lava.graph.json); two theme tiles are Ember's own, both basalt yards whose
// paved border meets any neighbour ('pppp'):
//   F forge: a court of the forge kit (scripts/blender/open-plots/forge.py): a two-stack foundry hall across its back,
//            a smithy either side, an open anvil yard in front, a coal heap in a corner, sparks over the hearths and smoke
//            off every stack;
//   O ore:   an ore yard of the ore kit: three coal heaps, a lattice crane hanging its bucket over the middle one, two
//            loaded carts on track, a low basalt retaining wall along its back, embers over the heaps.
// Their models are the `forges` and `ore` kit families, placed only when the layout's kit has them, like every kit family.
import { HALF, INNER, pool } from './kit.mjs';
import { nightMarketBuilders } from './nightMarket.mjs';

/** A stable variant (0 to count - 1) for a piece at tile-local (x, z), so neighbours differ and every bake repeats. */
const pick = (x, z, count, salt = 0) => (((Math.round(x * 4) * 7 + Math.round(z * 4) * 13 + salt) % count) + count) % count;

/** each forge piece's footprint at scale 1 (tile-local metres, its front +z; forge.py: x0, z0, x1, z1, height) */
const FORGE_BOXES = [
  [-3.1, -2.6, 3.1, 2.6, 5.2], // smithy
  [-5.1, -3.1, 5.1, 3.1, 6.6], // foundry
  [-3.2, -2.2, 3.2, 2.2, 3], // anvil yard (its posts and hearth: one low box)
];
/** each ore piece's footprint at scale 1 */
const ORE_BOXES = [
  [-3.6, -3.6, 3.6, 3.6, 2.4], // coal heap
  [-1.1, -1.1, 1.1, 1.1, 9.4], // crane mast (its boom and bucket overhang the heap in front)
  [-4.2, -0.9, 4.2, 0.9, 1.4], // carts on track
];
/** each piece's scale on its tile (density toward round 62: the forge court's hall fills its back half, the ore yard's
 *  heaps and crane read from the plaza's aerials) */
const SCALE = { hall: 2.5, smithy: 2.0, anvil: 2.0, cornerHeap: 1.3, heaps: [1.8, 2.1, 1.7], crane: 2.0, carts: 1.6 };
/** the ore yard's three heaps (tile-local x, z) at variant 0 */
const HEAPS = [[-15, 10], [0, 4], [15, 11]];
/** the foundry's two stacks' mouths (tile-local at scale 1, forge.py's x and -y) and the smithy's, for the smoke */
const STACKS = { 0: [[1.6, -0.9, 7.4]], 1: [[-2.4, -1.2, 10.6], [2.4, -1.2, 9.8]] };

let seeds = 0;
/** NM10's moving-light marking (nightMarket.mjs): a tetrahedron (12 cm by default) in Glow whose colour has red alone,
 *  red in [0, 0.5) its seed; the glow graph wanders and blinks it: an ember or a spark here. `steady` marks red in
 *  [0.5, 1), the graph's sky-lantern mode: always lit warm orange, drifting slowly (an ember that never blinks to black). */
function spark(w, x, y, z, s = 0.12, steady = false) {
  seeds++;
  const c = [((seeds * 0.6180339887) % 1) * 0.5 + (steady ? 0.5 : 0), 0, 0];
  const top = [x, y + s * 1.4, z], a = [x - s, y - s, z - s], b = [x + s, y - s, z - s], d = [x, y - s, z + s * 1.4];
  w.tri('Glow', top, b, a, c); w.tri('Glow', top, d, b, c); w.tri('Glow', top, a, d, c); w.tri('Glow', a, b, d, c);
}

/** RM10.2's steam marking (nightMarket.mjs `steam`): three small octahedra in the additive Pool draw, coloured blue with no
 *  red and seeded by green, which the pool graph lifts 2.4 m on a ~3 s loop, drifting and fading: smoke off a stack. */
function smoke(w, x, y, z, r = 0.4) {
  for (let k = 0; k < 3; k++) {
    seeds++;
    const c = [0, (seeds * 0.6180339887) % 1, 1], at = [x + (k - 1) * r / 2, y, z];
    const tip = [[0, r, 0], [0, -r, 0]], ring = [[r, 0, 0], [0, 0, r], [-r, 0, 0], [0, 0, -r]];
    const v = d => [at[0] + d[0], at[1] + d[1], at[2] + d[2]];
    for (let i = 0; i < 4; i++) {
      const a = ring[i], b = ring[(i + 1) % 4];
      w.tri('Pool', v(tip[0]), v(b), v(a), c); w.tri('Pool', v(tip[1]), v(a), v(b), c);
    }
  }
}

/** A kit piece at tile-local (x, z), turned `turns` quarter turns (its front from +z toward +x), scaled `scale`, and its
 *  footprint's collider. */
function piece(w, family, variant, boxes, x, z, turns, scale) {
  const yaw = turns * Math.PI / 2, c = Math.round(Math.cos(yaw)), s = Math.round(Math.sin(yaw));
  if (w.hasModel(family)) w.placeModel(family, variant, x, z, { yaw, scale });
  const [x0, z0, x1, z1, h] = boxes[variant] ?? [-1, -1, 1, 1, 1];
  const ax = (x0 * c + z0 * s) * scale, az = (-x0 * s + z0 * c) * scale, bx = (x1 * c + z1 * s) * scale, bz = (-x1 * s + z1 * c) * scale;
  w.solid([x + Math.min(ax, bx), 0, z + Math.min(az, bz)], [x + Math.max(ax, bx), h * scale, z + Math.max(az, bz)]);
  return (px, pz) => [x + (px * c + pz * s) * scale, z + (-px * s + pz * c) * scale];
}

/** A cold blue lamp: the kit's stone post lantern (retinted by the layout's lantern colour) and its pool of light. */
function lamp(w, p, x, z, yaw) {
  if (w.hasModel('lanterns')) w.placeModel('lanterns', 0, x, z, { height: 3.0, yaw });
  else {
    w.lanternEmitter?.([x, 3.4, z], [...p.lantern]);
    w.sides('Kit', [x - 0.12, 0, z - 0.12], [x + 0.12, 3.0, z + 0.12], p.basalt ?? p.stone);
    w.box('Glow', [x - 0.25, 3.0, z - 0.25], [x + 0.25, 3.7, z + 0.25], p.lantern, p.lantern);
  }
  w.solid([x - 0.15, 0, z - 0.15], [x + 0.15, 3.0, z + 0.15]);
  pool(w, x, z, 3, p.pool);
}

/** The yard's floor: one up-facing basalt slab a little proud of the paving (the kit material rules it as flagstones). */
function yard(w, p, x0, z0, x1, z1) {
  w.floor('Kit', x0, z0, x1, z1, 0.04, p.court);
}

/** F forge: the foundry hall across the back (north), a smithy either side facing in, the anvil yard in front, a coal
 *  heap in one front corner (`variant` picks which), smoke off every stack, sparks over the hearths, two blue lamps at the
 *  court's mouth (south). */
function forgeCourt(w, p, variant) {
  const m = variant === 0 ? 1 : -1;
  yard(w, p, -INNER, -INNER, INNER, INNER);
  const hall = piece(w, 'forges', 1, FORGE_BOXES, 0, 13, 0, SCALE.hall);
  for (const [sx, sz, sy] of STACKS[1]) { const [x, z] = hall(sx, sz); smoke(w, x, sy * SCALE.hall + 0.6, z, 0.5); }
  for (const side of [-1, 1]) {
    const smithy = piece(w, 'forges', 0, FORGE_BOXES, side * 15, -1, side < 0 ? 1 : 3, SCALE.smithy);
    for (const [sx, sz, sy] of STACKS[0]) { const [x, z] = smithy(sx, sz); smoke(w, x, sy * SCALE.smithy + 0.5, z); }
  }
  piece(w, 'forges', 2, FORGE_BOXES, 0, -9, 0, SCALE.anvil);
  piece(w, 'ore', 0, ORE_BOXES, m * -19, -19, 0, SCALE.cornerHeap);
  for (const [x, z, y] of [[1.6, -9, 2.2], [2.6, -8, 3.2], [0.8, -8.5, 4], [0, 4, 1.8], [-1.6, 4.5, 2.8]]) spark(w, x, y, z);
  for (const x of [-6, 6]) lamp(w, p, x, -INNER + 3, 0);
}

/** O ore: three coal heaps across the yard, the crane by the middle one with its bucket over it, two carts on their track
 *  along the front, a low basalt retaining wall along the back, embers over the heaps, a blue lamp at each front corner.
 *  `variant` mirrors it east-west. */
function oreYard(w, p, variant) {
  const m = variant === 0 ? 1 : -1;
  yard(w, p, -INNER, -INNER, INNER, INNER);
  w.box('Kit', [-INNER, 0, INNER - 2], [INNER, 1.6, INNER], p.basalt ?? p.stone, p.basaltTop ?? p.stoneTop);
  w.solid([-INNER, 0, INNER - 2], [INNER, 1.6, INNER]);
  for (const [i, [x, z]] of HEAPS.entries()) piece(w, 'ore', 0, ORE_BOXES, m * x, z, pick(x, z, 4), SCALE.heaps[i] ?? 1);
  // the crane stands south of the middle heap; its boom runs toward its back (game -z at turn 0), so turn it to face north
  piece(w, 'ore', 1, ORE_BOXES, m * 2, -7, 2, SCALE.crane);
  for (const x of [-12, 12]) piece(w, 'ore', 2, ORE_BOXES, m * x, -17, 0, SCALE.carts);
  for (const [x, z, y] of [[-15, 9, 4.6], [-13, 12, 3.6], [1, 3, 5.8], [-2, 6, 4.8], [15, 10, 4.0], [13, 12, 5.0]]) spark(w, m * x, y, z);
  for (const s of [-1, 1]) lamp(w, p, s * (INNER - 2), -INNER + 2, 0);
}

/** The far stand-ins (RM11): the basalt ground, the halls and smithies as dark boxes, the heaps as low ones. */
function farEmber(w, p, type, variant) {
  w.floor('far', -HALF, -HALF, HALF, HALF, 0, p.court ?? p.paving);
  const m = variant === 0 ? 1 : -1;
  // each box: its centre, half-extents and height, from the pieces' footprints at their scales (a smithy is turned a quarter)
  const at = (box, x, z, k, turned = false) => { const [hx, hz, h] = box.slice(2);
    return turned ? [x, z, hz * k, hx * k, h * k] : [x, z, hx * k, hz * k, h * k]; };
  const [smithy, hall, anvil] = FORGE_BOXES, [heap, mast] = ORE_BOXES;
  const boxes = type === 'F'
    ? [at(hall, 0, 13, SCALE.hall), at(smithy, -15, -1, SCALE.smithy, true), at(smithy, 15, -1, SCALE.smithy, true), at(anvil, 0, -9, SCALE.anvil)]
    : [...HEAPS.map(([x, z], i) => at(heap, m * x, z, SCALE.heaps[i] ?? 1)), at(mast, m * 2, -7, SCALE.crane)];
  for (const [x, z, hx, hz, h] of boxes) w.box('far', [x - hx, 0, z - hz], [x + hx, h, z + hz], p.basalt ?? p.stone);
}

/** A lane seam (in place of Night Market's string lights and banner posts): basalt bollards, each capped with a cold blue
 *  lamp-block (no light pool: R1, they crowded the aerials), 3 m either side of the seam at its crossings and twice
 *  between, as the round-62 paths are lined; the four road entries and the furnace's forecourt stay clear. */
function emberLane(w, p, side, centre) {
  const along = (u, off) => (side === 0 ? [u, HALF + off] : [HALF + off, -u]);
  if ((side === 0 ? centre[1] : centre[0]) + HALF === 0) { avenue(w, p, side, centre, along); return; }
  const clear = (x, z) => { const wx = centre[0] + x, wz = centre[1] + z, margin = 1.5;
    return (Math.abs(wx) < 4 + margin && Math.abs(wz) > 235 - margin) || (Math.abs(wz) < 4 + margin && Math.abs(wx) > 235 - margin) || Math.hypot(wx, wz) < 30; };
  for (const off of [-3, 3]) for (const u of [-HALF + 4, -HALF * 0.35, HALF * 0.35, HALF - 4]) {
    const [x, z] = along(u, off);
    if (clear(x, z)) continue;
    w.box('Kit', [x - 0.3, 0, z - 0.3], [x + 0.3, 1.0, z + 0.3], p.basalt ?? p.stone, p.basaltTop ?? p.stoneTop);
    w.box('Glow', [x - 0.22, 1.0, z - 0.22], [x + 0.22, 1.36, z + 0.22], p.lantern, p.lantern);
    w.solid([x - 0.3, 0, z - 0.3], [x + 0.3, 1.36, z + 0.3]);
  }
}

/** where an avenue's dressing stops (plot metres along it): the furnace's forecourt, the moat's bridges, and the entry's 15 m
 *  footprint (contentBounds ENTRY_ASPHALT), which must stay clear of props and colliders */
const AVENUE = { plaza: 40, moat: [126, 186], trough: [190, 233], road: 199 };

/** One of the four avenues from a road entry to the furnace (the seams on x = 0 and z = 0), lined as round 62's entry
 *  path is: a basalt plinth with a cold blue lamp-block either side every 15.6 m, from the road to the furnace's
 *  forecourt (none on the moat's bridges), and through the entry's forge courts a raised trough of lava along each
 *  edge, its basalt kerb waist-high so nobody walks in, lighting the path orange. `along(u, off)` is the seam's tile-local point. */
function avenue(w, p, side, centre, along) {
  const reach = u => Math.abs(side === 0 ? centre[0] + u : centre[1] - u);
  for (let u = -HALF + 7.8; u < HALF; u += 15.6) {
    const r = reach(u);
    if (r < AVENUE.plaza || r > AVENUE.road || (r > AVENUE.moat[0] && r < AVENUE.moat[1])) continue;
    for (const off of [-3.4, 3.4]) {
      const [x, z] = along(u, off);
      w.box('Kit', [x - 0.6, 0, z - 0.6], [x + 0.6, 1.1, z + 0.6], p.basalt ?? p.stone, p.basaltTop ?? p.stoneTop);
      w.box('Glow', [x - 0.4, 1.1, z - 0.4], [x + 0.4, 1.75, z + 0.4], p.lantern, p.lantern);
      w.box('Kit', [x - 0.5, 1.75, z - 0.5], [x + 0.5, 1.9, z + 0.5], p.basalt ?? p.stone, p.basaltTop ?? p.stoneTop);
      w.solid([x - 0.6, 0, z - 0.6], [x + 0.6, 1.9, z + 0.6]);
    }
  }
  // the lava troughs: the stretch of this seam inside the entry's forge courts, 4.2 to 6.6 m off the seam's line (reach is
  // linear in u along one seam this far out, so the stretch is the u range whose reach lies in the trough's)
  const [lo, hi] = AVENUE.trough, ra = reach(-HALF), rb = reach(HALF);
  if (Math.max(ra, rb) < lo || Math.min(ra, rb) > hi) return;
  const at = r => Math.min(HALF, Math.max(-HALF, -HALF + (r - ra) / (rb - ra) * 2 * HALF));
  const u0 = Math.min(at(lo), at(hi)), u1 = Math.max(at(lo), at(hi));
  if (u1 - u0 < 4) return;
  for (const sign of [-1, 1]) {
    const [x0, z0] = along(u0, sign * 4.2), [x1, z1] = along(u1, sign * 6.6);
    const min = [Math.min(x0, x1), Math.min(z0, z1)], max = [Math.max(x0, x1), Math.max(z0, z1)], t = 0.35, h = 0.95;
    for (const [ax, az, bx, bz] of [[min[0], min[1], max[0], min[1] + t], [min[0], max[1] - t, max[0], max[1]],
      [min[0], min[1], min[0] + t, max[1]], [max[0] - t, min[1], max[0], max[1]]]) {
      w.box('Kit', [ax, 0, az], [bx, h, bz], p.basalt ?? p.stone, p.basaltTop ?? p.stoneTop);
    }
    w.floor('Water', min[0] + t, min[1] + t, max[0] - t, max[1] - t, h - 0.1, p.water);
    w.solid([min[0], 0, min[1]], [max[0], h, max[1]]);
    // its molten light on the path and the court beside it, and embers drifting off it
    for (let u = u0 + 4; u < u1 - 2; u += 8) {
      const [x, z] = along(u, sign * 5.4);
      pool(w, x, z, 4.5, p.gatePool, 0.06);
      spark(w, x + 0.4, h + 0.6 + pick(x, z, 3) * 0.5, z - 0.3, 0.12, true);
    }
  }
}

const THEME = {
  F: { build: forgeCourt, far: (w, p, variant) => farEmber(w, p, 'F', variant), sockets: 'pppp' },
  O: { build: oreYard, far: (w, p, variant) => farEmber(w, p, 'O', variant), sockets: 'pppp' },
};

/** Ember Forge's builders: a layout's shared letters (Night Market's kinds, `layout.builders`) plus F and O, and its
 *  basalt-and-blue-lamp lane seams. */
export function emberForgeBuilders(letters) {
  const shared = nightMarketBuilders(letters);
  for (const letter of Object.keys(THEME)) if (Object.hasOwn(shared.tiles, letter)) throw new Error(`ember-forge: letter ${letter} is a theme tile`);
  return { tiles: { ...shared.tiles, ...THEME }, coarseFamilies: new Set([...shared.coarseFamilies, 'forges', 'ore']), seam: emberLane };
}

/** Hooks at the generic construction points (tiledPlotCore.mjs): the furnace's lit door and stacks are its own warm
 *  texels (the landmark graph lights them); molten light pools ring its foot and the lava's light the plaza. */
export const emberForgePlot = {
  builders: layout => emberForgeBuilders(layout.builders),
  lanternBake: { gain: 0.8, radius: 1.5, cut: 3 },
  ringInKit: true,
  // the furnace needs no plot-drawn windows: its lit door, slits and stack mouths are warm texels the landmark graph lights.
  // OB4 (bar 7): smoke and sparks off its stack mouths (the layout's `landmark.stacks`, plot metres, read off the model).
  // The smoke draws near only (the Pool draw); the sparks are Glow, which the coarse tiles keep, so they are the furnace's
  // motion seen from the road entry: 0.5 m embers glowing and drifting up a 6 m column over each mouth
  models(parts, _kit, layout) {
    const writer = { tri: (part, a, b, c, colour) => parts[part].tri(part, a, b, c, colour) };
    for (const [x, y, z] of layout.landmark.stacks ?? []) {
      smoke(writer, x, y + 1.2, z, 1.1);
      for (let i = 0; i < 8; i++) spark(writer, x + Math.sin(i * 2.4) * 0.9, y + 1 + i * 0.75, z + Math.cos(i * 2.4) * 0.9, 0.5, true);
    }
  },
  pools(parts, palette) {
    const lit = { Pool: parts.Pool }, plotWriter = { triColours: (part, a, b, c, colours) => lit[part].triColours(part, [a, b, c], colours) };
    pool(plotWriter, 0, -15, 10, palette.gatePool, 0.07);
    for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * Math.PI * 2; pool(plotWriter, 22 * Math.sin(a), 22 * Math.cos(a), 5, palette.pool, 0.08); }
  },
};
