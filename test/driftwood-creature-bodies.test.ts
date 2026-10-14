// oxlint-disable-next-line import/no-nodejs-modules -- Reads the committed head and the bake's own output.
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { readSourceModel } from '@wildshard/sdk/bake/skinned';
import { mergeAnimalGeometry } from '../src/engine/models/animalGeometry';
import { facetGeometry } from '../src/engine/entities/lowpoly';
import { Rng } from '../src/engine/core/rng';
import { speciesWithLook } from '../src/engine/entities/species/look';
import type { AnimalSpecies } from '../src/engine/entities/species/registry';
import { BEAR_LOOK } from '../src/game/systems/species/view/bear';
import { BOAR_LOOK } from '../src/game/systems/species/view/boar';
import { ISLAND_BEAR, ISLAND_BOAR } from '../src/shards/driftwood-isle/creatures/species';
import { asIsland, buildCreatureParts, faceHeadOf, type FaceHead } from '../src/shards/driftwood-isle/generators/creatureBodies';
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

/** The faceted bake of (kind, variant) holds the same bytes, bones and size as the page's own build `sp`. */
function expectBaked(kind: string, variant: string, sp: AnimalSpecies): void {
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

it('draws every baked body exactly as the page built it', async () => {
  if (head === null) throw new Error('no head');
  await preloadCreatureBodies();
  for (const { kind, variant, sp } of buildCreatureParts(head)) expectBaked(kind, variant, sp);
  expect(() => creatureBody('crab', 'giant')).toThrow('no baked creature body');
});

/** AnimalFactory's model seed for 'kind:variant' (FNV-1a). */
const seedOf = (key: string): number => { let h = 2166136261; for (let i = 0; i < key.length; i++) { h ^= key.codePointAt(i) ?? 0; h = Math.imul(h, 16777619); } return h >>> 0; };

it('bakes the boar and bear the island factory resolved from the shared looks', async () => {
  await preloadCreatureBodies();
  // the old page path: the island's row over the shared look (the species service's default look), each variant as the
  // factory handed it to the shared builder, in low-poly mode with the island's toon paints
  for (const species of [speciesWithLook(ISLAND_BOAR, BOAR_LOOK), speciesWithLook(ISLAND_BEAR, BEAR_LOOK)]) {
    for (const v of species.variants) expectBaked(species.kind, v.id, asIsland(() => species.build(v, new Rng(seedOf(`${species.kind}:${v.id}`)))));
  }
});
