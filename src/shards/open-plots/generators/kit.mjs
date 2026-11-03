// Plot-agnostic triangle soups, turned grid writers, sockets, paving and light baking.
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
export const HALF = TILE / 2;
const BORDER = 4;
export const INNER = HALF - BORDER;
/** Parse a layout row set: eight strings of eight `<letter><turns>` pairs (north row first). */
export function parseLayout(rows, builders) {
  if (!Array.isArray(rows) || rows.length !== 8) throw new Error('open-plots layout: eight rows');
  return rows.map((row, r) => {
    const cells = row.trim().split(/\s+/u);
    if (cells.length !== 8) throw new Error(`open-plots layout: row ${r + 1} needs eight tiles`);
    return cells.map((cell) => {
      const match = /^([A-Z])([0-3])$/u.exec(cell);
      if (match === null || !Object.hasOwn(builders.tiles, match[1])) throw new Error(`open-plots layout: bad tile ${cell} in row ${r + 1}`);
      return { type: match[1], turns: Number(match[2]) };
    });
  });
}

/** The edges of a turned tile: a quarter turn clockwise moves N to E. */
export function sockets(type, turns, builders) {
  const base = builders.tiles[type].sockets;
  return Array.from({ length: 4 }, (_, side) => base[(side - turns + 4) % 4]);
}
/** Refuse a layout whose canal edges don't meet (or run off the plot). */
export function checkLayout(grid, builders) {
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const tile = grid[r][c], edge = sockets(tile.type, tile.turns, builders);
    const neighbour = [[r - 1, c, 2], [r, c + 1, 3], [r + 1, c, 0], [r, c - 1, 1]];
    for (const [side, [nr, nc, facing]] of neighbour.entries()) {
      const other = grid[nr]?.[nc];
      const theirs = other === undefined ? 'p' : sockets(other.type, other.turns, builders)[facing];
      if (edge[side] !== theirs) throw new Error(`open-plots layout: tile ${'ABCDEFGH'[c]}${r + 1} ${'NESW'[side]} edge ${edge[side]} meets ${theirs}`);
    }
  }
}

