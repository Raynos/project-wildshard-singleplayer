import { parseLedgerRules } from '@wildshard/sdk/ledger';
import { NALATI_FEATS } from '../feats';

/** Chapter completion facts keep the legacy feat ids; all other feats witness their original counted outcomes. */
export const NALATI_QUEST_FEATS: Readonly<Record<string, string>> = { tulpar: 'tulpar', 'golden-king': 'chapter-king', 'father-wind': 'chapter-wind' };
/** Nalati's profile rewards belong to SF14; no shard-owned achievement save is written. */
export const NALATI_LEDGER = parseLedgerRules(NALATI_FEATS.map((feat) => {
  const chapter = Object.entries(NALATI_QUEST_FEATS).find(([, id]) => id === feat.id)?.[0];
  return { fact: chapter === undefined ? `nalati.feat.${feat.id}` : `nalati.quest.${chapter}`,
    origin: { kind: 'engine', source: chapter === undefined ? 'encounter.outcome' : 'quest.complete' },
    rewards: [{ kind: 'achievement', id: feat.id, title: feat.title, threshold: feat.count }] };
}));
