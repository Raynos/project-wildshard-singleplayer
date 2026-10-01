import { expect, it } from 'vitest';
import { Object3D, Scene, Vector3 } from 'three';
import { Scope, type Renderer, type Sky } from '#engine';
import { SkyBackdropView } from '#engine/world/skyBackdrop';

function fixture<T extends object>(fields: Partial<T>): T {
  return new Proxy(fields, { get: (target, key) => {
    if (!(key in target)) throw new Error(`Unimplemented fixture field ${String(key)}`);
    return Reflect.get(target, key);
  } }) as T;
}

it('the engine attaches a backdrop dome once and adopts a dome attached to another root (G7)', () => {
  const scene = new Scene(), scope = new Scope('sky-backdrop-test');
  const view = new SkyBackdropView(scene, fixture<Renderer>({}), scope, fixture<Sky>({ sunDir: new Vector3(0, 1, 0) }));
  const dome = new Object3D();
  view.attachClouds(dome); view.attachClouds(dome);
  expect(view.clouds).toBe(dome); expect(scene.children).toEqual([dome]);
  const previousRoot = new Object3D(), another = new Object3D(); previousRoot.add(another);
  view.attachClouds(another);
  expect(another.parent).toBe(scene); expect(previousRoot.children).toEqual([]);
  scope.dispose();
});
