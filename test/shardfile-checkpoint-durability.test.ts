import * as v from 'valibot';
import { expect, it } from 'vitest';
import { SaveStore } from '../src/engine/saves/store';
import { Ledger } from '../src/game/ledger';
import { Purse } from '../src/game/loot/Purse';
import { checkpointClientState, clientCheckpoint, clientStateSave } from '../src/game/shardfile/clientState';
import { MemoryStorage } from './setup';

class QuotaStorage extends MemoryStorage {
  readonly blocked = new Set<string>();
  override setItem(key: string, value: string): void {
    if (this.blocked.has(key)) throw new Error('Quota');
    super.setItem(key, value);
  }
}
const origin = { kind: 'engine' as const, source: 'quest.complete' };
const rules = [{ fact: 'quest.complete', origin, rewards: [{ kind: 'catalogue' as const, item: 'gear.sword', tier: 1, quantity: 1 }] }];
const fact = { instance: 'template-solo', shard: 'template', revision: 1, entity: 'actor.player', tick: 20, ordinal: 0, name: 'quest.complete', origin };
const purseDefinition = { key: 'purse', scope: 'shard' as const, version: 1, schema: v.pipe(v.number(), v.finite(), v.minValue(0)), initial: () => 0 };
const encountersDefinition = { key: 'platform.encounters', scope: 'shard' as const, version: 1, schema: v.boolean(), initial: () => false };
function ledger(store: SaveStore): Ledger {
  return new Ledger(store, [{ id: fact.instance, shard: fact.shard }], [{ shard: fact.shard, revision: 1, rules }], [{ id: 'gear.sword', maxTier: 1 }]);
}
function fixture() {
  const local = new QuotaStorage(), store = new SaveStore({ local, session: null }), rewards = ledger(store);
  const purse = new Purse('template', store.define(purseDefinition));
  const encounters = store.instance(encountersDefinition, { id: fact.instance }), continuation = store.instance(clientStateSave, { id: fact.instance });
  const state = { version: 1 as const, revision: 1, tick: 20, lane: null, items: {}, flags: ['quest.complete'], quests: [], dialogue: {} };
  const ports = { ledger: rewards, purse,
    encounters: () => encounters.write(true), continuation: () => continuation.write(state),
  };
  const checkpoint = () => checkpointClientState(ports);
  return { local, rewards, purse, ports, checkpoint, state, fresh: () => new SaveStore({ local, session: null }) };
}
it('refuses a home checkpoint when profile quota fails although continuation and coins persisted; retry grants exactly once', () => {
  const f = fixture(); f.local.blocked.add('wildshard.save.v2.profile');
  expect(f.rewards.record(fact).status).toBe('pending'); f.purse.add(7, false);
  expect(f.checkpoint()).toBe(false);
  const fresh = f.fresh();
  expect(fresh.instance(clientStateSave, { id: fact.instance }).read()).toEqual(f.state);
  expect(new Purse('template', fresh.define(purseDefinition)).coins).toBe(7);
  expect(Object.values(ledger(fresh).state().items)).toHaveLength(0);
  f.local.blocked.clear(); expect(f.checkpoint()).toBe(true);
  const reloaded = ledger(f.fresh()); expect(Object.values(reloaded.state().items)).toEqual([{ item: 'gear.sword', tier: 1, quantity: 1 }]);
  expect(reloaded.record(fact).status).toBe('duplicate'); expect(Object.values(reloaded.state().items)[0]?.quantity).toBe(1);
});
it('retains unsaved coins after quota failure and retries the exact balance before confirming a crossing', () => {
  const f = fixture(); f.local.blocked.add('wildshard.save.v2.template');
  f.purse.add(5); expect(f.purse.unsaved).toBe(true); expect(f.purse.flush()).toBe(false);
  expect(f.checkpoint()).toBe(false);
  expect(f.fresh().instance(clientStateSave, { id: fact.instance }).read()).toEqual(f.state);
  expect(new Purse('template', f.fresh().define(purseDefinition)).coins).toBe(0);
  f.purse.add(2, false); f.local.blocked.clear(); expect(f.checkpoint()).toBe(true);
  expect(f.purse.unsaved).toBe(false); expect(new Purse('template', f.fresh().define(purseDefinition)).coins).toBe(7);
  expect(f.checkpoint()).toBe(true); expect(new Purse('template', f.fresh().define(purseDefinition)).coins).toBe(7);
});
it('refuses a local checkpoint on continuation/encounter quota and persists both current records on retry', () => {
  const f = fixture(); f.local.blocked.add('wildshard.save.v2.template-solo');
  expect(f.checkpoint()).toBe(false);
  expect(f.fresh().instance(clientStateSave, { id: fact.instance }).read()).toBeNull();
  f.local.blocked.clear(); expect(f.checkpoint()).toBe(true);
  const fresh = f.fresh(); expect(fresh.instance(encountersDefinition, { id: fact.instance }).read()).toBe(true);
  expect(fresh.instance(clientStateSave, { id: fact.instance }).read()).toEqual(f.state);
});
it('stops every automatic checkpoint after a successful New-game handoff without reviving the old continuation', () => {
  const f = fixture(), saver = clientCheckpoint(f.ports);
  expect(saver.checkpoint()).toBe(true);
  expect(f.fresh().instance(clientStateSave, { id: fact.instance }).read()).toEqual(f.state);
  expect(f.fresh().resetShard({ id: fact.instance })).toBe(true);
  saver.suppress();
  f.purse.add(7, false);
  for (let tick = 0; tick < 600; tick++) expect(saver.checkpoint()).toBe(false);
  expect(f.fresh().instance(clientStateSave, { id: fact.instance }).read()).toBeNull();
  expect(f.fresh().instance(encountersDefinition, { id: fact.instance }).read()).toBe(false);
});
