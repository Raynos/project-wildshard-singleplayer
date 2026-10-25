// oxlint-disable-next-line import/no-nodejs-modules -- Own the real cache and inspect complete original wire files.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep the isolated author cache below repository tmp.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { nalatiDressingProgram } from '../src/shards/nalati-grasslands/generators/dressingProgram';
import pins from './fixtures/nalati-place-wires.json' with { type: 'json' };

test('native dressing owns complete original cold bytes and independent cache hits without file inputs', async () => {
  const cache = mkdtempSync(resolve('tmp/nalati-dressing-owned-'));
  let builds = 0;
  const context = () => {
    const ctx = createProjectGeneration(resolve('src/shards/nalati-grasslands'), 'a'.repeat(64), new Map(), cache);
    return { cached: (step: Parameters<typeof ctx.cached>[0], make: Parameters<typeof ctx.cached>[1]) => {
      expect(step.native).toBe(true); expect(step.inputs).toEqual([]);
      return ctx.cached(step, inputs => { builds++; return make(inputs); });
    } };
  };
  const check = (files: ReadonlyMap<string, Uint8Array>) => {
    expect([...files.keys()].sort()).toEqual(['dressing.bin', 'dressing.json']);
    for (const [name, path] of [['dressing.bin', 'test/fixtures/nalati-dressing.bin'],
      ['dressing.json', 'test/fixtures/nalati-dressing-geos.json']] as const) {
      const bytes = files.get(name), pin = pins.find(row => row.path === path);
      if (bytes === undefined || pin === undefined) throw new Error('Missing original dressing output');
      expect({ path, bytes: bytes.length, hash: hashImmutableBytes(bytes) }).toEqual(pin);
      expect(Buffer.compare(bytes, readFileSync(path))).toBe(0);
    }
  };
  try {
    const cold = await nalatiDressingProgram(context()); check(cold);
    for (const bytes of cold.values()) bytes.fill(0);
    const hit = await nalatiDressingProgram(context()); check(hit);
    expect(builds).toBe(1);
  } finally { rmSync(cache, { recursive: true, force: true }); }
});

test('missing, empty and extra owned dressing files refuse', async () => {
  const names = ['dressing.bin', 'dressing.json'];
  for (const files of [new Map(), new Map(names.map(name => [name, new Uint8Array()])),
    new Map([...names, 'extra'].map(name => [name, new Uint8Array([1])]))]) {
    await expect(nalatiDressingProgram({ cached: () => Promise.resolve(files) })).rejects.toThrow('Owned Nalati dressing inventory differs');
  }
});

test('the native program stays one config-safe chunk with only its original codecs', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/nalati-grasslands/generators/dressingProgram.ts'), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u], output: { codeSplitting: false } },
  } });
  const built = Array.isArray(result) ? result[0] : result;
  if (built === undefined || !('output' in built)) throw new Error('Missing native dressing program bundle');
  const chunks = built.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) {
    const imports = [...chunk.imports, ...chunk.dynamicImports];
    expect(() => assertConfigBoundary(imports)).not.toThrow();
    expect(imports.sort()).toEqual(['node:crypto', 'node:zlib']);
  }
});
