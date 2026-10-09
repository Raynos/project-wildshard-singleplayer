import { expect, it } from 'vitest';
import { nativeCompatibility } from '../compatibility/native';

it('loads the full node-safe source and proves its partial durable ledger contract', () => {
  const result = nativeCompatibility('far-reach', 'ledger');
  expect(result.status).toBe(1); expect(result.stderr).toBe('');
  const report: unknown = JSON.parse(result.stdout);
  expect(report).toMatchObject({ compatible: false, declarations: { sourceLoaded: true, scripts: 1, ordinarySpawns: 0 },
    ledger: { status: 'partial', rules: 2, facts: 2, durableReload: true, refusedWriteRetried: true,
      duplicateStable: true, gameplayEmissionProven: false } });
});
