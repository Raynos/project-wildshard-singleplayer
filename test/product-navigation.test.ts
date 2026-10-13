// oxlint-disable-next-line import/no-nodejs-modules -- Read each shard's retained original navigation bytes.
import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { loadNavmesh, setActiveNavmesh } from '../src/engine/physics/navmeshLoad';
import type { Navmesh } from '../src/engine/physics/navmesh';
import { provideRuntimeProduct } from '../src/game/shardfile/runtimeProduct';
import { installProductNavigation } from '../src/game/shardfile/productNavigation';
import type { Shardfile } from '@wildshard/format/shardSchema';
import sky from '../src/shards/far-reach/shard.config';
import skyNavigation from '../src/shards/far-reach/data/navigation.generated.json' with { type: 'json' };
import signal from '../src/shards/sunscar-dunes/shard.config';
import signalNavigation from '../src/shards/sunscar-dunes/data/navigation.generated.json' with { type: 'json' };
import nalati from '../src/shards/nalati-grasslands/shard.config';
import nalatiNavigation from '../src/shards/nalati-grasslands/data/navigation.generated.json' with { type: 'json' };

const restores: (() => void)[] = [];
afterEach(() => { for (const restore of restores.splice(0)) restore(); vi.restoreAllMocks(); setActiveNavmesh('product-navigation', null); });

const read = (path: string): Uint8Array => new Uint8Array(readFileSync(new URL(`../${path}`, import.meta.url)));
/** Everything a creature query reads from a loaded navmesh: per layer its agent, tiles, polygons and vertices, and the bytes. */
const shape = (nav: Navmesh | null): unknown => nav === null ? null : { bytes: nav.bytes, layers: nav.layers.map(layer => ({ radius: layer.radius, height: layer.height, climb: layer.climb,
  tiles: Object.values(layer.mesh.tiles).map(tile => ({ polys: tile.polys.length, vertices: tile.vertices.length, detail: tile.detailTriangles.length })) })) };

const shards: [Shardfile, { navigation: unknown; url: string }][] = [[sky, skyNavigation], [signal, signalNavigation], [nalati, nalatiNavigation]];

// Each shard with admitted navigation declares the manifest URL and the shardfile row over the same original bytes. With
// the product resident (a grid cell, or standalone once its canonical product is read), the session's navigation reader
// hands those admitted bytes to the engine: the URL is never fetched, and the navmesh is the one the URL's bytes build.
it.each(shards)('reads %s navigation from its admitted product, never the manifest URL too', async (source, declared) => {
  const slug = source.identity.slug, row = source.navigation;
  if (row === null) throw new Error(`${slug} declares no navigation`);
  expect(declared.navigation).toEqual(row);
  expect(declared.url).toBe(`/assets/baked/${slug}/navmesh.bin`);
  const original = read(`src/shards/${slug}/assets/navigation-${row.file}`);
  expect(original).toEqual(read(`public/assets/baked/${slug}/navmesh.bin`));
  const fetched = shape(await loadNavmesh('product-navigation', slug, { row, bytes: original }));
  const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('navmesh.bin must not be fetched'));
  restores.push(installProductNavigation());
  const resident = new Scope(`${slug}-resident`);
  restores.push(() => { resident.dispose(); });
  provideRuntimeProduct({ source, assets: new Map([[row.file, original]]), cached: false }, resident);
  const admitted = await loadNavmesh('product-navigation', slug, { row: declared.navigation, url: declared.url });
  expect(fetch).not.toHaveBeenCalled();
  expect(shape(admitted)).toEqual(fetched);
});

it('keeps the declared URL for a key no admitted product answers', async () => {
  const [source, declared] = shards[0] ?? (() => { throw new Error('no shard'); })();
  const row = source.navigation;
  if (row === null) throw new Error('no navigation');
  const bytes = read(`public/assets/baked/${source.identity.slug}/navmesh.bin`);
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(Uint8Array.from(bytes)));
  restores.push(installProductNavigation());
  const nav = await loadNavmesh('product-navigation', 'no-product-here', { row: declared.navigation, url: declared.url });
  expect(fetch).toHaveBeenCalledWith(declared.url);
  expect(nav?.bytes).toBe(bytes.byteLength);
});
