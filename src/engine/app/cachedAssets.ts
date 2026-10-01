import { Object3D } from 'three';
import { app } from './runtime';
import { containerResources, sceneResources } from './sceneOwnership';

/** A module cache keeps source meshes alive across loads; consumers acquire their shared GPU resources. */
export function retainCachedResources<T>(value: T): T {
  const resources = value instanceof Object3D ? sceneResources(value) : containerResources(value);
  for (const resource of resources) {
    const key = `scene:${String(Reflect.get(resource, 'uuid'))}`;
    if (!app.assets.has(key)) app.assets.register(key, resource, { retain: true });
  }
  return value;
}
