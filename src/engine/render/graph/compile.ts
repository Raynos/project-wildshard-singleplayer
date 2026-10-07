/**
 * The material graph compiler (SHARD-PLATFORM SF59 step 3; `docs/design/mmo/research/sf59-tsl-spike.md` §4–5):
 * `compileGraph(ir)` turns a validated graph IR (`core/materialGraph.ts`) into a three TSL node material that the engine's node
 * handler (`nodes/engineNodesHandler.ts`) runs inside today's `WebGLRenderer`. Every IR op maps to node classes in this
 * file and nowhere else; content never reaches `NodeLoader`, `CodeNode` or `glslFn`.
 *
 * - **Validation first:** an unknown op, a type mismatch, a cycle or an over-budget graph throws before a node is made.
 * - **Params are uniforms** (§2.6): `setParam` moves a value (a day key, a shard-state field), never the program.
 * - **Branch-light `select`** (§5's flag): a select whose sides are cheap compiles to a branch-free
 *   `mix(else, then, float(cond))` (both sides run, as the family's GLSL ternary does); a select with an expensive side
 *   that nothing else reads becomes a real `if / else`, so only the taken side runs. `selects` reports the split.
 * - **Safe maths:** a divisor that is not a non-zero literal is kept off zero; `pow`'s base is clamped at 0.
 * - **Constant-count loops** unroll nowhere: a `loop` is a GLSL `for` with a literal bound.
 * - The engine epilogue (fog after the output transform) is appended by the handler: a graph material always has
 *   `fog` on, which a graph cannot switch off.
 * - **The lighting stage** (SF59 step 6): a graph with `stages.lighting` compiles to a `GraphLitMaterial`, a standard
 *   node material whose lighting model (`GraphLightingModel`, three's physical model underneath) builds the `sun`
 *   sub-graph for each directional light from the light node's own direction, unshadowed colour and shadow ratio, so
 *   the engine's light nodes (the cascade gate, the tent filter, the shadow fade) still feed it; `ambient` replaces the
 *   indirect diffuse; `sunSpecular` keeps the physical specular, scaled; `grade` runs on the lit colour before the
 *   output transform and the epilogue (fog), with tone mapping off. Every other light keeps the physical diffuse. The
 *   light-free part of the `sun` sub-graph is built once and shared between cascades.
 * - **The outline** (SF59 step 7): a graph with `stages.outline` also compiles `outline`, an unlit back-face node
 *   material whose vertex stage pushes the hull out by the graph's offset; `attachOutline(mesh, material)` adds the
 *   second draw as a child mesh sharing the geometry's buffers (and an instanced mesh's matrices).
 * - **Object inputs** (SF59 step 7): `objectOrigin` reads an instanced mesh's own translation column through one
 *   instanced vec4 attribute over the instance matrices' array (a buffer shared by every graph that reads it);
 *   `worldToLocal` and `viewToWorld` are the model and view matrices' 3 × 3 parts.
 *
 * This module imports `three/webgpu` + `three/tsl`, so it is reached only through `loadGraphCompiler()`
 * (`render/graphBackend.ts`), a lazy chunk; nothing on the default render path imports it.
 */
import * as THREE from 'three';
import {
  ConditionalNode, ConvertNode, JoinNode, MathNode, MeshBasicNodeMaterial, MeshStandardNodeMaterial, OperatorNode,
  PhysicalLightingModel, SplitNode, type Node, type NodeBuilder, type NodeMaterial,
} from 'three/webgpu';
import {
  Fn, Loop, OnBeforeFrameUpdate, Var, and, cameraPosition, cameraViewMatrix, clamp, diffuseContribution, dot, float, hash,
  instanceIndex, instancedBufferAttribute, instancedDynamicBufferAttribute, max, modelPosition, modelWorldMatrix,
  mx_noise_float, normalLocal, normalView, normalWorldGeometry, not, or, positionGeometry, positionLocal,
  positionViewDirection, positionWorld, texture, time, uniform, uv, vec2, vec3, vec4, vertexColor,
} from 'three/tsl';
import { targetTexture } from '../nodes/engineNodesHandler';
import {
  GRAPH_OPS, SUN_OPS, validateGraph, type GraphBinding, type GraphCost, type GraphIr, type GraphLiteral, type GraphNode,
  type GraphRef, type GraphValidationOptions, type GraphValueType,
} from '../../core/materialGraph';

/** a select side costing at most this many estimated instructions is evaluated unconditionally (branch-free) */
export const BRANCH_LIGHT_COST = 16;
const DIV_EPSILON = 1e-6;

