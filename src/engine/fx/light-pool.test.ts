import { expect, test } from 'vitest';
import * as THREE from 'three';
import { LightPool } from './LightPool';
import { Scope } from '../app/scope';

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

// a grid region's own scene pool shows through the page's reserved lights: the page's light count never moves as the
// region shows, hides or leaves (Pine Hollow's cabin lights rebuilt every lit program 1 → 6 point lights)
test('a nested pool shows through the page pool reserved lights and leaves three light count', () => {
  const page = new THREE.Scene(), root = new THREE.Group(), region = new THREE.Scene(), scope = new Scope('mirror');
  root.add(region); page.add(root);
  const pagePool = LightPool.for(page), regionPool = LightPool.for(region);
  pagePool.reserve(2);
  const counted = (): number => { let n = 0; page.traverse((o) => { if (o instanceof THREE.PointLight && o.layers.mask !== 0) n++; }); return n; };
  regionPool.mirrorInto(pagePool, scope);
  const near = regionPool.acquire(0xff8800, 3, 11, 2), off = regionPool.acquire(0xffffff, 0, 8, 2), late = regionPool.acquire(0x00ff00, 5, 4, 1);
  near.position.set(1, 2, 3); root.position.set(100, 0, 0); page.updateMatrixWorld(true);
  expect(counted()).toBe(2);
  render(page);
  const [a, b] = pagePool.group.children.filter((o): o is THREE.PointLight => o instanceof THREE.PointLight);
  expect(a?.intensity).toBe(3); expect(a?.distance).toBe(11); expect(a?.color.getHex()).toBe(0xff8800);
  expect(a?.getWorldPosition(new THREE.Vector3()).toArray()).toEqual([101, 2, 3]);
  expect(b?.intensity).toBe(5); expect(b?.decay).toBe(1);
  expect(off.layers.mask).toBe(0);
  root.visible = false; render(page);
  expect(a?.intensity).toBe(0); expect(b?.intensity).toBe(0); expect(counted()).toBe(2);
  root.visible = true; scope.dispose(); render(page);
  expect(a?.intensity).toBe(0); expect(late.layers.mask).toBe(1);
});
