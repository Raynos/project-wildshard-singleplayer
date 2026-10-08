import { parseLedgerRules } from '@wildshard/sdk/ledger';
import { DRIFTWOOD_FEATS } from '../quest/rows';

/** Existing feat identities/titles/counts remain the UI projection; these rows own the profile grants. */
export const DRIFTWOOD_LEDGER = parseLedgerRules(DRIFTWOOD_FEATS.map(feat => ({
  fact: `driftwood.${feat.id}`, origin: { kind: 'engine', source: feat.kind === undefined ? 'quest.progress' : 'actor.died' },
  rewards: [{ kind: 'achievement', id: feat.id, title: feat.title, threshold: feat.count }],
})));
