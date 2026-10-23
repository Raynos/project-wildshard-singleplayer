/**
 * Node-build reuse (P0 slow grid entry; the `nodeReuse` Developer tool, default off).
 *
 * The classic renderer shares one program between materials whose program keys are equal (ground cover's kinds, near
 * and far: sixteen materials, one program), yet the node handler builds every one of them in full (setup, analyze,
 * generate: about 9 ms each in Chromium, unthrottled) only to emit the same code. A reused build takes the code of the
 * first material's build and binds the second material's own nodes: each node of the first material's input graph maps to
 * the node at the same place in the second's (`twinGraph`); every node the build made itself (lights, shadows, the
 * object's matrices, whose values come from the scene and the drawn object, never the material) is shared. A graph whose
 * shape differs anywhere, including a node the first build attached to its inputs that the second lacks, builds in full.
 */
import type * as THREE from 'three';
import { NodeUniform, UniformNode, type Node } from 'three/webgpu';

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

/**
 * The key a reused build must match: the program parameters three keys its programs by (their primitive fields and
 * defines, read before the build writes its code into them), the object's class, its geometry's attributes and the
 * material's plain user data (the graph compiler's build switches). Equal keys mean three would hand both materials one
 * program, so both builds emit the same code.
 */
export function reuseKey(parameters: object, object: THREE.Object3D, material: THREE.Material): string {
  const parts: string[] = [object.constructor.name];
  for (const [name, value] of Object.entries(material.userData)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') parts.push(`$${name}=${String(value)}`);
  }
  for (const key of Object.keys(parameters).sort()) {
    const value: unknown = Reflect.get(parameters, key);
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') parts.push(`${key}=${String(value)}`);
    else if (value === undefined || value === null) parts.push(`${key}=`);
  }
  const defines: unknown = Reflect.get(parameters, 'defines');
  if (typeof defines === 'object' && defines !== null) for (const [name, value] of Object.entries(defines)) parts.push(`#${name}=${String(value)}`);
  const geometry: unknown = Reflect.get(object, 'geometry');
  const attributes: unknown = typeof geometry === 'object' && geometry !== null ? Reflect.get(geometry, 'attributes') : undefined;
  if (typeof attributes === 'object' && attributes !== null) {
    for (const name of Object.keys(attributes).sort()) {
      const attribute: unknown = Reflect.get(attributes, name);
      parts.push(`@${name}:${String(typeof attribute === 'object' && attribute !== null ? Reflect.get(attribute, 'itemSize') : '')}`);
    }
  }
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

/** Pair `a`'s node with `b`'s and walk on: every own property (private slots too), arrays and plain objects. */
function twin(a: Node, b: Node, map: Map<Node, Node>): string | null {
  if (a === b) return null;
  const known = map.get(a);
  if (known !== undefined) return known === b ? null : `${a.constructor.name} pairs twice`;
  if (a.constructor !== b.constructor) return `${a.constructor.name} vs ${b.constructor.name}`;
  map.set(a, b);
  const pair = (x: unknown, y: unknown, at: string): string | null => {
    if (isNode(x)) return isNode(y) ? twin(x, y, map) : `${a.constructor.name}.${at} only on the first`;
    return isNode(y) ? `${a.constructor.name}.${at} only on the second` : null;
  };
  for (const property of Object.getOwnPropertyNames(a)) {
    const x: unknown = Reflect.get(a, property), y: unknown = Reflect.get(b, property);
    let why: string | null = null;
    if (Array.isArray(x)) {
      if (!Array.isArray(y) || x.length !== y.length) why = x.some(isNode) ? `${a.constructor.name}.${property} length` : null;
      else for (let i = 0; i < x.length && why === null; i++) why = pair(x[i], y[i], property);
    } else if (isNode(x) || isNode(y)) why = pair(x, y, property);
    else if (typeof x === 'object' && x !== null && Object.getPrototypeOf(x) === Object.prototype) {
      for (const key of Object.keys(x)) {
        why = pair(Reflect.get(x, key), typeof y === 'object' && y !== null ? Reflect.get(y, key) : undefined, `${property}.${key}`);
        if (why !== null) break;
      }
    }
    if (why !== null) return why;
  }
  return null;
}

/** `first`'s input nodes paired with `second`'s, node for node, or why the two graphs differ */
export function twinGraph(first: THREE.Material, second: THREE.Material): Map<Node, Node> | string {
  const map = new Map<Node, Node>();
  for (const property of Object.getOwnPropertyNames(first)) {
    const a: unknown = Reflect.get(first, property), b: unknown = Reflect.get(second, property);
    if (!isNode(a)) { if (isNode(b)) return `${property} only on the second`; continue; }
    if (!isNode(b)) return `${property} only on the first`;
    const why = twin(a, b, map);
    if (why !== null) return `${property}: ${why}`;
  }
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

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((value, i) => sameValue(value, b[i]));
  const equals: unknown = typeof a === 'object' && a !== null ? Reflect.get(a, 'equals') : undefined;
  return typeof equals === 'function' && Reflect.apply(equals, a, [b]) === true;
}

/**
 * Where a reused build differs from the full build of the same material (the `verify` mode): its code, its uniforms'
 * names and order, a uniform bound to another node whose value differs (a scene-updated node's value is its update's),
 * or its update nodes' classes.
 */
export function buildDifferences(reused: BuildOutput, real: BuildOutput): string[] {
  const out: string[] = [];
  if (reused.vertexShader !== real.vertexShader || reused.fragmentShader !== real.fragmentShader) out.push('code');
  const a = [...reused.uniforms.vertex, ...reused.uniforms.fragment], b = [...real.uniforms.vertex, ...real.uniforms.fragment];
  if (a.map(u => u.name).join(',') !== b.map(u => u.name).join(',')) out.push('uniform names');
  else {
    for (let i = 0; i < a.length; i++) {
      const x = a[i], y = b[i];
      if (x === undefined || y === undefined || x.node === y.node) continue;
      if (x.node.constructor !== y.node.constructor) out.push(`${x.name}: ${x.node.constructor.name} vs ${y.node.constructor.name}`);
      else if ((x.node.updateType === 'none' || x.type === 'texture') && !sameValue(x.node.value, y.node.value)) out.push(`${x.name}: value`);
    }
  }
  if (reused.updateNodes.map(n => n.constructor.name).join(',') !== real.updateNodes.map(n => n.constructor.name).join(',')) out.push('update nodes');
  return out;
}
