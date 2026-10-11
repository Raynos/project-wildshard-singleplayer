import { loadRigFile } from "@wildshard/engine/anim/rig";
import { cacheUntilDisposed, retainCachedResources } from "@wildshard/engine/app/cachedAssets";
import { Box3, BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, Uint16BufferAttribute, Vector3, type BufferAttribute, type Object3D, CanvasTexture, LinearMipmapLinearFilter, SRGBColorSpace } from "three";
import { applySurfaceLooks, type SurfaceInputs, type SurfaceLook } from "../systems/looks/surfaceLooks";
import { Rng } from "@wildshard/engine/core/rng";

/**
 * A model library (SHARD-PLATFORM M3; ex a dune shard's generated models): the GLBs a level loads once behind its loading
 * screen and then copies synchronously while it builds, each list driven by rows. Nothing here knows a shard.
 *
 * - facet models: every mesh of the file flattened into one non-indexed geometry in world space: position, the facet
 *   colour (rgb × the baked AO in COLOR_0's alpha, kept down to the row's `aoFloor`) and flat normals;
 * - hero models: the scene as loaded (its own maps on its own UVs), matte and smooth, each material then dressed by the
 *   model's `HdLookRow` (tint, roughness, fog, user flags, surface-look rows);
 * - baked rigs: one skinned geometry whose bone indices and weights ride in `_JOINTS` / `_WEIGHTS`.
 *
 * A file that fails to load is a page fault (`console.error`; the boot smoke and the tests fail on it), never a silent
 * stand-in: the caller's copy is null and the thing it would draw stands undrawn. The helpers below (`fitGeometry`,
 * `withoutTriangles`, `bindRigid`, `smoothColors`, `undrawnRig`, `facetMaterial`) shape the copies.
 */





/** How a hero model's materials are dressed after the matte base: each field optional, applied in this order. */
export interface HdLookRow {
  /** the material colour, linear RGB */
  readonly color?: readonly [number, number, number];
  readonly roughness?: number;
  readonly fog?: boolean;
  /** flags the caller's own passes read off the material's userData */
  readonly userData?: Readonly<Record<string, boolean>>;
  /** surface-look rows installed over the library's surface inputs */
  readonly surface?: readonly SurfaceLook[];
}

/** A model library's files and looks, as data. */
export interface ModelLibraryRows<M extends string, H extends string, R extends string> {
  /** the facet models preloaded, and every facet model's file */
  readonly meshes: readonly M[];
  readonly meshUrls: Readonly<Record<M, string>>;
  /** the hero models preloaded, and every hero model's file */
  readonly hd: readonly H[];
  readonly hdUrls: Readonly<Record<H, string>>;
  /** the baked rigs preloaded, and every rig's file */
  readonly rigs: readonly R[];
  readonly rigUrls: Readonly<Record<R, string>>;
  /** a facet in full occlusion keeps this share of its colour */
  readonly aoFloor: number;
  /** the hero models' dressing, by name */
  readonly hdLooks: Readonly<Partial<Record<H, HdLookRow>>>;
}

/** How a copy is framed: turned `yaw` about +Y, centred on x / z, its lowest point at `floor`, `size` metres by span or height. */
export interface ModelFit { readonly size: number; readonly by: 'span' | 'height'; readonly floor?: number; readonly yaw?: number }

/** A loaded model library: preload once, then take copies. */
export interface ModelLibrary<M extends string, H extends string, R extends string> {
  /** Load every listed model and rig once (a failed one is skipped and faulted). */
  preload: () => Promise<void>;
  /** A copy of a loaded facet model's geometry, or null (not loaded: the caller's code model stands in). */
  mesh: (name: M) => BufferGeometry | null;
  /** A copy of a baked rig with its flat normals recomputed, or null (not loaded: its load was faulted). */
  rig: (name: R) => BufferGeometry | null;
  /** A hero model fitted as `fit`, as a group sharing the loaded geometry and maps; null when it did not load. */
  hd: (name: H, fit: ModelFit) => Group | null;
}

const isMesh = (o: Object3D): o is Mesh => o instanceof Mesh;

/** One mesh's triangles in world space, de-indexed, as plain float32 (meshopt quantizes the attributes). */
function flatten(mesh: Mesh, aoFloor: number): { pos: number[]; col: number[] } {
  const g = mesh.geometry, p = g.getAttribute('position'), c = g.hasAttribute('color') ? g.getAttribute('color') : null;
  const index = g.getIndex(), n = index ? index.count : p.count, pos: number[] = [], col: number[] = [], v = new Vector3();
  for (let k = 0; k < n; k++) {
    const i = index ? index.getX(k) : k;
    v.fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld); pos.push(v.x, v.y, v.z);
    const ao = c?.itemSize === 4 ? aoFloor + (1 - aoFloor) * c.getW(i) : 1;
    col.push((c ? c.getX(i) : 1) * ao, (c ? c.getY(i) : 1) * ao, (c ? c.getZ(i) : 1) * ao);
  }
  return { pos, col };
}

/** A hero material's matte base, then its look row. */
function dressHd(m: MeshStandardMaterial, look: HdLookRow | undefined, inputs: SurfaceInputs): void {
  m.metalness = 0; m.roughness = 0.85; m.flatShading = false;
  if (look !== undefined) {
    if (look.color !== undefined) m.color.setRGB(look.color[0], look.color[1], look.color[2]);
    if (look.roughness !== undefined) m.roughness = look.roughness;
    if (look.fog !== undefined) m.fog = look.fog;
    if (look.userData !== undefined) for (const [key, value] of Object.entries(look.userData)) m.userData[key] = value;
    if (look.surface !== undefined) applySurfaceLooks(m, look.surface, inputs);
  }
  m.needsUpdate = true;
}

