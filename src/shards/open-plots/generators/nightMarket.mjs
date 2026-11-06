// Night Market's tile vocabulary, geometry, seams and lighting policy.
import { HALF, INNER, placePlotModels, pool } from './kit.mjs';

/** the canal's water half-width, its stone rim and how far the water sits below the paving */
// NM8: wide water as in the mockup (20 m), high arched bridges over it
const CANAL = { half: 10, rim: 0.8, rimHeight: 0.6, depth: 0.45 };
const BRIDGE = { rise: 2, half: 11.5, deck: 0.3, steps: 16 };

/** A stable variant (0 to count - 1) for a piece at tile-local (x, z), so neighbours differ and every bake repeats. */
const pick = (x, z, count, salt = 0) => (((Math.round(x * 4) * 7 + Math.round(z * 4) * 13 + salt) % count) + count) % count;

/** An n-sided frustum about (x, z) from radius r0 at y0 to r1 at y1 (r1 0: a cone), capped. */
function frustum(w, part, x, z, sides, r0, r1, y0, y1, colour, spin = 0) {
  const ring = (r, y, i) => { const a = spin + i / sides * Math.PI * 2; return [x + r * Math.sin(a), y, z + r * Math.cos(a)]; };
  // a cone pointing down (y1 below y0) winds the other way to face out
  const t = y1 < y0 ? (a, b, c) => w.tri(part, a, c, b, colour) : (a, b, c) => w.tri(part, a, b, c, colour);
  for (let i = 0; i < sides; i++) {
    const a0 = ring(r0, y0, i), a1 = ring(r0, y0, i + 1), b0 = ring(r1, y1, i), b1 = ring(r1, y1, i + 1);
    t(a0, a1, b1); if (r1 > 0) { t(a0, b1, b0); t([x, y1, z], b0, b1); }
  }
}
/** A hip roof over [x0, x1] x [z0, z1] from eave height h, rising `rise`, its ridge along the longer side, in `part`;
 *  closed below in `under` (null: open, for a far stand-in only ever seen from above). */
function hipRoof(w, x0, x1, z0, z1, h, rise, colour, under, part = 'Kit') {
  const width = x1 - x0, depth = z1 - z0, top = h + rise;
  if (width >= depth) {
    const zc = (z0 + z1) / 2, r0 = x0 + depth / 2, r1 = x1 - depth / 2;
    w.quad(part, [x0, h, z0], [r0, top, zc], [r1, top, zc], [x1, h, z0], colour);
    w.quad(part, [x1, h, z1], [r1, top, zc], [r0, top, zc], [x0, h, z1], colour);
    w.tri(part, [x0, h, z1], [r0, top, zc], [x0, h, z0], colour);
    w.tri(part, [x1, h, z0], [r1, top, zc], [x1, h, z1], colour);
  } else {
    const xc = (x0 + x1) / 2, r0 = z0 + width / 2, r1 = z1 - width / 2;
    w.quad(part, [x0, h, z1], [xc, top, r1], [xc, top, r0], [x0, h, z0], colour);
    w.quad(part, [x1, h, z0], [xc, top, r0], [xc, top, r1], [x1, h, z1], colour);
    w.tri(part, [x0, h, z0], [xc, top, r0], [x1, h, z0], colour);
    w.tri(part, [x1, h, z1], [xc, top, r1], [x0, h, z1], colour);
  }
  if (under !== null) w.quad(part, [x0, h, z0], [x1, h, z0], [x1, h, z1], [x0, h, z1], under);
}
/** A flat Pool triangle facing up (the additive Pool draws its front faces), its corners re-ordered when they wind down. */
function upward(w, a, b, c, colours) {
  const winding = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
  if (winding >= 0) w.triColours('Pool', a, b, c, colours); else w.triColours('Pool', a, c, b, [colours[0], colours[2], colours[1]]);
}
/** NM10: the moving lights draw in the Glow part, marked by a vertex colour with no green or blue (no lantern, window,
 *  awning or bulb colour has that) and seeded by its red: a firefly in [0, 0.5), a sky lantern in [0.5, 1). The glow
 *  graph moves and lights them; the same seeds every bake. */
let seeds = 0;
const nextSeed = () => { seeds++; return (seeds * 0.6180339887) % 1; };
/** A small tetrahedron of the Glow part about (x, y, z), `size` its half-width, `seed` its marked colour's red. */
function mover(w, x, y, z, size, seed) {
  const c = [seed, 0, 0], top = [x, y + size * 1.4, z], a = [x - size, y - size, z - size], b = [x + size, y - size, z - size], d = [x, y - size, z + size * 1.4];
  w.tri('Glow', top, b, a, c); w.tri('Glow', top, d, b, c); w.tri('Glow', top, a, d, c); w.tri('Glow', a, b, d, c);
}
/** A firefly: a 12 cm mover the glow graph wanders (+-0.8 m) and blinks green (RM10.3: 7 cm did not read past a few
 *  metres). */
function firefly(w, x, y, z) { placeMovingLight(w, 'firefly', [x, y, z]); }
/** RM10.2: steam over a food cart at (x, y, z): three small octahedra in the additive Pool draw, marked by a vertex
 *  colour with blue and no red (no pool light has that) and seeded by green, so the pool graph lifts each 2.4 m on its own
 *  ~3 s loop, drifting and fading in and out (24 triangles). */
function steam(w, x, y, z) {
  for (let k = 0; k < 3; k++) {
    const c = [0, nextSeed(), 1], r = 0.28, at = [x + (k - 1) * 0.15, y, z];
    const tip = [[0, r, 0], [0, -r, 0]], ring = [[r, 0, 0], [0, 0, r], [-r, 0, 0], [0, 0, -r]];
    const v = d => [at[0] + d[0], at[1] + d[1], at[2] + d[2]];
    for (let i = 0; i < 4; i++) {
      const a = ring[i], b = ring[(i + 1) % 4];
      w.tri('Pool', v(tip[0]), v(b), v(a), c); w.tri('Pool', v(tip[1]), v(a), v(b), c);
    }
  }
}
/** One moving light: consumes the next seed and writes its marked shape (a firefly's tetrahedron). */
function placeMovingLight(w, kind, position) {
  if (kind !== 'firefly' || !Array.isArray(position) || position.length !== 3
    || position.some(value => !Number.isFinite(value))) throw new Error('open-plots: invalid moving light');
  mover(w, position[0], position[1], position[2], 0.12, nextSeed() * 0.5);
}
/** A lantern on a post of `height` and its pool of light. With the kit's models (RM4, opt-in: the layout's kit) it is
 *  the stone post, paper-lantern bracket or banner post by place, its model emitting the bake's light; without them,
 *  the low-poly post and lit box that fit the pinned tile bytes until RM8.1 pays for the models. */