/** what the compiler needs beyond the graph */
export interface CompileGraphOptions extends GraphValidationOptions {
  /** resolves a texture param's file reference (an admitted texture); required when the graph samples one */
  readonly textures?: (ref: string) => THREE.Texture;
  /** a post graph's scene colour: the engine's render target texture, sampled upright (`targetTexture`) */
  readonly scene?: THREE.Texture;
}

/** a compiled graph */
export interface CompiledGraph {
  readonly material: NodeMaterial;
  /** what the graph costs (validation's count) */
  readonly cost: GraphCost;
  /** the bound params: a runtime adapter feeds each from its day key or shard-state field through `setParam` */
  readonly bindings: readonly { readonly param: string; readonly bind: GraphBinding }[];
  /** move a param's value (uniform only: the program stays) */
  readonly setParam: (name: string, value: GraphLiteral) => void;
  /** how the selects compiled: branch-free (`light`) or a real if / else (`branch`) */
  readonly selects: { readonly light: number; readonly branch: number };
  /** the outline stage's second draw (null without one): attach it with `attachOutline` */
  readonly outline: NodeMaterial | null;
}

/** the instance matrices' arrays as instanced buffers, shared by every graph that reads `objectOrigin` */
const instanceOrigins = new WeakMap<THREE.InstancedBufferAttribute, THREE.InstancedInterleavedBuffer>();
/**
 * `objectOrigin`: the world position of the drawn object's origin, an instanced mesh's own instance's (its matrix's
 * translation column, read as one instanced vec4 over the matrices' array, kept in step with their version).
 */
function objectOriginNode(): Node<'vec3'> {
  return Fn((builder: NodeBuilder): Node<'vec3'> => {
    const object = builder.object;
    if (!(object instanceof THREE.InstancedMesh)) return modelPosition;
    const matrices = object.instanceMatrix;
    let buffer = instanceOrigins.get(matrices);
    if (buffer === undefined) {
      buffer = new THREE.InstancedInterleavedBuffer(matrices.array, 16, 1);
      buffer.setUsage(matrices.usage);
      instanceOrigins.set(matrices, buffer);
    }
    const shared = buffer;
    OnBeforeFrameUpdate(() => { if (shared.version !== matrices.version) shared.version = matrices.version; });
    const read = matrices.usage === THREE.DynamicDrawUsage ? instancedDynamicBufferAttribute : instancedBufferAttribute;
    const column = read(shared, 'vec4', 16, 12);
    return new ConvertNode<'vec3'>(new SplitNode(new OperatorNode('*', modelWorldMatrix, new JoinNode([new SplitNode(column, 'xyz'), float(1)])), 'xyz'), 'vec3');
  }, 'vec3')();
}

/**
 * Add a compiled graph's outline (`CompiledGraph.outline`) to `mesh` as its second draw: a child mesh over a shallow copy
 * of its geometry (the same attribute objects, so the same GPU buffers; the node back-end writes instancing attributes
 * into a geometry, so each node mesh needs its own), sharing an instanced mesh's matrices and following its count. The
 * hull casts and receives no shadow. Returns the child (remove it, or the parent, to drop the outline).
 */
export function attachOutline(mesh: THREE.Mesh, outline: NodeMaterial): THREE.Mesh {
  const source = mesh.geometry;
  const geometry = new THREE.BufferGeometry();
  for (const [k, a] of Object.entries(source.attributes)) geometry.setAttribute(k, a);
  geometry.setIndex(source.index);
  for (const g of source.groups) geometry.addGroup(g.start, g.count, g.materialIndex);
  geometry.setDrawRange(source.drawRange.start, source.drawRange.count);
  let hull: THREE.Mesh;
  if (mesh instanceof THREE.InstancedMesh) {
    const instanced = new THREE.InstancedMesh(geometry, outline, 0);
    instanced.instanceMatrix = mesh.instanceMatrix;
    instanced.instanceColor = mesh.instanceColor;
    instanced.count = mesh.count;
    instanced.onBeforeRender = () => { instanced.count = mesh.count; };
    hull = instanced;
  } else hull = new THREE.Mesh(geometry, outline);
  hull.name = `${mesh.name}:outline`;
  hull.castShadow = false;
  hull.receiveShadow = false;
  mesh.add(hull);
  return hull;
}

/** one compiled value with its IR type */
interface Val { readonly t: GraphValueType; readonly n: Node }

