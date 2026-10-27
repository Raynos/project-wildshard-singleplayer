/**
 * Node-build reuse (P0 slow grid entry).
 *
 * Graph materials compiled from equal graphs (ground cover's kinds, near and far) emit the same code, yet three keys
 * each one's program by its own node ids (Node.customCacheKey), so the node handler builds every one in full (setup,
 * analyze, generate: about 9 ms each in Chromium, unthrottled). A reused build takes the code of an earlier material's
 * build under the same program key otherwise (scene, target, fog, layer, object) whose compile made the same nodes
 * (`graphShape`: every node the compile made, in the order it made them, with its class, code-bearing fields,
 * constants and texture kinds; never uniform values or which texture). It binds the second material's own nodes: the
 * n-th node the first compile made maps to the n-th the second made (`pairShapes`), closure-held params included;
 * every node the build made itself (lights, shadows, the object's matrices, whose values come from the scene and the
 * drawn object, never the material) is shared. A build that reads a node the compile's code made inside the build, or
 * one the build attached to the material's inputs, is never reused.
 */
import type * as THREE from 'three';
import { Node, NodeFrame, NodeUniform, ReferenceNode, UniformNode } from 'three/webgpu';

type Uniform = NodeUniform<unknown, unknown>;
/** what a node build leaves for the handler: its code, uniforms by stage, uniform groups and update nodes */
export interface BuildOutput {
  readonly vertexShader: string;
  readonly fragmentShader: string;
  readonly uniforms: { readonly vertex: readonly Uniform[]; readonly fragment: readonly Uniform[] };
  readonly uniformGroups: Readonly<Record<string, { readonly uniforms: readonly { readonly nodeUniform: Uniform }[] }>>;
  readonly updateNodes: readonly Node[];
}

function isNode(value: unknown): value is Node {
  return typeof value === 'object' && value !== null && Reflect.get(value, 'isNode') === true;
}
function isUniform(value: unknown): value is Uniform {
  return typeof value === 'object' && value !== null && Reflect.get(value, 'isNodeUniform') === true && isNode(Reflect.get(value, 'node'));
}
function list(owner: object, key: string): unknown[] | null {
  const value: unknown = Reflect.get(owner, key);
  return Array.isArray(value) ? value : null;
}

/** the owners whose code runs now, innermost last: a node made meanwhile is the innermost's */
const running: GraphNodeOwner[] = [];
/**
 * Node's constructor assigns its id (`this.id = _nodeId++`): while an owner runs, an `id` setter on the prototype sees
 * each node made, keeps the id as the node's own field and hands the node to the running owner. Removed when the last
 * owner returns.
 */
/** G717.O3.1: every node the current recorded build makes, in order (`recordBuild`; null: none recording) */
let buildRecord: Node[] | null = null;
/** owners running plus recorded builds: the prototype hook stays while either needs it */
let holds = 0;
function recordNodes(on: boolean): void {
  const prototype: unknown = Reflect.get(Node, 'prototype');
  if (typeof prototype !== 'object' || prototype === null) throw new Error('Node prototype is missing');
  if (!on) { if (--holds === 0) Reflect.deleteProperty(prototype, 'id'); return; }
  if (holds++ > 0) return;
  // the getter answers only before a node's constructor assigns its own id
  Reflect.defineProperty(prototype, 'id', { configurable: true, get(): undefined { return undefined; }, set(this: object, value: unknown): void {
    Reflect.defineProperty(this, 'id', { value, writable: true, enumerable: true, configurable: true });
    if (isNode(this)) { running.at(-1)?.note(this); buildRecord?.push(this); }
  } });
}

