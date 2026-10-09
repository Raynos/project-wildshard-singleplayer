import { expect } from 'vitest';
import type { SimSnapshot } from '../../src/engine/sim/snapshot';

/**
 * Exact equality of two sim snapshots, cheaply (ci-green, E435). A shard's snapshot carries its whole native physics
 * world as a plain byte array (Pine's is 8.4 M entries): `toEqual` on it, or serialising both snapshots to compare the
 * strings, cost a headless restore test ~6 s and ~13 s per checkpoint under CI coverage. Here the bytes are compared in
 * one plain loop and everything else with `toEqual`. It proves as much as comparing `serializeSimSnapshot` strings
 * (serialising is a pure function of the snapshot), so a restore test still round-trips its checkpoint through the
 * string once and compares the continuations with this.
 */
export function expectSameSimSnapshot(actual: SimSnapshot, expected: SimSnapshot): void {
  const { physics: a, ...rest } = actual, { physics: b, ...expectedRest } = expected;
  expect(a.length, 'physics bytes').toBe(b.length);
  let first = -1;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { first = i; break; }
  expect(first, 'first differing physics byte').toBe(-1);
  expect(rest).toEqual(expectedRest);
}
