/**
 * The material graph IR (SHARD-PLATFORM SF59 step 3, G155; `docs/design/mmo/research/sf59-tsl-spike.md` §4): a typed,
 * versioned graph of approved nodes that a material (`family: "graph"`) or a post pass points to. Content carries this
 * data and never shader code: the compiler (`graph/compile.ts`, loaded lazily through `render/graphBackend.ts`) maps each
 * node to a TSL call in our own code (the MaterialXLoader pattern), so three's `NodeLoader`, `CodeNode` and `glslFn` stay
 * out of reach of content (§2.9).
 *
 * The shape (version 1, the starter vocabulary; §4 lists the ≈ 60 the format grows to):
 * - `nodes`: id → `{ op, in?, … }`; an input is another node's id or a literal number / 2–4 number array;
 * - `stages`: `vertex.offset` (a displacement in the mesh's model space, added after an instance's own transform: an
 *   instanced mesh's `positionLocal` already carries it; `positionGeometry` is the vertex before it), `surface` (colour,
 *   alpha, cutoff, emissive, roughness, metalness, occlusion), `lighting` (the lighting model: see below), `outline` (the
 *   inverted-hull second draw: see below), `post` (a screen pass over `sceneColour`, with SF59 (2b)'s taps `sceneColourAt`,
 *   `sceneDepth` and `sceneNormal`, each input one sampler: `inputs` in the validation names those a pass reads); the engine epilogue (fog, the CSM
 *   cascade gate, the tent PCF, the shadow fade) is appended by the back-end and is not a stage a graph can skip;
 * - `outline` (SF59 step 7, the ink outline as a render state the format owns, not a free one): a second draw of the
 *   same geometry with a fixed render state: back faces only, depth tested and written, opaque, unlit, fogged by the
 *   epilogue, casting no shadow. `offset` (vec3, the vertex place, model space like `vertex.offset`) pushes the hull out
 *   (typically along `normalLocal`, scaled by the distance to the camera for a constant screen width) and `colour`
 *   (vec3, a fragment place without the light inputs) is its ink. It doubles the mesh's draws and vertex work and adds
 *   no per-pixel lighting, the cheapest true outline on the phone tier (a `sceneDepth` edge filter would cost a depth
 *   target plus ≈ 9 taps a pixel at 2× over the whole frame);
 * - `lighting` (SF59 step 6, the approved lighting-model stage; a `standard` material only): `sun` is the radiance the
 *   sun adds, built per directional light (the sky rig's cascades are one sun) from the engine's light inputs
 *   (`sunDirection`, `sunColour` unshadowed, `sunShadow` the cast-shadow ratio, with `normalView`, `viewDirection`,
 *   `albedo`); `ambient` replaces the indirect diffuse (from `irradiance`); `sunSpecular` scales the physical model's own
 *   specular for the sun (absent: the model is diffuse only, no specular at all); `grade` maps the lit colour
 *   (`litColour`, emissive included) to the colour the output transform receives (a graded material is not tone mapped).
 *   Every other light keeps the physical model's diffuse. Same vocabulary, no code nodes, constant loops only, the same
 *   budget. The `sun` sub-graph runs once per directional light: its light-dependent nodes (those reading `sunDirection`,
 *   `sunColour` or `sunShadow`, directly or through their inputs) count `cascades` times in the instruction estimate
 *   (`SUN_CASCADES`, the sky rig's three, by default); its light-free part is built once and shared, so it counts once;
 * - `params`: typed uniforms with ranges, each optionally bound to a day key or a declared public shard-state field.
 *   A binding moves a value, never the program (§2.6);
 * - loops have a constant count (`loop`, at most `LOOP_MAX` iterations), so the cost is known before compile;
 * - a budget per program (node count, samplers, an instruction estimate) that validation refuses past.
 *
 * Pure data and checks: this module imports no three.js, so the shardfile validator can use it on any machine.
 */

/** the IR version a graph declares; a graph of another version is refused (the lighting stage is additive: still version 1) */
export const GRAPH_IR_VERSION = 1;
/** the most iterations a `loop` node may run */
export const LOOP_MAX = 16;
/** the directional lights a `sun` sub-graph is built for by default: the sky rig's three CSM cascades */
export const SUN_CASCADES = 3;
/** the most cascades a validation may count (three's CSM tops out at four here) */
export const SUN_CASCADES_MAX = 4;

/** a value's type inside a graph */
export type GraphValueType = 'float' | 'vec2' | 'vec3' | 'vec4' | 'bool';
/** a literal input: a float or a 2–4 component vector */
export type GraphLiteral = number | readonly number[];
/** an input: another node's id, or a literal */
export type GraphRef = string | GraphLiteral;

/** one node of a graph */
export interface GraphNode {
  readonly op: string;
  readonly in?: readonly GraphRef[];
  /** `const`: the value */
  readonly value?: GraphLiteral;
  /** `param`, `texture`: the param's name */
  readonly param?: string;
  /** `swizzle`: the components, e.g. `"xz"` */
  readonly mask?: string;
  /** `loop`: the iteration count (a constant, 1 … LOOP_MAX) */
  readonly count?: number;
  /** `loop`: the body, run `count` times; inside it `acc` is the running value and `index` the iteration (a float) */
  readonly body?: GraphLoopBody;
}
/** a loop's body: its own nodes (they may read the outer graph's nodes too) and the node that is the next `acc` */
export interface GraphLoopBody {
  readonly nodes: Readonly<Record<string, GraphNode>>;
  readonly out: GraphRef;
}

/** a param's type; a colour is written in sRGB and arrives linear, a texture names an admitted file */
export type GraphParamType = 'float' | 'vec2' | 'vec3' | 'vec4' | 'colour' | 'texture';
/** where a bound param's value comes from: a day-key channel or a declared public numeric shard-state field */
export type GraphBinding = { readonly day: string } | { readonly state: string };
/** a typed param: a uniform the graph reads */
export interface GraphParam {
  readonly type: GraphParamType;
  readonly value: GraphLiteral | string;
  readonly min?: number;
  readonly max?: number;
  readonly bind?: GraphBinding;
}

