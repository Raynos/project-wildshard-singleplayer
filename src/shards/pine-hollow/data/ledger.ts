import { parseLedgerRules } from '@wildshard/sdk/ledger';
import { PINE_FEATS } from '../feats';

/** Native progress remains the journal/title presentation adapter; profile grants are declared, deduplicated facts. */
export const PINE_LEDGER = parseLedgerRules(PINE_FEATS.map((feat) => ({
  fact: `pine.feat.${feat.id}`, origin: { kind: 'engine', source: 'pine.progress' },
  rewards: [{ kind: 'achievement', id: `pine-hollow.${feat.id}`, title: feat.title, threshold: feat.count }],
})));
