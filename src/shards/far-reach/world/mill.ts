import { BoxGeometry, BufferGeometry, Color, CylinderGeometry, DoubleSide, Float32BufferAttribute, Group, LatheGeometry, Mesh, MeshStandardMaterial, Vector2, Vector3, type Object3D, type Texture } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { fit, hdMaterial, skyHd } from './meshes';
import { onPaintedDispose } from '../look/image';

/**
 * The windmill (loop 20, the judge: "a flat white/grey plaster cylinder with plain plank sails; the mockup has weathered
 * whitewashed STONE with visible block courses, ivy climbing the tower, and slatted lattice sails with worn canvas").
 * A code-built tower mill, the first frame's subject:
 * - the tower: a tapered round of whitewashed rubble stone on a wider plinth, the painted stone
 *   (`tex/mill-stone.webp`, codex image_gen from the H2 close-up; art/far-reach/round-18-windmill) wrapped round it with
 *   its own luminance as the bump, so the courses and the mortar read; weather streaks under the windows and the curb,
 *   grime and moss at the foot, a faint moss stain behind the ivy, in the vertex colour;
 * - the ivy: curved leaf cards from the painted ivy sheet (`tex/mill-ivy.webp`, alpha cut) climbing from the foot,
 *   tallest on the spawn side's left, as the H2 targets;
 * - a planked door and three deep windows in dressed-stone frames, a stone step;
 * - a boarded curb under a shingled slate ogee cap with a finial;
 * - four lattice sails: the stock, four laths and fifteen sail bars in weathered timber, the worn canvas
 *   (`tex/mill-canvas.webp`: stains, patches, seams) billowing behind the bars, frayed at its edges, two sails torn.
 * The textures load lazily here (the mill keeps its plain paint until they land); without them the tower is cream and
 * the ivy hidden. The hub turns (the plugin spins it). Local frame: base at y 0, the sails face +z.
 */
export const MILL = { base: 2.5, top: 1.7, height: 8.6, cap: 2.9, sail: 7.4 } as const;

/**
 * The windmill's painted textures (`public/assets/far-reach/tex/mill-*.webp`; the boot downloads them, boot/files.ts): the
 * plugin loads them behind the loading screen and owns them (`setMillTextures`), so the first frame already has the
 * stone, the ivy and the canvas; without one (offline, a test page) its part keeps the code look.
 */
const MILL_TEX: { stone: Texture | null; canvas: Texture | null; ivy: Texture | null } = { stone: null, canvas: null, ivy: null };
export function setMillTextures(t: { stone: Texture | null; canvas: Texture | null; ivy: Texture | null }): void {
  Object.assign(MILL_TEX, t);
  for (const key of ['stone', 'canvas', 'ivy'] as const) {
    const texture = t[key];
    onPaintedDispose(texture, () => { if (MILL_TEX[key] === texture) MILL_TEX[key] = null; });
  }
}
function painted(t: Texture | null, apply: (t: Texture) => void): void { if (t !== null) apply(t); }

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
const TILE = 2.8, AROUND = 5, SEG = 96;

