import { afterEach, expect, test } from 'vitest';
import { frameBudgetSpent, heldBudget, HELD_BUILD_MS, noteFrameDrawn, setBuildHeld, setFramePacing } from '../src/engine/core/framePacing';

afterEach(() => { setBuildHeld(false); setFramePacing(false); });

// G580 T5: while the traveller is held at a cell's wall, a build stretch runs HELD_BUILD_MS past the last drawn frame.
test('a held build keeps its stretch past the shared frame budget, up to the held budget', () => {
  setFramePacing(true);
  noteFrameDrawn(performance.now() - 12); // drawn 12 ms ago: past the ordinary ~4-8 ms shared budget
  expect(frameBudgetSpent(8)).toBe(true);
  setBuildHeld(true);
  expect(heldBudget(8)).toBe(HELD_BUILD_MS); expect(frameBudgetSpent(8)).toBe(false);
  noteFrameDrawn(performance.now() - HELD_BUILD_MS - 1);
  expect(frameBudgetSpent(8)).toBe(true);
  setBuildHeld(false);
  expect(heldBudget(8)).toBe(8);
});
