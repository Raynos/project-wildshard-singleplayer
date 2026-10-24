import { expect, test } from 'vitest';
import { parseClientPlan } from './clientPlan';

test('cross-section ownership reuses only an owned immutable plan', () => {
  const input = { version: 1, features: [{ kind: 'world.scenes' }] };
  const plan = parseClientPlan(input);
  expect(plan).toEqual(input);
  expect(plan).not.toBe(input);
  expect(parseClientPlan(plan)).toBe(plan);
  expect(() => plan.features.push({ kind: 'world.scenes' })).toThrow(TypeError);
  const row = plan.features[0];
  if (row === undefined) throw new Error('Missing feature');
  expect(Object.isFrozen(row)).toBe(true);
  input.features.push({ kind: 'world.scenes' });
  expect(() => parseClientPlan(input)).toThrow('Duplicate client feature');
  expect(parseClientPlan(plan)).toBe(plan);
  const copy = structuredClone(plan);
  copy.features.push({ kind: 'world.scenes' });
  expect(() => parseClientPlan(copy)).toThrow('Duplicate client feature');
});

test('frozen inputs cannot forge admission or execute accessors', () => {
  let reads = 0;
  const input = Object.freeze({ version: 1, get features() { reads++; return []; } });
  expect(() => parseClientPlan(input)).toThrow('plain JSON');
  expect(reads).toBe(0);
  expect(() => parseClientPlan(Object.freeze({ version: 1, features: [{ kind: 'missing' }] }))).toThrow();
  expect(() => parseClientPlan({ version: 1, features: [], run: () => null })).toThrow();
});