/**
 * A model library over `rows`. `fault` opens every page fault a failed file logs (e.g. the shard's name in brackets);
 * `surfaceInputs` are the live uniforms the hero models' surface rows read.
 */
export function createModelLibrary<M extends string, H extends string, R extends string>(rows: ModelLibraryRows<M, H, R>, fault: string, surfaceInputs: SurfaceInputs = {}): ModelLibrary<M, H, R> {
  const ready = new Map<M, BufferGeometry>(), rigs = new Map<R, BufferGeometry>(), hd = new Map<H, Object3D>();
  let loading: Promise<void> | null = null;

  async function load(name: M): Promise<void> {
    try {
      const gltf = await loadRigFile(rows.meshUrls[name]);
      gltf.scene.updateMatrixWorld(true);
      const pos: number[] = [], col: number[] = [];
      gltf.scene.traverse((o) => { if (isMesh(o)) { const f = flatten(o, rows.aoFloor); pos.push(...f.pos); col.push(...f.col); } });
      if (pos.length === 0) throw new Error(`${name}: no mesh`);
      const g = new BufferGeometry();
      g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('color', new Float32BufferAttribute(col, 3));
      g.computeVertexNormals(); g.computeBoundingBox(); retainCachedResources(g); ready.set(name, g);
      cacheUntilDisposed(g, () => { if (ready.get(name) === g) { ready.delete(name); loading = null; } });
    } catch (e: unknown) { console.error(`${fault} the generated model ${name} did not load:`, e); }
  }

  async function loadRig(name: R): Promise<void> {
    try {
      const gltf = await loadRigFile(rows.rigUrls[name]), meshes: Mesh[] = [];
      gltf.scene.traverse((o) => { if (isMesh(o)) meshes.push(o); });
      const loaded = meshes[0]?.geometry;
      if (meshes.length !== 1 || loaded === undefined) throw new Error(`${name}: ${String(meshes.length)} meshes, one baked`);
      const source = loaded.index === null ? loaded : loaded.toNonIndexed();
      for (const key of ['position', 'color', '_joints', '_weights']) if (!source.hasAttribute(key)) throw new Error(`${name}: no ${key}`);
      const p = source.getAttribute('position'), c = source.getAttribute('color'), j = source.getAttribute('_joints'), w = source.getAttribute('_weights');
      const g = new BufferGeometry();
      g.setAttribute('position', new Float32BufferAttribute(p.array, 3)); g.setAttribute('color', new Float32BufferAttribute(c.array, 3));
      g.setAttribute('skinIndex', new Uint16BufferAttribute(Uint16Array.from(j.array), 4)); g.setAttribute('skinWeight', new Float32BufferAttribute(w.array, 4));
      retainCachedResources(g); rigs.set(name, g); source.dispose(); loaded.dispose();
      cacheUntilDisposed(g, () => { if (rigs.get(name) === g) { rigs.delete(name); loading = null; } });
    } catch (e: unknown) { console.error(`${fault} the baked rig ${name} did not load:`, e); }
  }

  async function loadHd(name: H): Promise<void> {
    try {
      const gltf = await loadRigFile(rows.hdUrls[name]), look = rows.hdLooks[name];
      gltf.scene.traverse((o) => {
        if (!isMesh(o)) return;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m instanceof MeshStandardMaterial) dressHd(m, look, surfaceInputs);
      });
      retainCachedResources(gltf.scene); hd.set(name, gltf.scene);
      cacheUntilDisposed(gltf.scene, () => { if (hd.get(name) === gltf.scene) { hd.delete(name); loading = null; } });
    } catch (e: unknown) { console.error(`${fault} the generated model ${name} did not load:`, e); }
  }

  return {
    preload: () => {
      loading ??= Promise.all([...rows.meshes.filter(name => !ready.has(name)).map(load), ...rows.hd.filter(name => !hd.has(name)).map(loadHd),
        ...rows.rigs.filter(name => !rigs.has(name)).map(loadRig)]).then(() => undefined);
      return loading;
    },
    mesh: name => ready.get(name)?.clone() ?? null,
    rig: (name) => { const g = rigs.get(name)?.clone() ?? null; g?.computeVertexNormals(); return g; },
    hd: (name, o) => {
      const src = hd.get(name); if (!src) return null;
      const inner = src.clone(true), holder = new Group(), turn = new Group();
      turn.rotation.y = o.yaw ?? 0; turn.add(inner); holder.add(turn); holder.updateMatrixWorld(true);
      const b = new Box3().setFromObject(holder);
      const span = o.by === 'height' ? b.max.y - b.min.y : Math.max(b.max.x - b.min.x, b.max.z - b.min.z), k = o.size / Math.max(1e-6, span);
      turn.position.set(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
      const out = new Group(); out.add(holder); holder.scale.setScalar(k); holder.position.y = o.floor ?? 0;
      return out;
    },
  };
}

