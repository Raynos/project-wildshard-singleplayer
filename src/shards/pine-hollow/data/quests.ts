import { parseQuestData } from '@wildshard/sdk/quests';
import people from './questNpcs.generated.json' with { type: 'json' };

/** The same validated chapter compiled by the retained NPC/quest producer. */
export const PINE_QUESTS = parseQuestData(people.quests);
