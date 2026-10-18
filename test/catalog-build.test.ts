// oxlint-disable-next-line import/no-nodejs-modules -- The build fixture owns its tiny project/output tree.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve files only beneath the owned fixture root.
import { basename, dirname, resolve } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { build as viteBuild } from 'vite';
import { emptyShardfile } from '@wildshard/sdk/author';
import { runCli } from '../src/sdk/cli';
import { writeOutputProduct } from '@wildshard/sdk/outputProduct';
import { writeRuntimeFiles } from '@wildshard/sdk/outputRuntime';
import { mergeProjectBlobs } from '@wildshard/sdk/projectOutput';
import { manifestImages, packManifestImages } from '@wildshard/sdk/projectManifest';
import { parseShardCatalog, runtimeInventoryBytes } from '@wildshard/format/shardCatalog';
import { parseManifestMetadata } from '@wildshard/format/minimap';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { buildShardfiles } from '../scripts/build-shardfiles.mjs';
import { mapPixelHash, mapTilesHash } from '../scripts/map-hash.mjs';
import { outputProductsPlugin } from '../vite/outputProducts';
import metadata from '../src/shards/far-reach/manifest.json';

const owned: string[] = [], png = Uint8Array.from(readFileSync('test/fixtures/world-source/image.png'));
afterEach(() => { vi.unstubAllEnvs(); for (const folder of owned.splice(0)) rmSync(folder, { recursive: true, force: true }); });
function put(root: string, path: string, bytes: string | Uint8Array): void {
  const target = resolve(root, path); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, bytes);
}
async function fixture(): Promise<string> {
  mkdirSync('tmp', { recursive: true }); const root = mkdtempSync(resolve('tmp/catalog-build-')); owned.push(root);
  const placements = [];
  for (const [order, slug] of ['alpha', 'beta'].entries()) {
    const project = resolve(root, 'src/shards', slug), image = `public/assets/${slug}/map/top.webp`;
    put(project, 'shard.config.ts', 'export default {};\n');
    put(project, 'runtime/index.ts', `// ${slug} client\nexport const client = '${slug}';\n`);
    put(root, image, png);
    put(project, 'look/map.baked.json', JSON.stringify({ image: `/assets/${slug}/map/top.webp`, tilesHash: mapTilesHash(project), pixelHash: await mapPixelHash(resolve(root, image)) }));
    placements.push({ slug, instance: slug, cell: [order, 0], size: [500, 500, 500] });
  }
  put(root, 'src/game/grid/singleplayer.json', JSON.stringify({ version: 0, placements })); return root;
}
function builder(calls: string[][], fail?: string): (args: string[]) => Promise<void> {
  return async args => {
    calls.push([...args]); const [command, project, destination] = args;
    if (command === 'catalog') { await runCli(args); return; }
    if (command !== 'build' || project === undefined || destination === undefined) throw new Error('Unexpected fixture build');
    const slug = basename(project); if (slug === fail) throw new Error('Fixture build refused');
    const authored = parseManifestMetadata({ ...metadata, slug, name: slug, order: slug === 'alpha' ? 1 : 2 }, slug);
    const packed = packManifestImages(slug, authored, new Map(manifestImages(authored).map(row => [row.url, png])));
    const source = emptyShardfile({ slug, name: slug, author: 'Test', revision: 1, seed: 1 });
    const merged = mergeProjectBlobs({ ...source, manifest: packed.manifest, runtime: { entry: 'runtime/index.ts' } }, new Map(), packed.blobs);
    const runtime = args.includes('--copy-runtime') ? writeRuntimeFiles(project, destination, { check: () => [] }) : undefined;
    writeOutputProduct(merged.shard, merged.assets, destination, { namedFiles: merged.namedFiles, ...(runtime === undefined ? {} : { runtime }) });
  };
}
it('builds both copied runtimes before one complete output-only catalog and publishes it with the app', async () => {
  const root = await fixture(), calls: string[][] = [];
  expect(await buildShardfiles(root, { strict: true, catalog: true, build: builder(calls) })).toBe(2);
  expect(calls.map(call => call[0])).toEqual(['build', 'build', 'catalog']);
  expect(calls.slice(0, 2).every(call => call.includes('--copy-runtime'))).toBe(true);
  const output = resolve(root, 'out'), catalog = parseShardCatalog(JSON.parse(readFileSync(resolve(output, 'catalog.json'), 'utf8')));
  expect(catalog.shards.map(row => row.slug)).toEqual(['alpha', 'beta']);
  for (const entry of catalog.shards) {
    const source = readFileSync(resolve(root, 'src/shards', entry.slug, 'runtime/index.ts'));
    expect(readFileSync(resolve(output, entry.slug, 'runtime/index.ts'))).toEqual(source);
    expect(entry.index.hash).toBe(hashImmutableBytes(Uint8Array.from(readFileSync(resolve(output, entry.index.path)))));
    expect(typeof entry.runtime === 'object' ? entry.runtime?.filesHash : undefined).toBe(hashImmutableBytes(runtimeInventoryBytes([{ path: 'runtime/index.ts', hash: hashImmutableBytes(Uint8Array.from(source)), bytes: source.length, lines: 1 }])));
  }
  expect(readdirSync(output).sort()).toEqual(['alpha', 'beta', 'catalog-report.json', 'catalog.json']);
  put(root, 'main.js', 'export const ready = true;\n');
  put(output, 'alpha/.build-key', 'not shipped');
  await viteBuild({ root, configFile: false, publicDir: false, logLevel: 'silent', plugins: [outputProductsPlugin()], build: {
    outDir: resolve(root, 'dist'), lib: { entry: resolve(root, 'main.js'), formats: ['es'], fileName: 'app' },
  } });
  const shipped = resolve(root, 'dist/shardfiles');
  expect(readFileSync(resolve(shipped, 'catalog.json'))).toEqual(readFileSync(resolve(output, 'catalog.json')));
  for (const slug of ['alpha', 'beta']) {
    expect(existsSync(resolve(shipped, slug, 'shard.json'))).toBe(true);
    expect(existsSync(resolve(shipped, slug, 'runtime'))).toBe(false);
    expect(existsSync(resolve(shipped, slug, '.build-key'))).toBe(false);
  }
});
it('keeps the previous catalog on a failed full pass and never publishes one from --shard', async () => {
  const root = await fixture(), calls: string[][] = [], options = { strict: true, catalog: true, build: builder(calls) };
  await buildShardfiles(root, options);
  const path = resolve(root, 'out/catalog.json'), previous = readFileSync(path);
  calls.length = 0;
  await expect(buildShardfiles(root, { ...options, build: builder(calls, 'beta') })).rejects.toThrow('Fixture build refused');
  expect(calls.some(call => call[0] === 'catalog')).toBe(false);
  expect(readFileSync(path)).toEqual(previous);
  await expect(buildShardfiles(root, { ...options, only: ['alpha'] })).rejects.toThrow('requires every project');
  vi.stubEnv('WILDSHARD_SHARDFILE_CACHE', resolve(root, 'tmp/cache'));
  calls.length = 0;
  await buildShardfiles(root, { strict: false, only: ['alpha'], copyRuntime: true, build: builder(calls) });
  expect(calls).toHaveLength(1);
  expect(calls[0]).toContain('--copy-runtime');
  expect(existsSync(resolve(root, 'out/alpha/runtime/index.ts'))).toBe(true);
  expect(existsSync(path)).toBe(false);
});