function lantern(w, x, z, p, height = 2.8) {
  if (w.hasModel('lanterns')) {
    w.placeModel('lanterns', pick(x, z, 3), x, z, { height, yaw: pick(x, z, 4, 1) * Math.PI / 2 });
  } else {
    w.lanternEmitter?.([x, height + 0.375, z], [...p.lantern]);
    w.sides('Kit', [x - 0.09, 0, z - 0.09], [x + 0.09, height, z + 0.09], p.wood);
    w.box('Glow', [x - 0.3, height, z - 0.3], [x + 0.3, height + 0.75, z + 0.3], p.lantern, p.lantern);
  }
  w.solid([x - 0.09, 0, z - 0.09], [x + 0.09, height, z + 0.09]);
  pool(w, x, z, 4.5, p.pool);
}
/** A low-poly tree: trunk and a faceted crown (two hexagonal cones back to back). */
function tree(w, x, z, size, p, spin) {
  // RM4.7 (opt-in, the layout's kit): a generated round, tall or willow tree, 8 m as built, scaled to this
  // tree's crown top
  if (w.hasModel('trees')) {
    w.placeModel('trees', pick(x, z, 3), x, z, { yaw: spin, scale: size * 1.1 / 8 });
    w.solid([x - 0.3, 0, z - 0.3], [x + 0.3, 3, z + 0.3]);
    return;
  }
  // OB3 (G978, shared kit rule): a snowbound plot's kit has pines and no broadleaf trees, so its bank trees are pine clumps
  if (w.hasModel('pines')) {
    w.placeModel('pines', pick(x, z, 3), x, z, { yaw: spin });
    w.solid([x - 1, 0, z - 1], [x + 1, 4, z + 1]);
    return;
  }
  // OB5 (G978, shared kit rule): a lagoon plot's kit has palms and no broadleaf trees, so its bank trees are its young
  // palms (the lightest variant: a forecourt plants dozens, and the entry tiles hold to their byte cap)
  if (w.hasModel('palms')) {
    w.placeModel('palms', 2, x, z, { yaw: spin, scale: Math.max(1, size * 1.1 / 4) });
    w.solid([x - 0.35, 0, z - 0.35], [x + 0.35, 6, z + 0.35]);
    return;
  }
  // OB4 (G978, shared kit rule): a forge plot's kit has ore and no trees, so its bank trees are coal heaps
  if (w.hasModel('ore')) {
    w.placeModel('ore', 0, x, z, { yaw: spin, scale: 0.6 });
    w.solid([x - 2.2, 0, z - 2.2], [x + 2.2, 1.4, z + 2.2]);
    return;
  }
  w.sides('Kit', [x - 0.25, 0, z - 0.25], [x + 0.25, size * 0.45, z + 0.25], p.trunk);
  frustum(w, 'Kit', x, z, 6, size * 0.42, 0, size * 0.62, size * 1.1, p.foliage, spin);
  frustum(w, 'Kit', x, z, 6, size * 0.42, 0, size * 0.62, size * 0.32, p.foliageDark, spin);
  w.solid([x - 0.3, 0, z - 0.3], [x + 0.3, 3, z + 0.3]);
}

/** H house court: a hall across the north, two wings, a court open to the south with its tree; `variant` turns the roofs. */
function house(w, p, variant) {
  // NM9: taller, fuller courts so the gate stands in a dense town rather than over tiny sparse houses
  const wall = 6.2, roof = variant === 0 ? 5.2 : 4.2;
  const blocks = variant === 0
    ? [[-24, 24, 8, 26], [-26, -12, -24, 6], [12, 26, -24, 6]]
    : [[-24, 24, 11, 26], [-25, -11, -24, 9], [11, 25, -24, 9], [-7, 7, -26, -18]];
  kerbRing(w, p, { s: 12 });
  if (w.hasModel('houses')) modelHouses(w);
  else for (const [x0, x1, z0, z1] of blocks) {
    w.sides('Kit', [x0, 0, z0], [x1, wall, z1], p.wall);
    hipRoof(w, x0 - 1.2, x1 + 1.2, z0 - 1.2, z1 + 1.2, wall, roof, p.roof, p.wood);
    w.solid([x0, 0, z0], [x1, wall + roof, z1]);
    // lit windows on the court-facing walls (one quad each, a hair off the wall)
    const long = x1 - x0 > z1 - z0;
    const count = Math.max(1, Math.floor((long ? x1 - x0 : z1 - z0) / 6));
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      if (long) { const x = x0 + (x1 - x0) * t; w.quad('Glow', [x + 1, 1.4, z0 - 0.05], [x - 1, 1.4, z0 - 0.05], [x - 1, 3, z0 - 0.05], [x + 1, 3, z0 - 0.05], p.window); }
      else { const z = z0 + (z1 - z0) * t, face = x0 < 0 ? x1 + 0.05 : x0 - 0.05, s = x0 < 0 ? -1 : 1; w.quad('Glow', [face, 1.4, z - s], [face, 1.4, z + s], [face, 3, z + s], [face, 3, z - s], p.window); }
    }
  }
  // the court: lanterns under the hall's eave and at the court's mouth, a tree in the middle
  for (const x of [-16, -8, 0, 8, 16]) lantern(w, x, 6.5, p, 2.4);
  for (const x of [-9, 9]) lantern(w, x, -24, p);
  tree(w, 0, -6, 7, p, 0.3);
  w.floor('Kit', -12, -26, 12, 8, 0.04, p.court);
  // NM12: a lawn in the court and a young tree on it (the mockup's green courts; clear of the mouth block and lanterns): a
  // trunk and one cone, half a full tree's triangles (the T8 tile caps are shrink-only)
  w.floor('Kit', -9, -16, 9, 2, 0.05, p.lawn);
  // RM10.3: fireflies over the court's lawn
  firefly(w, -4, 1.3, -10); firefly(w, 5, 1.7, -4);
  w.sides('Kit', [5.75, 0, -11.25], [6.25, 2, -10.75], p.trunk);
  frustum(w, 'Kit', 6, -11, 6, 2, 0, 2.6, 5.2, p.foliage, 1.2);
  w.solid([5.7, 0, -11.3], [6.3, 2, -10.7]);
}
/** RM7.3 (opt-in with the ground kit, canal.glb): a raised stone kerb (0.3 m wide, 0.15 m high) round a block's inner
 *  square, open where its paths meet the lanes (`gaps`: half-widths by side, n e s w at rotation 0). It collides (a step
 *  the rider climbs). */
function kerbRing(w, p, gaps) {
  if (!w.hasModel('canal')) return;
  const e = INNER, t = 0.3, h = 0.15;
  const run = (a0, a1, side) => {
    const gap = gaps[side] ?? 0, spans = gap > 0 ? [[a0, -gap], [gap, a1]] : [[a0, a1]];
    for (const [u0, u1] of spans) {
      const [min, max] = side === 'n' ? [[u0, 0, e - t], [u1, h, e]] : side === 's' ? [[u0, 0, -e], [u1, h, -e + t]]
        : side === 'e' ? [[e - t, 0, u0], [e, h, u1]] : [[-e, 0, u0], [-e + t, h, u1]];
      w.box('Kit', min, max, p.stone, p.stoneTop); w.solid(min, max);
    }
  };
  run(-e, e, 'n'); run(-e, e, 's'); run(-e + t, e - t, 'e'); run(-e + t, e - t, 'w');
}
/** RM4.4: an H court's houses from the kit's models (opt-in, the layout's kit): five cottages and two-storey
 *  houses along the north side facing the court, a porch hall on each wing facing in (the court's lanterns, lawn and
 *  tree are the court's own). */
