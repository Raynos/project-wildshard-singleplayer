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
function writer(parts, centre, turns) {
  const turn = ([x, y, z]) => {
    let px = x, pz = z;
    for (let i = 0; i < turns; i++) [px, pz] = [pz, -px];
    return [centre[0] + px, y, centre[1] + pz];
  };
  const tri = (part, a, b, c, colour) => parts[part].tri(part, turn(a), turn(b), turn(c), colour);
  const triColours = (part, a, b, c, colours) => parts[part].triColours(part, [turn(a), turn(b), turn(c)], colours);
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
  /** an up-facing rectangle at height y */
  const floor = (part, x0, z0, x1, z1, y, colour) => quad(part, [x0, y, z0], [x0, y, z1], [x1, y, z1], [x1, y, z0], colour);
  /** a collision box (tile-local, turned) */
  const solid = (min, max) => {
    const a = turn(min), b = turn(max);
    parts.solid.box('Solid', [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])], [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])]);
  };
  return { tri, triColours, quad, box, floor, solid };
}

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
/** A lantern on a post (post in Kit, the lantern lit) and its pool of light. */
function lantern(w, x, z, p, height = 2.8) {
  w.box('Kit', [x - 0.09, 0, z - 0.09], [x + 0.09, height, z + 0.09], p.wood);
  w.box('Glow', [x - 0.3, height, z - 0.3], [x + 0.3, height + 0.75, z + 0.3], p.lantern, p.lantern);
  pool(w, x, z, 4.5, p.pool);
}
/** A low-poly tree: trunk and a faceted crown (two hexagonal cones back to back). */
function tree(w, x, z, size, p, spin) {
  w.box('Kit', [x - 0.25, 0, z - 0.25], [x + 0.25, size * 0.45, z + 0.25], p.trunk);
  frustum(w, 'Kit', x, z, 6, size * 0.42, 0, size * 0.62, size * 1.1, p.foliage, spin);
  frustum(w, 'Kit', x, z, 6, size * 0.42, 0, size * 0.62, size * 0.32, p.foliageDark, spin);
  w.solid([x - 0.3, 0, z - 0.3], [x + 0.3, 3, z + 0.3]);
}

