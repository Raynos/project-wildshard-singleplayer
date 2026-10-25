// oxlint-disable-next-line import/no-nodejs-modules -- Every file belongs to tiny fixtures under ignored tmp.
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve owned fixture paths.
import { dirname, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Verify environment identity is part of local reuse.
import { env } from 'node:process';
import { afterEach, expect, test } from 'vitest';
import { generationTailCached } from '../scripts/generation-tail-cache.mjs';

const owned: string[] = [];
afterEach(() => { for (const root of owned.splice(0)) rmSync(root, { recursive: true, force: true }); });
const outputs = ['src/shards.generated.ts', 'src/game/shard/slugs.generated.ts', 'src/game/shard/slugs.generated.json',
  'src/game/shard/manifest-closure.generated.json', 'lint/shard-words.generated.json'];
function fixture() {
  const root = mkdtempSync(resolve('tmp/generation-tail-test-'));
  owned.push(root);
  const put = (file: string, bytes: string): void => {
    const path = resolve(root, file); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, bytes);
  };
  put('src/author.ts', 'original');
  put('public/assets/source.bin', 'original asset');
  put('scripts/controller.mjs', 'original controller');
  put('package.json', '{}');
  put('.cache/generation-phase.json', '{"seal":"verified original phase"}');
  for (const file of outputs) mkdirSync(dirname(resolve(root, file)), { recursive: true });
  let calls = 0;
  const run = (): void => { calls++; for (const file of outputs) put(file, `table ${calls}`); };
  return { root, put, run, calls: () => calls };
}

test('reuses only exact local tables and isolates the two shard passes', async () => {
  const f = fixture();
  expect(await generationTailCached(f.root, 'shards-before', f.run)).toBe(false);
  expect(await generationTailCached(f.root, 'shards-before', f.run)).toBe(true);
  expect(f.calls()).toBe(1);
  expect(await generationTailCached(f.root, 'shards-after', f.run)).toBe(false);
  expect(await generationTailCached(f.root, 'shards-after', f.run)).toBe(true);
  // The later writer changed the shared outputs, so the earlier receipt refuses.
  expect(await generationTailCached(f.root, 'shards-before', f.run)).toBe(false);
  expect(f.calls()).toBe(3);
});

test('invalidates missing, same-size poisoned and added output inventories', async () => {
  const f = fixture();
  await generationTailCached(f.root, 'shards-before', f.run);
  const file = resolve(f.root, outputs[0] ?? ''), before = lstatSync(file);
  writeFileSync(file, 'evil  1');
  utimesSync(file, before.atime, before.mtime);
  expect(await generationTailCached(f.root, 'shards-before', f.run)).toBe(false);
  rmSync(file);
  expect(await generationTailCached(f.root, 'shards-before', f.run)).toBe(false);
  f.put('src/shards/fixture/manifest.json', '{}');
  await generationTailCached(f.root, 'shards-before', f.run);
  f.put('src/shards/fixture/discovery.generated.ts', 'new output');
  expect(await generationTailCached(f.root, 'shards-before', f.run)).toBe(false);
  expect(f.calls()).toBe(5);
});

test('binds source, raw assets, negative inventories, phase and environment', async () => {
  const f = fixture();
  await generationTailCached(f.root, 'shards-before', f.run);
  for (const [file, value] of [['src/author.ts', 'changed!'], ['public/assets/source.bin', 'different asset'],
    ['scripts/controller.mjs', 'new controller'], ['src/added.ts', 'new negative input'],
    ['.cache/generation-phase.json', '{"seal":"another verified phase"}']]) {
    if (file === undefined || value === undefined) throw new Error('Missing test input');
    f.put(file, value);
    expect(await generationTailCached(f.root, 'shards-before', f.run)).toBe(false);
    expect(await generationTailCached(f.root, 'shards-before', f.run)).toBe(true);
  }
  const previous = env['WS_TAIL_TEST'];
  try {
    env['WS_TAIL_TEST'] = 'changed';
    expect(await generationTailCached(f.root, 'shards-before', f.run)).toBe(false);
  } finally { if (previous === undefined) delete env['WS_TAIL_TEST']; else env['WS_TAIL_TEST'] = previous; }
  expect(f.calls()).toBe(7);
});

