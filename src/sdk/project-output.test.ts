import { afterEach, expect, test } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Observe exact immutable keys for the owned build fixture only.
import { channel } from 'node:diagnostics_channel';
// oxlint-disable-next-line import/no-nodejs-modules -- The fixture owns a bounded author project and its output.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- All fixture paths are inside its scratch directory.
import { resolve } from 'node:path';
import { emptyShardfile } from './author';
import { nameBlob } from './blobs';
import { mergeProjectBlobs, prepareProjectOutput, projectMirrors } from './projectOutput';
import { readProjectAssets, buildProject } from './project';
import { validateOutputProduct, writeOutputProduct } from './outputProduct';
import { compileScript } from '@wildshard/sdk/compileScript';
import { encodeCanonicalJson } from './immutable';
import { loadHeadlessProduct } from './headlessProduct';

const directories: string[] = [];
function directory(): string {
  mkdirSync('tmp', { recursive: true });
  const path = mkdtempSync(resolve('tmp', 'project-output-')); directories.push(path); return path;
}
const source = () => emptyShardfile({ slug: 'output-test', name: 'Output', author: 'Test', revision: 1, seed: 3 });
const binary = new Uint8Array([1, 2, 3]);
afterEach(() => { for (const path of directories.splice(0)) rmSync(path, { recursive: true }); });

test('named JSON schemas survive merging and run during disk and runtime validation', async () => {
  const jsonSchema = { $schema: 'http://json-schema.org/draft-07/schema#', type: 'object', properties: { n: { type: 'number' } }, required: ['n'], additionalProperties: false };
  const blob = nameBlob('data/checked.json', 'json', new TextEncoder().encode('{"n":1}'), { jsonSchema });
  const merged = mergeProjectBlobs(source(), new Map(), [blob]);
  const path = directory();
  const index = writeOutputProduct(merged.shard, merged.assets, path, { namedFiles: merged.namedFiles });
  expect(index.files[0]?.jsonSchema).toEqual(jsonSchema);
  expect(validateOutputProduct(path).shard).toEqual(merged.shard);
  expect(await (await loadHeadlessProduct(path)).json<{ n: number }>('data/checked.json')).toEqual({ n: 1 });
  const file = index.files[0];
  if (file === undefined) throw new Error('Missing named JSON');
  file.jsonSchema = { ...jsonSchema, properties: { n: { type: 'string' } } };
  writeFileSync(resolve(path, 'shard.json'), encodeCanonicalJson(index));
  expect(() => validateOutputProduct(path)).toThrow('refuses its schema');
  await expect((await loadHeadlessProduct(path)).json('data/checked.json')).rejects.toThrow('refuses its schema');
});

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


test('author config and output sidecars inline reachable lazy helpers into their one-module execution', async () => {
  const path = directory(); mkdirSync(resolve(path, 'generators'));
  writeFileSync(resolve(path, 'rows.ts'), `export default ${JSON.stringify(source())};`);
  writeFileSync(resolve(path, 'shard.config.ts'), 'export default async () => (await import("./rows")).default;');
  writeFileSync(resolve(path, 'generators/strings.ts'), 'export const messages = { lazy: "original helper" };');
  writeFileSync(resolve(path, 'generators/output.ts'), `
import { emitPlatformSections } from '@wildshard/sdk/platformSections';
const {messages} = await import('./strings');
export const output = {platform:emitPlatformSections(new Map([['ui/strings',messages]]))};
`);
  const loaded = await readProjectAssets(path);
  expect(loaded.shard.identity).toEqual(source().identity);
  expect(loaded.output.platform?.sections.map(row => row.name)).toEqual(['ui/strings']);
  const bytes = loaded.output.platform?.files.get('sections/ui/strings.json');
  expect(bytes).toBeDefined();
  expect(JSON.parse(new TextDecoder().decode(bytes))).toEqual({lazy:'original helper'});
});

test('inlining lazy author helpers retains the executable filesystem dependency refusal', async () => {
  const path = directory();
  writeFileSync(resolve(path, 'shard.config.ts'), `export default async () => {
    await import('node:fs/promises'); return ${JSON.stringify(source())};
  };`);
  await expect(readProjectAssets(path)).rejects.toThrow('must use injected build capabilities for file access');
});

