// oxlint-disable-next-line import/no-nodejs-modules -- Each real source-program proof owns and removes an isolated cache.
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the actual author folder and the one owned cache directory.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { signalRigFiles, signalRigs } from '../src/shards/sunscar-dunes/generators/rigProgram';
import { signalRigLibrary, SIGNAL_RIG_LIBRARY } from '../src/shards/sunscar-dunes/generators/rows/rigLibrary';
import { signalModelSource, SIGNAL_SOURCE_BLOBS } from '../src/shards/sunscar-dunes/generators/sceneSources';
import { signalSourceOutput, output as originalOutput } from '../src/shards/sunscar-dunes/generators/sourceOutput';
import original from './fixtures/sunscar-rig-files.json' with { type: 'json' };

const signature = (files: ReadonlyMap<string, Uint8Array>) => Object.fromEntries([...files].map(([name, bytes]) => [name, { bytes: bytes.length, hash: hashImmutableBytes(bytes) }]));

test('cold and cached creature bakes retain all five original full-byte identities and detached results', async () => {
  mkdirSync('tmp', { recursive: true }); const cache = mkdtempSync(resolve('tmp', 'sunscar-rig-program-'));
  try {
    let bakes = 0;
    const context = () => {
      const ctx = createProjectGeneration(resolve('src/shards/sunscar-dunes'), 'd'.repeat(64), new Map(), cache);
      return { cached: (step: Parameters<typeof ctx.cached>[0], generate: Parameters<typeof ctx.cached>[1]) => ctx.cached(step, inputs => { bakes++; return generate(inputs); }) };
    };
    const cold = await signalRigFiles(context()); expect(signature(cold)).toEqual(original);
    const first = cold.get('skitterer.glb'); if (first === undefined) throw new Error('Missing skitterer'); first.fill(0);
    const hit = await signalRigFiles(context()); expect(signature(hit)).toEqual(original); expect(bakes).toBe(1);
    const owned = new Map<string, Uint8Array>();
    const rigs = await signalRigs({ ...context(), asset: bytes => { const hash = hashImmutableBytes(bytes); owned.set(hash, bytes); return hash; } });
    expect(rigs.blobs).toHaveLength(4); expect(owned.size).toBe(4); expect(bakes).toBe(1);
    for (const blob of rigs.blobs) {
      const name = blob.file.name?.split('/').at(-1);
      const expected = Object.entries(original).find(([key]) => key === name)?.[1];
      expect({ bytes: blob.bytes.length, hash: hashImmutableBytes(blob.bytes) }).toEqual(expected);
      expect(blob.file.compressed).toBe(blob.bytes.length);
      expect(blob.file.decoded).toBeGreaterThan(0); expect(blob.file.triangles).toBeGreaterThan(0); expect(blob.file.draws).toBeGreaterThan(0);
    }
    expect(rigs.library.bodies.standIns).toEqual(SIGNAL_RIG_LIBRARY.bodies.standIns);
    expect(rigs.library.looks).toBe(SIGNAL_RIG_LIBRARY.looks);
    const baseline = signalModelSource(signalRigLibrary(SIGNAL_RIG_LIBRARY.bodies.urls, rigs.library.bodies.standIns.strider));
    expect(hashImmutableBytes(baseline.bytes)).toBe(SIGNAL_SOURCE_BLOBS[0]?.file.hash);
    const output = signalSourceOutput(signalModelSource(rigs.library), rigs.blobs);
    expect(output.platform).toBe(originalOutput.platform);
    expect(output.namedFiles?.length).toBe((originalOutput.namedFiles.length) + 4);
  } finally { rmSync(cache, { recursive: true, force: true }); }
});

test('the cached rig recipe refuses an incomplete or extended file bank', async () => {
  for (const files of [new Map<string, Uint8Array>(), new Map(Object.keys(original).concat('extra').map(name => [name, new Uint8Array([1])]))])
    await expect(signalRigFiles({ cached: () => Promise.resolve(files) })).rejects.toThrow('cache inventory');
});

test('the real rig program bundles as one author chunk without filesystem or compiler services', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/sunscar-dunes/generators/rigProgram.ts'), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u, 'assemblyscript/dist/asc.js'], output: { codeSplitting: false } } } });
  const output = Array.isArray(result) ? result[0] : result;
  if (output === undefined || !('output' in output)) throw new Error('Missing rig author bundle');
  const chunks = output.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) expect(() => assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports])).not.toThrow();
});
