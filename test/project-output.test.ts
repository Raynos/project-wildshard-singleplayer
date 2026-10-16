import { afterEach, expect, test } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- The fixture owns a bounded author project and its output.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- All fixture paths are inside its scratch directory.
import { resolve } from 'node:path';
import { emptyShardfile } from '../src/sdk/author';
import { nameBlob } from '../src/sdk/blobs';
import { mergeProjectBlobs, prepareProjectOutput, projectMirrors } from '../src/sdk/projectOutput';
import { readProjectAssets, buildProject } from '../src/sdk/project';
import { validateOutputProduct } from '../src/sdk/outputProduct';
import { compileScript } from '../src/sdk/compileScript';

const directories: string[] = [];
function directory(): string {
  mkdirSync('tmp', { recursive: true });
  const path = mkdtempSync(resolve('tmp', 'project-output-')); directories.push(path); return path;
}
const source = () => emptyShardfile({ slug: 'output-test', name: 'Output', author: 'Test', revision: 1, seed: 3 });
const binary = new Uint8Array([1, 2, 3]);
afterEach(() => { for (const path of directories.splice(0)) rmSync(path, { recursive: true }); });

test('blob admission charges new content once, preserves conservative declarations/names and owns bytes', () => {
  const blob = nameBlob('models/body.bin', 'bin', binary, { decoded: 100, gpu: 100 });
  const original = source(), first = mergeProjectBlobs(original, new Map(), [blob, blob]);
  expect(original.files).toEqual([]);
  expect(first.shard.library).toEqual([blob.file.hash]);
  expect(first.shard.budgets.library).toMatchObject({ compressed: binary.length, resident: 200 });
  const second = mergeProjectBlobs(first.shard, first.assets, [nameBlob('alias.bin', 'bin', binary)], first.namedFiles);
  expect(second.shard).toEqual(first.shard); expect(second.namedFiles).toEqual(first.namedFiles);
  blob.bytes.fill(0); expect(first.assets.get(blob.file.hash)).toEqual(binary);
  expect(() => mergeProjectBlobs(first.shard, first.assets, [nameBlob('models/body.bin', 'bin', new Uint8Array([4]))], first.namedFiles)).toThrow('conflicting content');
  expect(() => mergeProjectBlobs(first.shard, new Map([[blob.file.hash, new Uint8Array([4])]]), [nameBlob('alias.bin', 'bin', binary)])).toThrow('asset bytes');
  const changedKind = source(); changedKind.files = first.shard.files.map(row => ({ ...row, kind: 'wasm' }));
  changedKind.library = first.shard.library; changedKind.budgets = first.shard.budgets;
  expect(() => mergeProjectBlobs(changedKind, first.assets, [nameBlob('body.bin', 'bin', binary)])).toThrow('kind');
});

test('config output carries custom/platform sections, source and in-memory Wasm blobs through disk validation', async () => {
  const path = directory(), destination = resolve(path, 'out');
  const wasm = await compileScript(`
export function abi_version(): i32 { return 0; }
export function init(lo: i32, hi: i32): void {}
export function in_ptr(): i32 { return 16384; }
export function in_cap(): i32 { return 4096; }
export function out_ptr(): i32 { return 24576; }
export function out_cap(): i32 { return 32; }
export function out_count(): i32 { return 0; }
export function on_tick(): void {}
`);
  writeFileSync(resolve(path, 'body.bin'), binary);
  writeFileSync(resolve(path, 'bake.json'), JSON.stringify({ places: [[1, 2, 3]] }));
  writeFileSync(resolve(path, 'quest.wasm'), wasm);
  writeFileSync(resolve(path, 'shard.config.ts'), `
import * as v from 'valibot';
import { defineSection, emitDefinedSections } from '@wildshard/sdk/sections';
import { emitPlatformSections } from '@wildshard/sdk/platformSections';
import { nameBlob, emitNamedBlobs } from '@wildshard/sdk/blobs';
export default ${JSON.stringify(source())};
const named = emitNamedBlobs([nameBlob('behaviour/quest.wasm', 'wasm', new Uint8Array(${JSON.stringify([...wasm])}), { script: { abi: 0 } })]);
export const output = {
 blobs: [{ name: 'models/body.bin', kind: 'bin', source: 'body.bin' },
         { name: 'world/bake.json', kind: 'json', source: 'bake.json' },
         { name: 'behaviour/quest.wasm', kind: 'wasm', source: 'quest.wasm', options: { script: { abi: 0 } } }],
 namedFiles: named.files, assets: named.assets,
 custom: emitDefinedSections([defineSection('custom/reward', v.strictObject({ amount: v.number() }), { amount: 3 })]),
 platform: emitPlatformSections(new Map([['ui/strings', { hello: 'Hello' }]]))
};
export const mirrors = [{ name: 'REWARD', value: { amount: 3 } }];
`);
  const loaded = await readProjectAssets(path);
  expect(loaded.mirrors).toEqual([{ name: 'REWARD', value: { amount: 3 } }]);
  expect(loaded.output.namedFiles?.map(row => row.name)).toEqual(['models/body.bin', 'world/bake.json', 'behaviour/quest.wasm']);
  await buildProject(path, destination, { client: null });
  const checked = validateOutputProduct(destination);
  expect(checked.index.formatVersion).toBe(2);
  const bake = checked.index.files.find(row => row.name === 'world/bake.json');
  expect(bake?.kind).toBe('json');
  if (bake === undefined) throw new Error('Missing named JSON bake');
  expect(JSON.parse(readFileSync(resolve(destination, bake.path), 'utf8'))).toEqual({ places: [[1, 2, 3]] });
  expect(checked.index.files.find(row => row.name === 'behaviour/quest.wasm')?.kind).toBe('wasm');
  expect(checked.index.sections.map(row => row.name)).toEqual(expect.arrayContaining(['custom/reward', 'ui/strings']));
  expect(readFileSync(resolve(destination, 'sections/ui/strings.json'), 'utf8')).toContain('Hello');
});

test('output declarations refuse unknown policy fields, escapes, changed hashes and invalid mirrors', async () => {
  const parent = directory(), path = resolve(parent, 'project'); mkdirSync(path);
  writeFileSync(resolve(parent, 'escape.bin'), binary);
  await expect(prepareProjectOutput(path, { runtime: {} })).rejects.toThrow();
  await expect(prepareProjectOutput(path, { blobs: [{ name: 'escape.bin', kind: 'bin', source: '../escape.bin' }] })).rejects.toThrow('escapes');
  await expect(prepareProjectOutput(path, { assets: new Map([['bad-hash', binary]]) })).rejects.toThrow('hash');
  await expect(prepareProjectOutput(path, { blobs: [{ name: 'x.bin', kind: 'bin', source: 'x.bin', options: { decoded: -1 } }] })).rejects.toThrow();
  expect(() => projectMirrors([{ name: 'x', value: 1 }, { name: 'x', value: 1 }])).toThrow('Duplicate');
  expect(() => projectMirrors([{ name: 'constructor.x', value: 1 }])).toThrow();
  expect(() => projectMirrors([{ name: 'x', value: () => 1 }])).toThrow('JSON');
});