/** what a lit graph hands its material: each lighting output, built on demand from the engine's light inputs */
interface LitHooks {
  /** the radiance one directional light adds, and the factor on its physical specular (null: no specular) */
  readonly sun: (direction: Node<'vec3'>, colour: Node<'vec3'>, shadow: Node<'float'>) => { readonly radiance: Node<'vec3'>; readonly specular: Node<'float'> | null };
  readonly ambient: ((irradiance: Node<'vec3'>) => Node<'vec3'>) | null;
  readonly grade: ((lit: Node<'vec3'>) => Node<'vec3'>) | null;
  /** whether the model keeps any specular (the graph declared `sunSpecular`) */
  readonly specular: boolean;
}
const isNodeValue = (v: unknown): v is Node => typeof v === 'object' && v !== null && Reflect.get(v, 'isNode') === true;
/** the lighting context's accumulators are vec3 var nodes */
const isVec3Node = (v: unknown): v is Node<'vec3'> => isNodeValue(v);
/** add to one of the lighting context's accumulators */
function accumulate(target: unknown, value: Node<'vec3'>): void {
  if (!isVec3Node(target)) throw new Error('material graph: a lighting accumulator that is not a node');
  target.addAssign(value);
}
const vec3Of = (v: unknown, what: string): Node<'vec3'> => {
  if (!isNodeValue(v)) throw new Error(`material graph: ${what} is not a node`);
  return new ConvertNode<'vec3'>(v, 'vec3');
};
type DirectInput = Parameters<PhysicalLightingModel['direct']>[0];

/**
 * The lighting stage's model: three's physical model, with each directional light (the sun; the sky rig's cascades are
 * one sun) lit by the graph's `sun` sub-graph instead. The light node has already applied its shadow (and a cascade its
 * slice gate) to `lightColor`; its unshadowed colour (`baseColorNode`) recovers the ratio as the families do.
 */
class GraphLightingModel extends PhysicalLightingModel {
  private readonly hooks: LitHooks;
  constructor(hooks: LitHooks) { super(); this.hooks = hooks; }

  override direct(input: DirectInput, builder: NodeBuilder): void {
    const light: unknown = Reflect.get(input.lightNode, 'light');
    if (!(light instanceof THREE.DirectionalLight)) { this.physical(input, builder, true, this.hooks.specular); return; }
    const shadowed = vec3Of(input.lightColor, 'a light colour');
    const baseNode: unknown = Reflect.get(input.lightNode, 'baseColorNode');
    const base = isNodeValue(baseNode) ? vec3Of(baseNode, 'a light colour') : shadowed;
    const shadow = clamp(dot(shadowed, vec3(1)).div(max(dot(base, vec3(1)), 1e-5)), 0, 1);
    const sun = this.hooks.sun(vec3Of(input.lightDirection, 'a light direction'), base, shadow);
    accumulate(input.reflectedLight.directDiffuse, sun.radiance);
    if (sun.specular !== null) this.physical({ ...input, lightColor: base.mul(sun.specular) }, builder, false, true);
  }

  /** three's physical direct term for this light, keeping its diffuse and / or its specular */
  private physical(input: DirectInput, builder: NodeBuilder, diffuse: boolean, specular: boolean): void {
    if (diffuse && specular) { super.direct(input, builder); return; }
    const tmp = { directDiffuse: vec3(0).toVar(), directSpecular: vec3(0).toVar(), indirectDiffuse: vec3(0).toVar(), indirectSpecular: vec3(0).toVar() };
    super.direct({ ...input, reflectedLight: tmp }, builder);
    if (diffuse) accumulate(input.reflectedLight.directDiffuse, tmp.directDiffuse);
    if (specular) accumulate(input.reflectedLight.directSpecular, tmp.directSpecular);
  }

  override indirect(builder: NodeBuilder): void {
    const ambient = this.hooks.ambient;
    if (ambient === null) this.indirectDiffuse(builder);
    else {
      const ctx: unknown = builder.context;
      const irradiance: unknown = typeof ctx === 'object' && ctx !== null ? Reflect.get(ctx, 'irradiance') : null;
      const reflected: unknown = typeof ctx === 'object' && ctx !== null ? Reflect.get(ctx, 'reflectedLight') : null;
      const indirect: unknown = typeof reflected === 'object' && reflected !== null ? Reflect.get(reflected, 'indirectDiffuse') : null;
      accumulate(indirect, ambient(vec3Of(irradiance, 'the irradiance')));
    }
    if (this.hooks.specular) this.indirectSpecular(builder);
    this.ambientOcclusion(builder);
  }
}