/** A creature that did not load stands undrawn: one zero-area triangle on bone 0 (a species needs a geometry part). */
export function undrawnRig(): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(new Float32Array(9), 3)); g.setAttribute('color', new Float32BufferAttribute(new Float32Array(9), 3));
  g.setAttribute('normal', new Float32BufferAttribute(new Float32Array(9), 3));
  g.setAttribute('skinIndex', new Uint16BufferAttribute(new Uint16Array(12), 4)); g.setAttribute('skinWeight', new Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
  return g;
}

/** The facet models' material: the facet colours, matte (one per model: the caller's scope owns and disposes it). */
export const facetMaterial = (): MeshStandardMaterial => new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, flatShading: true });

/** Fit a geometry into a frame (turned `yaw` radians about +Y first): centred on x / z, its lowest point at `floor`, scaled to `size`. */
export function fitGeometry(g: BufferGeometry, o: ModelFit): BufferGeometry {
  if (o.yaw !== undefined) g.rotateY(o.yaw);
  const b = new Box3().setFromBufferAttribute(g.getAttribute('position') as BufferAttribute);
  const span = o.by === 'height' ? b.max.y - b.min.y : Math.max(b.max.x - b.min.x, b.max.z - b.min.z), k = o.size / Math.max(1e-6, span);
  g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
  g.scale(k, k, k); g.translate(0, o.floor ?? 0, 0); g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}

/** Drop the triangles whose centroid `cut` says to remove (a part the code model animates instead); disposes the input. */
export function withoutTriangles(g: BufferGeometry, cut: (x: number, y: number, z: number) => boolean): BufferGeometry {
  const p = g.getAttribute('position'), c = g.getAttribute('color'), pos: number[] = [], col: number[] = [];
  for (let t = 0; t + 2 < p.count; t += 3) {
    if (cut((p.getX(t) + p.getX(t + 1) + p.getX(t + 2)) / 3, (p.getY(t) + p.getY(t + 1) + p.getY(t + 2)) / 3, (p.getZ(t) + p.getZ(t + 1) + p.getZ(t + 2)) / 3)) continue;
    for (let v = t; v < t + 3; v++) { pos.push(p.getX(v), p.getY(v), p.getZ(v)); col.push(c.getX(v), c.getY(v), c.getZ(v)); }
  }
  const r = new BufferGeometry(); r.setAttribute('position', new Float32BufferAttribute(pos, 3)); r.setAttribute('color', new Float32BufferAttribute(col, 3));
  r.computeVertexNormals(); r.computeBoundingBox(); r.computeBoundingSphere(); g.dispose(); return r;
}

/** Bind every triangle rigidly to the bone `boneOf` names for its centroid (bone indices in the caller's skeleton order). */
export function bindRigid(g: BufferGeometry, boneOf: (x: number, y: number, z: number) => number): BufferGeometry {
  const p = g.getAttribute('position'), n = p.count, index = new Uint16Array(n * 4), weight = new Float32Array(n * 4);
  for (let t = 0; t + 2 < n; t += 3) {
    const bone = boneOf((p.getX(t) + p.getX(t + 1) + p.getX(t + 2)) / 3, (p.getY(t) + p.getY(t + 1) + p.getY(t + 2)) / 3, (p.getZ(t) + p.getZ(t + 1) + p.getZ(t + 2)) / 3);
    for (let v = t; v < t + 3; v++) { index[v * 4] = bone; weight[v * 4] = 1; }
  }
  g.setAttribute('skinIndex', new Uint16BufferAttribute(index, 4)); g.setAttribute('skinWeight', new Float32BufferAttribute(weight, 4));
  return g;
}

/**
 * Averages a facet model's painted colour per vertex position, by `amount` (0 keeps each facet's own shade, 1 the
 * average): facet-painted triangles read as patches; averaged, the paint reads continuous.
 */
export function smoothColors(g: BufferGeometry, amount = 1): void {
  if (!g.hasAttribute('color')) return;
  const p = g.getAttribute('position'), c = g.getAttribute('color'), sum = new Map<string, [number, number, number, number]>();
  const key = (i: number): string => `${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`;
  for (let i = 0; i < p.count; i++) { const k = key(i), v = sum.get(k) ?? [0, 0, 0, 0]; v[0] += c.getX(i); v[1] += c.getY(i); v[2] += c.getZ(i); v[3]++; sum.set(k, v); }
  for (let i = 0; i < p.count; i++) {
    const v = sum.get(key(i)); if (!v) continue;
    c.setXYZ(i, c.getX(i) + (v[0] / v[3] - c.getX(i)) * amount, c.getY(i) + (v[1] / v[3] - c.getY(i)) * amount, c.getZ(i) + (v[2] / v[3] - c.getZ(i)) * amount);
  }
  c.needsUpdate = true;
}

