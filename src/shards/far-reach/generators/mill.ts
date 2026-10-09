import { BoxGeometry, BufferGeometry, Color, CylinderGeometry, DoubleSide, Float32BufferAttribute, InstancedMesh, LatheGeometry, Matrix4, MeshStandardMaterial, Quaternion, Vector2, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { bakeKinds, type PieceBake } from '@wildshard/sdk/bake/kinds';
import { MILL_COURSES, MILL_TOWER } from '../data/millShape';

/**
 * Build-time only (SHARD-PLATFORM SF72): baked by `scripts/bake-sky-world.mjs` into `baked/mill.glb` + `data/mill.json`;
 * the client draws the bake in its own materials (`world/mill.ts`: the painted stone, ivy and canvas land on them).
 *
 * The windmill's code set (loop 20): the whitewashed rubble tower with its weathering in the vertex colour, the ivy cards,
 * the door and windows in dressed-stone frames, the boarded curb, the shingled cap and its finial (the fallback the
 * modelled tower replaces), the windshaft, and the turning parts on the hub: the boss, the four lattice sail frames (one
 * kind, four instances) and the four canvases (their `farCloth` channel kept for the fraying shader). The group's kinds sit
 * in the mill's local frame (base at y 0, the sails toward +z); the shaft is built about its own centre (the client sets its
 * place under the hub), and the hub's kinds in the hub's frame.
 */

const hash = (a: number, b: number): number => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
function vnoise(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
/** periodic noise round the tower (a in radians), so the wall closes without a seam */
const ringNoise = (a: number, k: number, y: number): number => vnoise(Math.cos(a) * k + 5.3, Math.sin(a) * k + y);

/** The windows' heights and headings (radians from +z toward +x): the weather streaks run down from them. */
const WINDOWS: readonly (readonly [number, number])[] = [[3.6, 0.5], [5.4, -0.35], [7.0, 0.15]];
/** The plinth (a wider foot course) ends here; the taper starts at PLINTH + 0.1. */
const PLINTH = 0.55;
/** The stone texture's tile: TILE m tall, AROUND repeats round the tower. */
const TILE = MILL_COURSES.tile, AROUND = MILL_COURSES.around, SEG = 96;

/** The wall's radius at height y: a plinth, a chamfered ledge, then the straight taper. */
function wallRadius(y: number): number {
  if (y <= PLINTH) return MILL_TOWER.base + 0.25 - 0.12 * (y / PLINTH);
  if (y <= PLINTH + 0.1) return MILL_TOWER.base + 0.13 - 0.13 * ((y - PLINTH) / 0.1);
  return MILL_TOWER.base + (MILL_TOWER.top - MILL_TOWER.base) * ((y - PLINTH - 0.1) / (MILL_TOWER.height - PLINTH - 0.1));
}
/** The wall's lean (radians off vertical) above the plinth. */
const LEAN = Math.atan((MILL_TOWER.base - MILL_TOWER.top) / (MILL_TOWER.height - PLINTH - 0.1));

/** The ivy: [heading, foot height, width, height, sheet cell] per card, climbing from the foot. */
const IVY: readonly (readonly [number, number, number, number, number])[] = [
  // the spawn side's left (the H2 close-up): a broad mat to the top window's height
  [-0.8, -0.1, 2.4, 2.6, 0], [-1.05, 0, 2.2, 2.3, 3], [-0.6, 0.1, 1.8, 2.0, 2], [-0.72, 2.0, 2.2, 2.4, 1], [-0.95, 2.2, 2.0, 2.2, 2],
  [-0.8, 3.9, 2.0, 2.2, 3], [-0.65, 5.4, 1.6, 1.8, 0], [-0.45, -0.1, 1.6, 1.8, 1], [-1.25, -0.1, 1.8, 1.6, 0], [-0.5, 1.8, 1.4, 1.8, 3],
  [-1.1, 3.6, 1.6, 1.9, 1],
  // right of the door, a low clump
  [0.5, -0.1, 1.8, 1.9, 2], [0.62, 1.2, 1.4, 1.6, 1],
  // round the back and the far side
  [2.5, -0.1, 2.2, 2.4, 1], [2.75, 2.0, 2.0, 2.3, 0], [2.5, 3.8, 1.6, 1.9, 2], [-2.3, -0.1, 2.0, 2.1, 3], [-2.1, 1.7, 1.6, 1.7, 0],
  [3.9, -0.1, 1.6, 1.5, 2], [-1.5, -0.1, 1.4, 1.2, 1],
];
/** How much ivy (0-1) grows near (a, y): the wall's moss stain behind the cards. */
function ivyCover(a: number, y: number): number {
  let k = 0;
  for (const [ia, iy, w, h] of IVY) {
    let da = Math.abs(a - ia); da = Math.min(da, Math.PI * 2 - da);
    const r = wallRadius(Math.max(0, iy)), dx = (da * r) / (w * 0.3), dy = (y - iy - h * 0.45) / (h * 0.6);
    k = Math.max(k, 1 - Math.min(1, dx * dx + dy * dy));
  }
  return k;
}

function tower(): BufferGeometry {
  const ys: number[] = [0, 0.18, 0.36, PLINTH, PLINTH + 0.1];
  for (let y = PLINTH + 0.22; y < MILL_TOWER.height - 0.06; y += 0.12) ys.push(y);
  ys.push(MILL_TOWER.height);
  const pos: number[] = [], uv: number[] = [], col: number[] = [], idx: number[] = [];
  const out = new Color(), stain = new Color(0x8a7d6c), dirt = new Color(0x7f6d58), moss = new Color(0x6f7c45), mossy = new Color(0x9aa07a), white = new Color(1, 1, 1);
  for (const y of ys) {
    for (let i = 0; i <= SEG; i++) {
      const a = (i / SEG) * Math.PI * 2;
      // the rubble wall is not a true cylinder: a slow bulge and a finer stone-scale wobble
      const wob = y > PLINTH + 0.1 && y < MILL_TOWER.height - 0.05 ? 0.05 * (ringNoise(a, 2.2, y * 0.6) - 0.5) + 0.025 * (ringNoise(a, 9, y * 2.4) - 0.5) : 0;
      const r = wallRadius(y) + wob;
      pos.push(Math.sin(a) * r, y, Math.cos(a) * r);
      uv.push((i / SEG) * AROUND, y / TILE);
      // weathering over the whitewash: tonal patches, rain streaks from the curb, stains under the windows
      out.copy(white).multiplyScalar(0.88 + 0.12 * ringNoise(a, 3, y * 0.5));
      const rain = Math.max(0, ringNoise(a, 16, 0.5) - 0.62) * 2.6 * (0.3 + 0.7 * (y / MILL_TOWER.height));
      out.lerp(stain, Math.min(0.35, rain));
      for (const [wy, wa] of WINDOWS) {
        let da = Math.abs(a - wa); da = Math.min(da, Math.PI * 2 - da);
        if (y < wy - 0.3 && da < 0.12) out.lerp(stain, (1 - da / 0.12) * 0.5 * Math.max(0, 1 - (wy - 0.3 - y) / 2.6));
      }
      if (y < 1.4) out.lerp(dirt, ((1.4 - y) / 1.4) ** 1.5 * 0.55);
      if (y < PLINTH + 0.15) out.lerp(moss, 0.45 * ringNoise(a, 7, 3.1));
      out.lerp(mossy, ivyCover(a, y) * 0.45);
      col.push(out.r, out.g, out.b);
    }
  }
  const W = SEG + 1;
  for (let j = 0; j + 1 < ys.length; j++) for (let i = 0; i < SEG; i++) {
    const a = j * W + i, b = a + 1, c = a + W, d = c + 1;
    idx.push(a, b, d, a, d, c);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  // the seam column shares its normal with the first
  const n = g.getAttribute('normal'), s = new Vector3();
  for (let j = 0; j < ys.length; j++) {
    const a = j * W, b = j * W + SEG;
    s.set(n.getX(a) + n.getX(b), n.getY(a) + n.getY(b), n.getZ(a) + n.getZ(b)).normalize();
    n.setXYZ(a, s.x, s.y, s.z); n.setXYZ(b, s.x, s.y, s.z);
  }
  return g;
}

/** The ivy cards: each a curved strip laid on the wall, a painted spray from the sheet's 2 x 2 cells. */
function ivy(): BufferGeometry {
  const pos: number[] = [], uv: number[] = [], nor: number[] = [], col: number[] = [], idx: number[] = [];
  const NX = 4, NY = 5, c = new Color(), shade = new Color(0x7c8a72), sun = new Color(0xffffff);
  IVY.forEach(([a0, y0, w, h, cell], k) => {
    const cu = (cell % 2) * 0.5, cv = cell < 2 ? 0.5 : 0, base = pos.length / 3;
    for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
      const s = i / NX, t = j / NY, y = y0 + t * h, r = wallRadius(y < PLINTH + 0.25 ? 0 : y) + 0.05 + 0.02 * (k % 4) + 0.1 * t * (0.5 + 0.5 * hash(k, i));
      const a = a0 + ((s - 0.5) * w) / r;
      pos.push(Math.sin(a) * r, y, Math.cos(a) * r);
      nor.push(Math.sin(a) * 0.85, 0.5, Math.cos(a) * 0.85);
      // the sheet's sprays climb from the cell's bottom edge; a 4 % inset keeps the neighbours out
      uv.push(cu + 0.02 + s * 0.46, cv + 0.02 + t * 0.46);
      c.copy(shade).lerp(sun, Math.min(1, 0.35 + y / 5));
      col.push(c.r, c.g, c.b);
    }
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const p = base + j * (NX + 1) + i;
      idx.push(p, p + 1, p + NX + 2, p, p + NX + 2, p + NX + 1);
    }
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3)); g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.normalizeNormals();
  return g;
}

/** A box painted one colour (vertex colour), for merging. */
function tinted(g: BufferGeometry, color: Color): BufferGeometry {
  const ni = g.index === null ? g : g.toNonIndexed(), p = ni.getAttribute('position'), col: number[] = [];
  for (let i = 0; i < p.count; i++) col.push(color.r, color.g, color.b);
  ni.setAttribute('color', new Float32BufferAttribute(col, 3));
  return ni;
}
function merged(parts: BufferGeometry[]): BufferGeometry {
  const g = mergeGeometries(parts); for (const p of parts) p.dispose();
  return g;
}

/** The cap: a shingled ogee (each course's butt steps out), slate grey, one shingle a face. */
function cap(): BufferGeometry {
  const prof: readonly (readonly [number, number])[] = [[MILL_TOWER.top + 0.5, 0], [MILL_TOWER.top + 0.58, 0.35], [MILL_TOWER.top + 0.38, 1.1], [1.05, 1.8], [0.5, 2.4], [0.24, 2.72], [0.1, MILL_TOWER.cap]];
  const R = (y: number): number => {
    for (let i = 0; i + 1 < prof.length; i++) {
      const p = prof[i], q = prof[i + 1];
      if (p !== undefined && q !== undefined && y <= q[1]) return p[0] + (q[0] - p[0]) * ((y - p[1]) / (q[1] - p[1]));
    }
    return 0.1;
  };
  const pts = [new Vector2(0, 0), new Vector2(R(0) + 0.06, 0)], ROW = 0.2;
  for (let y = 0; y + 0.01 < 2.72; y += ROW) {
    const yb = Math.min(2.72, y + ROW);
    pts.push(new Vector2(R(y) + 0.06, y + 0.001), new Vector2(R(yb), yb));
  }
  pts.push(new Vector2(0.1, MILL_TOWER.cap), new Vector2(0, MILL_TOWER.cap));
  const g = new LatheGeometry(pts, 40).toNonIndexed();
  const p = g.getAttribute('position'), col: number[] = [], slate = new Color(0x5b6271), light = new Color(0x8a90a0), dark = new Color(0x343846), out = new Color();
  for (let k = 0; k < p.count; k += 3) {
    let cx = 0, cy = 0, cz = 0; for (let v = 0; v < 3; v++) { cx += p.getX(k + v) / 3; cy += p.getY(k + v) / 3; cz += p.getZ(k + v) / 3; }
    const row = Math.floor(cy / ROW), sh = Math.floor(((Math.atan2(cx, cz) / (Math.PI * 2)) + 0.5) * 40);
    out.copy(slate).lerp(light, hash(row, sh) * 0.45 + (cy / MILL_TOWER.cap) * 0.15);
    if (hash(sh, row + 3) > 0.9) out.lerp(dark, 0.5);
    if (hash(sh * 3, row) > 0.93) out.lerp(new Color(0x8c9468), 0.35); // a lichen-green shingle
    for (let v = 0; v < 3; v++) col.push(out.r, out.g, out.b);
  }
  g.setAttribute('color', new Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  return g;
}

/** The boarded curb under the cap: vertical planks, each its own weathered tone. */
function curb(): BufferGeometry {
  const g = new CylinderGeometry(MILL_TOWER.top + 0.52, MILL_TOWER.top + 0.42, 0.5, 48, 1).toNonIndexed();
  const p = g.getAttribute('position'), col: number[] = [], a0 = new Color(0x5a4230), a1 = new Color(0x8a6c50), out = new Color();
  for (let k = 0; k < p.count; k += 3) {
    let cx = 0, cz = 0; for (let v = 0; v < 3; v++) { cx += p.getX(k + v); cz += p.getZ(k + v); }
    const plank = Math.floor(((Math.atan2(cx, cz) / (Math.PI * 2)) + 0.5) * 48);
    out.copy(a0).lerp(a1, hash(plank, 9));
    for (let v = 0; v < 3; v++) col.push(out.r, out.g, out.b);
  }
  g.setAttribute('color', new Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  return g;
}

/** The door, the windows and their dressed-stone frames, set into the leaning wall. */
function openings(): { stone: BufferGeometry; wood: BufferGeometry; dark: BufferGeometry } {
  const stone: BufferGeometry[] = [], wood: BufferGeometry[] = [], dark: BufferGeometry[] = [];
  const dressed = new Color(0xd8cfbf), worn = new Color(0xb9ac98);
  const place = (g: BufferGeometry, a: number, y: number, out: number, lx: number, ly: number): BufferGeometry => {
    // local x across the wall, y up the wall, z out of it; then leaned back and turned to heading a
    g.translate(lx, ly, 0); g.rotateX(-LEAN); g.rotateY(a);
    const r = wallRadius(y) + out; g.translate(Math.sin(a) * r, y, Math.cos(a) * r);
    return g;
  };
  for (const [y, a] of WINDOWS) {
    dark.push(place(new BoxGeometry(0.46, 0.7, 0.3), a, y, -0.12, 0, 0));
    const t = (sx: number, sy: number, lx: number, ly: number): void => { stone.push(place(tinted(new BoxGeometry(sx, sy, 0.22), dressed.clone().lerp(worn, hash(lx * 7 + a, ly * 5 + y))), a, y, -0.06, lx, ly)); };
    t(0.78, 0.13, 0, 0.42); t(0.86, 0.12, 0, -0.41); t(0.16, 0.7, -0.31, 0); t(0.16, 0.7, 0.31, 0);
  }
  // the door: five planks and two iron straps, set back in a portal of dressed jambs and a lintel proud of the plinth,
  // a worn step before it
  const doorZ = wallRadius(0) + 0.02;
  for (let i = 0; i < 5; i++) wood.push(tinted(new BoxGeometry(0.19, 1.86, 0.08), new Color(0x5e4029).lerp(new Color(0x7d5a3c), hash(i, 2))).translate(-0.4 + i * 0.2, 0.95, doorZ));
  for (const sy of [0.5, 1.45]) dark.push(new BoxGeometry(1.0, 0.07, 0.04).translate(0, sy, doorZ + 0.06));
  const jamb = (x: number, y: number, sx: number, sy: number, k: number): void => { stone.push(tinted(new BoxGeometry(sx, sy, 0.62), dressed.clone().lerp(worn, k)).translate(x, y, doorZ)); };
  for (let i = 0; i < 4; i++) { jamb(-0.64, 0.25 + i * 0.47, 0.26, 0.45, hash(i, 1)); jamb(0.64, 0.25 + i * 0.47, 0.26, 0.45, hash(i, 4)); }
  jamb(0, 2.08, 1.56, 0.3, 0.3);
  stone.push(tinted(new BoxGeometry(1.7, 0.18, 0.7), new Color(0xa8a094)).translate(0, 0.09, doorZ + 0.5));
  return { stone: merged(stone), wood: merged(wood), dark: merged(dark) };
}

/** One sail: the stock from the hub, four laths and the sail bars (the lattice), the canvas behind them. */
function sail(): { frame: BufferGeometry; cloth: BufferGeometry[] } {
  const parts: BufferGeometry[] = [], L = MILL_TOWER.sail, w = 1.8, x0 = 0.3, y0 = L * 0.17;
  const bar = (sx: number, sy: number, sz: number, x: number, y: number, z: number, k: number): void => {
    parts.push(tinted(new BoxGeometry(sx, sy, sz), new Color(0x6e5a48).lerp(new Color(0x9a8a76), k)).translate(x, y, z));
  };
  bar(0.24, L, 0.24, 0, L / 2, 0, 0.2); // the stock
  for (const [x, t] of [[x0, 0.08], [x0 + w / 2, 0.04], [x0 + w, 0.09]] as const) bar(t, L - y0, t, x, (L + y0) / 2, 0.06, hash(x, 3)); // the laths
  const BARS = 9;
  for (let i = 0; i <= BARS; i++) bar(w + 0.4, 0.06, 0.06, x0 + w / 2 - 0.12, y0 + (L - y0 - 0.05) * (i / BARS), 0.13, hash(i, 7)); // the sail bars
  const frame = merged(parts);
  // the canvas: a billowing sheet behind the bars; `farCloth` = (across, along, the sail's seed) for the fraying
  const cloth: BufferGeometry[] = [];
  for (let s = 0; s < 4; s++) {
    const NX = 6, NY = 16, pos: number[] = [], uv: number[] = [], fc: number[] = [], idx: number[] = [];
    // E410 (round 14 seat A: 'rigid sail grids' against mockup A's cloth sails): three sails spread full length, one reefed
    const reef = s === 2 ? 0.8 : 1.0, ys = L - (L - y0) * reef - 0.05, ou = hash(s, 1) * 0.35, ov = hash(s, 2) * 0.2;
    for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
      const u = i / NX, v = j / NY, billow = 0.3 * Math.sin(Math.PI * u) * Math.sin(Math.PI * Math.min(1, v * 1.15));
      pos.push(x0 + 0.03 + u * (w - 0.06), ys + v * (L - ys - 0.08), -0.02 - billow);
      uv.push(ou + u * 0.62, ov + v * 0.8);
      fc.push(u, v, hash(s, 5));
    }
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const p = j * (NX + 1) + i; idx.push(p, p + 1, p + NX + 2, p, p + NX + 2, p + NX + 1); }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
    g.setAttribute('farCloth', new Float32BufferAttribute(fc, 3)); g.setIndex(idx); g.computeVertexNormals();
    cloth.push(g);
  }
  return { frame, cloth };
}

const one = (geometry: BufferGeometry, material: MeshStandardMaterial, at = new Matrix4()): InstancedMesh => { const mesh = new InstancedMesh(geometry, material, 1); mesh.setMatrixAt(0, at); return mesh; };
const lift = (y: number): Matrix4 => new Matrix4().makeTranslation(0, y, 0);
/** A sail arm's turn about the hub's axis (z): the four arms a quarter apart, the first 0.3 rad round. */
const arm = (i: number): Matrix4 => new Matrix4().makeRotationZ((i * Math.PI) / 2 + 0.3);

/** The mill's code set as named kinds: the group's (its local frame), the shaft (about its centre), the hub's. */
export function buildMillSet(): (readonly [string, InstancedMesh])[] {
  const wood = new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
  const timber = new MeshStandardMaterial({ color: 0x6b4a32, roughness: 0.9, metalness: 0 });
  const o = openings(), { frame, cloth } = sail();
  const frames = new InstancedMesh(frame, new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 }), 4);
  for (let i = 0; i < 4; i++) frames.setMatrixAt(i, arm(i));
  const clothMat = new MeshStandardMaterial({ color: 0xece0c6, roughness: 0.95, metalness: 0, side: DoubleSide, emissive: 0x302820, alphaTest: 0.5 });
  const turned = new Matrix4().makeRotationFromQuaternion(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2));
  return [
    ['tower', one(tower(), new MeshStandardMaterial({ vertexColors: true, color: 0xe9e0cf, roughness: 0.95, metalness: 0 }))],
    ['ivy', one(ivy(), new MeshStandardMaterial({ vertexColors: true, alphaTest: 0.4, side: DoubleSide, roughness: 0.8, metalness: 0, emissive: 0x18220c }))],
    ['dressed', one(o.stone, new MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 }))],
    ['door', one(o.wood, wood)],
    ['dark', one(o.dark, new MeshStandardMaterial({ color: 0x1e1a20, roughness: 1, metalness: 0 }))],
    ['curb', one(curb(), wood, lift(MILL_TOWER.height + 0.2))],
    ['cap', one(cap(), new MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.05 }), lift(MILL_TOWER.height + 0.42))],
    ['finial', one(new CylinderGeometry(0.02, 0.12, 0.5, 8), new MeshStandardMaterial({ color: 0x3a3430, roughness: 0.6, metalness: 0.3 }), lift(MILL_TOWER.height + 0.42 + MILL_TOWER.cap + 0.2))],
    ['shaft', one(new CylinderGeometry(0.2, 0.24, 1.4, 10), timber, turned)],
    ['boss', one(new CylinderGeometry(0.42, 0.42, 0.5, 12), timber, turned)],
    ['frame', frames],
    ...cloth.map((g, i) => [`cloth-${String(i)}`, one(g, clothMat, arm(i))] as const),
  ];
}

/** The mill's code set baked (no colliders: world/build.ts gives the mill its box and its drum's hull). */
export function bakeSkyMill(): PieceBake {
  return bakeKinds('far.mill', buildMillSet(), [], { attributes: { _FARCLOTH: 'farCloth' } });
}
