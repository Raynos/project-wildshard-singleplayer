import { expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- The frozen original crown declaration is hashed as persisted JSON.
import { createHash } from 'node:crypto';
import { CROWN_STONES } from '../../../src/shards/far-reach/data/crownLayout';
import { ROC_PROFILE } from '../../../src/shards/far-reach/data/brains';

it('preserves every original crown stone coordinate, height and heading as persisted authoring rows', () => {
  expect(createHash('sha256').update(JSON.stringify(CROWN_STONES)).digest('hex')).toBe('1f34858333c4e4ee8358465221d797e1754fef319a16b72de3cbc429d5602e5d');
});

it('keeps the Roc perched on the actual tallest authored crown stone', () => {
  const stone = CROWN_STONES.find(row => row.x === ROC_PROFILE.perch.x && row.z === ROC_PROFILE.perch.z);
  expect(stone).toBeDefined();
  expect(stone?.h).toBe(Math.max(...CROWN_STONES.map(row => row.h)));
  expect(Number.isFinite(ROC_PROFILE.perch.yaw)).toBe(true);
});
