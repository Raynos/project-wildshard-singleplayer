import { expect, test } from 'vitest';
import { immutableEdgeProfile, validateEdgeProfile } from './edgeProfiles';

const row = () => ({ roadHeight: 0, heights: Array.from({ length: 256 }, () => 0),
  colours: Array.from({ length: 256 }, () => [0.2, 0.4, 0.6]) });

test('admitted edge rows detach and freeze every numeric leaf', () => {
  const input = row(), admitted = immutableEdgeProfile(input);
  expect(admitted).toEqual(input);
  input.heights[0] = Number.NaN; input.colours[0]?.splice(0, 1, 2);
  expect(() => validateEdgeProfile(input)).toThrow('Invalid edge profile');
  expect(() => validateEdgeProfile(admitted)).not.toThrow();
  expect(Object.isFrozen(admitted)).toBe(true);
  expect(Object.isFrozen(admitted.heights)).toBe(true);
  expect(Object.isFrozen(admitted.colours)).toBe(true);
  expect(admitted.colours.every(rgb => Object.isFrozen(rgb))).toBe(true);
});

test('caller freezing cannot grant a validation proof or mask later changes', () => {
  const input = Object.freeze(row());
  validateEdgeProfile(input);
  input.colours[0]?.splice(0, 1, 2);
  expect(() => validateEdgeProfile(input)).toThrow('Invalid edge colour');
  expect(() => immutableEdgeProfile(input)).toThrow('Invalid edge colour');
  const invalid = row(); invalid.heights[8] = 251;
  expect(() => immutableEdgeProfile(invalid)).toThrow('Invalid edge profile');
  expect(() => immutableEdgeProfile({ ...row(), roadHeight: 1 })).toThrow('Invalid edge profile');
});

test('equal consecutive RGB leaves share only private frozen values, preserving signed zero', () => {
  const input = row(); input.colours[2] = [-0, 0.4, 0.6]; input.colours[3] = [0, 0.4, 0.6];
  const admitted = immutableEdgeProfile(input);
  expect(admitted).toEqual(input);
  expect(admitted.colours[0]).toBe(admitted.colours[1]);
  expect(admitted.colours[0]).not.toBe(input.colours[0]);
  expect(admitted.colours[2]).not.toBe(admitted.colours[3]);
  expect(Object.is(admitted.colours[2]?.[0], -0)).toBe(true);
  expect(Object.is(admitted.colours[3]?.[0], 0)).toBe(true);
  input.colours[0]?.fill(Number.NaN);
  expect(admitted.colours[0]).toEqual([0.2, 0.4, 0.6]);
  expect(admitted.colours.every(rgb => Object.isFrozen(rgb))).toBe(true);
});

test.each([[0.2, 0.4], [0.2, 0.4, 0.6, 0.8], [0.2, Number.NaN, 0.6], [0.2, 0.4, 2]])('repeated RGB leaves cannot mask malformed input %j', (...bad) => {
  const input = row(); input.colours[127] = bad;
  expect(() => immutableEdgeProfile(input)).toThrow('Invalid edge colour');
});

test('RGB source iterators are still consumed independently before sharing', () => {
  const input = row(); let reads = 0; const colour = [0.2, 0.4, 0.6];
  Object.defineProperty(colour, Symbol.iterator, { *value() { reads++; yield 0.2; yield 0.4; yield reads === 2 ? 2 : 0.6; } });
  input.colours[0] = colour; input.colours[1] = colour;
  expect(() => immutableEdgeProfile(input)).toThrow('Invalid edge colour');
  expect(reads).toBe(2);
});
