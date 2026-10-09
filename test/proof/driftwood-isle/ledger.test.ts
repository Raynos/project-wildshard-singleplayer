import { expect, it } from 'vitest';
import { driftwoodWitness } from './native';

for (const name of ['spawn', 'tick-10000', 'captain']) it(`persists only actual native gameplay grants from ${name}, with refusal/retry/reload/dedupe`, () => {
  const result = driftwoodWitness(`ledger-${name}`);
  expect(result.stderr).toBe(''); expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout)).toMatchObject({ compatible: false, ledger: { status: 'passed', rules: 10,
    durableReload: true, refusedWriteRetried: true, duplicateStable: true, gameplayEmissionProven: true } });
}, 60_000);
