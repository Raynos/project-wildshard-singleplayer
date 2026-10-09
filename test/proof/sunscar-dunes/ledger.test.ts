import { expect, it } from 'vitest';
import { signalWitness } from './native';

it('grants both declared achievements once from gameplay facts, durably, with no re-emission after a restore', () => {
  const result = signalWitness('ledger');
  expect(result.stderr).toBe(''); expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout)).toMatchObject({ ledger: { status: 'passed', rules: 2,
    facts: [{ name: 'sunscar.signal', origin: 'engine.quest.complete' }, { name: 'sunscar.matriarch', origin: 'engine.encounter.victory' }],
    achievements: [{ id: 'sunscar.signal', count: 1, earned: true }, { id: 'sunscar.matriarch', count: 1, earned: true }],
    durableReload: true, duplicateStable: true, restoredReemits: 0, gameplayEmissionProven: true } });
}, 120_000);