test('output preparation receives bounded cached inputs and admits detached binary output', async () => {
  const path = directory(); mkdirSync(resolve(path, 'generators'));
  writeFileSync(resolve(path, 'shard.config.ts'), `export default ${JSON.stringify(source())};`);
  writeFileSync(resolve(path, 'input.bin'), binary);
  writeFileSync(resolve(path, 'generators/output.ts'), `
import { nameBlob } from '@wildshard/sdk/blobs';
export const output = {};
export async function prepareOutput(ctx) {
  const files = await ctx.cached({id:'named-input',inputs:['input.bin']}, inputs => new Map([['body.bin',inputs.get('input.bin')]]));
  const blob = nameBlob('models/body.bin','bin',files.get('body.bin'));
  return {namedFiles:[blob.file],assets:new Map([[blob.file.hash,blob.bytes]])};
}`);
  const first = await readProjectAssets(path), second = await readProjectAssets(path);
  const file = first.output.namedFiles?.find(row => row.name === 'models/body.bin');
  if (file === undefined) throw new Error('Missing prepared blob');
  expect(first.assets.get(file.hash)).toEqual(binary);
  first.assets.get(file.hash)?.fill(0);
  expect(second.assets.get(file.hash)).toEqual(binary);
  writeFileSync(resolve(path, 'input.bin'), new Uint8Array([4, 5, 6]));
  const changed = await readProjectAssets(path);
  expect(changed.output.namedFiles?.[0]?.hash).not.toBe(file.hash);
  const nextSource = readFileSync(resolve(path, 'generators/output.ts'), 'utf8')
    .replace("inputs.get('input.bin')", 'new Uint8Array([7,8,9])');
  writeFileSync(resolve(path, 'generators/output.ts'), nextSource);
  const revised = await readProjectAssets(path), nextFile = revised.output.namedFiles?.[0];
  if (nextFile === undefined) throw new Error('Missing revised blob');
  expect(revised.assets.get(nextFile.hash)).toEqual(new Uint8Array([7, 8, 9]));
});

test('an output sidecar may prepare the project map lattice, published as its named image', async () => {
  const path = directory(); mkdirSync(resolve(path, 'generators'));
  writeFileSync(resolve(path, 'shard.config.ts'), `export default ${JSON.stringify(source())};`);
  writeFileSync(resolve(path, 'generators/output.ts'), `
export const output = {};
export async function prepareMap() { const pixels = new Uint8Array(1000 * 1000 * 4); pixels.fill(200); return { pixels, name: 'ui/images/map' }; }`);
  const made = await readProjectAssets(path), image = made.shard.map?.image;
  if (image === undefined) throw new Error('Missing prepared map');
  expect(made.shard.map?.tilesHash).toMatch(/^[a-f0-9]{64}$/u);
  expect(made.assets.get(image)?.byteLength).toBeGreaterThan(0);
});

test('map preparation refuses a non-function and a second map producer', async () => {
  const path = directory(); mkdirSync(resolve(path, 'generators'));
  writeFileSync(resolve(path, 'shard.config.ts'), `export default ${JSON.stringify(source())};`);
  writeFileSync(resolve(path, 'generators/output.ts'), 'export const output={}; export const prepareMap=42;');
  await expect(readProjectAssets(path)).rejects.toThrow('Map preparation must be a build function');
  writeFileSync(resolve(path, 'generators/output.ts'), 'export const output={}; export function prepareMap(){return {pixels:new Uint8Array(3)};}');
  await expect(readProjectAssets(path)).rejects.toThrow('Invalid generated map lattice');
});

test('output preparation retains function, filesystem and output admission refusals', async () => {
  const path = directory(); mkdirSync(resolve(path, 'generators'));
  writeFileSync(resolve(path, 'shard.config.ts'), `export default ${JSON.stringify(source())};`);
  const sidecar = resolve(path, 'generators/output.ts');
  writeFileSync(sidecar, 'export const output={}; export const prepareOutput=42;');
  await expect(readProjectAssets(path)).rejects.toThrow('build function');
  writeFileSync(sidecar, 'export const output={}; export function prepareOutput(){return {runtime:{}};}');
  await expect(readProjectAssets(path)).rejects.toThrow();
  writeFileSync(sidecar, `import {readFileSync} from 'node:fs';
    export const output={}; export function prepareOutput(){return readFileSync('input.bin');}`);
  await expect(readProjectAssets(path)).rejects.toThrow('must use injected build capabilities');
});

