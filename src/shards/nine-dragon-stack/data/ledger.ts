import { parseLedgerRules } from '@wildshard/sdk/ledger';

/** Nine Dragon's two feats, each a gameplay fact the trusted runtime emits (page and headless host alike). */
export const NINE_FACT = {
  /** a deck's portal rode you into Lantern Square (the ride lands on the square's arrival) */
  square: 'nine-dragon-stack.lantern-square',
  /** the Fei Zhua's lifting crossing over the Well settled on the far deck */
  well: 'nine-dragon-stack.well',
} as const;

/** Nine Dragon's feats as ledger facts (G285): the platform owns each profile achievement's grant, once per shard. */
export const NINE_LEDGER = parseLedgerRules([
  { fact: NINE_FACT.square, origin: { kind: 'engine', source: 'portal.ride' },
    rewards: [{ kind: 'achievement', id: NINE_FACT.square, title: 'Lantern Square', threshold: 1 }] },
  { fact: NINE_FACT.well, origin: { kind: 'engine', source: 'fei-zhua.crossing' },
    rewards: [{ kind: 'achievement', id: NINE_FACT.well, title: 'Over the Well', threshold: 1 }] },
]);
