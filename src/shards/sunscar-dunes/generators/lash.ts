import { BufferAttribute, BufferGeometry, CatmullRomCurve3, InstancedMesh, MeshStandardMaterial, TubeGeometry, Vector3, Euler } from 'three';
import { bakePiece, signalPiece, type SignalPieceBake } from './kinds';
import { WHIP_HOLD, WHIP_VIEW, type CoilPath, type CordRgb, type CordStyle, type LashHoldRow, type LashView, type PlaitStyle } from '../data/whip';

/**
 * Build-time only (G345, the lash's graphical port): the bullwhip's held geometry, baked offline
 * (`generators/bake-signal-world.mjs` → `baked/lash.glb` + `data/lash.json`). The client builds no tube or braid: it
 * reads four kinds, `coil` (the braided rest coil the Model Explorer shows), `loop` (the plaited coil in the hero
 * glove's frame), `cord` (the thrown cord's rings, its braid painted, its positions rewritten every frame by
 * `runtime/items/lashView.ts`) and `wrap` (the helix a heavy lash winds round a caught lever), and the two numbers the generated glove's fit gives: where the lash leaves the hand
 * (`tip`) and the plait tile's repeat along the loop (`along`). The generated glove is read through the client's own
 * model intake; the client no longer loads it. The plait tile's texels go beside it (`baked/plait.bin`, `plaitTexels`).
 */

/** Paints a tube's rings with two strands laid in a spiral (the plait), so the braid reads without a texture; the last `popperRings` are the popper. */
export function braidColours(geometry: BufferGeometry, rings: number, sides: number, popperRings: number, a: CordRgb, b: CordRgb, popper: CordRgb): void {
  const count = geometry.getAttribute('position').count, colors = new Float32Array(count * 3);
  for (let v = 0; v < count; v++) {
    const i = Math.floor(v / sides), j = v % sides;
    const c = i >= rings - popperRings ? popper : (i * 2 + j) % 4 < 2 ? a : b;
    colors[v * 3] = c[0]; colors[v * 3 + 1] = c[1]; colors[v * 3 + 2] = c[2];
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
}

/** The thrown cord's rest geometry: `segments + 1` rings of `radial` vertices at the origin, their braid painted. */
export function cordGeometry(style: CordStyle): BufferGeometry {
  const geometry = new BufferGeometry(), { segments, radial } = style, rings = segments + 1, index: number[] = [];
  for (let s = 0; s < segments; s++) for (let r = 0; r < radial; r++) {
    const a = s * radial + r, b = s * radial + (r + 1) % radial, c = a + radial, d = b + radial;
    index.push(a, c, b, b, c, d);
  }
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(rings * radial * 3), 3));
  geometry.setIndex(index);
  braidColours(geometry, rings, radial, style.popperRings, style.strandA, style.strandB, style.popper);
  return geometry;
}

/**
 * A held coil's centre line: the cord leaves the handle's top straight into the ellipse at `start`, turns counter-clockwise
 * as the camera sees it (up the right side, over the top, down the left), ends at its foot and drops through the fall, so
 * no stretch of cord crosses the coil's middle.
 */
export function coilPoints(c: CoilPath): Vector3[] {
  const [fx, fy, fz] = c.from, a0 = c.start;
  // the ellipse placed so its point at `start` is the handle's top (in the plane turned by `face`)
  const cx = fx - Math.cos(a0) * c.rx * Math.cos(c.face), cy = fy - Math.sin(a0) * c.ry, cz = fz - Math.cos(a0) * c.rx * Math.sin(c.face);
  const pts: Vector3[] = [], n = 40 * c.turns, sweep = Math.PI * 2 * c.turns - (a0 + Math.PI * 0.5);
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = a0 + t * sweep, k = t * (c.turns - 1);
    const wob = 1 - 0.04 * Math.sin(a * 3 + 0.7), ex = Math.cos(a) * c.rx * wob;
    pts.push(new Vector3(cx + ex * Math.cos(c.face) + c.step[0] * k, cy + Math.sin(a) * c.ry * wob + c.step[1] * k, cz + ex * Math.sin(c.face) + c.step[2] * k + Math.sin(a) * 0.05));
  }
  for (const q of c.tail) pts.push(new Vector3(q[0], q[1], q[2]));
  return pts;
}

