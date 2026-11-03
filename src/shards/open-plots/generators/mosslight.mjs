// OB6 (open-plots build-out, G978): Mosslight Ruins' tile vocabulary. The shared letters are Night Market's builders
// (forecourts, plaza, gardens, canals, retinted by the layout's palette: grey-green paving, emerald canal water); two theme
// tiles are Mosslight's own, both mossy courts whose paved border meets any neighbour ('pppp'):
//   R ruins: a ruin court of the shared ruin-stone pieces (an arch, an L of wall, rubble, column stumps, a stepped
//            terrace) on moss among trees, green lamp posts at its mouth, motes drifting over it;
//   E pool:  a sunken emerald pool in a ruined stone coping, steps down into it, column stumps on its north bank,
//            glowing motes over the water and a green lamp post on each corner.
// Their models are the shared `ruins` and `rubble` kit families (scripts/blender/open-plots/ruins.py; Desert Ruin reuses
// them), placed only when the layout's kit has them, like every kit family.
import { HALF, INNER, pool } from './kit.mjs';
import { nightMarketBuilders } from './nightMarket.mjs';

/** sRGB hex to linear RGB (the layout's palette rows) */
const linear = (hex) => [1, 3, 5].map(at => { const c = Number.parseInt(hex.slice(at, at + 2), 16) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
/** the pool's water below the coping */
const DEPTH = 0.6;
/** E's pool (x0, z0, x1, z1): the tile's middle inside its coping and paved border */
const POOL = [-17, -17, 17, 17];
/** each ruin piece's kit family and variant (ruins.py: three variants a family) */
const RUIN_MODELS = [['ruins', 0], ['ruins', 1], ['rubble', 0], ['rubble', 1], ['ruins', 2]];
/** each ruin piece's collision boxes at yaw 0 (tile-local metres; ruins.py: a piece's front is +z) */
const RUIN_SOLIDS = [
  [[-4.7, 0, -0.9, -3.1, 7.4, 0.9], [3.1, 0, -0.9, 4.7, 7.4, 0.9]], // arch: its two piers (walk under it)
  [[-5, 0, -0.5, 5, 6, 0.5], [-5, 0, -7, -4, 6, -0.5]], // wall: the L
  [[-2.2, 0, -2.2, 2.2, 1.6, 2.2]], // rubble
  [[-6, 0, -1.6, 6, 0.8, 1.6], [-4.4, 0, -0.8, -2.8, 6.1, 0.8], [-0.8, 0, -0.8, 0.8, 4, 0.8], [2.8, 0, -0.8, 4.4, 2.8, 0.8]], // columns
  [[-4.5, 0, -2.1, 4.5, 0.6, 2.1], [-4.5, 0, -2.1, 4.5, 1.2, 0.7], [-4.5, 0, -2.1, 4.5, 1.8, -0.7], [-4.5, 0, -2.1, 4.5, 3, -1.5]], // terrace
];

/** A stable variant (0 to count - 1) for a piece at tile-local (x, z), so neighbours differ and every bake repeats. */
const pick = (x, z, count, salt = 0) => (((Math.round(x * 4) * 7 + Math.round(z * 4) * 13 + salt) % count) + count) % count;

/** NM10's moving-light marking (nightMarket.mjs): a mote is a 12 cm tetrahedron in Glow whose colour has red alone, red
 *  in [0, 0.5) its seed; the glow graph wanders and blinks it (the layout's moving-light colour makes it emerald). */
let seeds = 0;
function mote(w, x, y, z) {
  seeds++;
  const c = [((seeds * 0.6180339887) % 1) * 0.5, 0, 0], s = 0.12;
  const top = [x, y + s * 1.4, z], a = [x - s, y - s, z - s], b = [x + s, y - s, z - s], d = [x, y - s, z + s * 1.4];
  w.tri('Glow', top, b, a, c); w.tri('Glow', top, d, b, c); w.tri('Glow', top, a, d, c); w.tri('Glow', a, b, d, c);
}

/** A ruin piece at tile-local (x, z), turned `turns` quarter turns (its front from +z toward +x), and its colliders. */
function ruin(w, piece, x, z, turns) {
  const yaw = turns * Math.PI / 2, c = Math.round(Math.cos(yaw)), s = Math.round(Math.sin(yaw));
  const [family, variant] = RUIN_MODELS[piece] ?? ['ruins', 0];
  if (w.hasModel(family)) w.placeModel(family, variant, x, z, { yaw });
  for (const [x0, y0, z0, x1, y1, z1] of RUIN_SOLIDS[piece] ?? []) {
    const ax = x0 * c + z0 * s, az = -x0 * s + z0 * c, bx = x1 * c + z1 * s, bz = -x1 * s + z1 * c;
    w.solid([x + Math.min(ax, bx), y0, z + Math.min(az, bz)], [x + Math.max(ax, bx), y1, z + Math.max(az, bz)]);
  }
}

/** A broadleaf tree from the kit (round, tall or willow), else a faceted stand-in, and its trunk's collider. */
function tree(w, p, x, z, size, spin) {
  if (w.hasModel('trees')) w.placeModel('trees', pick(x, z, 3), x, z, { yaw: spin, scale: size * 1.1 / 8 });
  else {
    w.sides('Kit', [x - 0.25, 0, z - 0.25], [x + 0.25, size * 0.45, z + 0.25], p.trunk);
    w.box('Kit', [x - size * 0.4, size * 0.45, z - size * 0.4], [x + size * 0.4, size, z + size * 0.4], p.foliage, p.foliage);
  }
  w.solid([x - 0.3, 0, z - 0.3], [x + 0.3, 3, z + 0.3]);
}

/** A green lamp post (the kit's stone post lantern, retinted by the layout's lantern colour) and its pool of light. */
function lamp(w, p, x, z, yaw) {
  if (w.hasModel('lanterns')) w.placeModel('lanterns', 0, x, z, { height: 3.0, yaw });
  else {
    w.lanternEmitter?.([x, 3.4, z], [...p.lantern]);
    w.sides('Kit', [x - 0.12, 0, z - 0.12], [x + 0.12, 3.0, z + 0.12], p.stone);
    w.box('Glow', [x - 0.25, 3.0, z - 0.25], [x + 0.25, 3.7, z + 0.25], p.lantern, p.lantern);
  }
  w.solid([x - 0.15, 0, z - 0.15], [x + 0.15, 3.0, z + 0.15]);
  pool(w, x, z, 3, p.pool);
}

/** Moss over the court: one up-facing rectangle a little proud of the paving. */
function moss(w, p, x0, z0, x1, z1) {
  w.floor('Kit', x0, z0, x1, z1, 0.05, p.lawn);
}

/** R ruins: a dense ruin court on moss, after round 62's top-down. An arch across its back (north) and a second across
 *  its middle, the wall's L in both back corners, a terrace and column stumps down the sides, rubble heaps between them,
 *  trees in the gaps, motes over the court, two lamp posts at its mouth (south). `variant` mirrors it east-west. */
function ruinCourt(w, p, variant) {
  const m = variant === 0 ? 1 : -1;
  moss(w, p, -INNER, -INNER + 6, INNER, INNER);
  ruin(w, 0, 0, 21, 0);
  ruin(w, 0, m * 6, 0, 1);
  ruin(w, 1, m * -18, 18, variant === 0 ? 0 : 1);
  ruin(w, 1, m * 18, 18, variant === 0 ? 1 : 0);
  ruin(w, 4, m * -19, -6, 1);
  ruin(w, 3, m * 19, -4, 3);
  ruin(w, 3, m * -6, -14, 0);
  for (const [x, z] of [[-10, 8], [12, 10], [-18, -18], [18, -18]]) ruin(w, 2, m * x, z, 0);
  for (const [x, z, size] of [[-23, -22, 10], [23, -21, 9], [-8, 14, 8], [9, -8, 11], [24, 6, 8], [-24, 6, 9], [-2, -22, 7]]) tree(w, p, m * x, z, size, pick(x, z, 4) * 0.8);
  for (const [x, z] of [[-6, 4], [6, -4], [0, 14], [-14, -8], [14, -10], [-3, -6]]) mote(w, m * x, 1.0 + pick(x, z, 3) * 0.6, z);
  for (const x of [-5, 5]) lamp(w, p, x, -INNER + 3, 0);
}

/** E pool: a sunken emerald pool in a ruined coping, steps down on its south side, column stumps on its north bank,
 *  rubble at one corner, motes over the water, a green lamp post on each corner. `variant` swaps the rubble's corner. */
function emeraldPool(w, p, variant) {
  const [x0, z0, x1, z1] = POOL;
  moss(w, p, -INNER, -INNER, INNER, z0 - 2.5); moss(w, p, -INNER, z1 + 2.5, INNER, INNER);
  w.floor('Water', x0, z0, x1, z1, -DEPTH, p.water);
  for (const [xa, za, xb, zb] of [[x0, z1, x0, z0], [x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1]]) {
    w.quad('Kit', [xa, -DEPTH, za], [xb, -DEPTH, zb], [xb, 0, zb], [xa, 0, za], p.stone);
  }
  w.solid([x0, -DEPTH - 0.3, z0], [x1, -DEPTH, z1]);
  // the coping: a low broken kerb of blocks round the rim, a gap on the south for the steps
  for (let i = 0; i < 12; i++) {
    const t = x0 + (x1 - x0) * (i + 0.5) / 12, h = 0.5 + 0.25 * pick(t, i, 3);
    for (const [a, b] of [[[t - 1.2, z1], [t + 1.2, z1 + 1.2]], [[x0 - 1.2, t - 1.2], [x0, t + 1.2]], [[x1, t - 1.2], [x1 + 1.2, t + 1.2]]]) {
      w.box('Kit', [a[0], 0, a[1]], [b[0], h, b[1]], p.stone, p.stoneTop);
    }
    if (Math.abs(t) > 4) w.box('Kit', [t - 1.2, 0, z0 - 1.2], [t + 1.2, h, z0], p.stone, p.stoneTop);
  }
  for (const [a, b] of [[[x0 - 1.2, z0 - 1.2], [x1 + 1.2, z0]], [[x0 - 1.2, z1], [x1 + 1.2, z1 + 1.2]]]) w.solid([a[0], 0, a[1]], [b[0], 0.6, b[1]]);
  for (const [a, b] of [[[x0 - 1.2, z0], [x0, z1]], [[x1, z0], [x1 + 1.2, z1]]]) w.solid([a[0], 0, a[1]], [b[0], 0.6, b[1]]);
  for (let k = 0; k < 3; k++) w.box('Kit', [-3.6, -DEPTH, z0 + k * 0.9], [3.6, -k * 0.2 - 0.05, z0 + (k + 1) * 0.9], p.stone, p.stoneTop);
  ruin(w, 3, 0, z1 + 6, 2);
  ruin(w, 2, variant === 0 ? 20 : -20, -20, 0);
  for (const [x, z, size] of [[-22, 22, 10], [22, 21, 9]]) tree(w, p, x, z, size, pick(x, z, 4) * 0.8);
  // the pool's own glow on the water and on the coping, and motes over it
  pool(w, 0, 0, 20, p.poolGlow ?? p.pool, -DEPTH + 0.06);
  for (const [x, z] of [[-9, -6], [7, -10], [-4, 9], [11, 6], [0, -1], [-12, 11], [13, -13]]) mote(w, x, 0.6 + pick(x, z, 3) * 0.5, z);
  for (const s of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) lamp(w, p, s[0] * 23.5, s[1] * 23.5, Math.atan2(-s[0], -s[1]));
}

/** The far stand-ins (RM11): the mossy ground, the pool's water, the ruins as stone boxes, the trees as green mounds. */
function farMoss(w, p, type, variant) {
  w.floor('far', -HALF, -HALF, HALF, HALF, 0, p.lawn ?? p.paving);
  if (type === 'E') {
    const [x0, z0, x1, z1] = POOL;
    w.floor('far', x0, z0, x1, z1, 0.04, p.water);
    w.box('far', [-6, 0, z1 + 4.4], [6, 3, z1 + 7.6], p.stone);
    return;
  }
  const m = variant === 0 ? 1 : -1;
  for (const [x, z, hx, hz, h] of [[0, 20, 4.8, 1, 9], [-17, 17, 5, 1, 6], [18, 19, 4.5, 2, 3], [-19, -2, 1.6, 6, 4], [18, 0, 2, 2, 1.6]]) {
    w.box('far', [m * x - hx, 0, z - hz], [m * x + hx, h, z + hz], p.stone);
  }
  for (const [x, z, size] of [[-22, -16, 10], [22, -14, 9], [10, 10, 11]]) w.box('far', [m * x - size * 0.4, 1, z - size * 0.4], [m * x + size * 0.4, size, z + size * 0.4], p.foliage);
}

/** The plaza's ruin dressing (r1 look loop: the shared plaza read as bare grey paving round the tower): a rubble heap
 *  mid-quarter and column stumps toward its outer edges, clear of the gate (its corner is (HALF, -HALF)), the rings (36 m,
 *  52 m), the lane beds and the planter. The moss in its joints is `jointMoss`. */
function mossPlaza(w) {
  ruin(w, 2, 0, 0, 0);
  ruin(w, 3, 0, 22.4, 0);
  ruin(w, 3, -22.4, 0, 1);
  for (const [x, z] of [[-6, 10], [8, -6], [-18, -18]]) mote(w, x, 1.1 + pick(x, z, 3) * 0.5, z);
}

/** The gardens' ruin dressing: a rubble heap in two lawn corners, clear of its trees and its pond. */
function mossGarden(w) {
  ruin(w, 2, -22, 22, 0);
  ruin(w, 2, 23, -23, 0);
}

/** A lane seam (in place of Night Market's string lights and banner posts): a ruined stone stump at each crossing corner
 *  (3 m either side of the seam), moss at its foot, and motes low along the lane; the four road entries stay clear. */
function mossLane(w, p, side, centre) {
  const along = (u, off, y) => (side === 0 ? [u, y, HALF + off] : [HALF + off, y, -u]);
  const clear = (x, z) => { const wx = centre[0] + x, wz = centre[1] + z, margin = 1.5;
    return (Math.abs(wx) < 4 + margin && Math.abs(wz) > 235 - margin) || (Math.abs(wz) < 4 + margin && Math.abs(wx) > 235 - margin) || Math.hypot(wx, wz) < 30; };
  for (const off of [-3, 3]) for (const u of [-HALF + 4, HALF - 4]) {
    const [x, , z] = along(u, off, 0);
    if (clear(x, z)) continue;
    const h = 1.2 + 0.5 * pick(x, z, 3);
    w.box('Kit', [x - 0.35, 0, z - 0.35], [x + 0.35, h, z + 0.35], p.stone, p.moss ?? p.lawn);
    w.solid([x - 0.35, 0, z - 0.35], [x + 0.35, h, z + 0.35]);
  }
  for (const [u, off, y] of [[-HALF * 0.6, -2.6, 1.2], [HALF * 0.2, 2.6, 1.6], [HALF * 0.7, -2.6, 1.0]]) {
    const [x, , z] = along(u, off, y);
    if (!clear(x, z)) mote(w, x, y, z);
  }
}

/** the shared kinds Mosslight dresses, and Night Market's own letters for them when a layout names none */
const DRESS = { plaza: mossPlaza, garden: mossGarden };
const SHARED_LETTERS = { G: 'garden', P: 'plaza' };

const THEME = {
  R: { build: ruinCourt, far: (w, p, variant) => farMoss(w, p, 'R', variant), sockets: 'pppp' },
  E: { build: emeraldPool, far: (w, p, variant) => farMoss(w, p, 'E', variant), sockets: 'pppp', water: [POOL] },
};

/** Mosslight's builders: a layout's shared letters (Night Market's kinds, `layout.builders`, their plazas and gardens
 *  dressed with ruins and moss) plus R and E, and its mossy lane seams. */
export function mosslightBuilders(letters) {
  const shared = nightMarketBuilders(letters);
  for (const letter of Object.keys(THEME)) if (Object.hasOwn(shared.tiles, letter)) throw new Error(`mosslight-ruins: letter ${letter} is a theme tile`);
  const tiles = { ...shared.tiles, ...THEME };
  for (const [letter, kind] of Object.entries(letters ?? SHARED_LETTERS)) {
    const dress = DRESS[kind], base = tiles[letter];
    if (dress !== undefined && base !== undefined) tiles[letter] = { ...base, build: (w, p, variant) => { base.build(w, p, variant); dress(w, p, variant); } };
  }
  return { tiles, coarseFamilies: new Set([...shared.coarseFamilies, 'ruins', 'rubble']), seam: mossLane };
}

/** The tower's lit windows as emerald Glow: its slit rows (layout.landmark.windows: [x, y, z, nx, nz, width, height] in
 *  plot metres for a 35 m tower at turn 0, tower.py's build/hooks.json) as panes, its lit window faces (landmark.glow:
 *  nine-number triangles, from an image-to-3D take's window texels) as triangles a little proud of the wall, stood as tiledPlotCore stands the landmark: scaled
 *  to its height, turned its quarter turns clockwise. The landmark graph lights only warm texels, so the panes glow here. */
export function towerWindows(glow, landmark, colour) {
  const k = (landmark.height ?? 35) / 35, turns = landmark.turn ?? 0;
  const spin = ([x, y, z]) => { let a = x, b = z; for (let i = 0; i < turns; i++) [a, b] = [b, -a]; return [a, y, b]; };
  // an image-to-3D tower's lit window faces (layout.landmark.glow: plot-metre triangles for a 35 m tower), proud of the wall
  for (const row of landmark.glow ?? []) {
    const at = (i) => spin([(row[i] ?? 0) * k, (row[i + 1] ?? 0) * k, (row[i + 2] ?? 0) * k]);
    const a = at(0), b = at(3), c = at(6), n = [(b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]),
      (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])], l = Math.hypot(...n) || 1, lift = (q) => q.map((v, i) => v + (n[i] ?? 0) / l * 0.03);
    glow.tri('Glow', lift(a), lift(b), lift(c), colour);
  }
  for (const [x, y, z, nx, nz, width, height] of landmark.windows ?? []) {
    const tx = -nz, tz = nx, hw = width * k / 2, hh = height * k / 2, at = [x * k + nx * 0.04, y * k, z * k + nz * 0.04];
    const corner = (u, v) => spin([at[0] + tx * u, at[1] + v, at[2] + tz * u]);
    // wound to face out along (nx, nz): (u, v) runs right then up as seen from outside
    glow.quad('Glow', corner(hw, -hh), corner(-hw, -hh), corner(-hw, hh), corner(hw, hh), colour);
  }
}