function modelHouses(w) {
  for (const x of [-20, -10, 0, 10, 20]) {
    w.placeModel('houses', pick(x, 20, 2), x, 20, { yaw: Math.PI });
    w.solid([x - 4, 0, 16.5], [x + 4, 6, 23.5]);
  }
  for (const side of [-1, 1]) {
    w.placeModel('houses', 2, side * 20, -12, { yaw: -side * Math.PI / 2 });
    w.solid([side * 20 - 3, 0, -18], [side * 20 + 3, 5, -6]);
  }
}
/** A garden's four lawns (x0, x1, z0, z1) between its cross paths; lawn 3 - variant holds the pond. */
const GARDEN_LAWNS = [[-26, -3, 3, 26], [3, 26, 3, 26], [-26, -3, -26, -3], [3, 26, -26, -3]];
/** Where a garden lawn's three trees stand (fractions of the lawn) and their sizes (8 + i m). */
const gardenSpots = index => index % 2 === 0 ? [[0.3, 0.3], [0.72, 0.4], [0.45, 0.75]] : [[0.3, 0.68], [0.7, 0.7], [0.55, 0.28]];
/** G garden: four lawns between cross paths, trees, a pond in the south-east lawn, lanterns along the paths. */
function garden(w, p, variant) {
  kerbRing(w, p, { n: 3, e: 3, s: 3, w: 3 });
  for (const [index, [x0, x1, z0, z1]] of GARDEN_LAWNS.entries()) {
    w.floor('Kit', x0, z0, x1, z1, 0.06, p.lawn);
    w.box('Kit', [x0 - 0.3, 0, z0 - 0.3], [x1 + 0.3, 0.3, z0], p.hedge); w.box('Kit', [x0 - 0.3, 0, z1], [x1 + 0.3, 0.3, z1 + 0.3], p.hedge);
    if (index === 3 - variant) {
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      frustum(w, 'Kit', cx, cz, 10, 8.6, 8.6, 0, 0.35, p.stone);
      for (let i = 0; i < 10; i++) {
        const a0 = i / 10 * Math.PI * 2, a1 = (i + 1) / 10 * Math.PI * 2;
        w.tri('Water', [cx, 0.38, cz], [cx + 7.8 * Math.sin(a0), 0.38, cz + 7.8 * Math.cos(a0)], [cx + 7.8 * Math.sin(a1), 0.38, cz + 7.8 * Math.cos(a1)], p.water);
      }
      w.solid([cx - 8.6, 0, cz - 8.6], [cx + 8.6, 0.6, cz + 8.6]);
      continue;
    }
    // NM10: fireflies over the lawn
    firefly(w, x0 + (x1 - x0) * 0.6, 1.2, z0 + (z1 - z0) * 0.55); firefly(w, x0 + (x1 - x0) * 0.25, 1.8, z0 + (z1 - z0) * 0.2);
    for (const [i, [u, v]] of gardenSpots(index).entries()) {
      const x = x0 + (x1 - x0) * u, z = z0 + (z1 - z0) * v, size = 8 + i; // NM14: fuller crowns, as the mockup's gardens
      tree(w, x, z, size, p, i * 0.7 + index);
      // NM9: a lantern hung under each crown and its pool
      w.lanternEmitter?.([x + 1.1, size * 0.5 + 0.35, z], [...p.lantern]);
      w.box('Glow', [x + 0.8, size * 0.5, z - 0.3], [x + 1.4, size * 0.5 + 0.7, z + 0.3], p.lantern, p.lantern);
      pool(w, x + 1.1, z, 4, p.pool);
    }
  }
  for (const [x, z] of [[-1.6, 12], [1.6, -12], [12, 1.6], [-12, -1.6]]) lantern(w, x, z, p, 2.2);
}
/** S stall row (NM9: the mockup's density): two rows of five red stalls facing each other across the tile's aisle, each
 *  awning lit with lanterns along its eave, and food carts with lanterns down the aisle. */
function stalls(w, p) {
  kerbRing(w, p, { n: 6, s: 6 });
  if (w.hasModel('stalls')) { modelStalls(w, p); return; }
  for (const side of [-1, 1]) for (let i = 0; i < 5; i++) {
    const z = -22 + i * 11, outer = side * 27, inner = side * 15;
    const x0 = Math.min(outer, inner), x1 = Math.max(outer, inner), front = inner, out = -side;
    // the counter, the posts and a red gable roof with its ridge north-south
    w.box('Kit', [Math.min(front + side * 1.5, outer - side * 1), 0, z - 4], [Math.max(front + side * 1.5, outer - side * 1), 1.2, z + 4], p.wood);
    for (const [x, zz] of [[x0, z - 4.6], [x1, z - 4.6], [x0, z + 4.6], [x1, z + 4.6]]) {
      w.box('Kit', [x - 0.18, 0, zz - 0.18], [x + 0.18, 3.6, zz + 0.18], p.wood);
      w.solid([x - 0.18, 0, zz - 0.18], [x + 0.18, 3.6, zz + 0.18]);
    }
    const h = 3.6, ridge = 5.6, xm = (x0 + x1) / 2;
    w.quad('Kit', [x0 - 0.7, h, z + 5.2], [xm, ridge, z + 5.2], [xm, ridge, z - 5.2], [x0 - 0.7, h, z - 5.2], p.stall);
    w.quad('Kit', [x1 + 0.7, h, z - 5.2], [xm, ridge, z - 5.2], [xm, ridge, z + 5.2], [x1 + 0.7, h, z + 5.2], p.stall);
    w.tri('Kit', [x0 - 0.7, h, z - 5.2], [xm, ridge, z - 5.2], [x1 + 0.7, h, z - 5.2], p.stallDark);
    w.tri('Kit', [x1 + 0.7, h, z + 5.2], [xm, ridge, z + 5.2], [x0 - 0.7, h, z + 5.2], p.stallDark);
    // NM7: the awning lit from within and a lantern string along its open eave, a pool of light before it
    w.quad('Glow', [x0 - 0.5, h - 0.05, z - 5], [x1 + 0.5, h - 0.05, z - 5], [x1 + 0.5, h - 0.05, z + 5], [x0 - 0.5, h - 0.05, z + 5], p.awning);
    const eave = front + out * 0.9;
    for (const dz of [-3.9, -1.3, 1.3, 3.9]) {
      w.lanternEmitter?.([eave, h - 0.375, z + dz], [...p.lantern]);
      w.box('Glow', [eave - 0.18, h - 0.6, z + dz - 0.2], [eave + 0.18, h - 0.15, z + dz + 0.2], p.lantern, p.lantern);
    }
    pool(w, front + out * 3, z, 6, p.pool);
    w.solid([x0, 0, z - 4.6], [x1, 1.2, z + 4.6]);
  }
  // the aisle: food carts with a lantern each, staggered either side of the middle
  for (let i = 0; i < 4; i++) {
    const z = -16.5 + i * 11, x = i % 2 === 0 ? -4 : 4;
    w.box('Kit', [x - 1.4, 0.4, z - 0.9], [x + 1.4, 1.3, z + 0.9], p.crate);
    w.box('Kit', [x - 1.5, 2.3, z - 1.1], [x + 1.5, 2.5, z + 1.1], p.stall);
    for (const dx of [-1.3, 1.3]) w.box('Kit', [x + dx - 0.08, 0, z - 0.08], [x + dx + 0.08, 2.3, z + 0.08], p.wood);
    w.lanternEmitter?.([x, 1.8, z], [...p.lantern]);
    w.box('Glow', [x - 0.25, 1.5, z - 0.25], [x + 0.25, 2.1, z + 0.25], p.lantern, p.lantern);
    pool(w, x, z, 4, p.pool);
    steam(w, x, 2.6, z);
    w.solid([x - 1.4, 0, z - 0.9], [x + 1.4, 1.3, z + 0.9]);
  }
}
/** RM4.2: the S tile from the kit's stall models (opt-in, the layout's kit): ten stalls a side every 5.5 m
 *  facing the aisle (the hero stall and the red-roofed row stall, by place), a pool before every other one, and food carts
 *  staggered down the aisle; each model emits its own lanterns. */