// The canvas atlas (SHARD-PLATFORM M3): a 2D-canvas texture painted from draw steps that are data. A shard lists its
// decals (an engraved strip, a paper talisman, a label sheet) as rows; `paintCanvasAtlas` replays them on one canvas, in
// order, and returns it as a mipmapped sRGB texture. Each step is one canvas call or a small deterministic loop:
//  - `set`: any of fill / stroke style, line width / cap / join, font, text align / baseline, global alpha;
//  - `fillRect` / `strokeRect`; `save` / `restore` / `translate` / `scale` / `rotate` (angles in half turns, × π);
//  - `path`: one beginPath, its segments (M / L / A: arcs with angles × π) and a stroke or fill; with a scale `s` every
//    coordinate and radius is `s × value`, offset by `at` when given;
//  - `text`: fillText at a point;
//  - `radial`: a radial gradient (its stops) filling a rectangle;
//  - `speckle`: n seeded random marks (a Park–Miller sequence) in two styles over a rectangle (paper fibre);
//  - `grain`: n marks on a fixed stride pattern over a rectangle (a quieter fibre).
// Drawn at `scale` (the canvas `scale` times the authored size, every coordinate kept): a phone tier halves an atlas.
//
// Procedural painters (a fern frond, a pebble scatter, an end-grain disc) are the same rows with expressions: a value is
// a number or an expression string (`'128 + sin(t * 2.2) * 6'`), evaluated with JavaScript's operators, precedence and
// left-to-right order, so every double is the one the hand-written painter computed. A style string holding `{expr}`
// parts is a template (`'rgb({52 + hue * 6},{82 + hue * 8},34)'`, each part as JavaScript's `${}` prints it).
//  - `rng`: the painter's random stream, the engine's `Rng` from a seed (`next()` and `range(a, b)` in expressions);
//  - `let` / `assign` / `fn` / `list` / `push`: block-scoped values, expression functions and lists of tuples;
//  - `loop` (n times) / `for` (from, while, next) / `each` (over numbers or a list) / `if`: control, each body a scope (`if` runs `yes` or `no`);
//  - `call`: one path or rect call with expression arguments; `gradient`: a linear or radial gradient as the fill or
//    stroke style; `valueNoise`: an octave value-noise ImageData from the stream (grey, opaque) put at the origin.
// Expression built-ins: PI, sin, cos, tan, atan2, sqrt, abs, floor, ceil, round, min, max, next, range, and the vars
// the caller passes (a level's seed).



/** one path segment: move, line, or arc (centre, radius, start and end angle in half turns, and when given whether it
 *  runs counter-clockwise) */
export type CanvasSegment = readonly ['M', number, number] | readonly ['L', number, number] | readonly ['A', number, number, number, number, number] | readonly ['A', number, number, number, number, number, boolean];

/** a number, or an expression string evaluated in the painter's scope */
export type CanvasExpr = number | string;

/** the canvas calls a `call` step makes, its arguments expressions */
export type CanvasCall = 'beginPath' | 'closePath' | 'fill' | 'stroke' | 'moveTo' | 'lineTo' | 'arc' | 'ellipse' | 'quadraticCurveTo' | 'bezierCurveTo' | 'fillRect' | 'strokeRect' | 'translate' | 'scale' | 'rotate' | 'save' | 'restore';

/** a draw step as data */
export type CanvasStep =
  | { readonly op: 'set'; readonly fill?: string; readonly stroke?: string; readonly width?: CanvasExpr; readonly cap?: CanvasLineCap; readonly join?: CanvasLineJoin; readonly font?: string; readonly align?: CanvasTextAlign; readonly baseline?: CanvasTextBaseline; readonly alpha?: CanvasExpr }
  | { readonly op: 'fillRect' | 'strokeRect'; readonly x: number; readonly y: number; readonly w: number; readonly h: number }
  | { readonly op: 'save' | 'restore' }
  | { readonly op: 'translate' | 'scale'; readonly x: number; readonly y: number }
  | { readonly op: 'rotate'; readonly turns: number }
  | { readonly op: 'path'; readonly segs: readonly CanvasSegment[]; readonly s?: number; readonly at?: readonly [number, number]; readonly fill?: boolean }
  | { readonly op: 'text'; readonly text: string; readonly x: number; readonly y: number }
  | { readonly op: 'radial'; readonly from: readonly [number, number, number]; readonly to: readonly [number, number, number]; readonly stops: readonly (readonly [number, string])[]; readonly x: number; readonly y: number; readonly w: number; readonly h: number }
  | { readonly op: 'speckle'; readonly n: number; readonly seed: number; readonly split: number; readonly styles: readonly [string, string]; readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly mark: readonly [number, number, number, number] }
  | { readonly op: 'grain'; readonly n: number; readonly stride: readonly [number, number]; readonly mark: readonly [number, number, number, number]; readonly x: number; readonly y: number; readonly w: number; readonly h: number }
  | { readonly op: 'rng'; readonly seed: CanvasExpr }
  | { readonly op: 'let' | 'assign'; readonly vars: readonly (readonly [string, CanvasExpr])[] }
  | { readonly op: 'fn'; readonly name: string; readonly params: readonly string[]; readonly body: string }
  | { readonly op: 'list'; readonly name: string }
  | { readonly op: 'push'; readonly list: string; readonly vals: readonly CanvasExpr[] }
  | { readonly op: 'loop'; readonly v: string; readonly n: CanvasExpr; readonly body: readonly CanvasStep[] }
  | { readonly op: 'for'; readonly v: string; readonly from: CanvasExpr; readonly while: string; readonly next: string; readonly body: readonly CanvasStep[] }
  | { readonly op: 'each'; readonly v: string | readonly string[]; readonly of: string | readonly number[]; readonly body: readonly CanvasStep[] }
  | { readonly op: 'if'; readonly cond: string; readonly yes: readonly CanvasStep[]; readonly no?: readonly CanvasStep[] }
  | { readonly op: 'call'; readonly fn: CanvasCall; readonly args?: readonly CanvasExpr[] }
  | { readonly op: 'gradient'; readonly kind: 'linear' | 'radial'; readonly args: readonly CanvasExpr[]; readonly stops: readonly (readonly [CanvasExpr, string])[]; readonly to?: 'fill' | 'stroke' }
  | { readonly op: 'valueNoise'; readonly size: number; readonly octaves: readonly number[]; readonly amp: number; readonly gain: number };

