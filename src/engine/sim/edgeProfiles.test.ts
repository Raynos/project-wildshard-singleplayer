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
