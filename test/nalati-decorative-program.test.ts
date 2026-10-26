// oxlint-disable-next-line import/no-nodejs-modules -- Own a disposable cache and compare both complete predecessor wires.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep the source cache and bundle entry confined to repository paths.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { nalatiDecorativeProgram } from '../src/shards/nalati-grasslands/generators/decorativeProgram';

test('owned decorative cold bytes and detached cache hits equal both original profile wires', async () => {
  const cache = mkdtempSync(resolve('tmp/nalati-decorative-owned-'));
  let constructions = 0;
  const context = () => {
    const ctx = createProjectGeneration(resolve('src/shards/nalati-grasslands'), 'a'.repeat(64), new Map(), cache,
      [{ prefix: '/assets/baked/nalati-grasslands/', directory: resolve('public/assets/baked/nalati-grasslands') }]);
    return { cached: (step: Parameters<typeof ctx.cached>[0], make: Parameters<typeof ctx.cached>[1]) => {
      expect(step.native).toBe(true);
      expect(step.inputs).toEqual(['/assets/baked/nalati-grasslands/terrain.bin']);
      return ctx.cached(step, inputs => { constructions++; return make(inputs); });
    } };
  };
  const check = (files: ReadonlyMap<string, Uint8Array>) => {
    expect([...files.keys()]).toEqual(['decorative.json']);
    const bytes = files.get('decorative.json');
    if (bytes === undefined) throw new Error('Missing owned decorative wire');
    for (const directory of ['boot', 'data']) {
      const original = readFileSync(`src/shards/nalati-grasslands/${directory}/decorative.generated.json`);
      expect(Buffer.compare(bytes, original)).toBe(0);
    }
  };
  try {
    const cold = await nalatiDecorativeProgram(context()); check(cold);
    for (const bytes of cold.values()) bytes.fill(0);
    const hit = await nalatiDecorativeProgram(context()); check(hit);
    expect(constructions).toBe(1);
  } finally { rmSync(cache, { recursive: true, force: true }); }
});

test('missing terrain and missing, empty or extra cache outputs refuse', async () => {
  await expect(nalatiDecorativeProgram({ cached: (_step, make) => Promise.resolve(make(new Map())) }))
    .rejects.toThrow('Missing original Nalati decorative terrain');
  for (const files of [new Map(), new Map([['decorative.json', new Uint8Array()]]),
    new Map([['decorative.json', new Uint8Array([1])], ['extra', new Uint8Array([1])]])]) {
    await expect(nalatiDecorativeProgram({ cached: () => Promise.resolve(files) }))
      .rejects.toThrow('Owned Nalati decorative inventory differs');
  }
});

test('the owned decorative source bundles as one config-safe chunk', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/nalati-grasslands/generators/decorativeProgram.ts'), formats: ['es'] },
    rolldownOptions: { output: { codeSplitting: false } } } });
  const built = Array.isArray(result) ? result[0] : result;
  if (built === undefined || !('output' in built)) throw new Error('Missing owned decorative author bundle');
  const chunks = built.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) {
    const imports = [...chunk.imports, ...chunk.dynamicImports];
    expect(() => assertConfigBoundary(imports)).not.toThrow();
    expect(imports).toEqual([]);
  }
});