/** H house court: a hall across the north, two wings, a court open to the south with its tree; `variant` turns the roofs. */
function house(w, p, variant) {
  const wall = 4.6, roof = variant === 0 ? 4.2 : 3.2;
  const blocks = variant === 0
    ? [[-22, 22, 9, 24], [-24, -13, -22, 6], [13, 24, -22, 6]]
    : [[-22, 22, 12, 24], [-23, -12, -22, 9], [12, 23, -22, 9], [-6, 6, -24, -18]];
  for (const [x0, x1, z0, z1] of blocks) {
    w.box('Kit', [x0, 0, z0], [x1, wall, z1], p.wall);
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
}
/** G garden: four lawns between cross paths, trees, a pond in the south-east lawn, lanterns along the paths. */
function garden(w, p, variant) {
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
    const spots = index % 2 === 0 ? [[0.3, 0.3], [0.72, 0.4], [0.45, 0.75]] : [[0.3, 0.68], [0.7, 0.7], [0.55, 0.28]];
    for (const [i, [u, v]] of spots.entries()) tree(w, x0 + (x1 - x0) * u, z0 + (z1 - z0) * v, 6 + i, p, i * 0.7 + index);
  }
  for (const [x, z] of [[-1.6, 12], [1.6, -12], [12, 1.6], [-12, -1.6]]) lantern(w, x, z, p, 2.2);
}
/** S stall row: five red stalls along the west side facing east, lanterns before them, crates on the open paving. */
function stalls(w, p) {
  for (let i = 0; i < 5; i++) {
    const z = -22 + i * 11, x0 = -26, x1 = -16;
    w.box('Kit', [x0 + 1, 0, z - 3.6], [x1 - 2, 1.1, z + 3.6], p.wood);
    for (const [x, zz] of [[x0, z - 4], [x1, z - 4], [x0, z + 4], [x1, z + 4]]) w.box('Kit', [x - 0.15, 0, zz - 0.15], [x + 0.15, 3, zz + 0.15], p.wood);
    // a gable roof, red, its ridge north-south
    const h = 3, ridge = 4.6, xm = (x0 + x1) / 2;
    w.quad('Kit', [x0 - 0.6, h, z + 4.6], [xm, ridge, z + 4.6], [xm, ridge, z - 4.6], [x0 - 0.6, h, z - 4.6], p.stall);
    w.quad('Kit', [x1 + 0.6, h, z - 4.6], [xm, ridge, z - 4.6], [xm, ridge, z + 4.6], [x1 + 0.6, h, z + 4.6], p.stall);
    w.tri('Kit', [x0 - 0.6, h, z - 4.6], [xm, ridge, z - 4.6], [x1 + 0.6, h, z - 4.6], p.stallDark);
    w.tri('Kit', [x1 + 0.6, h, z + 4.6], [xm, ridge, z + 4.6], [x0 - 0.6, h, z + 4.6], p.stallDark);
    w.box('Glow', [x1 - 0.2, 2.2, z - 0.25], [x1 + 0.3, 2.7, z + 0.25], p.lantern, p.lantern);
    // NM7: the awning lit from within (its underside glows warm) and a lantern string along its open eave
    w.quad('Glow', [x0 - 0.4, h - 0.05, z - 4.4], [x1 + 0.4, h - 0.05, z - 4.4], [x1 + 0.4, h - 0.05, z + 4.4], [x0 - 0.4, h - 0.05, z + 4.4], p.awning);
    for (const dz of [-3.3, -1.1, 1.1, 3.3]) w.box('Glow', [x1 + 0.35, h - 0.55, z + dz - 0.18], [x1 + 0.7, h - 0.15, z + dz + 0.18], p.lantern, p.lantern);
    pool(w, x1 + 2, z, 5.5, p.pool);
    w.solid([x0 + 1, 0, z - 3.6], [x1 - 2, 1.1, z + 3.6]);
    lantern(w, -12, z + 5.5, p);
  }
  for (const [x, z] of [[4, -16], [10, 2], [6, 18]]) { w.box('Kit', [x - 1, 0, z - 1], [x + 1, 1.2, z + 1], p.crate); w.solid([x - 1, 0, z - 1], [x + 1, 1.2, z + 1]); }
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
  // rims along the inner banks (never across a border: the lanes cross on the bridges)
  const rimRuns = type === 'C'
    ? [[-half - rim, -INNER, -half, INNER], [half, -INNER, half + rim, INNER]]
    : [[-half - rim, -INNER, -half, half + rim], [-half - rim, half, INNER, half + rim], [half, -INNER, half + rim, -half], [half, -half - rim, INNER, -half]];
  for (const [x0, z0, x1, z1] of rimRuns) { w.box('Kit', [x0, 0, z0], [x1, rimHeight, z1], p.stone, p.stoneTop); w.solid([x0, 0, z0], [x1, rimHeight, z1]); }
  // half of an 8 m arched bridge in every wet border: the lane runs across the canal on it
  const borders = type === 'C' ? [0, 2] : [1, 2];
  for (const side of borders) halfBridge(w, p, side);
  // the banks: a row of trees and lanterns
  const banks = type === 'C' ? [[-17, -18], [-17, 0], [-17, 18], [17, -18], [17, 0], [17, 18]] : [[-17, -18], [-17, 18], [0, 20], [18, 20], [18, -18]];
  for (const [i, [x, z]] of banks.entries()) { if (i % 2 === 0) tree(w, x, z, 6, p, i); else lantern(w, x, z, p); }
  for (const z of [-INNER + 3, INNER - 3]) if (type === 'C') { lantern(w, -half - 2.4, z, p, 2.2); lantern(w, half + 2.4, z, p, 2.2); }
}
/** Half of an arched bridge in the border on `side` (0 N, 1 E, 2 S at rotation 0; the canal crosses that border). */
function halfBridge(w, p, side) {
  const { rise, half, deck, steps } = BRIDGE;
  // built for the north border (the lane runs east-west over z in [INNER, HALF]), then turned for the others
  const turnPoint = ([x, y, z]) => { let px = x, pz = z; for (let i = 0; i < side; i++) [px, pz] = [pz, -px]; return [px, y, pz]; };
  const at = (u) => { const x = -half + 2 * half * u; return [x, rise * Math.sin(Math.PI * u)]; };
  for (let i = 0; i < steps; i++) {
    const [xa, ya] = at(i / steps), [xb, yb] = at((i + 1) / steps);
    const q = (a, b, c, d, colour) => w.quad('Kit', turnPoint(a), turnPoint(b), turnPoint(c), turnPoint(d), colour);
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
}

/** The far stand-in per tile (<= 40 triangles): its ground and the blocks that read from far away. */
function farTile(w, p, type) {
  const ground = { H: p.court, G: p.lawn, S: p.paving, C: p.paving, L: p.paving, N: p.forecourt, P: p.plaza }[type] ?? p.paving;
  w.floor('far', -HALF, -HALF, HALF, HALF, 0, ground);
  if (type === 'H') { w.box('far', [-22, 0, 9], [22, 8, 24], p.roof); w.box('far', [-24, 0, -22], [24, 7, 6], p.roof); }
  if (type === 'G') { w.box('far', [-20, 0, 6], [20, 7, 20], p.foliage); w.box('far', [-20, 0, -20], [0, 7, -6], p.foliage); }
  if (type === 'S') w.box('far', [-26, 0, -26], [-16, 4.6, 26], p.stall);
  if (type === 'C' || type === 'L') for (const [x0, z0, x1, z1] of waterOf(type)) w.floor('far', x0, z0, x1, z1, 0.05, p.water);
  if (type === 'N') { w.box('far', [-26, 0, -26], [-22, 4, 20], p.foliage); w.box('far', [-26, 0, -26], [20, 4, -22], p.foliage); }
}

/** Every tile's border paving is the plot's (the generator's ground); a builder fills only its inner square. */
const BUILDERS = { H: house, G: garden, S: stalls, C: canal, L: canal, N: forecourt, P: plaza };

/**
 * Build the whole layout into `parts` ({ Kit, Glow, far, solid } soups): tile (column c, row r) has its centre at
 * x = -250 + 62.5 (c + 0.5), z = 250 - 62.5 (r + 0.5) (row 1 north). `seed(r, c)` picks a variant for H and G.
 */
export function buildLayout(grid, parts, p, seed) {
  checkLayout(grid);
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const { type, turns } = grid[r][c], centre = [-250 + TILE * (c + 0.5), 250 - TILE * (r + 0.5)];
    const w = writer(parts, centre, turns), build = BUILDERS[type];
    build(w, p, type === 'C' || type === 'L' ? type : seed(r, c));
    farTile(w, p, type);
    // NM7: string lights over the lanes between tiles (each tile strings its north and east seams when they are inside the
    // plot), on posts at the lane crossings' corners
    const plot = writer(parts, centre, 0); // the seams run in plot axes, whatever the tile's turn
    if (r > 0) stringLights(plot, p, 0);
    if (c < 7) stringLights(plot, p, 1);
  }
}

