import { expect } from 'vitest';
import type { SimSnapshot } from '../../src/engine/sim/snapshot';
import { physicsDifference, physicsState, sameBytes } from './simState';

/**
 * Exact equality of two sim snapshots, cheaply (ci-green, E435). A shard's snapshot carries its whole native physics
 * world as a plain byte array (Pine's is 8.4 M entries): `toEqual` on it, or serialising both snapshots to compare the
 * strings, cost a headless restore test ~6 s and ~13 s per checkpoint under CI coverage. So everything but the physics
 * is compared with `toEqual`, and the physics bytes in one plain loop. A restore test still round-trips its checkpoint
 * through the string once and compares the continuations with this.
 *
 * Rapier's snapshot bytes are not canonical (test/fake/simState.ts: the broad phase's pair order permutes on round
 * trips, so equal worlds can serialise differently): when the bytes differ, the two worlds are restored and compared
 * as state, every body's pose / velocity / sleep, every collider's pose / enabled / groups and every dynamic body's
 * contacts, exactly (a 1-ULP pose difference still fails).
 */
export function expectSameSimSnapshot(actual: SimSnapshot, expected: SimSnapshot): void {
  const { physics: a, ...rest } = actual, { physics: b, ...expectedRest } = expected;
  expect(rest).toEqual(expectedRest);
  expect(a.length, 'physics bytes').toBe(b.length);
  if (sameBytes(a, b)) return;
  expect(physicsDifference(physicsState(a), physicsState(b)), 'restored physics state').toBeNull();
}