/** an atlas as data: its authored size, the draw scale (undefined: no scale call) and its steps */
export interface CanvasAtlasRow { readonly w: number; readonly h: number; readonly steps: readonly CanvasStep[] }

// ───────────────────────────── expressions ─────────────────────────────

type Value = number | string | boolean;
type Compiled = (s: Scope) => Value;
interface PaintState { readonly g: CanvasRenderingContext2D; rng: Rng | null }
interface ExprFn { readonly params: readonly string[]; readonly body: Compiled; readonly scope: Scope }

class Scope {
  readonly vars = new Map<string, Value>();
  readonly lists = new Map<string, Value[][]>();
  readonly fns = new Map<string, ExprFn>();
  readonly parent: Scope | null;
  readonly paint: PaintState;
  constructor(parent: Scope | null, paint: PaintState) { this.parent = parent; this.paint = paint; }
  child(): Scope { return new Scope(this, this.paint); }
  owner<K>(pick: (s: Scope) => Map<string, K>, name: string): Map<string, K> {
    if (pick(this).has(name)) return pick(this);
    if (this.parent === null) throw new Error(`canvas painter: unknown name ${name}`);
    return this.parent.owner(pick, name);
  }
  get(name: string): Value { const v = this.owner((s) => s.vars, name).get(name); if (v === undefined) throw new Error(name); return v; }
  list(name: string): Value[][] { const l = this.owner((s) => s.lists, name).get(name); if (l === undefined) throw new Error(name); return l; }
  fn(name: string): ExprFn | undefined { return this.fns.get(name) ?? this.parent?.fn(name); }
}

const truthy = (v: Value): boolean => (typeof v === 'number' ? v !== 0 && !Number.isNaN(v) : typeof v === 'string' ? v !== '' : v);
function num(v: Value): number {
  if (typeof v !== 'number') throw new Error(`canvas painter: ${String(v)} is not a number`);
  return v;
}
function stream(s: Scope): Rng {
  const r = s.paint.rng;
  if (r === null) throw new Error('canvas painter: no rng step before next() / range()');
  return r;
}
const MATH: Readonly<Record<string, (a: readonly number[]) => number>> = {
  sin: (a) => Math.sin(at(a, 0)), cos: (a) => Math.cos(at(a, 0)), tan: (a) => Math.tan(at(a, 0)), atan2: (a) => Math.atan2(at(a, 0), at(a, 1)),
  sqrt: (a) => Math.sqrt(at(a, 0)), abs: (a) => Math.abs(at(a, 0)), floor: (a) => Math.floor(at(a, 0)), ceil: (a) => Math.ceil(at(a, 0)),
  round: (a) => Math.round(at(a, 0)), min: (a) => Math.min(...a), max: (a) => Math.max(...a),
};
function at(a: readonly number[], i: number): number {
  const v = a[i];
  if (v === undefined) throw new Error('canvas painter: missing argument');
  return v;
}

const TOKEN = /\s*(?:(\d+(?:\.\d*)?(?:[eE][-+]?\d+)?|\.\d+(?:[eE][-+]?\d+)?)|([A-Za-z_]\w*)|'([^']*)'|(\*\*|===|!==|<=|>=|&&|\|\||[-+*/%<>()?:,!]))/yu;
const BINARY: Readonly<Record<string, (a: number, b: number) => Value>> = {
  '+': (a, b) => a + b, '-': (a, b) => a - b, '*': (a, b) => a * b, '/': (a, b) => a / b, '%': (a, b) => a % b, '**': (a, b) => a ** b,
  '<': (a, b) => a < b, '<=': (a, b) => a <= b, '>': (a, b) => a > b, '>=': (a, b) => a >= b,
};
const LEVELS: readonly (readonly string[])[] = [['===', '!=='], ['<', '<=', '>', '>='], ['+', '-'], ['*', '/', '%']];

interface Token { readonly k: 'n' | 'id' | 's' | 'op'; readonly t: string }
function tokens(src: string): Token[] {
  const toks: Token[] = [];
  TOKEN.lastIndex = 0;
  while (TOKEN.lastIndex < src.length) {
    if (/^\s*$/u.test(src.slice(TOKEN.lastIndex))) break;
    const m = TOKEN.exec(src);
    if (m === null) throw new Error(`canvas painter: cannot read "${src}" at ${TOKEN.lastIndex}`);
    if (m[1] !== undefined) toks.push({ k: 'n', t: m[1] });
    else if (m[2] !== undefined) toks.push({ k: 'id', t: m[2] });
    else if (m[3] !== undefined) toks.push({ k: 's', t: m[3] });
    else toks.push({ k: 'op', t: m[4] ?? '' });
  }
  return toks;
}

