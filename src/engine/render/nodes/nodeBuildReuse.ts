import { BatchedMesh, BufferAttribute, BufferGeometry, InterleavedBufferAttribute, SkinnedMesh, type Material, type Object3D } from 'three';

/**
 * Node build reuse across materials (OP2, SHARD-PLATFORM entry hitches; Debug ▸ Performance ▸ Shader build reuse).
 *
 * three's classic renderer files one program per program key and reuses it across materials (`acquireProgram`), but a
 * node material still runs its whole TSL build for every key it has no program for, only to land on a program another
 * material already linked. A graph's borrowed-map variants (`bindGraphMeshMap`) are clones that share every node of
 * their graph: on Safari each such build is one 60-130 ms frame of a grid entry's warm-up, and most of them produce a
 * program the renderer already holds.
 *
 * A build's output is reused only where the second build would produce the same sources and the same live bindings:
 * - the same material class, the very same node instances in every node slot, and the same renderer parameters (every
 *   primitive field of three's `getParameters`, a superset of the program key);
 * - the same scene context (lights node and its light objects, environment and fog nodes, the target scene), camera,
 *   geometry attribute layout, and the engine's per-material layer frame and node fog;
 * - every value the first build captured from its material as a constant (a texture sampled by value, `texture(map)`,
 *   instead of through a per-draw material reference) is the same object on the second material; a build that bound a
 *   reference to its own material, added buffer attributes, or drew a skinned, morphed or batched object is never kept.
 * Uniforms read through material references are updated per draw from the drawing material, so the reused update list
 * reads the second material's maps and factors. Each reuse still gets its own uniform groups and light uniforms.
 */

/** What a stock build leaves for program creation and the handler (the builder fields `updateShaderParameters`,
 * `collectUniformsGroups` and the engine's buffer naming read). The builder itself (scene, geometry, caches) is not kept. */
export interface BuildView {
  readonly vertexShader: string;
  readonly fragmentShader: string;
  readonly uniforms: { readonly vertex: readonly unknown[]; readonly fragment: readonly unknown[] };
  readonly uniformGroups: Readonly<Record<string, unknown>>;
  readonly updateNodes: readonly unknown[];
  readonly bufferAttributes: readonly unknown[];
}

interface Entry {
  readonly key: string;
  readonly ctor: unknown;
  readonly children: readonly (readonly [string, object])[];
  readonly captured: readonly (readonly [string, unknown])[];
  readonly view: BuildView;
}

/** Counters for the entry trace (`Game.entryPreparation`): node builds that ran, reuses, and the repeats a build ran for
 * a key some material had already built (the upper bound reuse can remove). */
export interface NodeBuildStats { builds: number; buildMs: number; reused: number; repeats: number; repeatMs: number }

const ENTRIES_PER_GRAPH = 64;
/** Retained sources across all graphs (UTF-16 code units); past it, new builds are no longer kept. */
const SOURCE_BUDGET = 8 * 1024 * 1024;

function isObject(value: unknown): value is object { return (typeof value === 'object' || typeof value === 'function') && value !== null; }

/** every node slot of a material, as `NodeMaterial._getNodeChildren` lists them (own, non-underscore, node-valued) */
export function nodeSlots(material: Material): (readonly [string, object])[] {
  const slots: (readonly [string, object])[] = [];
  for (const property of Object.getOwnPropertyNames(material)) {
    if (property.startsWith('_')) continue;
    const value: unknown = Reflect.get(material, property);
    if (isObject(value) && Reflect.get(value, 'isNode') === true) slots.push([property, value]);
  }
  return slots;
}

