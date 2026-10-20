// oxlint-disable-next-line import/no-nodejs-modules -- Compare packed bytes natively without per-element assertion diagnostics.
import { Buffer } from 'node:buffer';
import { expect, test } from 'vitest';
import { BufferAttribute, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { nineLayoutSource, runLayout, SignRecorder } from '../src/shards/nine-dragon-stack/generators/layout';
import { layoutProjection } from '../src/shards/nine-dragon-stack/generators/layoutProjection';
import { LayoutBake, restoreLayout } from '../src/shards/nine-dragon-stack/world/layoutBake';

function exactGeometry(actual: BufferGeometry, expected: BufferGeometry): void {
  expect(Object.keys(actual.attributes)).toEqual(Object.keys(expected.attributes));
  for (const [name, channel] of Object.entries(expected.attributes)) {
    const copy = actual.getAttribute(name);
    if (!(channel instanceof BufferAttribute) || !(copy instanceof BufferAttribute)) throw new Error('Kit channel is interleaved');
    expect(copy.constructor).toBe(channel.constructor);
    expect(copy.itemSize).toBe(channel.itemSize);
    expect(copy.normalized).toBe(channel.normalized);
    expect(Buffer.compare(new Uint8Array(copy.array.buffer, copy.array.byteOffset, copy.array.byteLength),
      new Uint8Array(channel.array.buffer, channel.array.byteOffset, channel.array.byteLength))).toBe(0);
  }
  expect(actual.index?.array).toEqual(expected.index?.array);
  expect(actual.boundingBox).toEqual(expected.boundingBox);
  expect(actual.boundingSphere).toEqual(expected.boundingSphere);
}

test('bakes every native solid/swept draw in order with exact channels, bounds and model ownership', async () => {
  const author = runLayout(new SignRecorder()), expected = new Map<string, BufferGeometry>();
  // The predecessor converted the solid names first, merging same-name swept
  // parts, then emitted swept-only names. No changed generator supplies this oracle.
  for (const [name, kit] of author.kits) {
    const swept = author.kitxs.get(name);
    const base = kit.vertexCount > 0 ? kit.build() : null;
    const extra = swept !== undefined && swept.vertexCount > 0 ? swept.build() : null;
    if (base !== null && extra !== null) {
      const geometry = mergeGeometries([base, extra], false);
      geometry.computeBoundingSphere(); expected.set(name, geometry);
    } else if (base !== null) expected.set(name, base);
    else if (extra !== null) expected.set(name, extra);
  }
  for (const [name, kit] of author.kitxs) if (!author.kits.has(name) && kit.vertexCount > 0) expected.set(name, kit.build());
  const source = nineLayoutSource();
  expect(source.rows.kitxs).toEqual([]);
  const bake = new LayoutBake(layoutProjection(source.rows, source.records), new Map(source.geometries.map((geometry, i) => [i, geometry])));
  await bake.prepare(() => Promise.resolve());
  const restored = restoreLayout(bake);
  const actual = new Map([...restored.kits].flatMap(([name, geometry]) => geometry === null ? [] : [[name, geometry] as const]));
  expect([...actual.keys()]).toEqual([...expected.keys()]);
  for (const [name, geometry] of expected) {
    const copy = actual.get(name); if (copy === undefined) throw new Error(`Missing native kit ${name}`);
    exactGeometry(copy, geometry);
  }
  for (const [name, kit] of author.alphaKits) if (kit.vertexCount > 0) {
    const copy = restored.alphaKits.get(name); if (copy === undefined) throw new Error(`Missing alpha kit ${name}`);
    exactGeometry(copy, kit.build());
  }
  expect(restored.inKit.map(({ model, kit, at, box }) => ({ model, kit, at, box: box === undefined ? null : [...box.min, ...box.max] })))
    .toEqual(source.rows.inKit);
  expect(restored.hooks.map(point => point.toArray())).toEqual(author.hooks.map(point => point.toArray()));
  for (const geometry of [...actual.values(), ...expected.values(), ...restored.alphaKits.values()]) geometry.dispose();
}, 30_000);

test('restores the offline facade shell with exact packed channels and bounds', async () => {
  const source = nineLayoutSource(), index = source.rows.shell;
  if (index === null) throw new Error('Nine layout has no facade shell');
  const original = source.geometries[index];
  if (original === undefined) throw new Error('Nine layout lost its shell geometry');
  const bake = new LayoutBake(layoutProjection(source.rows, source.records), new Map(source.geometries.map((geometry, i) => [i, geometry])));
  await bake.prepare(() => Promise.resolve());
  const ctx = restoreLayout(bake);
  const restored = ctx.shell;
  if (restored === null) throw new Error('Nine restored no facade shell');
  expect(restored === original).toBe(false);
  expect(Object.keys(restored.attributes)).toEqual(Object.keys(original.attributes));
  for (const [name, expected] of Object.entries(original.attributes)) {
    const actual = restored.getAttribute(name);
    if (!(expected instanceof BufferAttribute) || !(actual instanceof BufferAttribute)) throw new Error('Facade channel is interleaved');
    expect(actual.constructor).toBe(expected.constructor);
    expect(actual.itemSize).toBe(expected.itemSize);
    expect(actual.normalized).toBe(expected.normalized);
    expect(Buffer.compare(
      new Uint8Array(actual.array.buffer, actual.array.byteOffset, actual.array.byteLength),
      new Uint8Array(expected.array.buffer, expected.array.byteOffset, expected.array.byteLength),
    )).toBe(0);
  }
  expect(restored.index === null).toBe(original.index === null);
  if (restored.index !== null && original.index !== null) {
    const actual = restored.index.array, expected = original.index.array;
    expect(actual.constructor).toBe(expected.constructor);
    expect(Buffer.compare(
      new Uint8Array(actual.buffer, actual.byteOffset, actual.byteLength),
      new Uint8Array(expected.buffer, expected.byteOffset, expected.byteLength),
    )).toBe(0);
  }
  expect(restored.boundingBox).toEqual(original.boundingBox);
  expect(restored.boundingSphere).toEqual(original.boundingSphere);
  restored.dispose();
});
