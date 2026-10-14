// oxlint-disable-next-line import/no-nodejs-modules -- Reads the committed head and the bake's own output.
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { readSourceModel } from '@wildshard/sdk/bake/skinned';
import { mergeAnimalGeometry } from '../src/engine/models/animalGeometry';
import { facetGeometry } from '../src/engine/entities/lowpoly';
import { buildCreatureParts, faceHeadOf, type FaceHead } from '../src/shards/driftwood-isle/generators/creatureBodies';
import { creatureBody, preloadCreatureBodies } from '../src/shards/driftwood-isle/species/bodies';
import bake from '../src/shards/driftwood-isle/data/creatureBodies.generated.json' with { type: 'json' };

const isMesh = (o: THREE.Object3D): o is THREE.Mesh => o instanceof THREE.Mesh;
let head: FaceHead | null = null;
beforeAll(async () => {
  const source = await readSourceModel(new Uint8Array(readFileSync('public/assets/models/driftwood-hero/faces/sailor-head.glb')));
  source.gltf.scene.updateMatrixWorld(true);
  const found: THREE.BufferGeometry[] = [];
  source.gltf.scene.traverse((o) => { if (isMesh(o)) found.push(o.geometry.clone().applyMatrix4(o.matrixWorld)); });
  const [geometry] = found;
  if (geometry === undefined) throw new Error('the sailor head has no mesh');
  head = faceHeadOf(geometry);
  const bytes = readFileSync(`public${bake.file}`);
  vi.stubGlobal('fetch', (url: string) => Promise.resolve(new Response(url === bake.file ? bytes : null, { status: url === bake.file ? 200 : 404 })));
});
afterAll(() => { vi.unstubAllGlobals(); });

/** AnimalFactory's low-poly model: merge the groups, then facet (flat normals, per-face jitter). */
const faceted = (fur: THREE.BufferGeometry[], hard: THREE.BufferGeometry[], eye: THREE.BufferGeometry[]): THREE.BufferGeometry => facetGeometry(mergeAnimalGeometry(fur, hard, eye));

it('refuses a body before the bake has loaded', () => {
  expect(() => creatureBody('crab', 'small')).toThrow('not loaded');
});

it('draws every baked body exactly as the page built it', async () => {
  if (head === null) throw new Error('no head');
  await preloadCreatureBodies();
  for (const { kind, variant, sp } of buildCreatureParts(head)) {
    const before = faceted(sp.furParts, sp.hardParts, sp.eyeParts), body = creatureBody(kind, variant);
    const after = faceted(body.furParts, body.hardParts, body.eyeParts);
    expect(body.bones, `${kind}.${variant} bones`).toEqual(sp.bones);
    expect(body.dims, `${kind}.${variant} dims`).toEqual(sp.dims);
    expect(after.groups, `${kind}.${variant} groups`).toEqual(before.groups);
    expect(Object.keys(after.attributes).sort()).toEqual(Object.keys(before.attributes).sort());
    for (const [name, attr] of Object.entries(before.attributes)) {
      const other = after.getAttribute(name);
      if (!(attr instanceof THREE.BufferAttribute) || !(other instanceof THREE.BufferAttribute)) throw new Error(`${name} is interleaved`);
      expect(other.array.constructor, `${kind}.${variant} ${name} type`).toBe(attr.array.constructor);
      expect(new Uint8Array(other.array.buffer, other.array.byteOffset, other.array.byteLength), `${kind}.${variant} ${name} bytes`).toEqual(new Uint8Array(attr.array.buffer, attr.array.byteOffset, attr.array.byteLength));
    }
  }
  expect(() => creatureBody('crab', 'giant')).toThrow('no baked creature body');
});
