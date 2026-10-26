// oxlint-disable-next-line import/no-nodejs-modules -- Isolate native cache fixtures and compare complete original GLB oracles.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep native cache and config bundle paths inside the checkout.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { nameBlob, type EmittedBlobs } from '../src/sdk/blobs';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { skyCreatureRigOutput } from '../src/shards/far-reach/generators/creatureRigOutput';

const originals = [
  ['storm-roc.glb', 'public/assets/far-reach/rigs/storm-roc.glb', 492_772, '1c057979c81e5fafd2f97a151b7936c90ccf01555b2f307b911fc628e7c19af0'],
  ['sky-goat.glb', 'public/assets/far-reach/rigs/sky-goat.glb', 94_368, 'bb8ab3271fb98f8c6684f14771d8cb5c7a77b3ba2646087fe0956db18da9c018'],
  ['drift-ray.glb', 'public/assets/far-reach/rigs/drift-ray.glb', 74_448, 'd0f39e6fa142c5f12c9949e6ba91f6bc621cd8bfaa8c2c327650f05439a56020'],
  ['gale-wisp.glb', 'public/assets/far-reach/rigs/gale-wisp.glb', 10_132, '55467d69a6f7144ba38a06a7f917a3de09d30a44e9c9e1729a6e520af2d6be31'],
  ['storm-roc.phone.glb', 'public/assets/gpu/far-reach/rigs/storm-roc-70e5655f.glb', 2_053_504, '70e5655f969dfb40edba0109d16d7baddc6faef7bede8d10d91c2e2661f7d8ad'],
] as const;
function check(output: EmittedBlobs): void {
  expect(output.files.map(file => file.name)).toEqual(originals.map(([name]) => `world/rigs/${name}`).sort());
  expect(output.assets.size).toBe(5);
  for (const [name, path, size, hash] of originals) {
    const file = output.files.find(row => row.name === `world/rigs/${name}`);
    const bytes = file === undefined ? undefined : output.assets.get(file.hash);
    if (file === undefined || bytes === undefined) throw new Error(`Missing admitted rig ${name}`);
    expect(bytes.length, name).toBe(size); expect(hashImmutableBytes(bytes), name).toBe(hash);
    const original = readFileSync(path);
    expect(hashImmutableBytes(original), name).toBe(hash);
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
