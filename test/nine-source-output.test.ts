// oxlint-disable-next-line import/no-nodejs-modules -- The fixture owns and removes only its isolated immutable cache.
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Bind the explicit public native input root used by the CLI.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Native comparison checks every byte without expanding typed arrays into assertion objects.
import { Buffer } from 'node:buffer';
import { afterAll, expect, test } from 'vitest';
import { build } from 'vite';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
import { prepareProjectOutput } from '../src/sdk/projectOutput';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { SCRIPT_V2_REVISIONS } from '../src/format/scriptAdmissionV2';
import { prepareAssetDecoders } from '../src/format/product';
import { NINE_MOVERS_CONTRACT } from '../src/shards/nine-dragon-stack/generators/moversProgram';
import originalWorld from './fixtures/nine-world-files.json' with { type: 'json' };
import { hashImmutableBytes } from '../src/sdk/immutable';
import { nineSourceOutput } from '../src/shards/nine-dragon-stack/generators/sourceOutput';
import before from './fixtures/nine-admitted-output.json' with { type: 'json' };
import { nineOutputReceipt } from './fixtures/nine-output-receipt';
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

// Build the genuinely cold fixture during collection; each correctness case
// keeps the standard 30 s budget for its complete byte/proof assertions.
async function prepareColdOutput() {
  await prepareAssetDecoders();
  mkdirSync('tmp', { recursive: true }); const cache = mkdtempSync(resolve('tmp', 'nine-source-output-'));
  try {
    const project = resolve('src/shards/nine-dragon-stack'), assets = new Map<string, Uint8Array>();
    const context = () => createProjectGeneration(project, 'f'.repeat(64), assets, cache,
      [{ prefix: '/assets/', directory: resolve('public/assets') }]);
    const proofs = { calls: 0 };
    const coldContext = context();
    const cold = await nineSourceOutput({ ...coldContext, proveStaticPortalEntries: (...args) => {
      proofs.calls++; return coldContext.proveStaticPortalEntries(...args);
    } });
    return { project, context, cold, proofs, dispose: () => { rmSync(cache, { recursive: true, force: true }); } };
  } catch (error) { rmSync(cache, { recursive: true, force: true }); throw error; }
}
const fixture = await prepareColdOutput();
afterAll(fixture.dispose);

test('cold source output retains every admitted file byte and contract', async () => {
  expect(fixture.proofs.calls).toBe(1);
  const prepared = await prepareProjectOutput(fixture.project, fixture.cold);
  const originalAssets = new Set(before.assets.map(row => row.name));
  const worldFiles = originalWorld.filter(row => row.path.startsWith('assets/'));
  const actualKeys = new Set([...prepared.assets.keys(), ...prepared.blobs.map(row => row.file.hash)]);
  expect([...actualKeys].sort()).toEqual([...new Set([...originalAssets, ...worldFiles.map(row => row.hash)])].sort());
  // The complete oracle includes binary portal and presentation channels.
  // All other prepared files retain their pinned bytes. The 409
  // world files move from the project reader into owned output and are
  // independently pinned byte-for-byte by nine-world-program's 411 rows.
  for (const row of worldFiles) {
    const owned = prepared.assets.get(row.hash); if (owned === undefined) throw new Error(`Missing owned world ${row.hash}`);
    expect(owned.byteLength).toBe(row.bytes); expect(hashImmutableBytes(owned)).toBe(row.hash);
  }
  expect(nineOutputReceipt(prepared, originalAssets)).toEqual(before);
  expect(NINE_MOVERS_CONTRACT).toMatchObject({ compilerRevision: SCRIPT_V2_REVISIONS.compiler, admissionRevision: SCRIPT_V2_REVISIONS.admission });
});

test('hit source output preserves every byte without regeneration and proves entries afresh', async () => {
  const hitContext = fixture.context();
  const hit = await nineSourceOutput({ ...hitContext, cached: step => hitContext.cached(step, () => { throw new Error('A hit must not regenerate'); }),
    proveStaticPortalEntries: (...args) => { fixture.proofs.calls++; return hitContext.proveStaticPortalEntries(...args); } });
  expect(fixture.proofs.calls).toBe(2);
  sameOutput(hit, fixture.cold);
});

test('source output bundles without a filesystem or compiler service and preserves burst refusals', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/nine-dragon-stack/generators/sourceOutput.ts'), formats: ['es'] }, rolldownOptions: { external: [/^node:/u, 'assemblyscript/dist/asc.js'], output: { codeSplitting: false } } } });
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
