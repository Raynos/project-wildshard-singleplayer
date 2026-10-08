import { Object3D } from 'three';
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

/** A memo may outlive a scene: forget its value when any owned resource retires instead of returning freed GPU data.
 * Promises keep their original result/error contract, including disposal tracking after asynchronous loads finish. */
export function cacheUntilDisposed<T>(value: T, invalidate: () => void): T {
  if (value instanceof Promise) {
    void value.then(resolved => { cacheUntilDisposed(resolved, invalidate); return undefined; }, invalidate);
    return value;
  }
  const resources = value instanceof Object3D ? sceneResources(value) : containerResources(value);
  const detach: (() => void)[] = [];
  let active = true;
  const retired = (): void => {
    if (!active) return;
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
