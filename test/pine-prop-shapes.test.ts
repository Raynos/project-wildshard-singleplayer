import { expect, test, vi } from 'vitest';
import * as THREE from 'three';
import * as v from 'valibot';
import { Rng } from '../src/engine/core/rng';
import { modelContext } from '../src/engine/models/model';
import authored from '../src/shards/pine-hollow/data/timberWorld.generated.json' with { type: 'json' };
import { output } from '../src/shards/pine-hollow/generators/output';
import { loadMossyBoulder, mossyBoulder, PropShapesSchema } from '../src/shards/pine-hollow/runtime/models/mossyBoulder';
import { loadTreeStump, treeStump } from '../src/shards/pine-hollow/runtime/models/treeStump';
import { loadFallenLog, fallenLog } from '../src/shards/pine-hollow/runtime/models/fallenLog';
import * as homestead from '../src/shards/pine-hollow/runtime/world/homestead';
import * as timberSites from '../src/shards/pine-hollow/runtime/world/timberSites';
import * as runtimeProduct from '../src/game/shardfile/runtimeProduct';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { emptyShardfile } from '../src/sdk/author';

const material = new THREE.MeshStandardMaterial();
const geometries = new Map([...authored.propShapes.rocks, ...authored.propShapes.stumps, ...authored.propShapes.log.parts]
  .map((row, i) => [row.name, { geometry: new THREE.BoxGeometry(i + 1, 2, 3), matrix: new THREE.Matrix4() }]));
test('prop readers preserve geometry, bounds, material preparation, hulls and capsule with one metadata read', async () => {
  const file = output.namedFiles.find(row => row.name === 'world/prop-shapes.json');
  const bytes = file === undefined ? undefined : output.assets.get(file.hash);
  if (file === undefined || bytes === undefined) throw new Error('Missing named prop shape rows');
  const shardfile = emptyShardfile({ slug: 'pine-props-test', name: 'Props', author: 'Wildshard', revision: 1, seed: 1 });
  const product = createShardProduct({ slug: shardfile.identity.slug, revision: 1, shardfile, sections: new Map(),
    files: new Map([['world/prop-shapes.json', { hash: file.hash, url: file.path }]]), read: () => Promise.resolve(bytes) });
  const fileRead = vi.spyOn(product, 'file');
  const productSpy = vi.spyOn(runtimeProduct, 'loadFirstPartyProduct').mockResolvedValue(product);
  const viewsSpy = vi.spyOn(timberSites, 'loadSiteTimbers').mockResolvedValue(geometries);
  const nodesSpy = vi.spyOn(homestead, 'loadLodNodes').mockResolvedValue(new THREE.Group());
  const finishSpy = vi.spyOn(homestead, 'prepModel').mockImplementation(() => [{ geometry: new THREE.BoxGeometry(), material, matrix: new THREE.Matrix4() }]);
  try {
  const ctx = modelContext(null);
  // The mocked material finisher never reads the sky; this keeps the test renderer-free.
  Object.defineProperty(ctx, 'sky', { value: {} });
  expect(() => mossyBoulder.build(ctx, { shape: 0, solid: true }, new Rng(1337))).toThrow('before building');
  await Promise.all([loadMossyBoulder(ctx), loadTreeStump(ctx), loadFallenLog(ctx)]);
  expect(fileRead).toHaveBeenCalledTimes(1);
  expect(finishSpy).toHaveBeenCalledTimes(8);
  for (const [shape, row] of authored.propShapes.rocks.entries()) {
    const parts = mossyBoulder.build(ctx, { shape, solid: true }, new Rng(1337));
    if (parts instanceof THREE.Object3D) throw new Error('Expected original model parts');
    const part = parts[0];
    expect(part?.material).toBe(material);
    expect(part?.geometry.getAttribute('position').array).toEqual(geometries.get(row.name)?.geometry.getAttribute('position').array);
    expect(part?.geometry.boundingSphere?.center.toArray()).toEqual(row.sphere.slice(0, 3));
    expect(part?.geometry.boundingSphere?.radius).toBe(row.sphere[3]);
    expect(mossyBoulder.colliders?.({ shape, solid: true }, ctx)).toEqual([{ kind: 'hull', x: 0, y: 0, z: 0, points: new Float32Array(row.hull) }]);
    expect(mossyBoulder.colliders?.({ shape, solid: false }, ctx)).toEqual([]);
  }
  expect(treeStump.colliders?.({}, ctx)).toEqual(authored.propShapes.stumps.map(row => ({ kind: 'hull', x: 0, y: 0, z: 0, points: new Float32Array(row.hull) })));
  expect(fallenLog.colliders?.({}, ctx)).toEqual([authored.propShapes.log.capsule]);
  await loadMossyBoulder(ctx);
  expect(finishSpy).toHaveBeenCalledTimes(8);
  expect(v.parse(PropShapesSchema, authored.propShapes)).toEqual(authored.propShapes);
  expect(() => v.parse(PropShapesSchema, { ...authored.propShapes, rocks: [] })).toThrow();
  expect(() => v.parse(PropShapesSchema, { ...authored.propShapes, extra: true })).toThrow();
  } finally { fileRead.mockRestore(); productSpy.mockRestore(); viewsSpy.mockRestore(); nodesSpy.mockRestore(); finishSpy.mockRestore(); material.dispose(); }
});