/** The plaited loop along the hero coil's path, and the plait tile's repeat along it (true UVs, the tile at 45 deg). */
export function loopGeometry(row: LashHoldRow): { geometry: TubeGeometry; along: number } {
  const curve = new CatmullRomCurve3(coilPoints(row.loop), false, 'centripetal'), length = curve.getLength(), { cord } = row.loop, p = row.plait;
  return { geometry: new TubeGeometry(curve, 360, cord, 12, false), along: length / (p.rows * (2 * Math.PI * cord) / p.columns) };
}

/** The braided rest coil: `turns` shrinking loops beside the generated glove's fist, then the fall. */
export function restCoilGeometry(row: LashHoldRow): TubeGeometry {
  const c = row.made.coil, W = row.coil, points: Vector3[] = [];
  for (let i = 0; i <= W.points; i++) {
    const s = i / W.points, a = -Math.PI / 2 + s * Math.PI * 2 * c.turns / 2, r = c.loopR * (1 - W.shrink * s);
    points.push(new Vector3(W.origin[0] + Math.cos(a) * r * W.squash - s * W.drift[0], W.origin[1] + (Math.sin(a) + 1) * r, W.origin[2] - s * W.drift[1]));
  }
  points.push(...W.fall.map(([x, y, z]) => new Vector3(x, y, z)));
  const geometry = new TubeGeometry(new CatmullRomCurve3(points), W.tubular, c.cord, row.radial, false);
  braidColours(geometry, W.tubular + 1, row.radial + 1, 0, W.a, W.b, row.braid.popper);
  return geometry;
}

/** The helix a heavy lash winds round a caught lever (`runtime/items/lashWeapon.ts` shows it at the lever while the wrap holds). */
export function wrapGeometry(w: LashView['wrap']): TubeGeometry {
  const pts: Vector3[] = [];
  for (let i = 0; i <= w.samples; i++) { const a = (i / w.samples) * Math.PI * 2 * w.turns; pts.push(new Vector3(Math.cos(a) * w.r, (i / w.samples - 0.5) * w.h, Math.sin(a) * w.r)); }
  return new TubeGeometry(new CatmullRomCurve3(pts), w.segments, w.cord, w.sides, false);
}

/**
 * Where the lash leaves the hand, in the hold's frame, as the client always fitted the generated glove: its handle's axis
 * (the mean of the vertices between `collar[0]` and `collar[1]` short of its far end) and its fist (`fist` of the way
 * along) moved to the origin, stood on +Y, turned by `turn` and scaled; the keeper `keeper` short of the far end as the
 * fitted bounds' +X reads it (three refits a geometry's bounds in place on every transform), turned by the grip's pose.
 */
export function lashTip(row: LashHoldRow, glove: BufferGeometry): [number, number, number] {
  glove.computeBoundingBox();
  const b = glove.boundingBox, fit = row.glove, p = glove.getAttribute('position');
  if (b === null) throw new Error('whip-glove has no bounds');
  const x1 = b.max.x - fit.collar[0], x2 = b.max.x - fit.collar[1]; let n = 0, y = 0, z = 0;
  for (let i = 0; i < p.count; i++) if (p.getX(i) > x1 && p.getX(i) < x2) { y += p.getY(i); z += p.getZ(i); n++; }
  const fist = b.min.x + (b.max.x - b.min.x) * fit.fist;
  glove.translate(-fist, n > 0 ? -y / n : -(b.min.y + b.max.y) / 2, n > 0 ? -z / n : -(b.min.z + b.max.z) / 2);
  glove.rotateZ(Math.PI / 2); glove.rotateY(fit.turn); glove.scale(fit.scale, fit.scale, fit.scale);
  const top = (b.max.x - fist - fit.keeper) * fit.scale;
  return new Vector3(0, top, 0).applyEuler(new Euler(...row.made.grip)).toArray();
}

