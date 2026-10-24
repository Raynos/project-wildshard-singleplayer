// oxlint-disable-next-line import/no-nodejs-modules -- Fixtures own their complete source, receipts and product cache.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Confine all synthetic products to repository scratch.
import { dirname, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Reproduce the builder's exact recipe namespace.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Prove refusal precedes worker setup in a tiny real Vitest run.
import { execFileSync } from 'node:child_process';
import { afterEach, expect, test } from 'vitest';
import { assertBuiltTestProducts, readBuiltShardfile } from '../scripts/built-product.mjs';
import { captureProductInputs, productInputKey, productToolchainKey, publishProductInputs, recordBundle } from '../scripts/shardfile-inputs.mjs';
import { InputHashMemo } from '../scripts/bake-input-hashes.mjs';
import { shardfileValidationRevision } from '../scripts/shardfile-validation-revision.mjs';
import { pruneShardfileCache } from '../scripts/shardfile-cache.mjs';

const owned: string[] = [];
afterEach(() => { for (const root of owned.splice(0)) rmSync(root, { recursive: true, force: true }); });
function write(root: string, file: string, body: string): void {
  const path = resolve(root, file); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, body);
}
async function fixture(named = false) {
  mkdirSync('tmp', { recursive: true }); const root = mkdtempSync(resolve('tmp/built-product-')); owned.push(root);
  const folder = 'author', name = named ? 'example' : folder, cacheRoot = resolve(root, 'cache');
  for (const file of ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', `src/shards/${folder}/manifest.json`]) write(root, file, '{}');
  const source = `src/shards/${folder}/shard.config.ts`; write(root, source, 'export default {};');
  const flags = ['--copy-runtime'];
  if (named) {
    write(root, `src/shards/${folder}/outputs.json`, JSON.stringify({ outputs: [{ slug: name }] }));
    write(root, `src/shards/${folder}/look/map.${name}.baked.json`, JSON.stringify({ image: `/assets/${name}/map/top.webp`, tilesHash: 'b'.repeat(64) }));
    flags.push(`--map=<root>/public/assets/${name}/map/top.webp`, `--map-tiles-hash=${'b'.repeat(64)}`, `--output=${name}`);
  }
  const memo = new InputHashMemo(root), recipe = [name, ...flags, `${productToolchainKey(root, memo)}:${shardfileValidationRevision(root)}`];
  const receipt = resolve(root, 'receipt.json');
  await captureProductInputs(root, receipt, async () => { readFileSync(resolve(root, source)); recordBundle({ output: [] }); await Promise.resolve(); });
  const key = productInputKey(root, receipt, recipe, memo); if (key === undefined) throw new Error('Missing fixture receipt');
  const receipts = resolve(cacheRoot, '.inputs-v2', name, createHash('sha256').update(JSON.stringify(recipe)).digest('hex'));
  publishProductInputs(receipts, receipt, key);
  const directory = resolve(cacheRoot, name, key); write(directory, '.build-key', key); write(directory, 'shard.json', '{}');
  return { root, name, cacheRoot, directory, key, source, receipt: resolve(receipts, `${key}.json`), options: { cacheRoot, env: {} } };
}

test('local reads require current input bytes and leave product and output bytes untouched', async () => {
  const f = await fixture(), before = statSync(f.directory).mtimeMs;
  expect(readBuiltShardfile(f.root, f.name, f.options)).toBe(f.directory);
  expect(statSync(f.directory).mtimeMs).toBe(before);
  expect(existsSync(resolve(f.root, 'out'))).toBe(false);
  expect(existsSync(resolve(f.root, '.cache'))).toBe(false);
  write(f.root, f.source, 'export default {changed:true};');
  expect(() => readBuiltShardfile(f.root, f.name, f.options)).toThrow(`Missing current product ${f.name}; run: node scripts/build-shardfiles.mjs --reuse --shard=${f.name}`);
  expect(existsSync(resolve(f.root, 'out'))).toBe(false);
});

test('a returned cache path remains readable through this consumer process under eviction pressure', async () => {
  const f = await fixture();
  const directory = readBuiltShardfile(f.root, f.name, f.options);
  const result = pruneShardfileCache(f.cacheRoot, { capBytes: 0 });
  expect(result.locked).toBe(1);
  expect(readFileSync(resolve(directory, 'shard.json'), 'utf8')).toBe('{}');
  expect(existsSync(resolve(f.root, 'out'))).toBe(false);
});

test('a stale local output never shadows the matching immutable cache product', async () => {
  const f = await fixture(), output = resolve(f.root, 'out', f.name);
  write(output, '.build-key', 'f'.repeat(64)); write(output, 'shard.json', '{}');
  expect(readBuiltShardfile(f.root, f.name, f.options)).toBe(f.directory);
  write(output, '.build-key', f.key);
  expect(readBuiltShardfile(f.root, f.name, f.options)).toBe(output);
  rmSync(resolve(output, 'shard.json'));
  expect(readBuiltShardfile(f.root, f.name, f.options)).toBe(f.directory);
});

test('named-output map recipes resolve exactly and shared validation changes invalidate them', async () => {
  const f = await fixture(true);
  expect(readBuiltShardfile(f.root, f.name, f.options)).toBe(f.directory);
  write(f.root, 'src/format/new-law.ts', 'export const law=1;');
  expect(() => readBuiltShardfile(f.root, f.name, f.options)).toThrow('Missing current product');
});

test('CI reads its preceding exact-SHA build; mismatched or malformed stamps do not bless output', async () => {
  const f = await fixture(), output = resolve(f.root, 'out', f.name), sha = 'a'.repeat(40);
  write(output, 'shard.json', '{}'); write(f.root, f.source, 'changed');
  expect(readBuiltShardfile(f.root, f.name, { cacheRoot: f.cacheRoot, env: { WS_TEST_PRODUCTS_SHA: sha, VERCEL_GIT_COMMIT_SHA: sha } })).toBe(output);
  for (const built of ['bad', 'b'.repeat(40)]) expect(() => readBuiltShardfile(f.root, f.name, { cacheRoot: f.cacheRoot, env: { WS_TEST_PRODUCTS_SHA: built, VERCEL_GIT_COMMIT_SHA: sha } })).toThrow('Missing current product');
  expect(() => readBuiltShardfile(f.root, '../escape', f.options)).toThrow('Invalid built product name');
});

test('partial cache entries and corrupt sealed input receipts refuse without building', async () => {
  const f = await fixture(), message = `Missing current product ${f.name}`;
  rmSync(resolve(f.directory, '.build-key'));
  expect(() => readBuiltShardfile(f.root, f.name, f.options)).toThrow(message);
  write(f.directory, '.build-key', f.key);
  const receipt = readFileSync(f.receipt, 'utf8'), corrupt = receipt.replace(/("seal":")[a-f0-9]{64}/u, `$1${'f'.repeat(64)}`);
  expect(corrupt).not.toBe(receipt); writeFileSync(f.receipt, corrupt);
  expect(() => readBuiltShardfile(f.root, f.name, f.options)).toThrow(message);
  expect(existsSync(resolve(f.root, 'out'))).toBe(false);
});

test('selected suites reuse only current products and aggregate missing prerequisites once', async () => {
  const f = await fixture();
  write(f.root, 'scripts/test-products.json', JSON.stringify({
    'test/current.test.ts': [f.name], 'test/other.test.ts': ['other', f.name], 'test/pure.test.ts': [],
  }));
  expect(() => assertBuiltTestProducts(f.root, ['test/current.test.ts', 'test/pure.test.ts'], f.options)).not.toThrow();
  write(f.root, f.source, 'export default {changed:true};');
  expect(() => assertBuiltTestProducts(f.root, ['test/pure.test.ts'], f.options)).not.toThrow();
  expect(() => assertBuiltTestProducts(f.root, ['test/current.test.ts', 'test/other.test.ts'], f.options)).toThrow(
    'Missing current products author, other (no verified product matches current inputs), required by test/current.test.ts, test/other.test.ts; run: node scripts/build-shardfiles.mjs --reuse --shard=author,other',
  );
  expect(existsSync(resolve(f.root, 'out'))).toBe(false);
});

test('product-suite preflight retains exact-SHA CI admission', async () => {
  const f = await fixture(), sha = 'a'.repeat(40);
  write(f.root, 'scripts/test-products.json', JSON.stringify({ 'test/current.test.ts': [f.name] }));
  write(f.root, f.source, 'changed'); write(f.root, `out/${f.name}/shard.json`, '{}');
  expect(() => assertBuiltTestProducts(f.root, ['test/current.test.ts'], { cacheRoot: f.cacheRoot, env: { WS_TEST_PRODUCTS_SHA: sha, VERCEL_GIT_COMMIT_SHA: sha } })).not.toThrow();
  expect(() => assertBuiltTestProducts(f.root, ['test/current.test.ts'], { cacheRoot: f.cacheRoot, env: { WS_TEST_PRODUCTS_SHA: sha, VERCEL_GIT_COMMIT_SHA: 'b'.repeat(40) } })).toThrow('Missing current products');
});

test('real Vitest refuses missing products before loading worker setup or suite code', async () => {
  const f = await fixture();
  write(f.root, 'scripts/test-products.json', JSON.stringify({ 'test/product.test.ts': [f.name] }));
  write(f.root, f.source, 'changed');
  write(f.root, 'test/product.test.ts', "throw new Error('suite must not load');");
  write(f.root, 'test/setup.mjs', "import fs from 'node:fs';fs.writeFileSync('worker-started','yes');");
  write(f.root, 'vitest.config.mts', `import {DurationSequencer} from ${JSON.stringify(resolve('scripts/vitest-shard.ts'))};export default {root:${JSON.stringify(f.root)},test:{include:['test/product.test.ts'],setupFiles:['test/setup.mjs'],sequence:{sequencer:DurationSequencer}}};`);
  expect(() => execFileSync(process.execPath, [resolve('node_modules/vitest/vitest.mjs'), 'run', '--config', resolve(f.root, 'vitest.config.mts')], {
    cwd: f.root, env: { ...process.env, WILDSHARD_SHARDFILE_CACHE: f.cacheRoot, WS_TEST_PRODUCTS_SHA: '', VERCEL_GIT_COMMIT_SHA: '' }, stdio: 'pipe', timeout: 10_000, maxBuffer: 1_048_576,
  })).toThrow('Missing current products author');
  expect(existsSync(resolve(f.root, 'worker-started'))).toBe(false);
});
