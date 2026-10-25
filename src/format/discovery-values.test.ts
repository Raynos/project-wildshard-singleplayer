import { expect, test } from 'vitest';
import { parseDiscoveryValues } from './discoveryValues';

const pose = { eye: [1, 2, 3], yaw: 0.5, pitch: -0.2, mockup: 'original', frame: 'portrait' };
const files = { sky: ['sky.webp'], props: ['model.glb'] };
const modes = { modes: { phone: { img: files, ktx2: files }, desktop: { img: files, ktx2: files } } };

test('discovery keeps every tier/texture mode and detaches source values', () => {
  const input = { poses: { spawn: pose }, 'boot.files': ['a', 'b'], 'boot.sources': modes,
    'boot.lateReads': { modes: { phone: { img: ['p'], ktx2: ['pk'] }, desktop: { img: ['d'], ktx2: ['dk'] } } },
    'boot.explore': { art: ['card.webp'] }, audioCues: { fire: 'cue.weapon.fire' } };
  const result = parseDiscoveryValues(input);
  expect(result).toEqual(input);
  files.props.push('later.glb'); pose.eye[0] = 99;
  expect(result).not.toEqual(input);
  expect(result.poses?.['spawn']?.eye).toEqual([1, 2, 3]);
});

test('fixed source selections remain data and retain their original order', () => {
  const sources = { tiers: { phone: files, desktop: files } };
  const input = { 'boot.files': { sources, tier: 'phone', tex: 'img' }, 'boot.sources': sources };
  expect(parseDiscoveryValues(input)).toEqual(input);
});

test.each([
  { load: {} }, { entry: {} }, { render: {} }, { poses: { spawn: { ...pose, eye: [1, 2] } } },
  { 'boot.sources': { modes: { phone: { img: files, ktx2: files } } } },
  { 'boot.files': { sources: {}, tier: 'watch', tex: 'img' } }, { 'boot.explore': { art: [1] } },
  { budgets: { phone: { fps: Number.NaN } } }, { audioCues: { fire: () => 'cue.fire' } },
])('refuses missing shapes, loader authority and non-JSON values %#', input => {
  expect(() => parseDiscoveryValues(input)).toThrow();
});

test('refuses accessors without running authored code', () => {
  let reads = 0;
  const input = Object.defineProperty({}, 'poses', { enumerable: true, get: () => { reads++; return {}; } });
  expect(() => parseDiscoveryValues(input)).toThrow('plain bounded JSON');
  expect(reads).toBe(0);
});
