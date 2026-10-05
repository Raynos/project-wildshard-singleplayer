/**
 * The material graph IR (SHARD-PLATFORM SF59 step 3, G155; `docs/design/mmo/research/sf59-tsl-spike.md` §4): a typed,
 * versioned graph of approved nodes that a material (`family: "graph"`) or a post pass points to. Content carries this
 * data and never shader code: the compiler (`graph/compile.ts`, loaded lazily through `render/graphBackend.ts`) maps each
 * node to a TSL call in our own code (the MaterialXLoader pattern), so three's `NodeLoader`, `CodeNode` and `glslFn` stay
 * out of reach of content (§2.9).
 *
 * The shape (version 1, the starter vocabulary; §4 lists the ≈ 60 the format grows to):
 * - `nodes`: id → `{ op, in?, … }`; an input is another node's id or a literal number / 2–4 number array;
 * - `stages`: `vertex.offset` (object-space displacement), `surface` (colour, alpha, cutoff, emissive, roughness,
 *   metalness, occlusion), `post` (a screen pass over `sceneColour`); `lighting` is reserved and refused until the
 *   lighting-model stage lands; the engine epilogue (fog, the grade) is appended by the back-end and is not a stage;
 * - `params`: typed uniforms with ranges, each optionally bound to a day key or a declared public shard-state field.
 *   A binding moves a value, never the program (§2.6);
 * - loops have a constant count (`loop`, at most `LOOP_MAX` iterations), so the cost is known before compile;
 * - a budget per program (node count, samplers, an instruction estimate) that validation refuses past.
 *
 * Pure data and checks: this module imports no three.js, so the shardfile validator can use it on any machine.
 */

