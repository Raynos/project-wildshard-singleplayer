// oxlint-disable-next-line import/no-nodejs-modules -- Compare the admitted geometry with exact-parent runtime hashes.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- The test reads the shipped compressed crag bake.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the same deflate envelope the browser reads.
import { inflateSync } from 'node:zlib';
import * as v from 'valibot';
import { SceneBakedGeometrySchema } from '@wildshard/format/sceneDressing';
import { expect, it } from 'vitest';
import { MeshBasicMaterial } from 'three';
import { readBakedGeometry } from '@wildshard/sdk/kit/bakedGeometry';
import { createClientScene } from '@wildshard/game/plugin/ui';
import { unshuffleLanes as unshuffleBodyLanes } from '../src/engine/core/deflate';
import rows from '../src/shards/nalati-grasslands/boot/cragRock.generated.json';
import oracle from './fixtures/nalati-crag-bake.json';

const hash = (bytes: string | Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

for (const tier of ['phone', 'desktop'] as const) it(`preserves ${tier} crag channels, bounds, hierarchy and ordered hulls`, () => {
  const bytes = unshuffleBodyLanes(new Uint8Array(inflateSync(readFileSync('public/assets/nalati/baked/crags.bin'))));
  const data = rows[tier], expected = oracle[tier];
  const geometry = new Map(data.meshes.map(part => {
    const packed = readBakedGeometry(bytes, part.offset, v.parse(SceneBakedGeometrySchema, part.row));
    if (!part.row.expand) return [part.key, packed] as const;
    const expanded = packed.toNonIndexed(); packed.dispose(); expanded.computeBoundingBox(); expanded.computeBoundingSphere();
    return [part.key, expanded] as const;
  }));
  const mat = new MeshBasicMaterial();
  const made = createClientScene(data.recipe, { geometry: key => geometry.get(key), materials: new Map([['crag', mat]]) });
  expect(made.root.name).toBe('nalati-crag-rock');
  expect(made.root.children.map(child => ({ name: child.name, castShadow: child.castShadow, receiveShadow: child.receiveShadow })))
    .toEqual(expected.meshes.map(mesh => ({ name: mesh.name, castShadow: true, receiveShadow: true })));
  for (const [i, part] of data.meshes.entries()) {
    const g = geometry.get(part.key);
    if (g === undefined) throw new Error('Missing decoded crag quadrant');
    expect({ attributes: Object.entries(g.attributes).map(([name, a]) => ({ name, itemSize: a.itemSize, count: a.count,
      hash: hash(new Uint8Array(a.array.buffer, a.array.byteOffset, a.array.byteLength)) })),
    index: g.index === null ? null : Array.from(g.index.array),
    box: g.boundingBox === null ? null : { min: g.boundingBox.min.toArray(), max: g.boundingBox.max.toArray() },
    sphere: g.boundingSphere === null ? null : { center: g.boundingSphere.center.toArray(), radius: g.boundingSphere.radius } }).toEqual(expected.meshes[i]?.geometry);
    g.dispose();
  }
  expect(data.count).toEqual(expected.count);
  expect(data.triangles).toBe(expected.triangles);
  expect(data.colliders).toEqual(expected.colliders);
  expect(hash(JSON.stringify(data.hulls))).toBe(expected.hulls);
  expect(data.placements).toHaveLength(data.hulls.length);
  expect(data.boxes).toHaveLength(data.placements.length * 6);
  mat.dispose();
});
