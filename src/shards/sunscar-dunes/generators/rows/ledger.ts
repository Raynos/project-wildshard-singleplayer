import { parseLedgerRules } from '@wildshard/sdk/ledger';

/** Signal Dunes' feats as ledger facts (SF14, SF50-p): the platform owns each profile achievement's grant, once per shard. */
export const SIGNAL_LEDGER: { fact: string; origin: { kind: "engine" | "script"; source: string; }; rewards: (({ kind: "catalogue"; item: string; tier: number; quantity: number; }) | ({ kind: "achievement"; id: string; title: string; threshold: number; }))[]; }[] = parseLedgerRules([
  { fact: 'sunscar.signal', origin: { kind: 'engine', source: 'quest.complete' }, rewards: [{ kind: 'achievement', id: 'sunscar.signal', title: 'The signal', threshold: 1 }] },
  { fact: 'sunscar.matriarch', origin: { kind: 'engine', source: 'encounter.victory' }, rewards: [{ kind: 'achievement', id: 'sunscar.matriarch', title: 'The Dune Matriarch', threshold: 1 }] },
]);
