import { expect, it } from 'vitest';
import { SCRIPT_V1_COMMANDS, SCRIPT_V1_EVENTS, SCRIPT_V1_LAYOUT, SCRIPT_V1_LISTS, SCRIPT_V1_READS, scriptV1Layout } from '@wildshard/format/scriptAbiV1';

it('keeps the declared wire ids and separate view command range', () => {
  expect(SCRIPT_V1_EVENTS['move.done']).toBe(10);
  expect(SCRIPT_V1_EVENTS['strike.target']).toBe(14);
  expect(SCRIPT_V1_READS.random).toBe(12);
  expect(SCRIPT_V1_READS.bearing).toBe(19);
  expect(SCRIPT_V1_READS.stunned).toBe(20);
  expect(SCRIPT_V1_LISTS.path).toBe(5);
  expect(SCRIPT_V1_COMMANDS.encounter).toBe(15);
  expect(SCRIPT_V1_COMMANDS['view.channel']).toBe(100);
  for (const table of [SCRIPT_V1_COMMANDS, SCRIPT_V1_EVENTS, SCRIPT_V1_LISTS, SCRIPT_V1_READS]) {
    expect(new Set(Object.values(table)).size).toBe(Object.keys(table).length);
  }
});

it('packs every bounded IO record after the eight-slot header', () => {
  expect(scriptV1Layout(0, 0)).toEqual({ state: 8, params: 8, inbox: 8, outbox: 104, bytes: 2112 });
  expect(scriptV1Layout(16, 32)).toEqual({ state: 8, params: 24, inbox: 56, outbox: 152, bytes: 2496 });
  expect(SCRIPT_V1_LAYOUT.fixedHz / SCRIPT_V1_LAYOUT.decisionDivisor).toBe(10);
});

it('refuses dimensions that would cross the declared IO ceilings', () => {
  for (const count of [-1, 0.5, 17, Number.NaN, Number.POSITIVE_INFINITY]) expect(() => scriptV1Layout(count, 0)).toThrow('dimensions');
  for (const count of [-1, 0.5, 33, Number.NaN, Number.POSITIVE_INFINITY]) expect(() => scriptV1Layout(0, count)).toThrow('dimensions');
});