/** The wall's radius at height y: a plinth, a chamfered ledge, then the straight taper. */
function wallRadius(y: number): number {
  if (y <= PLINTH) return MILL.base + 0.25 - 0.12 * (y / PLINTH);
  if (y <= PLINTH + 0.1) return MILL.base + 0.13 - 0.13 * ((y - PLINTH) / 0.1);
  return MILL.base + (MILL.top - MILL.base) * ((y - PLINTH - 0.1) / (MILL.height - PLINTH - 0.1));
}
/** The wall's lean (radians off vertical) above the plinth. */
const LEAN = Math.atan((MILL.base - MILL.top) / (MILL.height - PLINTH - 0.1));

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
  for (let y = PLINTH + 0.22; y < MILL.height - 0.06; y += 0.12) ys.push(y);
  ys.push(MILL.height);
  const pos: number[] = [], uv: number[] = [], col: number[] = [], idx: number[] = [];
  const out = new Color(), stain = new Color(0x8a7d6c), dirt = new Color(0x7f6d58), moss = new Color(0x6f7c45), mossy = new Color(0x9aa07a), white = new Color(1, 1, 1);
  for (const y of ys) {
    for (let i = 0; i <= SEG; i++) {
      const a = (i / SEG) * Math.PI * 2;
      // the rubble wall is not a true cylinder: a slow bulge and a finer stone-scale wobble
      const wob = y > PLINTH + 0.1 && y < MILL.height - 0.05 ? 0.05 * (ringNoise(a, 2.2, y * 0.6) - 0.5) + 0.025 * (ringNoise(a, 9, y * 2.4) - 0.5) : 0;
      const r = wallRadius(y) + wob;
      pos.push(Math.sin(a) * r, y, Math.cos(a) * r);
      uv.push((i / SEG) * AROUND, y / TILE);
      // weathering over the whitewash: tonal patches, rain streaks from the curb, stains under the windows
      out.copy(white).multiplyScalar(0.88 + 0.12 * ringNoise(a, 3, y * 0.5));
      const rain = Math.max(0, ringNoise(a, 16, 0.5) - 0.62) * 2.6 * (0.3 + 0.7 * (y / MILL.height));
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
  const prof: readonly (readonly [number, number])[] = [[MILL.top + 0.5, 0], [MILL.top + 0.58, 0.35], [MILL.top + 0.38, 1.1], [1.05, 1.8], [0.5, 2.4], [0.24, 2.72], [0.1, MILL.cap]];
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
  pts.push(new Vector2(0.1, MILL.cap), new Vector2(0, MILL.cap));
  const g = new LatheGeometry(pts, 40).toNonIndexed();
  const p = g.getAttribute('position'), col: number[] = [], slate = new Color(0x5b6271), light = new Color(0x8a90a0), dark = new Color(0x343846), out = new Color();
  for (let k = 0; k < p.count; k += 3) {
    let cx = 0, cy = 0, cz = 0; for (let v = 0; v < 3; v++) { cx += p.getX(k + v) / 3; cy += p.getY(k + v) / 3; cz += p.getZ(k + v) / 3; }
    const row = Math.floor(cy / ROW), sh = Math.floor(((Math.atan2(cx, cz) / (Math.PI * 2)) + 0.5) * 40);
    out.copy(slate).lerp(light, hash(row, sh) * 0.45 + (cy / MILL.cap) * 0.15);
    if (hash(sh, row + 3) > 0.9) out.lerp(dark, 0.5);
    if (hash(sh * 3, row) > 0.93) out.lerp(new Color(0x8c9468), 0.35); // a lichen-green shingle
    for (let v = 0; v < 3; v++) col.push(out.r, out.g, out.b);
  }
  g.setAttribute('color', new Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  return g;
}

/** The boarded curb under the cap: vertical planks, each its own weathered tone. */
function curb(): BufferGeometry {
  const g = new CylinderGeometry(MILL.top + 0.52, MILL.top + 0.42, 0.5, 48, 1).toNonIndexed();
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
  const parts: BufferGeometry[] = [], L = MILL.sail, w = 1.8, x0 = 0.3, y0 = L * 0.17;
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

/**
 * The modelled set (E410, Sky Reach top-10 row 6; `art/far-reach/round-34-mill/`): codex references of mockup A's tower
 * mill (the whitewashed rubble tower, the ivy, the arched door, the boarded curb and the dark shingled cap with its
 * windshaft stub, no sails) and of mockup C's rock under it, BiRefNet, Hunyuan3D-2 turbo + paint, finish.sh. The tower
 * is scaled so its windshaft stub sits where the code hub was (`hub` y, so the sails sweep the same circle the mockup
 * framing was tuned on) and turned so the stub faces +z (the spawn); the code sails stay, turning on the stub. The rock
 * foot is squashed to `foot.h` and sunk `foot.sink` into the deck: up to 0.65 m of it hugs the wall inside the meadow's
 * 2.9 m hole round the mill (where the code tower's plinth stood), and from `foot.walk` m out (0.3 m on) none of it stands
 * more than `foot.lip` m proud, so the walk round the mill (the code collider's 2.3 m box) is over a stone lip, not a
 * wall. The code tower stays the fallback when a model fails to load.
 */
export const MODELLED = { hub: MILL.height + 1.0, baseR: 2.6, foot: { span: 8.2, h: 1.7, sink: 0.45, walk: 3.0, lip: 0.3 } } as const;
/** The stone drum the tower stands on (E410, plan row 6: mockups C and proposal B stand the mill on a rock outcrop): its
 * radius and height over the deck; world/build.ts gives it a collider, so you walk round it, not through it. */
export const MILL_DRUM = { r: 3.0, h: 1.2, sides: 16 } as const;

interface Made { readonly meshes: Mesh[]; readonly hubAt: { y: number; z: number } }
/** The front stub of a fitted tower: the farthest-out vertices above 72 % of its height (the centroid of the outer 8 %). */
function stubOf(g: BufferGeometry): { a: number; r: number; y: number } {
  const p = g.getAttribute('position'); g.computeBoundingBox();
  const top = (g.boundingBox?.max.y ?? 1) * 0.72;
  let far = 0;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > top) far = Math.max(far, Math.hypot(p.getX(i), p.getZ(i)));
  let x = 0, y = 0, z = 0, n = 0;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > top && Math.hypot(p.getX(i), p.getZ(i)) > far * 0.92) { x += p.getX(i); y += p.getY(i); z += p.getZ(i); n++; }
  return { a: Math.atan2(x / Math.max(1, n), z / Math.max(1, n)), r: far, y: y / Math.max(1, n) };
}
/**
 * The painted stone's courses on the modelled wall (the model's own paint is soft at the h2 close-up's 18 m): a second UV
 * set wrapped round the axis as the code tower's (`AROUND` repeats, `TILE` m a course sheet), seam-free (each triangle
 * that straddles the back's wrap is unwrapped on its own), constant above the wall's top `wallTop` (the curb and cap keep
 * their paint). The stone then drives the bump and a light multiply of the paint (`towerMaterial`).
 */
function stoneCourses(src: BufferGeometry, wallTop: number): BufferGeometry {
  const g = src.index === null ? src : src.toNonIndexed(), p = g.getAttribute('position'), uv1 = new Float32Array(p.count * 2);
  for (let t = 0; t + 2 < p.count; t += 3) {
    const us = [0, 1, 2].map((v) => ((Math.atan2(p.getX(t + v), p.getZ(t + v)) / (Math.PI * 2)) + 0.5) * AROUND);
    const hi = Math.max(...us);
    for (let v = 0; v < 3; v++) {
      const y = p.getY(t + v), u = us[v] ?? 0;
      uv1[(t + v) * 2] = y > wallTop ? 0.5 : hi - u > AROUND / 2 ? u + AROUND : u;
      uv1[(t + v) * 2 + 1] = y > wallTop ? 0.5 : y / TILE;
    }
  }
  g.setAttribute('uv1', new Float32BufferAttribute(uv1, 2));
  if (g !== src) src.dispose();
  return g;
}
/**
 * The modelled tower's material: its paint pulled toward mockup A's pale weathered whitewash (the Hunyuan paint came out
 * cream-yellow: mock-A's wall saturation 46 %, 24 % with this pull, the code tower's was 25 %, the mockup's 17 %, under the
 * same golden light and LUT; luminance 113 against the mockup's 106), and the painted
 * stone's courses (`MILL_TEX.stone`, on the second UV set) as the bump and a light multiply.
 */
function towerMaterial(map: Texture): MeshStandardMaterial {
  const m = hdMaterial(map);
  painted(MILL_TEX.stone, (st) => { const t = st.clone(); t.channel = 1; m.bumpMap = t; m.bumpScale = 2; });
  patchShader(m, 'far.mill-tower', PATCH_ORDER.decorate, (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
  diffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))), diffuseColor.rgb, 0.2);
