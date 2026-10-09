import { expect, it } from 'vitest';
import { Ledger } from '../../../src/game/ledger';
import { SaveStore } from '../../../src/engine/saves/store';
import { MemoryStorage } from '../../setup';
import { fixture, hall } from './native';

it('turns the actual hall completion into one durable achievement across profile reopen', async () => {
  const f = await fixture(), host = await f.open();
  try {
    const result = await hall(host), emission = result.emissions.find(row => row.effect.kind === 'fact' && row.effect.name === 'blender.hall');
    if (emission?.effect.kind !== 'fact') throw new Error('No gameplay quest fact');
    const local = new MemoryStorage(), instances = [{ id: 'blender-template-1', shard: 'blender-template' }];
    const create = () => new Ledger(new SaveStore({ local, session: null }), instances, [{ shard: 'blender-template', revision: f.shard.identity.revision, rules: f.shard.ledger }], []);
    const fact = { instance: 'blender-template-1', shard: 'blender-template', revision: f.shard.identity.revision, entity: emission.effect.actorId,
      tick: emission.tick, ordinal: 0, name: emission.effect.name, origin: { kind: 'engine' as const, source: 'quest.complete' } };
    expect(create().record(fact).status).toBe('granted');
    const reopened = create(); expect(reopened.record(fact).status).toBe('duplicate');
    expect(Object.values(reopened.state().achievements)).toEqual([{ shard: 'blender-template', id: 'blender.firstHall', title: 'The clay hall', count: 1, threshold: 1, earned: true }]);
  } finally { await host.dispose(); }
}, 60_000);
