import type { ContractCatalogue } from '../runtime/lodge';
import { TRADES } from '../data/trades';
import { RANGER, MILLER, TRADER } from './wardensHollow';
import { PINE_QUESTS } from '../data/quests';

const chapter = PINE_QUESTS.quests[0];
if (chapter === undefined) throw new Error('Pine requires its compiled chapter');
const { onComplete: _completion, ...WARDENS_HOLLOW } = chapter;

interface PineQuestContent {
  id: string; chapters: (typeof WARDENS_HOLLOW)[]; board: { id: string; rows: ContractCatalogue['rows'] };
  trader: { id: string; rows: typeof TRADES }; npcs: (typeof RANGER)[];
}

/** Every offer, conversation and chapter is authored here; runtime state is level-owned. */
export const pineQuestContent = (contracts: ContractCatalogue): PineQuestContent => ({
  id: 'pine.quest', chapters: [WARDENS_HOLLOW],
  board: { id: 'pine.lodge', rows: contracts.rows },
  trader: { id: 'pine.mott', rows: TRADES },
  npcs: [RANGER, MILLER, TRADER],
});
