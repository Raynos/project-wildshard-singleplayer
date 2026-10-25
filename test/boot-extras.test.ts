import { expect, test } from 'vitest';
import { build } from 'vite';
import { bootModulesPlugin } from '../vite/bootModules';
import { emptyShardfile } from '@wildshard/sdk/author';
// oxlint-disable-next-line import/no-nodejs-modules -- Own and remove the tiny compiler fixture.
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve fixture files without changing cwd.
import { resolve, dirname } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Give the fixture its actual admitted hashes.
import { createHash } from 'node:crypto';
import { sceneSourceUrls, homeExtraFiles } from '../vite/bootExtras';
import { productDownloadTotal } from '../vite/bootProducts';

test('lists exactly the model reader preloads, deduplicating URLs and excluding unused mappings/specimen metadata', () => {
  expect(sceneSourceUrls('models', { rows: {
    meshes: ['one'], meshUrls: { one: '/assets/one.glb', unused: '/assets/unused.glb' },
    hd: ['two'], hdUrls: { two: '/assets/two.glb' }, geometryPools: [{ url: '/assets/pool.glb', parts: [] }],
    paintedModels: [{ url: '/assets/two.glb', geometry: 'one' }],
    rigs: { bodies: { creatures: ['body'], urls: { body: '/assets/body.glb', unused: '/assets/no.glb' } } },
  }, specimens: [{ image: '/assets/not-read.png' }] })).toEqual(['/assets/one.glb', '/assets/two.glb', '/assets/pool.glb', '/assets/body.glb']);
  expect(sceneSourceUrls('baked', { rows: { first: {}, second: {} }, urls: { first: '/assets/first.glb', second: '/assets/second.glb', unused: '/assets/no.glb' },
    resources: [{ url: '/assets/extra.bin' }] })).toEqual(['/assets/first.glb', '/assets/second.glb', '/assets/extra.bin']);
  expect(() => sceneSourceUrls('models', { rows: { meshes: ['missing'], meshUrls: {}, hd: [], hdUrls: {} } })).toThrow('Invalid boot source URL');
});

