import { expect, test, vi } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { app } from '../src/engine/app/runtime';
import { bindAdventurePersistence } from '../src/game/quest/persistence';
import { readQuestObservation } from '../src/game/quest/chapterBindings';
import source from '../src/shards/nalati-grasslands/shard.config';
import rows from '../src/shards/nalati-grasslands/data/persistence.generated.json' with { type: 'json' };

const saved = { kokbori: { timer: 0, discovered: false, skinTaken: false, kills: 1, retired: false },
  other: { timer: 0, discovered: false, skinTaken: false, kills: 2, retired: false } };

function fixture(name: string) {
  const scope = new Scope(name);
  const persistence = bindAdventurePersistence({ app, scope }, source, rows, name);
  return { scope, persistence };
}

test('saved projections propagate the original quest/save listener failure', () => {
  const { scope, persistence } = fixture('chapter-save-failure'), failure = new Error('Quest could not persist');
  scope.onDispose(persistence.flags.onChange(flag => { if (flag === 'felled:kokbori') throw failure; }));
  try {
    expect(() => persistence.elites.write(saved)).toThrow(failure);
    expect(persistence.flags.has('felled:kokbori')).toBe(true);
  } finally { scope.dispose(); }
});

test('typed elite reads recover only read failures and do not publish flags', () => {
  const { scope, persistence } = fixture('chapter-read-failure');
  const read = vi.spyOn(persistence.elites, 'read');
  try {
    const ref = { saved: { record: 'elites', id: 'kokbori', field: 'kills' } } as const;
    read.mockImplementation(() => { throw new Error('Old save is unavailable'); });
    expect(readQuestObservation({ scope }, 'tulpar', ref)).toBe(0);
    read.mockReturnValue(saved);
    expect(readQuestObservation({ scope }, 'tulpar', ref)).toBe(1);
    expect(readQuestObservation({ scope }, 'tulpar', { saved: { record: 'elites', id: 'absent', field: 'kills' } })).toBe(0);
    expect(persistence.flags.all).toEqual([]);
    expect(() => readQuestObservation({ scope }, 'tulpar', { saved: { record: 'elites', id: 'kokbori', field: 'defeated' } })).toThrow('kill field');
  } finally { read.mockRestore(); scope.dispose(); }
});
