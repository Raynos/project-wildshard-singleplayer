// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { emptyShardfile } from '../src/sdk/author';
import * as boot from '../src/game/grid/boot';
import { PageResidency } from '../src/game/grid/pageResidency';
import { ShardPlugin } from '../src/game/shard/plugin';
import type { ShardContext } from '../src/game/shard/context';
import { emptyShardfileSource } from '../src/game/shardfile/loader';
import { prepareHybridShard } from '../src/game/shardfile/hybrid';

afterEach(() => { vi.restoreAllMocks(); });

function fixture() {
  const source = emptyShardfile({ slug: 'template', name: 'Template', author: 'Fixture', seed: 1, revision: 1 });
  const manifest = emptyShardfileSource(source);
  source.runtime = { entry: 'runtime/index.ts' };
  const owner = new PageResidency(); owner.admitHome('template-1', 20_000_000);
  const context: Pick<ShardContext, 'game'> = { game: { residency: owner, shard: manifest, rows: new Map(), bag: {
    tab: () => { throw new Error('No fixture bag'); }, fragment: () => { throw new Error('No fixture bag'); },
  } } };
  let constructors = 0;
  class Runtime extends ShardPlugin { constructor() { super(); constructors++; } }
  const options = { base: 'https://fixture.test/', firstParty: true, offline: false,
    fetch: (): Promise<Response> => Promise.reject(new Error('No fixture transport')),
    hash: (): Promise<string> => Promise.reject(new Error('No fixture assets')) };
  const bindings = { residencyContext: context, catalogue: [], recipes: new Map(), items: new Map(),
    voices: () => new Map(), icon: (): never => { throw new Error('No fixture equipment'); } };
  const entries = [{ slug: source.identity.slug, entry: source.runtime.entry, load: () => Promise.resolve({ default: Runtime }) }];
  vi.spyOn(boot, 'pageGridInstance').mockReturnValue('template-1');
  return { source, owner, options, bindings, entries, constructors: () => constructors };
}

it('forwards the existing page owner through the hybrid installation without another claim or pre-entry runtime hooks', async () => {
  const f = fixture();
  try {
    await prepareHybridShard(f.source, f.options, f.bindings, f.entries);
    await prepareHybridShard(f.source, f.options, { ...f.bindings, residency: f.owner }, f.entries);
    expect(f.owner.allocator.entries()).toMatchObject([{ id: 'sim:template-1', bytes: 20_000_000, refs: 1 }]);
    expect(f.constructors()).toBe(0);
  } finally { f.owner.dispose(); }
});

it('refuses conflicting explicit owners and stale or mismatched home claims before trusted runtime construction', async () => {
  const f = fixture(), other = new PageResidency(); other.admitHome('template-1', 20_000_000);
  try {
    await expect(prepareHybridShard(f.source, f.options, { ...f.bindings, residency: other }, f.entries)).rejects.toThrow('share one page residency owner');
    vi.spyOn(boot, 'pageGridInstance').mockReturnValue('template-2');
    await expect(prepareHybridShard(f.source, f.options, f.bindings, f.entries)).rejects.toThrow('identity mismatch');
    vi.spyOn(boot, 'pageGridInstance').mockReturnValue('template-1'); f.owner.dispose();
    await expect(prepareHybridShard(f.source, f.options, f.bindings, f.entries)).rejects.toThrow('disposed');
    expect(f.constructors()).toBe(0);
  } finally { f.owner.dispose(); other.dispose(); }
});