/** a recursive-descent parse of one expression into a closure (JavaScript's precedence, associativity and order) */
class Parser {
  private p = 0;
  private readonly toks: readonly Token[];
  private readonly src: string;
  constructor(src: string) { this.src = src; this.toks = tokens(src); }
  parse(): Compiled {
    const out = this.ternary();
    if (this.p !== this.toks.length) throw new Error(`canvas painter: trailing input in "${this.src}"`);
    return out;
  }
  private peek(t: string): boolean { const k = this.toks[this.p]; return k?.k === 'op' && k.t === t; }
  private eat(t: string): void { if (!this.peek(t)) throw new Error(`canvas painter: expected ${t} in "${this.src}"`); this.p++; }
  private ternary(): Compiled {
    const c = this.or();
    if (!this.peek('?')) return c;
    this.p++;
    const a = this.ternary(); this.eat(':'); const b = this.ternary();
    return (s) => (truthy(c(s)) ? a(s) : b(s));
  }
  private or(): Compiled {
    let l = this.and();
    while (this.peek('||')) { this.p++; const a = l, b = this.and(); l = (s) => { const v = a(s); return truthy(v) ? v : b(s); }; }
    return l;
  }
  private and(): Compiled {
    let l = this.level(0);
    while (this.peek('&&')) { this.p++; const a = l, b = this.level(0); l = (s) => { const v = a(s); return truthy(v) ? b(s) : v; }; }
    return l;
  }
  private level(i: number): Compiled {
    const ops = LEVELS[i];
    if (ops === undefined) return this.unary();
    let l = this.level(i + 1);
    for (let t = this.toks[this.p]; t?.k === 'op' && ops.includes(t.t); t = this.toks[this.p]) {
      this.p++;
      const a = l, b = this.level(i + 1), op = t.t;
      if (op === '===') l = (s) => a(s) === b(s);
      else if (op === '!==') l = (s) => a(s) !== b(s);
      else { const f = BINARY[op]; if (f === undefined) throw new Error(op); l = (s) => f(num(a(s)), num(b(s))); }
    }
    return l;
  }
  private unary(): Compiled {
    if (this.peek('-')) { this.p++; const a = this.unary(); return (s) => -num(a(s)); }
    if (this.peek('!')) { this.p++; const a = this.unary(); return (s) => !truthy(a(s)); }
    const base = this.primary();
    if (!this.peek('**')) return base;
    this.p++;
    const e = this.unary();
    return (s) => num(base(s)) ** num(e(s));
  }
  private primary(): Compiled {
    const t = this.toks[this.p++];
    if (t === undefined) throw new Error(`canvas painter: "${this.src}" ends early`);
    if (t.k === 'n') { const v = Number(t.t); return () => v; }
    if (t.k === 's') { const v = t.t; return () => v; }
    if (t.k === 'op') { if (t.t !== '(') throw new Error(`canvas painter: unexpected ${t.t} in "${this.src}"`); const e = this.ternary(); this.eat(')'); return e; }
    const name = t.t;
    if (!this.peek('(')) return name === 'PI' ? () => Math.PI : (s) => s.get(name);
    this.p++;
    const args: Compiled[] = [];
    while (!this.peek(')')) { args.push(this.ternary()); if (!this.peek(')')) this.eat(','); }
    this.p++;
    return callOf(name, args);
  }
}

function callOf(name: string, args: readonly Compiled[]): Compiled {
  if (name === 'next') return (s) => stream(s).next();
  if (name === 'range') return (s) => { const a = num(argOf(args, 0)(s)), b = num(argOf(args, 1)(s)); return stream(s).range(a, b); };
  const m = MATH[name];
  if (m !== undefined) return (s) => m(args.map((a) => num(a(s))));
  return (s) => {
    const f = s.fn(name);
    if (f === undefined) throw new Error(`canvas painter: unknown function ${name}`);
    const vals = args.map((a) => a(s)), inner = f.scope.child();
    for (const [i, n] of f.params.entries()) inner.vars.set(n, vals[i] ?? 0);
    return f.body(inner);
  };
}
function argOf(args: readonly Compiled[], i: number): Compiled {
  const a = args[i];
  if (a === undefined) throw new Error('canvas painter: missing argument');
  return a;
}

const compiled = new Map<string, Compiled>();
function compile(src: string): Compiled {
  let c = compiled.get(src);
  if (c === undefined) { c = new Parser(src).parse(); compiled.set(src, c); }
  return c;
}
const value = (e: CanvasExpr, s: Scope): Value => (typeof e === 'number' ? e : compile(e)(s));
const number = (e: CanvasExpr, s: Scope): number => (typeof e === 'number' ? e : num(compile(e)(s)));

const templates = new Map<string, readonly (string | Compiled)[]>();
/** a style string: literal, or a template whose `{expr}` parts print as JavaScript's `${}` does */
function style(t: string, s: Scope): string {
  if (!t.includes('{')) return t;
  let parts = templates.get(t);
  if (parts === undefined) {
    const out: (string | Compiled)[] = [];
    for (const piece of t.split(/(\{[^}]*\})/u)) if (piece !== '') out.push(piece.startsWith('{') ? compile(piece.slice(1, -1)) : piece);
    parts = out;
    templates.set(t, parts);
  }
  let r = '';
  for (const part of parts) r += typeof part === 'string' ? part : String(part(s));
  return r;
}

// ───────────────────────────── steps ─────────────────────────────

function set(g: CanvasRenderingContext2D, st: Extract<CanvasStep, { op: 'set' }>, s: Scope): void {
  if (st.fill !== undefined) g.fillStyle = style(st.fill, s);
  if (st.stroke !== undefined) g.strokeStyle = style(st.stroke, s);
  if (st.width !== undefined) g.lineWidth = number(st.width, s);
  if (st.cap !== undefined) g.lineCap = st.cap;
  if (st.join !== undefined) g.lineJoin = st.join;
  if (st.font !== undefined) g.font = st.font;
  if (st.align !== undefined) g.textAlign = st.align;
  if (st.baseline !== undefined) g.textBaseline = st.baseline;
  if (st.alpha !== undefined) g.globalAlpha = number(st.alpha, s);
}

