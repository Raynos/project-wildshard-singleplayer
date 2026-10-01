import { CONTRACT_ROWS } from './contracts';
import { TRADES } from './trades';
import { WARDENS_HOLLOW, RANGER, MILLER, TRADER } from './wardensHollow';

/** Every offer, conversation and chapter is authored here; runtime state is level-owned. */
export const PINE_QUEST_CONTENT = {
  id: 'pine.quest', chapters: [WARDENS_HOLLOW],
  board: { id: 'pine.lodge', rows: CONTRACT_ROWS },
  trader: { id: 'pine.mott', rows: TRADES },
  npcs: [RANGER, MILLER, TRADER],
};
