// @vitest-environment happy-dom
import { expect, test, vi } from 'vitest';
import * as v from 'valibot';
import { Vector3 } from 'three';
import { Scope } from '../src/engine/app/scope';
import { SkyRig } from '../src/engine/world/skyRig';
import { WorldRegistry } from '../src/engine/world/registry';
import { Flags } from '../src/engine/world/interact/flags';
import { Audio } from '../src/engine/audio/Audio';
import { Events } from '../src/engine/events/events';
import type { ShardContext } from '../src/game/plugin/context';
import type { ShardRuntime } from '../src/game/shard/runtime';
import type { QuestPageComposition } from '../src/game/quest/pageComposition';
import { CollectionCatalogue } from '../src/game/models/collectionDisplay';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { publishEntryOwner, entryOwner } from '../src/game/shardfile/entryOwners';
import { installClientPlaceSets, bindClientPlaceSets } from '../src/game/shardfile/clientPlaceSets';
import { installQuestContinuation, installQuestContinuationFile } from '../src/game/quest/continuation';
import { QuestContinuationSchema } from '../src/format/questContinuation';
import { emptyShardfile } from '../src/sdk/author';
import { parseRows } from '../src/format/rows';
import { Owned } from '../src/game/loot/Owned';
import { collectionRows } from '../src/shards/driftwood-isle/generators/collections';
import loot from '../src/shards/driftwood-isle/data/loot.generated.json';
import { FakeGame, legacyDouble } from './fake/FakeGame';

const rows = { quest: 'orchard.chapter', collection: 'orchard.collection', collections: 'keepsakes',
  cosmetics: { file: 'cosmetics.json', models: {} }, loot: { id: 'orchard.loot', shop: 'shop.json', minimap: true, before: ['main.world'] } };
const encode = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value));
const cosmeticBytes = encode({ product: 'orchard', models: [] }), shopBytes = encode({ name: 'Lena' });
function deferred<T>(): { readonly promise: Promise<T>; readonly resolve: (value: T) => void } {
  let finish: ((value: T) => void) | undefined;
  const promise = new Promise<T>(resolve => { finish = resolve; });
  return { promise, resolve: value => { if (finish === undefined) throw new Error('Missing resolver'); finish(value); } };
}
/** A concrete catalogue loader seam; the fixture declares no display geometry. */
class EmptyCatalogue extends CollectionCatalogue {
  override prepare(): Promise<void> { return Promise.resolve(); }
}
function fixture(read: (hash: string) => Promise<Uint8Array>, parent?: Scope) {
  const scope = new Scope('orchard.continuation', parent), flags = new Flags('orchard.continuation', false);
  const adventure = legacyDouble<QuestPageComposition>({ flags, finale: null,
    place: row => ({ x: row.x, z: row.z, y: row.y ?? 0, yaw: row.yaw ?? 0 }), floorAt: () => 0 });
  const catalogue = new EmptyCatalogue('orchard', new Map());
  publishEntryOwner(scope, 'quest', rows.quest, adventure); publishEntryOwner(scope, 'collection', rows.collection, catalogue);
  const shardfile = emptyShardfile({ slug: 'orchard', name: 'Orchard', author: 'Fixture', seed: 1, revision: 1 });
  const admitted = parseRows({ strikes: [], weather: [], days: [], species: [], looks: [], compendiums: [], loot: [loot] }), collections = collectionRows();
  const product = createShardProduct({ slug: 'orchard', revision: 1, shardfile,
    sections: new Map<string, unknown>([['economy/loot', { rows: { loot: admitted.loot } }], ['custom/keepsakes', { models: {},
      keepsakes: { ...collections.keepsakes, placements: [], trophies: {}, wardrobe: [], restore: [] } }]]),
    files: new Map([['continuation.json', { hash: 'continuation', url: '/continuation.json' }], ['cosmetics.json', { hash: 'cosmetics', url: '/cosmetics.json' }], ['shop.json', { hash: 'shop', url: '/shop.json' }]]), read });
  const world = legacyDouble<NonNullable<ShardRuntime['world']>>({ sky: SkyRig.prototype, game: new FakeGame().asGame(), registry: new WorldRegistry(),
    player: legacyDouble<NonNullable<ShardRuntime['world']>['player']>({ position: new Vector3(), yaw: 0 }) });
  const play = legacyDouble<NonNullable<ShardRuntime['play']>>({ weapons: legacyDouble<NonNullable<ShardRuntime['play']>['weapons']>({ list: [] }),
    bodyShadow: null, owned: new Owned('orchard-continuation'), audio: new Audio(),
    hud: legacyDouble<NonNullable<ShardRuntime['play']>['hud']>({ toast: () => undefined }),
    music: legacyDouble<NonNullable<ShardRuntime['play']>['music']>({ sting: () => undefined }) });
  const system = vi.fn<ShardContext['system']>(), events = new Events();
  const on: ShardContext['on'] = (name, run, options) => { events.on(name, run, scope, options); };
  const ctx = legacyDouble<ShardContext>({ scope, product, system, on, app: legacyDouble<ShardContext['app']>({ registry: world.registry }), debug: legacyDouble<ShardContext['debug']>({ expose: () => undefined }),
    game: legacyDouble<ShardContext['game']>({ runtime: legacyDouble<ShardRuntime>({ world, play }) }) });
  return { scope, ctx, adventure, catalogue, system, on, flags, owned: play.owned };
}

