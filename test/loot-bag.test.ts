// @vitest-environment happy-dom
import { expect, test, vi } from 'vitest';
import * as v from 'valibot';
import { Scope } from '../src/engine/app/scope';
import { Flags } from '../src/engine/world/interact/flags';
import { QuestState } from '../src/engine/quest/core';
import type { ShardContext } from '../src/game/plugin/context';
import type { ShardRuntime } from '../src/game/shard/runtime';
import { Owned } from '../src/game/loot/Owned';
import { Purse } from '../src/game/loot/Purse';
import { enteredLootPresentation } from '../src/game/loot/runtime';
import { publishBoundQuest } from '../src/game/quest/boundState';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { emptyShardfile } from '../src/sdk/author';
import { encodeCanonicalJson } from '../src/sdk/immutable';
import { namedJsonSchema } from '../src/sdk/formatJsonSchema';
import { validateNamedJsonSchema } from '../src/game/shardfile/customSchema';
import { LootBagSchema, LootFindsSchema, LootProgressionSchema, LootPresentationSchema, LootMarksSchema } from '../src/format/lootBag';
import { LootEconomySchema, parseLootEconomy } from '../src/format/lootEconomy';
import { driftwoodLootBag, driftwoodQuestContinuation } from '../src/shards/driftwood-isle/generators/lootBag';
import { legacyDouble } from './fake/FakeGame';
import LOOT from '../src/shards/driftwood-isle/data/loot.generated.json' with { type: 'json' };

function fixture(parent?: Scope, bind = true) {
  const scope = parent?.child('bag-entry') ?? new Scope('bag-entry'), bag = driftwoodLootBag();
  const flags = new Flags('bag-projection', false), owned = new Owned('bag-projection'), voice = vi.fn(), cue = vi.fn();
  if (bind) publishBoundQuest(scope, new QuestState({ id: bag.presentation.quest, title: 'Bag fixture', completeFlag: 'fixture.done',
    steps: [{ id: 'wait', objective: 'Wait', done: { all: ['fixture.never'] } }] }, flags, undefined, scope));
  const attrs = { maxHealth: 100 };
  const health = legacyDouble<NonNullable<ShardContext['app']['player']>>({ attributes: legacyDouble<NonNullable<ShardContext['app']['player']>['attributes']>(attrs) });
  const play = legacyDouble<NonNullable<ShardRuntime['play']>>({ owned,
    audio: legacyDouble<NonNullable<ShardRuntime['play']>['audio']>({ voices: legacyDouble<NonNullable<ShardRuntime['play']>['audio']['voices']>({ play: voice }) }),
    cues: legacyDouble<NonNullable<ShardRuntime['play']>['cues']>({ cue }) });
  const row = { ...LOOT }, getter = vi.fn(() => { throw new Error('Rich economy must not be selected'); });
  Object.defineProperty(row, 'economy', { enumerable: true, get: getter });
  const source = emptyShardfile({ slug: 'bag-projection', name: 'Bag fixture', author: 'Fixture', revision: 1, seed: 1 });
  const product = createShardProduct({ slug: source.identity.slug, revision: 1, shardfile: source,
    sections: new Map([['economy/loot', { rows: { loot: [row] } }]]), files: new Map(), read: () => Promise.reject(new Error('No projection file reads')) });
  const ctx = legacyDouble<ShardContext>({ scope, product, game: legacyDouble<ShardContext['game']>({ runtime: legacyDouble<ShardRuntime>({ play }) }),
    app: legacyDouble<ShardContext['app']>({ player: health }) });
  return { ctx, bag, scope, flags, owned, attrs, voice, cue, getter };
}
function saved(): [string, string | null][] {
  const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index));
  return keys.filter((key): key is string => key !== null).sort().map(key => [key, localStorage.getItem(key)]);
}

test('the continuation projects exactly the original Bag fields and shares every defining grammar with native economy', () => {
  const { presentation, progression, finds, marks } = LOOT.economy, bag = driftwoodLootBag();
  expect(encodeCanonicalJson(parseLootEconomy(LOOT.economy))).toBe(encodeCanonicalJson(LOOT.economy));
  expect(bag).toEqual({ presentation, progression, finds, marks }); expect(driftwoodQuestContinuation().loot.bag).toEqual(bag);
  expect(LootEconomySchema.entries.presentation.wrapped).toBe(LootPresentationSchema);
  expect(LootEconomySchema.entries.progression.wrapped).toBe(LootProgressionSchema);
  expect(LootEconomySchema.entries.finds).toBe(LootFindsSchema); expect(LootEconomySchema.entries.marks).toBe(LootMarksSchema);
  const wire = namedJsonSchema(LootBagSchema);
  expect(validateNamedJsonSchema(wire, new TextEncoder().encode(JSON.stringify(bag)))).toEqual(bag);
});

test('basic and explicit Bag paths never inspect the row economy, and basic retains its coin-only owners', () => {
  const f = fixture();
  try {
    const basic = enteredLootPresentation(f.ctx, LOOT.id), purse = new Purse('bag-projection', { read: () => 17, write: () => true });
    expect(basic.gear(purse)).toEqual({ coins: 17 }); expect(basic.finds).toBeNull(); expect(basic.marks).toBeNull(); basic.chime();
    expect(f.cue).toHaveBeenCalledExactlyOnceWith(LOOT.chime);
    const rich = enteredLootPresentation(f.ctx, LOOT.id, f.bag); expect(rich.gear(purse).coins).toBe(17);
    expect(f.getter).not.toHaveBeenCalled(); expect(f.voice).not.toHaveBeenCalled();
  } finally { f.scope.dispose(); }
});

