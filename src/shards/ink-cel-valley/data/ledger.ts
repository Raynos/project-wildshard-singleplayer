import { parseLedgerRules } from '@wildshard/sdk/ledger';

/** Compiled at SF16: the platform receives an adventure fact and owns the profile achievement grant. */
export const INK_LEDGER = parseLedgerRules([{ fact: 'ink.quest', origin: { kind: 'engine', source: 'quest.complete' },
  rewards: [{ kind: 'achievement', id: 'ink.firstQuest', title: 'A first adventure', threshold: 1 }] }]);