function modelStalls(w, p) {
  let heroes = 0;
  for (const side of [-1, 1]) for (let i = 0; i < 10; i++) {
    const z = -24.75 + i * 5.5, x = side * 17.5;
    // a hero stall every fourth place down each row, the two rows offset (pick() gave every S-tile stall the row kind;
    // RM8.5: every other one put an S tile over 15k triangles; OB10: every third put it at 17.9k, past the build-out
    // bar's 15k)
    const kind = (i + side + 1) % 4 === 0 ? 0 : 1, yaw = -side * Math.PI / 2;
    w.placeModel('stalls', kind, x, z, { yaw });
    w.solid([x - 1.5, 0, z - 2.1], [x + 1.5, 1.1, z + 2.1]);
    // RM4.8 (opt-in): a vendor behind every third hero stall's counter (OB10: was every other), facing out with it; a
    // shopper before the second and sixth stall (OB10: and no longer the tenth); G755: counted over the hero stalls
    if (w.hasModel('figures')) {
      if (kind === 0 && heroes++ % 3 === 0) w.placeModel('figures', 0, x - side * 0.2, z, { yaw });
      if (i === 1 || i === 5) w.placeModel('figures', pick(x, z, 2, 3) + 1, x - side * 2.6, z + 0.6, { yaw: yaw + Math.PI });
    }
    if (i % 2 === 0) pool(w, x - side * 3.4, z + 2.75, 5, p.pool);
    // RM4.6 (opt-in): goods waiting behind every third stall (OB10: was every other)
    if (i % 3 === 1 && w.hasModel('props')) { w.placeModel('props', 2, side * 20.6, z, { yaw: -side * Math.PI / 2 }); w.solid([side * 20.6 - 0.7, 0, z - 0.7], [side * 20.6 + 0.7, 0.8, z + 0.7]); }
  }
  // food carts down the aisle (OB10: three, was four)
  for (let i = 0; i < 3; i++) {
    const z = -16.5 + i * 16.5, x = i % 2 === 0 ? -4 : 4;
    w.placeModel('stalls', 2, x, z, { yaw: i % 2 === 0 ? Math.PI / 2 : -Math.PI / 2 });
    w.solid([x - 0.8, 0, z - 1.3], [x + 0.8, 1.1, z + 1.3]);
    pool(w, x, z, 4, p.pool);
    steam(w, x, 2.6, z);
  }
}
/** The water region of a canal tile at rotation 0, as rectangles (x0, z0, x1, z1); `C` runs north-south, `L` south to east. */
function waterOf(type) {
  const { half } = CANAL;
  if (type === 'C') return [[-half, -HALF, half, HALF]];
  return [[-half, -HALF, half, half], [-half, -half, HALF, half]];
}
/** OB3 (G978, shared kit rule, the ice water kind): a palette with `ice` freezes its canals. The water is a glossy ice
 *  sheet in that colour (the Water draw), crazed with paler cracks, and snow drifts lie along the walls; the walls'
 *  sides are the rectangle's edges that are not open borders. */
function frozen(w, p, [x0, z0, x1, z1], depth) {
  const y = -depth + 0.02, crack = p.iceCrack ?? p.snow ?? p.ice, snow = p.snow ?? p.ice;
  // cracks: a few long thin slivers across the sheet, the same every bake (pick)
  for (let i = 0; i < 6; i++) {
    const t = (i + 0.5) / 6, ax = x0 + (x1 - x0) * pick(x0 + i, z0, 7, i) / 6, az = z0 + (z1 - z0) * t;
    const bx = x0 + (x1 - x0) * pick(x1, z1 + i, 7, i + 3) / 6, bz = Math.min(z1, Math.max(z0, az + (z1 - z0) * (pick(i, x0, 5) - 2) / 10));
    const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1, nx = -dz / l * 0.06, nz = dx / l * 0.06;
    w.quad('Kit', [ax - nx, y, az - nz], [ax + nx, y, az + nz], [bx + nx, y, bz + nz], [bx - nx, y, bz - nz], crack);
  }
  // drifts: a wedge along each long side, 0.35 m up the wall and 1.6 m out over the ice
  const long = x1 - x0 < z1 - z0;
  for (const side of [-1, 1]) {
    if (long) {
      const wall = side < 0 ? x0 : x1, out = wall - side * 1.6;
      w.quad('Kit', [wall, -depth + 0.35, z0], [out, y + 0.01, z0], [out, y + 0.01, z1], [wall, -depth + 0.35, z1], snow);
    } else {
      const wall = side < 0 ? z0 : z1, out = wall - side * 1.6;
      w.quad('Kit', [x0, -depth + 0.35, wall], [x1, -depth + 0.35, wall], [x1, y + 0.01, out], [x0, y + 0.01, out], snow);
    }
  }
}
/** C / L canal: recessed water between stone walls and rims, trees and lanterns on the banks, half a bridge per wet border. */
function canal(w, p, type) {
  const rects = waterOf(type);
  const { half, rim, rimHeight, depth } = CANAL;
  // the water and its walls, each walked with the water on its left so it faces the water
  for (const [x0, z0, x1, z1] of rects) w.floor('Water', x0, z0, x1, z1, -depth, p.ice ?? p.water);
  if (p.ice !== undefined) for (const rect of rects) frozen(w, p, rect, depth);
  // RM10.3: fireflies over the banks (dry in both the straight and the corner)
  firefly(w, half + 4, 1.4, -20); firefly(w, -half - 4, 1.8, 12);
  const walls = type === 'C'
    ? [[-half, HALF, -half, -HALF], [half, -HALF, half, HALF]]
    : [[-half, half, -half, -HALF], [HALF, half, -half, half], [half, -HALF, half, -half], [half, -half, HALF, -half]];
  for (const [xa, za, xb, zb] of walls) w.quad('Kit', [xa, -depth, za], [xb, -depth, zb], [xb, 0, zb], [xa, 0, za], p.stone);
  // NM12: the canals' light at night, a blue glow on the water along each wall (the additive Pool: bright at the wall,
  // black 2.5 m in), so the canals read from the road and from 100 m up as in the mockup
  if (p.canalGlow !== undefined) for (const [xa, za, xb, zb] of walls) {
    const nx = xa === xb ? -Math.sign(xa) : 0, nz = xa === xb ? 0 : -Math.sign(za), y = -depth + 0.06, k = 2.5, c = p.canalGlow, o = [0, 0, 0];
    upward(w, [xa, y, za], [xb, y, zb], [xb + nx * k, y, zb + nz * k], [c, c, o]);
    upward(w, [xa, y, za], [xb + nx * k, y, zb + nz * k], [xa + nx * k, y, za + nz * k], [c, o, o]);
  }
  // rims along the inner banks (never across a border: the lanes cross on the bridges)
  const rimRuns = type === 'C'
    ? [[-half - rim, -INNER, -half, INNER], [half, -INNER, half + rim, INNER]]
    : [[-half - rim, -INNER, -half, half + rim], [-half - rim, half, INNER, half + rim], [half, -INNER, half + rim, -half], [half, -half - rim, INNER, -half]];
  const coped = w.hasModel('canal');
  for (const [x0, z0, x1, z1] of rimRuns) {
    if (coped) copeRun(w, rects, [x0, z0, x1, z1]); else w.box('Kit', [x0, 0, z0], [x1, rimHeight, z1], p.stone, p.stoneTop);
    w.solid([x0, 0, z0], [x1, rimHeight, z1]);
  }
  // RM7.2 (opt-in with the coping): each straight canal's lanterns double on its water, a soft streak from the wall
  if (coped && type === 'C') for (const [x, z] of [[-17, 0], [17, -18], [17, 18], [-half - 2.4, -INNER + 3], [-half - 2.4, INNER - 3], [half + 2.4, -INNER + 3], [half + 2.4, INNER - 3]]) {
    const wall = Math.sign(x) * half, y = -depth + 0.07, c = p.pool, o = [0, 0, 0], reach = -Math.sign(x) * 5.5;
    upward(w, [wall, y, z - 0.35], [wall, y, z + 0.35], [wall + reach, y, z + 0.15], [c, c, o]);
    upward(w, [wall, y, z - 0.35], [wall + reach, y, z + 0.15], [wall + reach, y, z - 0.15], [c, o, o]);
  }
  // half of an 8 m arched bridge in every wet border: the lane runs across the canal on it
  const borders = type === 'C' ? [0, 2] : [1, 2];
  for (const side of borders) halfBridge(w, p, side);
  // the banks: a row of trees and lanterns
  const banks = type === 'C' ? [[-17, -18], [-17, 0], [-17, 18], [17, -18], [17, 0], [17, 18]] : [[-17, -18], [-17, 18], [0, 20], [18, 20], [18, -18]];
  for (const [i, [x, z]] of banks.entries()) { if (i % 2 === 0) tree(w, x, z, 6, p, i); else lantern(w, x, z, p); }
  for (const z of [-INNER + 3, INNER - 3]) if (type === 'C') { lantern(w, -half - 2.4, z, p, 2.2); lantern(w, half + 2.4, z, p, 2.2); }
}
/** RM7.1 (opt-in, the layout's kit): a rim run as the kit's 2 m coping blocks, their lips toward the water (the
 *  side of the run a water rectangle touches), a mooring bollard every fifth and water steps every ninth. */
