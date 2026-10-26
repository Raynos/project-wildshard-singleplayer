// G641 (Night Market pilot NM1): an open plot built from a 7-tile kit on an exact 8 x 8 grid of 62.5 m tiles (one per L0
// streaming tile). The layout is data (data/layouts/<idea>.json: eight rows of letter + quarter turns clockwise, north row
// first, west column first); each letter is a small code builder in tile-local metres (x east, z north, the tile's centre at
// the origin, rotation 0 as drawn on art/grid/round-50-night-market-tiles/02-tile-kit-board.jpg). Every tile has the same
// 4 m paved border, so any tile meets any tile at any turn and the lanes between tiles are 8 m; a canal edge (`w`) meets a
// canal edge, and where a canal crosses a border each tile builds its half of an 8 m arched bridge.
//
// A builder writes into four parts: `Kit` (lit, vertex colours), `Glow` (emissive, vertex colours: lanterns and windows),
// `solid` (collision boxes) and `far` (the far proxy's own stand-in, <= 40 triangles a tile in palette colours). Nothing
// here reads a file; the palette arrives as linear RGB.

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalize = (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** Plain triangle soup builder: positions, normals, colours, uvs, by material. */
export class Soup {
  constructor() { this.parts = new Map(); }
  part(name) { let p = this.parts.get(name); if (p === undefined) { p = { positions: [], normals: [], colours: [], uvs: [] }; this.parts.set(name, p); } return p; }
  /** @param {string} name @param {number[]} a @param {number[]} b @param {number[]} c @param {number[]} [colour] @param {number[][] | null} [uv] */
  tri(name, a, b, c, colour = [1, 1, 1], uv = null) {
    const p = this.part(name), e1 = sub(b, a), e2 = sub(c, a), n = normalize(cross(e1, e2));
    for (const [i, v] of [a, b, c].entries()) { p.positions.push(...v); p.normals.push(...n); p.colours.push(...colour); p.uvs.push(...(uv === null ? [0, 0] : uv[i])); }
  }
  /** a triangle with a colour per corner (a light pool's falloff) @param {string} name @param {number[][]} corners @param {number[][]} colours */
  triColours(name, [a, b, c], colours) {
    const p = this.part(name), n = normalize(cross(sub(b, a), sub(c, a)));
    for (const [i, v] of [a, b, c].entries()) { p.positions.push(...v); p.normals.push(...n); p.colours.push(...(colours[i] ?? [0, 0, 0])); p.uvs.push(0, 0); }
  }
  /** @param {string} name @param {number[]} a @param {number[]} b @param {number[]} c @param {number[]} d @param {number[]} [colour] @param {number[][] | null} [uv] */
  quad(name, a, b, c, d, colour, uv = null) { this.tri(name, a, b, c, colour, uv === null ? null : [uv[0], uv[1], uv[2]]); this.tri(name, a, c, d, colour, uv === null ? null : [uv[0], uv[2], uv[3]]); }
  /** an axis-aligned box from min to max, every face outward */
  box(name, min, max, colour) {
    const [x0, y0, z0] = min, [x1, y1, z1] = max;
    this.quad(name, [x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], colour);
    this.quad(name, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], colour);
    this.quad(name, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], colour);
    this.quad(name, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], colour);
    this.quad(name, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], colour);
    this.quad(name, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], colour);
  }
}

export const TILE = 62.5;
const HALF = TILE / 2;
const BORDER = 4;
const INNER = HALF - BORDER;
/** the canal's water half-width, its stone rim and how far the water sits below the paving */
// NM8: wide water as in the mockup (20 m), high arched bridges over it
const CANAL = { half: 10, rim: 0.8, rimHeight: 0.6, depth: 0.45 };
const BRIDGE = { rise: 2, half: 11.5, deck: 0.3, steps: 16 };