/** A tile's writer: every point is tile-local, turned `turns` quarter turns clockwise and moved to the tile's centre. */
function writer(parts, centre, turns, kit, coarseFamilies) {
  const turn = ([x, y, z]) => {
    let px = x, pz = z;
    for (let i = 0; i < turns; i++) [px, pz] = [pz, -px];
    return [centre[0] + px, y, centre[1] + pz];
  };
  // OP26 (the billboard review, Jake 11-03): the posters' keep-outs ([x0, z0, x1, z1] plot metres, tiledPlotCore's
  // keepOut). A model whose footprint meets one is left out (`refused`), and so is what this writer later draws inside a
  // left-out footprint (its collider, its L1 stand-in), so nothing invisible or half-placed stays by a board
  const zones = kit?.keepOut ?? [], refused = [], SLACK = 0.75;
  /** the plot-metre rectangle round tile-local points */
  const rect = (points) => {
    const out = [Infinity, Infinity, -Infinity, -Infinity];
    for (const p of points) { const [x, , z] = turn(p); out[0] = Math.min(out[0], x); out[1] = Math.min(out[1], z); out[2] = Math.max(out[2], x); out[3] = Math.max(out[3], z); }
    return out;
  };
  const meets = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
  const leftOut = (points) => {
    if (refused.length === 0) return false;
    const [x0, z0, x1, z1] = rect(points);
    return refused.some(r => x0 >= r[0] - SLACK && z0 >= r[1] - SLACK && x1 <= r[2] + SLACK && z1 <= r[3] + SLACK);
  };
  const tri = (part, a, b, c, colour) => { if (part === 'coarse' && leftOut([a, b, c])) return; parts[part].tri(part, turn(a), turn(b), turn(c), colour); };
  const triColours = (part, a, b, c, colours) => { if (part === 'coarse' && leftOut([a, b, c])) return; parts[part].triColours(part, [turn(a), turn(b), turn(c)], colours); };
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
    if (leftOut([[x0, 0, z0], [x1, 0, z1]])) return;
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
    if (leftOut([[x0, 0, z0], [x1, 0, z1]])) return;
    quad(part, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], colour);
    quad(part, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], colour);
    quad(part, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], colour);
    quad(part, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], colour);
  };
  /** an up-facing rectangle at height y */
  const floor = (part, x0, z0, x1, z1, y, colour) => quad(part, [x0, y, z0], [x0, y, z1], [x1, y, z1], [x1, y, z0], colour);
  /** a collision box (tile-local, turned) */
  const solid = (min, max) => {
    if (leftOut([min, max])) return;
    const a = turn(min), b = turn(max);
    parts.solid.box('Solid', [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])], [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])]);
  };
  const lanternEmitter = kit?.lanternEmitter === undefined ? undefined
    : (at, colour) => kit.lanternEmitter(turn(at), [...colour]);
  /** a plot-axes direction [x, z] in this tile's own axes (the turn undone): a sun-cast shadow's heading */
  const local = ([x, z]) => {
    let px = x, pz = z;
    for (let i = 0; i < turns; i++) [px, pz] = [-pz, px];
    return [px, pz];
  };
  /** whether a tile-local disc of radius `r` keeps clear of every keep-out (a builder asks before it draws round a model) */
  const clear = (x, z, r = 0) => { const at = rect([[x - r, 0, z - r], [x + r, 0, z + r]]); return !zones.some(zone => meets(zone, at)); };
  const w = { tri, triColours, triChannels, quad, box, sides, floor, solid, lanternEmitter, local, clear, placeModel: undefined, hasModel: () => false };
  // RM4: a kit model (kitGlb.mjs) at tile-local (x, z), through this writer's turn and lantern bake; a builder uses its
  // family's models only when the kit placed has that family (the layout's kit). It returns whether the model was placed.
  if (kit?.placeModel !== undefined) {
    w.placeModel = (family, variant, x, z, options) => {
      // OP26: a dry run measures the model's footprint; one that meets a keep-out is left out
      if (zones.length > 0) {
        const points = [];
        kit.placeModel({ triChannels: (_part, corners) => { points.push(...corners); } }, family, variant, x, z, options);
        const footprint = rect(points);
        if (zones.some(zone => meets(zone, footprint))) { refused.push(footprint); kit.leftOut?.push(`${family}/${variant}`); return false; }
      }
      // RM8.2: a model draws only in the full-detail (L0) tiles (the `detail` parts); a big one leaves its box at L1 (the
      // `coarse` part), its top the colour of its up-facing faces, its sides of the rest
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity], top = [0, 0, 0, 0], side = [0, 0, 0, 0];
      const detail = { ...w, triChannels: (part, points, colours, normals, uvs) => {
        w.triChannels(part === 'Glow' ? 'detailGlow' : 'detailKit', points, colours, normals, uvs);
        for (const p of points) for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i] ?? Infinity, p[i]); hi[i] = Math.max(hi[i] ?? -Infinity, p[i]); }
        if (part === 'Glow') return;
        const n = cross(sub(points[1], points[0]), sub(points[2], points[0])), area = Math.hypot(...n), sum = n[1] > 0.7 * area ? top : side;
        for (const c of colours) for (let i = 0; i < 3; i++) sum[i] += c[i] * area / 3;
        sum[3] += area;
      } };
      kit.placeModel(detail, family, variant, x, z, options);
      if (!coarseFamilies.has(family) || !(lo[0] < hi[0])) return true;
      const mean = (sum, other) => (sum[3] > 0 ? sum : other).slice(0, 3).map(v => v / Math.max(1e-9, (sum[3] > 0 ? sum : other)[3]));
      box('coarse', lo, hi, mean(side, top), mean(top, side));
      return true;
    };
    w.hasModel = (family) => kit.has(family);
  }
  return w;
}
/** NM7: a pool of warm light on the ground (the additive Pool material: its colour fades to black at the rim, so it adds
 *  light and nothing else), an octagon fan just above the paving */
export function pool(w, x, z, radius, colour, y = 0.08) {
  for (let i = 0; i < 8; i++) {
    const a0 = i / 8 * Math.PI * 2, a1 = (i + 1) / 8 * Math.PI * 2;
    w.triColours('Pool', [x, y, z], [x + radius * Math.sin(a0), y, z + radius * Math.cos(a0)], [x + radius * Math.sin(a1), y, z + radius * Math.cos(a1)], [colour, [0, 0, 0], [0, 0, 0]]);
  }
}
/**
 * Lantern reflections on still water (OB2, Lantern Bayou): a streak in the Pool part under each low emitter within
 * `reach` metres of water, at the water's level. It is a small quad at the emitter's foot whose uv carries its corner
 * (x: 1 + along in [0, 1], y: side +-1; every other Pool corner keeps uv 0): the streak pool graph
 * (data/poolStreaks.graph.json) stretches it toward the camera and shades it, in the Pool's own additive draw. The
 * boardwalks cover what reaches under them. Returns the number of streaks.
 */
export function waterStreaks(pools, water, emitters, { reach = 5, low = 8, lift = 0.03 } = {}) {
  const tris = [];
  for (let i = 0; i + 8 < water.positions.length; i += 9) {
    const p = water.positions, ys = [p[i + 1], p[i + 4], p[i + 7]];
    if (ys.some(y => y !== ys[0])) continue; // a bank or skirt, not the surface
    tris.push({ y: ys[0], a: [p[i], p[i + 2]], b: [p[i + 3], p[i + 5]], c: [p[i + 6], p[i + 8]] });
  }
  const segment = (x, z, [ax, az], [bx, bz]) => {
    const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    return Math.hypot(x - ax - t * dx, z - az - t * dz);
  };
  const inside = (x, z, { a, b, c }) => {
    const s = (p, q) => (q[0] - p[0]) * (z - p[1]) - (q[1] - p[1]) * (x - p[0]), d1 = s(a, b), d2 = s(b, c), d3 = s(c, a);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
  };
  const part = pools.part('Pool');
  let count = 0;
  for (const { at: [x, y, z], colour } of emitters) {
    const near = tris.find(t => y - t.y < low && (inside(x, z, t) || Math.min(segment(x, z, t.a, t.b), segment(x, z, t.b, t.c), segment(x, z, t.c, t.a)) < reach));
    if (near === undefined) continue;
    const h = near.y + lift, corner = (along, side) => [x + side * 0.1, h, z + along * 0.1];
    for (const [along, side] of [[0, -1], [1, -1], [1, 1], [0, -1], [1, 1], [0, 1]]) {
      part.positions.push(...corner(along, side)); part.normals.push(0, 1, 0); part.colours.push(...colour); part.uvs.push(1 + along, side);
    }
    count++;
  }
  return count;
}