function copeRun(w, rects, [x0, z0, x1, z1]) {
  const wet = (x, z) => rects.some(([a0, b0, a1, b1]) => x > a0 && x < a1 && z > b0 && z < b1);
  const alongZ = z1 - z0 > x1 - x0, length = alongZ ? z1 - z0 : x1 - x0, count = Math.max(1, Math.round(length / 2)), step = length / count;
  const mid = alongZ ? (z0 + z1) / 2 : (x0 + x1) / 2, low = alongZ ? wet(x0 - 0.5, mid) : wet(mid, z0 - 0.5);
  for (let i = 0; i < count; i++) {
    const t = (alongZ ? z0 : x0) + (i + 0.5) * step, variant = i % 9 === 4 ? 2 : i % 5 === 2 ? 1 : 0;
    const [x, z] = alongZ ? [low ? x0 : x1, t] : [t, low ? z0 : z1];
    w.placeModel('canal', variant, x, z, { yaw: alongZ ? (low ? -Math.PI / 2 : Math.PI / 2) : (low ? Math.PI : 0) });
  }
}
/** Half of an arched bridge in the border on `side` (0 N, 1 E, 2 S at rotation 0; the canal crosses that border). */
function halfBridge(w, p, side) {
  const { rise, half, deck, steps } = BRIDGE;
  // built for the north border (the lane runs east-west over z in [INNER, HALF]), then turned for the others
  const turnPoint = ([x, y, z]) => { let px = x, pz = z; for (let i = 0; i < side; i++) [px, pz] = [pz, -px]; return [px, y, pz]; };
  const at = (u) => { const x = -half + 2 * half * u; return [x, rise * Math.sin(Math.PI * u)]; };
  // RM4.5 (opt-in, the layout's kit): the kit's arched half-bridge, its seam edge on the border, turned with it
  const model = w.hasModel('bridges');
  if (model) { const [ox, , oz] = turnPoint([0, 0, HALF]); w.placeModel('bridges', pick(ox, oz, 3), ox, oz, { yaw: side * Math.PI / 2 }); }
  // RM4.8 (opt-in): an elder on the crown of every other bridge half, looking across the span
  if (model && w.hasModel('figures') && side % 2 === 0) {
    const [fx, , fz] = turnPoint([1.5, 0, HALF - 2]); w.placeModel('figures', 2, fx, fz, { y: rise + deck, yaw: side * Math.PI / 2 + Math.PI / 2 });
  }
  for (let i = 0; i < steps; i++) {
    const [xa, ya] = at(i / steps), [xb, yb] = at((i + 1) / steps);
    const q = (a, b, c, d, colour) => { if (!model) w.quad('Kit', turnPoint(a), turnPoint(b), turnPoint(c), turnPoint(d), colour); };
    q([xa, ya + deck, INNER], [xa, ya + deck, HALF], [xb, yb + deck, HALF], [xb, yb + deck, INNER], p.stoneTop);
    q([xb, yb - 0.4, INNER], [xa, ya - 0.4, INNER], [xa, ya + deck, INNER], [xb, yb + deck, INNER], p.stone);
    q([xa, ya - 0.4, HALF], [xb, yb - 0.4, HALF], [xb, yb + deck, HALF], [xa, ya + deck, HALF], p.stone);
    // its parapet on the tile's side; the lantern posts at its feet
    q([xb, yb + deck, INNER + 0.4], [xa, ya + deck, INNER + 0.4], [xa, ya + deck + 0.7, INNER + 0.4], [xb, yb + deck + 0.7, INNER + 0.4], p.stoneTop);
    // collision: a stepped deck the rider climbs
    const lo = turnPoint([xa, 0, INNER]), hi = turnPoint([xb, Math.max(ya, yb) + deck, HALF]);
    w.solid([Math.min(lo[0], hi[0]), -0.5, Math.min(lo[2], hi[2])], [Math.max(lo[0], hi[0]), Math.min(ya, yb) + deck, Math.max(lo[2], hi[2])]);
  }
  for (const x of [-half - 0.6, half + 0.6]) {
    const [px, , pz] = turnPoint([x, 0, INNER + 0.6]);
    lantern(w, px, pz, p, 2.6);
  }
}
/** N entry forecourt: open paving at the entry corner (north-east), an L of planters on the inner sides, an arc of lanterns. */
/** radians off a lane's axis at the forecourt's 26 m arc: 4.3 m out, past the lane's 4 m edge and a lantern's post */
const LANE_CLEAR = 0.166;
function forecourt(w, p) {
  w.box('Kit', [-26, 0, -26], [-22, 1, 20], p.hedge, p.lawn); w.box('Kit', [-26, 0, -26], [20, 1, -22], p.hedge, p.lawn);
  w.solid([-26, 0, -26], [-22, 1, 20]); w.solid([-26, 0, -26], [20, 1, -22]);
  // RM8.6: with the kit's trees every other one, 14 m apart (their models pay the entry tile's poster: 4 MB resident)
  const every = w.hasModel('trees') ? 2 : 1;
  for (let i = 0; i < 6; i += every) { tree(w, -24, -18 + i * 7, 4.2, p, i); }
  for (let i = 1; i < 6; i += every) tree(w, -18 + i * 7, -24, 4.2, p, i + 3);
  // The arc's ends keep clear of the 8 m entry lanes, or a post stands in one and the entry proof refuses the shard.
  for (let i = 0; i < 6; i++) { const a = Math.PI + Math.min(Math.max((i + 0.5) / 6 * Math.PI / 2, LANE_CLEAR), Math.PI / 2 - LANE_CLEAR), r = 26; lantern(w, HALF + r * Math.cos(a), HALF + r * Math.sin(a), p, 2.6); }
  w.floor('Kit', -22, -22, 27, 27, 0.03, p.forecourt);
  // NM9: a little market of kiosks on the forecourt's open paving, clear of the entry corner
  for (const [x, z] of [[-12, -12], [-2, -12], [8, -12], [-12, -2], [-12, 8], [-2, -2]]) kiosk(w, p, x, z);
}
/** NM9: a kiosk: a 4 m counter under a red pyramid roof on four posts, a lantern under it and its pool. */
function kiosk(w, p, x, z) {
  w.box('Kit', [x - 2, 0, z - 2], [x + 2, 1.1, z + 2], p.wood);
  for (const [dx, dz] of [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]]) w.box('Kit', [x + dx - 0.12, 0, z + dz - 0.12], [x + dx + 0.12, 3, z + dz + 0.12], p.wood);
  frustum(w, 'Kit', x, z, 4, 3.6, 0, 3, 4.6, p.stall, Math.PI / 4);
  w.lanternEmitter?.([x, 2.5, z], [...p.lantern]);
  w.box('Glow', [x - 0.25, 2.2, z - 0.25], [x + 0.25, 2.8, z + 0.25], p.lantern, p.lantern);
  pool(w, x, z, 4.5, p.pool);
  // RM10.2: the kiosks cook too: steam off each roof's peak (the road entry's side views look across them)
  steam(w, x, 4.8, z);
  w.solid([x - 2, 0, z - 2], [x + 2, 1.1, z + 2]);
}
/** OB10 R3: the plaza quarter's L of stalls: its arms `off` m off the lanes, a stall every `step` m past the corner */
const PLAZA_STALLS = { off: 22, step: 5.5, count: 5 };
/** the plaza quarter's kiosks (diagonal-symmetric) and its beds, a raised lawn along each lane into the gate */
const PLAZA_KIOSKS = [[-16, 16], [-4, 16], [-16, 4]];
const PLAZA_BEDS = [[HALF - 16, -HALF + 16, HALF - 9, -HALF + 34], [HALF - 34, -HALF + 9, HALF - 16, -HALF + 16]];