/** Parse a layout row set: eight strings of eight `<letter><turns>` pairs (north row first). */
export function parseLayout(rows) {
  if (!Array.isArray(rows) || rows.length !== 8) throw new Error('open-plots layout: eight rows');
  return rows.map((row, r) => {
    const cells = row.trim().split(/\s+/u);
    if (cells.length !== 8) throw new Error(`open-plots layout: row ${r + 1} needs eight tiles`);
    return cells.map((cell) => {
      const match = /^([HGSCLNP])([0-3])$/u.exec(cell);
      if (match === null) throw new Error(`open-plots layout: bad tile ${cell} in row ${r + 1}`);
      return { type: match[1], turns: Number(match[2]) };
    });
  });
}

/** Each type's canal edges at rotation 0 (N, E, S, W): a `w` edge must meet a `w` edge. */
const SOCKETS = { H: 'pppp', G: 'pppp', S: 'pppp', C: 'wpwp', L: 'pwwp', N: 'pppp', P: 'pppp' };
/** The edges of a turned tile: a quarter turn clockwise moves N to E. */
export function sockets(type, turns) {
  const base = SOCKETS[type] ?? 'pppp';
  return Array.from({ length: 4 }, (_, side) => base[(side - turns + 4) % 4]);
}
/** Refuse a layout whose canal edges don't meet (or run off the plot). */
export function checkLayout(grid) {
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const tile = grid[r][c], edge = sockets(tile.type, tile.turns);
    const neighbour = [[r - 1, c, 2], [r, c + 1, 3], [r + 1, c, 0], [r, c - 1, 1]];
    for (const [side, [nr, nc, facing]] of neighbour.entries()) {
      const other = grid[nr]?.[nc];
      const theirs = other === undefined ? 'p' : sockets(other.type, other.turns)[facing];
      if (edge[side] !== theirs) throw new Error(`open-plots layout: tile ${'ABCDEFGH'[c]}${r + 1} ${'NESW'[side]} edge ${edge[side]} meets ${theirs}`);
    }
  }
}

