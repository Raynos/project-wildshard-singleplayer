import { expect, it } from 'vitest';
import { emptyShardfile } from '../src/sdk/author';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { PageResidency } from '../src/game/grid/pageResidency';
import { clientResidency } from '../src/game/shardfile/clientResidency';
import { shardfileSource } from '../src/game/shardfile/loader';
import type { ShardfileClientBindings } from '../src/game/shardfile/client';
import type { ProductOptions } from '../src/game/shardfile/product';

function source() {
  const data = emptyShardfile({ slug: 'page-home', name: 'Page home', author: 'Test', seed: 1, revision: 1 });
  data.budgets.sim.resident = 20_000_000; return data;
}
const options: ProductOptions = { base: 'https://fixture.test/', firstParty: true, offline: false,
  fetch: () => Promise.reject(new Error('Fixture has no assets')), hash: () => Promise.reject(new Error('Fixture has no hashes')) };
function bindings(residency: PageResidency): ShardfileClientBindings {
  return { instance: 'home', residency, recipes: new Map(), items: new Map(), catalogue: [], voices: () => new Map(), icon: () => 'glyph' };
}
it('the real loader reserves the shared home before exposing the ordinary world bootstrap', async () => {
  const owner = new PageResidency(); let expected = 0;
  try {
    const manifest = await shardfileSource(source(), options, { ...bindings(owner), onSimulationExpected: () => { expected++; } });
    const home = owner.home();
    expect(home.bytes).toBe(20_000_000); expect(home.allocator).toBe(owner.allocator);
    expect(owner.allocator.entries()).toMatchObject([{ id: 'sim:home', bytes: home.bytes, refs: 1 }]);
    expect(expected).toBe(0);
    const load = manifest.load; if (load === undefined) throw new Error('Missing data plugin');
    const { default: Data } = await load(); new Data(); expect(expected).toBe(1);
    const before = owner.allocator.cost(), registry = home.retain();
    expect(owner.allocator.cost()).toEqual(before); expect(owner.allocator.entries()[0]?.refs).toBe(2);
    registry.release();
  } finally { owner.dispose(); }
  expect(owner.allocator.entries()).toEqual([]);
});
it('quota failure refuses the real source before any plugin or physics world can be constructed', async () => {
  const owner = new PageResidency(new ResidencyAllocator({ playing: 400_000_000 })); let plugins = 0;
  try {
    await expect(shardfileSource(source(), options, { ...bindings(owner), onSimulationExpected: () => { plugins++; } })).rejects.toThrow('admission deferred');
    expect(plugins).toBe(0); expect(owner.allocator.entries()).toEqual([]);
  } finally { owner.dispose(); }
});
it('reuses a measured whole-data home claim without shrinking it to the critical simulation budget', async () => {
  const owner = new PageResidency(), home = owner.admitHome('home', 40_000_000), before = owner.allocator.cost();
  try {
    await shardfileSource(source(), options, bindings(owner));
    expect(owner.home()).toBe(home); expect(owner.home().bytes).toBe(40_000_000);
    expect(owner.allocator.cost()).toEqual(before); expect(owner.allocator.entries()[0]?.refs).toBe(1);
    const data = source(); data.budgets.sim.resident = 50_000_000;
    expect(() => clientResidency(data, { instance: 'home', residency: owner })).toThrow('understates');
  } finally { owner.dispose(); }
});
it('reuses an early whole-runtime claim without replacing it with the empty data budget or announcing a sim', async () => {
  const owner = new PageResidency(), data = emptyShardfile({ slug: 'page-home', name: 'Page home', author: 'Test', seed: 1, revision: 1 });
  data.runtime = { entry: 'runtime/index.ts' }; const home = owner.admitHome('home', 40_000_000), before = owner.allocator.cost();
  let expected = 0;
  try {
    const manifest = await shardfileSource(data, options, { ...bindings(owner), trustedRuntime: true, audioOwner: 'runtime', onSimulationExpected: () => { expected++; } });
    const load = manifest.load; if (load === undefined) throw new Error('Missing hybrid data plugin');
    const { default: Data } = await load(); new Data();
    expect(owner.home()).toBe(home); expect(owner.allocator.cost()).toEqual(before); expect(owner.allocator.entries()[0]?.refs).toBe(1); expect(expected).toBe(0);
  } finally { owner.dispose(); }
});
it('refuses runtime homes without early cost, wrong instances, or understated whole-home bounds', () => {
  const data = source(); data.runtime = { entry: 'runtime/index.ts' };
  const missing = new PageResidency(), wrong = new PageResidency(), small = new PageResidency();
  try {
    expect(() => clientResidency(data, { instance: 'home', residency: missing })).toThrow('has not been admitted');
    wrong.admitHome('other', 40_000_000); expect(() => clientResidency(data, { instance: 'home', residency: wrong })).toThrow('identity mismatch');
    small.admitHome('home', 10_000_000); expect(() => clientResidency(data, { instance: 'home', residency: small })).toThrow('understates');
  } finally { missing.dispose(); wrong.dispose(); small.dispose(); }
});
it('rejects split allocators and zero-budget placeholders rather than inventing a one-byte home', () => {
  const owner = new PageResidency();
  try {
    expect(() => clientResidency(source(), { instance: 'home', residency: owner, allocator: new ResidencyAllocator() })).toThrow('share one');
    const data = source(); data.budgets.sim.resident = 0;
    expect(() => clientResidency(data, { instance: 'home', residency: owner })).toThrow('positive measured or declared resident cost');
    expect(owner.allocator.entries()).toEqual([]);
  } finally { owner.dispose(); }
});
it('rejects late plugin construction after a failed or cancelled boot released its owner', async () => {
  const owner = new PageResidency(), manifest = await shardfileSource(source(), options, bindings(owner));
  const load = manifest.load; if (load === undefined) throw new Error('Missing data plugin');
  const { default: Data } = await load(); owner.dispose();
  expect(() => new Data()).toThrow('disposed'); expect(owner.allocator.entries()).toEqual([]);
});
it('retains the existing no-owner standalone allocator path', () => {
  const allocator = new ResidencyAllocator();
  expect(clientResidency(source(), { instance: 'home', allocator }).allocator).toBe(allocator);
  expect(clientResidency(source(), { instance: 'home' }).allocator).toBeInstanceOf(ResidencyAllocator);
  expect(allocator.entries()).toEqual([]);
});
