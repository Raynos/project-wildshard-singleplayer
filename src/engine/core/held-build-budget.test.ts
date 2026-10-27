import { afterEach, expect, test } from 'vitest';
import { frameBudgetSpent, heldBudget, HELD_BUILD_MS, HELD_CPU_FRAME_MS, nativeBudgetSpent, noteFrameDrawn, setBuildHeld } from './framePacing';

afterEach(() => { setBuildHeld(false); noteFrameDrawn(Number.NEGATIVE_INFINITY); });

// G580 T5: while the traveller is held at a cell's wall, a build stretch runs HELD_BUILD_MS past the last drawn frame.
test('a held build keeps its stretch past the shared frame budget, up to the held budget', () => {

  noteFrameDrawn(performance.now() - 12); // drawn 12 ms ago: past the ordinary ~4-8 ms shared budget
  expect(frameBudgetSpent(8)).toBe(true);
  expect(nativeBudgetSpent(8)).toBe(true);
  setBuildHeld(true);
  expect(heldBudget(8)).toBe(HELD_BUILD_MS); expect(frameBudgetSpent(8)).toBe(false); expect(nativeBudgetSpent(8)).toBe(false);
  noteFrameDrawn(performance.now() - HELD_BUILD_MS - 1);
  expect(nativeBudgetSpent(8)).toBe(true);
  setBuildHeld(false);
  expect(heldBudget(8)).toBe(8);
});

// G782: held, CPU slices share HELD_CPU_FRAME_MS between drawn frames (several stretches); native GPU units keep
// HELD_BUILD_MS, so the longer CPU budget never joins two slow native units in one frame.
test('held CPU slices run several stretches per drawn frame; native units keep the held stretch', () => {
  setBuildHeld(true);
  noteFrameDrawn(performance.now() - HELD_BUILD_MS * 2);
  expect(frameBudgetSpent(8)).toBe(false);
  expect(nativeBudgetSpent(8)).toBe(true);
  noteFrameDrawn(performance.now() - HELD_CPU_FRAME_MS - 1);
  expect(frameBudgetSpent(8)).toBe(true);
});