/** the surface stage's outputs (each optional; an absent one keeps the lighting model's default) */
export interface GraphSurface {
  readonly colour?: GraphRef;
  readonly alpha?: GraphRef;
  readonly alphaCutoff?: number;
  readonly emissive?: GraphRef;
  readonly roughness?: GraphRef;
  readonly metalness?: GraphRef;
  readonly occlusion?: GraphRef;
}
/** the vertex stage: an object-space offset; `shadow` (a matching depth variant) is refused until the back-end emits one (§2.5) */
export interface GraphVertexOffset {
  readonly offset: GraphRef;
  readonly shadow?: boolean;
}
/**
 * The lighting-model stage (a `standard` material only): what the sun adds, the ambient term, the sun's share of the
 * physical specular and the per-pixel grade after lighting (the module comment says what each reads).
 */
export interface GraphLighting {
  /** vec3: the radiance one directional light adds (built per cascade), added to the direct diffuse */
  readonly sun: GraphRef;
  /** float: the factor on the physical model's specular from the unshadowed sun (absent: no specular at all) */
  readonly sunSpecular?: GraphRef;
  /** vec3: the indirect diffuse radiance, from `irradiance` (absent: irradiance × albedo / π) */
  readonly ambient?: GraphRef;
  /** vec3: the lit colour (`litColour`) → the colour the output transform receives; a graded material is not tone mapped */
  readonly grade?: GraphRef;
}
/**
 * The outline stage: the inverted-hull second draw (back faces, depth tested and written, opaque, unlit, fogged, no
 * shadow; the module comment says why this one render state and not a free one).
 */
export interface GraphOutline {
  /** vec3: the hull's displacement in model space (the vertex place, as `vertex.offset`) */
  readonly offset: GraphRef;
  /** vec3: the ink colour (linear; a fragment place without the light inputs) */
  readonly colour: GraphRef;
}
/** the stages */
export interface GraphStages {
  readonly 'vertex.offset'?: GraphVertexOffset;
  readonly surface?: GraphSurface;
  readonly lighting?: GraphLighting;
  readonly outline?: GraphOutline;
  readonly post?: { readonly colour: GraphRef };
}
/** a graph */
export interface GraphIr {
  readonly version: typeof GRAPH_IR_VERSION;
  /** a material (vertex.offset + surface) or a screen pass (post) */
  readonly kind: 'material' | 'post';
  /** a material's lighting model: three's physical standard model, or unlit */
  readonly model?: 'standard' | 'unlit';
  readonly doubleSided?: boolean;
  /** one normal per triangle (the toon family's faceted look): `normalView` is the face's */
  readonly flatShading?: boolean;
  readonly params?: Readonly<Record<string, GraphParam>>;
  readonly nodes: Readonly<Record<string, GraphNode>>;
  readonly stages: GraphStages;
}

/** the per-program ceilings validation refuses past */
export interface GraphBudget {
  readonly nodes: number;
  readonly samplers: number;
  readonly instructions: number;
}
/** the default ceilings (a starter graph: the measure preset is ≈ 60 nodes, ≈ 170 instructions) */
export const DEFAULT_GRAPH_BUDGET: GraphBudget = { nodes: 160, samplers: 4, instructions: 480 };

/** Raw graph JSON bounds, enforced before typing or compiler work; trusted presets supply their own node budget. */
export const GRAPH_ADMISSION_LIMITS = Object.freeze({ bytes: 64_000, depth: 64 });
/** Check JSON bytes, all nested nodes and inert structure without invoking authored getters or toJSON methods. */
export function graphAdmissionErrors(input: unknown, nodeLimit = DEFAULT_GRAPH_BUDGET.nodes): string[] {
  type Entry = { value: unknown; depth: number; nodes: boolean } | { leave: object };
  const pending: Entry[] = [{ value: input, depth: 0, nodes: false }], active = new Set<object>(), encoder = new TextEncoder();
  let bytes = 0, nodes = 0;
  const stringBytes = (value: string): number => value.length > GRAPH_ADMISSION_LIMITS.bytes ? GRAPH_ADMISSION_LIMITS.bytes + 1 : encoder.encode(JSON.stringify(value)).length;
  while (pending.length > 0) {
    const entry = pending.pop(); if (entry === undefined) break;
    if ('leave' in entry) { active.delete(entry.leave); continue; }
    const { value, depth } = entry;
    if (depth > GRAPH_ADMISSION_LIMITS.depth) return ['graph: JSON depth exceeds admission cap'];
    if (typeof value === 'string') bytes += stringBytes(value);
    else if (value === null || typeof value === 'boolean') bytes += value === null ? 4 : value ? 4 : 5;
    else if (typeof value === 'number') {
      if (!Number.isFinite(value) || Object.is(value, -0)) return ['graph: finite JSON numbers required'];
      bytes += JSON.stringify(value).length;
    } else if (typeof value === 'object') {
      if (active.has(value)) return ['graph: JSON cycle refused'];
      const prototype: unknown = Object.getPrototypeOf(value);
      if ((Array.isArray(value) ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) || Object.getOwnPropertySymbols(value).length > 0) return ['graph: plain JSON data required'];
      const descriptors = Object.getOwnPropertyDescriptors(value), keys = Object.keys(descriptors).filter(key => !(Array.isArray(value) && key === 'length'));
      if (entry.nodes) { nodes += keys.length; if (nodes > nodeLimit) return [`budget: ${nodes} nodes (at most ${nodeLimit}); all nested nodes counted`]; }
      bytes += 2 + Math.max(0, keys.length - 1);
      if (Array.isArray(value) && value.length !== keys.length) return ['graph: sparse JSON arrays refused'];
      active.add(value); pending.push({ leave: value });
      for (const key of keys) {
        const descriptor = descriptors[key];
        if (descriptor === undefined || descriptor.get !== undefined || descriptor.set !== undefined || !descriptor.enumerable) return ['graph: JSON accessors and hidden properties refused'];
        if (!Array.isArray(value)) bytes += stringBytes(key) + 1;
        const child: unknown = descriptor.value;
        pending.push({ value: child, depth: depth + 1, nodes: key === 'nodes' });
      }
    } else return ['graph: plain JSON data required'];
    if (bytes > GRAPH_ADMISSION_LIMITS.bytes) return ['graph: JSON byte size exceeds admission cap'];
  }
  return [];
}

/** what a valid graph costs: counted over every node a stage reaches, a loop's body times its count */
export interface GraphCost {
  readonly nodes: number;
  readonly samplers: number;
  readonly instructions: number;
}

