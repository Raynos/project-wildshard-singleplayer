import { expect, it } from 'vitest';
import { WebIO } from '@gltf-transform/core';
import { MeshStandardMaterial, SphereGeometry } from 'three';
import { compactPhoneGlb, compactClearGlb } from '@wildshard/sdk/bake/compactGlb';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { cachedTreeRest, cachedGroundTile } from '../src/shards/pine-hollow/generators/phoneGeometryCache';

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
