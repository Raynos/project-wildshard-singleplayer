import { expect, test } from 'vitest';
import { pinProgramReferences, RETAINED_PROGRAM_LIMIT, type ProgramReference } from '../src/engine/render/programRetention';
import { selectedBootCell } from '../src/game/grid/bootProgramSelection';

test('one program hold survives source retirement, is idempotent and releases through its material owner', () => {
  const program: ProgramReference = { cacheKey: 'one', usedTimes: 1 }, held = new Map<string, ProgramReference>();
  expect(pinProgramReferences(held, [program, program])).toBe(1);
  expect(program.usedTimes).toBe(2);
  expect(pinProgramReferences(held, [program])).toBe(1);
  program.usedTimes -= 1; // Three retires the original world's material.
  expect(program.usedTimes).toBe(1);
  program.usedTimes += 1; // A later world acquires the same cached native program.
  for (const item of held.values()) item.usedTimes -= 1; // Three disposes the holder material.
  expect(program.usedTimes).toBe(1);
});

test('capacity and invalid cache identities refuse before any program reference changes', () => {
  const full = Array.from({ length: RETAINED_PROGRAM_LIMIT + 1 }, (_, i) => ({ cacheKey: String(i), usedTimes: 1 }));
  const held = new Map<string, ProgramReference>();
  expect(() => pinProgramReferences(held, full)).toThrow('bound');
  expect(held.size).toBe(0); expect(full.every(program => program.usedTimes === 1)).toBe(true);
  const old = { cacheKey: 'one', usedTimes: 1 }; held.set('one', old);
  const other = { cacheKey: 'two', usedTimes: 1 };
  expect(() => pinProgramReferences(held, [other, { cacheKey: 'one', usedTimes: 1 }])).toThrow('reference');
  expect(other.usedTimes).toBe(1); expect(held.size).toBe(1);
});

test('one explicit admitted cell is selected only in Developer; absent and stale picks stay off', () => {
  const rows = [{ instance: 'home', label: 'Home' }, { instance: 'next', label: 'Next' }];
  expect(selectedBootCell(rows, 'next', true)).toBe('next');
  expect(selectedBootCell(rows, 'next', false)).toBeNull();
  expect(selectedBootCell(rows, 'off', true)).toBeNull();
  expect(selectedBootCell(rows, 'stale', true)).toBeNull();
  expect(selectedBootCell(rows, undefined, true)).toBeNull();
});
