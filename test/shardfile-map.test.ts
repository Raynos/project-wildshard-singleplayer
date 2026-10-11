// oxlint-disable-next-line import/no-nodejs-modules -- Verify actual immutable image addresses.
import { createHash } from 'node:crypto';
import { expect, it, vi } from 'vitest';
import { emptyShardfile } from '../src/sdk/author';
import { packProjectMap } from '../src/sdk/projectMap';
import { parseShardfile } from '@wildshard/format/shardSchema';
import { preflightDeclaredCosts, validateShardfileAssets } from '@wildshard/format/assetAdmission';

const bytes = Uint8Array.from(atob('UklGRjAAAABXRUJQVlA4ICQAAABwAQCdASoCAAMAAUAmJYwCdAFAAAD++b4XAkrVm6WHJtcxAAA='), c => c.codePointAt(0) ?? 0);
const hash = (image: Uint8Array): string => createHash('sha256').update(image).digest('hex');
const base = emptyShardfile({ slug: 'template', name: 'Map', author: 'Fixture', seed: 1, revision: 1 });
const baked = { bytes, tilesHash: 'b'.repeat(64) };

function mapPlatform(values: Readonly<Record<string, unknown>>): () => void {
  const previous = Object.keys(values).map(key => ({ key, descriptor: Object.getOwnPropertyDescriptor(globalThis, key) }));
  for (const [key, value] of Object.entries(values)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  return () => { for (const { key, descriptor } of previous) {
    if (descriptor === undefined) Reflect.deleteProperty(globalThis, key); else Object.defineProperty(globalThis, key, descriptor);
  } };
}

it('packs exact pixels into a hash-addressed library and charges both wire and decoded/GPU residency', () => {
  const product = packProjectMap(base, baked), source = validateShardfileAssets(product.shard, new Map([[product.hash, bytes]]), hash);
  expect(source.map).toEqual({ image: hash(bytes), tilesHash: baked.tilesHash });
  expect(source.files).toEqual([{ hash: hash(bytes), kind: 'image', compressed: bytes.length, decoded: 24 + bytes.length * 4, gpu: 24, triangles: 0, draws: 0, dependencies: [], critical: false }]);
  expect(source.budgets.library.compressed - base.budgets.library.compressed).toBe(bytes.length);
  expect(source.budgets.library.resident - base.budgets.library.resident).toBe(48 + bytes.length * 4);
  expect(preflightDeclaredCosts(source).worst.playing).toBeGreaterThan(preflightDeclaredCosts(base).worst.playing);
  expect(packProjectMap(source, baked).shard).toEqual(source);
});

it('refuses URLs, uncharged/wrong-kind/missing maps, changed pixels, bad freshness and false costs', () => {
  const source = packProjectMap(base, baked).shard;
  for (const image of ['/assets/map.webp', 'data:image/webp;base64,AA==', `commons:${hash(bytes)}`, 'c'.repeat(64)]) expect(() => parseShardfile({ ...source, map: { ...source.map, image } })).toThrow();
  expect(() => parseShardfile({ ...source, library: [], critical: [hash(bytes)] })).toThrow('Map image');
  expect(() => parseShardfile({ ...source, files: source.files.map(file => { const row = structuredClone(file); row.kind = 'binary'; return row; }) })).toThrow('Map image');
  expect(() => packProjectMap(source, { ...baked, tilesHash: 'bad' })).toThrow();
  expect(() => packProjectMap(source, { ...baked, bytes: new TextEncoder().encode('<svg/>') })).toThrow();
  expect(() => validateShardfileAssets(source, new Map([[hash(bytes), bytes.subarray(1)]]), hash)).toThrow();
  expect(() => validateShardfileAssets({ ...source, files: source.files.map(file => { const row = structuredClone(file); row.decoded = 0; return row; }) }, new Map([[hash(bytes), bytes]]), hash)).toThrow();
});

it('uses admitted map pixels without a manifest or network URL', async () => {
  const { sourceManifest } = await import('../src/game/plugin/shardPlugin');
  const { bakedMapUrl } = await import('../src/game/shard/manifest');
  const source = packProjectMap(base, baked).shard;
  const manifest = sourceManifest(source, new Map([[hash(bytes), bytes]]));
  expect(manifest.minimap?.image).toBe(`data:image/webp;base64,${btoa(String.fromCodePoint(...bytes))}`);
  expect(bakedMapUrl(manifest.minimap?.image)).toBe(manifest.minimap?.image);
  expect(() => sourceManifest(source)).toThrow('Map image is missing admitted bytes');
});

it('keeps legacy maps while product entries refuse a public-URL fallback', async () => {
  const { sourceManifest } = await import('../src/game/plugin/shardPlugin');
  const { toLevelSpec } = await import('../src/game/shard/spec');
  const manifest = sourceManifest(base), minimap = { image: '/assets/template/map/top.webp' };
  expect(toLevelSpec({ ...manifest, minimap }).minimap.image).toContain(minimap.image);
  expect(toLevelSpec({ ...manifest, minimap, shardfile: '/product/shard.json' }).minimap.image).toBeUndefined();
  expect(toLevelSpec({ ...manifest, minimap, entries: { legacy: true, shardfile: true, public: 'shardfile' } }).minimap.image).toBeUndefined();
  const admitted = sourceManifest(packProjectMap(base, baked).shard, new Map([[hash(bytes), bytes]]));
  expect(toLevelSpec({ ...admitted, shardfile: '/product/shard.json' }).minimap.image).toBe(admitted.minimap?.image);
});

it('adding only a map to a trusted hybrid never announces a second simulation', async () => {
  const { ShardfileClient } = await import('../src/game/shardfile/client');
  const { ClientAssets } = await import('../src/game/shardfile/clientAssets');
  const source = packProjectMap({ ...base, runtime: { entry: 'runtime/index.ts' } }, baked).shard;
  const assets = new ClientAssets(source, new Map([[hash(bytes), bytes]]), { base: 'https://fixture.test/', firstParty: true, offline: false,
    hash: value => Promise.resolve(hash(value)), fetch: () => Promise.reject(new Error('Already admitted')) });
  let expected = 0;
  new ShardfileClient(source, assets, { trustedRuntime: true, instance: 'template', catalogue: [], items: new Map(), recipes: new Map(),
    icon: () => 'glyph', voices: () => new Map(), onSimulationExpected: () => { expected++; } });
  expect(expected).toBe(0);
});

it('refuses incomplete or duplicate map CLI flags before building', async () => {
  const { runCli } = await import('../src/sdk/cli');
  for (const flags of [['--map=/map.webp'], ['--map-tiles-hash=a'], ['--map=/a', '--map=/b', '--map-tiles-hash=a'], ['--map=/a', '--map-tiles-hash=a', '--map-tiles-hash=b']]) {
    await expect(runCli(['build', '/absent/project', '/absent/output', ...flags])).rejects.toThrow('build map flag');
  }
});

it('shares a charged map lease across owners and releases late/disposed requests without leaks', async () => {
  const { Scope } = await import('../src/engine/app/scope');
  const { ResidencyAllocator } = await import('../src/game/grid/allocator');
  const { leaseMapImage } = await import('../src/game/shardfile/mapImage');
  const source = packProjectMap(base, baked).shard, assets = new Map([[hash(bytes), bytes]]);
  const allocator = new ResidencyAllocator(), a = new Scope('map.a'), b = new Scope('map.b');
  try {
    expect(leaseMapImage(source, assets, allocator, a)).toBe(leaseMapImage(source, assets, allocator, b));
    expect(allocator.entries()).toMatchObject([{ category: 'library', bytes: 48 + bytes.length * 4, refs: 2 }]);
    a.dispose(); expect(allocator.entries()[0]?.refs).toBe(1);
    expect(() => leaseMapImage(source, assets, allocator, a)).toThrow('disposed');
  } finally { a.dispose(); b.dispose(); }
  expect(allocator.entries()).toEqual([]);
});

it('retains the full-size home raster, shares neighbour copies and clears their scoped canvases', async () => {
  const { Scope } = await import('../src/engine/app/scope');
  const { CellMinimaps } = await import('../src/game/grid/minimapBlend');
  const close = vi.fn(), draw = vi.fn<(image: unknown, x: number, y: number, width: number, height: number) => void>(), provider = vi.fn(() => Promise.resolve('data:image/webp;base64,AA=='));
  const restore = mapPlatform({ document: { createElement: () => ({ width: 0, height: 0, getContext: () => ({ drawImage: draw }) }) },
    fetch: () => Promise.resolve(new Response(bytes)), createImageBitmap: () => Promise.resolve({ width: 1000, height: 1000, close }) });
  const scope = new Scope('map.canvas'), maps = new CellMinimaps(scope, provider, id => id === 'home');
  try {
    expect(maps.image('home')).toBeNull(); expect(maps.image('neighbour')).toBeNull(); expect(maps.image('neighbour')).toBeNull();
    await vi.waitFor(() => { expect(maps.image('home')?.width).toBe(1000); expect(maps.image('neighbour')?.width).toBe(400); });
    expect(provider).toHaveBeenCalledTimes(2); expect(close).toHaveBeenCalledTimes(2);
    expect(draw.mock.calls.map(call => call.slice(1))).toEqual([[0, 0, 1000, 1000], [0, 0, 400, 400]]);
    const home = maps.image('home'), neighbour = maps.image('neighbour');
    expect(maps.bytes).toBe(4_640_000);
    scope.dispose(); expect(home?.width).toBe(0); expect(neighbour?.width).toBe(0); expect(maps.bytes).toBe(0);
  } finally { scope.dispose(); restore(); }
});

it('closes a bitmap arriving after its owner left without publishing or allocating a canvas', async () => {
  const { Scope } = await import('../src/engine/app/scope');
  const { CellMinimaps } = await import('../src/game/grid/minimapBlend');
  const bitmap = { width: 1000, height: 1000, close: vi.fn() }, canvas = vi.fn();
  let release: (value: typeof bitmap) => void = () => { throw new Error('Bitmap request not started'); };
  const pending = new Promise<typeof bitmap>(resolve => { release = resolve; });
  const decode = vi.fn(() => pending);
  const restore = mapPlatform({ document: { createElement: canvas }, fetch: () => Promise.resolve(new Response(bytes)), createImageBitmap: decode });
  const scope = new Scope('map.late'), maps = new CellMinimaps(scope, () => Promise.resolve('data:image/webp;base64,AA=='));
  try {
    maps.image('home'); await vi.waitFor(() => { expect(decode).toHaveBeenCalledTimes(1); });
    scope.dispose(); release(bitmap); await pending;
    expect(bitmap.close).toHaveBeenCalledTimes(1); expect(canvas).not.toHaveBeenCalled(); expect(maps.bytes).toBe(0);
  } finally { scope.dispose(); release(bitmap); restore(); }
});
