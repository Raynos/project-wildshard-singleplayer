import type { ContractCatalogue } from '../runtime/lodge';
import type { TradeCatalogue, Trade } from '../runtime/trader';
import { RANGER, MILLER, TRADER } from './wardensHollow';
import { PINE_QUESTS } from '../data/quests';

const chapter = PINE_QUESTS.quests[0];
if (chapter === undefined) throw new Error('Pine requires its compiled chapter');
const { onComplete: _completion, ...WARDENS_HOLLOW } = chapter;

interface PineQuestContent {
  id: string; chapters: (typeof WARDENS_HOLLOW)[]; board: { id: string; rows: ContractCatalogue['rows'] };
  trader: { id: string; rows: Trade[] }; npcs: (typeof RANGER)[];
}

/** Every offer, conversation and chapter is authored here; runtime state is level-owned. */
export const pineQuestContent = (contracts: ContractCatalogue, trades: TradeCatalogue): PineQuestContent => ({
  id: 'pine.quest', chapters: [WARDENS_HOLLOW],
  board: { id: 'pine.lodge', rows: contracts.rows },
  trader: { id: 'pine.mott', rows: trades.goods.map(good => good.trade) },
  npcs: [RANGER, MILLER, TRADER],
});