test('live Bag reads preserve original progress, flags, health, wear, marks and chime without writing native save bytes', () => {
  localStorage.clear(); const f = fixture();
  try {
    f.owned.grant('sea-chart'); f.owned.grant('cape'); f.owned.wear('cape');
    f.flags.restore(f.bag.progression.flags.slice(0, 5));
    const before = saved(), bag = enteredLootPresentation(f.ctx, LOOT.id, f.bag);
    const purse = new Purse('bag-projection', { read: () => 19, write: () => true });
    expect(bag.charted()).toBe(true); expect(bag.gear(purse)).toMatchObject({ coins: 19, health: { max: 100, hearts: f.owned.hearts }, charms: { next: 10 } });
    expect(bag.gear(purse).cosmetics?.find(item => item.id === 'cape')).toMatchObject({ owned: true, worn: true });
    expect(bag.marks?.()).toEqual(f.bag.marks.filter(mark => !f.flags.has(mark.flag)).map(({ x, z, color }) => ({ x, z, color })));
    expect(bag.finds?.().counters.map(row => row.label)).toEqual(f.bag.finds.counters.map(row => row.label));
    bag.chime(); expect(f.voice).toHaveBeenCalledExactlyOnceWith('ui-chime', { gain: .45 * f.bag.presentation.chime.gain, rate: 1, at: undefined, delay: 0, jitter: .02 });
    expect(saved()).toEqual(before);
    f.attrs.maxHealth = 140; f.owned.takeOff('cape'); f.flags.restore(f.bag.progression.flags);
    expect(bag.gear(purse).health?.max).toBe(140); expect(bag.gear(purse).charms?.next).toBeNull();
    expect(bag.gear(purse).cosmetics?.find(item => item.id === 'cape')).toMatchObject({ worn: false });
    expect(f.getter).not.toHaveBeenCalled();
  } finally { f.scope.dispose(); }
});

test('Bag and full native economy retain identical progression and finds reference refusals', () => {
  const bag = driftwoodLootBag();
  const invalid = [
    { ...bag, progression: { ...bag.progression, flags: ['duplicate', 'duplicate'] } },
    { ...bag, progression: { ...bag.progression, states: bag.progression.states.slice(1) } },
    { ...bag, finds: { ...bag.finds, next: { counter: 31, every: 1, max: 2, text: 'Next' } } },
  ];
  for (const input of invalid) {
    expect(() => v.parse(LootBagSchema, input)).toThrow();
    expect(() => parseLootEconomy({ ...LOOT.economy, progression: input.progression, finds: input.finds })).toThrow();
  }
});

test('invalid ownership, accessors and missing bound state refuse before presentation or audio', () => {
  const f = fixture(), hostile = { ...f.bag }, getter = vi.fn(() => f.bag.presentation);
  Object.defineProperty(hostile, 'presentation', { enumerable: true, get: getter });
  try {
    expect(() => enteredLootPresentation(f.ctx, LOOT.id, hostile)).toThrow('JSON'); expect(getter).not.toHaveBeenCalled();
    for (const bad of [
      { ...f.bag, presentation: { ...f.bag.presentation, chart: 'unknown-owner' } },
      { ...f.bag, presentation: { ...f.bag.presentation, cosmetics: [{ id: 'sea-chart', icon: 'hat', how: 'bad' }] } },
      { ...f.bag, progression: { ...f.bag.progression, glow: { ...f.bag.progression.glow, owned: 'unknown-owner' } } },
      { ...f.bag, finds: { ...f.bag.finds, sections: [{ title: 'Bad', items: [{ label: 'Bad', icon: 'hat', owned: 'unknown-owner' }] }] } },
    ]) expect(() => enteredLootPresentation(f.ctx, LOOT.id, bad)).toThrow();
    const absent = fixture(undefined, false);
    try { expect(() => enteredLootPresentation(absent.ctx, LOOT.id, absent.bag)).toThrow(); expect(absent.voice).not.toHaveBeenCalled(); }
    finally { absent.scope.dispose(); }
    expect(f.voice).not.toHaveBeenCalled(); expect(f.cue).not.toHaveBeenCalled(); expect(f.getter).not.toHaveBeenCalled();
  } finally { f.scope.dispose(); }
});

test('ancestor disposal refuses direct Bag projection before reading data or native owners', () => {
  const parent = new Scope('bag-parent'), f = fixture(parent), hostile = { ...f.bag }, getter = vi.fn(() => f.bag.presentation);
  Object.defineProperty(hostile, 'presentation', { enumerable: true, get: getter });
  parent.onDispose(() => undefined); const retirement = parent.disposeSteps(); retirement.next();
  try {
    expect(f.scope.disposed).toBe(false); expect(f.scope.disposing).toBe(true);
    expect(() => enteredLootPresentation(f.ctx, LOOT.id, hostile)).toThrow('live');
    expect(getter).not.toHaveBeenCalled(); expect(f.getter).not.toHaveBeenCalled(); expect(f.voice).not.toHaveBeenCalled();
  } finally { for (const step of retirement) void step; parent.dispose(); }
});
