import { expect, test } from 'vitest';
import signs from '../data/signView.json' with { type: 'json' };
import profiles from '../data/specimenProfiles.json' with { type: 'json' };
import { parseSignView, parseSpecimenProfiles } from './sections';

test('checked author profiles retain their exact objects and byte-significant property order', () => {
  expect(parseSignView(signs)).toBe(signs);
  expect(parseSpecimenProfiles(profiles)).toBe(profiles);
});

test('profile admission refuses unknown styles, poses, fields and broken gate tuples', () => {
  const style = structuredClone(signs); style.defaults.style = 'unknown';
  expect(() => parseSignView(style)).toThrow();
  expect(() => parseSignView({ ...signs, extra: true })).toThrow();
  expect(() => parseSignView({ ...signs, variants: [{ id: 'missing', label: 'Missing fields', params: { text: 'x' } }] })).toThrow();
  const pose = structuredClone(profiles); pose.FIGURE_PROFILE.defaults.pose = 'floating';
  expect(() => parseSpecimenProfiles(pose)).toThrow();
  const tuple = structuredClone(profiles); tuple.PAIFANG.square.posts = [1, 2, 3];
  expect(() => parseSpecimenProfiles(tuple)).toThrow();
});
