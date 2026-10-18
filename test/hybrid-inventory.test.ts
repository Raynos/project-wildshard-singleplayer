import { MaterialsSchema } from '../src/format/materials';
import { parse } from 'valibot';
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

test.each([false, true])('quality-only rows register once without a data simulation (runtime stages %s)', async runtimeStagesOnly => {
  const [{ App }, { Scope }, { createLevelInstallation }, { shardContext }, { createShardProduct }, { MANIFEST }, { parsePlumbing }] = await Promise.all([
    import('../src/engine/app/app'), import('../src/engine/app/scope'), import('../src/engine/level/installation'),
    import('../src/game/plugin/context'), import('../src/game/shardfile/shardProduct'), import('../src/shards/_template/discovery.generated'), import('../src/format/plumbing'),
  ]);
  const source = emptyShardfile({ slug: 'harbour', name: 'Harbour', author: 'Test', revision: 1, seed: 1 });
  source.plumbing = parsePlumbing({ namespace: 'harbour', input: [], debug: [], knobs: [{ id: 'harbour.spray', phone: 0.5, desktop: 0.5 }, { id: 'harbour.shadows', phone: false, desktop: false }] });
  const assets = new ClientAssets(source, new Map(), { base: 'https://example.test/harbour/', firstParty: true, offline: false,
    fetch: () => Promise.reject(new Error('No asset read expected')), hash: () => Promise.resolve('a'.repeat(64)) });
  let expected = 0;
  const bindings = { instance: 'harbour', recipes: new Map(), items: new Map(), catalogue: [], voices: () => new Map(),
    icon: () => { throw new Error('No item read expected'); }, onSimulationExpected: () => { expected++; }, trustedRuntime: true, worldOwner: 'runtime' as const, runtimeStagesOnly };
  const client = new ShardfileClient(source, assets, bindings), app = new App(), scope = new Scope('quality-only');
  const level = createLevelInstallation(app, scope, {}, () => ({ set: () => { throw new Error('No progress expected'); }, detail: () => { throw new Error('No progress expected'); } }));
  const manifest = MANIFEST; // Existing typed boot metadata; the admitted fixture stays fictional.
  const ctx = shardContext(level.context, manifest, { shard: manifest, rows: new Map(), bag: {
    tab: () => { throw new Error('No bag expected'); }, fragment: () => { throw new Error('No bag expected'); },
  } }, createShardProduct({ slug: source.identity.slug, revision: source.identity.revision, shardfile: source, sections: new Map(), files: new Map(),
    read: () => Promise.reject(new Error('No product asset read expected')) }));
  try {
    expect(expected).toBe(0);
    await client.world(ctx); await client.kit(ctx); await client.play(ctx);
    expect(app.levelRegistrations.knobSchemas()).toEqual([{ id: 'harbour.harbour', defaults: { 'harbour.spray': 0.5, 'harbour.shadows': false } }]);
    source.plumbing = parsePlumbing({ ...source.plumbing, input: [{ id: 'harbour.horn', priority: 1, actions: [{ id: 'harbour.horn', keys: ['KeyH'] }] }] });
    new ShardfileClient(source, assets, { ...bindings, runtimeStagesOnly: false }); expect(expected).toBe(1);
  } finally { scope.dispose(); }
  expect(app.levelRegistrations.knobSchemas()).toEqual([]);
});


test('look-only trusted hybrids retain native kit and play ownership', async () => {
  const [{ App }, { Scope }, { createLevelInstallation }, { shardContext }, { createShardProduct }, { MANIFEST }] = await Promise.all([
    import('../src/engine/app/app'), import('../src/engine/app/scope'), import('../src/engine/level/installation'),
    import('../src/game/plugin/context'), import('../src/game/shardfile/shardProduct'), import('../src/shards/_template/discovery.generated'),
  ]);
  const source = emptyShardfile({ slug: 'look-only', name: 'Look only', author: 'Test', revision: 1, seed: 1 });
  source.look.materials = parse(MaterialsSchema, { smoke: { family: 'toon' } });
  const assets = new ClientAssets(source, new Map(), { base: 'https://example.test/look-only/', firstParty: true, offline: false,
    fetch: () => Promise.reject(new Error('No asset read expected')), hash: () => Promise.resolve('a'.repeat(64)) });
  let expected = 0;
  const bindings = { instance: 'look-only', recipes: new Map(), items: new Map(), catalogue: [], voices: () => new Map(),
    icon: () => { throw new Error('No item read expected'); }, onSimulationExpected: () => { expected++; }, trustedRuntime: true, worldOwner: 'runtime' as const };
  const client = new ShardfileClient(source, assets, bindings), app = new App(), scope = new Scope('look-only');
  const level = createLevelInstallation(app, scope, {}, () => ({ set: () => undefined, detail: () => undefined }));
  const ctx = shardContext(level.context, MANIFEST, { shard: MANIFEST, rows: new Map(), bag: {
    tab: () => () => undefined, fragment: () => () => undefined,
  } }, createShardProduct({ slug: source.identity.slug, revision: source.identity.revision, shardfile: source, sections: new Map(), files: new Map(),
    read: () => Promise.reject(new Error('No product asset read expected')) }));
  try {
    expect(expected).toBe(0);
    // No data world/equipment exists: these must stay under the trusted kit.
    await client.kit(ctx); await client.play(ctx);
    source.state.shared.push({ id: 1, name: 'active', type: 'bool', privacy: 'host', default: false });
    const gameplay = new ShardfileClient(source, assets, bindings); expect(expected).toBe(1);
    await expect(gameplay.play(ctx)).rejects.toThrow('normal play stage');
  } finally { scope.dispose(); app.engineScope.dispose(); }
});

test.each([
  ['Nalati', () => import('../src/shards/nalati-grasslands/shard.config')],
  ['Nine', () => import('../src/shards/nine-dragon-stack/shard.config')],
] as const)('%s look-only native rows never request a second simulation', async (_name, load) => {
  const source = (await load()).default;
  const assets = new ClientAssets(source, new Map(), { base: 'https://example.test/native/', firstParty: true, offline: false,
    fetch: () => Promise.reject(new Error('No asset read expected')), hash: () => Promise.resolve('a'.repeat(64)) });
  let expected = 0;
  new ShardfileClient(source, assets, { instance: source.identity.slug, recipes: new Map(), items: new Map(), catalogue: [], voices: () => new Map(),
    icon: () => { throw new Error('No item read expected'); }, onSimulationExpected: () => { expected++; }, trustedRuntime: true, worldOwner: 'runtime', audioOwner: 'runtime' });
  expect(expected).toBe(0);
});