/** a standard node material lit by a graph's lighting stage, its lit colour graded when the graph says so */
class GraphLitMaterial extends MeshStandardNodeMaterial {
  private readonly hooks: LitHooks;
  constructor(hooks: LitHooks) { super(); this.hooks = hooks; }
  override setupLightingModel(): PhysicalLightingModel { return new GraphLightingModel(this.hooks); }
  override setupLighting(builder: NodeBuilder): Node {
    const lit = super.setupLighting(builder);
    return this.hooks.grade === null ? lit : this.hooks.grade(vec3Of(lit, 'the lit colour'));
  }
}

/** the root nodes that read a sun input, directly or through their inputs and loop bodies */
function lightDependents(ir: GraphIr): ReadonlySet<string> {
  type Nodes = Readonly<Record<string, GraphNode>>;
  const memo = new Map<string, boolean>();
  function depRef(chain: readonly Nodes[], r: GraphRef | undefined): boolean {
    if (typeof r !== 'string') return false;
    for (let i = chain.length - 1; i >= 0; i--) {
      const n = chain[i]?.[r];
      if (n === undefined) continue;
      return i === 0 ? depRoot(r) : depNode(chain.slice(0, i + 1), n);
    }
    return false;
  }
  function depNode(chain: readonly Nodes[], n: GraphNode): boolean {
    if (SUN_OPS.has(n.op) || (n.in ?? []).some((x) => depRef(chain, x))) return true;
    const body = n.body;
    if (body === undefined) return false;
    const inner = [...chain, body.nodes];
    return Object.values(body.nodes).some((b) => depNode(inner, b)) || depRef(inner, body.out);
  }
  function depRoot(id: string): boolean {
    const known = memo.get(id);
    if (known !== undefined) return known;
    const n = ir.nodes[id];
    const v = n !== undefined && depNode([ir.nodes], n);
    memo.set(id, v);
    return v;
  }
  return new Set(Object.keys(ir.nodes).filter(depRoot));
}

const LEN: Readonly<Record<GraphValueType, number>> = { float: 1, vec2: 2, vec3: 3, vec4: 4, bool: 1 };
const asBool = (v: Val): Node<'bool'> => new ConvertNode<'bool'>(v.n, 'bool');
const asFloat = (v: Val): Node<'float'> => new ConvertNode<'float'>(v.n, 'float');
/** a float widened to `t` (a no-op for a value already of type t) */
const widen = (v: Val, t: GraphValueType): Node => (v.t === t || t === 'float' || t === 'bool' ? v.n : new ConvertNode(v.n, t));
const literal = (v: GraphLiteral): Val => {
  if (typeof v === 'number') return { t: 'float', n: float(v) };
  const [x = 0, y = 0, z = 0, w = 0] = v;
  if (v.length === 2) return { t: 'vec2', n: vec2(x, y) };
  if (v.length === 3) return { t: 'vec3', n: vec3(x, y, z) };
  return { t: 'vec4', n: vec4(x, y, z, w) };
};
const widest = (vals: readonly Val[]): GraphValueType => vals.reduce<GraphValueType>((t, v) => (LEN[v.t] > LEN[t] ? v.t : t), 'float');

/**
 * Compile a graph to a node material. Throws (with every reason) when validation refuses it. Call it only after
 * `loadGraphCompiler(renderer)` resolved, which installs the engine's node handler first.
 */
