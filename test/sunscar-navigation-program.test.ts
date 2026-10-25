// oxlint-disable-next-line import/no-nodejs-modules -- Read only the authored navigation and own each isolated cache/input fixture.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Bind source inputs and cache paths explicitly.
import { dirname, resolve } from 'node:path';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { signalNavigation, SIGNAL_NAVIGATION_INPUT } from '../src/shards/sunscar-dunes/generators/navigationProgram';

const project = resolve('src/shards/sunscar-dunes'), hash = '9922f620591f1a29bd42ace6bce7829eb54604f977dfb86ae3b18b383b06fbb6';
function scratch(): string { mkdirSync('tmp', { recursive: true }); return mkdtempSync(resolve('tmp', 'signal-navigation-')); }


test('cold and hit navigation preserve all original bytes, ordered layers, costs and public URL', async () => {
  const cache = scratch(), assets = new Map<string, Uint8Array>();
  try {
    const ctx = createProjectGeneration(project, 'e'.repeat(64), assets, cache), cold = await signalNavigation(ctx);
    const original = new Uint8Array(readFileSync(resolve(project, SIGNAL_NAVIGATION_INPUT))), owned = assets.get(hash);
    if (owned === undefined) throw new Error('Missing owned navigation');
    expect(owned.length).toBe(36183); expect(hashImmutableBytes(owned)).toBe(hash);
    expect(owned.every((value, index) => value === original[index])).toBe(true);
    const document = new TextEncoder().encode(`${JSON.stringify({ navigation: cold.navigation, url: cold.url, files: cold.files, critical: cold.critical })}\n`);
    expect(document.length).toBe(2461);
    expect(hashImmutableBytes(document)).toBe('6dfd2294670b4e470defdbb146fe8ad77afc58e54d87cdd261b3be8c66b57e02');
    owned.fill(0);
    const hit = await signalNavigation({ ...ctx, cached: step => ctx.cached(step, () => { throw new Error('A hit must not bake'); }) });
    expect(hit).toEqual(cold); expect(assets.size).toBe(1);
    expect(hashImmutableBytes(assets.get(hash) ?? new Uint8Array())).toBe(hash);
  } finally { rmSync(cache, { recursive: true, force: true }); }
});

test('changed authored bytes are revalidated instead of accepting an earlier hit', async () => {
  const root = scratch(), source = resolve(root, 'source'), path = resolve(source, SIGNAL_NAVIGATION_INPUT);
  mkdirSync(dirname(path), { recursive: true });
  const bytes = new Uint8Array(readFileSync(resolve(project, SIGNAL_NAVIGATION_INPUT))); writeFileSync(path, bytes);
  try {
    const ctx = createProjectGeneration(source, 'f'.repeat(64), new Map(), resolve(root, 'cache'));
    await signalNavigation(ctx); bytes[0] = (bytes[0] ?? 0) ^ 1; writeFileSync(path, bytes);
    await expect(signalNavigation(ctx)).rejects.toThrow();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('missing or extra inputs and cache files, malformed bytes and changed asset hashes refuse', async () => {
  const ctx = createProjectGeneration(project, 'd'.repeat(64), new Map()), bytes = new Uint8Array(readFileSync(resolve(project, SIGNAL_NAVIGATION_INPUT)));
  for (const inputs of [new Map<string, Uint8Array>(), new Map([[SIGNAL_NAVIGATION_INPUT, bytes], ['extra', bytes]])]) {
    await expect(signalNavigation({ ...ctx, cached: (_step, make) => Promise.resolve().then(() => make(inputs)) })).rejects.toThrow('navigation input');
  }
  for (const files of [new Map<string, Uint8Array>(), new Map([['navigation.bin', bytes], ['extra', bytes]])]) {
    await expect(signalNavigation({ ...ctx, cached: () => Promise.resolve(files) })).rejects.toThrow('cache inventory');
  }
  await expect(signalNavigation({ ...ctx, cached: () => Promise.resolve(new Map([['navigation.bin', new Uint8Array()]])) })).rejects.toThrow();
  await expect(signalNavigation({ ...ctx, asset: () => 'wrong', cached: () => Promise.resolve(new Map([['navigation.bin', bytes]])) })).rejects.toThrow('publication differs');
});

test('the defining navigation source bundles as one config-safe author chunk', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/sunscar-dunes/generators/navigationProgram.ts'), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u], output: { codeSplitting: false } } } });
  const output = Array.isArray(result) ? result[0] : result;
  if (output === undefined || !('output' in output)) throw new Error('Missing navigation author bundle');
  const chunks = output.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports]);
});
