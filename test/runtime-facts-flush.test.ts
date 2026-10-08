import { expect, it, vi } from 'vitest';
import { App } from '../src/engine/app/app';
import { bindRuntimeLedger } from '../src/game/shardfile/hybridRows';
import { parseShardfile } from '../src/game/shardfile/schema';
import { emptyShardfile } from '../src/sdk/author';

it('exposes the runtime ledger pending-write result and retries the same fact without another grant', () => {
  const app = new App(), origin = { kind: 'engine' as const, source: 'encounter.outcome' };
  const source = parseShardfile({ ...emptyShardfile({ slug: 'nalati-grasslands', name: 'Nalati', author: 'fixture', revision: 1, seed: 1 }),
    runtime: { entry: 'runtime/index.ts', binds: ['ledger'] },
    ledger: [{ fact: 'encounter.won', origin, rewards: [{ kind: 'achievement', id: 'fixture', title: 'Fixture', threshold: 2 }] }] });
  try {
    const facts = bindRuntimeLedger({ app }, source, 'nalati-grasslands');
    expect(facts.achievement('fixture')).toBeUndefined();
    expect(facts.achievement('unknown')).toBeUndefined();
    const write = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('Profile quota'); });
    expect(facts('encounter.won', 'boss.first').status).toBe('pending');
    expect(facts.flush()).toBe(false); expect(facts.flush()).toBe(false);
    expect(facts.achievement('fixture')).toEqual({ count: 1, earned: false });
    write.mockRestore();
    expect(facts.flush()).toBe(true);
    expect(facts('encounter.won', 'boss.first').status).toBe('duplicate');
    expect(facts.achievement('fixture')).toEqual({ count: 1, earned: false });
    expect(facts('encounter.won', 'boss.second').status).toBe('granted');
    expect(facts.achievement('fixture')).toEqual({ count: 2, earned: true });
    expect(facts('encounter.won', 'boss.second').status).toBe('duplicate');
    expect(facts.achievement('fixture')).toEqual({ count: 2, earned: true });
  } finally { app.engineScope.dispose(); }
});