test('source entry and sidecar share one immutable construction and invalidate both recipes', async () => {
  const path = directory(); mkdirSync(resolve(path, 'generators'));
  writeFileSync(resolve(path, 'input.bin'), binary);
  writeFileSync(resolve(path, 'shard.config.ts'), `export default async ctx => {
    const files=await ctx.cached({id:'shared-body',inputs:['input.bin']}, inputs=>new Map([['body.bin',inputs.get('input.bin')]]));
    const row=${JSON.stringify(source())}; row.identity.name='owned-'+files.get('body.bin')[0]; return row;
  };`);
  const sidecar = resolve(path, 'generators/output.ts');
  writeFileSync(sidecar, `import {nameBlob} from '@wildshard/sdk/blobs';
    export const output={};
    export async function prepareOutput(ctx){
      const files=await ctx.cached({id:'shared-body',inputs:['input.bin']},()=>{throw new Error('Duplicate source construction');});
      const blob=nameBlob('body.bin','bin',files.get('body.bin'));
      return {namedFiles:[blob.file],assets:new Map([[blob.file.hash,blob.bytes]])};
    }`);
  const keys: string[] = [], observer = channel('wildshard.generation-key');
  const observe = (value: unknown): void => {
    if (typeof value === 'object' && value !== null && 'key' in value && typeof value.key === 'string') keys.push(value.key);
  };
  observer.subscribe(observe);
  try {
  const first = await readProjectAssets(path), file = first.output.namedFiles?.[0];
  if (file === undefined) throw new Error('Missing shared source output');
  expect(first.shard.identity.name).toBe('owned-1');
  expect(first.assets.get(file.hash)).toEqual(binary);
  first.assets.get(file.hash)?.fill(0);
  const warm = await readProjectAssets(path);
  expect(warm.assets.get(file.hash)).toEqual(binary);
  writeFileSync(resolve(path, 'input.bin'), new Uint8Array([4, 5, 6]));
  const changed = await readProjectAssets(path);
  expect(changed.shard.identity.name).toBe('owned-4');
  expect(changed.output.namedFiles?.[0]?.hash).not.toBe(file.hash);
  writeFileSync(sidecar, readFileSync(sidecar, 'utf8').replace("'body.bin','bin'", "'revised.bin','bin'"));
  const revised = await readProjectAssets(path);
  expect(revised.output.namedFiles?.[0]?.name).toBe('revised.bin');
  expect(revised.shard.identity.name).toBe('owned-4');
  expect(keys).toHaveLength(8);
  expect(keys[0]).toBe(keys[1]); expect(keys[0]).toBe(keys[2]); expect(keys[2]).toBe(keys[3]);
  expect(keys[4]).toBe(keys[5]); expect(keys[4]).not.toBe(keys[0]);
  expect(keys[6]).toBe(keys[7]); expect(keys[6]).not.toBe(keys[4]);
  } finally { observer.unsubscribe(observe); }
});


test('sidecar discovery uses fresh bounded inputs and rejects executable values', async () => {
  const path = directory(); mkdirSync(resolve(path, 'generators'));
  writeFileSync(resolve(path, 'shard.config.ts'), `export default ${JSON.stringify(source())};`);
  writeFileSync(resolve(path, 'seed.bin'), new Uint8Array([7]));
  const program = `export const output = {};
export async function prepareDiscovery(ctx) {
  const files = await ctx.cached({id:'discovery-seed',inputs:['seed.bin']}, bytes => new Map([['seed',bytes.get('seed.bin')]]));
  return {'ground.rows':{seed:files.get('seed')[0]}};
}`;
  writeFileSync(resolve(path, 'generators/output.ts'), program);
  const first = await readProjectAssets(path);
  expect(first.output.discovery).toEqual({'ground.rows':{seed:7}});
  writeFileSync(resolve(path, 'seed.bin'), new Uint8Array([9]));
  expect((await readProjectAssets(path)).output.discovery).toEqual({'ground.rows':{seed:9}});
  expect(first.output.discovery).toEqual({'ground.rows':{seed:7}});
  writeFileSync(resolve(path, 'generators/output.ts'), program.replace("{seed:files.get('seed')[0]}", '() => 7'));
  await expect(readProjectAssets(path)).rejects.toThrow('Discovery values must be plain bounded JSON');
});