test('refuses moving source and never publishes failed or incomplete producers', async () => {
  const f = fixture();
  await expect(generationTailCached(f.root, 'shards-before', () => {
    f.run(); f.put('src/author.ts', 'changed during writer');
  })).rejects.toThrow('Generation tail inputs changed');
  await expect(generationTailCached(f.root, 'shards-before', () => { throw new Error('actual writer failed'); }))
    .rejects.toThrow('actual writer failed');
  expect(await generationTailCached(f.root, 'shards-before', f.run)).toBe(false);
  const receipt = resolve(f.root, '.cache/generation-tail/shards-before.json');
  writeFileSync(receipt, '{}');
  expect(await generationTailCached(f.root, 'shards-before', f.run)).toBe(false);
  rmSync(resolve(f.root, outputs[0] ?? ''));
  expect(await generationTailCached(f.root, 'shards-before', () => { /* incomplete */ })).toBe(false);
  expect(await generationTailCached(f.root, 'shards-before', f.run)).toBe(false);
  expect(readFileSync(resolve(f.root, outputs[0] ?? ''), 'utf8')).toContain('table');
});

test('runs the defining producer when no independently completed phase exists', async () => {
  const f = fixture();
  rmSync(resolve(f.root, '.cache/generation-phase.json'));
  expect(await generationTailCached(f.root, 'shards-before', f.run)).toBe(false);
  expect(await generationTailCached(f.root, 'shards-before', f.run)).toBe(false);
  expect(f.calls()).toBe(2);
});

test('binds boot packs, transport bytes and the installed binary copies', async () => {
  const f = fixture();
  const module = 'node_modules/@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm';
  for (const file of [module, 'node_modules/three/package.json',
    'node_modules/three/examples/jsm/libs/basis/basis_transcoder.js',
    'node_modules/three/examples/jsm/libs/basis/basis_transcoder.wasm']) f.put(file, 'installed bytes');
  const files = ['src/game/boot/bytes.generated.ts', 'src/game/boot/versions.generated.ts',
    'src/game/boot/audio.generated.ts', 'src/game/boot/packs.generated.ts', 'src/game/shard/art.generated.ts',
    'public/assets/physics/rapier.wasm', 'public/assets/packs/shard.hash.bin', 'public/basis/r186/basis_transcoder.wasm'];
  mkdirSync(resolve(f.root, 'src/game/boot'), { recursive: true });
  let calls = 0;
  const run = (): void => { calls++; for (const file of files) f.put(file, readFileSync(resolve(f.root, module), 'utf8')); };
  expect(await generationTailCached(f.root, 'boot', run)).toBe(false);
  expect(await generationTailCached(f.root, 'boot', run)).toBe(true);
  f.put(module, 'changed installed bytes');
  expect(await generationTailCached(f.root, 'boot', run)).toBe(false);
  rmSync(resolve(f.root, 'public/assets/packs/shard.hash.bin'));
  expect(await generationTailCached(f.root, 'boot', run)).toBe(false);
  expect(calls).toBe(3);
});


test('source table reuse cannot grant authority to a replaced product discovery receipt', async () => {
  const f = fixture();
  f.put('src/shards/fixture/manifest.json', JSON.stringify({ bindings: { navigation: { program: true } } }));
  f.put('out/fixture/validation.json', 'current product receipt');
  const write = (): void => {
    if (readFileSync(resolve(f.root, 'out/fixture/validation.json'), 'utf8') !== 'current product receipt') throw new Error('Product receipt refused');
    f.run();
  };
  for (const step of ['shards-before', 'shards-after'] as const) {
    expect(await generationTailCached(f.root, step, write)).toBe(false);
    expect(await generationTailCached(f.root, step, write)).toBe(false);
  }
  expect(f.calls()).toBe(4);
  // Neither source nor generated tables move; only the out-of-tree authority changes.
  f.put('out/fixture/validation.json', 'invalid receipt');
  await expect(generationTailCached(f.root, 'shards-before', write)).rejects.toThrow('Product receipt refused');
  expect(f.calls()).toBe(4);
});
