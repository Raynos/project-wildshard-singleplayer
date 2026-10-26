// oxlint-disable-next-line import/no-nodejs-modules -- Own and remove this test's real cache directory.
import { mkdtempSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Bind only the explicitly authored model input root.
import { resolve } from 'node:path';
import { expect, test, vi } from 'vitest';
import { build } from 'vite';
import { createProjectGeneration, type ProjectGenerationContext } from '../src/sdk/projectGeneration';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { MODEL_FILES } from '../src/shards/nalati-grasslands/generators/modelPaint.mjs';
import { nalatiModelPaintProgram } from '../src/shards/nalati-grasslands/generators/modelPaintProgram';
import originals from './fixtures/nalati-model-paint.json' with { type: 'json' };

test('cold and new-context cache hits retain all original bytes and detached ownership', async () => {
  const cache = mkdtempSync(resolve('tmp/nalati-model-program-'));
  let generated = 0;
  const context = (): Pick<ProjectGenerationContext, 'cached'> => {
    const real = createProjectGeneration(resolve('src/shards/nalati-grasslands'), 'c'.repeat(64), new Map(), cache,
      [{ prefix: '/assets/nalati/models/', directory: resolve('public/assets/nalati/models') }]);
    return { cached: (step, generate) => {
      expect(step.native).toBe(true);
      expect(step.inputs).toEqual(MODEL_FILES.map(file => `/assets/nalati/models/${file}`));
      return real.cached(step, inputs => { generated++; return generate(inputs); });
    } };
  };
  const exact = (files: ReadonlyMap<string, Uint8Array>): void => {
    expect([...files.keys()].sort()).toEqual(originals.map(row => row.file).sort());
    for (const row of originals) {
      const bytes = files.get(row.file);
      if (bytes === undefined) throw new Error(`Missing original model: ${row.file}`);
      expect(bytes.length, row.file).toBe(row.bytes);
      expect(hashImmutableBytes(bytes), row.file).toBe(row.sha256);
    }
  };
  try {
    const cold = await nalatiModelPaintProgram(context()); exact(cold);
    const first = cold.get('horse-saddled.glb');
    if (first === undefined) throw new Error('Missing owned cold model');
    first.fill(0);
    const hit = await nalatiModelPaintProgram(context()); exact(hit);
    expect(hit.get('horse-saddled.glb') === first).toBe(false);
    expect(generated).toBe(1);
  } finally { rmSync(cache, { recursive: true, force: true }); }
});

test('missing authored models retain a named refusal before painting', async () => {
  const context: Pick<ProjectGenerationContext, 'cached'> = { cached: (_step, generate) => Promise.resolve(generate(new Map())) };
  await expect(nalatiModelPaintProgram(context)).rejects.toThrow('Missing authored Nalati model: horse-saddled.glb');
});

test('selected consumers keep original bytes, detached hits and distinct cache identities', async () => {
  const cache = mkdtempSync(resolve('tmp/nalati-model-selection-'));
  let generated = 0;
  const context = (): Pick<ProjectGenerationContext, 'cached'> => {
    const real = createProjectGeneration(resolve('src/shards/nalati-grasslands'), 'c'.repeat(64), new Map(), cache,
      [{ prefix: '/assets/nalati/models/', directory: resolve('public/assets/nalati/models') }]);
    return { cached: (step, make) => real.cached(step, inputs => { generated++; return make(inputs); }) };
  };
  const exact = (files: ReadonlyMap<string, Uint8Array>, names: readonly string[]): void => {
    expect([...files.keys()]).toEqual(names);
    for (const name of names) {
      const bytes = files.get(name), pin = originals.find(row => row.file === name);
      if (bytes === undefined || pin === undefined) throw new Error('Missing original selected model');
      expect(bytes.byteLength, name).toBe(pin.bytes);
      expect(hashImmutableBytes(bytes), name).toBe(pin.sha256);
    }
  };
  const names = ['cauldron.glb', 'balbal.glb'];
  try {
    const selected = [...names], pending = nalatiModelPaintProgram(context(), selected);
    selected.splice(0);
    const cold = await pending; exact(cold, names);
    for (const bytes of cold.values()) bytes.fill(0);
    const hit = await nalatiModelPaintProgram(context(), names); exact(hit, names);
    expect(generated).toBe(1);
    exact(await nalatiModelPaintProgram(context(), ['cauldron.glb']), ['cauldron.glb']);
    expect(generated).toBe(2);
    exact(await nalatiModelPaintProgram(context(), names), names);
    expect(generated).toBe(2);
  } finally { rmSync(cache, { recursive: true, force: true }); }
});

test('invalid selections refuse before any authored input or cache request', async () => {
  const cached = vi.fn(() => Promise.resolve(new Map<string, Uint8Array>()));
  for (const selected of [[], ['cauldron.glb', 'cauldron.glb'], ['unknown.glb'], ['../cauldron.glb']]) {
    await expect(nalatiModelPaintProgram({ cached }, selected)).rejects.toThrow('Invalid Nalati painted model selection');
  }
  expect(cached).not.toHaveBeenCalled();
});

for (const defect of ['missing', 'extra', 'truncated', 'magic', 'version', 'length'] as const) {
  test(`cached models refuse ${defect} output`, async () => {
    const header = new Uint8Array(20), view = new DataView(header.buffer);
    view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, 20, true);
    const files = new Map(MODEL_FILES.map(file => [file, header.slice()]));
    if (defect === 'missing') files.delete('horse-saddled.glb');
    else if (defect === 'extra') files.set('unexpected.glb', header);
    else if (defect === 'truncated') files.set('horse-saddled.glb', new Uint8Array(4));
    else {
      const invalid = header.slice(), invalidView = new DataView(invalid.buffer);
      invalidView.setUint32(defect === 'magic' ? 0 : defect === 'version' ? 4 : 8, 0, true);
      files.set('horse-saddled.glb', invalid);
    }
    await expect(nalatiModelPaintProgram({ cached: () => Promise.resolve(files) })).rejects.toThrow(
      defect === 'missing' || defect === 'extra' ? 'inventory differs' : defect === 'truncated' ? 'Missing owned' : 'Invalid owned');
  });
}

test('the actual cache program bundles without filesystem or compiler capabilities', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/nalati-grasslands/generators/modelPaintProgram.ts'), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u], output: { codeSplitting: false } },
  } });
  const built = Array.isArray(result) ? result[0] : result;
  if (built === undefined || !('output' in built)) throw new Error('Missing model source-program bundle');
  const chunks = built.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) expect(() => assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports])).not.toThrow();
});
