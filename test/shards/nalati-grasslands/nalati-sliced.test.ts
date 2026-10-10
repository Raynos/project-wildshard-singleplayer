// SF67: Nalati's sliced load builders draw exactly what the one-task builders drew (same rng streams, same order).
import { expect, it } from 'vitest';
import * as THREE from 'three';
import type { SkyRig as Sky } from '../../../src/engine/world/skyRig';
import { buildOutcrops, buildOutcropsSliced } from '../../../src/shards/nalati-grasslands/outcrops';
import { buildCragRock, buildCragRockSliced } from '../../../src/shards/nalati-grasslands/cragRock';
import { setTerrainHeight, terrainHeight } from '../../../src/engine/world/terrainHeight';
import { TERRAIN } from '../../../src/shards/nalati-grasslands/world/terrain';
import { planDressing } from '../../../src/shards/nalati-grasslands/world/dressing/place';

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

it('slices the crag rock ring into tasks without changing a piece', async () => {
  // on Nalati's own ground (the default field places almost no crags): 59 fins, 357 ribs, 46 towers
  const previous = terrainHeight(0, 0);
  setTerrainHeight((x, z) => TERRAIN.heightAt(x, z));
  const eager = buildCragRock(sky);
  expect(eager.count).toEqual({ fins: 59, ribs: 357, blocks: 46 });
  let pauses = 0;
  const sliced = await buildCragRockSliced(sky, () => { pauses++; return pauses % 5 === 0 ? Promise.resolve() : null; });
  expect(pauses).toBeGreaterThan(50);
  expect(bytes(sliced.group)).toEqual(bytes(eager.group));
  expect(sliced.group.children.map((c) => c.name)).toEqual(eager.group.children.map((c) => c.name));
  expect(sliced.colliders).toEqual(eager.colliders);
  expect(sliced.descs).toEqual(eager.descs);
  expect([sliced.count, sliced.triangles]).toEqual([eager.count, eager.triangles]);
  setTerrainHeight(() => previous);
});

it('plans the dressing with its rocks pass in slices, the same plan', async () => {
  const eager = await planDressing(null);
  let yields = 0;
  const sliced = await planDressing(null, () => { yields++; return Promise.resolve(); });
  expect(yields).toBe(15); // the camp, ten rocks slices and after them, scree, gravel bars, shrubs, flowers
  expect(JSON.stringify(sliced)).toBe(JSON.stringify(eager));
}, 60_000);