function path(g: CanvasRenderingContext2D, p: Extract<CanvasStep, { op: 'path' }>): void {
  const k = p.s, at0 = p.at;
  // a coordinate: the scaled value, offset by `at` (the same arithmetic an authored `x + s * k` performs)
  const cx = (v: number): number => (k === undefined ? v : at0 === undefined ? k * v : at0[0] + k * v);
  const cy = (v: number): number => (k === undefined ? v : at0 === undefined ? k * v : at0[1] + k * v);
  const r = (v: number): number => (k === undefined ? v : k * v);
  g.beginPath();
  for (const seg of p.segs) {
    if (seg[0] === 'M') g.moveTo(cx(seg[1]), cy(seg[2]));
    else if (seg[0] === 'L') g.lineTo(cx(seg[1]), cy(seg[2]));
    else if (seg.length === 7) g.arc(cx(seg[1]), cy(seg[2]), r(seg[3]), Math.PI * seg[4], Math.PI * seg[5], seg[6]);
    else g.arc(cx(seg[1]), cy(seg[2]), r(seg[3]), Math.PI * seg[4], Math.PI * seg[5]);
  }
  if (p.fill === true) g.fill(); else g.stroke();
}

function call(g: CanvasRenderingContext2D, fn: CanvasCall, a: readonly number[]): void {
  switch (fn) {
    case 'beginPath': g.beginPath(); break;
    case 'closePath': g.closePath(); break;
    case 'fill': g.fill(); break;
    case 'stroke': g.stroke(); break;
    case 'save': g.save(); break;
    case 'restore': g.restore(); break;
    case 'moveTo': g.moveTo(at(a, 0), at(a, 1)); break;
    case 'lineTo': g.lineTo(at(a, 0), at(a, 1)); break;
    case 'translate': g.translate(at(a, 0), at(a, 1)); break;
    case 'scale': g.scale(at(a, 0), at(a, 1)); break;
    case 'rotate': g.rotate(at(a, 0)); break;
    case 'arc': g.arc(at(a, 0), at(a, 1), at(a, 2), at(a, 3), at(a, 4)); break;
    case 'ellipse': g.ellipse(at(a, 0), at(a, 1), at(a, 2), at(a, 3), at(a, 4), at(a, 5), at(a, 6)); break;
    case 'quadraticCurveTo': g.quadraticCurveTo(at(a, 0), at(a, 1), at(a, 2), at(a, 3)); break;
    case 'bezierCurveTo': g.bezierCurveTo(at(a, 0), at(a, 1), at(a, 2), at(a, 3), at(a, 4), at(a, 5)); break;
    case 'fillRect': g.fillRect(at(a, 0), at(a, 1), at(a, 2), at(a, 3)); break;
    case 'strokeRect': g.strokeRect(at(a, 0), at(a, 1), at(a, 2), at(a, 3)); break;
    default: { const unknown: never = fn; throw new Error(`unknown canvas call ${String(unknown)}`); }
  }
}

/** octave value noise from the stream: one n × n lattice of `next()` per octave, smoothstep-blended, amplitudes from
 *  `amp` falling by `gain`, written grey and opaque to a size × size ImageData put at the origin */
