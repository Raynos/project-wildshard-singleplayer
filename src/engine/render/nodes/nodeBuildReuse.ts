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
