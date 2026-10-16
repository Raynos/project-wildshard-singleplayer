import { withoutRuntimeRows } from '../src/game/plugin/headless';
import LOOT from '../src/shards/driftwood-isle/data/loot.generated.json' with { type: 'json' };
import { parseRows } from '../src/format/rows';
import { expect, test } from 'vitest';
import { emptyShardfile } from '@wildshard/sdk/author';
import { ShardfileClient } from '../src/game/shardfile/client';
import { ClientAssets } from '../src/game/shardfile/clientAssets';

// The callback is the public simulation-handoff contract, not a private mode probe.
test('native blob inventory does not announce a data sim; declared behavior still does', () => {
  const source = emptyShardfile({ slug: 'inventory', name: 'Inventory', author: 'Test', revision: 1, seed: 1 });
  const hash = 'a'.repeat(64);
  source.files.push({ hash, kind: 'binary', compressed: 1, decoded: 1, gpu: 0, triangles: 0, draws: 0, critical: true, dependencies: [] });
  source.library.push(hash); source.critical.push(hash);
  const assets = new ClientAssets(source, new Map(), { base: 'https://example.test/inventory/', firstParty: true, offline: false,
    fetch: () => Promise.reject(new Error('No asset read expected')), hash: () => Promise.resolve(hash) });
  let expected = 0;
  const bindings = { instance: 'inventory', recipes: new Map(), items: new Map(), catalogue: [],
    voices: () => new Map(), icon: () => { throw new Error('No item read expected'); },
    onSimulationExpected: () => { expected++; } };
  new ShardfileClient(source, assets, { ...bindings, trustedRuntime: true, worldOwner: 'runtime' });
  expect(expected).toBe(0);
  source.state.shared.push({ id: 1, name: 'active', type: 'bool', privacy: 'host', default: false });
  new ShardfileClient(source, assets, { ...bindings, trustedRuntime: true, worldOwner: 'runtime' });
  expect(expected).toBe(1);
  new ShardfileClient(source, assets, bindings);
  expect(expected).toBe(2);
});

test('explicit runtime loot ownership leaves inventory alone and does not install a second data simulation', () => {
  const source = emptyShardfile({ slug: 'owned-loot', name: 'Owned loot', author: 'Test', revision: 1, seed: 1 });
  source.rows = parseRows({ ...source.rows, loot: [LOOT] });
  source.runtime = { entry: 'runtime/index.ts', binds: ['loot'] };
  const stripped = withoutRuntimeRows(source);
  expect(source.rows.loot).toHaveLength(1); expect(stripped.rows.loot).toEqual([]);
  expect(stripped.rows.species).toBe(source.rows.species); expect(stripped.files).toBe(source.files);
  const assets = new ClientAssets(stripped, new Map(), { base: 'https://example.test/owned-loot/', firstParty: true, offline: false,
    fetch: () => Promise.reject(new Error('No asset read expected')), hash: () => Promise.resolve('a'.repeat(64)) });
  let expected = 0;
  const bindings = { instance: 'owned-loot', recipes: new Map(), items: new Map(), catalogue: [], voices: () => new Map(),
    icon: () => { throw new Error('No item read expected'); }, onSimulationExpected: () => { expected++; }, trustedRuntime: true, worldOwner: 'runtime' as const };
  new ShardfileClient(stripped, assets, bindings); expect(expected).toBe(0);
  new ShardfileClient({ ...source, runtime: { ...source.runtime, binds: [] } }, assets, bindings); expect(expected).toBe(1);
});
