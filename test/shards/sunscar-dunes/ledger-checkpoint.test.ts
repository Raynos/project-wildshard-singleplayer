import { expect, it, vi } from 'vitest';
import { app } from '../../../src/engine/app/runtime';
import { Scope } from '../../../src/engine/app/scope';
import { withOwner } from '../../../src/engine/app/ownership';
import { Progress } from '../../../src/game/Progress';
import { progressSave, purseSave } from '../../../src/game/saves';
import { bindSignalFacts } from '../../../src/shards/sunscar-dunes/runtime/persistence';
import { FACT } from '../../../src/shards/sunscar-dunes/quests/signal';
import source from '../../../src/shards/sunscar-dunes/shard.config';

it('refuses the real Progress checkpoint until its emitting ledger is durable, then rebinds without a second grant', () => {
  localStorage.clear(); const scope = new Scope('signal.ledger-checkpoint'), slug = source.identity.slug;
  try { withOwner(scope, () => {
    const metadata = { counts: {}, earned: [], title: null, playS: 125 };
    progressSave.write(metadata, slug); purseSave.write(25, slug);
    const progress = new Progress(slug), facts = bindSignalFacts({ app }, progress);
    const original = localStorage.setItem.bind(localStorage);
    const write = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === 'wildshard.save.v2.profile') throw new Error('Quota');
      original(key, value);
    });
    facts(FACT.signal, 'sunscar.signal');
    expect(facts.achievement('sunscar.signal')).toEqual({ count: 1, earned: true });
    expect(progress.checkpoint()).toBe(false); expect(progress.rows).toEqual([]);
    write.mockRestore(); expect(progress.checkpoint()).toBe(true);
    const profile = localStorage.getItem('wildshard.save.v2.profile');
    const rebound = bindSignalFacts({ app }, new Progress(slug));
    rebound(FACT.signal, 'sunscar.signal');
    expect(rebound.achievement('sunscar.signal')).toEqual({ count: 1, earned: true });
    expect(localStorage.getItem('wildshard.save.v2.profile')).toBe(profile);
    expect(progressSave.read(slug)).toEqual(metadata); expect(purseSave.read(slug)).toBe(25);
  }); } finally { scope.dispose(); }
});