export function compileGraph(input: unknown, opts: CompileGraphOptions = {}): CompiledGraph {
  const checked = validateGraph(input, opts);
  if (!checked.ok) throw new Error(`material graph refused:\n  ${checked.errors.join('\n  ')}`);
  const ir: GraphIr = checked.graph;
  const selects = { light: 0, branch: 0 };

  // params → uniforms (a colour is written in sRGB and held linear, as the families hold theirs)
  const uniforms = new Map<string, Val>();
  const setters = new Map<string, (v: GraphLiteral) => void>();
  const bindings: { param: string; bind: GraphBinding }[] = [];
  const texParams = new Map<string, string>();
  for (const [name, p] of Object.entries(ir.params ?? {})) {
    if (p.bind !== undefined) bindings.push({ param: name, bind: p.bind });
    if (p.type === 'texture') { if (typeof p.value === 'string') texParams.set(name, p.value); continue; }
    if (typeof p.value === 'string') continue;
    const arr = (v: GraphLiteral): readonly number[] => (typeof v === 'number' ? [v] : v);
    if (p.type === 'float') {
      const u = uniform(typeof p.value === 'number' ? p.value : 0);
      uniforms.set(name, { t: 'float', n: u });
      setters.set(name, (v) => { u.value = arr(v)[0] ?? 0; });
    } else if (p.type === 'colour') {
      const c = new THREE.Color(), set = (v: GraphLiteral): void => { const [r = 0, g = 0, b = 0] = arr(v); c.setRGB(r, g, b, THREE.SRGBColorSpace); };
      set(p.value);
      uniforms.set(name, { t: 'vec3', n: uniform(c) });
      setters.set(name, set);
    } else if (p.type === 'vec2') {
      const v2 = new THREE.Vector2().fromArray(arr(p.value));
      uniforms.set(name, { t: 'vec2', n: uniform(v2) });
      setters.set(name, (v) => { v2.fromArray(arr(v)); });
    } else if (p.type === 'vec3') {
      const v3 = new THREE.Vector3().fromArray(arr(p.value));
      uniforms.set(name, { t: 'vec3', n: uniform(v3) });
      setters.set(name, (v) => { v3.fromArray(arr(v)); });
    } else {
      const v4 = new THREE.Vector4().fromArray(arr(p.value));
      uniforms.set(name, { t: 'vec4', n: uniform(v4) });
      setters.set(name, (v) => { v4.fromArray(arr(v)); });
    }
  }

  // how many places read each root node (a select side read elsewhere is computed anyway, so it costs a branch nothing)
  const readers = new Map<string, number>();
  const countRef = (r: GraphRef | undefined): void => { if (typeof r === 'string') readers.set(r, (readers.get(r) ?? 0) + 1); };
  for (const n of Object.values(ir.nodes)) for (const r of n.in ?? []) countRef(r);
  const st = ir.stages;
  countRef(st['vertex.offset']?.offset);
  for (const k of ['colour', 'alpha', 'emissive', 'roughness', 'metalness', 'occlusion'] as const) countRef(st.surface?.[k]);
  countRef(st.post?.colour);
  for (const k of ['sun', 'sunSpecular', 'ambient', 'grade'] as const) countRef(st.lighting?.[k]);
  /** the instructions only this side of a select would run */
  const ownCost = (r: GraphRef | undefined, seen = new Set<string>()): number => {
    if (typeof r !== 'string' || seen.has(r) || (readers.get(r) ?? 0) > 1) return 0;
    seen.add(r);
    const n = ir.nodes[r];
    if (n === undefined) return 0; // a loop body's own node: counted with its loop
    const spec = GRAPH_OPS[n.op];
    const body = n.op === 'loop' && n.body !== undefined ? Object.keys(n.body.nodes).length * (n.count ?? 1) * 2 : 0;
    return (spec?.cost ?? 0) + body + (n.in ?? []).reduce<number>((sum, x) => sum + ownCost(x, seen), 0);
  };

  interface Scope { readonly nodes: Readonly<Record<string, GraphNode>>; readonly parent: Scope | null; readonly memo: Map<string, Val>; readonly acc: Val | null; readonly index: Val | null }
  const root: Scope = { nodes: ir.nodes, parent: null, memo: new Map(), acc: null, index: null };
  // the lighting stage's inputs, live only while its sub-graph builds; a node reading a sun input memoizes per light
  let sunIn: { readonly direction: Node<'vec3'>; readonly colour: Node<'vec3'>; readonly shadow: Node<'float'> } | null = null;
  let irradianceIn: Node<'vec3'> | null = null;
  let litIn: Node<'vec3'> | null = null;
  const perLight = lightDependents(ir);
  let lightMemo = new Map<string, Val>();

  function ref(r: GraphRef, scope: Scope): Val {
    if (typeof r !== 'string') return literal(r);
    for (let s: Scope | null = scope; s !== null; s = s.parent) {
      const n = s.nodes[r];
      if (n === undefined) continue;
      const memo = s === root && perLight.has(r) ? lightMemo : s.memo;
      const hit = memo.get(r);
      if (hit !== undefined) return hit;
      const v = build(n, s);
      memo.set(r, v);
      return v;
    }
    throw new Error(`material graph: unknown node ${r}`); // validation already refused this
  }

  function build(n: GraphNode, scope: Scope): Val {
    const ins = n.op === 'loop' ? [] : (n.in ?? []).map((r) => ref(r, scope));
    const [a, b, c] = ins;
    const one = (): Val => { if (a === undefined) throw new Error(`material graph: ${n.op} lacks an input`); return a; };
    const two = (): [Val, Val] => { if (a === undefined || b === undefined) throw new Error(`material graph: ${n.op} lacks inputs`); return [a, b]; };
    const three = (): [Val, Val, Val] => { if (a === undefined || b === undefined || c === undefined) throw new Error(`material graph: ${n.op} lacks inputs`); return [a, b, c]; };
    /** a component-wise op over inputs widened to their common type */
    const same = (f: (...xs: Node[]) => Node, vals: readonly Val[]): Val => { const t = widest(vals); return { t, n: f(...vals.map((v) => widen(v, t))) }; };
    switch (n.op) {
      case 'uv': return { t: 'vec2', n: uv() };
      case 'positionLocal': return { t: 'vec3', n: positionLocal };
      case 'positionGeometry': return { t: 'vec3', n: positionGeometry };
      case 'objectOrigin': return { t: 'vec3', n: objectOriginNode() };
      case 'positionWorld': return { t: 'vec3', n: positionWorld };
      case 'normalLocal': return { t: 'vec3', n: normalLocal };
      case 'normalWorld': return { t: 'vec3', n: normalWorldGeometry };
      case 'cameraPosition': return { t: 'vec3', n: cameraPosition };
      case 'time': return { t: 'float', n: time };
      case 'instanceHash': return { t: 'float', n: hash(instanceIndex) };
      case 'vertexColour': return { t: 'vec3', n: new SplitNode(vertexColor(), 'xyz') };
      case 'screenUV': return { t: 'vec2', n: uv() };
      case 'normalView': return { t: 'vec3', n: normalView };
      case 'viewDirection': return { t: 'vec3', n: positionViewDirection };
      case 'albedo': return { t: 'vec3', n: diffuseContribution };
      case 'sunDirection': if (sunIn !== null) return { t: 'vec3', n: sunIn.direction }; break;
      case 'sunColour': if (sunIn !== null) return { t: 'vec3', n: sunIn.colour }; break;
      case 'sunShadow': if (sunIn !== null) return { t: 'float', n: sunIn.shadow }; break;
      case 'irradiance': if (irradianceIn !== null) return { t: 'vec3', n: irradianceIn }; break;
      case 'litColour': if (litIn !== null) return { t: 'vec3', n: litIn }; break;
      case 'sceneColour': {
        if (opts.scene === undefined) throw new Error('material graph: a post graph reads sceneColour, so compile it with { scene }');
        return { t: 'vec4', n: targetTexture(opts.scene, uv()) };
      }
      case 'const': return literal(n.value ?? 0);
      case 'param': {
        const u = n.param === undefined ? undefined : uniforms.get(n.param);
        if (u === undefined) throw new Error(`material graph: unknown param ${String(n.param)}`);
        return u;
      }
      case 'add': return same((x, y) => new OperatorNode('+', x, y), two());
      case 'sub': return same((x, y) => new OperatorNode('-', x, y), two());
      case 'mul': return same((x, y) => new OperatorNode('*', x, y), two());
      case 'div': return same((x, y) => new OperatorNode('/', x, safeDivisor(y, n.in?.[1])), two());
      case 'min': return same((x, y) => new MathNode('min', x, y), two());
      case 'max': return same((x, y) => new MathNode('max', x, y), two());
      case 'mod': return same((x, y) => { const d = safeDivisor(y, n.in?.[1]); return new OperatorNode('-', x, new OperatorNode('*', d, new MathNode('floor', new OperatorNode('/', x, d)))); }, two());
      case 'pow': return same((x, y) => new MathNode('pow', new MathNode('max', x, float(0)), y), two());
      case 'step': return same((x, y) => new MathNode('step', x, y), two());
      case 'clamp': return same((x, lo, hi) => new MathNode('clamp', x, lo, hi), three());
      case 'smoothstep': return same((e0, e1, x) => new MathNode('smoothstep', e0, e1, x), three());
      case 'abs': case 'floor': case 'fract': case 'sin': case 'cos': case 'exp': case 'negate': case 'fwidth': case 'normalize': {
        const v = one();
        return { t: v.t, n: new MathNode(n.op, v.n) };
      }
      case 'oneMinus': { const v = one(); return { t: v.t, n: new OperatorNode('-', widen({ t: 'float', n: float(1) }, v.t), v.n) }; }
      case 'saturate': { const v = one(); return { t: v.t, n: new MathNode('clamp', v.n, float(0), float(1)) }; }
      case 'length': return { t: 'float', n: new MathNode('length', one().n) };
      case 'viewToWorld': return { t: 'vec3', n: new MathNode('normalize', new SplitNode(new OperatorNode('*', new JoinNode([one().n, float(0)]), cameraViewMatrix), 'xyz')) };
      case 'worldToLocal': return { t: 'vec3', n: new SplitNode(new OperatorNode('*', new JoinNode([one().n, float(0)]), modelWorldMatrix), 'xyz') };
      case 'dot': { const [x, y] = two(); return { t: 'float', n: new MathNode('dot', x.n, y.n) }; }
      case 'mix': {
        const [x, y, f] = three(), t = widest([x, y]);
        return { t, n: new MathNode('mix', widen(x, t), widen(y, t), f.n) };
      }
      case 'lt': case 'lte': case 'gt': case 'gte': case 'eq': {
        const [x, y] = two();
        const op = n.op === 'lt' ? '<' : n.op === 'lte' ? '<=' : n.op === 'gt' ? '>' : n.op === 'gte' ? '>=' : '==';
        return { t: 'bool', n: new OperatorNode(op, x.n, y.n) };
      }
      case 'and': { const [x, y] = two(); return { t: 'bool', n: and(asBool(x), asBool(y)) }; }
      case 'or': { const [x, y] = two(); return { t: 'bool', n: or(asBool(x), asBool(y)) }; }
      case 'not': return { t: 'bool', n: not(asBool(one())) };
      case 'select': {
        const [cond, x, y] = three();
        if (x.t === 'bool' && y.t === 'bool') { selects.branch++; return { t: 'bool', n: new ConditionalNode(asBool(cond), x.n, y.n) }; }
        const t = widest([x, y]);
        if (scope.parent === null && Math.max(ownCost(n.in?.[1]), ownCost(n.in?.[2])) > BRANCH_LIGHT_COST) {
          selects.branch++;
          return { t, n: new ConditionalNode(asBool(cond), widen(x, t), widen(y, t)) };
        }
        selects.light++;
        return { t, n: new MathNode('mix', widen(y, t), widen(x, t), new ConvertNode<'float'>(cond.n, 'float')) };
      }
      case 'swizzle': {
        const mask = n.mask ?? 'x';
        const t: GraphValueType = mask.length === 1 ? 'float' : mask.length === 2 ? 'vec2' : mask.length === 3 ? 'vec3' : 'vec4';
        return { t, n: new SplitNode(one().n, mask) };
      }
      case 'combine': {
        const k = ins.reduce((s, v) => s + LEN[v.t], 0);
        const t: GraphValueType = k === 2 ? 'vec2' : k === 3 ? 'vec3' : 'vec4';
        return { t, n: new JoinNode(ins.map((v) => v.n)) };
      }
      case 'noise': {
        const p = one();
        return { t: 'float', n: p.t === 'vec2' ? mx_noise_float(new ConvertNode<'vec2'>(p.n, 'vec2')) : mx_noise_float(new ConvertNode<'vec3'>(p.n, 'vec3')) };
      }
      case 'texture': {
        const file = n.param === undefined ? undefined : texParams.get(n.param);
        if (file === undefined || opts.textures === undefined) throw new Error(`material graph: texture ${String(n.param)} needs { textures }`);
        return { t: 'vec4', n: texture(opts.textures(file), one().n) };
      }
      case 'acc': if (scope.acc !== null) return scope.acc; break;
      case 'index': if (scope.index !== null) return scope.index; break;
      case 'loop': {
        const init = ref(n.in?.[0] ?? 0, scope), body = n.body, count = n.count ?? 1;
        if (body === undefined) break;
        const looped = Fn(() => {
          const acc = Var(init.n);
          Loop(count, ({ i }: { i: Node<'int'> }) => {
            const inner: Scope = { nodes: body.nodes, parent: scope, memo: new Map(), acc: { t: init.t, n: acc }, index: { t: 'float', n: float(i) } };
            acc.assign(ref(body.out, inner).n);
          });
          return acc;
        });
        return { t: init.t, n: looped() };
      }
      default: break;
    }
    throw new Error(`material graph: op ${n.op} has no compiler`); // validation already refused it
  }

  /** a divisor kept off zero, unless it is a non-zero literal: b + step(|b|, ε)·ε (exactly b wherever |b| > ε) */
  function safeDivisor(y: Node, r: GraphRef | undefined): Node {
    const nonZeroLiteral = typeof r === 'number' ? r !== 0 : Array.isArray(r) && r.every((x) => x !== 0);
    if (nonZeroLiteral) return y;
    return new OperatorNode('+', y, new OperatorNode('*', new MathNode('step', new MathNode('abs', y), float(DIV_EPSILON)), float(DIV_EPSILON)));
  }

  // the material
  const out = (r: GraphRef | undefined): Val | null => (r === undefined ? null : ref(r, root));
  /** a post graph: a fullscreen quad's material (its own pass), unfogged */
  const postMaterial = (): NodeMaterial => {
    const m = new MeshBasicNodeMaterial({ depthTest: false, depthWrite: false });
    const colour = out(st.post?.colour);
    if (colour !== null) m.colorNode = new ConvertNode<'vec3'>(widen(colour, 'vec3'), 'vec3');
    m.vertexNode = vec4(positionLocal.xy, 0, 1);
    m.fog = false;
    return m;
  };
  /** the lighting stage's hooks: each builds its sub-graph with its inputs live (the material calls them while it builds) */
  const litHooks = (lit: NonNullable<GraphIr['stages']['lighting']>): LitHooks => {
    const asVec3 = (r: GraphRef): Node<'vec3'> => new ConvertNode<'vec3'>(widen(ref(r, root), 'vec3'), 'vec3');
    const specularRef = lit.sunSpecular;
    const ambientRef = lit.ambient, gradeRef = lit.grade;
    return {
      specular: specularRef !== undefined,
      sun(direction, colour, shadow) {
        sunIn = { direction, colour, shadow };
        lightMemo = new Map();
        try {
          return { radiance: asVec3(lit.sun), specular: specularRef === undefined ? null : asFloat(ref(specularRef, root)) };
        } finally { sunIn = null; }
      },
      ambient: ambientRef === undefined ? null : (irradiance) => {
        irradianceIn = irradiance;
        try { return asVec3(ambientRef); } finally { irradianceIn = null; }
      },
      grade: gradeRef === undefined ? null : (litColour) => {
        litIn = litColour;
        try { return asVec3(gradeRef); } finally { litIn = null; }
      },
    };
  };
  /** a material graph: the lighting model's material with the surface and vertex stages in its slots */
  const surfaceMaterial = (): NodeMaterial => {
    const s = st.surface ?? {};
    const lit = st.lighting;
    const m = ir.model === 'unlit' ? new MeshBasicNodeMaterial() : lit !== undefined ? new GraphLitMaterial(litHooks(lit)) : new MeshStandardNodeMaterial();
    const colour = out(s.colour);
    if (colour !== null) m.colorNode = new ConvertNode<'vec3'>(widen(colour, 'vec3'), 'vec3');
    const alpha = out(s.alpha);
    if (alpha !== null) { m.opacityNode = asFloat(alpha); m.transparent = s.alphaCutoff === undefined; }
    if (s.alphaCutoff !== undefined) m.alphaTest = s.alphaCutoff;
    const occlusion = out(s.occlusion);
    if (occlusion !== null) m.aoNode = asFloat(occlusion);
    if (m instanceof MeshStandardNodeMaterial) {
      const emissive = out(s.emissive), roughness = out(s.roughness), metalness = out(s.metalness);
      if (emissive !== null) m.emissiveNode = widen(emissive, 'vec3');
      if (roughness !== null) m.roughnessNode = asFloat(roughness);
      if (metalness !== null) m.metalnessNode = asFloat(metalness);
    }
    const offset = out(st['vertex.offset']?.offset);
    if (offset !== null) m.positionNode = positionLocal.add(new ConvertNode<'vec3'>(widen(offset, 'vec3'), 'vec3'));
    m.side = ir.doubleSided === true ? THREE.DoubleSide : THREE.FrontSide;
    if (m instanceof MeshStandardNodeMaterial) m.flatShading = ir.flatShading === true;
    if (lit?.grade !== undefined) m.toneMapped = false; // a graded colour is display linear already
    m.fog = true; // the engine epilogue (fog) is not optional
    return m;
  };
  /** the outline stage: the inverted hull's own unlit material (back faces, depth on, opaque, fogged) */
  const outlineMaterial = (): NodeMaterial | null => {
    const o = st.outline;
    if (o === undefined) return null;
    const m = new MeshBasicNodeMaterial();
    m.colorNode = new ConvertNode<'vec3'>(widen(ref(o.colour, root), 'vec3'), 'vec3');
    m.positionNode = positionLocal.add(new ConvertNode<'vec3'>(widen(ref(o.offset, root), 'vec3'), 'vec3'));
    m.side = THREE.BackSide;
    m.fog = true;
    m.name = 'graph:outline';
    return m;
  };
  const material = ir.kind === 'post' ? postMaterial() : surfaceMaterial();
  material.name = `graph:${ir.kind}`;
  const outline = ir.kind === 'post' ? null : outlineMaterial();

  return {
    material, cost: checked.cost, bindings, selects, outline,
    setParam(name, value) {
      const set = setters.get(name);
      if (set === undefined) throw new Error(`material graph: no param ${name}`);
      set(value);
    },
  };
}
