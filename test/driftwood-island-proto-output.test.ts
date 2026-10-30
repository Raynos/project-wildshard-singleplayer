// oxlint-disable-next-line import/no-nodejs-modules -- Own isolated native inputs and cache.
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep native model and cache fixtures inside repository scratch.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { createProjectGeneration, type ProjectGenerationContext } from '../src/sdk/projectGeneration';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import type { EmittedBlobs } from '../src/sdk/blobs';
import { ISLAND_PROTO_INPUTS, driftwoodIslandProtoOutput, driftwoodIslandProtoSource } from '../src/shards/driftwood-isle/generators/islandProtoProgram';

/** The one prototype GLB the output publishes, named by its own bytes; its hash. */
function check(output: EmittedBlobs): string {
  expect(output.assets.size).toBe(1);
  const [entry] = [...output.assets], [hash, bytes] = entry ?? [];
  if (hash === undefined || bytes === undefined) throw new Error('Missing owned prototype bytes');
  expect(hashImmutableBytes(bytes)).toBe(hash);
  expect(output.files).toEqual([expect.objectContaining({ name: 'world/island/protos.glb', path: `blobs/glb/${hash}.glb`, kind: 'glb', hash, critical: false, dependencies: [] })]);
  expect(output.files[0]?.triangles).toBeGreaterThan(0); expect(output.files[0]?.draws).toBeGreaterThan(0);
  return hash;
}

test('native prototype construction and persistent hits return the cold bytes without a src handoff', async () => {
  const root = mkdtempSync(resolve('tmp/driftwood-proto-output-')), source = resolve(root, 'native');
  const prefix = '/assets/models/driftwood-blender/';
  let builds = 0;
  const context = (program = 'a'): Pick<ProjectGenerationContext, 'cached'> => {
    const ctx = createProjectGeneration(resolve('src/shards/driftwood-isle'), program.repeat(64), new Map(), resolve(root, 'cache'), [{ prefix, directory: source }]);
    return { cached: (step, make) => {
      expect(step).toEqual({ id: 'island-prototypes', native: true, inputs: ISLAND_PROTO_INPUTS });
      return ctx.cached(step, inputs => { builds++; return make(inputs); });
    } };
  };
  try {
    mkdirSync(source);
    for (const name of ISLAND_PROTO_INPUTS) writeFileSync(resolve(source, name.slice(prefix.length)), readFileSync(`public${name}`));
    const cold = await driftwoodIslandProtoOutput(context()), want = check(cold);
    for (const bytes of cold.assets.values()) bytes.fill(0);
    expect(check(await driftwoodIslandProtoOutput(context()))).toBe(want); expect(builds).toBe(1);
    const metadata = resolve(source, 'island.json');
    writeFileSync(metadata, ` ${readFileSync(metadata, 'utf8')}`);
    expect(check(await driftwoodIslandProtoOutput(context()))).toBe(want); expect(builds).toBe(2);
    expect(check(await driftwoodIslandProtoOutput(context('b')))).toBe(want); expect(builds).toBe(3);
    expect(readdirSync(source).sort()).toEqual(['island.glb', 'island.json']);
    for (const name of ISLAND_PROTO_INPUTS) {
      const path = resolve(source, name.slice(prefix.length)), original = readFileSync(path);
      rmSync(path);
      await expect(driftwoodIslandProtoOutput(context())).rejects.toThrow('ENOENT');
      writeFileSync(path, original);
    }
    await expect(driftwoodIslandProtoOutput(createProjectGeneration(resolve('src/shards/driftwood-isle'), 'c'.repeat(64), new Map(), root)))
      .rejects.toThrow('Generation input needs exactly one declared root');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('missing or extra native inputs and missing/empty/extra cached output refuse', async () => {
  const native = new Map(ISLAND_PROTO_INPUTS.map(name => [name, new Uint8Array([1])]));
  for (const name of ISLAND_PROTO_INPUTS) {
    const missing = new Map(native), empty = new Map(native); missing.delete(name); empty.set(name, new Uint8Array());
    for (const files of [missing, empty]) await expect(driftwoodIslandProtoSource(files)).rejects.toThrow('input inventory differs');
  }
  await expect(driftwoodIslandProtoSource(new Map([...native, ['foreign', new Uint8Array([1])]]))).rejects.toThrow('input inventory differs');
  for (const files of [new Map<string, Uint8Array>(), new Map([['world/island/protos.glb', new Uint8Array()]]),
    new Map([['world/island/protos.glb', new Uint8Array([1])], ['foreign', new Uint8Array([1])]])]) {
    await expect(driftwoodIslandProtoOutput({ cached: () => Promise.resolve(files) })).rejects.toThrow('cache inventory differs');
  }
});

test('prototype source bundles without generated handoffs or filesystem/compiler services', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/driftwood-isle/generators/islandProtoProgram.ts'), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u, 'assemblyscript/dist/asc.js'], output: { codeSplitting: false } } } });
  const built = Array.isArray(result) ? result[0] : result;
  if (built === undefined || !('output' in built)) throw new Error('Missing prototype source bundle');
  const chunks = built.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) {
    assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports]);
    expect(Object.keys(chunk.modules).some(path => path.includes('.generated.'))).toBe(false);
  }
});
