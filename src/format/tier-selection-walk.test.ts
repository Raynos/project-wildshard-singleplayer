import { expect, test } from 'vitest';
import { stringsSteps } from './tierSelection';

// Original stack walk, independent of the filtered pending queue.
function original(roots: readonly unknown[]): string[] {
  const pending: unknown[] = [...roots], result: string[] = [];
  while (pending.length > 0) {
    const value = pending.pop();
    if (typeof value === 'string') result.push(value);
    else if (Array.isArray(value)) { const values: readonly unknown[] = value; for (const child of values) pending.push(child); }
    else if (typeof value === 'object' && value !== null) for (const key in value) if (Object.hasOwn(value, key)) {
      result.push(key); const child: unknown = Reflect.get(value, key); pending.push(child);
    }
  }
  return result;
}

test('typed selection keeps exact own keys and reverse-depth string order', () => {
  const row = { 7: 12, named: ['phone.bin', 4, false, null, { desktop: 'desktop.bin', matrix: [1, 0, 0, 1] }], empty: undefined };
  Object.setPrototypeOf(row, { ignored: 'foreign.bin' });
  const roots = [0, 'first', row, ['last', true, ['nested', 5]], null];
  const expected = original(roots), actual: string[] = [];
  const work = stringsSteps(roots, text => { actual.push(text); });
  let result = work.next(); while (result.done !== true) result = work.next();
  expect(actual).toEqual(expected);
  expect(actual).toContain('7'); expect(actual).not.toContain('ignored'); expect(actual).not.toContain('foreign.bin');
});

test('large numeric tables do not change selected addresses or key callbacks', () => {
  const matrix = Array.from({ length: 20000 }, (_, i) => i / 7);
  const roots = [{ matrix, end: 'wanted.bin', rows: [matrix, { 123: false, named: 'last.bin' }] }];
  const actual: string[] = [];
  const work = stringsSteps(roots, text => { actual.push(text); });
  let result = work.next(), paints = 0;
  while (result.done !== true) { paints++; result = work.next(); }
  expect(actual).toEqual(original(roots));
  expect(paints).toBeGreaterThanOrEqual(9); // Numeric scans retain bounded paint checkpoints.
});
