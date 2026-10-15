/** Optional graph channels use the classic renderer's constant attribute path. */
import * as THREE from 'three';
import { Node, type NodeBuilder, type NodeMaterial } from 'three/webgpu';
import { nodeObject, varying } from 'three/tsl';

type NumericType = 'float' | 'vec2' | 'vec3' | 'vec4';
/** Independent of the first geometry: every member shares the same typed input. */
class OptionalAttributeNode extends Node {
  private readonly attributeName: string;
  private readonly attributeType: NumericType;
  constructor(name: string, type: NumericType) { super(type); this.attributeName = name; this.attributeType = type; }
  override generate(builder: NodeBuilder, output?: string): string {
    if (Reflect.get(builder, 'shaderStage') !== 'vertex') {
      const built: unknown = varying(nodeObject(this)).build(builder, output);
      if (typeof built !== 'string') throw new Error('Optional graph attribute built no varying');
      return built;
    }
    const get: unknown = Reflect.get(builder, 'getAttribute'), format: unknown = Reflect.get(builder, 'format');
    if (typeof get !== 'function' || typeof format !== 'function') throw new Error('Missing graph attribute builder');
    const input: unknown = Reflect.apply(get, builder, [this.attributeName, this.attributeType]);
    const name: unknown = typeof input === 'object' && input !== null ? Reflect.get(input, 'name') : undefined;
    if (typeof name !== 'string') throw new Error('Missing graph attribute name');
    const built: unknown = Reflect.apply(format, builder, [name, this.attributeType, output ?? this.attributeType]);
    if (typeof built !== 'string') throw new Error('Optional graph attribute built no input');
    return built;
  }
}
export function optionalGraphAttribute(name: string, type: NumericType): Node {
  return nodeObject(new OptionalAttributeNode(name, type));
}

interface Defaults { readonly values: Record<string, number[]>; readonly padded: ReadonlyMap<string, number[]> }
const cache = new WeakMap<object, Defaults>();
function numberList(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((n: unknown) => typeof n === 'number' && Number.isFinite(n));
}
/** Clone-safe metadata, validated before changing any GL or material state. */
function defaults(material: THREE.Material): Defaults | null {
  const raw: unknown = material.userData['graphAttributeDefaults'];
  if (raw === undefined) return null;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error('Invalid graph attribute defaults');
  const known = cache.get(raw);
  if (known !== undefined) return known;
  const values: Record<string, number[]> = {}, padded = new Map<string, number[]>();
  for (const [name, entry] of Object.entries(raw)) {
    const value: unknown = entry;
    if (!/^a[A-Z][A-Za-z0-9_]*$/u.test(name) || !numberList(value) || value.length === 0 || value.length > 4) throw new Error('Invalid graph attribute default');
    values[name] = [...value];
    padded.set(name, [value[0] ?? 0, value[1] ?? 0, value[2] ?? 0, value[3] ?? 1]);
  }
  const result = { values, padded }; cache.set(raw, result); return result;
}
/** Standard binding states consume these on the first VAO setup, including material clones. */
export function prepareGraphAttributeDefaults(material: THREE.Material): void {
  const row = defaults(material);
  if (row !== null && Reflect.get(material, 'defaultAttributeValues') !== row.values) Reflect.set(material, 'defaultAttributeValues', row.values);
}
/** Shadow variants borrow the same immutable channel declaration as the surface. */
export function copyGraphAttributeDefaults(source: NodeMaterial, depth: NodeMaterial): void {
  const row: unknown = source.userData['graphAttributeDefaults'];
  if (row !== undefined) depth.userData['graphAttributeDefaults'] = row;
  prepareGraphAttributeDefaults(depth);
}
/** Constant values are GL-context state, not VAO state: restore missing inputs on every draw. */
export function bindGraphAttributeDefaults(material: THREE.Material, object: unknown, program: unknown,
  gl: Pick<WebGL2RenderingContext, 'vertexAttrib4fv'>): void {
  const row = defaults(material);
  if (row === null || !(object instanceof THREE.Mesh || object instanceof THREE.Points)) return;
  const geometry: unknown = object.geometry;
  if (!(geometry instanceof THREE.BufferGeometry)) return;
  const get: unknown = typeof program === 'object' && program !== null ? Reflect.get(program, 'getAttributes') : undefined;
  if (typeof get !== 'function') return;
  const attributes: unknown = Reflect.apply(get, program, []);
  if (typeof attributes !== 'object' || attributes === null) return;
  for (const [name, value] of row.padded) {
    if (geometry.hasAttribute(name)) continue;
    const input: unknown = Reflect.get(attributes, name);
    const location: unknown = typeof input === 'object' && input !== null ? Reflect.get(input, 'location') : undefined;
    if (typeof location === 'number' && Number.isInteger(location) && location >= 0) gl.vertexAttrib4fv(location, value);
  }
}
