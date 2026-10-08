import { parseQuestData } from '@wildshard/sdk/quests';
import { WARDENS_HOLLOW, QUEST_EXTERNAL, QUEST_DONE } from '../quest/wardensHollow';

/** The shipping seven-step chapter; native NPC presentation and the dawn camera remain runtime recipes. */
export const PINE_QUESTS = parseQuestData({
  flags: [...QUEST_EXTERNAL, QUEST_DONE, 'taken:pond-glass'],
  quests: [{ ...WARDENS_HOLLOW, onComplete: { fact: 'pine.feat.quest' } }],
  triggers: [], dialogue: [],
});
