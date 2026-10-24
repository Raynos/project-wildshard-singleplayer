// oxlint-disable-next-line import/no-nodejs-modules -- Fixtures own their source and cache directories.
import { mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- All fixture paths are explicitly bounded.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Buffer.slice aliases its source; ownership must still detach.
import { Buffer } from 'node:buffer';
import { afterEach, expect, test } from 'vitest';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { emptyShardfile } from '../src/sdk/author';
import { readProjectAssets } from '../src/sdk/project';
import { runWildshard } from '../scripts/wildshard.mjs';
import { loadHeadlessProduct } from '../src/sdk/headlessProduct';

const owned: string[] = [], encoder = new TextEncoder(), program = 'a'.repeat(64);
function fixture() {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp', 'generation-')); owned.push(root);
  return { root, cache: resolve(root, '.cache'), assets: new Map<string, Uint8Array>() };
}
afterEach(() => { for (const path of owned.splice(0)) rmSync(path, { recursive: true, force: true }); });

test('cold/hit/concurrent steps preserve bytes and isolate callers, inputs and asset ownership', async () => {
  const { root, cache, assets } = fixture(); writeFileSync(resolve(root, 'input.bin'), new Uint8Array([1, 2, 3]));
  const ctx = createProjectGeneration(root, program, assets, cache); let calls = 0;
  const generate = (inputs: ReadonlyMap<string, Uint8Array>) => { calls++; return inputs; };
  const step = { id: 'mesh', inputs: ['input.bin'] };
  const [first, concurrent] = await Promise.all([ctx.cached(step, generate), ctx.cached(step, generate)]);
  expect(calls).toBe(1); expect(first).toEqual(concurrent);
  first.get('input.bin')?.fill(9);
  expect((await ctx.cached(step, generate)).get('input.bin')).toEqual(new Uint8Array([1, 2, 3]));
  const hit = createProjectGeneration(root, program, assets, cache);
  expect(await hit.cached(step, generate)).toEqual(concurrent); expect(calls).toBe(1);
  const bytes = concurrent.get('input.bin'); if (bytes === undefined) throw new Error('Missing fixture bytes');
  const key = ctx.asset(bytes); bytes.fill(7);
  expect(key).toBe(hashImmutableBytes(new Uint8Array([1, 2, 3]))); expect(assets.get(key)).toEqual(new Uint8Array([1, 2, 3]));
  const buffer = Buffer.from([5, 6]), bufferKey = ctx.asset(buffer); buffer.fill(0);
  expect(assets.get(bufferKey)).toEqual(new Uint8Array([5, 6]));
  writeFileSync(resolve(root, 'input.bin'), new Uint8Array([4]));
  await hit.cached(step, generate); expect(calls).toBe(2);
  await createProjectGeneration(root, 'b'.repeat(64), assets, cache).cached(step, generate); expect(calls).toBe(3);
  await hit.cached({ ...step, native: true }, generate); expect(calls).toBe(4);
});

test('escaping/duplicate inputs and corrupt cached bytes refuse before generating again', async () => {
  const { root, cache, assets } = fixture(), outside = fixture(); let calls = 0;
  writeFileSync(resolve(outside.root, 'input'), 'outside'); symlinkSync(resolve(outside.root, 'input'), resolve(root, 'link'));
  const ctx = createProjectGeneration(root, program, assets, cache);
  const generate = () => { calls++; return new Map([['body.bin', new Uint8Array([1])]]); };
  await expect(ctx.cached({ id: 'mesh', inputs: ['link'] }, generate)).rejects.toThrow('escaped');
  await expect(ctx.cached({ id: 'mesh', inputs: ['../input'] }, generate)).rejects.toThrow('file name');
  writeFileSync(resolve(root, 'input'), 'ok');
  await expect(ctx.cached({ id: 'mesh', inputs: ['input', 'input'] }, generate)).rejects.toThrow('Duplicate');
  expect(calls).toBe(0);
  await ctx.cached({ id: 'mesh' }, generate);
  const directory = resolve(cache, root.split('/').at(-1) ?? '', 'mesh');
  const key = readdirSync(directory).find(file => /^[a-f0-9]{64}$/u.test(file));
  if (key === undefined) throw new Error('Missing fixture cache');
  writeFileSync(resolve(directory, key, hashImmutableBytes(new Uint8Array([1]))), new Uint8Array([2]));
  await expect(createProjectGeneration(root, program, assets, cache).cached({ id: 'mesh' }, generate)).rejects.toThrow('byte mismatch');
  expect(calls).toBe(1);
});

test('the project loader executes a build entry and admits its generated asset without source output files', async () => {
  const { root } = fixture(), bytes = new Uint8Array([1, 2, 3]), source = emptyShardfile({ slug: 'generated-fixture', name: 'Generated', author: 'Test', revision: 1, seed: 3 });
  writeFileSync(resolve(root, 'shard.config.ts'), `export default ${JSON.stringify(source)};
  export async function generate(ctx) {
    const files=await ctx.cached({id:'fixture'},()=>new Map([['body.bin',new Uint8Array([1,2,3])]]));
    const bytes=files.get('body.bin'); if(bytes===undefined)throw new Error('Missing fixture bytes');
    const hash=ctx.asset(bytes), source=${JSON.stringify(source)};
    source.files=[{hash,kind:'binary',compressed:3,decoded:3,gpu:0,triangles:0,draws:0,dependencies:[],critical:false}];
    source.library=[hash]; source.budgets.library={resident:3,compressed:3}; return source;
  }`);
  const loaded = await readProjectAssets(root);
  expect(loaded.assets.get(hashImmutableBytes(bytes))).toEqual(bytes);
  expect(readdirSync(root)).toEqual(['shard.config.ts']);
  expect(encoder.encode(JSON.stringify(loaded.shard)).byteLength).toBeGreaterThan(0);
  const output = resolve(root, 'out');
  await runWildshard(['build', root, output, '--product-only', '--no-placeholders', '--format=2']);
  expect((await loadHeadlessProduct(output)).shardfile.identity.slug).toBe('generated-fixture');
});


test('a build function returns its named bytes with its shard and refuses competing output declarations', async () => {
  const { root } = fixture(), source = emptyShardfile({ slug: 'generated-output', name: 'Generated', author: 'Test', revision: 1, seed: 3 });
  const config = `export default async function generate(ctx) {
    const bytes=new Uint8Array([1,2,3]), hash=ctx.asset(bytes);
    return {shard:${JSON.stringify(source)},output:{namedFiles:[{name:'generated/body',path:'blobs/bin/'+hash+'.bin',hash,kind:'bin',compressed:3,decoded:3,gpu:0,triangles:0,draws:0,dependencies:[],critical:false}],assets:new Map([[hash,bytes]])}};
  }`;
  writeFileSync(resolve(root, 'shard.config.ts'), config);
  const loaded = await readProjectAssets(root);
  expect(loaded.output.namedFiles?.map(file => file.name)).toEqual(['generated/body']);
  expect(loaded.assets.get(hashImmutableBytes(new Uint8Array([1, 2, 3])))).toEqual(new Uint8Array([1, 2, 3]));
  expect(readdirSync(root)).toEqual(['shard.config.ts']);
  writeFileSync(resolve(root, 'shard.config.ts'), `${config}\nexport const output = {};`);
  await expect(readProjectAssets(root)).rejects.toThrow('unambiguous');
});
