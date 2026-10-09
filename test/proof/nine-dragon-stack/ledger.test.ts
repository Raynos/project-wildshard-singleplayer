import { expect, it } from 'vitest';
import { nativeCompatibility } from '../compatibility/native';

// SF72: the shard source (shard.config.ts) loads renderer-free; the fragment declares no ledger rule, so the stage
// reports exactly that and never claims a gameplay emission.
it('loads the actual shard source in strict Node and reports no declared ledger rule', () => {
  const result = nativeCompatibility('nine-dragon-stack', 'ledger');
  expect(result.status).toBe(0); expect(result.stderr).toBe('');
  const report: unknown = JSON.parse(result.stdout);
  expect(report).toMatchObject({ compatible: false, declarations: { sourceLoaded: true, quests: [], ledgerRules: [], runtimeBinds: ['items'] },
    ledger: { status: 'not-declared', rules: 0, gameplayEmissionProven: false } });
});
