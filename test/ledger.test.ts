// oxlint-disable-next-line import/no-nodejs-modules -- The fixture boots real Rapier WASM in Node.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import * as v from 'valibot';
import { SaveStore } from '../src/engine/saves/store';
import { createSimHost, type SimHost } from '../src/engine/sim';
import { snapshotSimHost, restoreSimHost } from '../src/engine/sim/snapshot';
import { loadRapier, type Rapier } from '../src/engine/physics/rapier';
import { Ledger, installLedgerEmitter, ledgerFactId } from '../src/game/ledger';
import { parseLedgerRules, type LedgerFact } from '../src/game/shardfile/ledger';
import { firstPartyInstance, templateInstance } from '../src/game/grid/instances';
import { TEMPLATE_LEDGER } from '../src/shards/_template/data/ledger';
import { MemoryStorage } from './setup';
import { SIM_LEVEL, fightCommand } from './fixtures/sim-level/level';

const PROFILE = 'wildshard.save.v2.profile';
const origin = { kind: 'engine' as const, source: 'quest.complete' };
const rules = parseLedgerRules([{ fact: 'arena.complete', origin, rewards: [
  { kind: 'catalogue', item: 'gear.iron-sword', tier: 1, quantity: 1 },
  { kind: 'achievement', id: 'arena', title: 'ARENA CLEAR', threshold: 1 },
] }]);
class Storage extends MemoryStorage {
  failures = 0;
  readonly writes: string[] = [];
  override setItem(key: string, value: string): void {
    if (key === PROFILE && value.includes('platform.ledger')) {
      if (this.failures > 0) { this.failures--; throw new Error('Quota'); }
      this.writes.push(value);
    }
    super.setItem(key, value);
  }
}
const instances = [{ id: 'template-1', shard: 'template', cell: [1, 0] as const }, { id: 'template-2', shard: 'template', cell: [-1, 0] as const }];
function fixture(local = new Storage(), store = new SaveStore({ local, session: null }), revision = 1) {
  return { local, store, ledger: new Ledger(store, instances, [{ shard: 'template', revision, rules }], [{ id: 'gear.iron-sword', maxTier: 1 }]) };
}
const fact = (overrides: Partial<LedgerFact> = {}): LedgerFact => ({ instance: 'template-1', shard: 'template', revision: 1, entity: 'actor.player', tick: 141, ordinal: 0, name: 'arena.complete', origin, ...overrides });
const itemQuantity = (ledger: Ledger): number => Object.values(ledger.state().items).reduce((total, item) => total + item.quantity, 0);

it('commits profile gear, achievements and fact provenance together, preserving unrelated keys', () => {
  const { ledger, store, local } = fixture();
  store.define({ key: 'identity', scope: 'profile', version: 1, schema: v.string(), initial: () => '' }).write('Player');
  expect(ledger.record(fact()).status).toBe('granted');
  expect(local.writes).toHaveLength(1);
  expect(local.writes[0]).toContain('"identity"'); expect(local.writes[0]).toContain('"facts"'); expect(local.writes[0]).toContain('"items"');
  expect(ledger.state().facts[ledgerFactId(fact())]).toEqual(fact());
  expect(itemQuantity(ledger)).toBe(1); expect(Object.values(ledger.state().achievements)).toEqual([{ shard: 'template', id: 'arena', title: 'ARENA CLEAR', count: 1, threshold: 1, earned: true }]);
  expect(ledger.record(fact()).status).toBe('duplicate'); expect(itemQuantity(ledger)).toBe(1);
  expect(local.getItem('wildshard.save.v2.template-1')).toBeNull();
});

it('replayed and reloaded facts grant once; separate instances grant gear independently and share one profile achievement', () => {
  const first = fixture(); first.ledger.record(fact());
  const reloaded = fixture(first.local); expect(reloaded.ledger.record(fact()).status).toBe('duplicate');
  expect(reloaded.ledger.record(fact({ instance: 'template-2' })).status).toBe('granted');
  expect(itemQuantity(reloaded.ledger)).toBe(2); expect(Object.keys(reloaded.ledger.state().facts)).toHaveLength(2);
  expect(Object.keys(reloaded.ledger.state().achievements)).toHaveLength(1);
  const revised = fixture(first.local, new SaveStore({ local: first.local, session: null }), 2);
  revised.ledger.record(fact({ revision: 2 })); expect(itemQuantity(revised.ledger)).toBe(3);
  expect(Object.keys(revised.ledger.state().achievements)).toHaveLength(1);
});

