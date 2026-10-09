import { expect, it } from 'vitest';
import { nativeCompatibility } from '../compatibility/native';

// G285: Nine's two feats are ledger rows (data/ledger.ts). The same tape's committed facts (the ride home lands in Lantern
// Square; the Fei Zhua's lifting crossing settles over the Well) reach the platform Ledger once, durably, and a session
// restored from the tape's end re-emits nothing.
it('grants both declared achievements once from gameplay facts, durably, with no re-emission after a restore', () => {
  const result = nativeCompatibility('nine-dragon-stack', 'ledger');
  expect(result.stderr).toBe(''); expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout)).toMatchObject({ compatible: false,
    declarations: { sourceLoaded: true, quests: [], ledgerRules: ['nine-dragon-stack.lantern-square', 'nine-dragon-stack.well'], runtimeBinds: ['items', 'ledger'] },
    ledger: { status: 'passed', rules: 2,
      facts: [{ name: 'nine-dragon-stack.lantern-square', origin: 'engine.portal.ride', entity: 'portal.square.arrival' }, { name: 'nine-dragon-stack.well', origin: 'engine.fei-zhua.crossing', entity: 'well' }],
      achievements: [{ id: 'nine-dragon-stack.lantern-square', count: 1, earned: true }, { id: 'nine-dragon-stack.well', count: 1, earned: true }],
      durableReload: true, duplicateStable: true, restoredReemits: 0, gameplayEmissionProven: true } });
}, 120_000);
