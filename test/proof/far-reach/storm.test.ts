import { expect, it } from 'vitest';
import { skyWitness } from './native';

it('resumes in the gale-wall phase and carries the Storm Roc into its storm phase by War Fan play alone', () => {
  const result = skyWitness('slice-storm');
  expect(result.stderr).toBe(''); expect(result.status).toBe(0);
  const report = JSON.parse(result.stdout) as { 'slice-storm': { ticksExecuted: number; from: { hp: number }; to: { hp: number } } };
  expect(report).toMatchObject({ 'slice-storm': { status: 'passed', resumedFrom: 'gale', from: { phase: 1 }, to: { state: 'fight', phase: 2 }, attempts: 1 } });
  const slice = report['slice-storm'];
  expect(slice.to.hp).toBeLessThan(slice.from.hp); expect(slice.ticksExecuted).toBeLessThanOrEqual(10_000);
}, 120_000);