/** A tile's writer: every point is tile-local, turned `turns` quarter turns clockwise and moved to the tile's centre. */
function writer(parts, centre, turns, kit) {
  const turn = ([x, y, z]) => {
    let px = x, pz = z;
    for (let i = 0; i < turns; i++) [px, pz] = [pz, -px];
    return [centre[0] + px, y, centre[1] + pz];
  };
  const tri = (part, a, b, c, colour) => parts[part].tri(part, turn(a), turn(b), turn(c), colour);
  const triColours = (part, a, b, c, colours) => parts[part].triColours(part, [turn(a), turn(b), turn(c)], colours);
  // Preserve authored GLB normals rather than deriving a new face normal from float-rounded positions.
  const triChannels = (part, points, colours, normals, uvs) => {
    let directions = normals;
    if (directions === null) { const n = normalize(cross(sub(points[1], points[0]), sub(points[2], points[0]))); directions = [n, n, n]; }
    const target = parts[part].part(part);
    for (let i = 0; i < 3; i++) {
      target.positions.push(...turn(points[i])); target.colours.push(...colours[i]);
      const [x, y, z] = directions[i]; let nx = x, nz = z;
      for (let n = 0; n < turns; n++) [nx, nz] = [nz, -nx];
      target.normals.push(nx, y, nz); target.uvs.push(...(uvs === null ? [0, 0] : uvs[i]));
    }
  };
  const quad = (part, a, b, c, d, colour) => { tri(part, a, b, c, colour); tri(part, a, c, d, colour); };
  /** an axis-aligned box, every face outward; `open` leaves out the bottom */
  const box = (part, [x0, y0, z0], [x1, y1, z1], colour, top = colour, open = true) => {
    quad(part, [x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], top);
    if (!open) quad(part, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], colour);
    quad(part, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], colour);
    quad(part, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], colour);
    quad(part, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], colour);
    quad(part, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], colour);
  };
  /** `box`'s four sides only, for a box whose top is always covered (a post under its lantern, a trunk inside its crown,
   *  a wall under its roof's closed underside): NM12, the triangles the court greens and canal glow add come back here */
  const sides = (part, [x0, y0, z0], [x1, y1, z1], colour) => {
    quad(part, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], colour);
    quad(part, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], colour);
    quad(part, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], colour);
    quad(part, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], colour);
  };
  /** an up-facing rectangle at height y */
  const floor = (part, x0, z0, x1, z1, y, colour) => quad(part, [x0, y, z0], [x0, y, z1], [x1, y, z1], [x1, y, z0], colour);
  /** a collision box (tile-local, turned) */
  const solid = (min, max) => {
    const a = turn(min), b = turn(max);
    parts.solid.box('Solid', [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])], [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])]);
  };
  const lanternEmitter = kit?.lanternEmitter === undefined ? undefined
    : (at, colour) => kit.lanternEmitter(turn(at), [...colour]);
  const w = { tri, triColours, triChannels, quad, box, sides, floor, solid, lanternEmitter, placeModel: undefined, hasModel: () => false };
  // RM4: a kit model (kitGlb.mjs) at tile-local (x, z), through this writer's turn and lantern bake; a builder uses its
  // family's models only when the kit placed has that family (the layout's kit)
  if (kit?.placeModel !== undefined) {
    w.placeModel = (family, variant, x, z, options) => kit.placeModel(w, family, variant, x, z, options);
    w.hasModel = (family) => kit.has(family);
  }
  return w;
}
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
/** A hip roof over [x0, x1] x [z0, z1] from eave height h, rising `rise`, its ridge along the longer side; closed below. */
function hipRoof(w, x0, x1, z0, z1, h, rise, colour, under) {
  const width = x1 - x0, depth = z1 - z0, top = h + rise;
  if (width >= depth) {
    const zc = (z0 + z1) / 2, r0 = x0 + depth / 2, r1 = x1 - depth / 2;
    w.quad('Kit', [x0, h, z0], [r0, top, zc], [r1, top, zc], [x1, h, z0], colour);
    w.quad('Kit', [x1, h, z1], [r1, top, zc], [r0, top, zc], [x0, h, z1], colour);
    w.tri('Kit', [x0, h, z1], [r0, top, zc], [x0, h, z0], colour);
    w.tri('Kit', [x1, h, z0], [r1, top, zc], [x1, h, z1], colour);
  } else {
    const xc = (x0 + x1) / 2, r0 = z0 + width / 2, r1 = z1 - width / 2;
    w.quad('Kit', [x0, h, z1], [xc, top, r1], [xc, top, r0], [x0, h, z0], colour);
    w.quad('Kit', [x1, h, z0], [xc, top, r0], [xc, top, r1], [x1, h, z1], colour);
    w.tri('Kit', [x0, h, z0], [xc, top, r0], [x1, h, z0], colour);
    w.tri('Kit', [x1, h, z1], [xc, top, r1], [x0, h, z1], colour);
  }
  w.quad('Kit', [x0, h, z0], [x1, h, z0], [x1, h, z1], [x0, h, z1], under);
}
/** NM7: a pool of warm light on the ground (the additive Pool material: its colour fades to black at the rim, so it adds
 *  light and nothing else), an octagon fan just above the paving */
