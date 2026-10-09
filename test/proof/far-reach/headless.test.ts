import { expect, it } from 'vitest';
import { skyWitness } from './native';

// The CI slices of Sky's whole spawn → Roc tape (run.mjs all, compatibility.json), each under DEPLOY.md's 10k-tick budget.
it('walks 10,000 ticks from the spawn by tick commands alone: the keeper, three vanes GUSTed, the roost felled, both hover bridges and the updraft on the board to the step, the winch', () => {
  const result = skyWitness('slice-step');
  expect(result.stderr).toBe(''); expect(result.status).toBe(0);
  const report = JSON.parse(result.stdout) as { 'slice-step': { boardTicks: number; updraftTicks: number; boardPeak: number } };
  expect(report).toMatchObject({ slug: 'far-reach', entry: 'runtime/headless.ts',
    'slice-step': { status: 'passed', ticksExecuted: 10_000, onStep: true, flags: { vanes: true, roost: true }, raised: true, alive: true, facts: ['far-reach.quest'], entries: { lanes: 92 } } });
  const slice = report['slice-step'];
  // the board rode the updraft's column up to the step's deck (44 m)
  expect(slice.boardTicks).toBeGreaterThan(0); expect(slice.updraftTicks).toBeGreaterThan(0); expect(slice.boardPeak).toBeGreaterThan(44);
}, 120_000);
