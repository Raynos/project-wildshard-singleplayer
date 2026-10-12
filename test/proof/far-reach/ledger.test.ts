import { expect, it } from 'vitest';
import { skyWitness } from './native';
import compatibility from './compatibility.json';

it('grants both declared achievements once from gameplay facts (the winch from the step, the Roc\'s fall from the storm), durably, with no re-emission after a restore', () => {
  const result = skyWitness('slice-ledger');
  expect(result.stderr).toBe(''); expect(result.status).toBe(0);
  const report = JSON.parse(result.stdout) as { 'slice-ledger': { windows: { from: string; ticks: number }[]; endpoint: { ticksExecuted: number; victoryTick: number; hash: string } } };
  expect(report).toMatchObject({ 'slice-ledger': { status: 'passed', rules: 2,
    facts: [{ name: 'far-reach.quest', origin: 'engine.quest.complete' }, { name: 'far-reach.roc', origin: 'engine.encounter.victory' }],
    achievements: [{ id: 'far-reach.quest', count: 1, earned: true }, { id: 'far-reach.roc', count: 1, earned: true }],
    durableReload: true, duplicateStable: true, restoredReemits: 0, gameplayEmissionProven: true } });
  const storm = report['slice-ledger'].windows.find(window => window.from === 'storm');
  if (storm === undefined) throw new Error('Missing storm-to-victory window');
  expect(storm.ticks).toBeLessThanOrEqual(10_000);
  const { ticksExecuted, victoryTick, hash } = compatibility.headless;
  expect(report['slice-ledger'].endpoint).toEqual({ ticksExecuted, victoryTick, hash });
}, 120_000);
