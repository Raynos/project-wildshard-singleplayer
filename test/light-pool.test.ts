import { expect, test } from 'vitest';
import * as THREE from 'three';
import { LightPool } from '../src/engine/fx/LightPool';

/** the scene's render-start hook, as WebGLRenderer.render calls it (the pool reads none of its arguments) */
const render = (scene: THREE.Scene): void => { const hook: unknown = Reflect.get(scene, 'onBeforeRender'); if (typeof hook === 'function') Reflect.apply(hook, scene, []); };

test('an owned light keeps the count but lights nothing while its owner is hidden or gone', () => {
  const scene = new THREE.Scene(), region = new THREE.Group(), owner = new THREE.Group();
  region.add(owner); scene.add(region);
  const pool = LightPool.for(scene), light = pool.acquire(0xffffff, 4, 7, 2, owner);
  expect(light.parent).toBe(pool.group);
  render(scene); expect(light.intensity).toBe(4);
  region.visible = false; render(scene); expect(light.intensity).toBe(0);
  region.visible = true; light.intensity = 3; owner.removeFromParent(); render(scene); expect(light.intensity).toBe(0);
  pool.release(light); expect(pool.size).toBe(1); expect(pool.free).toBe(1);
  // sealed by the first render: the freed light is lent again, the count never grows
  const again = pool.acquire(0xff0000, 2, 5, 2, owner);
  expect(again).toBe(light); expect(pool.size).toBe(1);
});