#ifdef USE_BUMPMAP
  diffuseColor.rgb *= mix(1.0, texture2D(bumpMap, vBumpMapUv).g * 1.45, 0.35);
#endif`);
  }, { key: (prior) => `${prior}|far.mill-tower` });
  return m;
}
function modelledSet(): Made | null {
  const t = skyHd('mill-tower'), f = skyHd('mill-foot');
  if (t === null || f === null) return null;
  // the tower: unit height first, its stub found and turned to +z, then scaled so the stub sits at the code hub's height
  const g = fit(t.geometry, { size: 1, by: 'height', floor: 0, centre: 'base' });
  const s0 = stubOf(g); g.rotateY(-s0.a);
  const k = MODELLED.hub / s0.y; g.scale(k, k, k);
  // the footing's mean radius to the code tower's (the collider's box and the meadow's hole are sized on it)
  const p = g.getAttribute('position'); let rs = 0, n = 0;
  for (let i = 0; i < p.count; i++) if (p.getY(i) < 0.4) { rs += Math.hypot(p.getX(i), p.getZ(i)); n++; }
  const kr = Math.min(1.2, Math.max(0.8, MODELLED.baseR / Math.max(0.1, rs / Math.max(1, n)))); g.scale(kr, 1, kr);
  const s = stubOf(g);
  // the sails' lowest sweep passes the wall's front 7.4 m under the hub: keep the hub clear of it by 0.55 m
  let wall = 0;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y > s.y - MILL.sail - 0.2 && y < s.y - 1.5 && Math.abs(p.getX(i)) < 1.2 && p.getZ(i) > 0) wall = Math.max(wall, p.getZ(i));
  }
  g.computeBoundingBox(); g.computeBoundingSphere();
  const made = new Mesh(stoneCourses(g, s.y - 1.2), towerMaterial(t.map)); made.name = 'far.mill.tower';
  // the rock foot: fitted to its span, squashed, sunk into the deck
  const fg = fit(f.geometry, { size: MODELLED.foot.span, by: 'span', floor: 0, centre: 'box' }); fg.computeBoundingBox();
  const fh = fg.boundingBox ? fg.boundingBox.max.y : 1; fg.scale(1, MODELLED.foot.h / Math.max(1e-3, fh), 1); fg.rotateY(0.7);
  fg.translate(0, -MODELLED.foot.sink, 0);
  // past the walk ring, nothing stands more than the lip proud of the deck (a smooth fall-off, no cliff)
  const fp = fg.getAttribute('position');
  for (let i = 0; i < fp.count; i++) {
    const d = Math.hypot(fp.getX(i), fp.getZ(i)), y = fp.getY(i);
    if (d > MODELLED.foot.walk && y > MODELLED.foot.lip) {
      const w = Math.min(1, (d - MODELLED.foot.walk) / 0.3);
      fp.setY(i, y + (MODELLED.foot.lip + (y - MODELLED.foot.lip) * 0.25 - y) * w);
    }
  }
  fg.computeVertexNormals(); fg.computeBoundingBox(); fg.computeBoundingSphere();
  const foot = new Mesh(fg, hdMaterial(f.map)); foot.name = 'far.mill.foot';
  return { meshes: [made, foot], hubAt: { y: s.y, z: Math.max(s.r + 0.1, wall + 0.55) } };
}