/**
 * where a node may run: `vertex` (the offset stage), `fragment` (surface), `post` (a screen pass), the lighting
 * stage's three: `sun` (per directional light), `ambient` (the indirect term) and `grade` (after lighting), and the
 * outline's two: `outlineVertex` (its hull offset) and `outline` (its ink; its own program, so counted apart)
 */
type GraphPlace = 'vertex' | 'fragment' | 'post' | 'sun' | 'ambient' | 'grade' | 'outlineVertex' | 'outline';

/** how an op types its inputs */
type TypeRule =
  | 'input' | 'const' | 'param' | 'same' | 'unary' | 'vecUnary' | 'length' | 'dot' | 'mix' | 'compare' | 'logic' | 'not'
  | 'select' | 'swizzle' | 'combine' | 'noise' | 'texture' | 'loop' | 'acc' | 'index' | 'dir3' | 'sceneTap';
/** one op of the vocabulary */
export interface GraphOpSpec {
  /** the number of inputs (min, max) */
  readonly arity: readonly [number, number];
  readonly rule: TypeRule;
  /** an estimate of the instructions it emits */
  readonly cost: number;
  /** an input op's type */
  readonly type?: GraphValueType;
  /** the places it may run (all when absent) */
  readonly places?: readonly GraphPlace[];
}

/** the lighting stage's places (fragment work, like the surface) */
const LIT: readonly GraphPlace[] = ['sun', 'ambient', 'grade'];
const FRAG: readonly GraphPlace[] = ['fragment', 'outline', 'post', ...LIT];
const MESH: readonly GraphPlace[] = ['vertex', 'outlineVertex', 'fragment', 'outline', ...LIT];
/** the vertex places (an object's own transform is read there) */
const VERT: readonly GraphPlace[] = ['vertex', 'outlineVertex'];
/**
 * The version 1 vocabulary (the starter set of §4): inputs, constants and params, arithmetic and safe maths, comparisons
 * and a branch-light `select`, swizzles and vector construction, MaterialX noise, an admitted texture's sample and a
 * constant-count loop. Nothing here can name a three.js node or carry source.
 */
export const GRAPH_OPS: Readonly<Record<string, GraphOpSpec>> = {
  // inputs
  uv: { arity: [0, 0], rule: 'input', cost: 0, type: 'vec2', places: MESH },
  positionLocal: { arity: [0, 0], rule: 'input', cost: 0, type: 'vec3', places: MESH },
  // SF59 step 7: the geometry's own vertex position, before an instance's transform (the painterly sway's height)
  positionGeometry: { arity: [0, 0], rule: 'input', cost: 0, type: 'vec3', places: VERT },
  // SF59 step 7: the world position of the object's origin, the instance's own for an instanced mesh (a per-object phase)
  objectOrigin: { arity: [0, 0], rule: 'input', cost: 4, type: 'vec3', places: VERT },
  positionWorld: { arity: [0, 0], rule: 'input', cost: 1, type: 'vec3', places: MESH },
  normalLocal: { arity: [0, 0], rule: 'input', cost: 0, type: 'vec3', places: MESH },
  normalWorld: { arity: [0, 0], rule: 'input', cost: 1, type: 'vec3', places: MESH },
  cameraPosition: { arity: [0, 0], rule: 'input', cost: 0, type: 'vec3' },
  time: { arity: [0, 0], rule: 'input', cost: 0, type: 'float' },
  instanceHash: { arity: [0, 0], rule: 'input', cost: 4, type: 'float', places: MESH },
  vertexColour: { arity: [0, 0], rule: 'input', cost: 0, type: 'vec3', places: MESH }, // the geometry's `color` attribute (rgb, linear); white where it has none
  screenUV: { arity: [0, 0], rule: 'input', cost: 0, type: 'vec2', places: ['post'] },
  // the lighting stage's inputs (SF59 step 6): view space, unit vectors; the engine supplies them from its own lights
  normalView: { arity: [0, 0], rule: 'input', cost: 0, type: 'vec3', places: LIT }, // the shading normal (the face's under flatShading)
  viewDirection: { arity: [0, 0], rule: 'input', cost: 0, type: 'vec3', places: LIT }, // toward the camera
  albedo: { arity: [0, 0], rule: 'input', cost: 0, type: 'vec3', places: LIT }, // the surface colour × (1 − metalness)
  sunDirection: { arity: [0, 0], rule: 'input', cost: 0, type: 'vec3', places: ['sun'] }, // toward the light
  sunColour: { arity: [0, 0], rule: 'input', cost: 0, type: 'vec3', places: ['sun'] }, // the light's colour × intensity, unshadowed
  sunShadow: { arity: [0, 0], rule: 'input', cost: 4, type: 'float', places: ['sun'] }, // 1 lit … 0 in cast shadow (the families' ratio)
  irradiance: { arity: [0, 0], rule: 'input', cost: 0, type: 'vec3', places: ['ambient'] }, // the indirect irradiance (hemisphere, ambient)
  litColour: { arity: [0, 0], rule: 'input', cost: 0, type: 'vec3', places: ['grade'] }, // the lit colour, emissive included
  sceneColour: { arity: [0, 0], rule: 'input', cost: 2, type: 'vec4', places: ['post'] },
  // SF59 (2b), the post inputs, each its own sampler once a graph reads it (however many taps): the scene colour at a uv
  // (`sceneColourAt`, a tap: an edge or blur kernel), the scene depth (linear view distance in metres, from the engine's
  // depth target) and the scene normal (view space, unit, from the normal pre-pass the engine draws only for a post stack
  // that reads it: `postInputs` names it so the stack's cost carries it). Each samples at `screenUV` without an input.
  sceneColourAt: { arity: [1, 1], rule: 'sceneTap', cost: 4, type: 'vec4', places: ['post'] },
  sceneDepth: { arity: [0, 1], rule: 'sceneTap', cost: 6, type: 'float', places: ['post'] },
  sceneNormal: { arity: [0, 1], rule: 'sceneTap', cost: 6, type: 'vec3', places: ['post'] },
  const: { arity: [0, 0], rule: 'const', cost: 0 },
  param: { arity: [0, 0], rule: 'param', cost: 0 },
  // arithmetic (a float broadcasts to a vector)
  add: { arity: [2, 2], rule: 'same', cost: 1 },
  sub: { arity: [2, 2], rule: 'same', cost: 1 },
  mul: { arity: [2, 2], rule: 'same', cost: 1 },
  div: { arity: [2, 2], rule: 'same', cost: 2 }, // safe: a non-literal divisor is kept off zero
  min: { arity: [2, 2], rule: 'same', cost: 1 },
  max: { arity: [2, 2], rule: 'same', cost: 1 },
  mod: { arity: [2, 2], rule: 'same', cost: 3 }, // a − b·floor(a / b)
  pow: { arity: [2, 2], rule: 'same', cost: 4 }, // safe: the base is clamped at 0
  step: { arity: [2, 2], rule: 'same', cost: 1 },
  abs: { arity: [1, 1], rule: 'unary', cost: 1 },
  floor: { arity: [1, 1], rule: 'unary', cost: 1 },
  fract: { arity: [1, 1], rule: 'unary', cost: 1 },
  sin: { arity: [1, 1], rule: 'unary', cost: 4 },
  cos: { arity: [1, 1], rule: 'unary', cost: 4 },
  exp: { arity: [1, 1], rule: 'unary', cost: 4 }, // e^x (the emissive family's halo falloff)
  negate: { arity: [1, 1], rule: 'unary', cost: 1 },
  oneMinus: { arity: [1, 1], rule: 'unary', cost: 1 },
  saturate: { arity: [1, 1], rule: 'unary', cost: 1 },
  fwidth: { arity: [1, 1], rule: 'unary', cost: 3, places: FRAG },
  normalize: { arity: [1, 1], rule: 'vecUnary', cost: 3 },
  // SF59 step 7: space changes for a vec3 direction. `viewToWorld` turns a view-space direction (`normalView`, faceted
  // under flatShading) into a unit world one; `worldToLocal` turns a world direction into the model space
  // `vertex.offset` is added in (the transpose of the model's 3 × 3 world matrix, unnormalised, as the families do it)
  viewToWorld: { arity: [1, 1], rule: 'dir3', cost: 6, places: MESH },
  worldToLocal: { arity: [1, 1], rule: 'dir3', cost: 3, places: VERT },
  length: { arity: [1, 1], rule: 'length', cost: 3 },
  dot: { arity: [2, 2], rule: 'dot', cost: 2 },
  mix: { arity: [3, 3], rule: 'mix', cost: 2 },
  clamp: { arity: [3, 3], rule: 'same', cost: 2 },
  smoothstep: { arity: [3, 3], rule: 'same', cost: 5 },
  // comparisons and the branch-light select
  lt: { arity: [2, 2], rule: 'compare', cost: 1 },
  lte: { arity: [2, 2], rule: 'compare', cost: 1 },
  gt: { arity: [2, 2], rule: 'compare', cost: 1 },
  gte: { arity: [2, 2], rule: 'compare', cost: 1 },
  eq: { arity: [2, 2], rule: 'compare', cost: 1 },
  and: { arity: [2, 2], rule: 'logic', cost: 1 },
  or: { arity: [2, 2], rule: 'logic', cost: 1 },
  not: { arity: [1, 1], rule: 'not', cost: 1 },
  select: { arity: [3, 3], rule: 'select', cost: 2 },
  // vectors
  swizzle: { arity: [1, 1], rule: 'swizzle', cost: 0 },
  combine: { arity: [2, 4], rule: 'combine', cost: 0 },
  // MaterialX noise and textures
  noise: { arity: [1, 1], rule: 'noise', cost: 40 },
  texture: { arity: [1, 1], rule: 'texture', cost: 4, places: FRAG },
  // the constant-count loop
  loop: { arity: [1, 1], rule: 'loop', cost: 1 },
  acc: { arity: [0, 0], rule: 'acc', cost: 0 },
  index: { arity: [0, 0], rule: 'index', cost: 0 },
};

