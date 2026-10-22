import { expect, test } from 'vitest';
import { parseEliteEntryRows } from '../src/format/eliteEntryRows';

function native() {
  return { kind: 'pouncer' as const, profile: 'ridge-pounce', observations: 'ridge-inputs', body: 'wildlife', model: 'ridge-drop',
    spawn: { kind: 'reed-cat', variant: 'silver', yaw: .75, offset: [2, -3], memory: { low: .3 } },
    contacts: [{ amount: 14, action: 1 }], knock: 2, opened: 3, growl: 4 };
}
function rows() {
  return { version: 1, id: 'shore-elites', ui: 'entered-display', conditionObservations: 'condition-inputs',
    conditions: [{ id: 'night', program: 'night-rules', signal: 'rule', observations: [{ field: 'rule', value: 2 }] }],
    entries: [{ id: 'ridge', condition: 'night', controller: native() },
      { id: 'rider', condition: 'night', controller: { kind: 'borrowed' as const, controller: 'rider-owner' } }] };
}

test('ordered native construction and the borrowed original owner remain distinct data rows', () => {
  const input = rows(), parsed = parseEliteEntryRows(input);
  expect(parsed).toEqual(input); expect(parsed).not.toBe(input);
  expect(parsed.entries.map(row => row.id)).toEqual(['ridge', 'rider']);
  const original = input.entries[0]?.controller;
  if (original?.kind !== 'pouncer') throw new Error('Missing native source');
  original.contacts.push({ amount: 35, action: 5 });
  const controller = parsed.entries[0]?.controller;
  if (controller?.kind !== 'pouncer') throw new Error('Missing native row');
  expect(controller.contacts).toEqual([{ amount: 14, action: 1 }]);
});

test('borrowed owners reject native construction fields and unknown factories', () => {
  for (const extra of [{ body: 'wildlife' }, { model: 'ridge-drop' }, { profile: 'ridge-pounce' }, { spawn: native().spawn }, { factory: 'make.rider' }]) {
    const input = rows(); input.entries = [{ id: 'rider', condition: 'night', controller: { kind: 'borrowed' as const, controller: 'rider-owner', ...extra } }];
    expect(() => parseEliteEntryRows(input)).toThrow();
  }
});

test('native rows require all consumed profile, body and model references', () => {
  for (const missing of ['profile', 'body', 'model', 'observations']) {
    const input = rows(); const controller: Record<string, unknown> = native(); delete controller[missing];
    expect(() => parseEliteEntryRows({ ...input, entries: [{ id: 'ridge', condition: 'night', controller }] })).toThrow();
  }
});

test('duplicate conditions, fields, entries and contact mappings refuse before native admission', () => {
  const input = rows();
  expect(() => parseEliteEntryRows({ ...input, entries: [...input.entries, input.entries[0]] })).toThrow();
  expect(() => parseEliteEntryRows({ ...input, conditions: [...input.conditions, input.conditions[0]] })).toThrow();
  expect(() => parseEliteEntryRows({ ...input, conditions: [{ id: 'night', program: 'rules', signal: 'rule', observations: [{ field: 'rule', value: 1 }, { field: 'rule', value: 2 }] }] })).toThrow();
  const controller = native(); controller.contacts.push({ amount: 14, action: 2 });
  expect(() => parseEliteEntryRows({ ...input, entries: [{ id: 'ridge', condition: 'night', controller }] })).toThrow();
  expect(() => parseEliteEntryRows({ ...input, conditions: [] })).toThrow();
});

test('authored getters, reflected paths and non-finite native values are refused without invocation', () => {
  let reads = 0;
  const input = rows();
  expect(() => parseEliteEntryRows({ ...input, get entries() { reads++; return []; } })).toThrow();
  expect(reads).toBe(0);
  expect(() => parseEliteEntryRows({ ...input, conditionObservations: 'world.weather[0]' })).toThrow();
  expect(() => parseEliteEntryRows({ ...input, entries: [{ id: 'ridge', condition: 'night', controller: { ...native(), spawn: { ...native().spawn, yaw: Infinity } } }] })).toThrow();
});
