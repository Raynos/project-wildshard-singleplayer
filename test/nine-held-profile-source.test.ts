// oxlint-disable-next-line import/no-nodejs-modules -- Read the original rig and own only this isolated immutable cache fixture.
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Bind only explicit author/public roots and bundle the real source helper.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { nineHeldMeshes, nineHeldProfile } from '../src/shards/nine-dragon-stack/generators/heldProfile';
import { parseHeldMeshes, parseHeldRigSource } from '../src/shards/nine-dragon-stack/generators/sections';
import before from './fixtures/nine-held-profile.json' with { type: 'json' };

const original = new Uint8Array(readFileSync('public/assets/nine-dragon/viewmodel/fp-rig.glb'));

test('cold and hit source profiles retain every original GLB mesh/channel/transform and black texel byte', async () => {
  mkdirSync('tmp', { recursive: true }); const cache = mkdtempSync(resolve('tmp', 'nine-held-profile-'));
  try {
    const context = () => createProjectGeneration(resolve('src/shards/nine-dragon-stack'), 'e'.repeat(64), new Map(), cache,
      [{ prefix: '/assets/', directory: resolve('public/assets') }]);
    const cold = await nineHeldProfile(context()), hit = context();
    const warm = await nineHeldProfile({ cached: step => hit.cached(step, () => { throw new Error('A hit must not regenerate'); }) });
    expect(original.byteLength).toBe(before.rig.bytes); expect(hashImmutableBytes(original)).toBe(before.rig.hash);
    for (const result of [cold, warm]) {
      expect(result.meshes).toEqual(before.meshes);
      expect(result.standIn.byteLength).toBe(before.standIn.bytes); expect(hashImmutableBytes(result.standIn)).toBe(before.standIn.hash);
    }
    expect(warm.standIn).not.toBe(cold.standIn); expect(warm.meshes).not.toBe(cold.meshes);
  } finally { rmSync(cache, { recursive: true, force: true }); }
});

test('GLB metadata observes nonzero views and refuses truncated/wrong headers and invalid rig rows', () => {
  const backing = new Uint8Array(original.length + 32); backing.set(original, 16);
  expect(nineHeldMeshes(backing.subarray(16, 16 + original.length))).toEqual(before.meshes);
  for (const length of [0, 19, original.length - 1]) expect(() => nineHeldMeshes(original.subarray(0, length))).toThrow('Invalid held rig GLB');
  for (const at of [0, 4, 8, 16]) {
    const bytes = original.slice(); bytes[at] = (bytes[at] ?? 0) ^ 1;
    expect(() => nineHeldMeshes(bytes)).toThrow('Invalid held rig GLB');
  }
  expect(() => parseHeldMeshes([])).toThrow(); expect(() => parseHeldMeshes(Array.from({ length: 65 }, () => before.meshes[0]))).toThrow();
  expect(() => parseHeldMeshes([{ ...before.meshes[0], width: Infinity }])).toThrow();
  expect(() => parseHeldMeshes([{ ...before.meshes[0], rotation: [1, 0] }])).toThrow();
  expect(() => parseHeldRigSource({ nodes: [{ mesh: -1 }], meshes: [] })).toThrow();
});

test('missing source or cached profile stays a named refusal', async () => {
  await expect(nineHeldProfile({ cached: (_step, generate) => Promise.resolve().then(() => generate(new Map())) })).rejects.toThrow('Missing Nine held rig source');
  await expect(nineHeldProfile({ cached: () => Promise.resolve(new Map()) })).rejects.toThrow('Missing Nine held profile metadata');
});

test('the real held profile helper bundles without file/image/compiler services', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/nine-dragon-stack/generators/heldProfile.ts'), formats: ['es'] }, rolldownOptions: { external: [/^node:/u] } } });
  const built = Array.isArray(result) ? result[0] : result;
  if (built === undefined || !('output' in built)) throw new Error('Missing held profile bundle');
  const chunks = built.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports]);
});