/** The flagstones' running bond (data/trim.json `flagstone`, the kit material's world-metre rule): rows across z, every
 *  other row shifted half a flag along x */
const FLAG = 3.2, ROW = 2.4;

/** Moss in the plaza's joints (r2 look loop: the targets' strongest first-person cue): a broken strip 8 to 14 cm wide
 *  along part of about a third of the flagstones' joints within `reach` m of the tower, none on its outcrop, a little proud of the
 *  paving but under the rule's 4.5 cm so the kit material still shades it as stone, its green varying stone to stone. */
export function jointMoss(kit, green, lawn, reach = 62, outcrop = 17) {
  const shade = (i, k, salt) => { const h = Math.sin(i * 12.9898 + k * 78.233 + salt) * 43758.5453; return h - Math.floor(h); };
  const y = 0.04, keep = (x, z) => Math.abs(x) < reach && Math.abs(z) < reach && Math.hypot(x, z) > outcrop;
  for (let k = Math.ceil(-reach / ROW); k * ROW < reach; k++) {
    const z0 = k * ROW, shift = (((k % 2) + 2) % 2) * 0.5;
    for (let i = Math.ceil(-reach / FLAG) - 1; (i - shift) * FLAG < reach; i++) {
      const x0 = (i - shift) * FLAG, half = 0.04 + 0.03 * shade(i, k, 3), t = shade(i, k, 7);
      const colour = green.map((m, c) => (m + ((lawn[c] ?? m) - m) * t) * 1.35);
      // a broken run of moss along part of a joint: from `a` to `b` of its length, a third to four fifths of it
      const run = (salt, length) => { const a = shade(i, k, salt) * 0.4 * length; return [a, Math.min(length, a + (0.35 + 0.45 * shade(i, k, salt + 1)) * length)]; };
      // the row's joint under this flag, then its joint at the flag's west end
      if (shade(i, k, 1) < 0.34 && keep(x0 + FLAG / 2, z0)) {
        const [a, b] = run(11, FLAG);
        kit.quad('Kit', [x0 + a, y, z0 - half], [x0 + a, y, z0 + half], [x0 + b, y, z0 + half], [x0 + b, y, z0 - half], colour);
      }
      if (shade(i, k, 2) < 0.34 && keep(x0, z0 + ROW / 2)) {
        const [a, b] = run(13, ROW);
        kit.quad('Kit', [x0 - half, y, z0 + a], [x0 - half, y, z0 + b], [x0 + half, y, z0 + b], [x0 + half, y, z0 + a], colour);
      }
    }
  }
}

/** Hooks at the generic construction points (tiledPlotCore.mjs): the tower's slits glow emerald, moss grows in the
 *  plaza's joints, and emerald light pools ring the outcrop's foot and the stairs' head. */
export const mosslightPlot = {
  builders: layout => mosslightBuilders(layout.builders),
  lanternBake: { gain: 0.8, radius: 1.5, cut: 3 },
  models(parts, _kit, layout) {
    towerWindows(parts.Glow, layout.landmark, linear(layout.palette.windowGlow ?? layout.palette.lantern));
    jointMoss(parts.Kit, linear(layout.palette.moss ?? layout.palette.lawn), linear(layout.palette.lawn));
  },
  pools(parts, palette) {
    const lit = { Pool: parts.Pool }, plotWriter = { triColours: (part, a, b, c, colours) => lit[part].triColours(part, [a, b, c], colours) };
    pool(plotWriter, 0, 0, 24, palette.gatePool, 0.07);
    for (let i = 0; i < 6; i++) { const a = (i + 0.5) / 6 * Math.PI * 2; pool(plotWriter, 19 * Math.sin(a), 19 * Math.cos(a), 6, palette.gatePool, 0.08); }
  },
};
