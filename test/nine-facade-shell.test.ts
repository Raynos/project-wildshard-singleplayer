import { expect, test } from 'vitest';
import { BufferAttribute } from 'three';
import { nineLayoutSource } from '../src/shards/nine-dragon-stack/generators/layout';
import { Ctx } from '../src/shards/nine-dragon-stack/world/ctx';
import { LayoutBake, restoreLayout } from '../src/shards/nine-dragon-stack/world/layoutBake';

test('restores the offline facade shell with exact packed channels and bounds', async () => {
  const source = nineLayoutSource(), index = source.rows.shell;
  if (index === null) throw new Error('Nine layout has no facade shell');
  const original = source.geometries[index];
  if (original === undefined) throw new Error('Nine layout lost its shell geometry');
  const bake = new LayoutBake(source.rows, source.records, new Map(source.geometries.map((geometry, i) => [i, geometry])));
  await bake.prepare(() => Promise.resolve());
  const ctx = new Ctx();
  restoreLayout(bake, ctx);
  const restored = ctx.fd.shell;
  if (restored === null) throw new Error('Nine restored no facade shell');
  expect(restored).not.toBe(original);
  expect(Object.keys(restored.attributes)).toEqual(Object.keys(original.attributes));
  for (const [name, expected] of Object.entries(original.attributes)) {
    const actual = restored.getAttribute(name);
    if (!(expected instanceof BufferAttribute) || !(actual instanceof BufferAttribute)) throw new Error('Facade channel is interleaved');
    expect(actual.constructor).toBe(expected.constructor);
    expect(actual.itemSize).toBe(expected.itemSize);
    expect(actual.normalized).toBe(expected.normalized);
    expect(new Uint8Array(actual.array.buffer, actual.array.byteOffset, actual.array.byteLength))
      .toEqual(new Uint8Array(expected.array.buffer, expected.array.byteOffset, expected.array.byteLength));
  }
  expect(restored.index?.array).toEqual(original.index?.array);
  expect(restored.boundingBox).toEqual(original.boundingBox);
  expect(restored.boundingSphere).toEqual(original.boundingSphere);
  expect(ctx.fd.pieces.length).toBe(source.rows.pieces.length);
  expect(ctx.fd.merged.size).toBe(source.rows.merged.length);
  restored.dispose();
});