function valueNoise(g: CanvasRenderingContext2D, st: Extract<CanvasStep, { op: 'valueNoise' }>, rng: Rng): void {
  const sz = st.size, img = g.createImageData(sz, sz);
  const oct = st.octaves.map((n) => { const a = new Float32Array(n * n); for (let i = 0; i < a.length; i++) a[i] = rng.next(); return { n, a }; });
  const sm = (t: number): number => t * t * (3 - 2 * t);
  for (let y = 0; y < sz; y++) for (let x = 0; x < sz; x++) {
    let v = 0, amp = st.amp, sum = 0;
    for (const { n, a } of oct) {
      const fx = (x / sz) * n, fy = (y / sz) * n, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = sm(fx - x0), ty = sm(fy - y0);
      const q = (i: number, j: number): number => a[((j + n) % n) * n + ((i + n) % n)] ?? 0;
      const vv = (q(x0, y0) * (1 - tx) + q(x0 + 1, y0) * tx) * (1 - ty) + (q(x0, y0 + 1) * (1 - tx) + q(x0 + 1, y0 + 1) * tx) * ty;
      v += vv * amp; sum += amp; amp *= st.gain;
    }
    const b = Math.floor((v / sum) * 255), i = (y * sz + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = b; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}

function run(g: CanvasRenderingContext2D, steps: readonly CanvasStep[], sc: Scope): void {
  for (const s of steps) {
    switch (s.op) {
      case 'set': set(g, s, sc); break;
      case 'fillRect': g.fillRect(s.x, s.y, s.w, s.h); break;
      case 'strokeRect': g.strokeRect(s.x, s.y, s.w, s.h); break;
      case 'save': g.save(); break;
      case 'restore': g.restore(); break;
      case 'translate': g.translate(s.x, s.y); break;
      case 'scale': g.scale(s.x, s.y); break;
      case 'rotate': g.rotate(Math.PI * s.turns); break;
      case 'path': path(g, s); break;
      case 'text': g.fillText(s.text, s.x, s.y); break;
      case 'radial': {
        const grd = g.createRadialGradient(s.from[0], s.from[1], s.from[2], s.to[0], s.to[1], s.to[2]);
        for (const [stop, colour] of s.stops) grd.addColorStop(stop, colour);
        g.fillStyle = grd;
        g.fillRect(s.x, s.y, s.w, s.h);
        break;
      }
      case 'speckle': {
        let q = s.seed;
        const rnd = (): number => { q = (q * 16807) % 2147483647; return q / 2147483647; };
        const [w0, w1, h0, h1] = s.mark;
        for (let i = 0; i < s.n; i++) {
          g.fillStyle = rnd() < s.split ? s.styles[0] : s.styles[1];
          g.fillRect(s.x + rnd() * s.w, s.y + rnd() * s.h, w0 + rnd() * w1, h0 + rnd() * h1);
        }
        break;
      }
      case 'grain': {
        const [w0, wm, h0, hm] = s.mark;
        for (let i = 0; i < s.n; i++) g.fillRect(s.x + ((i * s.stride[0]) % s.w), s.y + ((i * s.stride[1]) % s.h), w0 + (i % wm), h0 + (i % hm));
        break;
      }
      case 'rng': sc.paint.rng = new Rng(number(s.seed, sc)); break;
      case 'let': for (const [n, e] of s.vars) sc.vars.set(n, value(e, sc)); break;
      case 'assign': for (const [n, e] of s.vars) { const v = value(e, sc); sc.owner((x) => x.vars, n).set(n, v); } break;
      case 'fn': sc.fns.set(s.name, { params: s.params, body: compile(s.body), scope: sc }); break;
      case 'list': sc.lists.set(s.name, []); break;
      case 'push': { const l = sc.list(s.list); l.push(s.vals.map((e) => value(e, sc))); break; }
      case 'loop': { const n = number(s.n, sc); for (let i = 0; i < n; i++) { const it = sc.child(); it.vars.set(s.v, i); run(g, s.body, it); } break; }
      case 'for': {
        for (let cur = number(s.from, sc); ;) {
          const it = sc.child(); it.vars.set(s.v, cur);
          if (!truthy(compile(s.while)(it))) break;
          run(g, s.body, it);
          cur = num(compile(s.next)(it));
        }
        break;
      }
      case 'each': {
        if (typeof s.of === 'string') {
          const names = typeof s.v === 'string' ? [s.v] : s.v;
          for (const row of sc.list(s.of)) { const it = sc.child(); for (const [i, n] of names.entries()) it.vars.set(n, row[i] ?? 0); run(g, s.body, it); }
        } else for (const v of s.of) { const it = sc.child(); it.vars.set(typeof s.v === 'string' ? s.v : (s.v[0] ?? ''), v); run(g, s.body, it); }
        break;
      }
      case 'if': {
        if (truthy(compile(s.cond)(sc))) run(g, s.yes, sc.child());
        else if (s.no !== undefined) run(g, s.no, sc.child());
        break;
      }
      case 'call': call(g, s.fn, (s.args ?? []).map((e) => number(e, sc))); break;
      case 'gradient': {
        const a = s.args.map((e) => number(e, sc));
        const grd = s.kind === 'linear' ? g.createLinearGradient(at(a, 0), at(a, 1), at(a, 2), at(a, 3)) : g.createRadialGradient(at(a, 0), at(a, 1), at(a, 2), at(a, 3), at(a, 4), at(a, 5));
        for (const [stop, colour] of s.stops) grd.addColorStop(number(stop, sc), style(colour, sc));
        if (s.to === 'stroke') g.strokeStyle = grd; else g.fillStyle = grd;
        break;
      }
      case 'valueNoise': valueNoise(g, s, stream(sc)); break;
      default: {
        const unknown: never = s;
        throw new Error(`unknown canvas step ${JSON.stringify(unknown)}`);
      }
    }
  }
}

/** replay an atlas's steps on a 2D context (already sized and scaled); `vars` seeds the expressions' scope (a level seed) */
export function paintSteps(g: CanvasRenderingContext2D, steps: readonly CanvasStep[], vars: Readonly<Record<string, number>> = {}): void {
  const root = new Scope(null, { g, rng: null });
  for (const [k, v] of Object.entries(vars)) root.vars.set(k, v);
  run(g, steps, root);
}

/** paint a row on a new canvas of its size (no scale call: a step scales when the painter did) and return the canvas */
export function paintCanvas(row: CanvasAtlasRow, vars: Readonly<Record<string, number>> = {}): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = row.w;
  cv.height = row.h;
  const g = cv.getContext('2d');
  if (g === null) throw new Error('2d canvas unavailable');
  paintSteps(g, row.steps, vars);
  return cv;
}

/** paint an atlas row on a new canvas at `scale` (undefined: no scale call) and return it as a mipmapped sRGB texture */
export function paintCanvasAtlas(row: CanvasAtlasRow, scale?: number): CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = row.w * (scale ?? 1);
  cv.height = row.h * (scale ?? 1);
  const g = cv.getContext('2d');
  if (g === null) throw new Error('2d canvas unavailable');
  if (scale !== undefined) g.scale(scale, scale); // preserve all authored UVs and drawing coordinates at any resolution
  paintSteps(g, row.steps);
  const tex = new CanvasTexture(cv);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.anisotropy = 8;
  return tex;
}