export function towerMill(): { group: Group; hub: Object3D; hubAt: { y: number; z: number } } {
  const made = modelledSet();
  const group = new Group(), hub = new Group();
  // the whitewashed stone: cream until the painted stone lands, then the stone and its own luminance as the bump
  const stone = new MeshStandardMaterial({ vertexColors: true, color: 0xe9e0cf, roughness: 0.95, metalness: 0 });
  painted(MILL_TEX.stone, (t) => { stone.map = t; stone.bumpMap = t; stone.bumpScale = 3; stone.color.set(0xffffff); stone.needsUpdate = true; });
  group.add(new Mesh(tower(), stone));
  // the ivy, hidden until its sheet lands
  const ivyMat = new MeshStandardMaterial({ vertexColors: true, alphaTest: 0.4, side: DoubleSide, roughness: 0.8, metalness: 0, emissive: 0x18220c });
  const ivyMesh = new Mesh(ivy(), ivyMat); ivyMesh.visible = false; group.add(ivyMesh);
  painted(MILL_TEX.ivy, (t) => { ivyMat.map = t; ivyMat.emissiveMap = t; ivyMat.needsUpdate = true; ivyMesh.visible = true; });
  const wood = new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
  const dark = new MeshStandardMaterial({ color: 0x1e1a20, roughness: 1, metalness: 0 });
  const dressed = new MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
  const o = openings();
  group.add(new Mesh(o.stone, dressed), new Mesh(o.wood, wood), new Mesh(o.dark, dark));
  // the curb and the cap, a finial on top
  const curbMesh = new Mesh(curb(), wood); curbMesh.position.y = MILL.height + 0.2; group.add(curbMesh);
  const capMesh = new Mesh(cap(), new MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.05 })); capMesh.position.y = MILL.height + 0.42; group.add(capMesh);
  const finial = new Mesh(new CylinderGeometry(0.02, 0.12, 0.5, 8), new MeshStandardMaterial({ color: 0x3a3430, roughness: 0.6, metalness: 0.3 })); finial.position.y = MILL.height + 0.42 + MILL.cap + 0.2; group.add(finial);
  // the windshaft out of the cap toward +z, and the hub on it
  const timber = new MeshStandardMaterial({ color: 0x6b4a32, roughness: 0.9, metalness: 0 });
  const hubAt = made?.hubAt ?? { y: MILL.height + 1.0, z: MILL.top + 0.95 };
  const shaft = new Mesh(new CylinderGeometry(0.2, 0.24, 1.4, 10), timber); shaft.rotation.x = Math.PI / 2; shaft.position.set(0, hubAt.y, hubAt.z - 0.6); group.add(shaft);
  if (made !== null) {
    // the modelled tower, cap and foot in place of the code ones (the shaft and the sails stay: they turn)
    for (const c of group.children) if (c !== shaft) c.visible = false;
    group.add(...made.meshes);
  }
  hub.position.set(0, hubAt.y, hubAt.z); group.add(hub);
  const boss = new Mesh(new CylinderGeometry(0.42, 0.42, 0.5, 12), timber); boss.rotation.x = Math.PI / 2; hub.add(boss);
  const { frame, cloth } = sail();
  // the worn canvas: the painted cloth once it lands (a coarse weave and water stains in the shader until then), frayed
  // edges and a torn-away corner on two sails cut in the shader, a faint warm glow where the low sun comes through
  const clothMat = new MeshStandardMaterial({ color: 0xece0c6, roughness: 0.95, metalness: 0, side: DoubleSide, emissive: 0x302820, alphaTest: 0.5 });
  painted(MILL_TEX.canvas, (t) => { clothMat.map = t; clothMat.emissiveMap = t; clothMat.color.set(0xffffff); clothMat.needsUpdate = true; });
  patchShader(clothMat, 'far.mill-canvas', PATCH_ORDER.decorate, (shader) => {
    shader.vertexShader = `attribute vec3 farCloth;\nvarying vec3 vFarCloth;\n${shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vFarCloth = farCloth;')}`;
    shader.fragmentShader = `varying vec3 vFarCloth;
float farCH(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float farCN(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(farCH(i), farCH(i + vec2(1.0, 0.0)), u.x), mix(farCH(i + vec2(0.0, 1.0)), farCH(i + vec2(1.0, 1.0)), u.x), u.y); }
${shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
  { vec2 q = vFarCloth.xy; float seed = vFarCloth.z;
    float n = farCN(q * vec2(14.0, 40.0) + seed * 17.0) * 0.65 + farCN(q * vec2(5.0, 13.0) + seed * 5.0) * 0.35;
    float edge = min(min(q.x, 1.0 - q.x), min(q.y * 2.5, (1.0 - q.y) * 2.5));
    float torn = step(edge, 0.05 * n);
    // two sails have lost a ragged corner at the outer rail's hub end
    torn = max(torn, step(0.45, seed) * step(length((q - vec2(1.0, 0.0)) * vec2(1.0, 1.6)), 0.22 + 0.22 * n));
    if (farCN(q * vec2(6.0, 15.0) + seed * 31.0) > 0.94) torn = 1.0;
    diffuseColor.a *= 1.0 - torn;
#ifdef USE_MAP
    // the painted canvas is a warm beige swatch: toward the targets' sun-bleached cream
    diffuseColor.rgb = min(vec3(1.0), mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11))), 0.25) * vec3(1.12, 1.06, 0.96));
    // (E399 seats: the sails 'read like pale glass panes'; the mockups' canvas is a weathered tan between dark frames)
#else
    float weave = 0.92 + 0.08 * sin(q.x * 300.0) * sin(q.y * 700.0);
    diffuseColor.rgb *= weave * mix(1.0, 0.8, smoothstep(0.62, 0.8, n)) * mix(0.8, 1.0, smoothstep(0.0, 0.3, q.y));
#endif
  }`)}`;
  }, { key: (prior) => `${prior}|far.mill-canvas` });
  const frameMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
  for (let i = 0; i < 4; i++) {
    const arm = new Group(); arm.rotation.z = (i * Math.PI) / 2 + 0.3; hub.add(arm);
    arm.add(new Mesh(frame, frameMat), new Mesh(cloth[i] ?? cloth[0], clothMat));
  }
  return { group, hub, hubAt };
}