/** The nodes one graph compile made: at compile, in order, and whenever its own code runs inside a build (`run`). */
export class GraphNodeOwner {
  /** the nodes the compile made, in the order it made them */
  readonly compiled: Node[] = [];
  private readonly made = new Set<Node>();
  private readonly built = new WeakSet<Node>();
  private compiling = true;
  /** run `fn`, owning every node it makes */
  run<T>(fn: () => T): T {
    recordNodes(true);
    running.push(this);
    try { return fn(); } finally { running.pop(); recordNodes(false); }
  }
  /** the compile returned: what its code makes from now on, it makes inside a build */
  seal(): void { this.compiling = false; }
  note(node: Node): void {
    if (this.compiling) { this.compiled.push(node); this.made.add(node); } else this.built.add(node);
  }
  /** a node the compile made (`compiled`) */
  madeAtCompile(node: Node): boolean { return this.made.has(node); }
  owns(node: Node): boolean { return this.made.has(node) || this.built.has(node); }
}

/**
 * The program key a reused build must match, without the material's own node hash: the program parameters three keys
 * its programs by (primitive fields and defines, read before the build writes its code into them), with the custom
 * program key's leading material hash cut (its node ids differ between equal graphs; the rest is the scene, target,
 * fog, layer and object), the object's class and the material's plain user data (the graph compiler's build switches).
 * Null when the custom key does not start with the material's hash (a variant keyed another way).
 */
export function reuseKey(parameters: object, object: THREE.Object3D, material: THREE.Material, shared: string | null = null): string | null {
  const own: unknown = Reflect.get(Object.getPrototypeOf(material) ?? {}, 'customProgramCacheKey');
  const custom: unknown = Reflect.get(parameters, 'customProgramCacheKey');
  if (typeof own !== 'function' || typeof custom !== 'string') return null;
  // a shared program key (the handler's `programShare`) leads with the graph's shape in place of the material's hash
  const hash: unknown = shared !== null && custom.startsWith(shared) ? shared : Reflect.apply(own, material, []);
  if (typeof hash !== 'string' || !custom.startsWith(hash)) return null;
  const parts: string[] = [object.constructor.name, `custom=${custom.slice(hash.length)}`];
  for (const [name, value] of Object.entries(material.userData)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') parts.push(`$${name}=${String(value)}`);
  }
  for (const key of Object.keys(parameters).sort()) {
    const value: unknown = Reflect.get(parameters, key);
    if (key === 'customProgramCacheKey') continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') parts.push(`${key}=${String(value)}`);
    else if (value === undefined || value === null) parts.push(`${key}=`);
  }
  const defines: unknown = Reflect.get(parameters, 'defines');
  if (typeof defines === 'object' && defines !== null) for (const [name, value] of Object.entries(defines)) parts.push(`#${name}=${String(value)}`);
  return parts.join('|');
}

/** A finished build's output, or null when it carries what a reuse cannot rebind (node buffers, buffer attributes). */
export function captureBuild(builder: unknown): BuildOutput | null {
  if (typeof builder !== 'object' || builder === null) return null;
  const vertexShader: unknown = Reflect.get(builder, 'vertexShader'), fragmentShader: unknown = Reflect.get(builder, 'fragmentShader');
  const uniforms: unknown = Reflect.get(builder, 'uniforms'), groups: unknown = Reflect.get(builder, 'uniformGroups');
  const updateNodes: unknown = Reflect.get(builder, 'updateNodes'), attributes = list(builder, 'bufferAttributes');
  if (typeof vertexShader !== 'string' || typeof fragmentShader !== 'string' || typeof uniforms !== 'object' || uniforms === null
    || typeof groups !== 'object' || groups === null || !Array.isArray(updateNodes) || attributes === null || attributes.length > 0) return null;
  const vertex = list(uniforms, 'vertex'), fragment = list(uniforms, 'fragment');
  if (vertex === null || fragment === null || ![...vertex, ...fragment].every(isUniform)) return null;
  const vertexUniforms = vertex.filter(isUniform), fragmentUniforms = fragment.filter(isUniform);
  if ([...vertexUniforms, ...fragmentUniforms].some(entry => entry.type === 'buffer')) return null;
  const uniformGroups: Record<string, { uniforms: { nodeUniform: Uniform }[] }> = {};
  for (const name of Object.keys(groups)) {
    const group: unknown = Reflect.get(groups, name);
    const members = typeof group === 'object' && group !== null ? list(group, 'uniforms') : null;
    if (members === null) return null;
    const nodeUniforms = members.map((member: unknown): unknown => typeof member === 'object' && member !== null ? Reflect.get(member, 'nodeUniform') : undefined);
    if (!nodeUniforms.every(isUniform)) return null;
    uniformGroups[name] = { uniforms: nodeUniforms.map(nodeUniform => ({ nodeUniform })) };
  }
  if (!updateNodes.every(isNode)) return null;
  return { vertexShader, fragmentShader, uniforms: { vertex: vertexUniforms, fragment: fragmentUniforms }, uniformGroups, updateNodes: updateNodes.filter(isNode) };
}

