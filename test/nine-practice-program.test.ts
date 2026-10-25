// oxlint-disable-next-line import/no-nodejs-modules -- Own only the isolated program cache and read the retained original oracle.
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Bind the actual author project explicitly.
import { resolve } from 'node:path';
import { afterAll, expect, test } from 'vitest';
import { build } from 'vite';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { admitScriptContract } from '../src/format/scriptContract';
import { ninePracticeProgram } from '../src/shards/nine-dragon-stack/generators/practiceProgram';
import { buildCourseProgram } from '../src/commons/practiceCourse';
import before from './fixtures/course-program-contracts.json' with { type: 'json' };

mkdirSync('tmp', { recursive: true });
const cache = mkdtempSync(resolve('tmp', 'nine-practice-program-'));
afterAll(() => { rmSync(cache, { recursive: true, force: true }); });
const published = new Map<string, Uint8Array>();
const context = (identity = 'e') => createProjectGeneration(resolve('src/shards/nine-dragon-stack'), identity.repeat(64), published, cache);
const ctx = context(), compiler = ctx.compileDecisionRows;
if (compiler === undefined) throw new Error('Missing real decision compiler');
let compiles = 0;
// Cold compilation is admitted before the timed byte/hit cases; the original
// full contract and executable oracles retain the ordinary 30-second budget.
const cold = await ninePracticeProgram({ ...ctx, compileDecisionRows: (...args) => {
  compiles++; expect(args[3]).toEqual({ asLineCeiling: 256, singleSignal: true });
  expect(args[2].get('behaviour/course.as')).toBe(readFileSync('src/commons/scripts/course.as', 'utf8'));
  return compiler(...args);
} });
const predecessor = await buildCourseProgram('checkpoints', {}, true);
if (predecessor.binary === undefined) throw new Error('Missing original raw course module');
const original = predecessor.binary;
const contract = encodeCanonicalJson({ script: cold.script });
const metadata = new TextEncoder().encode(encodeCanonicalJson({ script: cold.script, bytes: '' }));

test('the injected course retains every original contract field, executable byte and admitted cost', () => {
  expect(compiles).toBe(1); expect(cold.blob.bytes).toEqual(original);
  expect(hashImmutableBytes(original)).toBe('6ffc72748c1709f4239ac983fdda5841a524a026512287fe16f0fa498b276102');
  expect(hashImmutableBytes(new TextEncoder().encode(contract))).toBe('9127647ac9e42b887da2e4affd59f7e74e3a2d9c9e22263fa35991c20675e8a9');
  expect(cold.blob.file).toEqual({ name: 'behaviour/practice.wasm', kind: 'wasm', path: cold.script.module,
    hash: hashImmutableBytes(original), compressed: 9786, decoded: 9786, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: true });
  expect(cold.blob.script).toEqual({ abi: 1, pages: 1 });
  expect(() => admitScriptContract(cold.blob.bytes, { abi: 1, pages: 1 })).not.toThrow();
  expect(published.get(cold.blob.file.hash)).toEqual(original);
});

test('persistent hits need no compiler and detach the complete row and raw module', async () => {
  cold.blob.bytes.fill(0); cold.script.params['courseKind'] = 99;
  const hit = context();
  const result = await ninePracticeProgram({ cached: step => hit.cached(step, () => { throw new Error('A hit must not regenerate'); }), asset: hit.asset });
  expect(encodeCanonicalJson({ script: result.script })).toBe(contract);
  expect(result.blob.bytes).toEqual(original); expect(compiles).toBe(1);
});

test('missing compiler, extra/missing cached files, altered contracts and false publication refuse', async () => {
  const fresh = context('d');
  await expect(ninePracticeProgram({ cached: fresh.cached, asset: fresh.asset })).rejects.toThrow('Nine practice needs decision-row compilation');
  for (const files of [new Map<string, Uint8Array>(), new Map([['practice.wasm', original]]),
    new Map([['practice.wasm', original], ['practice.json', metadata], ['extra', new Uint8Array([1])]])]) {
    await expect(ninePracticeProgram({ cached: () => Promise.resolve(files), asset: ctx.asset })).rejects.toThrow('Nine practice cache inventory differs');
  }
  await expect(ninePracticeProgram({ cached: () => Promise.resolve(new Map([['practice.wasm', original],
    ['practice.json', new TextEncoder().encode('{"script":{},"bytes":""}')]])), asset: ctx.asset })).rejects.toThrow('Nine practice contract differs');
  await expect(ninePracticeProgram({ cached: () => Promise.resolve(new Map([['practice.wasm', original], ['practice.json', metadata]])),
    asset: () => '0'.repeat(64) })).rejects.toThrow('Nine practice publication differs');
});

test('an incomplete injected compiler result refuses before cache publication', async () => {
  const fresh = context('c');
  await expect(ninePracticeProgram({ ...fresh, compileDecisionRows: () => Promise.resolve({ rows: [], blobs: [], generated: new Map(), lines: 0, ceiling: 256 }) }))
    .rejects.toThrow('Nine practice compiler inventory differs');
});

test('the shared extraction retains the other shipped oval course contract and every module byte', async () => {
  const oval = await buildCourseProgram('oval', before.oval.parameters, true);
  if (oval.binary === undefined) throw new Error('Missing raw oval course');
  expect(hashImmutableBytes(new TextEncoder().encode(encodeCanonicalJson({ script: oval.script })))).toBe(before.oval.contractHash);
  expect(oval.binary.length).toBe(before.oval.bytes);
  expect(hashImmutableBytes(oval.binary)).toBe(before.oval.moduleHash);
});

test('the actual practice producer bundles without filesystem, module or compiler services', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/nine-dragon-stack/generators/practiceProgram.ts'), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u, 'assemblyscript/dist/asc.js'], output: { codeSplitting: false } } } });
  const output = Array.isArray(result) ? result[0] : result;
  if (output === undefined || !('output' in output)) throw new Error('Missing Nine practice source bundle');
  const chunks = output.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports]);
});
