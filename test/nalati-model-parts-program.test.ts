// oxlint-disable-next-line import/no-nodejs-modules -- Isolate real native cache inputs and outputs beneath repository tmp.
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Supply exact explicit authored roots to the real generation cache.
import { resolve } from 'node:path';
import { expect, test, vi } from 'vitest';
import { build } from 'vite';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { readImagePixels } from '../src/sdk/bake/image';
import { nalatiModelParts } from '../src/shards/nalati-grasslands/generators/modelParts';
import { nalatiModelPartsProgram } from '../src/shards/nalati-grasslands/generators/modelPartsProgram';
import originals from './fixtures/nalati-model-paint.json' with { type: 'json' };

const selected = ['boulder-1.glb', 'boulder-1.phone.glb', 'horse-wild.far.glb'];
const hash = (text: string): string => hashImmutableBytes(new TextEncoder().encode(text));

test('the complete part producer is one config-safe chunk with no publication services', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/nalati-grasslands/generators/modelPartsProgram.ts'), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u], output: { codeSplitting: false } },
  } });
  const built = Array.isArray(result) ? result[0] : result;
  if (built === undefined || !('output' in built)) throw new Error('Missing owned model-part author bundle');
  const chunks = built.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) {
    expect(() => assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports])).not.toThrow();
    expect(Object.keys(chunk.modules).some(path => path.endsWith('/scripts/bake-output.mjs'))).toBe(false);
  }
});

test('cold, detached persistent hits and changed source/program keys retain the defining complete parts', async () => {
  const directory = mkdtempSync(resolve('tmp/nalati-model-parts-cache-')), inputs = resolve(directory, 'inputs'); mkdirSync(inputs);
  for (const file of selected) writeFileSync(resolve(inputs, file), readFileSync(`public/assets/nalati/models/${file}`));
  const context = (program: string, root = inputs) => createProjectGeneration(resolve('.'), hash(program), new Map(), resolve(directory, 'cache'), [{ prefix: '/assets/nalati/models/', directory: root }]);
  try {
    const cold = await nalatiModelPartsProgram(context('original'), selected);
    expect([...cold.keys()]).toEqual(['boulder-1.glb', 'boulder-1.ktx2', 'boulder-1.phone.glb', 'boulder-1.phone.ktx2', 'horse-wild.far.glb']);
    for (const file of selected) {
      const original = new Uint8Array(readFileSync(`public/assets/nalati/baked/painted-models/${file}`)), pin = originals.find(row => row.file === file);
      if (pin === undefined) throw new Error('Missing original model pin');
      expect(original.length).toBe(pin.bytes); expect(hashImmutableBytes(original)).toBe(pin.sha256);
      const expected = await nalatiModelParts(original), geometry = cold.get(file);
      if (geometry === undefined) throw new Error('Missing cached geometry');
      expect(Buffer.compare(geometry, expected.geometry)).toBe(0);
      if (expected.atlas !== null) {
        const atlas = cold.get(file.replace(/\.glb$/u, '.ktx2')); if (atlas === undefined) throw new Error('Missing cached atlas');
        expect(Buffer.compare(atlas, expected.atlas)).toBe(0);
      }
    }
    const expectedHashes = [...cold].map(([name, bytes]) => [name, hashImmutableBytes(bytes)]);
    for (const bytes of cold.values()) bytes.fill(0);
    const hitContext = context('original'), real = hitContext.cached, make = vi.fn();
    hitContext.cached = (step, generate) => real(step, bytes => { make(); return generate(bytes); });
    const hit = await nalatiModelPartsProgram(hitContext, selected);
    expect(make).not.toHaveBeenCalled(); expect([...hit].map(([name, bytes]) => [name, hashImmutableBytes(bytes)])).toEqual(expectedHashes);
    const changedContext = context('changed'), changedReal = changedContext.cached;
    changedContext.cached = (step, generate) => changedReal(step, bytes => { make(); return generate(bytes); });
    const rebuilt = await nalatiModelPartsProgram(changedContext, selected);
    expect(make).toHaveBeenCalledTimes(1); expect([...rebuilt].map(([name, bytes]) => [name, hashImmutableBytes(bytes)])).toEqual(expectedHashes);
    writeFileSync(resolve(inputs, 'boulder-1.glb'), readFileSync(resolve(inputs, 'boulder-1.phone.glb')));
    const sourceChanged = await nalatiModelPartsProgram(context('original'), selected);
    const changed = sourceChanged.get('boulder-1.glb'); if (changed === undefined) throw new Error('Missing changed source geometry');
    expect(hashImmutableBytes(changed)).not.toBe(expectedHashes[0]?.[1]);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('invalid selection, undeclared roots, missing inputs and incomplete or altered cache files refuse', async () => {
  const cached = vi.fn(() => Promise.resolve(new Map<string, Uint8Array>()));
  for (const names of [[], ['boulder-1.glb', 'boulder-1.glb'], ['foreign.glb']]) await expect(nalatiModelPartsProgram({ cached, readImagePixels }, names)).rejects.toThrow('selection');
  expect(cached).not.toHaveBeenCalled();
  await expect(nalatiModelPartsProgram({ cached, readImagePixels }, selected)).rejects.toThrow('inventory');
  const directory = mkdtempSync(resolve('tmp/nalati-model-parts-refusal-'));
  try {
    const missingRoot = createProjectGeneration(resolve('.'), hash('missing-root'), new Map(), resolve(directory, 'cache'));
    await expect(nalatiModelPartsProgram(missingRoot, selected)).rejects.toThrow('exactly one declared root');
    const missingInput = createProjectGeneration(resolve('.'), hash('missing-input'), new Map(), resolve(directory, 'cache'), [{ prefix: '/assets/nalati/models/', directory }]);
    await expect(nalatiModelPartsProgram(missingInput, selected)).rejects.toThrow();
    const missing = { cached: () => Promise.resolve(new Map<string, Uint8Array>()), readImagePixels };
    await expect(nalatiModelPartsProgram(missing, ['horse-wild.far.glb'])).rejects.toThrow('inventory');
    const extra = { cached: () => Promise.resolve(new Map([['horse-wild.far.glb', new Uint8Array(32)], ['extra', new Uint8Array(32)]])), readImagePixels };
    await expect(nalatiModelPartsProgram(extra, ['horse-wild.far.glb'])).rejects.toThrow('inventory');
    const malformed = { cached: () => Promise.resolve(new Map([['horse-wild.far.glb', new Uint8Array(32)]])), readImagePixels };
    await expect(nalatiModelPartsProgram(malformed, ['horse-wild.far.glb'])).rejects.toThrow();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