export function pool(w, x, z, radius, colour, y = 0.08) {
  for (let i = 0; i < 8; i++) {
    const a0 = i / 8 * Math.PI * 2, a1 = (i + 1) / 8 * Math.PI * 2;
    w.triColours('Pool', [x, y, z], [x + radius * Math.sin(a0), y, z + radius * Math.cos(a0)], [x + radius * Math.sin(a1), y, z + radius * Math.cos(a1)], [colour, [0, 0, 0], [0, 0, 0]]);
  }
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
/** A firefly: a 7 cm mover the glow graph wanders (+-0.8 m) and blinks green. */
function firefly(w, x, y, z) { placeMovingLight(w, 'firefly', [x, y, z]); }
/** A floating sky lantern: a 0.5 m mover the glow graph bobs and drifts (+-2 m), lit orange. */
function skyLantern(w, x, y, z) { placeMovingLight(w, 'sky-lantern', [x, y, z]); }
/** One moving light: consumes the next seed and writes its marked tetrahedron. */
function placeMovingLight(w, kind, position) {
  if (!['firefly', 'sky-lantern'].includes(kind) || !Array.isArray(position) || position.length !== 3
    || position.some(value => !Number.isFinite(value))) throw new Error('open-plots: invalid moving light');
  const seed = nextSeed() * 0.5;
  mover(w, position[0], position[1], position[2], kind === 'firefly' ? 0.07 : 0.35, kind === 'firefly' ? seed : 0.5 + seed);
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
/** G garden: four lawns between cross paths, trees, a pond in the south-east lawn, lanterns along the paths. */
function garden(w, p, variant) {
  kerbRing(w, p, { n: 3, e: 3, s: 3, w: 3 });
  const lawns = [[-26, -3, 3, 26], [3, 26, 3, 26], [-26, -3, -26, -3], [3, 26, -26, -3]];
  for (const [index, [x0, x1, z0, z1]] of lawns.entries()) {
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
    const spots = index % 2 === 0 ? [[0.3, 0.3], [0.72, 0.4], [0.45, 0.75]] : [[0.3, 0.68], [0.7, 0.7], [0.55, 0.28]];
    for (const [i, [u, v]] of spots.entries()) {
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
    w.solid([x - 1.4, 0, z - 0.9], [x + 1.4, 1.3, z + 0.9]);
  }
}
/** RM4.2: the S tile from the kit's stall models (opt-in, the layout's kit): ten stalls a side every 5.5 m
 *  facing the aisle (the hero stall and the red-roofed row stall, by place), a pool before every other one, and food carts
 *  staggered down the aisle; each model emits its own lanterns. */
function modelStalls(w, p) {
  for (const side of [-1, 1]) for (let i = 0; i < 10; i++) {
    const z = -24.75 + i * 5.5, x = side * 17.5;
    const kind = pick(x, z, 2), yaw = -side * Math.PI / 2;
    w.placeModel('stalls', kind, x, z, { yaw });
    w.solid([x - 1.5, 0, z - 2.1], [x + 1.5, 1.1, z + 2.1]);
    // RM4.8 (opt-in): a vendor behind every other hero stall's counter, facing out with it; a shopper before every fourth
    // stall (RM8.5: an S tile with every family on stays under 15k triangles)
    if (w.hasModel('figures')) {
      if (kind === 0 && i % 2 === 0) w.placeModel('figures', 0, x - side * 0.2, z, { yaw });
      if (i % 4 === 1) w.placeModel('figures', pick(x, z, 2, 3) + 1, x - side * 2.6, z + 0.6, { yaw: yaw + Math.PI });
    }
    if (i % 2 === 0) pool(w, x - side * 3.4, z + 2.75, 5, p.pool);
    // RM4.6 (opt-in): goods waiting behind every other stall
    if (i % 2 === 1 && w.hasModel('props')) { w.placeModel('props', 2, side * 20.6, z, { yaw: -side * Math.PI / 2 }); w.solid([side * 20.6 - 0.7, 0, z - 0.7], [side * 20.6 + 0.7, 0.8, z + 0.7]); }
  }
  for (let i = 0; i < 4; i++) {
    const z = -16.5 + i * 11, x = i % 2 === 0 ? -4 : 4;
    w.placeModel('stalls', 2, x, z, { yaw: i % 2 === 0 ? Math.PI / 2 : -Math.PI / 2 });
    w.solid([x - 0.8, 0, z - 1.3], [x + 0.8, 1.1, z + 1.3]);
    pool(w, x, z, 4, p.pool);
  }
}
/** The water region of a canal tile at rotation 0, as rectangles (x0, z0, x1, z1); `C` runs north-south, `L` south to east. */
function waterOf(type) {
  const { half } = CANAL;
  if (type === 'C') return [[-half, -HALF, half, HALF]];
  return [[-half, -HALF, half, half], [-half, -half, HALF, half]];
}
/** C / L canal: recessed water between stone walls and rims, trees and lanterns on the banks, half a bridge per wet border. */
function canal(w, p, type) {
  const rects = waterOf(type);
  const { half, rim, rimHeight, depth } = CANAL;
  // the water and its walls, each walked with the water on its left so it faces the water
  for (const [x0, z0, x1, z1] of rects) w.floor('Water', x0, z0, x1, z1, -depth, p.water);
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
function forecourt(w, p) {
  w.box('Kit', [-26, 0, -26], [-22, 1, 20], p.hedge, p.lawn); w.box('Kit', [-26, 0, -26], [20, 1, -22], p.hedge, p.lawn);
  w.solid([-26, 0, -26], [-22, 1, 20]); w.solid([-26, 0, -26], [20, 1, -22]);
  for (let i = 0; i < 6; i++) { tree(w, -24, -18 + i * 7, 4.2, p, i); }
  for (let i = 1; i < 6; i++) tree(w, -18 + i * 7, -24, 4.2, p, i + 3);
  for (let i = 0; i < 6; i++) { const a = Math.PI + (i + 0.5) / 6 * Math.PI / 2, r = 26; lantern(w, HALF + r * Math.cos(a), HALF + r * Math.sin(a), p, 2.6); }
  w.floor('Kit', -22, -22, 27, 27, 0.03, p.forecourt);
  // NM9: a little market of kiosks on the forecourt's open paving, clear of the entry corner
  for (const [x, z] of [[-12, -12], [-2, -12], [8, -12], [-12, -2], [-12, 8], [-2, -2]]) {
    w.box('Kit', [x - 2, 0, z - 2], [x + 2, 1.1, z + 2], p.wood);
    for (const [dx, dz] of [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]]) w.box('Kit', [x + dx - 0.12, 0, z + dz - 0.12], [x + dx + 0.12, 3, z + dz + 0.12], p.wood);
    frustum(w, 'Kit', x, z, 4, 3.6, 0, 3, 4.6, p.stall, Math.PI / 4);
    w.lanternEmitter?.([x, 2.5, z], [...p.lantern]);
    w.box('Glow', [x - 0.25, 2.2, z - 0.25], [x + 0.25, 2.8, z + 0.25], p.lantern, p.lantern);
    pool(w, x, z, 4.5, p.pool);
    w.solid([x - 2, 0, z - 2], [x + 2, 1.1, z + 2]);
  }
}
/** P plaza quarter: the plaza's paving with rings of lanterns about its centre corner (south-east), a planter far from it. */
function plaza(w, p) {
  w.floor('Kit', -HALF + 0.02, -HALF + 0.02, HALF - 0.02, HALF - 0.02, 0.03, p.plaza);
  // the rings stay clear of the gate (its half-width ~26 m) and of the seams (the plaza board stands on one)
  for (const [r, n] of [[36, 4], [52, 6]]) for (let i = 0; i < n; i++) {
    const a = Math.PI / 2 + (i + 0.5) / n * Math.PI / 2;
    lantern(w, HALF + r * Math.cos(a), -HALF + r * Math.sin(a), p, 2.6);
  }
  w.box('Kit', [-27, 0, 19], [-19, 0.8, 27], p.stone, p.lawn); w.solid([-27, 0, 19], [-19, 0.8, 27]);
  tree(w, -23, 23, 6.5, p, 1);
  // RM4.6 (opt-in): a flower planter beside each inner-ring lantern, benches between the outer ring's facing the gate
  if (w.hasModel('props')) {
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 2 + (i + 0.5) / 4 * Math.PI / 2, x = HALF + 37.8 * Math.cos(a), z = -HALF + 37.8 * Math.sin(a);
      w.placeModel('props', 0, x, z); w.solid([x - 0.9, 0, z - 0.9], [x + 0.9, 0.65, z + 0.9]);
    }
    for (let i = 1; i < 6; i++) {
      const a = Math.PI / 2 + i / 6 * Math.PI / 2, x = HALF + 50 * Math.cos(a), z = -HALF + 50 * Math.sin(a);
      w.placeModel('props', 1, x, z, { yaw: Math.atan2(HALF - x, -HALF - z) }); w.solid([x - 0.8, 0, z - 0.8], [x + 0.8, 0.5, z + 0.8]);
    }
  }
  // RM8.4: r7's plaza beds, a raised lawn either side of each lane into the gate (the gate's corner is (HALF, -HALF)):
  // one along the tile's east lane, one along its south; with the kit, round trees on them and lanterns at their outer
  // corners (RM8.5: planters at their ends put a plaza tile over 15k triangles with every family on)
  for (const [x0, z0, x1, z1] of [[HALF - 16, -HALF + 16, HALF - 9, -HALF + 34], [HALF - 34, -HALF + 9, HALF - 16, -HALF + 16]]) {
    w.box('Kit', [x0, 0, z0], [x1, 0.45, z1], p.stone, p.lawn); w.solid([x0, 0, z0], [x1, 0.45, z1]);
    const along = z1 - z0 > x1 - x0, mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    if (w.hasModel('trees')) for (const t of [-0.25, 0.25]) {
      const [x, z] = along ? [mx, mz + t * (z1 - z0)] : [mx + t * (x1 - x0), mz];
      w.placeModel('trees', 0, x, z, { y: 0.45, yaw: x + z, scale: 6.5 * 1.1 / 8 }); w.solid([x - 0.3, 0.45, z - 0.3], [x + 0.3, 3, z + 0.3]);
    }
    if (w.hasModel('lanterns')) for (const [x, z] of along ? [[x0 - 0.8, z0], [x0 - 0.8, z1]] : [[x0, z1 + 0.8], [x1, z1 + 0.8]]) lantern(w, x, z, p, 2.6);
  }
  // NM10: a few sky lanterns floating over the plaza
  for (const [x, y, z] of [[-14, 22, -8], [6, 31, 12], [16, 40, -18]]) skyLantern(w, x, y, z);
}

/** The far stand-in per tile (<= 40 triangles): its ground and the blocks that read from far away. */
function farTile(w, p, type) {
  const ground = { H: p.court, G: p.lawn, S: p.paving, C: p.paving, L: p.paving, N: p.forecourt, P: p.plaza }[type] ?? p.paving;
  w.floor('far', -HALF, -HALF, HALF, HALF, 0, ground);
  if (type === 'H') { w.box('far', [-22, 0, 9], [22, 8, 24], p.roof); w.box('far', [-24, 0, -22], [24, 7, 6], p.roof); }
  if (type === 'G') { w.box('far', [-20, 0, 6], [20, 7, 20], p.foliage); w.box('far', [-20, 0, -20], [0, 7, -6], p.foliage); }
  if (type === 'S') { w.box('far', [-27, 0, -27], [-15, 5.6, 27], p.stall); w.box('far', [15, 0, -27], [27, 5.6, 27], p.stall); }
  if (type === 'C' || type === 'L') for (const [x0, z0, x1, z1] of waterOf(type)) w.floor('far', x0, z0, x1, z1, 0.05, p.water);
  if (type === 'N') { w.box('far', [-26, 0, -26], [-22, 4, 20], p.foliage); w.box('far', [-26, 0, -26], [20, 4, -22], p.foliage); }
}

/** Every tile's border paving is the plot's (the generator's ground); a builder fills only its inner square. */
const BUILDERS = { H: house, G: garden, S: stalls, C: canal, L: canal, N: forecourt, P: plaza };

/**
 * Build the whole layout into `parts` ({ Kit, Glow, far, solid } soups): tile (column c, row r) has its centre at
 * x = -250 + 62.5 (c + 0.5), z = 250 - 62.5 (r + 0.5) (row 1 north). `seed(r, c)` picks a variant for H and G; `kit`
 * brings the models (kitGlb.mjs `prepareModelKit`) and the lantern bake's emitter sink.
 */
export function buildLayout(grid, parts, p, seed, kit) {
  checkLayout(grid);
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const { type, turns } = grid[r][c], centre = [-250 + TILE * (c + 0.5), 250 - TILE * (r + 0.5)];
    const w = writer(parts, centre, turns, kit);
    BUILDERS[type](w, p, type === 'C' || type === 'L' ? type : seed(r, c));
    farTile(w, p, type);
    // NM7: string lights over the lanes between tiles (each tile strings its north and east seams when they are inside the
    // plot), on posts at the lane crossings' corners
    const plot = writer(parts, centre, 0, kit); // the seams run in plot axes, whatever the tile's turn
    if (r > 0) stringLights(plot, p, 0, centre);
    if (c < 7) stringLights(plot, p, 1, centre);
  }
}

/** RM9.2: kit models at plot positions outside the tiles (the gate's hanging lanterns), each placed only when the kit has
 *  its family: `placements` rows of { family, variant, at: [x, y, z] plot metres, scale }. */
export function placePlotModels(parts, kit, placements) {
  const w = writer(parts, [0, 0], 0, kit);
  for (const { family, variant, at, scale } of placements) if (w.hasModel(family)) w.placeModel(family, variant, at[0], at[2], { y: at[1], scale });
}

/** Bake linear RGB into owned Kit colours with E = gain*(1-d²/(radius*cut)²)²/(1+d²/radius²).
 * The compact taper is Nine's falloff law, evaluated at vertices without a runtime light or volume.
 * Neutral gain preserves old words exactly; RM6 owns visible tuning. Refusals never mutate input. */
export function bakeLanternVertices(part, lights, { gain, radius, cut }) {
  const triple = values => Array.isArray(values) && values.length === 3
    && Number.isFinite(values[0]) && Number.isFinite(values[1]) && Number.isFinite(values[2]);
  const rgb = values => triple(values) && values.every(value => value >= 0 && value <= 1);
  const radius2 = radius * radius, reach2 = (radius * cut) ** 2;
  if (!Number.isFinite(gain) || gain < 0 || !Number.isFinite(radius) || !Number.isFinite(cut)
    || !Number.isFinite(radius2) || radius <= 0 || radius2 === 0
    || !Number.isFinite(reach2) || cut <= 0 || reach2 === 0) throw new Error('open-plots light: invalid falloff');
  if (!Array.isArray(part.positions) || !Array.isArray(part.colours) || part.positions.length % 3 !== 0
    || part.positions.length !== part.colours.length) throw new Error('open-plots light: invalid vertices');
  for (let i = 0; i < part.positions.length; i++) {
    if (!Number.isFinite(part.positions[i]) || !Number.isFinite(part.colours[i]) || part.colours[i] < 0 || part.colours[i] > 1) {
      throw new Error('open-plots light: invalid vertices');
    }
  }
  if (!Array.isArray(lights)) throw new Error('open-plots light: invalid emitter');
  for (const light of lights) if (light === undefined || !triple(light.at) || !rgb(light.colour)) throw new Error('open-plots light: invalid emitter');
  const colours = part.colours.slice();
  if (gain === 0) return colours;
  for (let at = 0; at < part.positions.length; at += 3) {
    let r = 0, g = 0, b = 0;
    for (const light of lights) {
      const dx = part.positions[at] - light.at[0], dy = part.positions[at + 1] - light.at[1], dz = part.positions[at + 2] - light.at[2];
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= reach2) continue;
      const win = 1 - d2 / reach2, e = gain * win * win / (1 + d2 / radius2);
      r += light.colour[0] * e; g += light.colour[1] * e; b += light.colour[2] * e;
    }
    colours[at] = Math.min(1, colours[at] + r);
    colours[at + 1] = Math.min(1, colours[at + 1] + g);
    colours[at + 2] = Math.min(1, colours[at + 2] + b);
  }
  return colours;
}

