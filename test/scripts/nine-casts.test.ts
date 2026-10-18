// oxlint-disable-next-line import/no-nodejs-modules -- Node-only golden proof hashes exact typed-array storage.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- The offline proof reads retained GLBs and published layout inputs.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, test } from 'vitest';
import { BufferAttribute, type BufferGeometry } from 'three';
import { createModelLibrary } from '../../src/game/plugin/geometry';
import { readSourceModel } from '../../src/sdk/bake/skinned';
import { CASTS, FIXED_KITS, CAST_CHANNELS, type PreparedGeometry } from '../../src/shards/nine-dragon-stack/data/casts';
import { layoutBlobs } from '../../src/shards/nine-dragon-stack/generators/layoutBlobs';
import { bakeCasts, bakeFixedKits } from '../../src/shards/nine-dragon-stack/generators/casts';
import { layoutReviver, restoreLayoutZeros } from '../../src/shards/nine-dragon-stack/world/layoutBake';
import { LayoutRowsSchema, GeometryBootSchema } from '../../src/shards/nine-dragon-stack/generators/sections';
import * as v from 'valibot';
import baseline from '../fixtures/nine-casts.json' with { type: 'json' };

let packs: Map<PreparedGeometry, Uint8Array>;
let fixed: ReturnType<typeof bakeFixedKits>;
beforeAll(async () => {
  const layout: unknown = JSON.parse(readFileSync('src/shards/nine-dragon-stack/data/layout.generated.json', 'utf8'), layoutReviver);
  const row = v.parse(v.object({ rows: LayoutRowsSchema }), layout);
  fixed = bakeFixedKits(row.rows.slots);
  packs = await bakeCasts(url => new Uint8Array(readFileSync(`public${url}`)));
  for (const [key, bytes] of fixed.packs) packs.set(key, bytes);
}, 30_000);

function channels(geometry: BufferGeometry): unknown {
  const hash = (array: BufferAttribute['array']): string => createHash('sha256')
    .update(new Uint8Array(array.buffer, array.byteOffset, array.byteLength)).digest('hex');
  return {
    attributes: Object.fromEntries(Object.entries(geometry.attributes).map(([name, attribute]) => {
      if (!(attribute instanceof BufferAttribute)) throw new Error('Unexpected interleaved cast channel');
      return [name, { type: attribute.array.constructor.name, size: attribute.itemSize, normalized: attribute.normalized,
        count: attribute.count, hash: hash(attribute.array) }];
    })),
    index: geometry.index === null ? null : { type: geometry.index.array.constructor.name, count: geometry.index.count, hash: hash(geometry.index.array) },
    box: geometry.boundingBox === null ? null : { min: geometry.boundingBox.min.toArray(), max: geometry.boundingBox.max.toArray() },
    sphere: geometry.boundingSphere === null ? null : { center: geometry.boundingSphere.center.toArray(), radius: geometry.boundingSphere.radius },
  };
}

// Captured from the parent runtime prop loader, including signed zero, every packed channel and both bounds.
test.each([...CASTS, ...FIXED_KITS])('%s preserves the original geometry through the existing rest-pool host', async name => {
  const bytes = packs.get(name);
  if (bytes === undefined) throw new Error(`Missing cast ${name}`);
  const library = createModelLibrary<never, never>({ meshes: [], meshUrls: {}, hd: [], hdUrls: {}, hdLooks: {}, aoFloor: 1,
    geometryPools: [{ url: name, parts: [name], channels: CAST_CHANNELS }],
  }, 'test Nine casts', {}, async () => (await readSourceModel(bytes)).gltf);
  await library.preload();
  const geometry = library.geometry(name, { borrow: true });
  if (geometry === null) throw new Error(`Host lost cast ${name}`);
  expect(channels(geometry)).toEqual(baseline[name]);
  // Borrowing hands the original decoded buffers to the world, without another resident copy.
  expect(library.geometry(name, { borrow: true })).toBe(geometry);
  geometry.dispose();
});

test('fixed sign words, RNG order and all eight cap lantern matrices preserve the parent rows', () => {
  const hash = (value: unknown): string => createHash('sha256').update(JSON.stringify(value,
    (_key, entry: unknown) => typeof entry === 'number' && Object.is(entry, -0) ? '-0' : entry)).digest('hex');
  expect({ signs: fixed.signs.length, signHash: hash(fixed.signs), lanterns: fixed.lanterns.length, lanternHash: hash(fixed.lanterns) }).toEqual(baseline.fixed);
});


test('layout blobs retain every float64 bit and signed author zero', () => {
  const raw: unknown = JSON.parse(readFileSync('src/shards/nine-dragon-stack/data/layout.generated.json', 'utf8'), layoutReviver);
  const original = v.parse(v.object({ rows: LayoutRowsSchema, count: v.number(), records: v.array(v.number()) }), raw);
  const blobs = layoutBlobs(), rows = blobs.find(row => row.file.name === 'geometry/layout.json');
  const binary = blobs.find(row => row.file.name === 'geometry/layout-f64.bin');
  if (rows === undefined || binary === undefined) throw new Error('Missing layout boot blobs');
  const decoded: unknown = JSON.parse(new TextDecoder().decode(rows.bytes));
  expect(restoreLayoutZeros(v.parse(GeometryBootSchema, decoded))).toEqual(original.rows);
  const floats = new Float64Array(Uint8Array.from(binary.bytes).buffer);
  expect(floats.length).toBe(original.count);
  expect(floats.every((value, i) => Object.is(value, original.records[i]))).toBe(true);
  expect(rows.file.jsonSchema).toBeDefined();
});