/**
 * Build the whole layout into `parts` ({ Kit, Glow, far, solid } soups): tile (column c, row r) has its centre at
 * x = -250 + 62.5 (c + 0.5), z = 250 - 62.5 (r + 0.5) (row 1 north). The plot supplies its tile builders,
 * sockets, far stand-ins, optional variants/seams and coarse-family policy; `kit` brings models and an emitter sink.
 */
export function buildLayout(grid, parts, p, seed, kit, builders) {
  checkLayout(grid, builders);
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const { type, turns } = grid[r][c], centre = [-250 + TILE * (c + 0.5), 250 - TILE * (r + 0.5)];
    const w = writer(parts, centre, turns, kit, builders.coarseFamilies);
    const tile = builders.tiles[type];
    tile.build(w, p, tile.variant ?? seed(r, c));
    tile.far(w, p, tile.farVariant ?? seed(r, c));
    // Each interior north/east seam is authored once, in plot axes rather than the tile's turn.
    const plot = writer(parts, centre, 0, kit, builders.coarseFamilies); // the seams run in plot axes, whatever the tile's turn
    if (r > 0) builders.seam?.(plot, p, 0, centre);
    if (c < 7) builders.seam?.(plot, p, 1, centre);
  }
}

/** A writer in plot metres (no turn, centred on the plot), for a plot's own pieces outside the tiles' builders. */
export const plotWriter = (parts, kit, coarseFamilies = new Set()) => writer(parts, [0, 0], 0, kit, coarseFamilies);

/** Kit models at plot positions outside the tiles, each placed only when the kit has
 *  its family: `placements` rows of { family, variant, at: [x, y, z] plot metres, scale, yaw? }. */
export function placePlotModels(parts, kit, placements, coarseFamilies = new Set()) {
  const w = plotWriter(parts, kit, coarseFamilies);
  for (const { family, variant, at, scale, yaw } of placements) {
    if (w.hasModel(family)) w.placeModel(family, variant, at[0], at[2], { y: at[1], scale, ...(yaw === undefined ? {} : { yaw }) });
  }
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
  // RM8.6: lights bucketed in reach-sized cells; a vertex sums only those in its 27 neighbouring cells, in their
  // original order, so every word matches the all-lights sum (the kit's ~1.5M vertices x 5,000 lanterns took 17-50 s)
  const reach = Math.sqrt(reach2), cellOf = v => Math.floor(v / reach), cells = new Map();
  lights.forEach((light, index) => {
    const key = `${cellOf(light.at[0])},${cellOf(light.at[1])},${cellOf(light.at[2])}`, list = cells.get(key);
    if (list === undefined) cells.set(key, [index]); else list.push(index);
  });
  for (let at = 0; at < part.positions.length; at += 3) {
    let r = 0, g = 0, b = 0;
    const cx = cellOf(part.positions[at]), cy = cellOf(part.positions[at + 1]), cz = cellOf(part.positions[at + 2]), near = [];
    for (let x = cx - 1; x <= cx + 1; x++) for (let y = cy - 1; y <= cy + 1; y++) for (let z = cz - 1; z <= cz + 1; z++) {
      const list = cells.get(`${x},${y},${z}`); if (list !== undefined) near.push(...list);
    }
    near.sort((first, second) => first - second);
    for (const index of near) {
      const light = lights[index];
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

/**
 * The plot's paving inside its outer ring (the generator draws the ring): rectangles [x0, z0, x1, z1, lane] in plot metres,
 * one per paved cell of each tile split at its border and its canal's water (left open: the canal draws its water below);
 * `lane` marks a border cell (the 8 m lanes between tiles), paved a shade lighter.
 */
export function paving(grid, ring, builders) {
  const out = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const { type, turns } = grid[r][c], cx = -250 + TILE * (c + 0.5), cz = 250 - TILE * (r + 0.5);
    const water = (builders.tiles[type].water ?? []).map(([x0, z0, x1, z1]) => {
      let a = [x0, z0], b = [x1, z1];
      for (let i = 0; i < turns; i++) { a = [a[1], -a[0]]; b = [b[1], -b[0]]; }
      return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
    });
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