/** The lane on a tile's north (side 0) or east (side 1) seam: two strings of bulbs 3 m either side of the seam, sagging
 *  between posts at the crossings' corners, the bulbs alternating gold and red (Glow, merged into the tile's glow draw). */
function stringLights(w, p, side, centre) {
  const along = (u, off, y) => (side === 0 ? [u, y, HALF + off] : [HALF + off, y, -u]);
  const ends = [-HALF + 4, HALF - 4], top = 6.2, sag = 1.4, step = 2.5, bulb = 0.16;
  // an entry's footprint (8 m wide, 15 m in from the plot's edge, on the x = 0 and z = 0 seams) stays clear above the road
  const clear = (x, z) => { const wx = centre[0] + x, wz = centre[1] + z, margin = 1.5;
    return (Math.abs(wx) < 4 + margin && Math.abs(wz) > 235 - margin) || (Math.abs(wz) < 4 + margin && Math.abs(wx) > 235 - margin); };
  // RM8.5: the kit's round bulbs hang every 3 m (the tetrahedra's 2.5 m with every family on put an S tile over 15k)
  if (w.hasModel('strings')) { modelStrings(w, p, along, ends, clear, top, sag, 3); return; }
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

/** RM4.3 (opt-in, the layout's kit): a seam's strings from the kit: a lane post with its banner along the lane
 *  at each crossing corner, a dark cord sagging between them, and round gold bulbs on it with a red paper lantern every
 *  fourth (each model emits its own light). */
function modelStrings(w, p, along, ends, clear, top, sag, step) {
  const yaw = along(1, 0, 0)[0] === 1 ? 0 : Math.PI / 2;
  for (const off of [-3, 3]) {
    for (const u of ends) {
      const [x, , z] = along(u, off, 0);
      if (clear(x, z)) continue;
      w.placeModel('strings', 2, x, z, { yaw });
      w.solid([x - 0.15, 0, z - 0.15], [x + 0.15, top, z + 0.15]);
    }
    const span = ends[1] - ends[0], count = Math.floor(span / step), cord = [];
    for (let i = 0; i <= count; i++) {
      const t = i / count, u = ends[0] + span * t, y = top - sag * 4 * t * (1 - t), point = along(u, off, y);
      if (i % 2 === 0 || i === count) cord.push(point);
      if (i === 0 || i === count || clear(point[0], point[2])) continue;
      w.placeModel('strings', i % 4 === 0 ? 1 : 0, point[0], point[2], { y: y - (i % 4 === 0 ? 0 : 0.16), yaw });
    }
    // the cord: a 5 cm ribbon between its points, both faces (seen from below on the lane and from above)
    for (let k = 0; k + 1 < cord.length; k++) {
      const a = cord[k], b = cord[k + 1];
      if (a === undefined || b === undefined || clear(a[0], a[2]) || clear(b[0], b[2])) continue;
      const across = yaw === 0 ? [0, 0, 0.025] : [0.025, 0, 0];
      const l = (q) => [q[0] - across[0], q[1], q[2] - across[2]], r = (q) => [q[0] + across[0], q[1], q[2] + across[2]];
      w.quad('Kit', l(a), r(a), r(b), l(b), p.wood); w.quad('Kit', l(b), r(b), r(a), l(a), p.wood);
    }
  }
}

/**
 * The plot's paving inside its outer ring (the generator draws the ring): rectangles [x0, z0, x1, z1, lane] in plot metres,
 * one per paved cell of each tile split at its border and its canal's water (left open: the canal draws its water below);
 * `lane` marks a border cell (the 8 m lanes between tiles), paved a shade lighter.
 */
export function paving(grid, ring) {
  const out = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const { type, turns } = grid[r][c], cx = -250 + TILE * (c + 0.5), cz = 250 - TILE * (r + 0.5);
    const water = type === 'C' || type === 'L' ? waterOf(type).map(([x0, z0, x1, z1]) => {
      let a = [x0, z0], b = [x1, z1];
      for (let i = 0; i < turns; i++) { a = [a[1], -a[0]]; b = [b[1], -b[0]]; }
      return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
    }) : [];
    const cuts = (axis) => [...new Set([-HALF, -INNER, INNER, HALF, ...water.flatMap((row) => [row[axis], row[axis + 2]])])].sort((a, b) => a - b);
    const xs = cuts(0), zs = cuts(1);
    for (let i = 0; i + 1 < xs.length; i++) for (let k = 0; k + 1 < zs.length; k++) {
      const mx = (xs[i] + xs[i + 1]) / 2, mz = (zs[k] + zs[k + 1]) / 2;
      if (water.some(([x0, z0, x1, z1]) => mx > x0 && mx < x1 && mz > z0 && mz < z1)) continue;
      const x0 = Math.max(-ring, cx + xs[i]), x1 = Math.min(ring, cx + xs[i + 1]), z0 = Math.max(-ring, cz + zs[k]), z1 = Math.min(ring, cz + zs[k + 1]);
      if (x1 > x0 && z1 > z0) out.push([x0, z0, x1, z1, Math.max(Math.abs(mx), Math.abs(mz)) > INNER]);
    }
  }
  return out;
}