/**
 * Whether a finished build reads any of `inputs` (a scene's environment texture and its node, or its fog): some node the
 * build binds as a uniform or updates holds one, at any depth of its node fields. A material that lights with the scene's
 * environment makes a PMREM node of that texture (`EnvironmentNode`), which the build updates before each render; a fog
 * reads the scene's Fog through reference nodes. A build that holds none draws alike under any other one, so a swapped
 * page environment (a region's own sky PMREM, made new each entry) does not change what it binds. True when the
 * builder's lists cannot be read.
 */
export function buildReads(builder: unknown, inputs: readonly object[]): boolean {
  if (typeof builder !== 'object' || builder === null) return true;
  const roots: unknown[] = [];
  for (const key of ['updateNodes', 'updateBeforeNodes', 'updateAfterNodes']) {
    const nodes = list(builder, key);
    if (nodes === null) return true;
    roots.push(...nodes);
  }
  const uniforms: unknown = Reflect.get(builder, 'uniforms');
  if (typeof uniforms !== 'object' || uniforms === null) return true;
  for (const stage of ['vertex', 'fragment']) {
    const entries = list(uniforms, stage);
    if (entries === null) return true;
    for (const entry of entries) roots.push(typeof entry === 'object' && entry !== null ? Reflect.get(entry, 'node') : entry);
  }
  const groups: unknown = Reflect.get(builder, 'uniformGroups');
  const grouped: readonly unknown[] = typeof groups === 'object' && groups !== null ? Object.values(groups) : [];
  for (const group of grouped) {
    const members = typeof group === 'object' && group !== null ? list(group, 'uniforms') : null;
    if (members === null) return true;
    for (const member of members) {
      const uniform: unknown = typeof member === 'object' && member !== null ? Reflect.get(member, 'nodeUniform') : undefined;
      roots.push(typeof uniform === 'object' && uniform !== null ? Reflect.get(uniform, 'node') : member);
    }
  }
  return holdsAny(roots, inputs);
}

/** Whether any of `values` (nodes, arrays, plain objects) holds one of `inputs`, at any depth of their node fields */
export function holdsAny(values: readonly unknown[], inputs: readonly object[]): boolean {
  const held = new Set(inputs), seen = new Set<object>();
  const reads = (value: unknown): boolean => {
    if (typeof value !== 'object' || value === null) return false;
    if (held.has(value)) return true;
    if (seen.has(value)) return false;
    if (!isNode(value) && !Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype) return false;
    seen.add(value);
    const fields: readonly unknown[] = Array.isArray(value) ? value : Object.getOwnPropertyNames(value).map((name): unknown => Reflect.get(value, name));
    return fields.some(reads);
  };
  return values.some(reads);
}

/** a node's fields that never reach its code: identity, cache bookkeeping */
const UNCODED = new Set(['id', 'uuid', 'version', '_cacheKey', '_cacheKeyVersion']);
/** what a texture contributes to the code: its kind, formats and sampling flags (never its image) */
function textureShape(value: object): string {
  const field = (name: string): string => String(Reflect.get(value, name));
  return [value.constructor.name, ...['isDepthTexture', 'isCubeTexture', 'isArrayTexture', 'isData3DTexture', 'isRenderTargetTexture', 'isVideoTexture',
    'isCompressedTexture', 'isFramebufferTexture', 'format', 'type', 'internalFormat', 'colorSpace', 'compareFunction', 'mapping', 'flipY'].map(field)].join(':');
}
function constantShape(value: unknown): string {
  if (typeof value !== 'object' || value === null) return String(value);
  const toArray: unknown = Reflect.get(value, 'toArray');
  return typeof toArray === 'function' ? `${value.constructor.name}(${String(Reflect.apply(toArray, value, []))})` : value.constructor.name;
}

