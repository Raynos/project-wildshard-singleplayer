import { expect, test } from 'vitest';
import { EncounterSlots } from '../src/game/boss/encounterPatrol';
import { ReturnProgram } from '../src/game/population/returnProgram';
import night from '../src/shards/nalati-grasslands/data/night.generated.json' with { type: 'json' };

const make = (): EncounterSlots => new EncounterSlots(night.slots, ReturnProgram.page(night.program));

test('static encounter slots wake once, rotate each night, and go home at dawn', () => {
  const host = make();
  expect(host.update(.05, { kind: 1 }, []).cycle).toEqual({});
  expect(host.update(.05, { kind: 1 }, []).cycle).toMatchObject({ spawn: 1, t: 0 });
  expect(host.select({ count: 12, night: host.cycle['t'] ?? 0 })).toEqual([0,2,4,7,9]);
  expect(host.update(.1, { kind: 1 }, []).cycle['spawn']).toBe(0);
  expect(host.update(.1, { kind: 0 }, []).cycle['dissolve']).toBe(1);
  expect(host.update(.1, { kind: 0 }, []).cycle['dissolve']).toBe(0);
  expect(host.update(.1, { kind: 1 }, []).cycle).toMatchObject({ spawn: 1, t: 1 });
  expect(host.select({ count: 12, night: host.cycle['t'] ?? 0 })).toEqual([2,4,6,0,10]);
});

test('a slot publishes its break once and the shared owner keeps its retirement clock', () => {
  const host = make(); host.add('stone');
  expect(host.update(.1, { kind: 1 }, [{ id: 'stone', fields: { alive: 0, gone: 0 } }]).members.get('stone')).toMatchObject({ broken: 1, retire: 0 });
  expect(host.update(.1, { kind: 1 }, [{ id: 'stone', fields: { alive: 0, gone: 0 } }]).members.get('stone')).toMatchObject({ broken: 0 });
  expect(host.update(3.2, { kind: 1 }, [{ id: 'stone', fields: { alive: 0, gone: 0 } }]).members.get('stone')).toMatchObject({ retire: 1 });
  host.remove('stone'); host.add('stone');
  expect(host.update(.1, { kind: 0 }, [{ id: 'stone', fields: { alive: 1, gone: 1 } }]).members.get('stone')).toMatchObject({ statue: 1, retire: 1 });
});

test('an unrelated orchard sentry roster selects only its own three authored slots', () => {
  const host = make(); host.update(.1, { kind: 1 }, []);
  const selected = host.select({ count: 3, night: 0 });
  expect(selected).toEqual([0,2,1]);
  for (const [i, slot] of selected.entries()) host.add(`sentry-${slot}-${i}`);
  expect(() => host.add('sentry-0-0')).toThrow('Duplicate');
  expect(host.update(.1, { kind: 0 }, [{ id: 'sentry-0-0', fields: { alive: 1, gone: 1 } }]).members.get('sentry-0-0')).toMatchObject({ statue: 1, retire: 1 });
});

test('retired statues are restored once at dawn after their body has left the live roster', () => {
  const host = make(); host.update(.1, { kind: 1 }, []); host.add('broken');
  host.retire('broken', { index: 7 });
  expect(host.update(.1, { kind: 1 }, []).released).toEqual([]);
  expect(host.update(.1, { kind: 0 }, []).released).toEqual([{ index: 7 }]);
  expect(host.update(.1, { kind: 0 }, []).released).toEqual([]);
});

test('a corpse that retires after dawn still restores its statue during the day', () => {
  const host = make(); host.update(.1, { kind: 1 }, []); host.add('late');
  host.update(.1, { kind: 0 }, []); host.retire('late', { index: 3 });
  expect(host.update(.1, { kind: 0 }, []).released).toEqual([{ index: 3 }]);
});
