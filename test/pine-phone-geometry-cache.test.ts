import { expect, it } from 'vitest';
import { WebIO } from '@gltf-transform/core';
import { MeshStandardMaterial, SphereGeometry } from 'three';
import { compactPhoneGlb, compactClearGlb, nameCompactBlobs } from '@wildshard/sdk/bake/compactGlb';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { cachedTreeRest, cachedGroundTile, cachedCompactShapes } from '../src/shards/pine-hollow/generators/phoneGeometryCache';

function pool(radius: number): Uint8Array {
  const geometry = new SphereGeometry(radius, 16, 12), material = new MeshStandardMaterial();
  try { return staticGlb([{ geometry, material }]); }
  finally { geometry.dispose(); material.dispose(); }
}

it('retains exact each-root compaction bytes across hits and changed inputs', async () => {
  const saved = new Map<string, ReadonlyMap<string, Uint8Array>>(), ids: string[] = []; let builds = 0;
  const ctx: Pick<ProjectGenerationContext, 'cached'> = { cached: async (step, generate) => {
    expect(step.native).toBe(true); expect(step.inputs).toBeUndefined(); ids.push(step.id);
    let files = saved.get(step.id);
    if (files === undefined) { builds++; files = await generate(new Map()); saved.set(step.id, files); }
    return new Map([...files].map(([name, bytes]) => [name, bytes.slice()]));
  } };
  for (const radius of [3, 6]) {
    const input = pool(radius), expected = await compactPhoneGlb(input, { each: true });
    const first = await cachedTreeRest(ctx, input);
    expect(hashImmutableBytes(first)).toBe(hashImmutableBytes(expected)); first.fill(0);
    expect(hashImmutableBytes(await cachedTreeRest(ctx, input))).toBe(hashImmutableBytes(expected));
  }
  expect(builds).toBe(2); expect(new Set(ids).size).toBe(2);
  expect(ids.every(id => /^tree-rest-[a-f0-9]{64}$/u.test(id))).toBe(true);
});

it('owns the exact input view before an asynchronous host can mutate it', async () => {
  const input = pool(4), expected = await compactPhoneGlb(input, { each: true }), hash = hashImmutableBytes(input);
  const ctx: Pick<ProjectGenerationContext, 'cached'> = { cached: (step, generate) => {
    expect(step.id).toBe(`tree-rest-${hash}`); input.fill(0);
    return Promise.resolve(generate(new Map()));
  } };
  expect(hashImmutableBytes(await cachedTreeRest(ctx, input))).toBe(hashImmutableBytes(expected));
});

it('retains original malformed-GLB refusals and refuses incomplete cached output', async () => {
  const miss: Pick<ProjectGenerationContext, 'cached'> = { cached: (_step, generate) => Promise.resolve(generate(new Map())) };
  await expect(cachedTreeRest(miss, new Uint8Array([1, 2, 3]))).rejects.toThrow();
  const input = pool(2);
  for (const files of [new Map<string, Uint8Array>(), new Map([['geometry.glb', new Uint8Array()]]),
    new Map([['geometry.glb', input], ['extra', input]])]) {
    const ctx: Pick<ProjectGenerationContext, 'cached'> = { cached: () => Promise.resolve(files) };
    await expect(cachedTreeRest(ctx, input)).rejects.toThrow('Missing cached Pine phone geometry');
  }
});

it('binds ground selection to every entryway and retains kept-input identity', async () => {
  const input = pool(2), ids: string[] = [];
  const ctx: Pick<ProjectGenerationContext, 'cached'> = { cached: (step, generate) => {
    expect(step.native).toBe(true); ids.push(step.id); return Promise.resolve(generate(new Map()));
  } };
  for (const edge of ['north', 'east', 'south', 'west'] as const) {
    const entries = [{ edge, width: 8 }] as const;
    const expected = await compactClearGlb(input, entries), actual = await cachedGroundTile(ctx, input, entries);
    expect(hashImmutableBytes(actual)).toBe(hashImmutableBytes(expected));
    expect(actual === input).toBe(expected === input);
  }
  expect(new Set(ids).size).toBe(4);
  const already = await compactClearGlb(input, []);
  expect(await cachedGroundTile(ctx, already, [])).toBe(already);
});