test.each(['cosmetics', 'shop'].flatMap(phase => [false, true].map(ancestor => ({ phase, ancestor }))))(
  'leaving during $phase read (ancestor: $ancestor) prevents later service bindings', async ({ phase, ancestor }) => {
  const pending = deferred<Uint8Array>(), reached = deferred<string>(), reads: string[] = [];
  const parent = new Scope('orchard.parent');
  const f = fixture(hash => { reads.push(hash); if (hash === phase) { reached.resolve(hash); return pending.promise; }
    return Promise.resolve(hash === 'cosmetics' ? cosmeticBytes : shopBytes); }, parent);
  const before = { flags: f.flags.all, owned: f.owned.all };
  const running = installQuestContinuation(f.ctx, rows);
  expect(await reached.promise).toBe(phase);
  expect(entryOwner(f.scope, 'quest', rows.quest)).toBe(f.adventure);
  expect(entryOwner(f.scope, 'collection', rows.collection)).toBe(f.catalogue);
  expect(f.system.mock.calls.map(([row]) => row.id)).toEqual(phase === 'cosmetics' ? [] : ['keepsakes']);
  let retirement: Generator | undefined;
  if (ancestor) {
    parent.onDispose(() => undefined);
    retirement = parent.disposeSteps(); retirement.next();
    expect(f.scope.disposed).toBe(false); expect(f.scope.disposing).toBe(true);
  } else f.scope.dispose();
  const calls = f.system.mock.calls.length;
  // Retired cosmetic bytes must not even reach catalogue admission.
  pending.resolve(phase === 'cosmetics' ? encode({ retired: true }) : shopBytes); await running;
  expect(f.system).toHaveBeenCalledTimes(calls);
  expect(reads).toEqual(phase === 'cosmetics' ? ['cosmetics'] : ['cosmetics', 'shop']);
  expect({ flags: f.flags.all, owned: f.owned.all }).toEqual(before);
  expect(() => entryOwner(f.scope, 'quest', rows.quest)).toThrow('scope has ended');
  if (retirement !== undefined) for (const _step of retirement) { /* Drain the actual original owner. */ }
  parent.dispose();
});

test('continuation intake refuses callbacks, reflected paths and invalid collection ids', () => {
  expect(v.parse(QuestContinuationSchema, rows)).toEqual(rows);
  for (const input of [{ ...rows, run: () => 1 }, { ...rows, collection: { owner: 'view', path: ['catalogue'] } },
    { ...rows, collections: '../invalid?' }]) expect(() => v.parse(QuestContinuationSchema, input)).toThrow();
});

test('finite continuation dispatch refuses unbound placements before installing services', async () => {
  const reads: string[] = [], f = fixture(hash => { reads.push(hash); return Promise.resolve(encode(rows)); });
  try {
    installClientPlaceSets(f.ctx, { kind: 'world.sets', rows: [] });
    await expect(installQuestContinuationFile(f.ctx, 'continuation.json')).rejects.toThrow('not finished');
    expect(reads).toEqual(['continuation']); expect(f.system).not.toHaveBeenCalled();
  } finally { f.scope.dispose(); }
});

test('finite continuation dispatch admits rows after the real bind and refuses leave during its read', async () => {
  const pending = deferred<Uint8Array>(), reached = deferred<string>(), reads: string[] = [];
  const f = fixture(hash => { reads.push(hash); if (hash === 'continuation') { reached.resolve(hash); return pending.promise; } return Promise.resolve(cosmeticBytes); });
  try {
    installClientPlaceSets(f.ctx, { kind: 'world.sets', rows: [] });
    await bindClientPlaceSets(f.ctx, new Map(), []);
    const running = installQuestContinuationFile(f.ctx, 'continuation.json');
    await reached.promise; f.scope.dispose(); pending.resolve(encode({ retired: true }));
    await expect(running).rejects.toThrow('owner ended during read');
    expect(reads).toEqual(['continuation']); expect(f.system).not.toHaveBeenCalled();
  } finally { f.scope.dispose(); }
});