/** the IR version a graph declares; a graph of another version is refused */
export const GRAPH_IR_VERSION = 1;
/** the most iterations a `loop` node may run */
export const LOOP_MAX = 16;

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
/** the stages */
export interface GraphStages {
  readonly 'vertex.offset'?: GraphVertexOffset;
  readonly surface?: GraphSurface;
  /** reserved: the lighting-model stage (§4) is not in version 1 yet, so a graph that carries it is refused */
  readonly lighting?: never;
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

/** what a valid graph costs: counted over every node a stage reaches, a loop's body times its count */
export interface GraphCost {
  readonly nodes: number;
  readonly samplers: number;
  readonly instructions: number;
}

/** where a node may run: `vertex` (the offset stage), `fragment` (surface), `post` (a screen pass) */
type GraphPlace = 'vertex' | 'fragment' | 'post';

/** how an op types its inputs */
type TypeRule =
  | 'input' | 'const' | 'param' | 'same' | 'unary' | 'vecUnary' | 'length' | 'dot' | 'mix' | 'compare' | 'logic' | 'not'
  | 'select' | 'swizzle' | 'combine' | 'noise' | 'texture' | 'loop' | 'acc' | 'index';
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

const FRAG: readonly GraphPlace[] = ['fragment', 'post'];
/**
 * The version 1 vocabulary (the starter set of §4): inputs, constants and params, arithmetic and safe maths, comparisons
 * and a branch-light `select`, swizzles and vector construction, MaterialX noise, an admitted texture's sample and a
 * constant-count loop. Nothing here can name a three.js node or carry source.
 */
export const GRAPH_OPS: Readonly<Record<string, GraphOpSpec>> = {
  // inputs
  uv: { arity: [0, 0], rule: 'input', cost: 0, type: 'vec2', places: ['vertex', 'fragment'] },
  positionLocal: { arity: [0, 0], rule: 'input', cost: 0, type: 'vec3', places: ['vertex', 'fragment'] },
  positionWorld: { arity: [0, 0], rule: 'input', cost: 1, type: 'vec3', places: ['vertex', 'fragment'] },
  normalLocal: { arity: [0, 0], rule: 'input', cost: 0, type: 'vec3', places: ['vertex', 'fragment'] },
  normalWorld: { arity: [0, 0], rule: 'input', cost: 1, type: 'vec3', places: ['vertex', 'fragment'] },
  cameraPosition: { arity: [0, 0], rule: 'input', cost: 0, type: 'vec3' },
  time: { arity: [0, 0], rule: 'input', cost: 0, type: 'float' },
  instanceHash: { arity: [0, 0], rule: 'input', cost: 4, type: 'float', places: ['vertex', 'fragment'] },
  screenUV: { arity: [0, 0], rule: 'input', cost: 0, type: 'vec2', places: ['post'] },
  sceneColour: { arity: [0, 0], rule: 'input', cost: 2, type: 'vec4', places: ['post'] },
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
  negate: { arity: [1, 1], rule: 'unary', cost: 1 },
  oneMinus: { arity: [1, 1], rule: 'unary', cost: 1 },
  saturate: { arity: [1, 1], rule: 'unary', cost: 1 },
  fwidth: { arity: [1, 1], rule: 'unary', cost: 3, places: FRAG },
  normalize: { arity: [1, 1], rule: 'vecUnary', cost: 3 },
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

/** the outcome of validation: the graph (typed) and its cost, or every reason it is refused */
export type GraphValidation =
  | { readonly ok: true; readonly graph: GraphIr; readonly cost: GraphCost; readonly types: ReadonlyMap<string, GraphValueType> }
  | { readonly ok: false; readonly errors: readonly string[] };

/** what validation checks bindings and the budget against */
export interface GraphValidationOptions {
  /** the day-key channels a param may bind to (any name when absent) */
  readonly dayKeys?: readonly string[];
  /** the shard's declared public numeric state fields a param may bind to (any name when absent) */
  readonly stateFields?: readonly string[];
  readonly budget?: GraphBudget;
}

const VEC_LEN: Readonly<Record<GraphValueType, number>> = { float: 1, vec2: 2, vec3: 3, vec4: 4, bool: 1 };
const vecOf = (n: number): GraphValueType | null => (n === 1 ? 'float' : n === 2 ? 'vec2' : n === 3 ? 'vec3' : n === 4 ? 'vec4' : null);
const isNumeric = (t: GraphValueType): boolean => t !== 'bool';
const ID = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const SURFACE_TYPES: Readonly<Record<string, GraphValueType>> = { colour: 'vec3', alpha: 'float', emissive: 'vec3', roughness: 'float', metalness: 'float', occlusion: 'float' };

/** an object read from content, with the fields this module looks at named (each still unknown) */
interface Raw {
  readonly [k: string]: unknown;
  readonly version?: unknown; readonly kind?: unknown; readonly model?: unknown; readonly doubleSided?: unknown;
  readonly params?: unknown; readonly nodes?: unknown; readonly stages?: unknown;
  readonly type?: unknown; readonly value?: unknown; readonly min?: unknown; readonly max?: unknown; readonly bind?: unknown;
  readonly day?: unknown; readonly state?: unknown;
  readonly op?: unknown; readonly in?: unknown; readonly param?: unknown; readonly mask?: unknown; readonly count?: unknown;
  readonly body?: unknown; readonly out?: unknown;
  readonly offset?: unknown; readonly shadow?: unknown; readonly surface?: unknown; readonly post?: unknown;
  readonly lighting?: unknown; readonly colour?: unknown;
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
  readonly loop: { readonly acc: GraphValueType } | null;
  readonly path: string;
}

/**
 * Validate a graph read from content (`unknown`): its shape, every op against the vocabulary, every input's type, no
 * cycles, params and bindings, stage placement, and the budget. A valid graph comes back typed with its cost; otherwise
 * every reason it is refused.
 */
export function validateGraph(input: unknown, opts: GraphValidationOptions = {}): GraphValidation {
  const errors: string[] = [];
  const fail = (msg: string): null => { errors.push(msg); return null; };
  const budget = opts.budget ?? DEFAULT_GRAPH_BUDGET;
  if (!isRecord(input)) return { ok: false, errors: ['graph: not an object'] };
  if (input.version !== GRAPH_IR_VERSION) fail(`graph: version ${String(input.version)} (this engine reads ${GRAPH_IR_VERSION})`);
  const kind = input.kind;
  if (kind !== 'material' && kind !== 'post') fail(`graph: kind ${String(kind)} (material or post)`);
  if (input.model !== undefined && input.model !== 'standard' && input.model !== 'unlit') fail(`graph: model ${JSON.stringify(input.model)} (standard or unlit)`);
  if (input.doubleSided !== undefined && typeof input.doubleSided !== 'boolean') fail('graph: doubleSided is not a boolean');
  for (const k of Object.keys(input)) if (!['version', 'kind', 'model', 'doubleSided', 'params', 'nodes', 'stages'].includes(k)) fail(`graph: unknown field ${k}`);

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
  const sampled = { scene: false }; // set while typing (a post graph reads sceneColour)
  const counted = new Set<string>();
  let nodeCount = 0, instructions = 0;

  const find = (scope: Scope, id: string): { scope: Scope; node: unknown } | null => {
    for (let s: Scope | null = scope; s !== null; s = s.parent) if (Object.hasOwn(s.nodes, id)) return { scope: s, node: s.nodes[id] };
    return null;
  };

  /** type a reference from `scope`, at `place`, adding its cost once (times `mult` inside loops) */
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
      if (!counted.has(`${key}@${place}`)) {
        counted.add(`${key}@${place}`);
        nodeCount += mult;
        // a component-wise op costs once per component
        const lanes = spec.rule === 'same' || spec.rule === 'unary' ? VEC_LEN[t] : 1;
        instructions += spec.cost * mult * lanes;
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
        const bodyScope: Scope = { nodes: body.nodes, parent: scope, loop: { acc: init }, path: `${at}.body` };
        const out = typeRef(body.out, bodyScope, place, `${at}.body.out`, mult * count);
        if (out === null) return null;
        return out === init ? init : fail(`${at}: the body makes a ${out}, the accumulator is a ${init}`);
      }
      default: return fail(`${at}: op ${op} has no type rule`);
    }
  }

