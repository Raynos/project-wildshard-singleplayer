import { parseLedgerRules } from '@wildshard/sdk/ledger';
import { STRINGS } from '../strings';

/** Completion witnesses own the profile grants; Sky has no legacy visible title table to replace. */
export const SKY_LEDGER = parseLedgerRules([
  { fact: 'far-reach.quest', origin: { kind: 'engine', source: 'quest.complete' }, rewards: [{ kind: 'achievement', id: 'far-reach.quest', title: STRINGS.quest, threshold: 1 }] },
  { fact: 'far-reach.roc', origin: { kind: 'engine', source: 'encounter.victory' }, rewards: [{ kind: 'achievement', id: 'far-reach.roc', title: STRINGS.roc, threshold: 1 }] },
]);
