import { BufferAttribute, BufferGeometry, InterleavedBufferAttribute, Material, Object3D, Texture, WebGLRenderTarget } from 'three';
import type { Renderer } from './renderer';

interface Label { owner: string; asset: string; priority: number }
const labels = new WeakMap<object, Label>();
const isTexture = (value: unknown): value is Texture => value instanceof Texture;
const isGeometry = (value: unknown): value is BufferGeometry => value instanceof BufferGeometry;
const isMaterial = (value: unknown): value is Material => value instanceof Material;
const isObject = (value: unknown): value is Object3D => value instanceof Object3D;
const isTarget = (value: unknown): value is WebGLRenderTarget => value instanceof WebGLRenderTarget;
function hook(name: string): unknown { return typeof window === 'undefined' ? undefined : Reflect.get(window, name); }
function enabled(): boolean { return typeof hook('__sc_label_gl') === 'function'; }
function emit(name: string, resource: object, label: Label): void {
  const fn = hook(name);
  if (typeof fn === 'function') Reflect.apply(fn, window, [resource, label.owner, label.asset]);
}
function remember(resource: object, label: Label): Label {
  const previous = labels.get(resource);
  if (previous && previous.priority >= label.priority) return previous;
  labels.set(resource, label);
  return label;
}
/** Only a census-enabled page retains metadata; normal gameplay does no label walks or renderer wrapping. */
export function labelAsset<T extends object>(resource: T, owner: string, asset: string): T {
  if (enabled()) remember(resource, { owner, asset: asset.split('?')[0] ?? asset, priority: 3 });
  return resource;
}
export function labelledCreation<T>(owner: string, asset: string, create: () => T): T {
  const fn = hook('__sc_gl_scope');
  return typeof fn === 'function' ? Reflect.apply(fn, window, [owner, asset, create]) as T : create();
}
function data(source: unknown, label: Label): void {
  if (source !== null && typeof source === 'object') emit('__sc_label_source', source, remember(source, label));
}
function markTexture(texture: Texture, fallback: Label): Label {
  const image: unknown = texture.image;
  const current: unknown = image !== null && typeof image === 'object' ? Reflect.get(image, 'currentSrc') : undefined;
  const src: unknown = image !== null && typeof image === 'object' ? Reflect.get(image, 'src') : undefined;
  const url = typeof current === 'string' && current.length > 0 ? current : src;
  const named = typeof url === 'string' && url.length > 0 && !url.startsWith('blob:') ? url.split('?')[0] : texture.name ? `${fallback.asset}/${texture.name}` : undefined;
  const label = remember(texture, named ? { ...fallback, asset: named } : fallback);
  data(image, label);
  if (image !== null && typeof image === 'object') data(Reflect.get(image, 'data'), label);
  for (const mip of texture.mipmaps) data(Reflect.get(mip, 'data'), label);
  return label;
}
function markMaterial(material: Material, label: Label): void {
  for (const [role, value] of Object.entries(material)) if (isTexture(value)) markTexture(value, { ...label, asset: `${label.asset}/${role}` });
  const uniforms: unknown = Reflect.get(material, 'uniforms');
  if (uniforms !== null && typeof uniforms === 'object') for (const [role, uniform] of Object.entries(uniforms)) {
    const value: unknown = uniform !== null && typeof uniform === 'object' ? Reflect.get(uniform, 'value') : undefined;
    for (const item of Array.isArray(value) ? value : [value]) if (isTexture(item)) markTexture(item, { ...label, asset: `${label.asset}/uniform/${role}` });
  }
}
function markGeometry(geometry: BufferGeometry, fallback: Label): void {
  const label = remember(geometry, fallback);
  const attribute = (value: BufferAttribute | InterleavedBufferAttribute, role: string): void => {
    const array = value instanceof InterleavedBufferAttribute ? value.data.array : value.array;
    data(array, { ...label, asset: `${label.asset}/${role}` });
  };
  if (geometry.index) attribute(geometry.index, 'index');
  for (const [role, value] of Object.entries(geometry.attributes)) attribute(value, role);
  for (const [role, values] of Object.entries(geometry.morphAttributes)) for (const [index, value] of (values ?? []).entries()) attribute(value, `morph/${role}/${index}`);
}
function nodeResources(node: Object3D, label: Label): void {
  const geo: unknown = Reflect.get(node, 'geometry'), mats: unknown = Reflect.get(node, 'material');
  if (isGeometry(geo)) markGeometry(geo, label);
  for (const mat of Array.isArray(mats) ? mats : [mats]) if (isMaterial(mat)) markMaterial(mat, label);
  for (const [role, value] of Object.entries(node)) {
    if (value instanceof BufferAttribute) data(value.array, { ...label, asset: `${label.asset}/${role}` });
    else if (isTexture(value)) markTexture(value, { ...label, asset: `${label.asset}/${role}` });
  }
}
function tree(root: Object3D, owner: string, asset: string, priority: number): void {
  const visit = (node: Object3D, path: string): void => {
    const label = remember(node, { owner, asset: path, priority });
    nodeResources(node, label);
    for (const [index, child] of node.children.entries()) visit(child, `${label.asset}/${child.name || `${child.type}[${index}]`}`);
  };
  visit(root, asset);
}
/** Registered pieces and loaded GLBs keep a content path for procedural as well as file-backed geometry. */
export function labelObjectTree(root: Object3D, owner: string, asset: string): void {
  if (enabled()) tree(root, owner, asset, 2);
}
function resourceLabel(value: unknown): Label {
  if (value !== null && typeof value === 'object') {
    const known = labels.get(value);
    if (known) return known;
    if (isTexture(value)) return markTexture(value, { owner: 'engine/texture', asset: 'generated/texture', priority: 0 });
    if (isTarget(value)) return { owner: 'engine/render-target', asset: value.texture.name || `generated/render-target/${value.width}x${value.height}`, priority: 1 };
  }
  return { owner: 'engine/renderer', asset: 'renderer-internal', priority: 0 };
}
/** Bridge Three's CPU resource identity to the GL object at allocation/upload, solely for the census harness. */
export function installGpuLabels(renderer: Renderer): void {
  if (!enabled()) return;
  const proxies = new WeakMap<object, object>();
  const get = renderer.properties.get.bind(renderer.properties);
  renderer.properties.get = (resource) => {
    const properties = get(resource);
    if (properties === null || typeof properties !== 'object') return properties;
    const stamp = (value: unknown, role: string): unknown => {
      if (Array.isArray(value)) {
        for (const [index, item] of value.entries()) stamp(item, `${role}/${index}`);
        return new Proxy(value, { set(target, key, item: unknown) { return Reflect.set(target, key, stamp(item, `${role}/${String(key)}`)); } });
      }
      if (value !== null && typeof value === 'object') {
        const label = resourceLabel(resource);
        emit('__sc_label_gl', value, { ...label, asset: `${label.asset}/${role}` });
      }
      return value;
    };
    // Assets initialized before joining a scene acquire their authored identity later; update the existing GL tag.
    for (const [key, value] of Object.entries(properties)) if (/^__webgl(?:Texture|Depthbuffer|ColorRenderbuffer|DepthRenderbuffer)$/u.test(key)) stamp(value, key.slice(7));
    const prior = proxies.get(properties);
    if (prior) return prior;
    const proxy = new Proxy(properties, { set(target, key, value: unknown) {
      const tagged = typeof key === 'string' && /^__webgl(?:Texture|Depthbuffer|ColorRenderbuffer|DepthRenderbuffer)$/u.test(key) ? stamp(value, key.slice(7)) : value;
      return Reflect.set(target, key, tagged);
    } });
    proxies.set(properties, proxy);
    return proxy;
  };
  for (const method of ['render', 'compile', 'compileAsync'] as const) {
    const original: unknown = Reflect.get(renderer, method);
    if (typeof original !== 'function') continue;
    Reflect.set(renderer, method, function labelledRender(this: Renderer, ...args: unknown[]): unknown {
      if (isObject(args[0])) tree(args[0], 'engine/scene', `generated/${args[0].name || args[0].type}`, 1);
      const result: unknown = Reflect.apply(original, this, args);
      return result;
    });
  }
  const draw = renderer.renderBufferDirect.bind(renderer);
  renderer.renderBufferDirect = (camera, scene, geo, mat, object, group) => {
    const label = labels.get(object) ?? { owner: 'engine/draw', asset: `generated/${mat.name || mat.type}`, priority: 1 };
    markGeometry(geo, label); markMaterial(mat, label);
    draw(camera, scene, geo, mat, object, group);
  };
}