it('retries failed atomic writes without applying the reward twice, including reconstruction against memory fallback', () => {
  const first = fixture(); first.local.failures = 2;
  expect(first.ledger.record(fact()).status).toBe('pending');
  expect(first.local.getItem(PROFILE)).toBeNull(); expect(itemQuantity(fixture(first.local).ledger)).toBe(0);
  expect(first.ledger.flush()).toBe(false); expect(first.local.getItem(PROFILE)).toBeNull();
  const rebuilt = fixture(first.local, first.store);
  expect(rebuilt.ledger.record(fact()).status).toBe('duplicate');
  expect(first.local.writes).toHaveLength(1); expect(itemQuantity(fixture(first.local).ledger)).toBe(1);
  expect(first.ledger.flush()).toBe(true); expect(itemQuantity(first.ledger)).toBe(1);
});

it('keeps cell relocation and mode switches out of save/fact identity', () => {
  expect(firstPartyInstance('driftwood-isle')).toBe('driftwood-isle'); expect(firstPartyInstance('_template')).toBe('template-solo');
  expect(firstPartyInstance('template')).toBe('template-solo'); expect(templateInstance(1)).toBe('template-1'); expect(templateInstance(6)).toBe('template-6');
  expect(() => templateInstance(0)).toThrow();
  const local = new Storage(), moved = instances.map((instance) => ({ ...instance, cell: [99, -10] as const }));
  const first = fixture(local); first.ledger.record(fact());
  const relocated = new Ledger(new SaveStore({ local, session: null }), moved, [{ shard: 'template', revision: 1, rules }], [{ id: 'gear.iron-sword', maxTier: 1 }]);
  expect(relocated.record(fact()).status).toBe('duplicate'); expect(itemQuantity(relocated)).toBe(1);
  expect(ledgerFactId(fact())).toBe('["template-1","template",1,"actor.player",141,0]');
});

it('rejects forged provenance, identity reuse, unknown catalogue rewards and global coin mappings', () => {
  const { ledger, store } = fixture();
  for (const bad of [fact({ instance: 'unknown' }), fact({ revision: 2 }), fact({ origin: { kind: 'script', source: 'quest.complete' } }), fact({ tick: Number.NaN })]) expect(() => ledger.record(bad)).toThrow();
  ledger.record(fact());
  expect(() => ledger.record(fact({ name: 'another.outcome' }))).toThrow();
  for (const reward of [{ kind: 'catalogue', item: 'god-sword', tier: 1, quantity: 1 }, { kind: 'catalogue', item: 'gear.iron-sword', tier: 2, quantity: 1 }, { kind: 'coin', quantity: 100 }]) {
    expect(() => new Ledger(store, instances, [{ shard: 'template', revision: 1, rules: parseLedgerRules([{ fact: 'bad', origin, rewards: [reward] }]) }], [{ id: 'gear.iron-sword', maxTier: 1 }])).toThrow();
  }
  expect(itemQuantity(ledger)).toBe(1);
  expect(parseLedgerRules(TEMPLATE_LEDGER)[0]?.rewards[0]?.kind).toBe('achievement');
});

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
it('records a real fixture quest fact and snapshot-restored suffix without a second profile grant', () => {
  const { ledger } = fixture();
  const install = (host: SimHost): void => {
    const emitter = installLedgerEmitter(host, ledger, { instance: 'template-1', shard: 'template', revision: 1 }, origin);
    const quest = host.quests[0]; if (quest === undefined) throw new Error('Missing fixture quest');
    host.scope.onDispose(quest.observe({ complete: () => { emitter.emit('arena.complete', host.player.id); } }));
  };
  const first = createSimHost(SIM_LEVEL, { rapier }); install(first);
  let restored: SimHost | undefined;
  try {
    for (let tick = 0; tick < 20; tick++) first.step(fightCommand(tick));
    const saved = snapshotSimHost(first), serialized = JSON.stringify(saved);
    restored = restoreSimHost(SIM_LEVEL, { rapier }, JSON.parse(serialized) as typeof saved, install);
    for (let tick = 20; tick < 600; tick++) { first.step(fightCommand(tick)); restored.step(fightCommand(tick)); }
    expect(first.flags.has('quest:arena')).toBe(true); expect(itemQuantity(ledger)).toBe(1);
    expect(Object.keys(ledger.state().facts)).toHaveLength(1);
    expect(snapshotSimHost(restored)).toEqual(snapshotSimHost(first));
    expect(first.slots.ledgerDedupe).toHaveLength(1);
  } finally { restored?.dispose(); first.dispose(); }
});
