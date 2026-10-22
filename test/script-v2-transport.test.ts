import { beforeAll, afterEach, expect, test } from 'vitest';
import * as v from 'valibot';
// oxlint-disable-next-line import/no-nodejs-modules -- Owned temporary product fixtures only.
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep fixtures under the repository scratch directory.
import { resolve } from 'node:path';
import swaySource from '../src/shards/driftwood-isle/behaviour/bridgeSway.as?raw';
import { compileScriptV2 } from '@wildshard/sdk/compileScriptV2';
import { emptyShardfile } from '../src/sdk/author';
import { nameBlob, emitNamedBlobs } from '../src/sdk/blobs';
import { prepareProjectOutput, mergeProjectBlobs } from '../src/sdk/projectOutput';
import { emitPlatformSections } from '../src/sdk/platformSections';
import { writeOutputProduct, validateOutputProduct } from '../src/sdk/outputProduct';
import { scriptAdmissionRows, decisionModuleContracts, ViewModulesSchema } from '../src/format/scriptContract';
import { SCRIPT_V2_REVISIONS } from '../src/format/scriptAdmissionV2';
import { validateShardfileAssets } from '../src/format/assetAdmission';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { readProductDescriptor, admitProduct, type ProductOptions } from '../src/game/shardfile/product';
import { HeadlessSimulation } from '../src/sdk/headless';

let bytes: Uint8Array = new Uint8Array();
const owned: string[] = [];
function directory(): string { mkdirSync('tmp', { recursive: true }); const path = mkdtempSync(resolve('tmp/v2-transport-')); owned.push(path); return path; }
beforeAll(async () => { bytes = await compileScriptV2(swaySource, { lane: 'view', ioBytes: 4096 }); });
afterEach(() => { for (const path of owned.splice(0)) rmSync(path, { recursive: true, force: true }); });
function fixture() {
  const contract = { abi: 2, lane: 'view', pages: 1, ioBytes: 4096, compilerRevision: SCRIPT_V2_REVISIONS.compiler, admissionRevision: SCRIPT_V2_REVISIONS.admission } as const;
  const blob = nameBlob('views/deck.wasm', 'wasm', bytes, { critical: true, script: contract });
  const modules = v.parse(ViewModulesSchema, [{ id: 'fixture.deck', side: 'view', module: blob.file.path, ...contract }]);
  const sections = new Map<string, unknown>([['view/modules', modules]]), platform = emitPlatformSections(new Map([['view/modules', modules]]));
  const source = emptyShardfile({ slug: 'v2-transport', name: 'View transport', author: 'Test', revision: 1, seed: 2 });
  source.budgets.sim.resident = 1_000_000; source.budgets.library.resident = 131072;
  return { blob, contract, modules, sections, platform, ...mergeProjectBlobs(source, new Map(), [blob]) };
}

test('ABI2 named contracts survive reconstruction, disk, browser and native worker validation', async () => {
  const f = fixture(), root = directory(), declarations = scriptAdmissionRows(f.sections);
  const emitted = emitNamedBlobs([f.blob]);
  const prepared = await prepareProjectOutput(root, { platform: f.platform, namedFiles: emitted.files, assets: emitted.assets });
  expect(prepared.blobs[0]?.script).toEqual(f.contract);
  const index = writeOutputProduct(f.shard, f.assets, root, { platform: f.platform, namedFiles: f.namedFiles });
  expect(index.files.find(row => row.hash === f.blob.file.hash)).not.toHaveProperty('script');
  expect(validateOutputProduct(root).assets.get(f.blob.file.hash)).toEqual(bytes);
  const base = 'https://example.test/view/';
  const options: ProductOptions = { base, offline: false, firstParty: false, hash: wire => Promise.resolve(hashImmutableBytes(wire)),
    fetch: url => Promise.resolve(new Response(Uint8Array.from(readFileSync(resolve(root, url.slice(base.length)))))) };
  expect((await admitProduct(await readProductDescriptor(options), options)).assets.get(f.blob.file.hash)).toEqual(bytes);
  expect(() => validateShardfileAssets(f.shard, f.assets, hashImmutableBytes, undefined, undefined, declarations)).not.toThrow();
  const sim = await HeadlessSimulation.create(f.shard, f.assets, undefined, { deadline: 'advisory', sections: f.sections });
  try { expect((await sim.step()).tick).toBe(1); } finally { await sim.dispose(); }
}, 30000);

test('missing, conflicting, wrong-page and understated-memory view declarations refuse without ABI sniffing', async () => {
  const f = fixture(), root = directory(), rows = scriptAdmissionRows(f.sections);
  await expect(prepareProjectOutput(root, { namedFiles: [f.blob.file], assets: f.assets })).rejects.toThrow('Missing instrumentation');
  expect(() => validateShardfileAssets(f.shard, f.assets, hashImmutableBytes)).toThrow('Missing instrumentation');
  const module = f.modules[0]; if (module === undefined) throw new Error('Missing view declaration');
  expect(() => decisionModuleContracts([{ ...module, id: 'wrong', module: `blobs/wasm/${'a'.repeat(64)}.wasm` }], f.shard.files)).toThrow('exact declared');
  const wrong = emitPlatformSections(new Map([['view/modules', [{ ...module, pages: 2 }]]]));
  expect(() => writeOutputProduct(f.shard, f.assets, directory(), { platform: wrong, namedFiles: f.namedFiles })).toThrow('fixed pages');
  expect(() => validateShardfileAssets({ ...f.shard, budgets: { ...f.shard.budgets, library: { ...f.shard.budgets.library, resident: 131071 } } },
    f.assets, hashImmutableBytes, undefined, undefined, rows)).toThrow('client script memory');
});