/** The lane on a tile's north (side 0) or east (side 1) seam: two strings of bulbs 3 m either side of the seam, sagging
 *  between posts at the crossings' corners, the bulbs alternating gold and red (Glow, merged into the tile's glow draw). */
function stringLights(w, p, side) {
  const along = (u, off, y) => (side === 0 ? [u, y, HALF + off] : [HALF + off, y, -u]);
  const ends = [-HALF + 4, HALF - 4], top = 6.2, sag = 1.4, step = 2.5, bulb = 0.16;
  for (const off of [-3, 3]) {
    for (const u of ends) {
      const [x, , z] = along(u, off, 0);
      w.box('Kit', [x - 0.12, 0, z - 0.12], [x + 0.12, top + 0.3, z + 0.12], p.wood);
      w.solid([x - 0.15, 0, z - 0.15], [x + 0.15, top, z + 0.15]);
    }
    const span = ends[1] - ends[0], count = Math.floor(span / step);
    for (let i = 1; i < count; i++) {
      const t = i / count, u = ends[0] + span * t, y = top - sag * 4 * t * (1 - t), [x, , z] = along(u, off, y);
      w.box('Glow', [x - bulb, y - bulb, z - bulb], [x + bulb, y + bulb, z + bulb], i % 2 === 0 ? p.lantern : p.bulbRed, i % 2 === 0 ? p.lantern : p.bulbRed);
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