it('marks an escaping runtime as source without copied-runtime credit', async () => {
  const root = await fixture(), calls: string[][] = [];
  put(root, 'src/shards/beta/runtime/index.ts', "import '../data/native';\n");
  await buildShardfiles(root, { strict: true, catalog: true, build: builder(calls) });
  expect(calls.filter(call => call[0] === 'build').map(call => call.includes('--copy-runtime'))).toEqual([true, false]);
  const output = resolve(root, 'out'), catalog = parseShardCatalog(JSON.parse(readFileSync(resolve(output, 'catalog.json'), 'utf8')));
  expect(catalog.shards.find(row => row.slug === 'beta')?.runtime).toBe('source');
  expect(existsSync(resolve(output, 'beta/runtime/index.ts'))).toBe(false);
  expect(readFileSync(resolve(output, 'catalog-report.json'), 'utf8')).toContain('../data/native');
});

it('copies only closed runtimes without publishing or depending on catalog metadata', async () => {
  const root = await fixture(), calls: string[][] = [];
  put(root, 'src/shards/beta/runtime/index.ts', "import '../data/native';\n");
  await buildShardfiles(root, { strict: true, copyRuntime: 'closed', build: builder(calls) });
  expect(calls.map(call => call[0])).toEqual(['build', 'build']);
  expect(calls.map(call => call.includes('--copy-runtime'))).toEqual([true, false]);
  expect(existsSync(resolve(root, 'out/alpha/runtime/index.ts'))).toBe(true);
  expect(existsSync(resolve(root, 'out/beta/runtime/index.ts'))).toBe(false);
  expect(existsSync(resolve(root, 'out/catalog.json'))).toBe(false);
});


it('reports exact changed map inputs while still refusing publication', async () => {
  const root = await fixture(), calls: string[][] = [], error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const project = resolve(root, 'src/shards/alpha');
  const expected = mapTilesHash(project);
  put(project, 'world/changed.ts', 'export const placement = 2;\n');
  const actual = mapTilesHash(project);
  try {
    await expect(buildShardfiles(root, { strict: true, catalog: true, build: builder(calls) })).rejects.toThrow('does not match its world');
    expect(existsSync(resolve(root, 'out/catalog.json'))).toBe(false);
    expect(error).toHaveBeenCalledWith(`wildshard map inputs: ${JSON.stringify({ shard: 'alpha', expected, actual, files: {
      'shard.config.ts': hashImmutableBytes(new TextEncoder().encode('export default {};\n')),
      'world/changed.ts': hashImmutableBytes(new TextEncoder().encode('export const placement = 2;\n')),
    } })}`);
  } finally { error.mockRestore(); }
});
