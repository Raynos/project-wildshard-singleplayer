// oxlint-disable-next-line import/no-nodejs-modules -- The fixture owns and removes only its isolated immutable cache.
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Bind the explicit public native input root used by the CLI.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Native comparison checks every byte without expanding typed arrays into assertion objects.
import { Buffer } from 'node:buffer';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
import { prepareProjectOutput, type PreparedProjectOutput } from '../src/sdk/projectOutput';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { SCRIPT_V2_REVISIONS } from '../src/format/scriptAdmissionV2';
import { prepareAssetDecoders } from '../src/format/product';
import { NINE_MOVERS_CONTRACT } from '../src/shards/nine-dragon-stack/generators/moversProgram';
import { nineSourceOutput } from '../src/shards/nine-dragon-stack/generators/sourceOutput';
import { output } from '../src/shards/nine-dragon-stack/generators/output';
import { parseBurstFields } from '../src/shards/nine-dragon-stack/generators/sections';
import type { NineOutput } from '../src/shards/nine-dragon-stack/generators/productOutput';
import bursts from '../src/shards/nine-dragon-stack/data/burstFields.json' with { type: 'json' };

function sameBytes(actual: Uint8Array, expected: Uint8Array, name: string): void {
  expect(actual.byteLength, name).toBe(expected.byteLength);
  expect(Buffer.compare(actual, expected), name).toBe(0);
}

function sameFiles(actual: ReadonlyMap<string, Uint8Array>, expected: ReadonlyMap<string, Uint8Array>): void {
  expect([...actual.keys()].sort()).toEqual([...expected.keys()].sort());
  for (const [name, bytes] of actual) {
    const original = expected.get(name); if (original === undefined) throw new Error(`Missing original ${name}`);
    sameBytes(bytes, original, name);
  }
}

function sameOutput(actual: NineOutput, expected: NineOutput): void {
  expect(actual.blobs).toEqual(expected.blobs); expect(actual.namedFiles).toEqual(expected.namedFiles);
  expect(actual.platform.sections).toEqual(expected.platform.sections);
  sameFiles(actual.platform.files, expected.platform.files); sameFiles(actual.assets, expected.assets);
}

function samePrepared(actual: PreparedProjectOutput, expected: PreparedProjectOutput): void {
  const rows = (value: PreparedProjectOutput) => [...value.blobs].sort((a, b) => a.file.path.localeCompare(b.file.path));
  const blobs = rows(actual), originals = rows(expected);
  expect(blobs.map(({ file, script }) => ({ file, script }))).toEqual(originals.map(({ file, script }) => ({ file, script })));
  for (const [index, blob] of blobs.entries()) {
    const original = originals[index]; if (original === undefined) throw new Error('Missing original blob');
    sameBytes(blob.bytes, original.bytes, blob.file.path);
  }
  expect(actual.options.namedFiles).toEqual(expected.options.namedFiles);
  expect(actual.options.platform?.sections).toEqual(expected.options.platform?.sections);
  expect(actual.options.custom?.sections).toEqual(expected.options.custom?.sections);
  sameFiles(actual.options.platform?.files ?? new Map(), expected.options.platform?.files ?? new Map());
  sameFiles(actual.options.custom?.files ?? new Map(), expected.options.custom?.files ?? new Map());
  const physical = (value: PreparedProjectOutput) => new Map([...value.assets, ...value.blobs.map(row => [row.file.hash, row.bytes] as const)]);
  sameFiles(physical(actual), physical(expected));
}

test('cold and hit source output retain every original admitted file byte and contract with fresh proofs', async () => {
  await prepareAssetDecoders();
  mkdirSync('tmp', { recursive: true }); const cache = mkdtempSync(resolve('tmp', 'nine-source-output-'));
  try {
    const project = resolve('src/shards/nine-dragon-stack'), assets = new Map<string, Uint8Array>();
    const context = () => createProjectGeneration(project, 'f'.repeat(64), assets, cache,
      [{ prefix: '/assets/', directory: resolve('public/assets') }]);
    let proofs = 0;
    const coldContext = context(), hitContext = context();
    const cold = await nineSourceOutput({ ...coldContext, proveStaticPortalEntries: (...args) => {
      proofs++; return coldContext.proveStaticPortalEntries(...args);
    } });
    const hit = await nineSourceOutput({ ...hitContext, cached: step => hitContext.cached(step, () => { throw new Error('A hit must not regenerate'); }),
      proveStaticPortalEntries: (...args) => { proofs++; return hitContext.proveStaticPortalEntries(...args); } });
    expect(proofs).toBe(2);
    sameOutput(hit, cold);
    const expected = await prepareProjectOutput(project, output);
    samePrepared(await prepareProjectOutput(project, cold), expected);
    expect(NINE_MOVERS_CONTRACT).toMatchObject({ compilerRevision: SCRIPT_V2_REVISIONS.compiler, admissionRevision: SCRIPT_V2_REVISIONS.admission });
  } finally { rmSync(cache, { recursive: true, force: true }); }
});

test('source output bundles without a filesystem or compiler service and preserves burst refusals', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/nine-dragon-stack/generators/sourceOutput.ts'), formats: ['es'] } } });
  const built = Array.isArray(result) ? result[0] : result;
  if (built === undefined || !('output' in built)) throw new Error('Missing Nine source output bundle');
  const chunks = built.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports]);
  expect(parseBurstFields(bursts)).toEqual(bursts);
  expect(() => parseBurstFields({ ...bursts, muzzle: { ...bursts.muzzle, count: 25 } })).toThrow();
  expect(() => parseBurstFields({ ...bursts, bite: { ...bursts.bite, life: 0 } })).toThrow();
  expect(() => parseBurstFields({ ...bursts, dock: { ...bursts.dock, shape: 'unknown' } })).toThrow();
  expect(() => parseBurstFields({ ...bursts, extra: bursts.sparks })).toThrow();
});
