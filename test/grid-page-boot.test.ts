// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { preparePageResidency, bootPageMode, clearGridRecovery, gridCells } from '../src/game/plugin/context';
import { jsonSlot } from '../src/engine/saves/slots';
import { DRIFTWOOD_RUNTIME_COST } from '../src/shards/driftwood-isle/data/runtimeCost';
import { Scope } from '../src/engine/app/scope';
import { MemoryAdmission } from '@wildshard/format/product';

import { pageGridIntents } from '../src/game/grid/intent';

function select(mode: 'grid' | 'shard', slug = 'driftwood-isle', instance = slug): void {
  clearGridRecovery(); gridCells.leave(); bootPageMode('');
  if (mode === 'grid') expect(pageGridIntents().set({ slug, instance })).toBe(true);
}

afterEach(() => { vi.restoreAllMocks(); clearGridRecovery(); bootPageMode(''); gridCells.leave(); });
const manifest = { slug: 'driftwood-isle' as const, runtimeCost: DRIFTWOOD_RUNTIME_COST };

it.each(['shard', 'grid'] as const)('uses truthful early runtime admission for %s and only Developer can exceed the cap', mode => {
  select(mode);
  const costly = { ...manifest, runtimeCost: { ...DRIFTWOOD_RUNTIME_COST, webContentMB: 1000, glMB: 300 } };
  expect(() => preparePageResidency(costly, undefined, new MemoryAdmission())).toThrow('Home residency admission deferred');
  select(mode);
  const page = preparePageResidency(costly, undefined, new MemoryAdmission(() => true));
  expect(page.residency?.home().bytes).toBe(901_801_802);
  expect(page.memory.reports().find(row => row.stage === 'runtime')).toMatchObject({ claimedBytes: 901_801_802,
    playingCap: 1_000_000_000, measured: { webContentBytes: 1_000_000_000, glBytes: 300_000_000, engineBaseBytes: 299_000_000 } });
  page.residency?.dispose(); expect(page.residency?.allocator.cost().accounted).toBe(0);
});

it('charges a measured Select a shard home before bootstrap without creating a grid', () => {
  select('shard');
  const selected = preparePageResidency(manifest);
  expect(selected.mode).toBe('shard'); expect(selected.instance).toBe(manifest.slug);
  expect(selected.residency?.home().bytes).toBe(334_435_201);
  selected.residency?.dispose();
  expect(bootPageMode(manifest.slug)).toBe('shard');
});

it('reserves the opaque measured home before hydration and exposes the same owner to the later registry', () => {
  select('grid');
  const selected = preparePageResidency(manifest), owner = selected.residency;
  if (owner === undefined) throw new Error('Missing early grid owner');
  const claim = owner.home(), registry = claim.retain();
  expect(owner.allocator.entries()).toMatchObject([{ id: 'sim:driftwood-isle', bytes: 334_435_201, refs: 2 }]);
  expect(owner.allocator.cost().playing).toBe(751_223_074);
  registry.release(); owner.dispose(); expect(owner.allocator.entries()).toEqual([]);
});

it('refuses a legacy home with missing metadata before the shell or hybrid world can allocate', () => {
  select('grid');
  expect(() => preparePageResidency({ slug: manifest.slug })).toThrow('before bootstrap');
  select('grid');
  expect(() => preparePageResidency({ ...manifest, runtimeCost: { ...DRIFTWOOD_RUNTIME_COST, webContentMB: Number.NaN } })).toThrow();
});

it('lets admitted data reserve its sim before bootstrap and refuses any late completion after hydration abort', () => {
  select('grid', '_template', 'template-1');
  const selected = preparePageResidency({ slug: '_template', shardfile: 'shardfiles/template/shardfile.json' }), owner = selected.residency;
  if (owner === undefined) throw new Error('Missing early data owner');
  expect(owner.allocator.entries()).toEqual([]);
  owner.admitHome('template-1', 25_000_000);
  expect(owner.home().instance).toBe('template-1');
  owner.dispose(); expect(owner.allocator.entries()).toEqual([]);
  expect(() => owner.admitHome('template-1', 25_000_000)).toThrow('disposed');
});

it('ignores the retired opt-out and always admits a grid home before hydration', () => {
  const retired = jsonSlot('debug.global.gridMemoryAdmission', 'device');
  retired.write('off');
  select('grid');
  const page = preparePageResidency(manifest);
  try {
    expect(page.mode).toBe('grid');
    expect(page.residency?.home().bytes).toBe(334_435_201);
    expect(page.residency?.allocator.cost().playing).toBe(751_223_074);
  } finally { page.residency?.dispose(); retired.reset(); }
});

it('keeps the persistent composer independent when the home claim subtracts a matched resident baseline', () => {
  select('grid');
  const row = { ...DRIFTWOOD_RUNTIME_COST, webContentMB: 800, glMB: 200, residentBaseMB: 700 };
  const page = preparePageResidency({ ...manifest, runtimeCost: row }, undefined, new MemoryAdmission());
  const owner = page.residency, renderer = new Scope('renderer');
  if (owner === undefined) throw new Error('Missing matched home owner');
  try {
    owner.bindComposer({ observeComposerAllocation: read => { read(40_000_000); return () => undefined; } }, renderer, 'phone');
    expect(owner.allocator.entries().find(entry => entry.id === 'page:composer')).toMatchObject({ bytes: 40_000_000, accountedBytes: 40_000_000 });
    expect(owner.allocator.entries().find(entry => entry.id === 'page:composer')?.coveredBy).toBeUndefined();
    expect(owner.home().bytes).toBe(270_270_271);
  } finally { renderer.dispose(); owner.dispose(); }
  expect(owner.allocator.entries()).toEqual([]);
});
