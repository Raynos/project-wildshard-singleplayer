// oxlint-disable-next-line import/no-nodejs-modules -- Own only the isolated native-input/cache fixture and read the original authored bytes.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve explicit project/cache paths, never an inferred public root.
import { dirname, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare every original native byte without expanding assertion objects.
import { Buffer } from 'node:buffer';
import { expect, test } from 'vitest';
import { build } from 'vite';
import * as v from 'valibot';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { nineNavigation, NINE_NAVIGATION_INPUT } from '../src/shards/nine-dragon-stack/generators/navigationProgram';
import before from './fixtures/nine-navigation.json' with { type: 'json' };

const project = resolve('src/shards/nine-dragon-stack');
function fixture(): string { mkdirSync('tmp', { recursive: true }); return mkdtempSync(resolve('tmp', 'nine-navigation-')); }

test('the original public navigation transport is explicitly owned by the defining shard', () => {
  const manifest = v.parse(v.object({ assetGlobs: v.array(v.string()) }), JSON.parse(readFileSync(resolve(project, 'manifest.json'), 'utf8')));
  expect(manifest.assetGlobs).toContain(`public${before.url}`);
  const bytes = new Uint8Array(readFileSync(resolve('public', before.url.slice(1))));
  expect(bytes.byteLength).toBe(6047);
  expect(hashImmutableBytes(bytes)).toBe(before.navigation.file);
});

test('cold and hit navigation retain every original byte, ordered layer, cost and public URL', async () => {
  const root = fixture(), assets = new Map<string, Uint8Array>();
  try {
    const context = () => createProjectGeneration(project, 'c'.repeat(64), assets, root);
    const cold = await nineNavigation(context()), hit = context();
    expect(await nineNavigation({ ...hit, cached: step => hit.cached(step, () => { throw new Error('A hit must not regenerate'); }) })).toEqual(before);
    expect(cold).toEqual(before);
    expect(assets.size).toBe(1);
    const bytes = assets.get(before.navigation.file), original = readFileSync(resolve(project, NINE_NAVIGATION_INPUT));
    if (bytes === undefined) throw new Error('Missing owned native navigation');
    expect(bytes.byteLength).toBe(6047);
    expect(hashImmutableBytes(bytes)).toBe('2a8083c33ed009f7f1fa122cbec44a2b83e2c457ad8f4dde012736f9e512ea08');
    expect(Buffer.compare(bytes, original)).toBe(0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('every invocation observes changed native input and refuses malformed WSNM instead of a prior hit', async () => {
  const root = fixture(), source = resolve(root, 'project'), input = resolve(source, NINE_NAVIGATION_INPUT);
  mkdirSync(dirname(input), { recursive: true });
  const bytes = new Uint8Array(readFileSync(resolve(project, NINE_NAVIGATION_INPUT)));
  writeFileSync(input, bytes);
  try {
    const context = createProjectGeneration(source, 'd'.repeat(64), new Map(), resolve(root, 'cache'));
    expect(await nineNavigation(context)).toEqual(before);
    bytes[0] = (bytes[0] ?? 0) ^ 1; writeFileSync(input, bytes);
    await expect(nineNavigation(context)).rejects.toThrow();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('missing source, missing cache output and changed asset identity remain refusals', async () => {
  const assets = new Map<string, Uint8Array>(), source = new Uint8Array(readFileSync(resolve(project, NINE_NAVIGATION_INPUT)));
  const asset = (bytes: Uint8Array): string => { const hash = hashImmutableBytes(bytes); assets.set(hash, bytes); return hash; };
  await expect(nineNavigation({ asset, cached: (_step, generate) => Promise.resolve().then(() => generate(new Map())) })).rejects.toThrow('Missing Nine navigation source');
  await expect(nineNavigation({ asset, cached: () => Promise.resolve(new Map()) })).rejects.toThrow('Missing owned Nine navigation');
  await expect(nineNavigation({ asset: () => '0'.repeat(64), cached: () => Promise.resolve(new Map([['navigation.bin', source]])) })).rejects.toThrow('publication differs');
});

test('the source navigation closure bundles without filesystem, decoder services or a scheduler', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/nine-dragon-stack/generators/navigationProgram.ts'), formats: ['es'] } } });
  const built = Array.isArray(result) ? result[0] : result;
  if (built === undefined || !('output' in built)) throw new Error('Missing source navigation bundle');
  const chunks = built.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports]);
});
