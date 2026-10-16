import { CONTRACT_ROWS } from '../data/contractRows';
import { TRADES } from '../data/trades';
import { RANGER, MILLER, TRADER } from './wardensHollow';
import { PINE_QUESTS } from '../data/quests';

const chapter = PINE_QUESTS.quests[0];
if (chapter === undefined) throw new Error('Pine requires its compiled chapter');
const { onComplete: _completion, ...WARDENS_HOLLOW } = chapter;

/** Every offer, conversation and chapter is authored here; runtime state is level-owned. */
export const PINE_QUEST_CONTENT = {
  id: 'pine.quest', chapters: [WARDENS_HOLLOW],
  board: { id: 'pine.lodge', rows: CONTRACT_ROWS },
  trader: { id: 'pine.mott', rows: TRADES },
  npcs: [RANGER, MILLER, TRADER],
};