/** P plaza quarter: the plaza's paving round the gate (the tile's south-east corner, (HALF, -HALF)), a raised bed either
 *  side of each lane into it, and (OB10 look loop R3, round 49's tight plaza) an L of stalls `PLAZA_STALLS.off` m off both
 *  lanes facing them, kiosks in the far corner. Symmetric about the corner's diagonal, so the four turned quarters mirror. */
function plaza(w, p) {
  w.floor('Kit', -HALF + 0.02, -HALF + 0.02, HALF - 0.02, HALF - 0.02, 0.03, p.plaza);
  // OB10 R3: the L replaced two rings of lanterns, benches and planters on open paving (round 49's plaza is lined with
  // stalls up to the gate). The kit's row stalls, 5 a lane (a plaza tile holds to the 15k bar), each with the pool of
  // light the rings had (8 triangles); a lantern at the L's corner
  const { off, step, count } = PLAZA_STALLS, cx = HALF - off, cz = -HALF + off;
  lantern(w, cx, cz, p, 2.6);
  if (w.hasModel('stalls')) for (let i = 1; i <= count; i++) {
    // the arm along the north-south lane (east edge), facing east, and its mirror along the south lane, facing south
    for (const [x, z, yaw, hx, hz] of [[cx, cz + i * step, Math.PI / 2, 1.5, 2.1], [cx - i * step, cz, Math.PI, 2.1, 1.5]]) {
      w.placeModel('stalls', 1, x, z, { yaw });
      w.solid([x - hx, 0, z - hz], [x + hx, 1.1, z + hz]);
      pool(w, x + Math.sin(yaw) * 3.4, z + Math.cos(yaw) * 3.4, 5, p.pool);
    }
  }
  // three kiosks in the far corner, behind the L
  for (const [x, z] of PLAZA_KIOSKS) kiosk(w, p, x, z);
  // RM8.4: r7's plaza beds, a raised lawn either side of each lane into the gate: one along the tile's east lane, one
  // along its south; with the kit, round trees on them and lanterns at their outer corners (RM8.5: planters at their
  // ends put a plaza tile over 15k triangles with every family on)
  for (const [x0, z0, x1, z1] of PLAZA_BEDS) {
    w.box('Kit', [x0, 0, z0], [x1, 0.45, z1], p.stone, p.lawn); w.solid([x0, 0, z0], [x1, 0.45, z1]);
    const along = z1 - z0 > x1 - x0, mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    if (w.hasModel('trees')) for (const t of [-0.25, 0.25]) {
      const [x, z] = along ? [mx, mz + t * (z1 - z0)] : [mx + t * (x1 - x0), mz];
      w.placeModel('trees', 0, x, z, { y: 0.45, yaw: x + z, scale: 6.5 * 1.1 / 8 }); w.solid([x - 0.3, 0.45, z - 0.3], [x + 0.3, 3, z + 0.3]);
    }
    if (w.hasModel('lanterns')) for (const [x, z] of along ? [[x0 - 0.8, z0], [x0 - 0.8, z1]] : [[x0, z1 + 0.8], [x1, z1 + 0.8]]) lantern(w, x, z, p, 2.6);
  }
}
/** RM11: a far tree crown about (x, y, z), `r` wide: a five-sided double cone (10 triangles). */
function farCrown(w, x, y, z, r, colour) {
  frustum(w, 'far', x, z, 5, r, 0, y, y + r * 0.9, colour); frustum(w, 'far', x, z, 5, r, 0, y, y - r * 0.5, colour);
}
/** RM11: the far stand-in per tile (30 to 110 triangles, ~4k for the 64; the far proxy's 8k holds them and the gate): its
 *  ground and what reads from 100 to 260 m up, where the kit's models stand: the courts' hip-roofed houses round a lawn,
 *  the stall rows' red gables, round tree crowns, the gardens' paths and pond, the forecourt's hedges and kiosks, the
 *  plaza's beds, the canals' water. The far proxy is one Kit draw, so nothing glows. */
