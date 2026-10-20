import { expect, test } from 'vitest';
import { physicsEntryFailures } from '../scripts/physics-grid-entry.mjs';

const standalone = { registered: { pier: 63, wreck: 21 }, native: { pier: 63, wreck: 21 }, total: 100,
  pier: { y: 0.5, owner: 'pier' }, grid: null };

test('grid collision parity ignores platform shapes but requires each authored native owner', () => {
  expect(physicsEntryFailures(standalone, { ...standalone, total: 180, grid: 'driftwood-isle' })).toEqual([]);
  // The live bug registered the pier in the neutral shell while the active region kept its other 955 colliders.
  const grid = { ...standalone, total: 955, native: { wreck: 21 }, registered: { wreck: 21 } };
  expect(physicsEntryFailures(standalone, grid)).toEqual(['pier: registered 0, standalone 63', 'pier: native 0, standalone 63']);
  expect(physicsEntryFailures(standalone, { ...standalone, native: { wreck: 21 } })).toContain('pier: native 0, standalone 63');
});

test('a terrain or water hit cannot stand in for the native pier floor', () => {
  expect(physicsEntryFailures(standalone, { ...standalone, pier: { y: -0.8686, owner: null } })).toContain('Pier deck is not the same solid native floor');
  expect(physicsEntryFailures(standalone, { ...standalone, pier: null })).toContain('Pier deck is not the same solid native floor');
});