/** the ops whose value is one directional light's (a node reading one is built per light, and counted per cascade) */
export const SUN_OPS: ReadonlySet<string> = new Set(['sunDirection', 'sunColour', 'sunShadow']);

/**
 * the scene inputs a post graph reads (SF59 (2b)): each is one sampler in its cost; `normal` also needs the engine's
 * normal pre-pass, which a post stack pays once (`POST_NORMAL_PREPASS_COST`) whichever of its passes read it
 */
export interface PostInputs { readonly colour: boolean; readonly depth: boolean; readonly normal: boolean }
/** the outcome of validation: the graph (typed) and its cost, or every reason it is refused */
export type GraphValidation =
  | { readonly ok: true; readonly graph: GraphIr; readonly cost: GraphCost; readonly types: ReadonlyMap<string, GraphValueType>; readonly inputs: PostInputs }
  | { readonly ok: false; readonly errors: readonly string[] };

/** what validation checks bindings and the budget against */
export interface GraphValidationOptions {
  /** the day-key channels a param may bind to (any name when absent) */
  readonly dayKeys?: readonly string[];
  /** the shard's declared public numeric state fields a param may bind to (any name when absent) */
  readonly stateFields?: readonly string[];
  readonly budget?: GraphBudget;
  /** the directional lights a `sun` sub-graph is built for (1 … SUN_CASCADES_MAX; SUN_CASCADES when absent) */
  readonly cascades?: number;
}

const VEC_LEN: Readonly<Record<GraphValueType, number>> = { float: 1, vec2: 2, vec3: 3, vec4: 4, bool: 1 };
const vecOf = (n: number): GraphValueType | null => (n === 1 ? 'float' : n === 2 ? 'vec2' : n === 3 ? 'vec3' : n === 4 ? 'vec4' : null);
const isNumeric = (t: GraphValueType): boolean => t !== 'bool';
const ID = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const SURFACE_TYPES: Readonly<Record<string, GraphValueType>> = { colour: 'vec3', alpha: 'float', emissive: 'vec3', roughness: 'float', metalness: 'float', occlusion: 'float' };