/** A material's compiled graph before it is built: the nodes its compile made, in order, and their shape. */
export interface GraphShape { readonly nodes: readonly Node[]; readonly signature: string }

/**
 * The shape of the nodes `owner`'s compile made: the material's class, plain fields and node slots, then each node in
 * the order the compile made it, with its class, its primitive fields, its constants and its textures' kinds, and the
 * nodes it holds (another of the compile's by its position, any other node by its id: shared nodes are the same in
 * every compile). Uniform values and which texture a node samples are left out: a reuse binds the second material's own.
 */
export function graphShape(material: THREE.Material, owner: GraphNodeOwner): GraphShape {
  const nodes = owner.compiled, index = new Map<Node, number>(nodes.map((node, i) => [node, i]));
  const ref = (node: Node): string => { const at = index.get(node); return at === undefined ? `g${String(node.id)}` : `#${String(at)}`; };
  const shape = (value: unknown): string => {
    if (isNode(value)) return ref(value);
    if (Array.isArray(value)) return `[${value.map(shape).join(',')}]`;
    if (typeof value === 'object' && value !== null) {
      if (Object.getPrototypeOf(value) === Object.prototype) return `{${Object.keys(value).sort().map(key => `${key}:${shape(Reflect.get(value, key))}`).join(',')}}`;
      return Reflect.get(value, 'isTexture') === true ? textureShape(value) : value.constructor.name;
    }
    return typeof value === 'function' ? 'fn' : String(value);
  };
  const top: string[] = [material.constructor.name];
  for (const property of Object.getOwnPropertyNames(material).sort()) {
    const value: unknown = Reflect.get(material, property);
    if (isNode(value)) top.push(`${property}=${ref(value)}`);
    else if ((typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') && !UNCODED.has(property) && property !== 'name') top.push(`${property}=${String(value)}`);
  }
  const lines = nodes.map(node => {
    const uniform = node instanceof UniformNode, constant = Reflect.get(node, 'isConstNode') === true;
    const fields: string[] = [node.constructor.name];
    for (const property of Object.getOwnPropertyNames(node).sort()) {
      if (UNCODED.has(property)) continue;
      const value: unknown = Reflect.get(node, property);
      if (uniform && (property === 'value' || property === '_value') && !isNode(value)) {
        fields.push(`${property}~${typeof value === 'object' && value !== null && Reflect.get(value, 'isTexture') === true ? textureShape(value) : typeof value}`);
      } else if (constant && property === 'value') fields.push(`value=${constantShape(value)}`);
      else fields.push(`${property}=${shape(value)}`);
    }
    return fields.join(' ');
  });
  return { nodes, signature: [top.join(' '), ...lines].join('\n') };
}

/** the nodes reachable from `material`'s node slots now (after its build: what its setup attached included) */
function reachableNodes(material: THREE.Material): Set<Node> {
  const seen = new Set<Node>();
  const walk = (value: unknown): void => {
    if (isNode(value)) {
      if (seen.has(value)) return;
      seen.add(value);
      for (const property of Object.getOwnPropertyNames(value)) walk(Reflect.get(value, property));
    } else if (Array.isArray(value)) for (const item of value) walk(item);
    else if (typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype) for (const item of Object.values(value)) walk(item);
  };
  for (const property of Object.getOwnPropertyNames(material)) { const value: unknown = Reflect.get(material, property); if (isNode(value)) walk(value); }
  return seen;
}

/**
 * The nodes `output` reads that a reuse cannot bind (none: reusable). A reuse binds the nodes the compile made (rebound
 * to the second compile's) and shares the rest: the build's own and the scene's. A node the compile's code made inside
 * the build (a lighting-stage sample of a lent texture), or one the build attached to the material's nodes (a texture's
 * lazily made matrix uniform), would carry the first material's value into the second's draw.
 */
export function unboundReads(output: BuildOutput, material: THREE.Material, owner: GraphNodeOwner): Node[] {
  const reachable = reachableNodes(material);
  const read = [...output.uniforms.vertex, ...output.uniforms.fragment, ...Object.values(output.uniformGroups).flatMap(group => group.uniforms.map(member => member.nodeUniform))]
    .map(entry => entry.node);
  // nodes older than the compile (shared groups, singletons) are the scene's; a newer one reached from the material
  // was attached to it by a build
  const since = owner.compiled[0]?.id ?? Infinity;
  return [...read, ...output.updateNodes].filter(node => !owner.madeAtCompile(node) && (owner.owns(node) || reachable.has(node) && node.id > since));
}

/** A uniform a build made inside one of the compile's reference nodes (ReferenceNode makes its `node` at setup). */
export interface LazyUniform { readonly holder: Node; readonly node: Node }
/** `unbound` split into the reference nodes' lazily made uniforms (a reuse makes the twin's own) and the rest */
export function lazyReads(unbound: readonly Node[], owner: GraphNodeOwner): { readonly lazy: LazyUniform[]; readonly rest: Node[] } {
  const holders = new Map<Node, Node>();
  for (const node of owner.compiled) if (node instanceof ReferenceNode && node.node !== null) holders.set(node.node, node);
  const lazy: LazyUniform[] = [], rest: Node[] = [];
  for (const node of unbound) { const holder = holders.get(node); if (holder === undefined) rest.push(node); else lazy.push({ holder, node }); }
  return { lazy, rest };
}
/**
 * Make each lazy uniform's twin in the second compile, as its build would have (the reference resolved against the drawn
 * object and material, its value read), and pair them in `twins`. False when a twin cannot be made alike.
 */
export function bindLazy(lazy: readonly LazyUniform[], twins: Map<Node, Node>, object: THREE.Object3D, material: THREE.Material): boolean {
  const frame = new NodeFrame(); frame.object = object; frame.material = material;
  for (const { holder, node } of lazy) {
    const twin = twins.get(holder);
    if (!(twin instanceof ReferenceNode)) return false;
    if (twin.node === null) {
      twin.updateReference(frame);
      const update: unknown = Reflect.get(twin, 'updateValue');
      if (typeof update !== 'function') return false;
      Reflect.apply(update, twin, []);
    }
    if (twin.node === null || twin.node.constructor !== node.constructor) return false;
    twins.set(node, twin.node);
  }
  return true;
}

/** the first compile's nodes paired with the second's, by the order they were made (equal shapes: equal compiles) */
export function pairShapes(first: GraphShape, second: GraphShape): Map<Node, Node> {
  const map = new Map<Node, Node>();
  first.nodes.forEach((node, i) => { const other = second.nodes[i]; if (other !== undefined && other !== node) map.set(node, other); });
  return map;
}

/** `output` with each paired node replaced by its twin (null when a paired uniform node is not a uniform node) */
export function rebindBuild(output: BuildOutput, twins: ReadonlyMap<Node, Node>): BuildOutput | null {
  const rebound = new Map<Uniform, Uniform>();
  const entries = [...output.uniforms.vertex, ...output.uniforms.fragment, ...Object.values(output.uniformGroups).flatMap(group => group.uniforms.map(member => member.nodeUniform))];
  for (const entry of entries) {
    if (rebound.has(entry)) continue;
    const node = twins.get(entry.node);
    if (node === undefined) rebound.set(entry, entry);
    else if (node instanceof UniformNode) rebound.set(entry, new NodeUniform(entry.name, entry.type, node));
    else return null;
  }
  const uniform = (entry: Uniform): Uniform => rebound.get(entry) ?? entry;
  const uniformGroups: Record<string, { uniforms: { nodeUniform: Uniform }[] }> = {};
  for (const [name, group] of Object.entries(output.uniformGroups)) uniformGroups[name] = { uniforms: group.uniforms.map(member => ({ nodeUniform: uniform(member.nodeUniform) })) };
  return {
    vertexShader: output.vertexShader, fragmentShader: output.fragmentShader,
    uniforms: { vertex: output.uniforms.vertex.map(uniform), fragment: output.uniforms.fragment.map(uniform) },
    uniformGroups, updateNodes: output.updateNodes.map(node => twins.get(node) ?? node),
  };
}

/**
 * A disposed material's reusable build, kept without its nodes (G782 crossings: a re-entered region rebuilt programs its
 * last visit had built, because a reuse entry lives and dies with its material, so that a key never kept a retired
 * region's nodes alive; the live P0 Driftwood -> Sky Reach -> Driftwood). A pairing needs the first compile's nodes only
 * as positions, so a kept build names each compile-made node by its index in the graph shape and each lazily made
 * reference uniform by its holder's index; a node the build shared from the scene (lights, shadows, the camera) is held
 * weakly, so a retired region's lights go and a build that read them dies with them. It keeps code and positions only:
 * no texture, value, buffer or material of the region it came from.
 */
type KeptRef = { readonly compile: number } | { readonly lazy: number } | { readonly shared: WeakRef<Node>; readonly kind: string }
  | { readonly role: string };
/**
 * The scene inputs a kept build may read by role instead of by node (`keepBuild`'s `roles`): `role` names a node of an
 * input that is made new for each visit (a region's sky PMREM), `inputs` are that input's own objects, which no other
 * node the build keeps may hold. A restore asks the current scene for each role (`restoreBuild`'s `bind`).
 */
export interface KeptRoles { readonly role: (node: Node) => string | null; readonly inputs: readonly object[] }
export interface KeptBuild {
  readonly vertexShader: string;
  readonly fragmentShader: string;
  /** each distinct uniform of the build, by name, type and node reference */
  readonly uniforms: readonly { readonly name: string; readonly type: string; readonly ref: KeptRef }[];
  readonly vertex: readonly number[];
  readonly fragment: readonly number[];
  readonly groups: Readonly<Record<string, readonly number[]>>;
  readonly updateNodes: readonly KeptRef[];
  /** each lazy reference uniform: its holder's index and the class its build made */
  readonly lazy: readonly { readonly holder: number; readonly kind: unknown }[];
  /** an estimate of what the kept build holds (its code as UTF-16, plus its tables) */
  readonly bytes: number;
  /** whether it reads a scene input by role (`KeptRoles`): 'none'; 'rebindable' when no other node it keeps holds that
   *  input, so a restore may bind the current scene's in its place; 'fixed' when one does (only the same input binds) */
  readonly roles: 'none' | 'rebindable' | 'fixed';
}

/** what kind of shared node a kept build read (a diagnostic): three's node type (it survives minification, a class name
 *  does not), its name, and a uniform's value kind */
function sharedKind(node: Node): string {
  const type: unknown = Reflect.get(node.constructor, 'type'), name: unknown = Reflect.get(node, 'name');
  const value: unknown = node instanceof UniformNode ? Reflect.get(node, 'value') : undefined;
  const flag = typeof value === 'object' && value !== null
    ? ['isTexture', 'isColor', 'isVector2', 'isVector3', 'isVector4', 'isMatrix3', 'isMatrix4'].find(f => Reflect.get(value, f) === true) : undefined;
  const valueKind = flag !== undefined ? flag.slice(2) : typeof value === 'object' && value !== null ? 'object' : typeof value;
  return `${typeof type === 'string' ? type : 'Node'}${typeof name === 'string' && name !== '' ? `(${name})` : ''}${node instanceof UniformNode ? `<${valueKind}>` : ''}`;
}

/** `output` (built from `shape`'s compile, with `lazy` uniforms) as positions and weak scene references; null when a
 *  lazy uniform's holder is not one of the compile's nodes */
export function keepBuild(output: BuildOutput, shape: GraphShape, lazy: readonly LazyUniform[], roles?: KeptRoles): KeptBuild | null {
  const index = new Map<Node, number>();
  shape.nodes.forEach((node, i) => { index.set(node, i); });
  const lazyIndex = new Map<Node, number>(), lazyRows: { holder: number; kind: unknown }[] = [];
  for (const { holder, node } of lazy) {
    const at = index.get(holder);
    if (at === undefined) return null;
    lazyIndex.set(node, lazyRows.length); lazyRows.push({ holder: at, kind: node.constructor });
  }
  let byRole = 0;
  const shared: Node[] = [];
  const ref = (node: Node): KeptRef => {
    const l = lazyIndex.get(node);
    if (l !== undefined) return { lazy: l };
    const c = index.get(node);
    if (c !== undefined) return { compile: c };
    const role = roles?.role(node) ?? null;
    if (role !== null) { byRole++; return { role }; }
    shared.push(node);
    return { shared: new WeakRef(node), kind: sharedKind(node) };
  };
  const ids = new Map<Uniform, number>(), uniforms: { name: string; type: string; ref: KeptRef }[] = [];
  const id = (entry: Uniform): number => {
    let at = ids.get(entry);
    if (at === undefined) { at = uniforms.length; ids.set(entry, at); uniforms.push({ name: entry.name, type: entry.type, ref: ref(entry.node) }); }
    return at;
  };
  const groups: Record<string, number[]> = {};
  for (const [name, group] of Object.entries(output.uniformGroups)) groups[name] = group.uniforms.map(member => id(member.nodeUniform));
  const vertex = output.uniforms.vertex.map(id), fragment = output.uniforms.fragment.map(id);
  return { vertexShader: output.vertexShader, fragmentShader: output.fragmentShader, uniforms, vertex, fragment, groups,
    updateNodes: output.updateNodes.map(ref), lazy: lazyRows,
    bytes: 2 * (output.vertexShader.length + output.fragmentShader.length) + 64 * (uniforms.length + output.updateNodes.length),
    // one walk over every node it shares (scene lights and shadows reach deep graphs)
    roles: byRole === 0 || roles === undefined ? 'none' : holdsAny(shared, roles.inputs) ? 'fixed' : 'rebindable' };
}

/**
 * `kept` bound to the compile whose shape is `shape` (the second material's nodes, by position) and to `object` and
 * `material` for its lazy reference uniforms: the build as `rebindBuild` would have made it from the live first build.
 * 'released:<kind>' when a scene node it read has been collected (the kept build is dead; `sharedKind` names the node);
 * a reason when it cannot be bound.
 */
export function restoreBuild(kept: KeptBuild, shape: GraphShape, object: THREE.Object3D, material: THREE.Material,
  bind?: (role: string) => Node | null): BuildOutput | string {
  const frame = new NodeFrame(); frame.object = object; frame.material = material;
  const lazyNodes: Node[] = [];
  for (const { holder, kind } of kept.lazy) {
    const twin = shape.nodes[holder];
    if (!(twin instanceof ReferenceNode)) return 'a reference uniform cannot be made alike';
    if (twin.node === null) {
      twin.updateReference(frame);
      const update: unknown = Reflect.get(twin, 'updateValue');
      if (typeof update !== 'function') return 'a reference uniform cannot be made alike';
      Reflect.apply(update, twin, []);
    }
    if (twin.node === null || twin.node.constructor !== kind) return 'a reference uniform cannot be made alike';
    lazyNodes.push(twin.node);
  }
  let released: string | null = null, unbound: string | null = null;
  const resolve = (ref: KeptRef): Node | undefined => {
    if ('compile' in ref) return shape.nodes[ref.compile];
    if ('lazy' in ref) return lazyNodes[ref.lazy];
    if ('role' in ref) { const bound = bind?.(ref.role) ?? null; if (bound === null) unbound ??= `unbound:${ref.role}`; return bound ?? undefined; }
    const node = ref.shared.deref();
    if (node === undefined) released ??= `released:${ref.kind}`;
    return node;
  };
  const uniforms: Uniform[] = [];
  for (const row of kept.uniforms) {
    const node = resolve(row.ref);
    if (released !== null) return released;
    if (unbound !== null) return unbound;
    if (!(node instanceof UniformNode)) return 'a paired uniform is not a uniform node';
    uniforms.push(new NodeUniform(row.name, row.type, node));
  }
  const updateNodes: Node[] = [];
  for (const ref of kept.updateNodes) {
    const node = resolve(ref);
    if (released !== null) return released;
    if (unbound !== null) return unbound;
    if (node === undefined) return 'a paired update node is missing';
    updateNodes.push(node);
  }
  const pick = (at: number): Uniform => { const u = uniforms[at]; if (u === undefined) throw new Error('Missing kept uniform'); return u; };
  const uniformGroups: Record<string, { uniforms: { nodeUniform: Uniform }[] }> = {};
  for (const [name, members] of Object.entries(kept.groups)) uniformGroups[name] = { uniforms: members.map(at => ({ nodeUniform: pick(at) })) };
  return { vertexShader: kept.vertexShader, fragmentShader: kept.fragmentShader,
    uniforms: { vertex: kept.vertex.map(pick), fragment: kept.fragment.map(pick) }, uniformGroups, updateNodes };
}

/** G717.O3.1 (diagnostic): run a build, recording every node it makes in the order it makes them */
export function recordBuild(fn: () => void): Node[] {
  const outer = buildRecord, nodes: Node[] = [];
  buildRecord = nodes; recordNodes(true);
  try { fn(); } finally { recordNodes(false); buildRecord = outer; }
  return nodes;
}
/** Where a build's uniform and update nodes come from: the compile (by graph position), the build itself (by the order it
 *  made them), or neither (older shared nodes: cached lights, camera and object singletons, by class). A program-source
 *  pack can restore a build positionally only when `other` is empty. */
export interface BuildCensus { readonly compile: number; readonly made: number; readonly other: readonly string[];
  /** the graph's shape signature, hashed (FNV-1a, hex; null: no graph shape): builds of one graph share it (G743) */
  readonly shape: string | null;
  /** the same with every constant's value blanked: two graphs that differ only in constants (uniform candidates) share it */
  readonly loose: string | null;
  /** the shape's first line (the material's class and code-bearing fields) and its constants' values in compile order:
   *  what tells two loose-equal graphs apart */
  readonly top: string | null; readonly constants: readonly string[] }
const fnv = (text: string): string => { let h = 0x811c9dc5; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ (text.codePointAt(i) ?? 0), 0x01000193); return (h >>> 0).toString(16); };
export function buildCensus(output: BuildOutput, shape: GraphShape | null, made: readonly Node[]): BuildCensus {
  const compiled = new Set(shape?.nodes), built = new Set(made), other: string[] = [];
  let compile = 0, fresh = 0;
  const entries = [...output.uniforms.vertex, ...output.uniforms.fragment, ...Object.values(output.uniformGroups).flatMap(group => group.uniforms.map(member => member.nodeUniform))];
  for (const node of new Set([...entries.map(entry => entry.node), ...output.updateNodes])) {
    if (compiled.has(node)) compile++;
    else if (built.has(node)) fresh++;
    else other.push(node.name === '' ? node.constructor.name : `${node.constructor.name}:${node.name}`);
  }
  const signature = shape?.signature ?? null;
  return { compile, made: fresh, other, shape: signature === null ? null : fnv(signature), loose: signature === null ? null : fnv(signature.replaceAll(/ value=\S+/gu, ' value=*')),
    top: signature === null ? null : signature.split('\n', 1)[0] ?? '',
    constants: signature === null ? [] : [...signature.matchAll(/ value=(\S+)/gu)].map(match => match[1] ?? '') };
}