  // stages
  const stages = input.stages;
  if (!isRecord(stages)) return { ok: false, errors: [...errors, 'graph: stages is not an object'] };
  for (const k of Object.keys(stages)) if (!['vertex.offset', 'surface', 'lighting', 'post'].includes(k)) fail(`stages: unknown stage ${k}`);
  if (stages.lighting !== undefined) fail('stages.lighting: the lighting-model stage is not in IR version 1 yet');
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
  } else if (kind === 'post') {
    for (const k of ['vertex.offset', 'surface'] as const) if (stages[k] !== undefined) fail(`stages.${k}: a post graph has only a post stage`);
    const p = stages.post;
    if (!isRecord(p)) fail('stages.post: a post graph needs { colour }');
    else want(p.colour, 'post', 'vec3', 'stages.post.colour');
  }

  const cost: GraphCost = { nodes: nodeCount, samplers: textures.size + (sampled.scene ? 1 : 0), instructions };
  if (cost.nodes > budget.nodes) fail(`budget: ${cost.nodes} nodes (at most ${budget.nodes})`);
  if (cost.samplers > budget.samplers) fail(`budget: ${cost.samplers} samplers (at most ${budget.samplers})`);
  if (cost.instructions > budget.instructions) fail(`budget: ≈ ${cost.instructions} instructions (at most ${budget.instructions})`);
  if (errors.length > 0) return { ok: false, errors };
  const rootTypes = new Map<string, GraphValueType>();
  for (const [key, t] of types) if (key.startsWith('nodes/')) rootTypes.set(key.slice(6), t);
  // the shape has been checked field by field above, so the input is the graph
  return { ok: true, graph: asGraph(input), cost, types: rootTypes };
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
  const vo = raw['vertex.offset'], s = raw.surface, p = raw.post;
  const surface: Record<string, GraphRef | number> = {};
  if (isRecord(s)) for (const [k, v] of Object.entries(s)) surface[k] = k === 'alphaCutoff' && isFiniteNumber(v) ? v : toRef(v);
  return {
    ...(isRecord(vo) ? { 'vertex.offset': { offset: toRef(vo.offset), ...(vo.shadow === false ? { shadow: false } : {}) } } : {}),
    ...(isRecord(s) ? { surface } : {}),
    ...(isRecord(p) ? { post: { colour: toRef(p.colour) } } : {}),
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