/** an object read from content, with the fields this module looks at named (each still unknown) */
interface Raw {
  readonly [k: string]: unknown;
  readonly version?: unknown; readonly kind?: unknown; readonly model?: unknown; readonly doubleSided?: unknown; readonly flatShading?: unknown;
  readonly params?: unknown; readonly nodes?: unknown; readonly stages?: unknown;
  readonly type?: unknown; readonly value?: unknown; readonly min?: unknown; readonly max?: unknown; readonly bind?: unknown;
  readonly day?: unknown; readonly state?: unknown;
  readonly op?: unknown; readonly in?: unknown; readonly param?: unknown; readonly mask?: unknown; readonly count?: unknown;
  readonly body?: unknown; readonly out?: unknown;
  readonly offset?: unknown; readonly shadow?: unknown; readonly surface?: unknown; readonly post?: unknown;
  readonly lighting?: unknown; readonly colour?: unknown; readonly outline?: unknown;
  readonly sun?: unknown; readonly sunSpecular?: unknown; readonly ambient?: unknown; readonly grade?: unknown;
}
const isRecord = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
function literalType(v: unknown): GraphValueType | null {
  if (isFiniteNumber(v)) return 'float';
  if (Array.isArray(v) && v.length >= 2 && v.length <= 4 && v.every(isFiniteNumber)) return vecOf(v.length);
  return null;
}
/** the common type of numeric inputs where a float broadcasts, or null when two vectors differ */
function broadcast(types: readonly GraphValueType[]): GraphValueType | null {
  let out: GraphValueType = 'float';
  for (const t of types) {
    if (!isNumeric(t)) return null;
    if (t === 'float') continue;
    if (out !== 'float' && out !== t) return null;
    out = t;
  }
  return out;
}

/** one scope of nodes: the graph's own, or a loop body's (which reads its parent's) */
interface Scope {
  readonly nodes: Readonly<Record<string, unknown>>;
  readonly parent: Scope | null;
  readonly loop: { readonly acc: GraphValueType; readonly accDep: boolean } | null;
  readonly path: string;
}

/**
 * Validate a graph read from content (`unknown`): its shape, every op against the vocabulary, every input's type, no
 * cycles, params and bindings, stage placement, and the budget. A valid graph comes back typed with its cost; otherwise
 * every reason it is refused.
 */
