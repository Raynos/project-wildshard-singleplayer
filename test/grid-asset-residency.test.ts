import { expect, it } from 'vitest';
import { BoxGeometry, BufferGeometry, DataTexture } from 'three';
import { cachedResourceAllocations } from '../src/engine/render/textureBytes';
import { AssetService } from '../src/engine/app/assets';
import { Scope } from '../src/engine/app/scope';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { AssetResidencyBridge } from '../src/game/grid/assetResidency';

it('keeps real shared geometry/texture allocations charged once through three runtime owners and final retirement', () => {
  const allocator = new ResidencyAllocator(), assets = new AssetService(), page = new Scope('renderer');
  const bridge = new AssetResidencyBridge(allocator, cachedResourceAllocations), detach = assets.bindResidency(bridge);
  const geometry = new BoxGeometry(), alias = new BufferGeometry(); alias.attributes = geometry.attributes; alias.index = geometry.index;
  const texture = new DataTexture(new Uint8Array(64), 4, 4), textureClone = texture.clone();
  assets.register('geometry', geometry, { retain: true, cache: true }); assets.register('alias', alias, { retain: true, cache: true });
  assets.register('texture', texture, { retain: true, cache: true }); assets.register('textureClone', textureClone, { retain: true, cache: true });
  const cached = allocator.cost().accounted, count = allocator.entries().length;
  expect(cached).toBeGreaterThan(64); expect(count).toBe(10); // four shared GPU buffers, four CPU stores, one source/sampler + one pixel store
  for (let visit = 0; visit < 3; visit++) {
    const resident = page.child(`resident:${String(visit)}`);
    const runtime = allocator.reserve({ id: 'sim:runtime', owner: 'runtime', category: 'sim', bytes: 1_000_000, distance: 0, needed: true });
    if (runtime === null) throw new Error('fixture admission');
    bridge.cover(resident, runtime);
    for (const resource of [geometry, alias, texture, textureClone]) assets.observeResidency(resource, resident);
    expect(allocator.cost().accounted).toBe(1_000_000); expect(allocator.entries().filter(entry => entry.category === 'commons').every(entry => entry.accountedBytes === 0)).toBe(true);
    resident.dispose(); runtime.release();
    expect(allocator.cost().accounted).toBe(cached); expect(allocator.entries()).toHaveLength(count);
  }
  // A module cache remains charged while its data survives level unload. Only real renderer retirement detaches it.
  page.dispose(); expect(allocator.cost().accounted).toBe(cached);
  assets.forgetDisposed('geometry'); assets.forgetDisposed('texture'); expect(allocator.cost().accounted).toBe(cached);
  assets.forgetDisposed('alias'); assets.forgetDisposed('textureClone'); expect(allocator.cost().accounted).toBe(0);
  detach(); bridge.dispose(); expect(allocator.entries()).toEqual([]);
});

it('keeps renderer cache and calibrated composer claims after level unload, then frees them with the renderer', async () => {
  const { PageResidency } = await import('../src/game/grid/pageResidency');
  const page = new PageResidency(), renderer = new Scope('renderer'), level = renderer.child('level'), assets = new AssetService();
  page.admitHome('home', 1_000_000);
  assets.register('cached', new DataTexture(new Uint8Array(64), 4, 4), { retain: true, cache: true });
  page.bindAssets(assets, renderer, level, () => level, cachedResourceAllocations);
  const before = page.allocator.cost().playing;
  let resize: ((bytes: number) => void) | undefined;
  page.bindComposer({ observeComposerAllocation: read => { resize = read; read(13_140_576); return () => { resize = undefined; }; } }, renderer);
  expect(page.allocator.cost().playing).toBe(before);
  resize?.(20_000_000);
  expect(page.allocator.entries().filter(entry => entry.category === 'page')).toMatchObject([{ bytes: 20_000_000, refs: 1 }]);
  expect(page.allocator.cost().playing).toBe(before + 6_859_424);
  level.dispose(); page.dispose();
  expect(page.allocator.cost().input.sims).toBe(0);
  expect(page.allocator.cost().input.commons).toBe(128);
  expect(page.allocator.cost().input.page).toBe(20_000_000);
  renderer.dispose(); expect(page.allocator.entries()).toEqual([]); expect(resize).toBeUndefined();
});
