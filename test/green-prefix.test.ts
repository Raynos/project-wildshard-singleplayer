import { describe, expect, it } from 'vitest';
import { failedSteps, failingTestFiles, newestPassing } from '../scripts/green-prefix.mjs';

// SF74 W25: a red push gate still pushes the newest unpushed verified regeneration commit where the failing files pass.
const GATE = [
  '  ✓ oxlint (73 s)',
  '  ✗ vitest (259 s)',
  '  ✓ vite-build (31 s)',
  '── vitest ──',
  ' FAIL  |unit| test/baked-maps.test.ts > baked maps (SF66) > pine-hollow: the shipped map matches its world',
  ' FAIL  |unit| test/proof/pine-hollow/headless.test.ts > walks the dam leg through native gameplay',
  ' FAIL  |unit| test/baked-maps.test.ts > baked maps (SF66) > nine-dragon-stack: the shipped map matches its world',
  ' FAIL  test/plain.test.ts > no project label',
].join('\n');

describe('green prefix', () => {
  it('reads the failed steps and the failing test files from the gate output', () => {
    expect(failedSteps(GATE)).toEqual(['vitest']);
    expect(failingTestFiles(GATE)).toEqual(['test/baked-maps.test.ts', 'test/plain.test.ts', 'test/proof/pine-hollow/headless.test.ts']);
    expect(failedSteps('  ✗ typecheck (12 s)\n  ✗ vitest (1 s)')).toEqual(['typecheck', 'vitest']);
  });
  it('finds the newest passing candidate in log2 probes', () => {
    const shas = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    for (let brk = 0; brk <= shas.length; brk++) {
      const probed: string[] = [];
      const index = newestPassing(shas, (sha) => { probed.push(sha); return shas.indexOf(sha) < brk; });
      expect(index).toBe(brk - 1);
      expect(probed.length).toBeLessThanOrEqual(3);
    }
    expect(newestPassing([], () => true)).toBe(-1);
  });
});
