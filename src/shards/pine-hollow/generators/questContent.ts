import type { ContractRow } from './contractRows';
import type { Trade } from './trades';
import { RANGER, MILLER, TRADER } from './nativeReadings';
import { PINE_QUESTS } from './quests';

const chapter = PINE_QUESTS.quests[0];
if (chapter === undefined) throw new Error('Pine requires its compiled chapter');
const { onComplete: _completion, ...WARDENS_HOLLOW } = chapter;

export interface PineQuestContent {
  id: string; chapters: (typeof WARDENS_HOLLOW)[]; board: { id: string; rows: readonly ContractRow[] };
  trader: { id: string; rows: Trade[] }; npcs: (typeof RANGER)[];
}

/** Every offer, conversation and chapter is authored here; runtime state is level-owned. */
export const pineQuestContent = (contracts: { readonly rows: readonly ContractRow[] }, trades: { readonly goods: readonly { readonly trade: Trade }[] }): PineQuestContent => ({
  id: 'pine.quest', chapters: [WARDENS_HOLLOW],
  board: { id: 'pine.lodge', rows: contracts.rows },
  trader: { id: 'pine.mott', rows: trades.goods.map(good => good.trade) },
  npcs: [RANGER, MILLER, TRADER],
});