/** every primitive field of the renderer's program parameters (a superset of what three's program key reads) */
export function parameterSignature(parameters: object): string {
  const parts: string[] = [];
  for (const key of Object.keys(parameters)) {
    const value: unknown = Reflect.get(parameters, key);
    if (value === null || value === undefined || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') parts.push(`${key}=${String(value)}`);
  }
  return parts.join('\u0001');
}

/** a geometry's attribute layout as a build reads it (names, item sizes, normalisation) */
export function geometrySignature(geometry: unknown): string | null {
  if (!(geometry instanceof BufferGeometry)) return null;
  for (const morphs of Object.values(geometry.morphAttributes)) if (morphs !== undefined && morphs.length > 0) return null;
  const parts: string[] = [];
  const attributes: unknown = Reflect.get(geometry, 'attributes');
  if (!isObject(attributes)) return null;
  for (const name of Object.keys(attributes)) {
    const attribute: unknown = geometry.getAttribute(name);
    if (!(attribute instanceof BufferAttribute || attribute instanceof InterleavedBufferAttribute)) return null;
    parts.push(`${name}:${String(attribute.itemSize)}:${attribute.normalized ? 1 : 0}`);
  }
  return parts.sort().join(',');
}

/** Objects whose build captures the object itself (skinning, morph influences, batch tables) are never shared. */
export function reusableObject(object: Object3D): boolean {
  return !(object instanceof SkinnedMesh) && !(object instanceof BatchedMesh) && geometrySignature(Reflect.get(object, 'geometry')) !== null;
}

/** a 53-bit string hash (cyrb53): the repeat counter keeps numbers, not keys */
function keyHash(text: string): number {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const c = text.codePointAt(i) ?? 0;
    h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/** three's ReferenceNode / MaterialReferenceNode (no flag of their own): a property path read from an object per update */
function isReference(node: unknown): node is object {
  return isObject(node) && typeof Reflect.get(node, 'updateReference') === 'function' && Array.isArray(Reflect.get(node, 'properties')) && 'node' in node;
}

function list(value: unknown): readonly unknown[] { return Array.isArray(value) ? value : []; }

/**
 * The material values a finished build captured as constants: each uniform not driven by a reference node whose value is
 * one of the material's own object-valued properties (a map sampled by value). null: the build cannot be shared (it
 * bound a reference to its own material, or added buffer attributes).
 */
export function capturedValues(material: Material, builder: object): (readonly [string, unknown])[] | null {
  if (list(Reflect.get(builder, 'bufferAttributes')).length > 0) return null;
  const driven = new Set<unknown>();
  for (const node of list(Reflect.get(builder, 'updateNodes'))) {
    if (!isReference(node)) continue;
    // A reference bound to this material reads it on every draw of any material: not shareable.
    if (Reflect.get(node, 'object') === material || Reflect.get(node, 'material') === material) return null;
    driven.add(Reflect.get(node, 'node'));
  }
  const owned = new Map<unknown, string>();
  for (const property of Object.getOwnPropertyNames(material)) {
    const value: unknown = Reflect.get(material, property);
    if (isObject(value) && Reflect.get(value, 'isNode') !== true && !owned.has(value)) owned.set(value, property);
  }
  const captured = new Map<string, unknown>();
  const visit = (node: unknown): void => {
    if (!isObject(node)) return;
    // A sampled texture is a clone that reads its base node's value: a base driven by a reference is per draw.
    for (let base: unknown = node; isObject(base); base = Reflect.get(base, 'referenceNode')) if (driven.has(base)) return;
    const value: unknown = Reflect.get(node, 'value'), slot = owned.get(value);
    if (slot !== undefined) captured.set(slot, value);
  };
  const uniforms: unknown = Reflect.get(builder, 'uniforms');
  for (const stage of ['vertex', 'fragment']) {
    for (const uniform of list(isObject(uniforms) ? Reflect.get(uniforms, stage) : undefined)) visit(isObject(uniform) ? Reflect.get(uniform, 'node') : undefined);
  }
  const groups: unknown = Reflect.get(builder, 'uniformGroups');
  if (isObject(groups)) for (const group of Object.values(groups)) {
    // a group member is a typed uniform (ColorNodeUniform…) whose value reads its NodeUniform's node
    for (const uniform of list(isObject(group) ? Reflect.get(group, 'uniforms') : undefined)) {
      const wrapper: unknown = isObject(uniform) ? Reflect.get(uniform, 'nodeUniform') : undefined;
      const node: unknown = isObject(wrapper) ? Reflect.get(wrapper, 'node') : isObject(uniform) ? Reflect.get(uniform, 'node') : undefined;
      visit(isObject(node) ? node : uniform);
    }
  }
  return [...captured];
}

/** the builder fields a replay needs, or null where a field is missing (a three upgrade changed the builder) */
export function buildView(builder: object): BuildView | null {
  const vertexShader: unknown = Reflect.get(builder, 'vertexShader'), fragmentShader: unknown = Reflect.get(builder, 'fragmentShader');
  const uniforms: unknown = Reflect.get(builder, 'uniforms'), uniformGroups: unknown = Reflect.get(builder, 'uniformGroups');
  const updateNodes: unknown = Reflect.get(builder, 'updateNodes'), bufferAttributes: unknown = Reflect.get(builder, 'bufferAttributes');
  if (typeof vertexShader !== 'string' || typeof fragmentShader !== 'string' || !isObject(uniforms) || !isObject(uniformGroups) ||
    !Array.isArray(updateNodes) || !Array.isArray(bufferAttributes)) return null;
  const vertex: unknown = Reflect.get(uniforms, 'vertex'), fragment: unknown = Reflect.get(uniforms, 'fragment');
  if (!Array.isArray(vertex) || !Array.isArray(fragment)) return null;
  const copy = (items: readonly unknown[]): unknown[] => items.slice();
  return { vertexShader, fragmentShader, uniforms: { vertex: copy(vertex), fragment: copy(fragment) }, uniformGroups: { ...uniformGroups },
    updateNodes, bufferAttributes: copy(bufferAttributes) };
}

/** Node builds kept per graph (keyed weakly by the graph's first node, so they leave with it). */
export class NodeBuildReuse {
  private readonly graphs = new WeakMap<object, Entry[]>();
  private readonly seen = new Set<number>();
  private sourceUnits = 0;
  readonly stats: NodeBuildStats = { builds: 0, buildMs: 0, reused: 0, repeats: 0, repeatMs: 0 };

  /** A kept build for this material under `key` (the parameter, scene and object signature), or undefined. */
  lookup(material: Material, key: string): BuildView | undefined {
    const children = nodeSlots(material), first = children[0];
    if (first === undefined) return undefined;
    for (const entry of this.graphs.get(first[1]) ?? []) {
      if (entry.key !== key || entry.ctor !== material.constructor || entry.children.length !== children.length) continue;
      if (!entry.children.every(([property, node], i) => children[i]?.[0] === property && children[i][1] === node)) continue;
      if (!entry.captured.every(([slot, value]) => Reflect.get(material, slot) === value)) continue;
      return entry.view;
    }
    return undefined;
  }

  /** Keep a finished build of `material` (its real builder) under `key`, where it can be shared. */
  keep(material: Material, key: string, builder: object): void {
    const children = nodeSlots(material), first = children[0];
    if (first === undefined) return;
    const captured = capturedValues(material, builder), view = captured === null ? null : buildView(builder);
    if (captured === null || view === null) return;
    const units = view.vertexShader.length + view.fragmentShader.length;
    if (this.sourceUnits + units > SOURCE_BUDGET) return;
    const entries = this.graphs.get(first[1]) ?? [];
    if (entries.length >= ENTRIES_PER_GRAPH) return;
    entries.push({ key, ctor: material.constructor, children, captured, view });
    this.graphs.set(first[1], entries);
    this.sourceUnits += units;
  }

  /** Count one build or reuse (`ms` spent) under `key`; a key built before is a repeat. */
  count(key: string, ms: number, reused: boolean): void {
    if (reused) this.stats.reused++;
    else { this.stats.builds++; this.stats.buildMs += ms; }
    const hash = keyHash(key);
    if (this.seen.has(hash)) { this.stats.repeats++; if (!reused) this.stats.repeatMs += ms; }
    else this.seen.add(hash);
  }
}
