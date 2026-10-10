import { expect, it } from 'vitest';
import { nalatiWitness } from './native';

it('proves only the real declared ledger rows survive refusal, retry, reload and duplicate ingress', () => {
  const result = nalatiWitness('ledger');
  expect(result.status).toBe(1); expect(result.stderr).toBe('');
  const report: unknown = JSON.parse(result.stdout);
  expect(report).toMatchObject({ compatible: false, declarations: { sourceLoaded: true, ordinarySpawns: 0 },
    ledger: { status: 'partial', rules: 17, durableReload: true, refusedWriteRetried: true,
      duplicateStable: true, gameplayEmissionProven: false } });
});
