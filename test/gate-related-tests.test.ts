import { expect, it } from 'vitest';
import { capRelated } from '../scripts/gate-related-tests.mjs';

const durations = new Map([['test/slow.test.ts', 40], ['test/cheap.test.ts', 1], ['test/mid.test.ts', 8], ['test/cover-grid.test.ts', 30]]);
const related = [...durations.keys()];

it('runs every related test file when the estimate fits the budget', () => {
  expect(capRelated(related, ['src/x.ts'], durations, 45, 4)).toEqual({ run: [...related].sort(), left: [] });
});

it('runs the files named after a changed source first, then the cheapest, and leaves the rest to CI', () => {
  // Budget (45 - 5) × 2 = 80 test seconds; each file adds 0.5 s of module load.
  expect(capRelated(related, ['src/world/coverGrid.ts'], durations, 45, 2))
    .toEqual({ run: ['test/cheap.test.ts', 'test/cover-grid.test.ts', 'test/mid.test.ts'], left: ['test/slow.test.ts'] });
});

it('always runs a changed test file, even one the import walk did not return', () => {
  expect(capRelated([], ['test/new.test.ts', 'src/a.ts'], durations, 45, 4)).toEqual({ run: ['test/new.test.ts'], left: [] });
});
