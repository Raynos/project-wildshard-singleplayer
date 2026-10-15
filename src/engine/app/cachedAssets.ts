import { BufferAttribute, Object3D, type BufferGeometry } from 'three';
import { app } from './runtime';
import { containerResources, sceneResources } from './sceneOwnership';

/** A module cache keeps source meshes alive across loads; consumers acquire their shared GPU resources. */
export function retainCachedResources<T>(value: T): T {
  const resources = value instanceof Object3D ? sceneResources(value) : containerResources(value);
  for (const resource of resources) {
    const key = `scene:${String(Reflect.get(resource, 'uuid'))}`;
    if (!app.assets.has(key)) app.assets.register(key, resource, { retain: true, cache: true });
  }
  return value;
}

/** Geometries whose `dispose` event is being sent only to drop their GPU bindings, not to retire them. */
const rebinding = new WeakSet();

/**
 * Refresh a live geometry's binding states after a node build adds attributes (three does this through `dispose()`).
 * CPU-backed buffers may upload again; buffers whose CPU arrays were released stay live. Memos that hold the geometry
 * (`cacheUntilDisposed`) keep their value, so a shard's loaded views and built fields survive their first graph draw.
 */
export function rebindGeometry(geometry: BufferGeometry): void {
  // Static attributes can relinquish their CPU arrays after upload. A
  // binding refresh must retain those GPU buffers until real retirement.
  const retained = Object.entries(geometry.attributes).filter(([, attribute]) =>
    attribute instanceof BufferAttribute && attribute.count > 0 && attribute.array.byteLength === 0);
  rebinding.add(geometry);
  for (const [name] of retained) geometry.deleteAttribute(name);
  try { geometry.dispose(); }
  finally {
    for (const [name, attribute] of retained) geometry.setAttribute(name, attribute);
    rebinding.delete(geometry);
  }
}

/** A memo may outlive a scene: forget its value when any owned resource retires instead of returning freed GPU data.
 * A GPU rebind (`rebindGeometry`) is not a retirement.
 * Promises keep their original result/error contract, including disposal tracking after asynchronous loads finish. */
export function cacheUntilDisposed<T>(value: T, invalidate: () => void): T {
  if (value instanceof Promise) {
    void value.then(resolved => { cacheUntilDisposed(resolved, invalidate); return undefined; }, invalidate);
    return value;
  }
  const resources = value instanceof Object3D ? sceneResources(value) : containerResources(value);
  const detach: (() => void)[] = [];
  let active = true;
  const retired = (event: unknown): void => {
    const target: unknown = typeof event === 'object' && event !== null ? Reflect.get(event, 'target') : undefined;
    if (!active || (typeof target === 'object' && target !== null && rebinding.has(target))) return;
    active = false;
    for (const remove of detach) remove();
    invalidate();
  };
  for (const resource of resources) {
    const add: unknown = Reflect.get(resource, 'addEventListener'), remove: unknown = Reflect.get(resource, 'removeEventListener');
    if (typeof add !== 'function' || typeof remove !== 'function') continue;
    Reflect.apply(add, resource, ['dispose', retired]);
    detach.push(() => { Reflect.apply(remove, resource, ['dispose', retired]); });
  }
  return value;
}
