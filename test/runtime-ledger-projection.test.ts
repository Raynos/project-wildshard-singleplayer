import { afterEach, expect, it, vi } from 'vitest';
import { App } from '../src/engine/app/app';
import type { Progress, ProgressLedger } from '../src/game/Progress';
import { bindRuntimeLedger, projectRuntimeFacts, type RuntimeFacts } from '../src/game/plugin/headless';
import { bindNineFacts } from '../src/shards/nine-dragon-stack/runtime/facts';
import { bindSignalFacts } from '../src/shards/sunscar-dunes/runtime/persistence';
import nine from '../src/shards/nine-dragon-stack/shard.config';
import signal from '../src/shards/sunscar-dunes/shard.config';

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); localStorage.clear(); });
type View = Pick<Progress, 'bindLedger' | 'refreshLedger'>;
type Sink = (name: string, entity: string) => unknown;
const users = [{ name: 'Nine', source: nine, bind: bindNineFacts, voidResult: true },
  { name: 'Signal', source: signal, bind: bindSignalFacts, voidResult: false }];

for (const user of users) it(`${user.name} preserves every old receipt, view callback and saved profile byte through duplicate facts`, () => {
  vi.useFakeTimers({ now: 100000, toFake: ['Date'] });
  const run = (legacy: boolean): unknown => {
    localStorage.clear(); const app = new App(), events: unknown[] = [];
    let projection: ProgressLedger | undefined;
    const read = (): ProgressLedger => { if (projection === undefined) throw new Error('Missing bound view'); return projection; };
    const state = (): unknown => user.source.ledger.map(row => row.rewards.flatMap(reward => reward.kind === 'achievement'
      ? [[reward.id, read().count(reward.id), read().earned(reward.id)]] : []));
    const view: View = { bindLedger: ledger => { projection = ledger; events.push(['bind', state()]); },
      refreshLedger: () => { events.push(['refresh', state()]); } };
    try {
      let facts: Sink;
      if (legacy) {
        const emit = bindRuntimeLedger({ app }, user.source, user.source.identity.slug);
        const wrapped = Object.assign((name: string, entity: string) => {
          const receipt = emit(name, entity); view.refreshLedger(); return receipt;
        }, { flush: emit.flush, achievement: emit.achievement });
        const from = user.voidResult ? emit : wrapped;
        view.bindLedger({ count: id => from.achievement(id)?.count ?? 0, earned: id => from.achievement(id)?.earned ?? false, checkpoint: from.flush });
        facts = user.voidResult ? (name, entity) => { wrapped(name, entity); } : wrapped;
      } else facts = user.bind({ app }, view);
      const receipts: unknown[] = [];
      for (const row of user.source.ledger) {
        receipts.push(facts(row.fact, row.fact), facts(row.fact, row.fact));
        expect(read().checkpoint()).toBe(true);
      }
      const count = events.length;
      expect(() => facts('unknown.fact', 'unknown')).toThrow('Undeclared ledger fact');
      expect(events).toHaveLength(count);
      expect(read().count('unknown')).toBe(0); expect(read().earned('unknown')).toBe(false);
      if (user.voidResult) expect(receipts).toEqual(user.source.ledger.flatMap(() => [undefined, undefined]));
      return { events, receipts, profile: localStorage.getItem('wildshard.save.v2.profile') };
    } finally { app.engineScope.dispose(); }
  };
  expect(run(false)).toEqual(run(true));
});

it('retains exact pending-write/read ports and refreshes pending/duplicate receipts once', () => {
  localStorage.clear(); const app = new App(); let projection: ProgressLedger | undefined;
  const refresh = vi.fn<() => void>(), bind = vi.fn((ledger: ProgressLedger) => { projection = ledger; });
  try {
    const emit = bindRuntimeLedger({ app }, nine, nine.identity.slug), facts = projectRuntimeFacts(emit, { bindLedger: bind, refreshLedger: refresh });
    expect(facts.flush).toBe(emit.flush); expect(facts.achievement).toBe(emit.achievement); expect(bind).toHaveBeenCalledOnce();
    const row = nine.ledger[0]; if (row === undefined || projection === undefined) throw new Error('Missing bound ledger');
    const write = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('Quota'); });
    expect(facts(row.fact, 'arrival').status).toBe('pending'); expect(refresh).toHaveBeenCalledOnce();
    expect(projection.checkpoint()).toBe(false); expect(refresh).toHaveBeenCalledOnce();
    write.mockRestore(); expect(projection.checkpoint()).toBe(true);
    expect(facts(row.fact, 'arrival').status).toBe('duplicate'); expect(refresh).toHaveBeenCalledTimes(2);
    expect(() => facts('unknown.fact', 'unknown')).toThrow('Undeclared ledger fact'); expect(refresh).toHaveBeenCalledTimes(2);
  } finally { app.engineScope.dispose(); }
});

it('keeps both actual shard sinks usable without a Progress view', () => {
  for (const user of users) {
    localStorage.clear(); const app = new App();
    try {
      const facts: Sink = user.bind({ app }, undefined);
      const row = user.source.ledger[0];
      if (row === undefined) throw new Error('Missing authored fact');
      const receipt = facts(row.fact, row.fact);
      if (user.voidResult) expect(receipt).toBeUndefined();
      else expect(receipt).toMatchObject({ status: 'granted', recorded: true });
      const rebound: RuntimeFacts = bindRuntimeLedger({ app }, user.source, user.source.identity.slug);
      expect(rebound(row.fact, row.fact).status).toBe('duplicate');
    } finally { app.engineScope.dispose(); }
  }
});