it('retains normalized float accessor decoding beside the raw-storage scan', async () => {
  const input = pool(3.125), io = new WebIO(), document = await io.readBinary(input);
  const floats = document.getRoot().listMeshes().flatMap(mesh => mesh.listPrimitives())
    .flatMap(primitive => ['POSITION', 'NORMAL'].flatMap(name => {
      const accessor = primitive.getAttribute(name);
      return accessor?.getComponentType() === 5126 ? [accessor] : [];
    }));
  expect(floats.length).toBeGreaterThan(0);
  // Float normalization is an identity in the native accessor decoder. Marking
  // these equivalent channels exercises its fallback without a byte/hash pin.
  for (const accessor of floats) accessor.setNormalized(true);
  const normalized = await io.writeBinary(document);
  const ordinary = await compactPhoneGlb(input), fallback = await compactPhoneGlb(normalized);
  expect(ordinary === input).toBe(false); expect(fallback === normalized).toBe(false);
  expect(fallback).toEqual(ordinary);
});

it('retains the complete ordered compact batch and independent cache hits', async () => {
  const shared = pool(2.75), shapes: readonly (readonly [string, Uint8Array])[] = [
    ['cabins/a.glb', shared], ['cabins/b.glb', shared], ['cabins/c.glb', pool(5.5)],
  ];
  const expected = await nameCompactBlobs(shapes);
  const saved = new Map<string, ReadonlyMap<string, Uint8Array>>(); let builds = 0;
  const ctx: Pick<ProjectGenerationContext, 'cached'> = { cached: async (step, generate) => {
    expect(step.native).toBe(true); expect(step.inputs).toBeUndefined();
    expect(step.id).toMatch(/^cab-pack-[a-f0-9]{64}$/u);
    let files = saved.get(step.id);
    if (files === undefined) { builds++; files = await generate(new Map()); saved.set(step.id, files); }
    return new Map([...files].map(([name, bytes]) => [name, new Uint8Array(bytes)]));
  } };
  const first = await cachedCompactShapes(ctx, shapes);
  expect(first.map(blob => blob.file)).toEqual(expected.map(blob => blob.file));
  for (const [index, blob] of first.entries()) {
    expect(blob.bytes).toEqual(expected[index]?.bytes); blob.bytes.fill(0);
  }
  const hit = await cachedCompactShapes(ctx, shapes);
  expect(builds).toBe(1); expect(hit.map(blob => blob.file)).toEqual(expected.map(blob => blob.file));
  for (const [index, blob] of hit.entries()) expect(blob.bytes).toEqual(expected[index]?.bytes);
});

it('binds every ordered name and source byte, owning input before cache callbacks', async () => {
  const one: [string, Uint8Array] = ['cabins/one.glb', pool(3.5)], two: [string, Uint8Array] = ['cabins/two.glb', pool(7)];
  const shapes: [string, Uint8Array][] = [one, two];
  const expected = await nameCompactBlobs(shapes), ids: string[] = [];
  const cached = new Map(expected.map((blob, index) => [`${String(index)}.glb`, blob.bytes]));
  const hit: Pick<ProjectGenerationContext, 'cached'> = { cached: step => {
    ids.push(step.id); return Promise.resolve(cached);
  } };
  await cachedCompactShapes(hit, shapes);
  await cachedCompactShapes(hit, [...shapes].reverse());
  await cachedCompactShapes(hit, [['cabins/renamed.glb', one[1]], two]);
  await cachedCompactShapes(hit, [['cabins/one.glb', pool(9)], two]);
  expect(new Set(ids).size).toBe(4);
  const actual = await cachedCompactShapes({ cached: (_step, generate) => {
    for (const [, bytes] of shapes) bytes.fill(0); shapes.length = 0;
    return Promise.resolve(generate(new Map()));
  } }, shapes);
  expect(actual.map(blob => blob.file)).toEqual(expected.map(blob => blob.file));
  for (const [index, blob] of actual.entries()) expect(blob.bytes).toEqual(expected[index]?.bytes);
});

it('refuses incomplete batch caches and keeps named GLB admission on hits', async () => {
  const input = pool(8), shapes: [string, Uint8Array][] = [['cabins/only.glb', input]];
  for (const files of [new Map<string, Uint8Array>(), new Map([['wrong.glb', input]]),
    new Map([['0.glb', input], ['extra.glb', input]]), new Map([['0.glb', new Uint8Array()]]),
    new Map([['0.glb', new Uint8Array([1, 2, 3])]])]) {
    await expect(cachedCompactShapes({ cached: () => Promise.resolve(files) }, shapes)).rejects.toThrow();
  }
});
