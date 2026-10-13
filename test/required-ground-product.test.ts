import { afterEach, expect, it, vi } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { isDev, setDev } from '../src/engine/core/devMode';
import { bindLevelSelection } from '../src/engine/level/selection';
import { loadRequiredGround } from '../src/engine/world/bakedTerrainField';
import { encodeTerrainTile } from '@wildshard/format/terrainTileBytes';
import type { Shardfile } from '@wildshard/format/shardSchema';
import { contentHash } from '../src/sdk/project';
import { browserShardfileOptions } from '../src/game/plugin/ui';
import { chooseShardEntry } from '../src/game/shard/entryMode';
import { toLevelSpec } from '../src/game/shard/spec';
import { installProductGround } from '../src/game/shardfile/productGround';
import { provideRuntimeProduct, takeFirstPartyDescriptor } from '../src/game/shardfile/runtimeProduct';
import { PINE_HOLLOW } from '../src/shards/pine-hollow/manifest';
import pineSource from '../src/shards/pine-hollow/shard.config';

const restores: (() => void)[] = [];
afterEach(() => { for (const restore of restores.splice(0).reverse()) restore(); vi.restoreAllMocks(); });

function product(): { source: Shardfile; bytes: Uint8Array; hash: string } {
  const splat = new Uint8Array(256 * 256 * 4);
  for (let i = 0; i < splat.length; i += 4) splat[i] = 255;
  const bytes = encodeTerrainTile({ resolution: 256, x: -250, z: -250, size: 500, heights: new Float32Array(256 * 256).fill(12), splat });
  const hash = contentHash(bytes);
  if (pineSource.runtime === null) throw new Error('Missing trusted fixture runtime');
  const source: Shardfile = { ...pineSource, critical: [...pineSource.critical, hash], runtime: { ...pineSource.runtime, binds: [...(pineSource.runtime.binds ?? []), 'terrain'] }, terrain: { version: 1, family: 'pbr', form: 'query', collider: hash, tiles: [], sampling: { law: 'bilinear', file: hash, normalEpsilon: 0.6, datum: 0 } },
    files: [...pineSource.files, { hash, kind: 'binary', compressed: bytes.length, decoded: bytes.length, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: true }] };
  return { source, bytes, hash };
}

function session(): void {
  const developer = isDev(); setDev(true); restores.push(() => { setDev(developer); });
  chooseShardEntry('pine-hollow', 'shardfile');
  restores.push(bindLevelSelection(toLevelSpec(PINE_HOLLOW)), installProductGround());
  const navigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } });
  restores.push(() => { if (navigator === undefined) Reflect.deleteProperty(globalThis, 'navigator'); else Object.defineProperty(globalThis, 'navigator', navigator); });
}

it('admits standalone required ground before hybrid declaration and shares the descriptor with boot', async () => {
  const p = product(); session();
  const base = new URL('shardfiles/pine-hollow/', location.href).href;
  let finish: (response: Response) => void = () => { throw new Error('Missing descriptor request'); };
  const descriptor = new Promise<Response>(resolve => { finish = resolve; });
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(input => {
    const url = input instanceof Request ? input.url : input.toString();
    if (url === `${base}shard.json`) return descriptor;
    if (url === `${base}${p.hash}`) return Promise.resolve(new Response(Uint8Array.from(p.bytes).buffer));
    throw new Error(`Unexpected required-ground fetch: ${url}`);
  });
  const loading = loadRequiredGround({ key: 'pine-hollow', seed: p.source.identity.seed });
  await vi.waitFor(() => { expect(fetch).toHaveBeenCalledOnce(); });
  finish(Response.json(p.source));
  const ground = await loading;
  expect(ground.seed).toBe(p.source.identity.seed);
  expect(ground.heightAt(0, 0)).toBe(12);
  expect(ground.normalAt(0, 0)).toEqual([0, 1, 0]);
  expect(ground.splatAt(0, 0)).toEqual([1, 0, 0, 0]);
  expect(await takeFirstPartyDescriptor(browserShardfileOptions(base, true))).toEqual(p.source);
  expect(fetch.mock.calls.map(([input]) => input instanceof Request ? input.url : input.toString())).toEqual([`${base}shard.json`, `${base}${p.hash}`]);
});

it('uses admitted grid bytes without a descriptor or network fetch', async () => {
  const p = product(); session();
  const resident = new Scope('required-ground-grid'); restores.push(() => { resident.dispose(); });
  provideRuntimeProduct({ source: p.source, assets: new Map([[p.hash, p.bytes]]), cached: false }, resident);
  const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Admitted grid must not fetch'));
  const ground = await loadRequiredGround({ key: 'pine-hollow', seed: p.source.identity.seed });
  expect(ground.heightAt(0, 0)).toBe(12);
  expect(fetch).not.toHaveBeenCalled();
});

it.each(['legacy', 'other-level', 'unknown'] as const)('refuses unadmitted %s ground without fetching a descriptor', async mode => {
  session();
  if (mode === 'legacy') chooseShardEntry('pine-hollow', 'legacy');
  if (mode === 'other-level') restores.push(bindLevelSelection({ ...toLevelSpec(PINE_HOLLOW), id: 'other' }));
  const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Refused ground must not fetch'));
  await expect(loadRequiredGround({ key: mode === 'unknown' ? 'unknown' : 'pine-hollow', seed: pineSource.identity.seed })).rejects.toThrow('has no admitted product');
  expect(fetch).not.toHaveBeenCalled();
});