test('a real emitted image and admitted source produce only the selected home bank', async () => {
  mkdirSync('tmp/vite-boot-extras', { recursive: true });
  const root = mkdtempSync(resolve('tmp/vite-boot-extras/case-'));
  try {
    mkdirSync(resolve(root, 'src/shards/home'), { recursive: true });
    mkdirSync(resolve(root, 'public/assets/physics'), { recursive: true });
    mkdirSync(resolve(root, 'out/home'), { recursive: true });
    writeFileSync(resolve(root, 'src/card.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0L1 1"/></svg>');
    writeFileSync(resolve(root, 'src/preview.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><circle r="2"/></svg>');
    writeFileSync(resolve(root, 'src/card.ts'), 'import url from "./card.svg"; import preview from "./preview.svg"; export const value = [url, preview];');
    mkdirSync(resolve(root, 'src/game/shardfile'), { recursive: true });
    writeFileSync(resolve(root, 'src/game/shardfile/client.ts'), 'export const client = 1;');
    mkdirSync(resolve(root, 'src/game/grid'), { recursive: true });
    writeFileSync(resolve(root, 'src/game/grid/session.ts'), 'export const grid = 1;');
    writeFileSync(resolve(root, 'src/shards/home/discovery.generated.ts'), 'export default { slug: "home" };');
    writeFileSync(resolve(root, 'src/shardList.ts'), 'export { default as home } from "./shards/home/discovery.generated";');
    writeFileSync(resolve(root, 'src/entry.ts'), "window.client = () => import('./game/shardfile/client'); window.grid = () => import('./game/grid/session'); window.selected = () => import('./shards/home/discovery.generated'); window.catalogue = () => import('./shardList'); async function startSelected() { return import('./card'); } void startSelected();");
    writeFileSync(resolve(root, 'index.html'), '<html><head></head><body><script type="module" src="/src/entry.ts"></script></body></html>');
    writeFileSync(resolve(root, 'src/shards/home/manifest.json'), JSON.stringify({ card: { thumb: '/src/card.svg', portrait: 'data:,', landscape: 'data:,' },
      explore: { art: { world: '/src/preview.svg' } }, boot: { precache: ['/assets/required.webp'] } }));
    writeFileSync(resolve(root, 'public/assets/required.webp'), new Uint8Array(3));
    writeFileSync(resolve(root, 'public/assets/model.glb'), new Uint8Array(11));
    mkdirSync(resolve(root, 'src/game/data'), { recursive: true });
    writeFileSync(resolve(root, 'public/assets/pickup.bin'), new Uint8Array(17));
    const geometry = { attrs: [], count: 0, index: null, indexCount: 0, box: false, expand: false };
    writeFileSync(resolve(root, 'src/game/data/pickupCatalogue.json'), JSON.stringify({
      file: 'pickups', seed: 1, coin: 'coin', looks: [], geometries: [
        { key: 'coin', seed: 1, geometry, file: '/assets/pickup.bin' },
        { key: 'shared', seed: 1, geometry, file: '/assets/pickup.bin' },
        { key: 'inline', seed: 1, geometry, data: 'inline' },
      ],
    }));
    writeFileSync(resolve(root, 'public/assets/early.webp'), new Uint8Array(5));
    writeFileSync(resolve(root, 'public/assets/late.webp'), new Uint8Array(7));
    writeFileSync(resolve(root, 'public/assets/physics/rapier.wasm'), new Uint8Array(13));
    const source = emptyShardfile({ slug: 'home', name: 'Home', author: 'Test', revision: 1, seed: 9 });
    const models = JSON.stringify({ rows: { meshes: ['one'], meshUrls: { one: '/assets/model.glb', unused: '/assets/never.glb' }, hd: [], hdUrls: {},
      rigs: { bodies: { creatures: ['owned', 'public'], urls: { owned: 'geometry/rigs/body.glb', public: '/assets/model.glb' } } } } });
    const hash = createHash('sha256').update(models).digest('hex'), sourcePath = `blobs/json/${hash}.json`;
    mkdirSync(resolve(root, 'out/home/blobs/json'), { recursive: true });
    writeFileSync(resolve(root, 'out/home', sourcePath), models);
    const sections = Object.entries({ 'quests/host': { questHost: { page: { version: 1 } } },
      'look/painted': { look: { sky: { kind: 'strips', row: { strips: [{ key: 'early', url: '/assets/early.webp' }, { key: 'late', url: '/assets/late.webp' }] } } } },
      'world/scenes': { version:1,libraries: [{ id:'fixture-models',kind: 'models', file: 'source.json' }],materials:[],steps:[] } }).map(([name, rows]) => {
      const value = JSON.stringify(rows), path = `sections/${name}.json`;
      mkdirSync(dirname(resolve(root, 'out/home', path)), { recursive: true });
      writeFileSync(resolve(root, 'out/home', path), value);
      return { name, path, bytes: Buffer.byteLength(value), hash: createHash('sha256').update(value).digest('hex'), schema: `wildshard:${name}@1` };
    });
    const rig = new Uint8Array(19), rigHash = createHash('sha256').update(rig).digest('hex'), rigPath = `blobs/glb/${rigHash}.glb`;
    mkdirSync(resolve(root, 'out/home/blobs/glb'), { recursive: true }); writeFileSync(resolve(root, 'out/home', rigPath), rig);
    const index = { format: 'wildshard.shardfile', formatVersion: 2, sdk: '0.2', version: source.version, identity: source.identity,
      requires: source.requires, build: { sourceHash: hash, validator: 'test' },
      admission: { budgets: source.budgets, serverBudget: source.serverBudget, authorCaps: source.authorCaps, critical: source.critical, library: source.library },
      sections, schemas: [], files: [{ name: 'source.json', kind: 'json', path: sourcePath, hash, compressed: Buffer.byteLength(models), decoded: Buffer.byteLength(models), gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: false },
        { name: 'geometry/rigs/body.glb', kind: 'glb', path: rigPath, hash: rigHash, compressed: rig.length, decoded: rig.length, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: false }], runtime: null };
    writeFileSync(resolve(root, 'out/home/shard.json'), JSON.stringify(index));
    const result = await build({ root, configFile: false, logLevel: 'silent', plugins: [bootModulesPlugin()], build: { write: false, assetsInlineLimit: 0, cssCodeSplit: false } });
    if (Array.isArray(result) || !('output' in result)) throw new Error('Missing fixture bundle');
    const bundle = Object.fromEntries(result.output.map(file => [file.fileName, file]));
    const rows = homeExtraFiles(root, 'home', bundle, 0);
    const image = result.output.find(file => file.type === 'asset' && file.originalFileNames.includes('src/card.svg'));
    if (image?.type !== 'asset') throw new Error('Missing emitted image');
    const preview = result.output.find(file => file.type === 'asset' && file.originalFileNames.includes('src/preview.svg'));
    if (preview?.type !== 'asset') throw new Error('Missing demand image');
    expect(rows).not.toContainEqual([`/${preview.fileName}`, typeof preview.source === 'string' ? Buffer.byteLength(preview.source) : preview.source.byteLength]);
    expect(rows).toEqual([[`/${image.fileName}`, typeof image.source === 'string' ? Buffer.byteLength(image.source) : image.source.byteLength], ['/assets/required.webp', 3], ['/assets/model.glb', 11], ['/assets/pickup.bin', 17], ['/assets/physics/rapier.wasm', 13], ['/assets/early.webp', 5], ['/assets/late.webp', 7]].sort(([left], [right]) => String(left).localeCompare(String(right))));
    const metadata = result.output.find(file => file.type === 'asset' && /^assets\/boot-home-[a-f0-9]{8}\.json$/u.test(file.fileName));
    if (metadata?.type !== 'asset' || typeof metadata.source !== 'string') throw new Error('Missing per-home metadata');
    expect(JSON.parse(metadata.source)).toEqual(rows);
    const html = result.output.find(file => file.fileName === 'index.html');
    if (html?.type !== 'asset' || typeof html.source !== 'string') throw new Error('Missing emitted document');
    expect(html.source).toContain(`/${metadata.fileName}`);
    expect(html.source).not.toContain('/assets/model.glb');
    expect(html.source).toContain(createHash('sha256').update(metadata.source).digest('hex'));
    const withoutRig = { ...index, files: index.files.filter(file => file.hash !== rigHash) };
    expect(productDownloadTotal(index, 100)[1] - productDownloadTotal(withoutRig, 100)[1]).toBe(rig.length);
    writeFileSync(resolve(root, 'out/home/shard.json'), JSON.stringify(withoutRig));
    expect(() => homeExtraFiles(root, 'home', bundle, 0)).toThrow('Unsafe boot source URL');
    writeFileSync(resolve(root, 'out/home/shard.json'), JSON.stringify(index));
    writeFileSync(resolve(root, 'out/home', sourcePath), '{}');
    expect(() => homeExtraFiles(root, 'home', bundle, 0)).toThrow('differs from its index');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
