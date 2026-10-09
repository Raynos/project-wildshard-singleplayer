import { expect, it } from 'vitest';
import { skyWitness } from './native';

it('grants both declared achievements once from gameplay facts (the winch from the step, the Roc\'s fall from the storm), durably, with no re-emission after a restore', () => {
  const result = skyWitness('slice-ledger');
  expect(result.stderr).toBe(''); expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout)).toMatchObject({ 'slice-ledger': { status: 'passed', rules: 2,
    facts: [{ name: 'far-reach.quest', origin: 'engine.quest.complete' }, { name: 'far-reach.roc', origin: 'engine.encounter.victory' }],
    achievements: [{ id: 'far-reach.quest', count: 1, earned: true }, { id: 'far-reach.roc', count: 1, earned: true }],
    durableReload: true, duplicateStable: true, restoredReemits: 0, gameplayEmissionProven: true } });
}, 120_000);
