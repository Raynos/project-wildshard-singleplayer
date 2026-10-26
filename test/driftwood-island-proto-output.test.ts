// oxlint-disable-next-line import/no-nodejs-modules -- Own isolated native inputs/cache and check the complete original prototype pin.
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep native model and cache fixtures inside repository scratch.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { createProjectGeneration, type ProjectGenerationContext } from '../src/sdk/projectGeneration';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import type { EmittedBlobs } from '../src/sdk/blobs';
import { discoverGeneration } from '../scripts/generate.mjs';
import { ISLAND_PROTO_INPUTS, driftwoodIslandProtoOutput, driftwoodIslandProtoSource } from '../src/shards/driftwood-isle/generators/islandProtoProgram';

// L18.3d: the compact prototype storage (exact 8-bit colour + AO, Int8 normals, 16-bit indices); was d206d254 at 5,302,068 B
const hash = '5b1d20445a2c039fb45d983720d51a0728a8918a7518d8b9f7c10460c6d61311';
function check(output: EmittedBlobs): void {
  expect(output.files).toEqual([{ name: 'world/island/protos.glb', path: `blobs/glb/${hash}.glb`, kind: 'glb', hash,
    compressed: 2_568_340, decoded: 2_568_312, gpu: 2_498_454, triangles: 39_658, draws: 144, critical: false, dependencies: [] }]);
  expect(output.assets.size).toBe(1);
  const bytes = output.assets.get(hash);
  if (bytes === undefined) throw new Error('Missing owned prototype bytes');
  expect(hashImmutableBytes(bytes)).toBe(hash);
}

test('native prototype construction and persistent hits preserve all current bytes/costs without a src handoff', async () => {
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
    const cold = await driftwoodIslandProtoOutput(context()); check(cold);
    for (const bytes of cold.assets.values()) bytes.fill(0);
    check(await driftwoodIslandProtoOutput(context())); expect(builds).toBe(1);
    const metadata = resolve(source, 'island.json');
    writeFileSync(metadata, ` ${readFileSync(metadata, 'utf8')}`);
    check(await driftwoodIslandProtoOutput(context())); expect(builds).toBe(2);
    check(await driftwoodIslandProtoOutput(context('b'))); expect(builds).toBe(3);
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

test('the dressing scheduler no longer publishes a prototype GLB under src', () => {
  const job = discoverGeneration(resolve('.')).jobs.find(row => row.id === 'driftwood-island-dressing');
  if (job === undefined) throw new Error('Missing retained dressing producer');
  for (const output of job.outputs) {
    expect(output).not.toMatch(/\/assets\/(?:d206d254|5b1d2044)/u);
  }
});
