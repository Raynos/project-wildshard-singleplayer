import { parseQuestData } from '@wildshard/sdk/quests';
import { NALATI_QUESTS, NALATI_QUEST_EXTERNAL } from '../quest';

function declaredQuest(quest: (typeof NALATI_QUESTS)[number]) {
  return { ...quest, onComplete: { fact: `nalati.quest.${quest.id}` } };
}

/** The three shipping chapters, with unchanged identities, conditions, hints and world markers. */
export const NALATI_QUEST_DATA = parseQuestData({
  flags: [...NALATI_QUEST_EXTERNAL, ...NALATI_QUESTS.map((quest) => quest.completeFlag)],
  quests: NALATI_QUESTS.map(declaredQuest),
  triggers: [], dialogue: [],
});
