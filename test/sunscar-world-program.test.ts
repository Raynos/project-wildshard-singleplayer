// oxlint-disable-next-line import/no-nodejs-modules -- Each real source-program proof owns and removes its isolated cache.
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Bind the cache and author folder explicitly, with no published bake inputs.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { signalWorldFiles, signalWorld } from '../src/shards/sunscar-dunes/generators/worldProgram';
import { BAKED_URLS } from '../src/shards/sunscar-dunes/generators/rows/files';
import original from './fixtures/sunscar-world-files.json' with { type: 'json' };

const signature = (files: ReadonlyMap<string, Uint8Array>) => Object.fromEntries([...files]
  .map(([name, bytes]) => [name, { bytes: bytes.length, hash: hashImmutableBytes(bytes) }]));

test('cold and cached world bakes retain all fifteen original files and detached results', async () => {
  mkdirSync('tmp', { recursive: true }); const cache = mkdtempSync(resolve('tmp', 'sunscar-world-program-'));
  try {
    let bakes = 0;
    const context = () => {
      const ctx = createProjectGeneration(resolve('src/shards/sunscar-dunes'), 'e'.repeat(64), new Map(), cache);
      return { cached: (step: Parameters<typeof ctx.cached>[0], generate: Parameters<typeof ctx.cached>[1]) =>
        ctx.cached(step, inputs => { bakes++; return generate(inputs); }) };
    };
    const cold = await signalWorldFiles(context()); expect(signature(cold)).toEqual(original);
    const well = cold.get('well.glb'); if (well === undefined) throw new Error('Missing original well bake');
    well.fill(0); cold.get('well.json')?.fill(0);
    const hit = await signalWorldFiles(context()); expect(signature(hit)).toEqual(original); expect(bakes).toBe(1);
    expect(hit.get('well.glb') === well).toBe(false);
    const assets = new Map<string, Uint8Array>();
    const world = await signalWorld({ ...context(), asset: bytes => { const hash = hashImmutableBytes(bytes); assets.set(hash, bytes); return hash; } });
    expect(world.blobs).toHaveLength(8); expect(assets.size).toBe(8); expect(bakes).toBe(1);
    for (const blob of world.blobs) {
      const name = blob.file.name?.split('/').at(-1), expected = Object.entries(original).find(([key]) => key === name)?.[1];
      expect({ bytes: blob.bytes.length, hash: blob.file.hash }).toEqual(expected);
      expect(blob.file.compressed).toBe(blob.bytes.length);
      if (blob.file.kind === 'glb') {
        expect(blob.file.decoded).toBeGreaterThan(0); expect(blob.file.triangles).toBeGreaterThan(0); expect(blob.file.draws).toBeGreaterThan(0);
      } else expect([blob.file.decoded, blob.file.gpu]).toEqual([196608, 262140]);
    }
    expect(world.files.urls).toEqual(Object.fromEntries(Object.keys(BAKED_URLS).map(name => [name, `geometry/world/${name}.glb`])));
    expect(world.files.resources[0]?.url).toBe('textures/plait.bin');
    await expect(signalWorld({ ...context(), asset: () => '0'.repeat(64) })).rejects.toThrow('publication differs');
  } finally { rmSync(cache, { recursive: true, force: true }); }
});

test('the world recipe refuses a missing or extended input bank before baking', async () => {
  for (const inputs of [new Map<string, Uint8Array>(), new Map([
    ['assets/models/dry-well.glb', new Uint8Array([1])], ['extra', new Uint8Array([1])],
  ])]) {
    await expect(signalWorldFiles({ cached: (_step, generate) => Promise.resolve().then(() => generate(inputs)) })).rejects.toThrow('Missing original well model');
  }
});

test('the world recipe refuses an incomplete, extended or empty cached output bank', async () => {
  const rows = Object.keys(original).map(name => [name, new Uint8Array([1])] as const);
  for (const files of [new Map<string, Uint8Array>(), new Map([...rows, ['extra', new Uint8Array([1])]]),
    new Map(rows.map(([name, bytes]) => [name, name === 'well.glb' ? new Uint8Array(0) : bytes]))]) {
    await expect(signalWorldFiles({ cached: () => Promise.resolve(files) })).rejects.toThrow('cache inventory');
  }
});

test('the world recipe bundles as one author chunk without filesystem or compiler services', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/sunscar-dunes/generators/worldProgram.ts'), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u, 'assemblyscript/dist/asc.js'], output: { codeSplitting: false } } } });
  const output = Array.isArray(result) ? result[0] : result;
  if (output === undefined || !('output' in output)) throw new Error('Missing world author bundle');
  const chunks = output.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) expect(() => assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports])).not.toThrow();
});

test('the five legacy-only public GLBs stay byte-exact until LD', () => {
  const legacy = readFileSync('src/shards/sunscar-dunes-legacy/boot/files.ts', 'utf8');
  let total = 0;
  for (const name of ['rocks', 'dressing', 'tower', 'caravan', 'well']) {
    const url = `/assets/sunscar-dunes/baked/${name}.glb`;
    expect(legacy).toContain(url);
    const bytes = new Uint8Array(readFileSync(`public${url}`)); total += bytes.length;
    expect({ bytes: bytes.length, hash: hashImmutableBytes(bytes) })
      .toEqual(Object.entries(original).find(([key]) => key === `${name}.glb`)?.[1]);
  }
  expect(total).toBe(380964);
});
