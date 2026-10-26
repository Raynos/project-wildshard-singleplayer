// oxlint-disable-next-line import/no-nodejs-modules -- Isolate native cache fixtures and compare complete original GLB oracles.
import { mkdtempSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep native cache and config bundle paths inside the checkout.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { nameBlob, type EmittedBlobs } from '../src/sdk/blobs';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { skyCreatureRigOutput } from '../src/shards/far-reach/generators/creatureRigOutput';
import { originalSkyRigs } from './fixtures/sky-original-rigs';

function check(output: EmittedBlobs): void {
  const originals = originalSkyRigs();
  expect(output.files.map(file => file.name)).toEqual([...originals.keys()].map(name => `world/rigs/${name}`).sort());
  expect(output.assets.size).toBe(5);
  for (const [name, original] of originals) {
    const file = output.files.find(row => row.name === `world/rigs/${name}`);
    const bytes = file === undefined ? undefined : output.assets.get(file.hash);
    if (file === undefined || bytes === undefined) throw new Error(`Missing admitted rig ${name}`);
    expect(bytes.length, name).toBe(original.length);
    expect(hashImmutableBytes(bytes), name).toBe(hashImmutableBytes(original));
    expect(file).toEqual(nameBlob(`world/rigs/${name}`, 'glb', original).file);
  }
  expect(output.files.find(file => file.name === 'world/rigs/storm-roc.glb')).toMatchObject({
    decoded: 6_253_578, gpu: 6_380_144, triangles: 11_760, draws: 2 });
  expect(output.files.find(file => file.name === 'world/rigs/storm-roc.phone.glb')).toMatchObject({
    decoded: 2_054_820, gpu: 6_380_144, triangles: 11_760, draws: 2 });
}

test('the checked native host admits all five complete original rigs on cold and persistent hits', async () => {
  const scratch = mkdtempSync(resolve('tmp/sky-rig-output-'));
  let encodes = 0;
  const context = () => {
    const ctx = createProjectGeneration(resolve('src/shards/far-reach'), 'd'.repeat(64), new Map(), resolve(scratch, 'cache'),
      [{ prefix: '/assets/far-reach/', directory: resolve('public/assets/far-reach') }]);
    const factory = ctx.basisEncoder;
    if (factory === undefined) throw new Error('Missing checked native encoder');
    return { cached: ctx.cached, basisEncoder: async () => {
      const port = await factory();
      return { identity: port.identity, encode: (image: Parameters<typeof port.encode>[0]) => { encodes++; return port.encode(image); } };
    } };
  };
  try {
    const cold = await skyCreatureRigOutput(context()); check(cold);
    for (const bytes of cold.assets.values()) bytes.fill(0);
    const file = cold.files[0];
    if (file === undefined) throw new Error('Missing first admitted file');
    file.dependencies.push('0'.repeat(64));
    const hit = await skyCreatureRigOutput(context()); check(hit);
    expect(encodes).toBe(1);
    for (const row of hit.files) expect(row.dependencies).toEqual([]);
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}, 180_000);

test('publication refuses an absent trusted encoder before reading a native cache', async () => {
  let reads = 0;
  await expect(skyCreatureRigOutput({ cached: () => { reads++; return Promise.resolve(new Map()); } }))
    .rejects.toThrow('Sky rig publication needs the checked Basis encoder');
  expect(reads).toBe(0);
});

test('publication remains one config-safe chunk without a native tool or generated module import', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/far-reach/generators/creatureRigOutput.ts'), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u, 'assemblyscript/dist/asc.js'], output: { codeSplitting: false } } } });
  const output = Array.isArray(result) ? result[0] : result;
  if (output === undefined || !('output' in output)) throw new Error('Missing publication chunk');
  const chunks = output.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) {
    assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports]);
    // The existing defining immutable-byte writer uses Node's SHA-256 only.
    expect([...chunk.imports, ...chunk.dynamicImports].filter(name => name !== chunk.fileName)).toEqual(['node:crypto']);
    expect(Object.keys(chunk.modules).some(path => path.includes('.generated.') || /\/basis(?:Tool|Encoder)\.ts$/u.test(path))).toBe(false);
  }
});