export function validateGraph(input: unknown, opts: GraphValidationOptions = {}): GraphValidation {
  const rawErrors = graphAdmissionErrors(input, opts.budget?.nodes ?? DEFAULT_GRAPH_BUDGET.nodes);
  if (rawErrors.length > 0) return { ok: false, errors: rawErrors };
  const errors: string[] = [];
  const fail = (msg: string): null => { errors.push(msg); return null; };
  const budget = opts.budget ?? DEFAULT_GRAPH_BUDGET;
  const cascades = opts.cascades ?? SUN_CASCADES;
  if (!Number.isInteger(cascades) || cascades < 1 || cascades > SUN_CASCADES_MAX) return { ok: false, errors: [`graph: cascades ${cascades} (1–${SUN_CASCADES_MAX})`] };
  if (!isRecord(input)) return { ok: false, errors: ['graph: not an object'] };
  if (input.version !== GRAPH_IR_VERSION) fail(`graph: version ${String(input.version)} (this engine reads ${GRAPH_IR_VERSION})`);
  const kind = input.kind;
  if (kind !== 'material' && kind !== 'post') fail(`graph: kind ${String(kind)} (material or post)`);
  if (input.model !== undefined && input.model !== 'standard' && input.model !== 'unlit') fail(`graph: model ${JSON.stringify(input.model)} (standard or unlit)`);
  if (input.doubleSided !== undefined && typeof input.doubleSided !== 'boolean') fail('graph: doubleSided is not a boolean');
  if (input.flatShading !== undefined && typeof input.flatShading !== 'boolean') fail('graph: flatShading is not a boolean');
  for (const k of Object.keys(input)) if (!['version', 'kind', 'model', 'doubleSided', 'flatShading', 'params', 'nodes', 'stages'].includes(k)) fail(`graph: unknown field ${k}`);

  // params
  const paramTypes = new Map<string, GraphParamType>();
  const rawParams = input.params ?? {};
  if (!isRecord(rawParams)) fail('graph: params is not an object');
  else for (const [name, p] of Object.entries(rawParams)) {
    const at = `params.${name}`;
    if (!ID.test(name)) { fail(`${at}: not an identifier`); continue; }
    if (!isRecord(p)) { fail(`${at}: not an object`); continue; }
    const type = p.type;
    if (type !== 'float' && type !== 'vec2' && type !== 'vec3' && type !== 'vec4' && type !== 'colour' && type !== 'texture') { fail(`${at}: type ${String(type)}`); continue; }
    if (type === 'texture') {
      if (typeof p.value !== 'string' || p.value.length === 0) fail(`${at}: a texture names an admitted file`);
      if (p.bind !== undefined) fail(`${at}: a texture cannot be bound (a binding moves a uniform value)`);
    } else {
      const lt = literalType(p.value), want = type === 'colour' ? 'vec3' : type;
      if (lt !== want) fail(`${at}: value is not a ${want}`);
      for (const bound of ['min', 'max'] as const) if (p[bound] !== undefined && !isFiniteNumber(p[bound])) fail(`${at}: ${bound} is not a number`);
      const vals = isFiniteNumber(p.value) ? [p.value] : Array.isArray(p.value) ? p.value.filter(isFiniteNumber) : [];
      const lo = p.min, hi = p.max;
      if (isFiniteNumber(lo) && vals.some((v) => v < lo)) fail(`${at}: value below min`);
      if (isFiniteNumber(hi) && vals.some((v) => v > hi)) fail(`${at}: value above max`);
      if (p.bind !== undefined) {
        const b = p.bind;
        if (!isRecord(b) || Object.keys(b).length !== 1) fail(`${at}: bind is { day } or { state }`);
        else if (typeof b.day === 'string') { if (opts.dayKeys && !opts.dayKeys.includes(b.day)) fail(`${at}: unknown day key ${b.day}`); }
        else if (typeof b.state === 'string') { if (opts.stateFields && !opts.stateFields.includes(b.state)) fail(`${at}: undeclared state field ${b.state}`); }
        else fail(`${at}: bind is { day } or { state }`);
      }
    }
    paramTypes.set(name, type);
  }

  if (!isRecord(input.nodes)) return { ok: false, errors: [...errors, 'graph: nodes is not an object'] };
  const root: Scope = { nodes: input.nodes, parent: null, loop: null, path: 'nodes' };
  const types = new Map<string, GraphValueType>(); // `<scope path>/<id>` → type
  const visiting = new Set<string>();
  const textures = new Set<string>();
  const sampled = { scene: false, depth: false, normal: false }; // set while typing (a post graph reads a scene input)
  const counted = new Set<string>();
  /** `<scope path>/<id>` → whether the node reads a sun input (directly, through its inputs or a loop body) */
  const lightDep = new Map<string, boolean>();
  let loopDep = false; // set by the loop rule for the loop node being typed
  let nodeCount = 0, instructions = 0;

  const find = (scope: Scope, id: string): { scope: Scope; node: unknown } | null => {
    for (let s: Scope | null = scope; s !== null; s = s.parent) if (Object.hasOwn(s.nodes, id)) return { scope: s, node: s.nodes[id] };
    return null;
  };

  /** type a reference from `scope`, at `place`, adding its cost once (times `mult` inside loops) */
  /** whether a typed reference reads a sun input */
  const refDep = (ref: unknown, scope: Scope): boolean => {
    if (typeof ref !== 'string') return false;
    const hit = find(scope, ref);
    return hit !== null && lightDep.get(`${hit.scope.path}/${ref}`) === true;
  };

  function typeRef(ref: unknown, scope: Scope, place: GraphPlace, at: string, mult: number): GraphValueType | null {
    if (typeof ref !== 'string') return literalType(ref) ?? fail(`${at}: not a node id or a 1–4 number literal`);
    const hit = find(scope, ref);
    if (hit === null) return fail(`${at}: unknown node ${ref}`);
    return typeNode(ref, hit.node, hit.scope, place, mult);
  }

  function typeNode(id: string, raw: unknown, scope: Scope, place: GraphPlace, mult: number): GraphValueType | null {
    const key = `${scope.path}/${id}`, at = `${scope.path}.${id}`;
    const known = types.get(key);
    if (known !== undefined && counted.has(`${key}@${place}`)) return known;
    if (visiting.has(key)) return fail(`${at}: cycle`);
    if (!isRecord(raw)) return fail(`${at}: not an object`);
    const op = raw.op;
    if (typeof op !== 'string' || !Object.hasOwn(GRAPH_OPS, op)) return fail(`${at}: unknown op ${String(op)}`);
    const spec = GRAPH_OPS[op];
    if (spec === undefined) return fail(`${at}: unknown op ${op}`);
    if (spec.places && !spec.places.includes(place)) return fail(`${at}: ${op} cannot run in the ${place} stage`);
    const ins = raw.in ?? [];
    if (!Array.isArray(ins)) return fail(`${at}: in is not a list`);
    if (ins.length < spec.arity[0] || ins.length > spec.arity[1]) return fail(`${at}: ${op} takes ${spec.arity[0] === spec.arity[1] ? spec.arity[0] : spec.arity.join('–')} inputs, got ${ins.length}`);
    visiting.add(key);
    const inner = spec.rule === 'loop' ? [] : ins.map((r, i) => typeRef(r, scope, place, `${at}.in[${i}]`, mult));
    const t = inner.some((x) => x === null) ? null : resolve(op, spec, raw, inner.filter((x): x is GraphValueType => x !== null), scope, place, at, ins, mult);
    visiting.delete(key);
    if (t !== null) {
      types.set(key, t);
      const dep = spec.rule === 'input' ? SUN_OPS.has(op)
        : spec.rule === 'acc' ? scope.loop?.accDep === true
          : spec.rule === 'loop' ? loopDep
            : ins.some((r) => refDep(r, scope));
      lightDep.set(key, dep);
      if (!counted.has(`${key}@${place}`)) {
        counted.add(`${key}@${place}`);
        nodeCount += mult;
        // a component-wise op costs once per component; a light-dependent node of the sun sub-graph once per cascade
        const lanes = spec.rule === 'same' || spec.rule === 'unary' ? VEC_LEN[t] : 1;
        instructions += spec.cost * mult * lanes * (place === 'sun' && dep ? cascades : 1);
      }
    }
    return t;
  }

  function resolve(op: string, spec: GraphOpSpec, raw: Raw, ins: readonly GraphValueType[], scope: Scope, place: GraphPlace, at: string, rawIns: readonly unknown[], mult: number): GraphValueType | null {
    switch (spec.rule) {
      case 'input':
        if (op === 'sceneColour') sampled.scene = true;
        return spec.type ?? null;
      case 'const': return literalType(raw.value) ?? fail(`${at}: const value is not a 1–4 number literal`);
      case 'param': {
        const name = raw.param;
        if (typeof name !== 'string') return fail(`${at}: param names a param`);
        const pt = paramTypes.get(name);
        if (pt === undefined) return fail(`${at}: unknown param ${name}`);
        if (pt === 'texture') return fail(`${at}: a texture param is read by a texture node`);
        return pt === 'colour' ? 'vec3' : pt;
      }
      case 'same': return broadcast(ins) ?? fail(`${at}: ${op} inputs ${ins.join(', ')} do not match`);
      case 'unary': return isNumeric(ins[0] ?? 'bool') ? (ins[0] ?? null) : fail(`${at}: ${op} takes a number`);
      case 'vecUnary': return ins[0] !== undefined && VEC_LEN[ins[0]] > 1 && isNumeric(ins[0]) ? ins[0] : fail(`${at}: ${op} takes a vector`);
      case 'length': return ins[0] !== undefined && isNumeric(ins[0]) ? 'float' : fail(`${at}: length takes a number`);
      case 'dot': return ins[0] !== undefined && ins[0] === ins[1] && VEC_LEN[ins[0]] > 1 && isNumeric(ins[0]) ? 'float' : fail(`${at}: dot takes two vectors of one size`);
      case 'mix': {
        const t = broadcast([ins[0] ?? 'bool', ins[1] ?? 'bool']);
        if (t === null) return fail(`${at}: mix inputs ${ins.join(', ')} do not match`);
        return ins[2] === 'float' || ins[2] === t ? t : fail(`${at}: mix factor is ${String(ins[2])}`);
      }
      case 'compare': return ins[0] === 'float' && ins[1] === 'float' ? 'bool' : fail(`${at}: ${op} compares two floats`);
      case 'logic': return ins[0] === 'bool' && ins[1] === 'bool' ? 'bool' : fail(`${at}: ${op} takes two bools`);
      case 'not': return ins[0] === 'bool' ? 'bool' : fail(`${at}: not takes a bool`);
      case 'select': {
        if (ins[0] !== 'bool') return fail(`${at}: select's condition is ${String(ins[0])}, not a bool`);
        if (ins[1] === 'bool' && ins[2] === 'bool') return 'bool';
        return broadcast([ins[1] ?? 'bool', ins[2] ?? 'bool']) ?? fail(`${at}: select sides ${String(ins[1])}, ${String(ins[2])} do not match`);
      }
      case 'swizzle': {
        const mask = raw.mask, src = ins[0];
        if (src === undefined || !isNumeric(src)) return fail(`${at}: swizzle takes a number`);
        if (typeof mask !== 'string' || !/^[xyzw]{1,4}$/.test(mask)) return fail(`${at}: swizzle mask ${String(mask)}`);
        if (mask.split('').some((c) => 'xyzw'.indexOf(c) >= VEC_LEN[src])) return fail(`${at}: mask ${mask} reads past a ${src}`);
        return vecOf(mask.length);
      }
      case 'combine': {
        if (ins.some((t) => !isNumeric(t))) return fail(`${at}: combine takes numbers`);
        const n = ins.reduce((s, t) => s + VEC_LEN[t], 0);
        return n >= 2 && n <= 4 ? vecOf(n) : fail(`${at}: combine makes ${n} components (2–4)`);
      }
      case 'noise': return ins[0] === 'vec2' || ins[0] === 'vec3' ? 'float' : fail(`${at}: noise takes a vec2 or vec3`);
      case 'dir3': return ins[0] === 'vec3' ? 'vec3' : fail(`${at}: ${op} takes a vec3 direction`);
      case 'sceneTap':
        if (ins.length === 1 && ins[0] !== 'vec2') return fail(`${at}: ${op} samples at a vec2`);
        if (op === 'sceneDepth') sampled.depth = true; else if (op === 'sceneNormal') sampled.normal = true; else sampled.scene = true;
        return spec.type ?? null;
      case 'texture': {
        const name = raw.param;
        if (typeof name !== 'string' || paramTypes.get(name) !== 'texture') return fail(`${at}: texture names a texture param`);
        if (ins[0] !== 'vec2') return fail(`${at}: texture samples at a vec2`);
        textures.add(name);
        return 'vec4';
      }
      case 'acc': return scope.loop?.acc ?? fail(`${at}: acc outside a loop body`);
      case 'index': return scope.loop !== null ? 'float' : fail(`${at}: index outside a loop body`);
      case 'loop': {
        const count = raw.count;
        if (!Number.isInteger(count) || typeof count !== 'number' || count < 1 || count > LOOP_MAX) return fail(`${at}: loop count ${String(count)} (a constant, 1–${LOOP_MAX})`);
        const init = typeRef(rawIns[0], scope, place, `${at}.in[0]`, mult);
        if (init === null) return null;
        if (init === 'bool') return fail(`${at}: a loop accumulates a number`);
        const body = raw.body;
        if (!isRecord(body) || !isRecord(body.nodes)) return fail(`${at}: loop body is { nodes, out }`);
        const initDep = refDep(rawIns[0], scope);
        const bodyScope: Scope = { nodes: body.nodes, parent: scope, loop: { acc: init, accDep: initDep }, path: `${at}.body` };
        const out = typeRef(body.out, bodyScope, place, `${at}.body.out`, mult * count);
        if (out === null) return null;
        loopDep = initDep || refDep(body.out, bodyScope);
        return out === init ? init : fail(`${at}: the body makes a ${out}, the accumulator is a ${init}`);
      }
      default: return fail(`${at}: op ${op} has no type rule`);
    }
  }

  // stages
  const stages = input.stages;
  if (!isRecord(stages)) return { ok: false, errors: [...errors, 'graph: stages is not an object'] };
  for (const k of Object.keys(stages)) if (!['vertex.offset', 'surface', 'lighting', 'outline', 'post'].includes(k)) fail(`stages: unknown stage ${k}`);
  const want = (ref: unknown, place: GraphPlace, type: GraphValueType, at: string): void => {
    const t = typeRef(ref, root, place, at, 1);
    if (t !== null && t !== type && !(t === 'float' && type !== 'bool')) fail(`${at}: is a ${t}, wants a ${type}`);
  };
  if (kind === 'material') {
    if (stages.post !== undefined) fail('stages.post: a material graph has no post stage');
    const vo = stages['vertex.offset'];
    if (vo !== undefined) {
      if (!isRecord(vo)) fail('stages.vertex.offset: not an object');
      else {
        want(vo.offset, 'vertex', 'vec3', 'stages.vertex.offset.offset');
        if (vo.shadow === true) fail('stages.vertex.offset.shadow: the matching shadow depth variant is not emitted yet (§2.5)');
      }
    }
    const s = stages.surface;
    if (s === undefined) fail('stages.surface: a material graph needs a surface');
    else if (!isRecord(s)) fail('stages.surface: not an object');
    else for (const [k, v] of Object.entries(s)) {
      if (k === 'alphaCutoff') { if (!isFiniteNumber(v) || v < 0 || v > 1) fail('stages.surface.alphaCutoff: a number 0–1'); continue; }
      const t = SURFACE_TYPES[k];
      if (t === undefined) { fail(`stages.surface: unknown output ${k}`); continue; }
      want(v, 'fragment', t, `stages.surface.${k}`);
    }
    const lit = stages.lighting;
    if (lit !== undefined) {
      if (input.model === 'unlit') fail('stages.lighting: an unlit graph has no lighting model');
      if (!isRecord(lit)) fail('stages.lighting: not an object');
      else {
        for (const k of Object.keys(lit)) if (!['sun', 'sunSpecular', 'ambient', 'grade'].includes(k)) fail(`stages.lighting: unknown output ${k}`);
        if (lit.sun === undefined) fail('stages.lighting: a lighting model needs sun');
        else want(lit.sun, 'sun', 'vec3', 'stages.lighting.sun');
        if (lit.sunSpecular !== undefined) want(lit.sunSpecular, 'sun', 'float', 'stages.lighting.sunSpecular');
        if (lit.ambient !== undefined) want(lit.ambient, 'ambient', 'vec3', 'stages.lighting.ambient');
        if (lit.grade !== undefined) want(lit.grade, 'grade', 'vec3', 'stages.lighting.grade');
      }
    }
    const ol = stages.outline;
    if (ol !== undefined) {
      if (!isRecord(ol)) fail('stages.outline: not an object');
      else {
        for (const k of Object.keys(ol)) if (k !== 'offset' && k !== 'colour') fail(`stages.outline: unknown field ${k} (the render state is fixed: back faces, depth on, opaque, unlit)`);
        if (ol.offset === undefined || ol.colour === undefined) fail('stages.outline: an outline is { offset, colour }');
        else {
          want(ol.offset, 'outlineVertex', 'vec3', 'stages.outline.offset');
          want(ol.colour, 'outline', 'vec3', 'stages.outline.colour');
        }
      }
    }
  } else if (kind === 'post') {
    for (const k of ['vertex.offset', 'surface', 'lighting', 'outline'] as const) if (stages[k] !== undefined) fail(`stages.${k}: a post graph has only a post stage`);
    const p = stages.post;
    if (!isRecord(p)) fail('stages.post: a post graph needs { colour }');
    else want(p.colour, 'post', 'vec3', 'stages.post.colour');
  }

  const cost: GraphCost = { nodes: nodeCount, samplers: textures.size + [sampled.scene, sampled.depth, sampled.normal].filter(Boolean).length, instructions };
  if (cost.nodes > budget.nodes) fail(`budget: ${cost.nodes} nodes (at most ${budget.nodes})`);
  if (cost.samplers > budget.samplers) fail(`budget: ${cost.samplers} samplers (at most ${budget.samplers})`);
  if (cost.instructions > budget.instructions) fail(`budget: ≈ ${cost.instructions} instructions (at most ${budget.instructions})`);
  if (errors.length > 0) return { ok: false, errors };
  const rootTypes = new Map<string, GraphValueType>();
  for (const [key, t] of types) if (key.startsWith('nodes/')) rootTypes.set(key.slice(6), t);
  // the shape has been checked field by field above, so the input is the graph
  return { ok: true, graph: asGraph(input), cost, types: rootTypes, inputs: { colour: sampled.scene, depth: sampled.depth, normal: sampled.normal } };
}

