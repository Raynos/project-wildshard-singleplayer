import { expect, it } from 'vitest';
import { BoxGeometry, BufferGeometry, DataTexture } from 'three';
import { cachedResourceAllocations } from '../src/engine/render/textureBytes';
import { AssetService } from '../src/engine/app/assets';
import { withOwner } from '../src/engine/app/ownership';
import { Scope } from '../src/engine/app/scope';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { AssetResidencyBridge } from '../src/game/grid/assetResidency';

it('evicts retired module caches after the last runtime, preserving simultaneous users and shared allocation identities', () => {
  const allocator = new ResidencyAllocator(), assets = new AssetService(), page = new Scope('renderer');
  const bridge = new AssetResidencyBridge(allocator, cachedResourceAllocations), detach = assets.bindResidency(bridge);
  const first = page.child('first'), second = page.child('second');
  const reserve = (id: string, scope: Scope) => {
    const lease = allocator.reserve({ id, owner: id, category: 'sim', bytes: 1_000_000, distance: 0, needed: true });
    if (lease === null) throw new Error('fixture admission'); bridge.cover(scope, lease); return lease;
  };
  const firstLease = reserve('sim:first', first), secondLease = reserve('sim:second', second);
  const geometry = new BoxGeometry(), alias = new BufferGeometry(); alias.attributes = geometry.attributes; alias.index = geometry.index;
  const texture = new DataTexture(new Uint8Array(64), 4, 4), clone = texture.clone();
  withOwner(first, () => {
    for (const [key, resource] of [['geometry', geometry], ['alias', alias], ['texture', texture], ['clone', clone]] as const)
      assets.register(key, resource, { retain: true, cache: true });
  });
  expect(allocator.entries().filter(entry => entry.category === 'commons')).toHaveLength(10);
  for (const resource of [geometry, alias, texture, clone]) assets.observeResidency(resource, second);
  assets.acquire('texture'); // A page consumer outside the runtime also keeps the real resource alive.
  first.dispose(); firstLease.release(); expect(assets.retained()).toHaveLength(4);
  second.dispose(); secondLease.release();
  expect(assets.retained().map(row => row.key)).toEqual(['texture']);
  expect(allocator.cost().accounted).toBe(128); // One source upload and one CPU backing store, not both clones.
  assets.release('texture'); expect(assets.retained()).toEqual([]); expect(allocator.entries()).toEqual([]);
  detach(); bridge.dispose(); page.dispose();
});

it('keeps a real page draw alive while evicting unused sources from a retired runtime', () => {
  const allocator = new ResidencyAllocator(), assets = new AssetService(), page = new Scope('page'), resident = page.child('resident');
  const bridge = new AssetResidencyBridge(allocator, cachedResourceAllocations); assets.bindResidency(bridge);
  const lease = allocator.reserve({ id: 'sim:runtime', owner: 'runtime', category: 'sim', bytes: 1_000_000, distance: 0, needed: true });
  if (lease === null) throw new Error('fixture admission'); bridge.cover(resident, lease);
  const shared = new DataTexture(new Uint8Array(64), 4, 4), unused = new DataTexture(new Uint8Array(64), 4, 4);
  withOwner(resident, () => { assets.register('shared', shared, { retain: true, cache: true }); assets.register('unused', unused, { retain: true, cache: true }); });
  // An asynchronous source template registers outside ambient ownership and never draws.
  const template = new DataTexture(new Uint8Array(64), 4, 4); assets.register('template', template, { retain: true, cache: true });
  assets.observeResidency(shared, page); resident.dispose(); lease.release();
  expect(assets.retained().map(row => row.key)).toEqual(['shared']); expect(allocator.cost().accounted).toBe(128);
  page.dispose(); expect(assets.evictCached('shared')).toBe(true); expect(allocator.entries()).toEqual([]); bridge.dispose();
});

it('evicts the unused home cache while keeping the calibrated composer until renderer retirement', async () => {
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
  expect(page.allocator.cost().input.commons).toBe(0);
  expect(page.allocator.cost().input.page).toBe(20_000_000);
  renderer.dispose(); expect(page.allocator.entries()).toEqual([]); expect(resize).toBeUndefined();
});

it('uses the closest runtime owner rather than a borrowed ancestor and keeps the neutral shell out of home coverage', async () => {
  const { PageResidency } = await import('../src/game/grid/pageResidency');
  for (const owned of [false, true]) {
    const page = new PageResidency(), renderer = new Scope('renderer'), home = renderer.child('home'), resident = home.child('region');
    const assets = new AssetService(); page.admitHome('home', 1_000_000);
    page.bindAssets(assets, renderer, owned ? null : home, () => resident, cachedResourceAllocations);
    const regional = page.allocator.reserve({ id: 'sim:region', owner: 'region', category: 'sim', bytes: 1_000_000, distance: 0, needed: true });
    if (regional === null) throw new Error('fixture admission');
    // Factory uses the one allocator's bridge, even with a scope beneath a borrowed home.
    const { coverRuntimeAssets } = await import('../src/game/grid/assetResidency'); coverRuntimeAssets(page.allocator, resident, regional);
    const texture = new DataTexture(new Uint8Array(64), 4, 4);
    withOwner(resident, () => { assets.register('region-only', texture, { retain: true, cache: true }); });
    assets.observeResidency(texture, resident);
    expect(page.allocator.entries().filter(entry => entry.category === 'commons').every(entry => entry.coveredBy === 'sim:region')).toBe(true);
    resident.dispose(); regional.release(); expect(assets.has('region-only')).toBe(false);
    expect(page.allocator.cost().input.commons).toBe(0);
    home.dispose(); page.dispose(); renderer.dispose(); expect(page.allocator.entries()).toEqual([]);
  }
});
