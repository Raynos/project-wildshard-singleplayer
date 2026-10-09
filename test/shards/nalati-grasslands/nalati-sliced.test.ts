// SF67: Nalati's sliced load builders draw exactly what the one-task builders drew (same rng streams, same order).
import { expect, it } from 'vitest';
import * as THREE from 'three';
import type { SkyRig as Sky } from '../../../src/engine/world/skyRig';
import { buildOutcrops, buildOutcropsSliced } from '../../../src/shards/nalati-grasslands/outcrops';

const lights: THREE.DirectionalLight[] = [];
const sky = { setupMaterial(_m: THREE.Material): void { /* nothing to prepare */ }, csm: { lights, lightDirection: new THREE.Vector3(0, -1, 0) }, sunDir: new THREE.Vector3(0, 1, 0) } as Sky;

function bytes(object: THREE.Object3D): number[][] {
  const out: number[][] = [];
  object.traverse((child) => {
    const geometry: unknown = child instanceof THREE.Mesh ? child.geometry : null;
    if (!(geometry instanceof THREE.BufferGeometry)) return;
    for (const name of ['position', 'normal', 'color', 'uv']) {
      const attribute: unknown = geometry.getAttribute(name);
      if (attribute instanceof THREE.BufferAttribute) out.push(Array.from(attribute.array));
    }
  });
  return out;
}

it('slices the outcrops into tasks without changing a rock', async () => {
  const eager = buildOutcrops(sky);
  let pauses = 0;
  const sliced = await buildOutcropsSliced(sky, () => { pauses++; return pauses % 7 === 0 ? Promise.resolve() : null; });
  expect(pauses).toBeGreaterThan(10);
  expect(bytes(sliced.mesh)).toEqual(bytes(eager.mesh));
  expect(sliced.colliders).toEqual(eager.colliders);
  expect(sliced.descs).toEqual(eager.descs);
  expect([sliced.count, sliced.triangles]).toEqual([eager.count, eager.triangles]);
});