function farTile(w, p, type, variant) {
  const ground = { H: p.court, G: p.lawn, S: p.paving, C: p.paving, L: p.paving, N: p.forecourt, P: p.plaza }[type] ?? p.paving;
  w.floor('far', -HALF, -HALF, HALF, HALF, 0, ground);
  const cottage = (x0, x1, z0, z1) => { w.sides('far', [x0, 0, z0], [x1, 5, z1], p.wall); hipRoof(w, x0 - 0.8, x1 + 0.8, z0 - 0.8, z1 + 0.8, 5, 3.4, p.roof, null, 'far'); };
  if (type === 'H') {
    for (const x of [-20, -10, 0, 10, 20]) cottage(x - 3.6, x + 3.6, 16.8, 23.2);
    for (const side of [-1, 1]) cottage(side * 20 - 3, side * 20 + 3, -18, -6);
    w.floor('far', -9, -16, 9, 2, 0.05, p.lawn); farCrown(w, 0, 5, -6, 3.2, p.foliage);
  }
  if (type === 'S') for (const side of [-1, 1]) for (let i = 0; i < 5; i++) {
    const z = -22 + i * 11, x0 = side < 0 ? -21.5 : 14.5, x1 = x0 + 7, xm = x0 + 3.5, h = 3, ridge = 4.6;
    w.quad('far', [x0, h, z + 5.2], [xm, ridge, z + 5.2], [xm, ridge, z - 5.2], [x0, h, z - 5.2], p.stall);
    w.quad('far', [x1, h, z - 5.2], [xm, ridge, z - 5.2], [xm, ridge, z + 5.2], [x1, h, z + 5.2], p.stall);
    w.tri('far', [x0, h, z - 5.2], [xm, ridge, z - 5.2], [x1, h, z - 5.2], p.stallDark);
    w.tri('far', [x1, h, z + 5.2], [xm, ridge, z + 5.2], [x0, h, z + 5.2], p.stallDark);
  }
  if (type === 'G') {
    w.floor('far', -3, -HALF, 3, HALF, 0.02, p.paving); w.floor('far', -HALF, -3, HALF, 3, 0.03, p.paving);
    for (const [index, [x0, x1, z0, z1]] of GARDEN_LAWNS.entries()) {
      if (index === 3 - variant) {
        const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
        for (let i = 0; i < 8; i++) {
          const a0 = i / 8 * Math.PI * 2, a1 = (i + 1) / 8 * Math.PI * 2;
          w.tri('far', [cx, 0.06, cz], [cx + 8 * Math.sin(a0), 0.06, cz + 8 * Math.cos(a0)], [cx + 8 * Math.sin(a1), 0.06, cz + 8 * Math.cos(a1)], p.water);
        }
        continue;
      }
      for (const [i, [u, v]] of gardenSpots(index).entries()) farCrown(w, x0 + (x1 - x0) * u, (8 + i) * 0.62, z0 + (z1 - z0) * v, (8 + i) * 0.42, p.foliage);
    }
  }
  if (type === 'C' || type === 'L') for (const [x0, z0, x1, z1] of waterOf(type)) w.floor('far', x0, z0, x1, z1, 0.05, p.water);
  if (type === 'N') {
    w.box('far', [-26, 0, -26], [-22, 1, 20], p.hedge, p.lawn); w.box('far', [-26, 0, -26], [20, 1, -22], p.hedge, p.lawn);
    for (let i = 0; i < 6; i += 2) { farCrown(w, -24, 3.2, -18 + i * 7, 2.6, p.foliage); farCrown(w, -18 + (i + 1) * 7, 3.2, -24, 2.6, p.foliage); }
    for (const [x, z] of [[-12, -12], [-2, -12], [8, -12], [-12, -2], [-12, 8], [-2, -2]]) frustum(w, 'far', x, z, 4, 3.6, 0, 3, 4.6, p.stall, Math.PI / 4);
  }
  if (type === 'P') {
    // OB10 R3: the L of stalls as a red gable run along each lane, and the kiosks' roofs
    const { off, step, count } = PLAZA_STALLS, cx = HALF - off, cz = -HALF + off, near = step * 0.5, far = step * (count + 0.5);
    const h = 2.6, ridge = 3.8, half = 1.6;
    w.quad('far', [cx - half, h, cz + far], [cx, ridge, cz + far], [cx, ridge, cz + near], [cx - half, h, cz + near], p.stall);
    w.quad('far', [cx + half, h, cz + near], [cx, ridge, cz + near], [cx, ridge, cz + far], [cx + half, h, cz + far], p.stall);
    w.quad('far', [cx - far, h, cz - half], [cx - far, ridge, cz], [cx - near, ridge, cz], [cx - near, h, cz - half], p.stall);
    w.quad('far', [cx - near, h, cz + half], [cx - near, ridge, cz], [cx - far, ridge, cz], [cx - far, h, cz + half], p.stall);
    for (const [x, z] of PLAZA_KIOSKS) frustum(w, 'far', x, z, 4, 3.6, 0, 3, 4.6, p.stall, Math.PI / 4);
    for (const [x0, z0, x1, z1] of PLAZA_BEDS) {
      w.box('far', [x0, 0, z0], [x1, 0.45, z1], p.stone, p.lawn);
      const along = z1 - z0 > x1 - x0, mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      for (const t of [-0.25, 0.25]) { const [x, z] = along ? [mx, mz + t * (z1 - z0)] : [mx + t * (x1 - x0), mz]; farCrown(w, x, 4.6, z, 2.8, p.foliage); }
    }
  }
}

/** RM10 (D112): no lane life within this many metres of the gate (its wings span the plaza's lanes). */
const GATE_CLEAR = 30;
/** OP1: the hero paper lantern (kit `hero` take A, 0.82 m as built) on the lane ropes, about 1.3 m tall */
const HERO_SCALE = 1.6;
/** The lane on a tile's north (side 0) or east (side 1) seam: two strings of bulbs 3 m either side of the seam, sagging
 *  between posts at the crossings' corners, the bulbs alternating gold and red (Glow, merged into the tile's glow draw). */
function stringLights(w, p, side, centre) {
  const along = (u, off, y) => (side === 0 ? [u, y, HALF + off] : [HALF + off, y, -u]);
  const ends = [-HALF + 4, HALF - 4], top = 6.2, sag = 1.4, step = 2.5, bulb = 0.16;
  // an entry's footprint (8 m wide, 15 m in from the plot's edge, on the x = 0 and z = 0 seams) stays clear above the road
  const clear = (x, z) => { const wx = centre[0] + x, wz = centre[1] + z, margin = 1.5;
    return (Math.abs(wx) < 4 + margin && Math.abs(wz) > 235 - margin) || (Math.abs(wz) < 4 + margin && Math.abs(wx) > 235 - margin); };
  laneLife(w, along, (x, z) => clear(x, z) || Math.hypot(centre[0] + x, centre[1] + z) < GATE_CLEAR);
  // RM8.5: the kit's round bulbs hang every 3 m (the tetrahedra's 2.5 m with every family on put an S tile over 15k)
  // OP1: every other seam (by its tile's column, row and side) carries a hero lantern
  const alternate = (Math.floor((centre[0] + 250) / (2 * HALF)) + Math.floor((250 - centre[1]) / (2 * HALF)) + side) % 2 === 0;
  if (w.hasModel('strings')) { modelStrings(w, p, along, ends, clear, top, sag, 3, alternate); return; }
  for (const off of [-3, 3]) {
    for (const u of ends) {
      const [x, , z] = along(u, off, 0);
      if (clear(x, z)) continue;
      w.box('Kit', [x - 0.12, 0, z - 0.12], [x + 0.12, top + 0.3, z + 0.12], p.wood);
      w.solid([x - 0.15, 0, z - 0.15], [x + 0.15, top, z + 0.15]);
      // NM9: a red banner with a gold head on each post, hung across the lane so it reads down it and from above
      const [ax, , az] = along(u + 0.5, off, 0), [bx, , bz] = along(u - 0.5, off, 0), y0 = 2.8, y1 = 5.4;
      for (const [a, b] of [[[ax, az], [bx, bz]], [[bx, bz], [ax, az]]]) {
        w.quad('Kit', [a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], p.stall);
        w.quad('Kit', [a[0], y1, a[1]], [b[0], y1, b[1]], [b[0], y1 + 0.35, b[1]], [a[0], y1 + 0.35, a[1]], p.lantern);
      }
    }
    const span = ends[1] - ends[0], count = Math.floor(span / step);
    for (let i = 1; i < count; i++) {
      const t = i / count, u = ends[0] + span * t, y = top - sag * 4 * t * (1 - t), [x, , z] = along(u, off, y);
      if (clear(x, z)) continue;
      // a bulb is a small tetrahedron: closed, seen from every side, 4 triangles (a box was 10)
      const colour = i % 2 === 0 ? p.lantern : p.bulbRed, apex = [x, y + bulb * 1.4, z], a = [x - bulb, y - bulb, z - bulb], b = [x + bulb, y - bulb, z - bulb], c = [x, y - bulb, z + bulb * 1.4];
      w.lanternEmitter?.([x, y, z], [...colour]);
      w.tri('Glow', apex, b, a, colour); w.tri('Glow', apex, c, b, colour); w.tri('Glow', apex, a, c, colour); w.tri('Glow', a, b, c, colour);
    }
  }
}

