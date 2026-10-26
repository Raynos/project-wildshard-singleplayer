import { parseLedgerRules } from '@wildshard/sdk/ledger';
import { PINE_FEATS } from './questInventory';

/** Native progress remains the journal/title presentation adapter; profile grants are declared, deduplicated facts. */
export const PINE_LEDGER: { fact: string; origin: { kind: "engine" | "script"; source: string; }; rewards: (({ kind: "catalogue"; item: string; tier: number; quantity: number; }) | ({ kind: "achievement"; id: string; title: string; threshold: number; }))[]; }[] = parseLedgerRules(PINE_FEATS.map((feat) => ({
  fact: `pine.feat.${feat.id}`, origin: { kind: 'engine', source: 'pine.progress' },
  rewards: [{ kind: 'achievement', id: `pine-hollow.${feat.id}`, title: feat.title, threshold: feat.count }],
})));