/** a checked record as the typed graph (called only once validateGraph found no error) */
function asGraph(input: Raw): GraphIr {
  const graph: GraphIr = {
    version: GRAPH_IR_VERSION,
    kind: input.kind === 'post' ? 'post' : 'material',
    nodes: isRecord(input.nodes) ? toNodes(input.nodes) : {},
    stages: isRecord(input.stages) ? toStages(input.stages) : {},
    ...(input.model === 'standard' || input.model === 'unlit' ? { model: input.model } : {}),
    ...(typeof input.doubleSided === 'boolean' ? { doubleSided: input.doubleSided } : {}),
    ...(typeof input.flatShading === 'boolean' ? { flatShading: input.flatShading } : {}),
    ...(isRecord(input.params) ? { params: toParams(input.params) } : {}),
  };
  return graph;
}
const toRef = (v: unknown): GraphRef => (typeof v === 'string' ? v : isFiniteNumber(v) ? v : Array.isArray(v) ? v.filter(isFiniteNumber) : 0);
function toNodes(raw: Raw): Record<string, GraphNode> {
  const out: Record<string, GraphNode> = {};
  for (const [id, n] of Object.entries(raw)) {
    if (!isRecord(n) || typeof n.op !== 'string') continue;
    out[id] = {
      op: n.op,
      ...(Array.isArray(n.in) ? { in: n.in.map(toRef) } : {}),
      ...(n.value !== undefined ? { value: isFiniteNumber(n.value) ? n.value : Array.isArray(n.value) ? n.value.filter(isFiniteNumber) : 0 } : {}),
      ...(typeof n.param === 'string' ? { param: n.param } : {}),
      ...(typeof n.mask === 'string' ? { mask: n.mask } : {}),
      ...(typeof n.count === 'number' ? { count: n.count } : {}),
      ...(isRecord(n.body) && isRecord(n.body.nodes) ? { body: { nodes: toNodes(n.body.nodes), out: toRef(n.body.out) } } : {}),
    };
  }
  return out;
}
function toStages(raw: Raw): GraphStages {
  const vo = raw['vertex.offset'], s = raw.surface, p = raw.post, l = raw.lighting, o = raw.outline;
  const surface: Record<string, GraphRef | number> = {};
  if (isRecord(s)) for (const [k, v] of Object.entries(s)) surface[k] = k === 'alphaCutoff' && isFiniteNumber(v) ? v : toRef(v);
  return {
    ...(isRecord(vo) ? { 'vertex.offset': { offset: toRef(vo.offset), ...(vo.shadow === false ? { shadow: false } : {}) } } : {}),
    ...(isRecord(s) ? { surface } : {}),
    ...(isRecord(p) ? { post: { colour: toRef(p.colour) } } : {}),
    ...(isRecord(o) ? { outline: { offset: toRef(o.offset), colour: toRef(o.colour) } } : {}),
    ...(isRecord(l) ? { lighting: {
      sun: toRef(l.sun),
      ...(l.sunSpecular !== undefined ? { sunSpecular: toRef(l.sunSpecular) } : {}),
      ...(l.ambient !== undefined ? { ambient: toRef(l.ambient) } : {}),
      ...(l.grade !== undefined ? { grade: toRef(l.grade) } : {}),
    } } : {}),
  };
}
function toParams(raw: Raw): Record<string, GraphParam> {
  const out: Record<string, GraphParam> = {};
  for (const [name, p] of Object.entries(raw)) {
    if (!isRecord(p)) continue;
    const t = p.type;
    if (t !== 'float' && t !== 'vec2' && t !== 'vec3' && t !== 'vec4' && t !== 'colour' && t !== 'texture') continue;
    const b = p.bind;
    out[name] = {
      type: t,
      value: typeof p.value === 'string' ? p.value : toRef(p.value),
      ...(isFiniteNumber(p.min) ? { min: p.min } : {}),
      ...(isFiniteNumber(p.max) ? { max: p.max } : {}),
      ...(isRecord(b) && typeof b.day === 'string' ? { bind: { day: b.day } } : isRecord(b) && typeof b.state === 'string' ? { bind: { state: b.state } } : {}),
    };
  }
  return out;
}