/**
 * The plait's tile as raw RGBA texels (`baked/plait.bin`, deflated; `runtime/items/lashHold.ts` reads them): strand columns
 * round the cord, each leaning 45 deg the other way from its neighbour, so the strands meet in the chevrons a plaited thong
 * shows. Each strand is a raised lozenge (a crown, dark creases between); the normal tile carries that relief and the
 * roughness tile puts a sheen on the crowns only. Three `size`² tiles in a row: the colour (sRGB), the normal, the roughness.
 */
export function plaitTexels(p: PlaitStyle = WHIP_HOLD.plait): Uint8Array {
  const n = p.size, h = new Float32Array(n * n), tone = new Float32Array(n * n);
  const hash = (a: number, b: number): number => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const v = (y + 0.5) / n * p.columns, col = Math.floor(v), cv = v - col, lean = col % 2 === 0 ? 1 : -1;
    const q = (x + 0.5) / n * p.rows + lean * cv, row = Math.floor(q), across = q - row;
    // the strand's width profile (round crown, creased edges) times its fall-off into the column's spine
    const crown = Math.sin(Math.PI * across) ** 0.7 * Math.sin(Math.PI * cv) ** 0.35;
    h[y * n + x] = crown; tone[y * n + x] = hash(row + 17 * col, col * 3.1); // each strand a little lighter or darker
  }
  const out = new Uint8Array(n * n * 12), map = out.subarray(0, n * n * 4), nor = out.subarray(n * n * 4, n * n * 8), rough = out.subarray(n * n * 8);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = y * n + x, c = h[i] ?? 0, t = tone[i] ?? 0.5;
    const dx = (h[y * n + (x + 1) % n] ?? 0) - (h[y * n + (x + n - 1) % n] ?? 0), dy = (h[((y + 1) % n) * n + x] ?? 0) - (h[((y + n - 1) % n) * n + x] ?? 0);
    const k = Math.min(1, Math.max(0, c)), base = 0.55 + 0.45 * k, w = 0.85 + 0.3 * t;
    map[i * 4] = Math.round(Math.min(255, (p.crease[0] + p.crown[0] * base * k) * w)); map[i * 4 + 1] = Math.round(Math.min(255, (p.crease[1] + p.crown[1] * base * k) * w));
    map[i * 4 + 2] = Math.round(Math.min(255, (p.crease[2] + p.crown[2] * base * k) * w)); map[i * 4 + 3] = 255;
    const s = p.relief, nx = -dx * s, ny = -dy * s, l = Math.hypot(nx, ny, 1);
    nor[i * 4] = Math.round(255 * (0.5 + 0.5 * nx / l)); nor[i * 4 + 1] = Math.round(255 * (0.5 + 0.5 * ny / l)); nor[i * 4 + 2] = Math.round(255 * (0.5 + 0.5 / l)); nor[i * 4 + 3] = 255;
    rough[i * 4 + 1] = Math.round(255 * (p.rough[0] - p.rough[1] * k * k)); rough[i * 4 + 3] = 255;
  }
  return out;
}

const kind = (geometry: BufferGeometry): InstancedMesh => new InstancedMesh(geometry, new MeshStandardMaterial(), 1);

/** The lash's bake: its four kinds (no colliders), the hand's `tip` from the generated glove and the loop's `along`. */
export function bakeSignalLash(glove: BufferGeometry, row: LashHoldRow = WHIP_HOLD, view: LashView = WHIP_VIEW): SignalPieceBake {
  const loop = loopGeometry(row);
  return bakePiece(signalPiece('lash', [['coil', kind(restCoilGeometry(row))], ['loop', kind(loop.geometry)], ['cord', kind(cordGeometry(row.lash))], ['wrap', kind(wrapGeometry(view.wrap))]], [],
    { tip: lashTip(row, glove), along: loop.along }));
}
