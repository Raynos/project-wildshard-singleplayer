// @vitest-environment happy-dom
import { expect, test } from 'vitest';
import * as v from 'valibot';
import { Group } from 'three';
import { Scope } from '../src/engine/app/scope';
import { defineModel, modelContext } from '../src/engine/models/model';
import { placeModelSite } from '../src/engine/models/place';
import type { ShardContext } from '../src/game/plugin/context';
import { AmbientGroup } from '../src/game/ambient/flock';
import { publishEntryOwner, lendEntryOwner, entryOwner } from '../src/game/shardfile/entryOwners';
import { prepareQuestWorldEntry } from '../src/game/shardfile/questWorld';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { emptyShardfile } from '../src/sdk/author';
import { questPageWorld } from '../src/game/quest/pageResources';
import { QuestWorldSchema } from '../src/format/questWorld';
import { driftwoodQuestWorld } from '../src/shards/driftwood-isle/generators/questWorld';
import { GULL_FLOCK } from '../src/shards/driftwood-isle/generators/gullsLook';
import hut from '../src/shards/driftwood-isle/data/hutBake.json' with { type: 'json' };
import lookout from '../src/shards/driftwood-isle/data/lookoutBake.json' with { type: 'json' };
import shrine from '../src/shards/driftwood-isle/data/shrineBake.json' with { type: 'json' };
import wreck from '../src/shards/driftwood-isle/data/wreckBake.json' with { type: 'json' };
import cove from '../src/shards/driftwood-isle/data/coveBake.json' with { type: 'json' };
import { legacyDouble } from './fake/FakeGame';

test('authored quest anchors equal actual fixed site placement, with no second rotation', () => {
  const data = v.parse(QuestWorldSchema, driftwoodQuestWorld());
  expect(Object.keys(data.pois)).toEqual(['hut', 'lookout', 'wreck', 'shrine', 'cave']);
  const model = defineModel({ id: 'shared/anchor-fixture', name: 'Anchor fixture', category: 'buildings', pipeline: 'code', file: 'test/quest-world.test.ts', defaults: {}, build: () => new Group() });
  for (const [id, site] of [['hut', hut], ['lookout', lookout], ['shrine', shrine.world]] as const) {
    const placed = placeModelSite(model, site.origin, { anchors: site.anchors, colliders: [], floorHeightAt: () => undefined }, { ctx: modelContext(null), registry: null });
    expect(data.pois[id]?.anchors).toEqual(placed.anchors);
  }
  expect(data.pois['wreck']?.anchors).toEqual(wreck.anchors);
  expect(data.pois['cave']?.anchors).toEqual(cove.native.anchors);
});

function context(scope: Scope, read: () => Promise<unknown>): ShardContext {
  const source = emptyShardfile({ slug: 'quest-world-fixture', name: 'World fixture', author: 'Fixture', revision: 1, seed: 1 });
  const product = createShardProduct({ slug: source.identity.slug, revision: 1, shardfile: source, sections: new Map(),
    files: new Map([['world.json', { hash: 'world', url: 'world' }]]), read: async () => new TextEncoder().encode(JSON.stringify(await read())) });
  return legacyDouble<ShardContext>({ scope, product });
}

test('quest world borrows its actual entered flock and leaves static rows independent', async () => {
  const resident = new Scope('world-resident'), scope = resident.child('quest-world'), data = driftwoodQuestWorld(), flock = new AmbientGroup(GULL_FLOCK);
  let reads = 0;
  const ctx = context(scope, () => { reads++; return Promise.resolve(data); });
  try {
    await expect(prepareQuestWorldEntry(ctx, 'world.json', 'gulls')).rejects.toThrow('Missing live entry owner');
    expect(reads).toBe(0);
    publishEntryOwner(resident, 'ambient', 'gulls', flock);
    lendEntryOwner(scope, resident, 'ambient', 'gulls');
    await prepareQuestWorldEntry(ctx, 'world.json', 'gulls');
    expect(questPageWorld(scope, data.id)).toEqual({ pois: data.pois, flock });
    expect(questPageWorld(scope, data.id).flock).toBe(flock);
    await expect(prepareQuestWorldEntry(ctx, 'world.json', 'gulls')).rejects.toThrow('Duplicate');
    const other = scope.child('other');
    await prepareQuestWorldEntry(context(other, () => Promise.resolve(data)), 'world.json');
    expect(questPageWorld(other, data.id).flock).toBeNull();
    scope.dispose();
    expect(() => questPageWorld(scope, data.id)).toThrow('Missing');
    expect(entryOwner(resident, 'ambient', 'gulls')).toBe(flock);
    const next = resident.child('next-entry'); lendEntryOwner(next, resident, 'ambient', 'gulls');
    await prepareQuestWorldEntry(context(next, () => Promise.resolve(data)), 'world.json', 'gulls');
    expect(questPageWorld(next, data.id).flock).toBe(flock);
  } finally { resident.dispose(); }
});

test.each([false, true])('quest world refuses a read completed after retirement (ancestor: %s)', async ancestor => {
  const parent = new Scope('world-parent'), scope = parent.child('quest-world');
  let finish: ((value: unknown) => void) | undefined;
  const pending = new Promise<unknown>(resolve => { finish = resolve; });
  const work = prepareQuestWorldEntry(context(scope, () => pending), 'world.json');
  let retirement: Generator | undefined;
  try {
    if (ancestor) { parent.onDispose(() => undefined); retirement = parent.disposeSteps(); retirement.next(); expect(scope.disposing).toBe(true); }
    else scope.dispose();
    if (finish === undefined) throw new Error('Missing read resolver');
    finish({ invalid: true });
    await expect(work).rejects.toThrow('owner ended during read');
    expect(() => questPageWorld(scope, 'driftwood.world')).toThrow('Missing');
  } finally { if (retirement !== undefined) for (const _step of retirement) { /* Drain the real owner. */ } parent.dispose(); }
});

test('quest world rows refuse functions, nonfinite anchors and reflected paths', () => {
  const rows = driftwoodQuestWorld();
  for (const pois of [{ hut: { anchors: { door: { x: Infinity, y: 0, z: 0, yaw: 0 } } } }, { hut: { anchors: () => ({}) } }, { hut: { owner: 'world', path: ['hut', 'anchors'] } }])
    expect(() => v.parse(QuestWorldSchema, { ...rows, pois })).toThrow();
});
