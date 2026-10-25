// oxlint-disable-next-line import/no-nodejs-modules -- Each actual source bake owns and removes its isolated cache.
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Bind the defining project and the private cache explicitly.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { signalSandFiles, signalSand } from '../src/shards/sunscar-dunes/generators/sandProgram';
import original from './fixtures/sunscar-sand-files.json' with { type: 'json' };

const signature = (files: ReadonlyMap<string, Uint8Array>) => Object.fromEntries([...files]
  .map(([name, bytes]) => [name, { bytes: bytes.length, hash: hashImmutableBytes(bytes) }]));

test('cold and cached sand results preserve all seven original files and own their bytes', async () => {
  mkdirSync('tmp', { recursive: true }); const cache = mkdtempSync(resolve('tmp', 'sunscar-sand-program-'));
  try {
    let bakes = 0;
    const context = () => {
      const ctx = createProjectGeneration(resolve('src/shards/sunscar-dunes'), 'f'.repeat(64), new Map(), cache);
      return { cached: (step: Parameters<typeof ctx.cached>[0], generate: Parameters<typeof ctx.cached>[1]) =>
        ctx.cached(step, inputs => { bakes++; return generate(inputs); }) };
    };
    const cold = await signalSandFiles(context()); expect(signature(cold)).toEqual(original);
    for (const bytes of cold.values()) bytes.fill(0);
    const hit = await signalSandFiles(context()); expect(signature(hit)).toEqual(original); expect(bakes).toBe(1);
    const owned = new Map<string, Uint8Array>();
    const sand = await signalSand({ ...context(), asset: bytes => { const hash = hashImmutableBytes(bytes); owned.set(hash, bytes); return hash; } });
    expect(owned.size).toBe(3); expect(bakes).toBe(1);
    const text = new TextEncoder();
    for (const [name, rows] of [['sand.json', sand.means], ['sandMaps.json', sand.maps]] as const) {
      const bytes = text.encode(`${JSON.stringify(rows, null, 2)}\n`);
      expect({ bytes: bytes.length, hash: hashImmutableBytes(bytes) }).toEqual(original[name]);
    }
    await expect(signalSand({ ...context(), asset: () => '0'.repeat(64) })).rejects.toThrow('Sand map publication differs');
    for (const [name, bytes] of hit) expect(bytes === cold.get(name)).toBe(false);
  } finally { rmSync(cache, { recursive: true, force: true }); }
});

test('the procedural sand bake refuses an injected file input', async () => {
  await expect(signalSandFiles({ cached: (_step, generate) => Promise.resolve().then(() => generate(new Map([
    ['sand.json', new Uint8Array([1])],
  ]))) })).rejects.toThrow('Unexpected sand bake input');
});

test('the sand recipe refuses missing, extended, misnamed or empty cached results', async () => {
  const rows = Object.keys(original).map(name => [name, new Uint8Array([1])] as const);
  for (const files of [new Map<string, Uint8Array>(), new Map([...rows, ['extra', new Uint8Array([1])]]),
    new Map(rows.map(([name, bytes]) => [name, name === 'sand.json' ? new Uint8Array(0) : bytes])),
    new Map(rows.map(([name, bytes]) => [name.startsWith('assets/') ? name.replace('assets/', 'other/') : name, bytes])),
    new Map(rows.map(([name, bytes]) => [name, name.startsWith('assets/') ? new Uint8Array(0) : bytes]))]) {
    await expect(signalSandFiles({ cached: () => Promise.resolve(files) })).rejects.toThrow('Sand cache inventory');
  }
});

test('the sand recipe bundles as one author chunk without filesystem or compiler services', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/sunscar-dunes/generators/sandProgram.ts'), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u, 'assemblyscript/dist/asc.js'], output: { codeSplitting: false } } } });
  const output = Array.isArray(result) ? result[0] : result;
  if (output === undefined || !('output' in output)) throw new Error('Missing sand author bundle');
  const chunks = output.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) {
    const imports = [...chunk.imports, ...chunk.dynamicImports];
    expect(() => assertConfigBoundary(imports)).not.toThrow();
    expect(imports.filter(name => /^(?:node:)?(?:fs|path|module)(?:\/|$)/u.test(name))).toEqual([]);
  }
});