/** RM10 (D112): the life every lane carries, so it reads straight down a lane from the road entry: four fireflies low at
 *  its edges (all in the Glow draw), none inside `GATE_CLEAR` m of the gate. OP1 (G827: "too many floating lanterns"):
 *  the sky lanterns that floated over every lane and the plaza are gone; every lantern hangs on a rope, post or eave. */
function laneLife(w, along, clear) {
  for (const [u, off, y] of [[-HALF * 0.8, -3.6, 1.4], [-HALF * 0.4, 3.6, 1.9], [HALF * 0.4, -3.6, 1.6], [HALF * 0.8, 3.6, 1.3]]) {
    const [x, , z] = along(u, off, y);
    if (!clear(x, z)) firefly(w, x, y, z);
  }
}

/** RM4.3 (opt-in, the layout's kit): a seam's strings from the kit: a lane post with its banner along the lane
 *  at each crossing corner, a thick dark rope sagging between them (OP1, G827: "connected by a very visible rope") with
 *  round gold bulbs on it, and on every other seam one hero paper lantern, hung from the middle of one of its two ropes
 *  where it sags lowest (the kit's `hero` take A, about 55 on the lanes: 2.6 KB of phone wire each; without it the old
 *  small paper lantern every fourth point). Each model emits its own light. */
function modelStrings(w, p, along, ends, clear, top, sag, step, alternate) {
  const yaw = along(1, 0, 0)[0] === 1 ? 0 : Math.PI / 2, hero = w.hasModel('hero'), heroOff = yaw === 0 ? -3 : 3;
  for (const off of [-3, 3]) {
    for (const u of ends) {
      const [x, , z] = along(u, off, 0);
      if (clear(x, z)) continue;
      w.placeModel('strings', 2, x, z, { yaw });
      w.solid([x - 0.15, 0, z - 0.15], [x + 0.15, top, z + 0.15]);
    }
    const span = ends[1] - ends[0], count = Math.floor(span / step), cord = [], heroAt = new Set([Math.round(count / 2)]);
    for (let i = 0; i <= count; i++) {
      const t = i / count, u = ends[0] + span * t, y = top - sag * 4 * t * (1 - t), point = along(u, off, y);
      if (i % 2 === 0 || i === count) cord.push(point);
      if (i === 0 || i === count || clear(point[0], point[2])) continue;
      if (hero) {
        if (alternate && off === heroOff && heroAt.has(i)) w.placeModel('hero', 0, point[0], point[2], { y, yaw, scale: HERO_SCALE });
        else w.placeModel('strings', 0, point[0], point[2], { y: y - 0.16, yaw });
      } else w.placeModel('strings', i % 4 === 0 ? 1 : 0, point[0], point[2], { y: y - (i % 4 === 0 ? 0 : 0.16), yaw });
    }
    // the rope: a 7 cm three-sided rope between its points, its faces out (a closed tube: no back faces), its flat
    // underside toward the lane below and its ridge up
    for (let k = 0; k + 1 < cord.length; k++) {
      const a = cord[k], b = cord[k + 1];
      if (a === undefined || b === undefined || clear(a[0], a[2]) || clear(b[0], b[2])) continue;
      const r = 0.04, across = yaw === 0 ? [0, 0, r] : [r, 0, 0];
      const at = (q, s, t) => [q[0] + across[0] * s, q[1] + r * t, q[2] + across[2] * s];
      for (const [s0, t0, s1, t1] of [[-1, -0.6, 0, 1], [0, 1, 1, -0.6], [1, -0.6, -1, -0.6]]) {
        w.quad('Kit', at(a, s0, t0), at(a, s1, t1), at(b, s1, t1), at(b, s0, t0), p.rope ?? p.wood);
      }
    }
  }
}


const COARSE_FAMILIES = new Set(['houses', 'stalls', 'trees', 'bridges']);
const TYPES = { house: 'H', garden: 'G', stalls: 'S', canal: 'C', bend: 'L', forecourt: 'N', plaza: 'P' };
const BUILDERS = { H: house, G: garden, S: stalls, C: canal, L: canal, N: forecourt, P: plaza };
const SOCKETS = { H: 'pppp', G: 'pppp', S: 'pppp', C: 'wpwp', L: 'pwwp', N: 'pppp', P: 'pppp' };
const LETTERS = { H: 'house', G: 'garden', S: 'stalls', C: 'canal', L: 'bend', N: 'forecourt', P: 'plaza' };

/** A layout owns its letters; each value names one of this plot's authored builders. */
export function nightMarketBuilders(letters = LETTERS) {
  const tiles = Object.fromEntries(Object.entries(letters).map(([letter, kind]) => {
    const type = TYPES[kind];
    if (!/^[A-Z]$/u.test(letter) || !Object.hasOwn(TYPES, kind)) throw new Error('night-market: unknown tile builder');
    const canalTile = type === 'C' || type === 'L';
    return [letter, { build: BUILDERS[type], far: (w, p, variant) => farTile(w, p, type, variant),
      sockets: SOCKETS[type], water: canalTile ? waterOf(type) : [],
      ...(canalTile ? { variant: type, farVariant: 0 } : {}) }];
  }));
  return { tiles, coarseFamilies: COARSE_FAMILIES, seam: stringLights };
}

/** Hooks run at the same points in the generic plot construction as the original pilot. */
export const nightMarketPlot = {
  builders: layout => nightMarketBuilders(layout.builders),
  lanternBake: { gain: 0.8, radius: 1.5, cut: 3 },
  models(parts, kit, layout) {
    // OP1: the gate's lanterns are the hero paper lantern when the kit has it (its scale is the layout's heroScale)
    const hero = kit.has?.('hero') === true;
    placePlotModels(parts, kit, (layout.landmark.lanterns ?? []).map(at => hero
      ? { family: 'hero', variant: 0, at, scale: layout.landmark.heroScale ?? 2 }
      : { family: 'strings', variant: 1, at, scale: layout.landmark.lanternScale ?? 1 }), COARSE_FAMILIES);
  },
  pools(parts, palette) {
    const lit = { Pool: parts.Pool }, plotWriter = { triColours: (part, a, b, c, colours) => lit[part].triColours(part, [a, b, c], colours) };
    pool(plotWriter, 0, 0, 30, palette.gatePool, 0.09);
    for (let i = 0; i < 6; i++) { const a = (i + 0.5) / 6 * Math.PI * 2; pool(plotWriter, 16 * Math.sin(a), 16 * Math.cos(a), 10, palette.gatePool, 0.1); }
  },
};
